/** Public/runtime execution policy. Pi's thinking level and extension profiles are separate settings. */
export type AgentMode = "fast" | "standard" | "ultra";

export function normalizeAgentMode(value: unknown): AgentMode | undefined {
	if (value === "fast" || value === "standard" || value === "ultra") return value;
	return undefined;
}

export type CapabilityStatus = "draft" | "tested" | "verified" | "stable" | "deprecated";

export type SideEffect = "read_only" | "workspace_write" | "network" | "system_change" | "destructive";

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
	readonly requiredArgs?: readonly string[];
	/** Shell command prefixes this capability replaces; used to offer a reuse hint when the model would otherwise type them by hand. */
	readonly hintCommands?: readonly string[];
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
}

export interface ExecutionRecord {
	readonly taskId: string;
	readonly stepId: string;
	readonly kind: "mode.changed" | "capability.started" | "capability.completed" | "dispatch.decided" | "dispatch.completed" | "project.mutation.started" | "project.mutation.completed" | "project.mutation.failed" | "project.mutation.reconciled";
	readonly timestamp: string;
	readonly mode: AgentMode;
	readonly details: Record<string, unknown>;
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
