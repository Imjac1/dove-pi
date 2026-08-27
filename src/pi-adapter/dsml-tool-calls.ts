import { createHash } from "node:crypto";

export interface DsmlToolCall {
	readonly type: "toolCall";
	readonly id: string;
	readonly name: string;
	readonly arguments: Readonly<Record<string, unknown>>;
}

export type NormalizedAssistantContent =
	| { readonly type: "text"; readonly text: string }
	| DsmlToolCall
	| Readonly<Record<string, unknown>>;

export interface DsmlNormalizationResult {
	readonly converted: boolean;
	readonly content: readonly NormalizedAssistantContent[];
}

interface ParsedDsmlText {
	readonly prefix: string;
	readonly suffix: string;
	readonly calls: readonly DsmlToolCall[];
}

const TOOL_CALLS_OPEN = "<｜DSML｜tool_calls>";
const TOOL_CALLS_CLOSE = /\\?<\/｜DSML｜tool_calls>/;
const INVOKE_PATTERN = /<｜DSML｜invoke\s+name="([^"]+)"\s*>([\s\S]*?)\\?<\/｜DSML｜invoke>/g;
const PARAMETER_PATTERN = /<｜DSML｜parameter\s+name="([^"]+)"(?:\s+string="([^"]+)")?\s*>([\s\S]*?)\\?<\/｜DSML｜parameter>/g;

/**
 * Normalize DeepSeek's text-encoded DSML tool calls into Pi content blocks.
 *
 * This is intentionally narrow: only the exact DSML marker is accepted,
 * every invocation must be complete, and malformed blocks are left untouched.
 * The resulting blocks still pass through Pi's normal tool_call/approval path.
 */
export function normalizeDsmlContent(content: readonly unknown[]): DsmlNormalizationResult {
	const normalized: NormalizedAssistantContent[] = [];
	let converted = false;

	for (const block of content) {
		const carrier = getDsmlCarrier(block);
		if (!carrier || !carrier.value.includes(TOOL_CALLS_OPEN)) {
			if (typeof block === "object" && block !== null) normalized.push(block as Readonly<Record<string, unknown>>);
			continue;
		}

		const parsed = parseDsmlText(carrier.value);
		if (!parsed) {
			normalized.push(block as Readonly<Record<string, unknown>>);
			continue;
		}
		converted = true;
		if (parsed.prefix) normalized.push(carrier.replace(parsed.prefix));
		normalized.push(...parsed.calls);
		if (parsed.suffix) normalized.push(carrier.replace(parsed.suffix));
	}

	return { converted, content: normalized };
}

function parseDsmlText(text: string): ParsedDsmlText | undefined {
	const markerIndex = text.indexOf(TOOL_CALLS_OPEN);
	if (markerIndex < 0) return undefined;
	const prefix = text.slice(0, markerIndex).trim();
	const bodyStart = markerIndex + TOOL_CALLS_OPEN.length;
	const closeMatch = TOOL_CALLS_CLOSE.exec(text.slice(bodyStart));
	const bodyEnd = closeMatch ? bodyStart + closeMatch.index : text.length;
	const body = text.slice(bodyStart, bodyEnd);
	const suffix = closeMatch ? text.slice(bodyEnd + closeMatch[0].length).trim() : "";
	const calls: DsmlToolCall[] = [];

	for (const match of body.matchAll(INVOKE_PATTERN)) {
		const name = decodeDsmlText(match[1] ?? "").trim();
		if (!name) return undefined;
		const parameters = parseParameters(match[2] ?? "");
		if (parameters === undefined) return undefined;
		calls.push({
			type: "toolCall",
			id: createCallId(name, parameters, calls.length),
			name,
			arguments: parameters,
		});
	}

	if (calls.length === 0) return undefined;
	return { prefix, suffix, calls };
}

function parseParameters(source: string): Readonly<Record<string, unknown>> | undefined {
	const parameters: Record<string, unknown> = {};
	for (const match of source.matchAll(PARAMETER_PATTERN)) {
		const name = decodeDsmlText(match[1] ?? "").trim();
		if (!name) return undefined;
		const rawValue = decodeDsmlText(match[3] ?? "");
		const stringFlag = (match[2] ?? "").toLowerCase();
		parameters[name] = stringFlag === "true" ? rawValue : parseValue(rawValue);
	}
	const remainder = source.replace(PARAMETER_PATTERN, "").trim();
	return remainder ? undefined : parameters;
}

function parseValue(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function decodeDsmlText(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function createCallId(name: string, parameters: Readonly<Record<string, unknown>>, index: number): string {
	const digest = createHash("sha1").update(`${name}\n${JSON.stringify(parameters)}`).digest("hex").slice(0, 12);
	return `dsml-${digest}-${index + 1}`;
}

function getDsmlCarrier(value: unknown): { value: string; replace: (replacement: string) => Readonly<Record<string, unknown>> } | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const block = value as { type?: unknown; text?: unknown; thinking?: unknown };
	if (block.type === "text" && typeof block.text === "string") {
		return { value: block.text, replace: (replacement) => ({ ...value as Record<string, unknown>, text: replacement }) };
	}
	if (block.type === "thinking" && typeof block.thinking === "string") {
		return { value: block.thinking, replace: (replacement) => ({ ...value as Record<string, unknown>, thinking: replacement }) };
	}
	return undefined;
}
