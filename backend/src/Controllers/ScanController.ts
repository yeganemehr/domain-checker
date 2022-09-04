import { Request, Response } from "express";
import { container, inject, singleton } from "tsyringe";
import Database, { DomainScanStatus, IScanCheckInfo, IScanState } from "../Database";
import HttpError from "../Errors/HttpError";
import { List, ValidateFunction } from "express-json-validator-middleware";
import Scanner from "../Scanner";
import { expand } from "regex-to-strings";
import InvalidInputError from "../Errors/InvalidInputError";
import { convertPatternToRegex, isValidDomain } from "../Helpers/ScanHelpers";
import { Socket } from "socket.io";
import HttpServer from "../HttpServer";
import moment from "moment";

@singleton()
export default class ScanController {
	public constructor(
		@inject(Database) private database: Database,
		@inject(Scanner) private scanner: Scanner,
	) {}

	public getStatusHttp(_: Request, res: Response) {
		const state = this.database.getScanState();
		res.json(this.exportState(state));
	}
	public getStatusWS(socket: Socket) {
		const state = this.database.getScanState();
		socket.emit("scan.state", this.exportState(state));
	}

	public startSchemaValidation(): List<ValidateFunction> {
		return {
			body: {
				type: "object",
				properties: {
					pattern: {
						type: "string"
					},
					isRegex: {
						type: "boolean"
					},
				},
				required: ["pattern", "isRegex"]
			}
		};

	}

	public start(req: Request, res: Response) {
		const body = req.body as {
			pattern: string;
			isRegex: boolean;
		};
		const state = this.database.getScanState();
		if (state.running) {
			throw new HttpError(400, "Currently there is a scan running. You should stop that first");
		}

		this.insureValidPattern(body.pattern, body.isRegex);

		const newState: IScanState = {
			running: true,
			pattern: body.pattern,
			isRegex: body.isRegex,
		};
		if (newState.pattern === state.pattern && newState.isRegex === body.isRegex) {
			newState.checks = state.checks;
		}
		this.database.setScanState(newState);
		setTimeout(() => this.scanner.start(), 1000); // Make time for cancel
		const exportState = this.exportState(newState);
		res.json(exportState);
		const httpServer = container.resolve<HttpServer>("HttpServer");
		httpServer.socket.emit("scan.state", exportState);
	}

	public async stop(_: Request, res: Response) {
		const state = this.database.getScanState();
		if (!state.running) {
			throw new HttpError(400, "Currently there is no scan running. You should start first");
		}
		await this.scanner.stop();
		state.running = false;
		this.database.setScanState(state);
		const exportState = this.exportState(state);
		res.json(exportState);
		const httpServer = container.resolve<HttpServer>("HttpServer");
		httpServer.socket.emit("scan.state", exportState);
	}
	public async download(_: Request, res: Response) {
		const state = this.database.getScanState();
		if (state.checks === undefined) {
			throw new HttpError(404, "There is nothing to download");
		}
		let csv = "Domain,Last Check\r\n";
		for (const domain in state.checks) {
			if (state.checks[domain].status !== DomainScanStatus.AVAILABLE) {
				continue;
			}
			csv += `${domain},${moment(state.checks[domain].modifiedAt).toISOString()}\r\n`; 
		}
		res.header("Content-Type", "text/csv").send(csv);
	}

	private insureValidPattern(pattern: string, isRegex: boolean) {

		let regex: RegExp;
		try {
			regex = convertPatternToRegex(pattern, isRegex);
		} catch (e) {
			throw new InvalidInputError("pattern", "Invalid pattern");
		}

		const expander = expand(regex);
		if (expander.count > 1000000) {
			throw new InvalidInputError("pattern", "This pattern make more than a milion domain names");
		}

		const maxSamples = 10000;
		let x = 0;
		for (const domain of expander.getIterator()) {
			if (x > maxSamples) {
				break;
			}
			if (!isValidDomain(domain)) {
				throw new InvalidInputError("pattern", "This pattern make invalid domain names: " + domain);
			}
			x++;
		}
	}

	private exportState(state: IScanState) {
		return {
			running: state.running,
			pattern: state.pattern,
			isRegex: state.isRegex,
			checks: state.checks !== undefined ? this.filterChecks(state.checks) : undefined,
		};
	}

	private filterChecks(checks: Record<string, IScanCheckInfo>) {
		const filtered: Record<string, IScanCheckInfo> = {};
		for (const domain in checks) {
			if (checks[domain].status === DomainScanStatus.AVAILABLE || checks[domain].status === DomainScanStatus.RUNNING) {
				filtered[domain] = checks[domain];
			}
		}
		return filtered;
	}

}
