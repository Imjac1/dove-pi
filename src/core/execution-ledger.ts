import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentMode, DispatchActual, DispatchDecision, ExecutionRecord } from "./contracts.ts";
import type { RequestPlan } from "./request-plan.ts";
import type { RequestAttemptOutcome, RequestAttemptTrigger, RequestDelivery, RequestInputSource, RequestTerminalReason } from "./request-lifecycle.ts";
import type { BudgetAccounting, BudgetDiagnostic } from "./model-gateway.ts";
import type { CachePrefixEvidence, ProviderCacheAttribution } from "./cache-prefix.ts";

export class ExecutionLedger {
	public constructor(private readonly filePath: string) {}

	public async append(record: ExecutionRecord): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
	}

	public async appendDispatchDecision(taskId: string, stepId: string, mode: AgentMode, dispatchId: string, decision: DispatchDecision): Promise<void> {
		await this.append({
			taskId,
			stepId,
			kind: "dispatch.decided",
			timestamp: new Date().toISOString(),
			mode,
			details: {
				dispatchId,
				route: decision.route,
				reason: decision.reason,
				estimate: decision.estimate,
			},
		});
	}

	public async appendDispatchCompletion(taskId: string, stepId: string, mode: AgentMode, actual: DispatchActual): Promise<void> {
		await this.append({
			taskId,
			stepId,
			kind: "dispatch.completed",
			timestamp: actual.completedAt,
			mode,
			details: { ...actual },
		});
	}

	public async appendRequestReceived(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; source: RequestInputSource; delivery: RequestDelivery }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.received", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { logicalRequestId: input.requestId, source: input.source, delivery: input.delivery } });
	}

	public async appendRequestRedeliveryCoalesced(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; reason: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.redelivery.coalesced", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { logicalRequestId: input.requestId, reason: input.reason } });
	}

	public async appendRequestAttemptStarted(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId: string; number: number; trigger: RequestAttemptTrigger }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.attempt.started", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId, attemptId: input.attemptId }, details: { logicalRequestId: input.requestId, attemptId: input.attemptId, number: input.number, trigger: input.trigger } });
	}

	public async appendRequestAttemptCompleted(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId: string; number: number; outcome: RequestAttemptOutcome; failureReason?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.attempt.completed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId, attemptId: input.attemptId }, details: { logicalRequestId: input.requestId, attemptId: input.attemptId, number: input.number, outcome: input.outcome, ...(input.failureReason ? { failureReason: input.failureReason } : {}) } });
	}

	public async appendRequestTerminal(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; reason: RequestTerminalReason; detail?: string; policyAbort?: boolean }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.terminal", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { logicalRequestId: input.requestId, reason: input.reason, ...(input.detail ? { detail: input.detail } : {}), ...(input.policyAbort ? { policyAbort: true } : {}) } });
	}

	public async appendRuntimePhase(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; providerCallId?: string; phase: "request-prepare" | "tool" | "provider" | "pi-post-hook"; durationMs: number; name?: string; metrics?: Readonly<Record<string, number | boolean>> }): Promise<void> {
		await this.append({
			taskId: input.taskId,
			stepId: input.stepId,
			kind: "runtime.phase.completed",
			timestamp: new Date().toISOString(),
			mode: input.mode,
			correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, toolCallId: input.toolCallId, providerCallId: input.providerCallId, taskId: input.taskId },
			details: { phase: input.phase, durationMs: Math.max(0, Math.round(input.durationMs)), ...(input.name ? { name: input.name } : {}), ...(input.metrics ? { metrics: input.metrics } : {}) },
		});
	}

	public async appendRequestPlan(taskId: string, stepId: string, plan: RequestPlan, sessionId?: string): Promise<void> {
		await this.append({
			taskId,
			stepId,
			kind: "request.planned",
			timestamp: new Date().toISOString(),
			mode: plan.mode,
			correlation: { requestId: plan.requestId, sessionId, taskId },
			details: {
				requestId: plan.requestId,
				interactionMode: plan.interactionMode,
				lane: plan.lane,
				continuedFromRequestId: plan.continuedFromRequestId,
				intent: plan.intent,
				workflowAction: plan.workflowAction,
				projectAction: plan.projectAction,
				contextClasses: plan.contextClasses,
				projectAvailable: plan.projectAvailable,
			},
		});
	}

	public async appendModelBudgetChecked(taskId: string, stepId: string, mode: AgentMode, requestId: string, budget: BudgetAccounting, sessionId?: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "model.budget.checked", timestamp: new Date().toISOString(), mode, correlation: { requestId, sessionId, taskId }, details: { requestId, ...budget } });
	}

	public async appendModelBudgetRejected(taskId: string, stepId: string, mode: AgentMode, requestId: string, diagnostic: BudgetDiagnostic, sessionId?: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "model.budget.rejected", timestamp: new Date().toISOString(), mode, correlation: { requestId, sessionId, taskId }, details: { requestId, ...diagnostic } });
	}

	public async appendProviderRequestStarted(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId?: string; providerCallId: string; inputTokens: number; providerToolCount: number; providerToolSchemaBytes: number; cachePolicyVersion: number; cachePrefix?: CachePrefixEvidence; ownerPid?: number }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "provider.request.started", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, providerCallId: input.providerCallId, taskId: input.taskId }, details: { requestId: input.requestId, attemptId: input.attemptId, providerCallId: input.providerCallId, inputTokens: input.inputTokens, providerToolCount: input.providerToolCount, providerToolSchemaBytes: input.providerToolSchemaBytes, cachePolicyVersion: input.cachePolicyVersion, cachePrefix: input.cachePrefix, ownerPid: input.ownerPid } });
	}

	public async appendProviderRequestCompleted(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId?: string; providerCallId: string; stopReason?: string; usage?: Readonly<Record<string, number>>; cache?: ProviderCacheAttribution; durationMs?: number }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "provider.request.completed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, providerCallId: input.providerCallId, taskId: input.taskId }, details: { requestId: input.requestId, attemptId: input.attemptId, providerCallId: input.providerCallId, stopReason: input.stopReason, usage: input.usage, cache: input.cache, ...(input.durationMs === undefined ? {} : { durationMs: Math.max(0, Math.round(input.durationMs)) }) } });
	}

	public async appendProviderRequestRejected(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId?: string; providerCallId: string; diagnostic: BudgetDiagnostic }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "provider.request.rejected", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, providerCallId: input.providerCallId, taskId: input.taskId }, details: { requestId: input.requestId, attemptId: input.attemptId, providerCallId: input.providerCallId, ...input.diagnostic } });
	}

	public async appendProviderRequestRecovered(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; attemptId?: string; providerCallId: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "provider.request.completed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, providerCallId: input.providerCallId, taskId: input.taskId }, details: { requestId: input.requestId, attemptId: input.attemptId, providerCallId: input.providerCallId, stopReason: "recovered", recovered: true } });
	}

	public async appendCapabilityApprovalPending(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; executionId: string; capability: string; version: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "capability.approval.pending", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, executionId: input.executionId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { executionId: input.executionId, capability: input.capability, version: input.version } });
	}

	public async appendCapabilityApproved(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; executionId: string; capability: string; version: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "capability.approved", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, executionId: input.executionId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { executionId: input.executionId, capability: input.capability, version: input.version } });
	}

	public async appendCapabilityTerminal(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; executionId: string; capability: string; status: "cancelled" | "timed_out" | "recovered"; reason?: string }): Promise<void> {
		const kind = input.status === "cancelled" ? "capability.cancelled" : input.status === "timed_out" ? "capability.timed_out" : "capability.recovered";
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind, timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, executionId: input.executionId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { executionId: input.executionId, capability: input.capability, reason: input.reason } });
	}

	public async appendProjectMutationStarted(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string, args: readonly string[] = [], beforeTaskIds: readonly string[] = [], targetTaskId?: string, beforeTargetStatus?: string, beforeCurrentTaskId?: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.started", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision, args: args.map((arg) => arg.slice(0, 512)), beforeTaskIds: beforeTaskIds.slice(0, 512), ...(targetTaskId ? { targetTaskId } : {}), ...(beforeTargetStatus ? { beforeTargetStatus: beforeTargetStatus.slice(0, 128) } : {}), ...(beforeCurrentTaskId ? { beforeCurrentTaskId } : {}) } });
	}

	public async appendProjectMutationCompleted(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.completed", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision } });
	}

	public async appendProjectMutationFailed(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string, error: string): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.failed", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision, error } });
	}

	public async appendProjectMutationReconciled(taskId: string, stepId: string, mode: AgentMode, mutationId: string, operation: string, provider: string, revision: string, outcome: "unknown" | "observed"): Promise<void> {
		await this.append({ taskId, stepId, kind: "project.mutation.reconciled", timestamp: new Date().toISOString(), mode, details: { mutationId, operation, provider, revision, outcome, incomplete: true } });
	}

	/** Read the append-only ledger for startup recovery and diagnostics. */
	public async read(): Promise<readonly ExecutionRecord[]> {
		try {
			const content = await readFile(this.filePath, "utf8");
			return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
				try {
					const record = JSON.parse(line) as ExecutionRecord;
					return record && typeof record === "object" ? [record] : [];
				} catch {
					return [];
				}
			});
		} catch (error) {
			if (isMissing(error)) return [];
			throw error;
		}
	}

	public async findIncompleteProjectMutations(): Promise<readonly ProjectMutationIntent[]> {
		const intents = new Map<string, ProjectMutationIntent>();
		for (const record of await this.read()) {
			if (!record.kind.startsWith("project.mutation.")) continue;
			const details = record.details as { mutationId?: unknown; operation?: unknown; provider?: unknown; revision?: unknown; args?: unknown; beforeTaskIds?: unknown; targetTaskId?: unknown; beforeTargetStatus?: unknown; beforeCurrentTaskId?: unknown };
			if (typeof details.mutationId !== "string") continue;
			if (record.kind === "project.mutation.started") {
				intents.set(details.mutationId, { mutationId: details.mutationId, taskId: record.taskId, stepId: record.stepId, mode: record.mode, operation: String(details.operation ?? "unknown"), provider: String(details.provider ?? "unknown"), revision: String(details.revision ?? "unknown"), args: Array.isArray(details.args) ? details.args.filter((arg): arg is string => typeof arg === "string") : [], beforeTaskIds: Array.isArray(details.beforeTaskIds) ? details.beforeTaskIds.filter((id): id is string => typeof id === "string") : [], ...(typeof details.targetTaskId === "string" ? { targetTaskId: details.targetTaskId } : {}), ...(typeof details.beforeTargetStatus === "string" ? { beforeTargetStatus: details.beforeTargetStatus } : {}), ...(typeof details.beforeCurrentTaskId === "string" ? { beforeCurrentTaskId: details.beforeCurrentTaskId } : {}) });
			} else {
				intents.delete(details.mutationId);
			}
		}
		return [...intents.values()];
	}

	/** Return capability executions that started but never reached a terminal record. */
	public async findIncompleteCapabilityExecutions(options: RecoveryOwnerOptions = {}): Promise<readonly CapabilityExecutionIntent[]> {
		const intents = new Map<string, CapabilityExecutionIntent>();
		for (const record of await this.read()) {
			if (record.kind !== "capability.started" && record.kind !== "capability.completed" && record.kind !== "capability.cancelled" && record.kind !== "capability.timed_out" && record.kind !== "capability.recovered") continue;
			const details = record.details as { executionId?: unknown; capability?: unknown; version?: unknown; ownerPid?: unknown };
			if (typeof details.executionId !== "string") continue;
			if (record.kind === "capability.started") {
				intents.set(details.executionId, { executionId: details.executionId, taskId: record.taskId, stepId: record.stepId, mode: record.mode, capability: String(details.capability ?? "unknown"), version: String(details.version ?? "unknown"), sessionId: record.correlation?.sessionId, ownerPid: validPid(details.ownerPid) });
			} else {
				intents.delete(details.executionId);
			}
		}
		return filterInactiveOwners([...intents.values()], options);
	}

	public async findIncompleteProviderRequests(options: RecoveryOwnerOptions = {}): Promise<readonly ProviderRequestIntent[]> {
		const requests = new Map<string, ProviderRequestIntent>();
		for (const record of await this.read()) {
			if (record.kind !== "provider.request.started" && record.kind !== "provider.request.completed" && record.kind !== "provider.request.rejected") continue;
			const details = record.details as { providerCallId?: unknown; requestId?: unknown; ownerPid?: unknown };
			if (typeof details.providerCallId !== "string") continue;
			if (record.kind === "provider.request.started") requests.set(details.providerCallId, { providerCallId: details.providerCallId, requestId: String(details.requestId ?? record.correlation?.requestId ?? "unknown"), taskId: record.taskId, stepId: record.stepId, mode: record.mode, sessionId: record.correlation?.sessionId, ownerPid: validPid(details.ownerPid) });
			else requests.delete(details.providerCallId);
		}
		return filterInactiveOwners([...requests.values()], options);
	}
}

