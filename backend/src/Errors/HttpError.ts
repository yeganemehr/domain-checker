export default class HttpError extends Error {
	public constructor(public httpCode: number, message: string | undefined) {
		super(message);
	}
	public format(): any {
		return {
			status: false,
			error: {
				type: this.constructor.name,
				message: this.message
			}
		};
	}
}