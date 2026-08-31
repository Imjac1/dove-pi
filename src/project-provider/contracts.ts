import type { TrellisSnapshot, TrellisTaskRecord } from "../trellis-adapter/index.ts";

/** Contract version consumed by the Dove agent core. */
export const PROJECT_PROVIDER_CONTRACT = "1.0" as const;

export type ProjectProviderKind = "trellis" | "lightweight";
export type TrellisTaskOperation = "create" | "start" | "finish" | "archive";
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
	runTaskOperation(operation: TrellisTaskOperation, args: readonly string[]): Promise<string>;
	/** Read-only reconciliation of an interrupted mutation intent. */
	reconcileTaskOperation?(operation: TrellisTaskOperation, args: readonly string[], beforeRevision: string, beforeTaskIds?: readonly string[], targetTaskId?: string, beforeTargetStatus?: string, beforeCurrentTaskId?: string): Promise<"observed" | "unknown">;
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