export interface ProjectMutationIntent {
	readonly mutationId: string;
	readonly taskId: string;
	readonly stepId: string;
	readonly mode: AgentMode;
	readonly operation: string;
	readonly provider: string;
	readonly revision: string;
	readonly args: readonly string[];
	readonly beforeTaskIds: readonly string[];
	readonly targetTaskId?: string;
	readonly beforeTargetStatus?: string;
	readonly beforeCurrentTaskId?: string;
}

export interface CapabilityExecutionIntent {
	readonly executionId: string;
	readonly taskId: string;
	readonly stepId: string;
	readonly mode: AgentMode;
	readonly capability: string;
	readonly version: string;
	readonly sessionId?: string;
	readonly ownerPid?: number;
}

export interface ProviderRequestIntent {
	readonly providerCallId: string;
	readonly requestId: string;
	readonly taskId: string;
	readonly stepId: string;
	readonly mode: AgentMode;
	readonly sessionId?: string;
	readonly ownerPid?: number;
}

export interface RecoveryOwnerOptions {
	/** Host-owned liveness probe. Core never imports process/OS APIs. */
	readonly isProcessActive?: (pid: number) => boolean;
}

function filterInactiveOwners<T extends { readonly ownerPid?: number }>(intents: readonly T[], options: RecoveryOwnerOptions): readonly T[] {
	if (!options.isProcessActive) return intents;
	return intents.filter((intent) => intent.ownerPid === undefined || !options.isProcessActive?.(intent.ownerPid));
}

function validPid(value: unknown): number | undefined {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function isMissing(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
