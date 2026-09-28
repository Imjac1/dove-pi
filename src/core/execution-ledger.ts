import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentMode, DispatchActual, DispatchDecision, ExecutionRecord, ExecutionRecordKind } from "./contracts.ts";
import type { ChangeVerdict } from "./task-convergence.ts";
import type { RequestPlan } from "./request-plan.ts";
import type { RequestAttemptOutcome, RequestAttemptTrigger, RequestDelivery, RequestInputSource, RequestTerminalEnvelope, RequestTerminalReason } from "./request-lifecycle.ts";
import type { BudgetAccounting, BudgetDiagnostic } from "./model-gateway.ts";
import type { CachePrefixEvidence, ProviderCacheAttribution } from "./cache-prefix.ts";
import type { StrategySnapshot } from "./strategy-snapshot.ts";

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
	readonly strategy?: StrategySnapshot;
	readonly lastTerminal?: ExecutionTerminalDiagnostic;
	readonly lastResourceObservation?: ExecutionResourceDiagnostic;
}

/**
 * Project the latest bounded request diagnostics for headless and Pi hosts.
 * The ledger remains the source of truth; this projection deliberately drops
 * arbitrary details so a diagnostic query cannot echo secrets or large logs.
 */
/**
 * Which of the three coupled defect families a record carries evidence for.
 *
 * The kinds are grouped by the child tasks that eliminated the defects, so an audit summary can say which
 * family a run exercised without the reader knowing the kind vocabulary.
 */
export type ExecutionEvidenceFamily = "extension_identity" | "request_lifecycle" | "tool_loop" | "other";

export interface CorrelatedExecutionGroup {
	/** The strongest identifier the group shares. Records with none of them are grouped under the unlinked key. */
	readonly key: string;
	readonly keyKind: "requestId" | "sessionId" | "attemptId" | "unlinked";
	readonly records: readonly ExecutionRecord[];
	readonly families: Readonly<Record<ExecutionEvidenceFamily, number>>;
/**
	 * True when every record in the group carried correlation identifiers. A group with any legacy record is
	 * labelled, not guessed at: the contract says correlation is optional for legacy records.
	 */
	readonly complete: boolean;
}

const FAMILY_BY_PREFIX: readonly (readonly [string, ExecutionEvidenceFamily])[] = [
	["dispatch.", "extension_identity"],
	["request.", "request_lifecycle"],
	["model.budget.", "tool_loop"],
	["provider.request.", "tool_loop"],
	["tool.", "tool_loop"],
];

/** Name the defect family a record kind belongs to, or `other` when no child claimed it. */
export function executionEvidenceFamily(kind: ExecutionRecordKind): ExecutionEvidenceFamily {
	for (const [prefix, family] of FAMILY_BY_PREFIX) {
		if (kind.startsWith(prefix)) return family;
	}
	return "other";
}

/**
 * Correlate records into groups that share a request, a session or an attempt.
 *
 * **The key is chosen by strength, not by position**: `requestId` identifies one logical user request and is
 * what the idempotency child exists to keep stable, `sessionId` is wider, and `attemptId` is narrower than
 * either. A record carrying none of them is grouped under `unlinked` and its group is marked incomplete,
 * which is where legacy records land - the contract says they may carry no correlation, and an audit
 * projection labels that rather than inventing a key from the timestamp.
 */
