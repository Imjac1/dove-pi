import { createHash } from "node:crypto";

/** Provider-neutral, bounded prompt-prefix evidence shared by host adapters and the ledger. */
export type CachePrefixChange = "system" | "tools" | "dove-context";
export type CacheHistoryChange = "initial" | "unchanged" | "appended" | "rewritten";
export type CachePrefixClassification = "cold" | "stable-prefix" | "system-change" | "tools-change" | "dove-context-change" | "multiple-prefix-change" | "history-rewrite";

export interface CachePrefixComponent {
	readonly digest: string;
	readonly bytes: number;
	readonly items: number;
}

export interface CachePrefixEvidence {
	readonly sequence: number;
	readonly classification: CachePrefixClassification;
	readonly stablePrefix: boolean;
	readonly changes: readonly CachePrefixChange[];
	readonly historyChange: CacheHistoryChange;
	readonly system: CachePrefixComponent;
	readonly tools: CachePrefixComponent;
	readonly doveContext: CachePrefixComponent;
	readonly history: CachePrefixComponent;
}

export interface CachePrefixSnapshot {
	readonly requestId: string;
	/** Provider cache scope (normally session + provider + model), independent of logical request identity. */
	readonly scopeId: string;
	readonly sequence: number;
	readonly evidence: CachePrefixEvidence;
	/** Internal comparison material. Only `evidence` is persisted. */
	readonly historyMessageDigests: readonly string[];
}

export interface CachePrefixInspectionOptions {
	/** Start a new cold comparison window only when this provider cache scope changes. */
	readonly scopeId?: string;
}

export interface ProviderCacheAttribution {
	readonly classification: "cold" | "stable-prefix-reuse" | "prefix-change" | "history-rewrite" | "provider-miss-or-expiry" | "new-history";
	readonly hitRate?: number;
	readonly inputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	readonly prefixClassification: CachePrefixClassification;
}

function stableSerialize(value: unknown): string {
	if (value === undefined) return "undefined";
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
	return `{${Object.entries(value as Record<string, unknown>)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
		.join(",")}}`;
}

function digestText(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function component(items: readonly unknown[]): CachePrefixComponent {
	const serialized = stableSerialize(items);
	return { digest: digestText(serialized), bytes: Buffer.byteLength(serialized, "utf8"), items: items.length };
}

function textFrom(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join("\n");
	if (typeof value !== "object" || value === null) return "";
	const object = value as Record<string, unknown>;
	for (const key of ["content", "text", "value", "prompt", "input"]) {
		if (!(key in object)) continue;
		const text = textFrom(object[key]);
		if (text) return text;
	}
	return "";
}

interface EnvelopeObject {
	readonly value: Record<string, unknown>;
	readonly depth: number;
	readonly order: number;
}

/**
 * Provider hooks normally expose the final body, but gateways commonly wrap
 * it as `request.body`, `body.input`, or `request.body.input`. Traverse only
 * those known envelope keys so arbitrary tool arguments are never mistaken
 * for a second provider payload.
 */
function providerEnvelopeObjects(payload: unknown): readonly EnvelopeObject[] {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
	const queue: Array<{ value: Record<string, unknown>; depth: number }> = [{ value: payload as Record<string, unknown>, depth: 0 }];
	const seen = new Set<object>();
	const objects: EnvelopeObject[] = [];
	while (queue.length > 0 && objects.length < 16) {
		const current = queue.shift();
		if (!current || seen.has(current.value)) continue;
		seen.add(current.value);
		objects.push({ value: current.value, depth: current.depth, order: objects.length });
		if (current.depth >= 6) continue;
		for (const key of ["request", "body", "input"] as const) {
			const nested = current.value[key];
			if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
				queue.push({ value: nested as Record<string, unknown>, depth: current.depth + 1 });
			}
		}
	}
	return objects;
}

function deepestField(objects: readonly EnvelopeObject[], key: string): unknown {
	let selected: EnvelopeObject | undefined;
	for (const candidate of objects) {
		if (!(key in candidate.value)) continue;
		if (!selected || candidate.depth > selected.depth || (candidate.depth === selected.depth && candidate.order > selected.order)) selected = candidate;
	}
	return selected?.value[key];
}

function providerMessages(objects: readonly EnvelopeObject[]): readonly unknown[] {
	let selected: { value: readonly unknown[]; depth: number; preference: number; order: number } | undefined;
	for (const candidate of objects) {
		for (const [key, preference] of [["input", 0], ["messages", 1]] as const) {
			const value = candidate.value[key];
			if (!Array.isArray(value)) continue;
			if (!selected
				|| candidate.depth > selected.depth
				|| (candidate.depth === selected.depth && preference > selected.preference)
				|| (candidate.depth === selected.depth && preference === selected.preference && candidate.order > selected.order)) {
				selected = { value, depth: candidate.depth, preference, order: candidate.order };
			}
		}
	}
	return selected?.value ?? [];
}

function isDoveContextMessage(message: unknown): boolean {
	if (typeof message === "object" && message !== null) {
		const object = message as Record<string, unknown>;
		if (object.customType === "personal-agent-context") return true;
	}
	const text = textFrom(message);
	const beginning = text.trimStart();
	return beginning.startsWith("[PERSONAL AGENT REQUEST CONTEXT]") || beginning.startsWith("[PERSONAL AGENT REQUEST GUIDANCE]");
}

