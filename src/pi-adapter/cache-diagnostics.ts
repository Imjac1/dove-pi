/**
 * Provider-reported prompt-cache diagnostics for the Pi adapter.
 *
 * Pi remains the source of truth for usage and billing. This module only
 * projects the usage already persisted in the current session; it does not
 * estimate cache reads or implement a second cache.
 */

import type { ExecutionRecord } from "../core/contracts.ts";

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
	/** Request-level hit rate over the most recent bounded window. */
	readonly recentRequestHitRate?: number;
	readonly recentRequestHits: number;
	readonly recentRequestCount: number;
	readonly warmPromptTokens: number;
	readonly warmCacheReadTokens: number;
	readonly warmInputTokens: number;
	readonly warmupRequests: number;
	readonly fullMisses: number;
	readonly lastMissReason?: "warmup" | "model-change" | "idle" | "provider-miss-or-expiry";
}

export interface GoalEfficiencyDiagnostics {
	readonly goalCount: number;
	readonly completedGoalCount: number;
	readonly failedGoalCount: number;
	readonly cancelledGoalCount: number;
	readonly providerRounds: number;
	readonly toolCalls: number;
	readonly questionCalls: number;
	readonly uncachedInputTokens: number;
	readonly cacheReadTokens: number;
	readonly uncachedInputPerCompletedGoal?: number;
	/** First provider calls after excluding the first observed user turn in the session. */
	readonly warmFirstCallCount: number;
	readonly warmFirstCallHits: number;
	readonly warmFirstCallHitRate?: number;
	readonly coldFirstCallCount: number;
}

const RECENT_REQUEST_WINDOW = 5;

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
					// Usage samples do not contain prefix evidence. Keep this
					// attribution conservative instead of blaming Dove context churn.
					lastMissReason = "provider-miss-or-expiry";
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
	const recentSamples = samples.slice(-RECENT_REQUEST_WINDOW);
	const recentRequestHits = recentSamples.filter((sample) => sample.cacheRead > 0).length;
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
		recentRequestHitRate: recentSamples.length > 0 ? (recentRequestHits / recentSamples.length) * 100 : undefined,
		recentRequestHits,
		recentRequestCount: recentSamples.length,
		warmPromptTokens,
		warmCacheReadTokens,
		warmInputTokens,
		warmupRequests,
		fullMisses,
		lastMissReason,
	};
}

interface MutableGoalEfficiency {
	planned: boolean;
	terminal?: string;
	providerRounds: number;
	toolCalls: number;
	questionCalls: number;
	uncachedInputTokens: number;
	cacheReadTokens: number;
}

interface MutableRequestEfficiency {
	planned: boolean;
	firstProviderCacheRead?: number;
}