export function correlateExecutionRecords(records: readonly ExecutionRecord[]): readonly CorrelatedExecutionGroup[] {
	const groups = new Map<string, { keyKind: CorrelatedExecutionGroup["keyKind"]; records: ExecutionRecord[] }>();
	for (const record of records) {
		const correlation = record.correlation;
		const requestId = correlation?.requestId;
		const sessionId = correlation?.sessionId;
		const attemptId = correlation?.attemptId;
		const keyKind: CorrelatedExecutionGroup["keyKind"] = requestId !== undefined
			? "requestId"
			: sessionId !== undefined ? "sessionId" : attemptId !== undefined ? "attemptId" : "unlinked";
		const key = keyKind === "unlinked" ? UNLINKED_GROUP_KEY : (requestId ?? sessionId ?? attemptId)!;
		const group = groups.get(key) ?? { keyKind, records: [] };
		group.records.push(record);
		groups.set(key, group);
	}
	return [...groups.entries()].map(([key, group]) => {
		const families: Record<ExecutionEvidenceFamily, number> = { extension_identity: 0, request_lifecycle: 0, tool_loop: 0, other: 0 };
		for (const record of group.records) families[executionEvidenceFamily(record.kind)] += 1;
		const complete = group.keyKind !== "unlinked"
			&& group.records.every((record) => record.correlation !== undefined);
		return Object.freeze({ key, keyKind: group.keyKind, records: Object.freeze([...group.records]), families: Object.freeze(families), complete });
	});
}

/** The key a group gets when none of its records carried a correlation identifier. */
export const UNLINKED_GROUP_KEY = "unlinked";
export function projectExecutionDiagnostics(
	records: readonly ExecutionRecord[],
	filter: ExecutionDiagnosticsFilter = {},
): ExecutionDiagnosticsProjection {
	const matching = records.filter((record) => matchesDiagnosticsFilter(record, filter));
	const terminalRecord = [...matching].reverse().find((record) => record.kind === "request.terminal");
	const resourceRecord = [...matching].reverse().find((record) => record.kind === "task.convergence.observed" && isRecord(record.details) && record.details.observationOnly === true);
	const strategyRecord = [...matching].reverse().find((record) => record.kind === "request.planned" && isRecord(record.details) && isRecord(record.details.strategy));
	const resource = resourceRecord ? projectResourceDiagnostic(resourceRecord) : undefined;
	const strategy = strategyRecord && isRecord(strategyRecord.details) && isRecord(strategyRecord.details.strategy)
		? mergeStrategyResources(strategyRecord.details.strategy as unknown as StrategySnapshot, resource)
		: undefined;
	return {
		schemaVersion: 1,
		...(strategy ? { strategy } : {}),
		...(terminalRecord ? { lastTerminal: projectTerminalDiagnostic(terminalRecord) } : {}),
		...(resource ? { lastResourceObservation: resource } : {}),
	};
}

