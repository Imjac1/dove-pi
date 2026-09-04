import type { AgentMode, InteractionMode } from "./contracts.ts";
import type { RequestPlan } from "./request-plan.ts";
import type { RequestTerminalEnvelope } from "./request-lifecycle.ts";

export type StrategyValueSource = "auto" | "user" | "pi" | "inherited";

export interface StrategyBudgetSnapshot {
	readonly used: number;
	readonly limit?: number;
	readonly warning?: number;
	readonly hardStop?: number;
}

export interface StrategyContextSnapshot {
	readonly contextWindow?: number;
	readonly observedTokens?: number;
	readonly doveBudgetChars?: number;
	readonly budgetSource?: "provider-window" | "unknown";
	readonly omitted: boolean;
	readonly compacted: boolean;
}

export interface StrategyCacheSnapshot {
	readonly lastHitRate?: number;
	readonly recentRequestHitRate?: number;
	readonly fullMisses: number;
	readonly lastMissReason?: string;
}

export interface StrategyTerminalSnapshot {
	readonly origin: RequestTerminalEnvelope["origin"];
	readonly code: string;
	readonly retryable: boolean;
	readonly nextAction?: string;
}

/**
 * Read-only explanation of the policy that actually applies to one request.
 * This is deliberately a projection: it never grants tools or changes a
 * budget decision.
 */
export interface StrategySnapshot {
	readonly schemaVersion: 1;
	readonly logicalRequestId?: string;
	readonly intent?: RequestPlan["intent"];
	readonly lane?: RequestPlan["lane"];
	readonly interactionMode: InteractionMode;
	readonly workflowAction?: RequestPlan["workflowAction"];
	readonly executionMode: AgentMode;
	readonly executionModeSource: StrategyValueSource;
	readonly thinkingPolicy: string;
	readonly thinkingPolicySource: StrategyValueSource;
	readonly thinkingLevel?: string;
	readonly toolProfile: string;
	readonly toolProfileSource: StrategyValueSource;
	readonly activeToolCount: number;
	readonly providerRound: StrategyBudgetSnapshot;
	readonly readOnlyBudget: StrategyBudgetSnapshot;
	readonly context: StrategyContextSnapshot;
	readonly cache?: StrategyCacheSnapshot;
	readonly resources: {
		readonly toolCalls: number;
		readonly toolDurationMs: number;
		readonly elapsedMs: number;
		readonly inputTokens?: number;
		readonly cacheReadTokens?: number;
		readonly cacheWriteTokens?: number;
		readonly outputTokens?: number;
		readonly reasoningTokens?: number;
		readonly stopReasons: readonly string[];
	};
	readonly terminal?: StrategyTerminalSnapshot;
}

export interface StrategySnapshotInput {
	readonly plan?: Pick<RequestPlan, "requestId" | "intent" | "lane" | "interactionMode" | "workflowAction">;
	readonly interactionMode: InteractionMode;
	readonly executionMode: AgentMode;
	readonly executionModeSource?: StrategyValueSource;
	readonly thinkingPolicy: string;
	readonly thinkingPolicySource?: StrategyValueSource;
	readonly thinkingLevel?: string;
	readonly toolProfile: string;
	readonly toolProfileSource?: StrategyValueSource;
	readonly activeToolCount: number;
	readonly providerRound: StrategyBudgetSnapshot;
	readonly readOnlyBudget: StrategyBudgetSnapshot;
	readonly context?: Partial<StrategyContextSnapshot>;
	readonly cache?: StrategyCacheSnapshot;
	readonly resources?: Partial<StrategySnapshot["resources"]>;
	readonly terminal?: RequestTerminalEnvelope;
}

