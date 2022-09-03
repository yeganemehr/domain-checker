import { program } from "commander";
import path from "path";
import url from "url";
import { container } from "tsyringe";
import Config, { ILoggingConfig } from "../Config";
import winston from "winston";
import jsonStringify from 'safe-stable-stringify';
import moment from "moment";

export function getDefaultConfigSchemaPath(): string {
	return path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "config-schema.json");
}
export function getDefaultConfigPath(): string {
	return path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", 'config.json');
}

export async function setupConfig(): Promise<Config> {
	const config = await Config.fromFile(program.getOptionValue('config'));
	container.registerInstance(Config, config);

	return config;
}

export function setupLogger() {
	const config = container.resolve(Config);
	const loggingConfig = config.data.logging || { level: "debug", console: false, file: "/var/log/comain-checker.log" } as ILoggingConfig;
	const opts = program.opts() as {
		'logLevel'?: ILoggingConfig['level'],
		'logFile'?: string;
		'verbose'?: boolean;
	};
	if (opts.logLevel !== undefined) {
		loggingConfig.level = opts.logLevel;
	}
	if (opts.logFile !== undefined) {
		loggingConfig.file = opts.logFile;
	}
	if (opts.verbose !== undefined) {
		loggingConfig.console = opts.verbose;
	}

	const logFormat = winston.format.printf((log) => {
		const stringifiedRest = jsonStringify(Object.assign({}, log, {
			level: undefined,
			message: undefined,
			splat: undefined
		}));
		const rest = stringifiedRest !== "{}" ? " " + stringifiedRest : "";
		return `${moment().toISOString(true)} [${log.level}]: ${log.message}${rest}`;
	});

	const transports: winston.transport[] = [];
	if (loggingConfig !== undefined) {
		if (loggingConfig.console) {
			transports.push(new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize({ all: true}),
					logFormat,
				)
			}));
		}
		if (loggingConfig.file !== undefined) {
			transports.push(new winston.transports.File({ filename: loggingConfig.file }));
		}
	}

	const logger = winston.createLogger({
		transports,
		format: logFormat,
		level: loggingConfig.level,
	});

	container.registerInstance("Logger", logger);

	return logger;
}