function mergeStrategyResources(strategy: StrategySnapshot, observation: ExecutionResourceDiagnostic | undefined): StrategySnapshot {
	if (!observation) return strategy;
	return {
		...strategy,
		resources: {
			...strategy.resources,
			...(observation.toolCalls === undefined ? {} : { toolCalls: observation.toolCalls }),
			...(observation.providerRounds === undefined ? {} : { providerRounds: observation.providerRounds }),
			...(observation.toolDurationMs === undefined ? {} : { toolDurationMs: observation.toolDurationMs }),
			...(observation.elapsedMs === undefined ? {} : { elapsedMs: observation.elapsedMs }),
			...(observation.inputTokens === undefined ? {} : { inputTokens: observation.inputTokens }),
			...(observation.cacheReadTokens === undefined ? {} : { cacheReadTokens: observation.cacheReadTokens }),
			...(observation.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: observation.cacheWriteTokens }),
			...(observation.outputTokens === undefined ? {} : { outputTokens: observation.outputTokens }),
			...(observation.reasoningTokens === undefined ? {} : { reasoningTokens: observation.reasoningTokens }),
			...(observation.stopReasons === undefined ? {} : { stopReasons: observation.stopReasons }),
		},
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

/**
 * **The one reader of the ledger line format, because five of them disagreed.**
 *
 * A ledger is written one JSON object per line, one line per append. Two of the readings parsed it themselves with a bare
 * `JSON.parse` and threw on a line a crash had cut short - so on exactly the run this harness exists to explain, they printed
 * nothing at all. The rule is that a line which does not parse is **not a record**: the append guarantee is one line per call,
 * so a line the writer never finished was never written.
 *
 * **Left open, and recorded in the contract rather than decided here**: a partial line anywhere but the end would mean the
 * append guarantee itself was broken, and nothing here says whether a reading should skip it, count it, or refuse the file.
 */
export interface ExecutionAuditSummary {
	readonly schemaVersion: 1;
	readonly records: number;
	/** How many logical requests the ledger saw, and how they ended. */
	readonly lifecycle: Readonly<{
		readonly received: number;
		readonly terminal: number;
		readonly aborted: number;
		/** The same prompt delivered again while one was in flight, which the idempotency child exists to prevent. */
		readonly coalescedRedeliveries: number;
		readonly terminalReasons: Readonly<Record<string, number>>;
	}>;
	/** Tool calls seen, and how many identifiers were seen more than once. */
	readonly tools: Readonly<{
		readonly observed: number;
		readonly duplicateToolCalls: number;
		readonly unattributable: number;
	}>;
	readonly budget: Readonly<{ readonly checked: number; readonly rejected: number }>;
	readonly providers: Readonly<{ readonly started: number; readonly completed: number; readonly rejected: number }>;
	readonly dispatch: Readonly<{ readonly decided: number; readonly completed: number }>;
	readonly families: Readonly<Record<ExecutionEvidenceFamily, number>>;
	readonly groups: number;
	readonly groupsMissingCorrelation: number;
}

const UNKNOWN_REASON = "unknown";

/**
 * Summarize a ledger read-only, for the audit command.
 *
 * **Built on `parseLedgerLines`, which the file records as *the one reader of the ledger line format, because
 * five of them disagreed*** - so this adds no second reading of the file, only a projection of what that one
 * returns. Every field is read defensively and a value that is not there is reported `unknown` rather than
 * inferred: the design says payloads are summarized and unavailable fields are labelled.
 *
 * **What it does not summarize, and why that is stated rather than hidden**: cross-turn stagnation and
 * cache-prefix changes. Stagnation is a tool-loop child decision that this vocabulary does not give a kind of
 * its own, and cache-prefix evidence lives on the model gateway rather than on these records. **Counting
 * something adjacent and calling it stagnation would be the failure mode this whole specification is about.**
 */
export function summarizeExecutionRecords(content: string): ExecutionAuditSummary {
	const records = parseLedgerLines(content);
	const groups = correlateExecutionRecords(records);
	const terminalReasons: Record<string, number> = {};
	const toolCallIds = new Set<string>();
	let duplicateToolCalls = 0;
	let unattributable = 0;
	let toolCallsObserved = 0;
	let received = 0;
	let terminal = 0;
	let aborted = 0;
	let coalescedRedeliveries = 0;
	let budgetChecked = 0;
	let budgetRejected = 0;
	let providerStarted = 0;
	let providerCompleted = 0;
	let providerRejected = 0;
	let dispatchDecided = 0;
	let dispatchCompleted = 0;
	const families: Record<ExecutionEvidenceFamily, number> = { extension_identity: 0, request_lifecycle: 0, tool_loop: 0, other: 0 };
	for (const record of records) {
		families[executionEvidenceFamily(record.kind)] += 1;
		switch (record.kind) {
			case "request.received": received += 1; break;
			case "request.redelivery.coalesced": coalescedRedeliveries += 1; break;
			case "request.terminal": {
				terminal += 1;
				const reason = stringValue(record.details.reason) ?? UNKNOWN_REASON;
				terminalReasons[reason] = (terminalReasons[reason] ?? 0) + 1;
				if (record.details.policyAbort === true) aborted += 1;
				break;
			}
			case "tool.observed": {
				toolCallsObserved += 1;
				const id = record.correlation?.toolCallId;
				if (id === undefined) { unattributable += 1; break; }
				if (toolCallIds.has(id)) duplicateToolCalls += 1;
				toolCallIds.add(id);
				break;
			}
			case "model.budget.checked": budgetChecked += 1; break;
			case "model.budget.rejected": budgetRejected += 1; break;
			case "provider.request.started": providerStarted += 1; break;
			case "provider.request.completed": providerCompleted += 1; break;
			case "provider.request.rejected": providerRejected += 1; break;
			case "dispatch.decided": dispatchDecided += 1; break;
			case "dispatch.completed": dispatchCompleted += 1; break;
			default: break;
		}
	}
	return Object.freeze({
		schemaVersion: 1,
		records: records.length,
		lifecycle: Object.freeze({ received, terminal, aborted, coalescedRedeliveries, terminalReasons: Object.freeze(terminalReasons) }),
		tools: Object.freeze({ observed: toolCallsObserved, duplicateToolCalls, unattributable }),
		budget: Object.freeze({ checked: budgetChecked, rejected: budgetRejected }),
		providers: Object.freeze({ started: providerStarted, completed: providerCompleted, rejected: providerRejected }),
		dispatch: Object.freeze({ decided: dispatchDecided, completed: dispatchCompleted }),
		families: Object.freeze(families),
		groups: groups.length,
		groupsMissingCorrelation: groups.filter((group) => !group.complete).length,
	});
}
export function parseLedgerLines(content: string): readonly ExecutionRecord[] {
	return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
		try {
			const parsed: unknown = JSON.parse(line);
			// **A parsed line is not yet a record.** `typeof [] === "object"`, so a JSON array used to survive
			// this test and reach the projection with no `kind` at all - which then threw on `startsWith` and
			// took the whole summary with it, on exactly the malformed input this reader exists to survive.
			// The contract requires `kind` on every record, so requiring it here is what the contract says
			// rather than a new rule: a line without one is not a record, the same as a line that does not parse.
			if (!isRecord(parsed)) return [];
			if (typeof parsed.kind !== "string") return [];
			return [parsed as unknown as ExecutionRecord];
		} catch {
			return [];
		}
	});
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

	public async appendRequestPlan(taskId: string, stepId: string, plan: RequestPlan, sessionId?: string, strategy?: StrategySnapshot): Promise<void> {
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
				...(strategy ? { strategy } : {}),
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

	/**
	 * A pre-execution gate refused an action, with the reason and the remediation it gave.
	 *
	 * The reason is the evidence: a refusal that leaves no record is indistinguishable from an action that never
	 * happened, and the two need different responses from whoever reads the ledger later.
	 */
	public async appendGateRefused(input: { taskId: string; stepId: string; mode: AgentMode; tool: string; action: string; viaCapability: boolean; gate: string; reason: string; remediation: string; requestId?: string; sessionId?: string; toolCallId?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "gate.refused", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { tool: input.tool, action: input.action, viaCapability: input.viaCapability, gate: input.gate, reason: input.reason, remediation: input.remediation } });
	}

	/**
	 * The operator consented to an action the mode listed in `ask_before`.
	 *
	 * Written for the same reason the refusal is: the ledger is what makes the claim checkable. "This action ran
	 * because someone agreed to it" is otherwise a statement about code, and an action that ran unasked leaves the
	 * same trace as one that was agreed to.
	 */
	public async appendGateApproved(input: { taskId: string; stepId: string; mode: AgentMode; tool: string; action: string; viaCapability: boolean; gate: string; reason: string; requestId?: string; sessionId?: string; toolCallId?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "gate.approved", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { tool: input.tool, action: input.action, viaCapability: input.viaCapability, gate: input.gate, reason: input.reason } });
	}

	/**
	 * A tool call the harness observed, recorded so a later acceptance pass can cite it.
	 *
	 * **This is the observable side of "a pass must be checkable".** The agent can write a file or a sentence saying a
	 * criterion passed; it cannot make this record exist, which is what makes it evidence rather than an assertion. It
	 * is written unconditionally (unlike the timing phase, which is best-effort) because a citation pointing at a
	 * record that was never written is worse than no citation at all.
	 */
	public async appendToolObserved(input: { taskId: string; stepId: string; mode: AgentMode; tool: string; isError: boolean; requestId?: string; sessionId?: string; attemptId?: string; toolCallId: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "tool.observed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, toolCallId: input.toolCallId, taskId: input.taskId }, details: { tool: input.tool, isError: input.isError, toolCallId: input.toolCallId } });
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

	public async appendTaskResourceObservation(input: { taskId: string; stepId: string; mode: AgentMode; requestId?: string; sessionId?: string; attemptId?: string; acceptanceId?: string; toolCalls: number; providerRounds: number; elapsedMs: number; toolDurationMs?: number; inputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; outputTokens?: number; reasoningTokens?: number; stopReasons?: readonly string[]; convergenceSkipReason?: string; acceptanceVector?: readonly { readonly id: string; readonly status: string }[]; consecutiveNoProgress?: number }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "task.convergence.observed", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, attemptId: input.attemptId, taskId: input.taskId }, details: { observationOnly: true, ...(input.acceptanceVector === undefined ? {} : { acceptanceVector: input.acceptanceVector.map((criterion) => ({ id: criterion.id, status: criterion.status })) }), ...(input.consecutiveNoProgress === undefined ? {} : { consecutiveNoProgress: input.consecutiveNoProgress }), ...(input.convergenceSkipReason === undefined ? {} : { convergenceSkipReason: input.convergenceSkipReason }), ...(input.acceptanceId ? { acceptanceId: input.acceptanceId } : {}), toolCalls: input.toolCalls, providerRounds: input.providerRounds, elapsedMs: Math.max(0, Math.round(input.elapsedMs)), ...(input.toolDurationMs === undefined ? {} : { toolDurationMs: Math.max(0, Math.round(input.toolDurationMs)) }), ...(input.inputTokens === undefined ? {} : { inputTokens: input.inputTokens }), ...(input.cacheReadTokens === undefined ? {} : { cacheReadTokens: input.cacheReadTokens }), ...(input.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: input.cacheWriteTokens }), ...(input.outputTokens === undefined ? {} : { outputTokens: input.outputTokens }), ...(input.reasoningTokens === undefined ? {} : { reasoningTokens: input.reasoningTokens }), ...(input.stopReasons === undefined ? {} : { stopReasons: input.stopReasons.slice(0, 64) }) } });
	}

	/**
	 * **The validation half of the loop, written down.** A verdict exists in one place today: computed on read by the
	 * convergence status path and then discarded, which is enough to report and not enough to learn from - the manifest
	 * is bounded and lives in one task, so a change whose verdict is still pending falls out of the record and stops
	 * being recomputable at all.
	 *
	 * **`verdictOnly` says what this records and what it does not.** It reports a verdict; it never reverts an edit,
	 * mutates a criterion, or refuses a call. Same convention as the observation, for the same reason: a reader must be
	 * able to tell a record that reports from a record that acted.
	 */
	public async appendChangeDecided(input: { taskId: string; stepId: string; mode: AgentMode; changeId: string; verdict: ChangeVerdict; observed: readonly string[]; revision: number; requestId?: string; sessionId?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "change.decided", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { changeId: input.changeId, verdict: input.verdict, observed: input.observed, decidedAtRevision: input.revision, verdictOnly: true } });
	}

	/**
	 * **The claim that binds a change to the commit that embodies it.** AHE requires the action space to be explicit
	 * and revertible; the surface declaration made it explicit and nothing gave the revert a target. This is the
	 * target, and it is a claim: the runtime cannot reach git, and putting a process spawn on the request path to check
	 * one would be a control where a reading belongs. The check runs in `scripts/harness-rounds.mts`, where git and
	 * this project evidence readings already live.
	 */
	public async appendChangeApplied(input: { taskId: string; stepId: string; mode: AgentMode; changeId: string; commit: string; requestId?: string; sessionId?: string }): Promise<void> {
		await this.append({ taskId: input.taskId, stepId: input.stepId, kind: "change.applied", timestamp: new Date().toISOString(), mode: input.mode, correlation: { requestId: input.requestId, sessionId: input.sessionId, taskId: input.taskId }, details: { changeId: input.changeId, commit: input.commit } });
	}

	/** Read the append-only ledger for startup recovery and diagnostics, through the one reader of its line format. */
	public async read(): Promise<readonly ExecutionRecord[]> {
		try {
			return parseLedgerLines(await readFile(this.filePath, "utf8"));
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
