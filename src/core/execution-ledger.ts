import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentMode, DispatchActual, DispatchDecision, ExecutionRecord } from "./contracts.ts";
import type { RequestPlan } from "./request-plan.ts";
import type { RequestAttemptOutcome, RequestAttemptTrigger, RequestDelivery, RequestInputSource, RequestTerminalEnvelope, RequestTerminalReason } from "./request-lifecycle.ts";
import type { BudgetAccounting, BudgetDiagnostic } from "./model-gateway.ts";
import type { CachePrefixEvidence, ProviderCacheAttribution } from "./cache-prefix.ts";

export interface ExecutionDiagnosticsFilter {
	readonly sessionId?: string;
	readonly requestId?: string;
}

export interface ExecutionTerminalDiagnostic {
	readonly timestamp: string;
	readonly taskId: string;
	readonly requestId?: string;
	readonly sessionId?: string;
	readonly reason?: string;
	readonly detail?: string;
	readonly policyAbort?: boolean;
	readonly terminal?: RequestTerminalEnvelope;
}

export interface ExecutionResourceDiagnostic {
	readonly timestamp: string;
	readonly taskId: string;
	readonly requestId?: string;
	readonly sessionId?: string;
	readonly attemptId?: string;
	readonly acceptanceId?: string;
	readonly toolCalls?: number;
	readonly providerRounds?: number;
	readonly elapsedMs?: number;
	readonly toolDurationMs?: number;
	readonly inputTokens?: number;
	readonly cacheReadTokens?: number;
	readonly cacheWriteTokens?: number;
	readonly outputTokens?: number;
	readonly reasoningTokens?: number;
	readonly stopReasons?: readonly string[];
}

export interface ExecutionDiagnosticsProjection {
	readonly schemaVersion: 1;
	readonly lastTerminal?: ExecutionTerminalDiagnostic;
	readonly lastResourceObservation?: ExecutionResourceDiagnostic;
}

/**
 * Project the latest bounded request diagnostics for headless and Pi hosts.
 * The ledger remains the source of truth; this projection deliberately drops
 * arbitrary details so a diagnostic query cannot echo secrets or large logs.
 */
export function projectExecutionDiagnostics(
	records: readonly ExecutionRecord[],
	filter: ExecutionDiagnosticsFilter = {},
): ExecutionDiagnosticsProjection {
	const matching = records.filter((record) => matchesDiagnosticsFilter(record, filter));
	const terminalRecord = [...matching].reverse().find((record) => record.kind === "request.terminal");
	const resourceRecord = [...matching].reverse().find((record) => record.kind === "task.convergence.observed" && isRecord(record.details) && record.details.observationOnly === true);
	return {
		schemaVersion: 1,
		...(terminalRecord ? { lastTerminal: projectTerminalDiagnostic(terminalRecord) } : {}),
		...(resourceRecord ? { lastResourceObservation: projectResourceDiagnostic(resourceRecord) } : {}),
	};
}

const TERMINAL_ORIGINS = new Set<RequestTerminalEnvelope["origin"]>([
	"user", "provider", "model-budget", "provider-round", "progress-guard", "convergence", "session",
]);
const RESOURCE_METRIC_KEYS = [
	"toolCalls", "providerRounds", "elapsedMs", "toolDurationMs", "inputTokens", "cacheReadTokens",
	"cacheWriteTokens", "outputTokens", "reasoningTokens",
] as const;
type ResourceMetricKey = typeof RESOURCE_METRIC_KEYS[number];

function matchesDiagnosticsFilter(record: ExecutionRecord, filter: ExecutionDiagnosticsFilter): boolean {
	const details = isRecord(record.details) ? record.details : {};
	const requestId = stringValue(record.correlation?.requestId) ?? stringValue(details.logicalRequestId);
	if (filter.requestId !== undefined && requestId !== filter.requestId) return false;
	if (filter.sessionId !== undefined && stringValue(record.correlation?.sessionId) !== filter.sessionId) return false;
	return true;
}

function projectTerminalDiagnostic(record: ExecutionRecord): ExecutionTerminalDiagnostic {
	const details = isRecord(record.details) ? record.details : {};
	const requestId = stringValue(record.correlation?.requestId) ?? stringValue(details.logicalRequestId);
	const sessionId = stringValue(record.correlation?.sessionId);
	const reason = stringValue(details.reason);
	const detail = stringValue(details.detail);
	const policyAbort = typeof details.policyAbort === "boolean" ? details.policyAbort : undefined;
	const terminal = normalizeTerminalEnvelope(details.terminal);
	return {
		timestamp: record.timestamp,
		taskId: record.taskId,
		...(requestId ? { requestId } : {}),
		...(sessionId ? { sessionId } : {}),
		...(reason ? { reason } : {}),
		...(detail ? { detail } : {}),
		...(policyAbort === undefined ? {} : { policyAbort }),
		...(terminal ? { terminal } : {}),
	};
}

