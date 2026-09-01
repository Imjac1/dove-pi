/** Public/runtime execution policy. Pi's thinking level and extension profiles are separate settings. */
export type AgentMode = "fast" | "standard" | "ultra";

/** User-facing context organization mode. It never changes Pi tool authority. */
export type InteractionMode = "auto" | "chat" | "work";

export function normalizeAgentMode(value: unknown): AgentMode | undefined {
	if (value === "fast" || value === "standard" || value === "ultra") return value;
	return undefined;
}

export function normalizeInteractionMode(value: unknown): InteractionMode | undefined {
	if (value === "auto" || value === "chat" || value === "work") return value;
	return undefined;
}

export type CapabilityStatus = "draft" | "tested" | "verified" | "stable" | "deprecated";

export type SideEffect = "read_only" | "workspace_write" | "network" | "system_change" | "destructive";

export interface CapabilityPrecondition {
	readonly id: string;
	readonly description: string;
	readonly required: boolean;
}

export interface CapabilityEvidenceContract {
	readonly kind: "artifact" | "log" | "summary" | "verification";
	readonly description: string;
	readonly required: boolean;
}

export interface CapabilityContext {
	readonly cwd: string;
	readonly signal?: AbortSignal;
	readonly mode: AgentMode;
}

export interface CapabilityDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly platforms: readonly ("windows" | "linux" | "macos" | "any")[];
	readonly sideEffects: readonly SideEffect[];
	readonly idempotent: boolean;
	readonly status: CapabilityStatus;
	/** JSON Schema advertised at host boundaries. Runtime validation remains authoritative. */
	readonly parameterSchema?: Readonly<Record<string, unknown>>;
	readonly preconditions?: readonly CapabilityPrecondition[];
	readonly evidence?: readonly CapabilityEvidenceContract[];
	readonly requiredArgs?: readonly string[];
	/** Shell command prefixes this capability replaces; used to offer a reuse hint when the model would otherwise type them by hand. */
	readonly hintCommands?: readonly string[];
	/** Deterministic runtime validation; throws or returns a message on invalid args. */
	readonly validateArgs?: (args: TArgs) => void | string;
	/** Optional postcondition check. A false/string result turns execution into failed. */
	readonly verify?: (result: TResult, args: TArgs, context: CapabilityContext) => boolean | string | Promise<boolean | string>;
	readonly execute: (args: TArgs, context: CapabilityContext) => Promise<TResult>;
}

export interface CapabilityResult<TResult = unknown> {
	readonly status: "success" | "failed" | "blocked";
	readonly capability: string;
	readonly version?: string;
	readonly result?: TResult;
	readonly error?: string;
	readonly durationMs: number;
	readonly evidenceRefs: readonly string[];
	readonly executionId?: string;
	readonly outcome?: "completed" | "failed" | "approval_denied" | "cancelled" | "timed_out";
	readonly interrupted?: boolean;
	readonly retries?: number;
}

export interface ExecutionRecord {
	readonly taskId: string;
	readonly stepId: string;
	readonly kind: "mode.changed" | "capability.started" | "capability.blocked" | "capability.completed" | "dispatch.decided" | "dispatch.completed" | "project.mutation.started" | "project.mutation.completed" | "project.mutation.failed" | "project.mutation.reconciled" | "request.received" | "request.redelivery.coalesced" | "request.planned" | "request.attempt.started" | "request.attempt.completed" | "request.terminal" | "runtime.phase.completed" | "model.budget.checked" | "model.budget.rejected" | "provider.request.started" | "provider.request.completed" | "provider.request.rejected" | "capability.approval.pending" | "capability.approved" | "capability.cancelled" | "capability.timed_out" | "capability.recovered";
	readonly timestamp: string;
	readonly mode: AgentMode;
	readonly details: Record<string, unknown>;
	/** Correlation identifiers are optional for legacy records but required for new runs. */
	readonly correlation?: Readonly<{ requestId?: string; sessionId?: string; taskId?: string; attemptId?: string; providerCallId?: string; executionId?: string; toolCallId?: string }>;
}

export interface DispatchEstimate {
	readonly inlineCost: number;
	readonly dispatchCost: number;
	readonly predictedWallTimeMs: number;
	readonly independentBranches: number;
	readonly hasSharedMutableState: boolean;
}

export interface DispatchDecision {
	readonly route: "inline" | "subagent" | "parallel";
	readonly reason: string;
	readonly estimate: DispatchEstimate;
}

/** Runtime observations reported by a dispatch worker for later calibration. */
export interface DispatchActualMetrics {
	readonly startupTimeMs?: number;
	readonly contextTokens?: number;
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly retries?: number;
	readonly humanInterventions?: number;
}

export interface DispatchActual extends DispatchActualMetrics {
	readonly dispatchId: string;
	readonly route: DispatchDecision["route"];
	readonly startedAt: string;
	readonly completedAt: string;
	readonly wallTimeMs: number;
	readonly retries: number;
	readonly humanInterventions: number;
	readonly status: "success" | "failed";
}
