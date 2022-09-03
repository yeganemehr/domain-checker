import { inject, singleton } from "tsyringe";
import _ from "lodash";
import Config from "./Config";
import { readFile } from "fs/promises";
import { writeFileSync } from "fs";

export enum DomainScanStatus {
	RUNNING,
	AVAILABLE,
	TAKEN,
}

export interface IScanCheckInfo {
	status: DomainScanStatus;
	modifiedAt: number;
}

export interface IScanState {
	running: boolean;
	pattern?: string;
	isRegex?: boolean;
	checks?: Record<string, IScanCheckInfo>;
}

@singleton()
export default class Database {
	private scanState: IScanState = {
		running: false,
	};

	public constructor(
		@inject(Config) private config: Config,
	) {}

	public getScanState(): IScanState {
		return _.cloneDeep(this.scanState);
	}

	public setScanState(newState: IScanState): void {
		this.scanState = _.cloneDeep(newState);
		this.save();
	}

	public setDomainCheckState(domain: string, state: IScanCheckInfo | undefined) {
		if (this.scanState.checks === undefined) {
			this.scanState.checks = {};
		}
		if (state === undefined) {
			delete this.scanState.checks[domain];
		} else {
			this.scanState.checks[domain] = state;
		}
		this.save();
	}

	public getDomainCheckState(domain: string): IScanCheckInfo | undefined {
		return this.scanState.checks?.[domain];
	}

	public async load() {
		try {
			const str = await readFile(this.config.data.database.path, "utf-8");
			const data = JSON.parse(str);
			for (const key in data) {
				(this as any)[key] = data[key];
			}
		} catch (e) {}
	}

	public save() {
		const json = JSON.stringify({
			scanState: this.scanState
		}, null, 2);
		writeFileSync(this.config.data.database.path, json);
	}
}