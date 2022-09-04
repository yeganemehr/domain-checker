export function convertPatternToRegex(pattern: string, isRegex: boolean): RegExp {
	let regex: RegExp;
	if (isRegex) {
		regex = new RegExp(pattern);
	} else {
		pattern = pattern
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
			.replace(/\*\\\./g, "[a-z0-9]\\.")
			.replace(/\\\.\*/g, "\\.[a-z0-9]")
			.replace(/\*-/g, "[a-z0-9]-")
			.replace(/-\*/g, "-[a-z0-9]")
			.replace(/^\*/g, "[a-z0-9]")
			.replace(/\*$/g, "[a-z0-9]")
			.replace(/\*/g, "[a-z0-9-]")
			.replace(/%d/g, "[0-9]")
			.replace(/%w/g, "[a-z]")
			.replace(/%s/g, "-");
		regex = new RegExp(`^${pattern}$`);
	}
	return regex;
}

export function isValidDomain(domain: string): boolean {
	const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
	return regex.test(domain);
}