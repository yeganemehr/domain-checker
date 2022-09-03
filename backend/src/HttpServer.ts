import { container, inject, singleton } from "tsyringe";
import Config from "./Config";
import express, { NextFunction, Request, Response } from "express";
import http from "http"
import winston from "winston";
import morgan from "morgan";
import Router from "./Router";
import * as io from "socket.io";
import { ValidationError } from "express-json-validator-middleware";
import cors from "cors";
import ScanController from "./Controllers/ScanController";

@singleton()
export default class HttpServer {
	private express: express.Express;
	private httpServer: http.Server;
	public readonly socket: io.Server;

	public constructor(
		@inject(Config) private config: Config,
		@inject("Logger") private logger: winston.Logger,
	) {
		this.express = express();
		this.httpServer = http.createServer(this.express);
		this.socket = new io.Server(this.httpServer, {
			cors: {
				origin: "*"
			},
			transports: ["websocket"]
		});
		
		
		this.setupExpress();
		this.setupWS();
	}


	protected setupExpress() {
		this.express.disable("x-powered-by");
		this.express.use(morgan("short", {
			stream: {
				write: (message) => {
					this.logger.http(message);
				}
			}
		}));
		this.express.use(cors({
			origin: "*"
		}));
		this.express.use(express.json());
		this.express.use(Router());
		this.express.use((error: any, _: Request, response: Response, next: NextFunction) => {
			// Check the error is a validation error
			if (error instanceof ValidationError) {
				// Handle the error
				response.status(400).send(error.validationErrors);
				next();
			} else {
				// Pass error on if not a validation error
				next(error);
			}
		});
	}

	private setupWS() {
		this.socket.on("connection", (socket) => {
			const controller = container.resolve(ScanController);
			controller.getStatusWS(socket);
		});
	}

	public run(): Promise<void> {
		return new Promise((resolve) => {
			const host = this.config.data.server.host || "0.0.0.0";
			this.httpServer.listen(this.config.data.server.port, host, undefined, resolve);
		});
	}

	public stop(): Promise<void> {
		return new Promise((resolve, reject) => this.httpServer.close((err) => {
			if (err) {
				return reject(err);
			}
			resolve();
		}));
	}
}

container.register("HttpServer", {
	useFactory: (c) => c.resolve(HttpServer)
});