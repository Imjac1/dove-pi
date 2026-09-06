import type { TrellisSnapshot, TrellisTaskRecord } from "../trellis-adapter/index.ts";
import type { AcceptanceCriterionDefinition, FindingKind, TaskConvergenceSnapshot } from "../core/task-convergence.ts";
import type { NativeGoalConvergenceProjection, NativeTaskPhase } from "./native-state.ts";

/** Contract version consumed by the Dove agent core. */
export const PROJECT_PROVIDER_CONTRACT = "1.0" as const;

export type ProjectProviderKind = "native" | "trellis" | "lightweight";
export type ProjectTaskOperation = "create" | "start" | "finish" | "archive";
/** @deprecated Use ProjectTaskOperation. */
export type TrellisTaskOperation = ProjectTaskOperation;
export type ProviderHealthStatus = "healthy" | "lightweight" | "degraded";

export interface ProviderCapabilities {
	readonly readContext: boolean;
	readonly readTasks: boolean;
	readonly readMemory: boolean;
	readonly taskLifecycle: boolean;
	readonly mutations: boolean;
	readonly atomicMutations: boolean;
}

export interface ProviderHealth {
	readonly provider: ProjectProviderKind;
	readonly status: ProviderHealthStatus;
	readonly projectRoot: string;
	readonly trellisVersion?: string;
	readonly trellisCompatibility: "supported" | "unknown" | "unsupported";
	readonly adapterContract: string;
	readonly capabilities: ProviderCapabilities;
	readonly issues: readonly string[];
}

export interface ProjectManifest {
	readonly provider: ProjectProviderKind;
	readonly projectRoot: string;
	readonly adapterContract: string;
	readonly lastKnownTrellisVersion?: string;
}

export interface ProjectTaskIdentity {
	/** Stable provider-qualified identity. Never substitute a Pi session ID. */
	readonly stableId: string;
	readonly provider: ProjectProviderKind;
	readonly providerTaskId: string;
}

export interface ProjectTask extends ProjectTaskIdentity {
	readonly path: string;
	readonly title: string;
	readonly status: string;
	readonly priority?: string;
	readonly files: readonly string[];
	readonly formal?: boolean;
	readonly phase?: NativeTaskPhase;
	readonly convergence?: ProjectTaskConvergenceStatus;
}

export type ProjectTaskConvergenceStatus =
	| { readonly health: "missing" }
	| { readonly health: "invalid"; readonly issue: string }
	| ({ readonly health: "valid" } & NativeGoalConvergenceProjection);

export type ProjectTaskConvergenceRead =
	| { readonly kind: "missing" }
	| { readonly kind: "invalid"; readonly issue: string }
	| { readonly kind: "valid"; readonly snapshot: TaskConvergenceSnapshot };

export type ProjectTaskConvergenceProgress =
	| { readonly kind: "started" }
	| { readonly kind: "evidence"; readonly evidenceRef: string }
	| { readonly kind: "passed"; readonly evidenceRefs?: readonly string[] }
	| { readonly kind: "failed"; readonly evidenceRefs?: readonly string[] }
	| { readonly kind: "waived"; readonly evidenceRef: string }
	| { readonly kind: "step_completed"; readonly stepId: string }
	| { readonly kind: "verification_started" };

export type ProjectTaskConvergenceOperation =
	| { readonly action: "freeze"; readonly criteria: readonly AcceptanceCriterionDefinition[]; readonly acceptanceId?: string }
	| { readonly action: "progress"; readonly acceptanceId: string; readonly progress: ProjectTaskConvergenceProgress }
	| { readonly action: "finding"; readonly acceptanceId: string; readonly finding: { readonly id: string; readonly kind: FindingKind; readonly summary: string; readonly evidenceRefs: readonly string[]; readonly nextAction?: string }; readonly nextAction?: string }
	| { readonly action: "update_finding"; readonly acceptanceId: string; readonly findingId: string; readonly evidenceRefs?: readonly string[]; readonly summary?: string; readonly nextAction?: string }
	| { readonly action: "resolve_finding"; readonly acceptanceId: string; readonly findingId: string; readonly evidenceRefs?: readonly string[] }
	| { readonly action: "decide"; readonly acceptanceId: string; readonly nextAction: string }
	| { readonly action: "checkpoint"; readonly acceptanceId: string; readonly nextAction: string; readonly unblockCondition?: string }
	| { readonly action: "resume"; readonly acceptanceId: string; readonly acceptanceRevision: string };

export interface ProjectTaskProgress {
	readonly phase: NativeTaskPhase;
	readonly nextStep?: string;
	readonly verification?: string;
	readonly decision?: string;
	readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface ProjectDocument {
	readonly path: string;
	readonly kind: "task" | "spec" | "memory" | "journal" | "workflow";
	readonly content: string;
	readonly sourceRef: string;
}

export interface ProjectContextSnapshot {
	readonly provider: ProjectProviderKind;
	readonly projectRoot: string;
	readonly revision: string;
	readonly tasks: readonly ProjectTask[];
	readonly currentTask?: ProjectTask;
	readonly documents: readonly ProjectDocument[];
	readonly raw?: TrellisSnapshot;
}

export interface ProjectProvider {
	readonly kind: ProjectProviderKind;
	readonly projectRoot: string;
	getHealth(): ProviderHealth;
	getContext(): ProjectContextSnapshot;
	getCurrentTask(): ProjectTask | undefined;
	resolveTask(selector: string): ProjectTask | undefined;
	readMemory(query?: string): readonly ProjectDocument[];
	/** Silently establish a compact current goal for explicit tracking or legacy continuation. */
	ensureCurrentGoal?(title: string, description?: string): Promise<ProjectTask>;
	/** Silently establish a formal task and its durable planning artifacts. */
	ensureFormalTask?(title: string, description?: string): Promise<ProjectTask>;
	recordTaskProgress?(taskId: string, progress: ProjectTaskProgress): Promise<void>;
	readTaskConvergence?(taskId: string): ProjectTaskConvergenceRead;
	mutateTaskConvergence?(taskId: string, operation: ProjectTaskConvergenceOperation): Promise<TaskConvergenceSnapshot>;
	runTaskOperation(operation: ProjectTaskOperation, args: readonly string[]): Promise<string>;
	/** Read-only reconciliation of an interrupted mutation intent. */
	reconcileTaskOperation?(operation: ProjectTaskOperation, args: readonly string[], beforeRevision: string, beforeTaskIds?: readonly string[], targetTaskId?: string, beforeTargetStatus?: string, beforeCurrentTaskId?: string): Promise<"observed" | "unknown">;
}

/** Resolve a selector only when it identifies one task. */
export function resolveProjectTask(context: ProjectContextSnapshot, selector: string | undefined): ProjectTask | undefined {
	const normalized = selector?.trim();
	if (!normalized) return undefined;
	const matches = context.tasks.filter((candidate) =>
		candidate.stableId === normalized ||
		candidate.path === normalized ||
		candidate.providerTaskId === normalized ||
		candidate.title === normalized ||
		candidate.path.endsWith(normalized),
	);
	return matches.length === 1 ? matches[0] : undefined;
}

export function toProjectTask(record: TrellisTaskRecord, provider: ProjectProviderKind = "trellis"): ProjectTask {
	return {
		stableId: `${provider}:${record.id}`,
		provider,
		providerTaskId: record.id,
		path: record.path,
		title: record.title,
		status: record.status,
		priority: record.priority,
		files: record.files,
	};
}
