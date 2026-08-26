import { randomUUID } from "node:crypto";
import { decideDispatch } from "./dispatch-policy.ts";
import type { AgentMode, DispatchActual, DispatchActualMetrics, DispatchDecision, DispatchEstimate } from "./contracts.ts";
import type { ExecutionLedger } from "./execution-ledger.ts";

export interface DispatchWork<TResult> {
	readonly estimate: DispatchEstimate;
	readonly longRunningIsolation?: boolean;
	readonly runInline: () => Promise<TResult>;
	readonly runSubagent?: () => Promise<TResult>;
	readonly branches?: readonly (() => Promise<TResult>)[];
	/** Optional provider for token, retry, and human-intervention observations. */
	readonly reportActualMetrics?: () => DispatchActualMetrics | Promise<DispatchActualMetrics>;
	readonly ledger?: ExecutionLedger;
	readonly ledgerContext?: { taskId: string; stepId: string; mode: AgentMode };
}

export interface DispatchOutcome<TResult> {
	readonly decision: DispatchDecision;
	readonly result: TResult | readonly TResult[];
	readonly actual: DispatchActual;
}

export async function executeDispatch<TResult>(work: DispatchWork<TResult>): Promise<DispatchOutcome<TResult>> {
	const decision = decideDispatch(work.estimate, work.longRunningIsolation === true);
	const dispatchId = randomUUID();
	if (work.ledger && work.ledgerContext) await work.ledger.appendDispatchDecision(work.ledgerContext.taskId, work.ledgerContext.stepId, work.ledgerContext.mode, dispatchId, decision);
	const startedAt = new Date().toISOString();
	const started = Date.now();
	let effectiveDecision = decision;
	try {
		if (decision.route === "parallel" && work.branches && work.branches.length >= 2) {
			const result = await Promise.all(work.branches.map((branch) => branch()));
			return { decision, result, actual: await appendActual(work, dispatchId, startedAt, started, decision, "success") };
		}
		if (decision.route === "subagent" && work.runSubagent) {
			const result = await work.runSubagent();
			return { decision, result, actual: await appendActual(work, dispatchId, startedAt, started, decision, "success") };
		}
		effectiveDecision = { ...decision, route: "inline", reason: `${decision.reason}; no compatible worker was supplied` };
		const result = await work.runInline();
		return { decision: effectiveDecision, result, actual: await appendActual(work, dispatchId, startedAt, started, effectiveDecision, "success") };
	} catch (error) {
		await appendActual(work, dispatchId, startedAt, started, effectiveDecision, "failed");
		throw error;
	}
}

async function appendActual<TResult>(
	work: DispatchWork<TResult>,
	dispatchId: string,
	startedAt: string,
	started: number,
	decision: DispatchDecision,
	status: DispatchActual["status"],
): Promise<DispatchActual> {
	let reported: DispatchActualMetrics = {};
	try {
		reported = await work.reportActualMetrics?.() ?? {};
	} catch {
		// Optional host telemetry must not change the worker's result or status.
		reported = {};
	}
	const actual: DispatchActual = {
		dispatchId,
		route: decision.route,
		startedAt,
		completedAt: new Date().toISOString(),
		wallTimeMs: Date.now() - started,
		startupTimeMs: reported.startupTimeMs,
		contextTokens: reported.contextTokens,
		inputTokens: reported.inputTokens,
		outputTokens: reported.outputTokens,
		retries: reported.retries ?? 0,
		humanInterventions: reported.humanInterventions ?? 0,
		status,
	};
	if (work.ledger && work.ledgerContext) await work.ledger.appendDispatchCompletion(work.ledgerContext.taskId, work.ledgerContext.stepId, work.ledgerContext.mode, actual);
	return actual;
}
