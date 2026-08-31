export function parseNonNegativeHours(
	args: readonly string[],
	option = "--since",
): number | undefined {
	const index = args.findIndex(
		(value) => value === option || value.startsWith(`${option}=`),
	);
	if (index < 0) return undefined;

	const token = args[index];
	const raw = token === option ? args[index + 1] : token.slice(option.length + 1);
	if (!raw || raw.startsWith("--")) {
		throw new Error(`${option} requires a non-negative hour value, for example 24h.`);
	}

	const normalized = raw.replace(/h$/i, "");
	if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
		throw new Error(`${option} must be a non-negative number of hours, for example 24h.`);
	}
	const hours = Number(normalized);
	if (!Number.isFinite(hours)) {
		throw new Error(`${option} must be a finite number of hours.`);
	}
	return hours;
}
