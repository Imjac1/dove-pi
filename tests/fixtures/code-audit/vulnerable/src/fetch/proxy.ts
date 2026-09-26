export async function proxy(req: any) {
	// The destination is taken from the query string.
	const url = req.query.url;
	return fetch(url);
}

export function deserialize(payload: string) {
	return JSON.parse(payload, (key, value) => value);
}

export function render(source: string, data: unknown) {
	return Handlebars.compile(source)(data);
}
