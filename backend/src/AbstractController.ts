import { NextFunction, Request, RequestHandler, Response } from "express";
import { List, ValidateFunction, Validator } from "express-json-validator-middleware";
import { container, InjectionToken } from "tsyringe";
import HttpError from "./Errors/HttpError";

type ValidatorMethod = () => List<ValidateFunction>;
type ValidatorMethods<T extends AbstractController> = {
	[P in keyof T as T[P] extends ValidatorMethod ? P : never]: T[P]
};
type RequestHandlers<T extends AbstractController> = {
	[P in keyof T as T[P] extends RequestHandler ? P : never]: T[P]
};

export default abstract class AbstractController {
	public static runController<T extends AbstractController, K extends keyof RequestHandlers<T>>(controller: InjectionToken<T>, method: K): RequestHandler {
		return (request: Request, response: Response, next: NextFunction) => {
			const object: T = container.resolve<T>(controller);
			if (typeof object !== "object") {
				throw new Error("controller is not class or object");
			}
			const result = (object[method] as any as RequestHandler).call(object, request as any, response as any, next) as any;
			if (typeof result === "object" && result instanceof Promise) {
				result.catch((e) => {
					if (e instanceof HttpError) {
						response.status(e.httpCode).json(e.format());
						return;
					} else {
						next(e);
					}
				});
			}

			return result;
		};
	}
	public static runValidator<T extends AbstractController, K extends keyof ValidatorMethods<T>>(controller: InjectionToken<T>, method: K): RequestHandler {
		return (request: Request, response: Response, next: NextFunction) => {
			const object: T = container.resolve<T>(controller);
			if (typeof object !== "object") {
				throw new Error("controller is not class or object");
			}
			const rules = (object[method] as any as ValidatorMethod).call(object);
			const {validate} = new Validator({});
			return validate(rules)(request, response, next);
		};
	}
}
