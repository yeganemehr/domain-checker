import { expand } from "regex-to-strings";
import { container, inject, singleton } from "tsyringe";
import winston from "winston";
import CheckDomainWork from "./CheckDomainWork";
import Database, { DomainScanStatus } from "./Database";
import { convertPatternToRegex, isValidDomain } from "./Helpers/ScanHelpers";
import HttpServer from "./HttpServer";
import Work from "./Work";
import { WorkQueue } from "./WorkQueue";

@singleton()
export default class Scanner {
	private queues: Record<string, WorkQueue> = {};
	public constructor(
		@inject(Database) private database: Database,
		@inject("Logger") private logger: winston.Logger
	) {}

	public start() {
		if (Object.keys(this.queues).length) {
			throw new Error("Already running");
		}
		const state = this.database.getScanState();
		if (state.running === false) {
			return;
		}
		if (state.pattern === undefined || state.isRegex === undefined) {
			throw new Error();
		}
		if (state.checks !== undefined) {
			for (const domain in state.checks) {
				if (state.checks[domain].status === DomainScanStatus.RUNNING) {
					this.updateDomainStatus(domain, undefined);
				}
			}
		}
		const regex = convertPatternToRegex(state.pattern, state.isRegex);
		const expander = expand(regex);
		
		for (const domain of expander.getIterator()) {
			if (!isValidDomain(domain)) {
				continue;
			}
			for (const tld of this.getTlds()) {
				if (domain.endsWith(`.${tld}`)) {
					const state = this.database.getDomainCheckState(domain);
					if (!state || state.status === DomainScanStatus.RUNNING) {
						this.enqueueDomain(domain, tld);
					}
				}
			}
		}
		this.checkForEnd();
	}

	private getTlds(): string[] {
		return ["ir", "com", "net", "org"]
	}

	private enqueueDomain(domain: string, tld?: string) {
		if (tld === undefined) {
			for (const t of this.getTlds()) {
				if (domain.endsWith(`.${t}`)) {
					tld = t;
					break;
				}
			}
		}
		if (tld === undefined) {
			throw new Error("Cannot find tld of domain: " + domain);
		}
		if (!this.queues[tld]) {
			this.setupTldQueue(tld);
		}
		this.queues[tld].enqueue(new CheckDomainWork(domain)).then((result) => {
			this.updateDomainStatus(domain, result.available ? DomainScanStatus.AVAILABLE : DomainScanStatus.TAKEN);
			this.checkForEnd();
		}).catch((e) => {
			if (typeof e === "string" && e === "canceled") {
				return;
			}
			this.logger.error("Error during check domain", {domain, e:e.toString()});
			this.updateDomainStatus(domain, DomainScanStatus.TAKEN);
			this.checkForEnd();
		});
	}

	private checkForEnd() {
		for (const name in this.queues) {
			if (this.queues[name].isIddle()) {
				delete this.queues[name];
			}
		}
		if (Object.keys(this.queues).length === 0) {
			const state = this.database.getScanState();
			if (state.running === true) {
				state.running = false;
				this.database.setScanState(state);
				const httpServer = container.resolve<HttpServer>("HttpServer");
				httpServer.socket.emit("scan.state", { running: false });
			}
		}
	}

	private setupTldQueue(tld: string): void {
		const queue = new WorkQueue();
		if (tld === "ir") {
			queue.setMaxRunning(1);
		} else {
			queue.setMaxRunning(8);
		}
		queue.on("started", (check: Work) => {
			if (!(check instanceof CheckDomainWork)) {
				return;
			}
			this.updateDomainStatus(check.domain, DomainScanStatus.RUNNING);
		});
		this.queues[tld] = queue;
	}

	public async stop() {
		const queues = Object.values(this.queues);
		if (!queues.length) {
			return;
		}
		await Promise.all(queues.map((q) => q.stop()));
		this.queues = {};
	}

	private updateDomainStatus(domain: string, status: DomainScanStatus | undefined) {
		const modifiedAt = Date.now();
		this.database.setDomainCheckState(domain, status ? { status, modifiedAt } : undefined);

		const httpServer = container.resolve<HttpServer>("HttpServer");
		httpServer.socket.emit("scan.check", { domain, status: status !== undefined ? status : DomainScanStatus.TAKEN, modifiedAt });
	}
	
}