function projectResourceDiagnostic(record: ExecutionRecord): ExecutionResourceDiagnostic {
	const details = isRecord(record.details) ? record.details : {};
	const metrics: Partial<Record<ResourceMetricKey, number>> = {};
	for (const key of RESOURCE_METRIC_KEYS) {
		const value = nonNegativeNumber(details[key]);
		if (value !== undefined) metrics[key] = value;
	}
	const stopReasons = Array.isArray(details.stopReasons)
		? details.stopReasons.filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 128)).slice(0, 64)
		: undefined;
	const requestId = stringValue(record.correlation?.requestId);
	const sessionId = stringValue(record.correlation?.sessionId);
	const attemptId = stringValue(record.correlation?.attemptId);
	const acceptanceId = stringValue(details.acceptanceId);
	return {
		timestamp: record.timestamp,
		taskId: record.taskId,
		...(requestId ? { requestId } : {}),
		...(sessionId ? { sessionId } : {}),
		...(attemptId ? { attemptId } : {}),
		...(acceptanceId ? { acceptanceId } : {}),
		...metrics,
		...(stopReasons && stopReasons.length > 0 ? { stopReasons } : {}),
	};
}

function normalizeTerminalEnvelope(value: unknown): RequestTerminalEnvelope | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const candidate = value as Record<string, unknown>;
	const origin = candidate.origin;
	const code = stringValue(candidate.code);
	const summary = stringValue(candidate.summary);
	if (typeof origin !== "string" || !TERMINAL_ORIGINS.has(origin as RequestTerminalEnvelope["origin"]) || !code || !summary || typeof candidate.retryable !== "boolean") return undefined;
	const nextAction = stringValue(candidate.nextAction);
	const requestId = stringValue(candidate.requestId);
	const attemptId = stringValue(candidate.attemptId);
	return {
		origin: origin as RequestTerminalEnvelope["origin"],
		code: code.slice(0, 256),
		summary: summary.slice(0, 2048),
		retryable: candidate.retryable,
		...(nextAction ? { nextAction: nextAction.slice(0, 1024) } : {}),
		...(requestId ? { requestId: requestId.slice(0, 256) } : {}),
		...(attemptId ? { attemptId: attemptId.slice(0, 256) } : {}),
	};
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

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

	public async appendRequestTerminal(input: { taskId: string; stepId: string; mode: AgentMode; requestId: string; sessionId?: string; reason: RequestTerminalReason; detail?: string; policyAbort?: boolean; terminal?: RequestTerminalEnvelope }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "request.terminal", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { logicalRequestId: input.requestId, reason: input.reason, ...(input.detail ? { detail: input.detail } : {}), ...(input.policyAbort ? { policyAbort: true } : {}), ...(input.terminal ? { terminal: input.terminal } : {}) } });
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
				taskSelector: plan.taskSelector,
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

	public async appendTaskConvergenceDecision(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; acceptanceId?: string; eventKind: string; state: string; snapshotRevision: number; acceptanceRevision: string; findingId?: string; findingKind?: string; nextAction?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "task.convergence.decision", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { eventKind: input.eventKind, state: input.state, snapshotRevision: input.snapshotRevision, acceptanceRevision: input.acceptanceRevision, ...(input.acceptanceId ? { acceptanceId: input.acceptanceId } : {}), ...(input.findingId ? { findingId: input.findingId } : {}), ...(input.findingKind ? { findingKind: input.findingKind } : {}), ...(input.nextAction ? { nextAction: input.nextAction } : {}) } });
	}

	public async appendTaskResourceObservation(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; acceptanceId?: string; toolCalls: number; providerRounds: number; elapsedMs: number; toolDurationMs?: number; inputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; outputTokens?: number; reasoningTokens?: number; stopReasons?: readonly string[] }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "task.convergence.observed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, taskId: input.taskId }, details: { observationOnly: true, ...(input.acceptanceId ? { acceptanceId: input.acceptanceId } : {}), toolCalls: input.toolCalls, providerRounds: input.providerRounds, elapsedMs: Math.max(0, Math.round(input.elapsedMs)), ...(input.toolDurationMs === undefined ? {} : { toolDurationMs: Math.max(0, Math.round(input.toolDurationMs)) }), ...(input.inputTokens === undefined ? {} : { inputTokens: input.inputTokens }), ...(input.cacheReadTokens === undefined ? {} : { cacheReadTokens: input.cacheReadTokens }), ...(input.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: input.cacheWriteTokens }), ...(input.outputTokens === undefined ? {} : { outputTokens: input.outputTokens }), ...(input.reasoningTokens === undefined ? {} : { reasoningTokens: input.reasoningTokens }), ...(input.stopReasons === undefined ? {} : { stopReasons: input.stopReasons.slice(0, 64) }) } });
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
