/**
 * Provider-reported prompt-cache diagnostics for the Pi adapter.
 *
 * Pi remains the source of truth for usage and billing. This module only
 * projects the usage already persisted in the current session; it does not
 * estimate cache reads or implement a second cache.
 */

export interface CacheUsageSample {
	readonly input: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly reasoning?: number;
	readonly timestamp?: number;
	readonly modelKey?: string;
}

export interface CacheDiagnostics {
	readonly requestCount: number;
	readonly promptTokens: number;
	readonly inputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	readonly lastHitRate?: number;
	readonly sessionHitRate?: number;
	/** Session reuse after excluding the expected first cold provider call. */
	readonly warmHitRate?: number;
	readonly warmPromptTokens: number;
	readonly warmInputTokens: number;
	readonly warmupRequests: number;
	readonly fullMisses: number;
	readonly lastMissReason?: "warmup" | "model-change" | "idle" | "prefix-change";
}

interface SessionMessageEntry {
	readonly type?: unknown;
	readonly message?: {
		readonly role?: unknown;
		readonly provider?: unknown;
		readonly model?: unknown;
		readonly timestamp?: unknown;
		readonly usage?: {
			readonly input?: unknown;
			readonly cacheRead?: unknown;
			readonly cacheWrite?: unknown;
			readonly reasoning?: unknown;
		};
	};
}

function finite(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function timestampValue(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
	}
	return 0;
}

function sampleFromEntry(entry: SessionMessageEntry): CacheUsageSample | undefined {
	if (entry.type !== "message" || entry.message?.role !== "assistant" || !entry.message.usage) return undefined;
	const usage = entry.message.usage;
	const input = finite(usage.input);
	const cacheRead = finite(usage.cacheRead);
	const cacheWrite = finite(usage.cacheWrite);
	if (input + cacheRead + cacheWrite <= 0) return undefined;
	const reasoning = finite(usage.reasoning);
	const timestamp = timestampValue(entry.message.timestamp);
	return {
		input,
		cacheRead,
		cacheWrite,
		...(reasoning > 0 ? { reasoning } : {}),
		...(timestamp > 0 ? { timestamp } : {}),
		modelKey: typeof entry.message.provider === "string" && typeof entry.message.model === "string"
			? `${entry.message.provider}/${entry.message.model}`
			: undefined,
	};
}

export function collectCacheUsageSamples(entries: readonly unknown[]): CacheUsageSample[] {
	return entries.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const sample = sampleFromEntry(entry as SessionMessageEntry);
		return sample ? [sample] : [];
	});
}

export function inspectCacheDiagnostics(entries: readonly unknown[]): CacheDiagnostics {
	const samples = collectCacheUsageSamples(entries);
	let inputTokens = 0;
	let cacheReadTokens = 0;
	let cacheWriteTokens = 0;
	let warmupRequests = 0;
	let fullMisses = 0;
	let lastMissReason: CacheDiagnostics["lastMissReason"];
	let previous: CacheUsageSample | undefined;

	for (const sample of samples) {
		inputTokens += sample.input;
		cacheReadTokens += sample.cacheRead;
		cacheWriteTokens += sample.cacheWrite;
		if (sample.cacheRead <= 0) {
			if (!previous) {
				warmupRequests += 1;
				lastMissReason = "warmup";
			} else {
				fullMisses += 1;
				if (sample.modelKey && previous.modelKey && sample.modelKey !== previous.modelKey) {
					lastMissReason = "model-change";
				} else if (sample.timestamp && previous.timestamp && sample.timestamp - previous.timestamp >= 5 * 60 * 1000) {
					lastMissReason = "idle";
				} else {
					lastMissReason = "prefix-change";
				}
			}
		}
		previous = sample;
	}

	const promptTokens = inputTokens + cacheReadTokens + cacheWriteTokens;
	const warmSamples = samples.slice(1);
	const warmInputTokens = warmSamples.reduce((total, sample) => total + sample.input, 0);
	const warmCacheReadTokens = warmSamples.reduce((total, sample) => total + sample.cacheRead, 0);
	const warmCacheWriteTokens = warmSamples.reduce((total, sample) => total + sample.cacheWrite, 0);
	const warmPromptTokens = warmInputTokens + warmCacheReadTokens + warmCacheWriteTokens;
	const last = samples.at(-1);
	const lastPromptTokens = last ? last.input + last.cacheRead + last.cacheWrite : 0;
	return {
		requestCount: samples.length,
		promptTokens,
		inputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		lastHitRate: lastPromptTokens > 0 ? (last!.cacheRead / lastPromptTokens) * 100 : undefined,
		sessionHitRate: promptTokens > 0 ? (cacheReadTokens / promptTokens) * 100 : undefined,
		warmHitRate: warmPromptTokens > 0 ? (warmCacheReadTokens / warmPromptTokens) * 100 : undefined,
		warmPromptTokens,
		warmInputTokens,
		warmupRequests,
		fullMisses,
		lastMissReason,
	};
}

function formatTokens(value: number): string {
	if (value < 1_000) return String(Math.round(value));
	if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}k`;
	return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)}M`;
}

export function formatCacheDiagnostics(diagnostics: CacheDiagnostics): string {
	const last = diagnostics.lastHitRate === undefined ? "n/a" : `${diagnostics.lastHitRate.toFixed(1)}%`;
	const session = diagnostics.sessionHitRate === undefined ? "n/a" : `${diagnostics.sessionHitRate.toFixed(1)}%`;
	const warm = diagnostics.warmHitRate === undefined ? "n/a" : `${diagnostics.warmHitRate.toFixed(1)}%`;
	return `Last CH ${last} · Warm CH ${warm} · Session CH ${session} · R ${formatTokens(diagnostics.cacheReadTokens)} · W ${formatTokens(diagnostics.cacheWriteTokens)} · ${diagnostics.fullMisses} full miss${diagnostics.fullMisses === 1 ? "" : "es"}`;
}