/** Project the execution ledger into completed-goal efficiency metrics. */
export function inspectGoalEfficiency(records: readonly ExecutionRecord[], sessionId?: string): GoalEfficiencyDiagnostics {
	const goals = new Map<string, MutableGoalEfficiency>();
	const requests = new Map<string, MutableRequestEfficiency>();
	const requestToGoal = new Map<string, string>();
	const order: string[] = [];
	const requestOrder: string[] = [];
	const goalFor = (goalId: string) => {
		let goal = goals.get(goalId);
		if (!goal) {
			goal = { planned: false, providerRounds: 0, toolCalls: 0, questionCalls: 0, uncachedInputTokens: 0, cacheReadTokens: 0 };
			goals.set(goalId, goal);
		}
		return goal;
	};
	const requestFor = (requestId: string) => {
		let request = requests.get(requestId);
		if (!request) {
			request = { planned: false };
			requests.set(requestId, request);
		}
		return request;
	};

	for (const record of records) {
		if (sessionId && record.correlation?.sessionId !== sessionId) continue;
		const requestId = record.correlation?.requestId;
		if (!requestId) continue;
		if (record.kind === "request.planned") {
			const continuedFromRequestId = typeof record.details.continuedFromRequestId === "string" ? record.details.continuedFromRequestId : undefined;
			const existingGoalId = continuedFromRequestId ? requestToGoal.get(continuedFromRequestId) : undefined;
			const goalId = existingGoalId ?? requestId;
			requestToGoal.set(requestId, goalId);
			const goal = goalFor(goalId);
			if (!goal.planned) order.push(goalId);
			goal.planned = true;
			if (continuedFromRequestId && existingGoalId) goal.terminal = undefined;
			const request = requestFor(requestId);
			if (!request.planned) requestOrder.push(requestId);
			request.planned = true;
			continue;
		}
		const goal = goalFor(requestToGoal.get(requestId) ?? requestId);
		const request = requestFor(requestId);
		if (record.kind === "request.terminal") {
			goal.terminal = typeof record.details.reason === "string" ? record.details.reason : "unknown";
		} else if (record.kind === "provider.request.completed" && record.details.recovered !== true) {
			const usage = typeof record.details.usage === "object" && record.details.usage !== null ? record.details.usage as Record<string, unknown> : {};
			const input = finite(usage.input);
			const cacheRead = finite(usage.cacheRead);
			if (request.firstProviderCacheRead === undefined) request.firstProviderCacheRead = cacheRead;
			goal.providerRounds += 1;
			goal.uncachedInputTokens += input;
			goal.cacheReadTokens += cacheRead;
		} else if (record.kind === "runtime.phase.completed" && record.details.phase === "tool") {
			goal.toolCalls += 1;
			if (record.details.name === "ask_user_question") goal.questionCalls += 1;
		}
	}

	const plannedGoals = order.map((requestId) => goals.get(requestId)!).filter(Boolean);
	const completedGoals = plannedGoals.filter((goal) => goal.terminal === "completed");
	// Cache warmth is a user-turn property, even when an affirmative turn
	// continues the same logical goal.
	const firstCalls = requestOrder.flatMap((requestId) => {
		const cacheRead = requests.get(requestId)?.firstProviderCacheRead;
		return cacheRead === undefined ? [] : [cacheRead];
	});
	const warmFirstCalls = firstCalls.slice(1);
	const warmFirstCallHits = warmFirstCalls.filter((cacheRead) => cacheRead > 0).length;
	const uncachedInputTokens = plannedGoals.reduce((total, goal) => total + goal.uncachedInputTokens, 0);
	return {
		goalCount: plannedGoals.length,
		completedGoalCount: completedGoals.length,
		failedGoalCount: plannedGoals.filter((goal) => goal.terminal && goal.terminal !== "completed" && goal.terminal !== "cancelled").length,
		cancelledGoalCount: plannedGoals.filter((goal) => goal.terminal === "cancelled").length,
		providerRounds: plannedGoals.reduce((total, goal) => total + goal.providerRounds, 0),
		toolCalls: plannedGoals.reduce((total, goal) => total + goal.toolCalls, 0),
		questionCalls: plannedGoals.reduce((total, goal) => total + goal.questionCalls, 0),
		uncachedInputTokens,
		cacheReadTokens: plannedGoals.reduce((total, goal) => total + goal.cacheReadTokens, 0),
		// Charge all session work to successful outcomes. Excluding failed or
		// cancelled loops would make wasted provider rounds improve this metric.
		uncachedInputPerCompletedGoal: completedGoals.length > 0 ? uncachedInputTokens / completedGoals.length : undefined,
		warmFirstCallCount: warmFirstCalls.length,
		warmFirstCallHits,
		warmFirstCallHitRate: warmFirstCalls.length > 0 ? (warmFirstCallHits / warmFirstCalls.length) * 100 : undefined,
		coldFirstCallCount: firstCalls.filter((cacheRead) => cacheRead <= 0).length,
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
	const recent = diagnostics.recentRequestHitRate === undefined ? "n/a" : `${diagnostics.recentRequestHitRate.toFixed(1)}%`;
	return `Last CH ${last} · Warm CH ${warm} · Recent5 RH ${recent} · Session CH ${session} · R ${formatTokens(diagnostics.cacheReadTokens)} · W ${formatTokens(diagnostics.cacheWriteTokens)} · ${diagnostics.fullMisses} full miss${diagnostics.fullMisses === 1 ? "" : "es"}`;
}

export function formatGoalEfficiency(diagnostics: GoalEfficiencyDiagnostics): string {
	const firstCall = diagnostics.warmFirstCallHitRate === undefined ? "n/a" : `${diagnostics.warmFirstCallHitRate.toFixed(1)}%`;
	const perGoal = diagnostics.uncachedInputPerCompletedGoal === undefined ? "n/a" : formatTokens(diagnostics.uncachedInputPerCompletedGoal);
	return `Goals ${diagnostics.completedGoalCount}/${diagnostics.goalCount} completed · Uncached/completed ${perGoal} · Warm first-call ${firstCall} (${diagnostics.warmFirstCallHits}/${diagnostics.warmFirstCallCount}) · Provider ${diagnostics.providerRounds} · Tools ${diagnostics.toolCalls} · Questions ${diagnostics.questionCalls} · Cold first ${diagnostics.coldFirstCallCount}`;
}
