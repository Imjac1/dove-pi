import type { ExecutionRecord } from "./contracts.ts";
import { classifyTerminal } from "./harness-axes.ts";
import type { ChangeSurface, TaskResourceObservation } from "./task-convergence.ts";
import type { RequestTerminalReason } from "./request-lifecycle.ts";

/**
 * **The mining half of the loop, in the smallest honest form this harness supports.**
 *
 * Self-Harness's weakness mining turns failure records into patterns; this is the record. It reads the execution
 * ledger - records the harness itself wrote - and emits, per request that ended in a failure, what the evidence
 * holds: the **class** (`reason`) and, separately, the **mechanism** (`code` + `origin` from the terminal envelope).
 *
 * That separation is the point. `terminalForFailure` (`pi-adapter/extension.ts:565-573`) builds codes that name the
 * cause exactly - `provider-attempt-limit`, `retry-refused-after-effect`, `model-budget-rejected` - while `reason`
 * collapses them all to `failed`. Self-Harness's own requirement is that the record distinguish "two runs that share
 * a verifier outcome and differ in causal mechanism"; a record that kept only the reason would throw that away.
 *
 * **What it does not do**: cluster, rank, or propose. It reads.
 */

export interface FailureMechanism {
	readonly code: string;
	readonly origin: string;
	readonly retryable: boolean;
	readonly summary?: string;
}

export interface FailureRecord {
	readonly requestId: string;
	/** Always `failure`: this is the classification the SSM axis applies, not a second one. */
	readonly class: "failure";
	readonly reason: string;
	readonly mechanism: FailureMechanism;
	readonly refusals: readonly { readonly gate: string; readonly reason: string }[];
	readonly convergence?: { readonly state?: string; readonly acceptanceId?: string };
	readonly resources?: TaskResourceObservation;
	readonly component: ChangeSurface | "unattributed";
	/** The rule that decided the component, or the reason none could be. Never empty. */
	readonly componentEvidence: string;
}

export interface FailureReading {
	/** Every request the ledger contains, whether or not it failed. */
	readonly requests: number;
	readonly failures: readonly FailureRecord[];
	/** Refusals with no request id. Counted rather than attributed by position - see the design. */
	readonly unrefused: number;
	/** What this corpus does **not** contain, so an empty reading is not mistaken for a working one. */
	readonly corpus: readonly string[];
}

const RESOURCE_FIELDS = ["toolCalls", "providerRounds", "elapsedMs", "inputTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens", "reasoningTokens"] as const;

function detailsOf(record: ExecutionRecord): Record<string, unknown> {
	return record.details ?? {};
}

/** The request a record belongs to: the correlation first, then the terminal detail that names itself. */
function requestIdOf(record: ExecutionRecord): string | undefined {
	const correlated = record.correlation?.requestId;
	if (typeof correlated === "string" && correlated !== "") return correlated;
	const logical = detailsOf(record).logicalRequestId;
	return typeof logical === "string" && logical !== "" ? logical : undefined;
}

