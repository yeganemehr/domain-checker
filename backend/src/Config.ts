
import Ajv from 'ajv';
import { singleton } from 'tsyringe';
import * as fs from 'fs/promises';
import {getDefaultConfigSchemaPath} from './Helpers/SetupHelpers';

export interface IServerConfig {
	port: number;
	host?: string;
	cache: boolean;
}

export interface ILoggingConfig {
	file: string;
	console: boolean;
	level: string;
}

export interface IDatabaseConfig {
	path: string;
}


export interface IRDAPConfig {
	tlds: Record<string, string>;
}

export interface IWhoisConfig {
	tlds: Record<string, string>;
}

export interface IConfigData {
	server: IServerConfig;
	logging: ILoggingConfig;
	database: IDatabaseConfig;
	rdap: IRDAPConfig;
	whois: IWhoisConfig;
}

@singleton()
export default class Config {
	public static async fromFile(path: string): Promise<Config> {
		const content = (await fs.readFile(path)).toString();
		const schemaString = (await fs.readFile(getDefaultConfigSchemaPath())).toString();
		const data = JSON.parse(content);
		const schema = JSON.parse(schemaString);

		const ajv = new Ajv();
		const validate = ajv.compile<IConfigData>(schema);

		if (!validate(data)) {
			console.error(validate.errors);
			throw new Error('config validation failed');
		}
		return new Config(data);
	}
	public constructor(public readonly data: IConfigData) {
	}

	public get(name: keyof IConfigData): any {
		return this.data[name];
	}

}