export function createStrategySnapshot(input: StrategySnapshotInput): StrategySnapshot {
	const nonNegative = (value: number | undefined): number | undefined => value !== undefined && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
	const resources = input.resources ?? {};
	const terminal = input.terminal
		? {
			origin: input.terminal.origin,
			code: input.terminal.code.slice(0, 256),
			retryable: input.terminal.retryable,
			...(input.terminal.nextAction ? { nextAction: input.terminal.nextAction.slice(0, 1024) } : {}),
		}
		: undefined;
	return {
		schemaVersion: 1,
		...(input.plan?.requestId ? { logicalRequestId: input.plan.requestId } : {}),
		...(input.plan?.intent ? { intent: input.plan.intent } : {}),
		...(input.plan?.lane ? { lane: input.plan.lane } : {}),
		interactionMode: input.plan?.interactionMode ?? input.interactionMode,
		...(input.plan?.workflowAction ? { workflowAction: input.plan.workflowAction } : {}),
		executionMode: input.executionMode,
		executionModeSource: input.executionModeSource ?? "auto",
		thinkingPolicy: input.thinkingPolicy,
		thinkingPolicySource: input.thinkingPolicySource ?? "auto",
		...(input.thinkingLevel ? { thinkingLevel: input.thinkingLevel } : {}),
		toolProfile: input.toolProfile,
		toolProfileSource: input.toolProfileSource ?? "auto",
		activeToolCount: Math.max(0, Math.floor(input.activeToolCount)),
		providerRound: { ...input.providerRound, used: Math.max(0, Math.floor(input.providerRound.used)) },
		readOnlyBudget: { ...input.readOnlyBudget, used: Math.max(0, Math.floor(input.readOnlyBudget.used)) },
		context: {
			...(nonNegative(input.context?.contextWindow) === undefined ? {} : { contextWindow: nonNegative(input.context?.contextWindow) }),
			...(nonNegative(input.context?.observedTokens) === undefined ? {} : { observedTokens: nonNegative(input.context?.observedTokens) }),
			...(nonNegative(input.context?.doveBudgetChars) === undefined ? {} : { doveBudgetChars: nonNegative(input.context?.doveBudgetChars) }),
			...(input.context?.budgetSource ? { budgetSource: input.context.budgetSource } : {}),
			omitted: input.context?.omitted === true,
			compacted: input.context?.compacted === true,
		},
		...(input.cache ? { cache: input.cache } : {}),
		resources: {
			toolCalls: nonNegative(resources.toolCalls) ?? 0,
			toolDurationMs: nonNegative(resources.toolDurationMs) ?? 0,
			elapsedMs: nonNegative(resources.elapsedMs) ?? 0,
			...(nonNegative(resources.inputTokens) === undefined ? {} : { inputTokens: nonNegative(resources.inputTokens) }),
			...(nonNegative(resources.cacheReadTokens) === undefined ? {} : { cacheReadTokens: nonNegative(resources.cacheReadTokens) }),
			...(nonNegative(resources.cacheWriteTokens) === undefined ? {} : { cacheWriteTokens: nonNegative(resources.cacheWriteTokens) }),
			...(nonNegative(resources.outputTokens) === undefined ? {} : { outputTokens: nonNegative(resources.outputTokens) }),
			...(nonNegative(resources.reasoningTokens) === undefined ? {} : { reasoningTokens: nonNegative(resources.reasoningTokens) }),
			stopReasons: (resources.stopReasons ?? []).filter((reason): reason is string => typeof reason === "string").map((reason) => reason.slice(0, 128)).slice(0, 64),
		},
		...(terminal ? { terminal } : {}),
	};
}

export function formatStrategySnapshot(snapshot: StrategySnapshot): string {
	const plan = snapshot.intent && snapshot.lane ? `${snapshot.intent}/${snapshot.lane}` : "idle";
	const round = snapshot.providerRound.limit === undefined ? `${snapshot.providerRound.used}/unknown` : `${snapshot.providerRound.used}/${snapshot.providerRound.limit}`;
	const terminal = snapshot.terminal ? ` terminal=${snapshot.terminal.code}` : " terminal=none";
	return `strategy=${plan} mode=${snapshot.executionMode}(${snapshot.executionModeSource}) thinking=${snapshot.thinkingPolicy}(${snapshot.thinkingPolicySource}) tools=${snapshot.toolProfile}(${snapshot.toolProfileSource}), activeTools=${snapshot.activeToolCount}, providerRounds=${round}, readOnly=${snapshot.readOnlyBudget.used}/${snapshot.readOnlyBudget.hardStop ?? "unknown"}${terminal}`;
}