function stringField(source: Record<string, unknown>, field: string): string | undefined {
	const value = source[field];
	return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Which component a failure points at, and the evidence that decided it.
 *
 * **Stated, never inferred silently.** AHE maps each failure pattern to one component so an edit is targeted; the
 * rows below are the mapping this harness can defend, each named with the record it rests on. Evidence that does not
 * determine a component returns `unattributed` - an invented attribution would point an edit at the wrong file,
 * which is worse than admitting the records do not say.
 */
export function componentForFailure(input: { readonly refusalLabels: readonly string[]; readonly origin?: string; readonly code?: string }): { readonly component: ChangeSurface | "unattributed"; readonly evidence: string } {
	if (input.refusalLabels.length > 0) {
		return {
			component: "middleware",
			evidence: "a gate refused this request (" + [...input.refusalLabels].join(", ") + "), and the policy that refuses is src/core/action-policy.ts, which the surface declares under middleware",
		};
	}
	if (input.code === "retry-refused-after-effect") {
		return { component: "middleware", evidence: "the effect boundary refused to replay after a non-idempotent effect" };
	}
	if (input.origin === "convergence") return { component: "middleware", evidence: "the convergence refusal is built in the tool-call path" };
	if (input.origin === "progress-guard") return { component: "middleware", evidence: "the progress guard sits in the tool-call path" };
	if (input.origin === "model-budget") {
		return {
			component: "unattributed",
			evidence: "the gateway is src/core/model-gateway.ts, and the surface declares src wholesale as tool-implementation, so claiming that component would point nowhere",
		};
	}
	if (input.origin === "provider") return { component: "unattributed", evidence: "the cause is outside the harness: a provider outcome is not one of our components" };
	return { component: "unattributed", evidence: "the records do not determine a component" };
}

/**
 * Read the failures out of a ledger.
 *
 * Grouping is by request id, and **never by position**: `issueRequestHostAbort` can settle a previous request after
 * the next one has been received, so a positional rule would attribute a refusal to the wrong request. A refusal with
 * no id is counted in `unrefused` and left out of every record, which is what the producer fix exists to remove.
 */
export function readFailures(records: readonly ExecutionRecord[]): FailureReading {
	const requestIds = new Set<string>();
	const refusals = new Map<string, { gate: string; reason: string }[]>();
	const convergence = new Map<string, { state?: string; acceptanceId?: string }>();
	const resources = new Map<string, TaskResourceObservation>();
	let unrefused = 0;
	let toolObservations = 0;
	const terminals: { requestId: string; reason: string; mechanism: FailureMechanism }[] = [];

	for (const record of records) {
		const id = requestIdOf(record);
		if (record.kind === "request.received" || record.kind === "request.planned") {
			if (id !== undefined) requestIds.add(id);
			continue;
		}
		if (record.kind === "request.terminal") {
			if (id !== undefined) requestIds.add(id);
			const reason = stringField(detailsOf(record), "reason") ?? "failed";
			const envelope = detailsOf(record).terminal as Record<string, unknown> | undefined;
			if (id !== undefined) {
				terminals.push({
					requestId: id,
					reason,
					mechanism: {
						code: stringField(envelope ?? {}, "code") ?? reason,
						origin: stringField(envelope ?? {}, "origin") ?? "unknown",
						retryable: envelope?.retryable === true,
						...(stringField(envelope ?? {}, "summary") === undefined ? {} : { summary: stringField(envelope ?? {}, "summary") as string }),
					},
				});
			}
			continue;
		}
		if (record.kind === "gate.refused") {
			const gate = stringField(detailsOf(record), "gate");
			if (gate === undefined) continue;
			if (id === undefined) {
				unrefused += 1;
				continue;
			}
			const list = refusals.get(id) ?? [];
			list.push({ gate, reason: stringField(detailsOf(record), "reason") ?? "" });
			refusals.set(id, list);
			continue;
		}
		if (record.kind === "tool.observed") {
			toolObservations += 1;
			continue;
		}
		if (record.kind === "task.convergence.decision" && id !== undefined) {
			// The last decision for a request wins, and a later record that omits a field keeps the earlier one: the
			// ledger holds the sequence of a request reads, and a failure is read against the state it ended in.
			const previous = convergence.get(id) ?? {};
			const state = stringField(detailsOf(record), "state") ?? previous.state;
			const acceptanceId = stringField(detailsOf(record), "acceptanceId") ?? previous.acceptanceId;
			convergence.set(id, { ...(state === undefined ? {} : { state }), ...(acceptanceId === undefined ? {} : { acceptanceId }) });
			continue;
		}
		if (record.kind === "task.convergence.observed" && id !== undefined) {
			const details = detailsOf(record);
			const observation: Record<string, number> = {};
			for (const field of RESOURCE_FIELDS) {
				const value = details[field];
				if (typeof value === "number" && Number.isFinite(value)) observation[field] = value;
			}
			if (Object.keys(observation).length > 0) resources.set(id, observation as unknown as TaskResourceObservation);
		}
	}

	const failures: FailureRecord[] = [];
	for (const terminal of terminals) {
		if (classifyTerminal(terminal.reason as RequestTerminalReason) !== "failure") continue;
		const requestRefusals = refusals.get(terminal.requestId) ?? [];
		const attribution = componentForFailure({
			refusalLabels: [...new Set(requestRefusals.map((entry) => entry.gate))],
			origin: terminal.mechanism.origin,
			code: terminal.mechanism.code,
		});
		const observed = resources.get(terminal.requestId);
		const decided = convergence.get(terminal.requestId);
		failures.push({
			requestId: terminal.requestId,
			class: "failure",
			reason: terminal.reason,
			mechanism: terminal.mechanism,
			refusals: requestRefusals,
			...(decided === undefined ? {} : { convergence: decided }),
			...(observed === undefined ? {} : { resources: observed }),
			component: attribution.component,
			componentEvidence: attribution.evidence,
		});
	}

	// **What the corpus does not contain**, so an empty reading is not mistaken for a working one - the same rule the
	// SSM axis follows with `undefined` ratios instead of 1.0.
	const corpus: string[] = [];
	if (toolObservations === 0) corpus.push("no tool.observed record in this ledger: no tool ran, so a failure cannot name one");
	if (failures.length === 0) corpus.push(`no request ended in a failure class across ${requestIds.size} request(s)`);
	if (unrefused > 0) corpus.push(`${unrefused} refusal(s) carry no request id and are counted rather than attributed`);
	return { requests: requestIds.size, failures, unrefused, corpus };
}