function messageRole(message: unknown): string | undefined {
	if (typeof message !== "object" || message === null || Array.isArray(message)) return undefined;
	const role = (message as Record<string, unknown>).role;
	return typeof role === "string" ? role.toLowerCase() : undefined;
}

function systemItems(objects: readonly EnvelopeObject[], messages: readonly unknown[]): readonly unknown[] {
	const items: unknown[] = [];
	const system = deepestField(objects, "system");
	if (system !== undefined) {
		const blocks = Array.isArray(system) ? system : [system];
		blocks.forEach((value, index) => items.push({ source: "system", index, value }));
	}
	const instructions = deepestField(objects, "instructions");
	if (instructions !== undefined) items.push({ source: "instructions", value: instructions });
	for (const [index, message] of messages.entries()) {
		const role = messageRole(message);
		if (role === "system" || role === "developer") items.push({ source: "message", index, value: message });
	}
	return items;
}

function historyChange(previous: readonly string[] | undefined, current: readonly string[]): CacheHistoryChange {
	if (!previous) return "initial";
	if (previous.length === current.length && previous.every((digest, index) => digest === current[index])) return "unchanged";
	if (previous.length <= current.length && previous.every((digest, index) => digest === current[index])) return "appended";
	return "rewritten";
}

function classification(changes: readonly CachePrefixChange[], history: CacheHistoryChange): CachePrefixClassification {
	if (history === "initial") return "cold";
	if (changes.length > 1) return "multiple-prefix-change";
	if (changes[0] === "system") return "system-change";
	if (changes[0] === "tools") return "tools-change";
	if (changes[0] === "dove-context") return "dove-context-change";
	if (history === "rewritten") return "history-rewrite";
	return "stable-prefix";
}

/** Inspect only bounded hashes and sizes; raw prompts/tool arguments are never persisted. */
export function inspectProviderCachePrefix(payload: unknown, requestId: string, previous?: CachePrefixSnapshot, options: CachePrefixInspectionOptions = {}): CachePrefixSnapshot {
	const envelopes = providerEnvelopeObjects(payload);
	const messages = providerMessages(envelopes);
	const ordinaryMessages = messages.filter((message) => {
		const role = messageRole(message);
		return role !== "system" && role !== "developer";
	});
	const doveMessages = ordinaryMessages.filter(isDoveContextMessage);
	const historyMessages = ordinaryMessages.filter((message) => !isDoveContextMessage(message));
	const system = component(systemItems(envelopes, messages));
	const providerTools = deepestField(envelopes, "tools");
	const tools = component(Array.isArray(providerTools) ? providerTools : []);
	const doveContext = component(doveMessages);
	const history = component(historyMessages);
	const historyMessageDigests = historyMessages.map((message) => digestText(stableSerialize(message)));
	// Logical requests share provider prefix caches within the same session/model.
	// Callers should pass an explicit session+provider+model scope. The default
	// deliberately continues the preceding comparison instead of marking every
	// new request cold merely because its correlation ID changed.
	const scopeId = options.scopeId ?? previous?.scopeId ?? "provider-session";
	const comparable = previous?.scopeId === scopeId ? previous : undefined;
	const changes: CachePrefixChange[] = [];
	if (comparable && comparable.evidence.system.digest !== system.digest) changes.push("system");
	if (comparable && comparable.evidence.tools.digest !== tools.digest) changes.push("tools");
	if (comparable && comparable.evidence.doveContext.digest !== doveContext.digest) changes.push("dove-context");
	const observedHistoryChange = historyChange(comparable?.historyMessageDigests, historyMessageDigests);
	const observedClassification = classification(changes, observedHistoryChange);
	const evidence: CachePrefixEvidence = {
		sequence: (comparable?.sequence ?? 0) + 1,
		classification: observedClassification,
		stablePrefix: changes.length === 0 && observedHistoryChange !== "rewritten",
		changes,
		historyChange: observedHistoryChange,
		system,
		tools,
		doveContext,
		history,
	};
	return { requestId, scopeId, sequence: evidence.sequence, evidence, historyMessageDigests };
}

function usageNumber(usage: Readonly<Record<string, number>> | undefined, key: string): number {
	const value = usage?.[key];
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function attributeProviderCache(snapshot: CachePrefixSnapshot, usage?: Readonly<Record<string, number>>): ProviderCacheAttribution {
	const inputTokens = usageNumber(usage, "input");
	const cacheReadTokens = usageNumber(usage, "cacheRead");
	const cacheWriteTokens = usageNumber(usage, "cacheWrite");
	const promptTokens = inputTokens + cacheReadTokens + cacheWriteTokens;
	let observed: ProviderCacheAttribution["classification"];
	if (snapshot.evidence.classification === "cold") observed = "cold";
	else if (snapshot.evidence.historyChange === "rewritten") observed = "history-rewrite";
	else if (snapshot.evidence.changes.length > 0) observed = "prefix-change";
	else if (cacheReadTokens > 0 && inputTokens > 0) observed = "new-history";
	else if (cacheReadTokens > 0) observed = "stable-prefix-reuse";
	else observed = "provider-miss-or-expiry";
	return {
		classification: observed,
		...(promptTokens > 0 ? { hitRate: (cacheReadTokens / promptTokens) * 100 } : {}),
		inputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		prefixClassification: snapshot.evidence.classification,
	};
}
