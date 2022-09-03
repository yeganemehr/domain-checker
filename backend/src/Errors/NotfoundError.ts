import HttpError from "./HttpError";

export default class NotfoundError extends HttpError {
	public constructor(message?: string) {
		super(404, message);
	}
}