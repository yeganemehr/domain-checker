import HttpError from "./HttpError";

export default class InvalidInputError extends HttpError {
	public constructor(public readonly input: string, message: string) {
		super(400, message);
	}

	public format(): any {
		const data = super.format();
		data.error.input = this.input;
		return data;
	}
}