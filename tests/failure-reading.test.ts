import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExecutionRecord, ExecutionRecordKind } from "../src/core/contracts.ts";
import { componentForFailure, readFailures } from "../src/core/failure-reading.ts";

/**
 * The corpus on this machine contains no failure at all (164 ledgers, 164 completed terminals), so every branch here
 * is exercised on constructed records. That is stated rather than hidden: what these tests establish is that the
 * reading works, not what our harness gets wrong.
 */

const AT = "2026-09-28T00:00:00.000Z";

function record(kind: ExecutionRecordKind, requestId: string | undefined, details: Record<string, unknown>): ExecutionRecord {
	return { taskId: "t", stepId: "s", kind, timestamp: AT, mode: "standard", details, ...(requestId === undefined ? {} : { correlation: { requestId } }) };
}

function received(requestId: string): ExecutionRecord {
	return record("request.received", requestId, { logicalRequestId: requestId });
}

function terminal(requestId: string, reason: string, envelope: Record<string, unknown>): ExecutionRecord {
	return record("request.terminal", requestId, { logicalRequestId: requestId, reason, terminal: { requestId, ...envelope } });
}

function refused(requestId: string | undefined, gate: string, reason = "refused"): ExecutionRecord {
	return record("gate.refused", requestId, { gate, reason });
}

describe("the failure reading", () => {
	it("keeps the mechanism beside the class, which is the distinction the reason collapses", () => {
		// Self-Harness: two runs can share a verifier outcome and differ in causal mechanism. Both of these are
		// `reason: failed`; only the envelope says which cause it was.
		const reading = readFailures([
			received("req-1"),
			terminal("req-1", "failed", { origin: "provider", code: "provider-attempt-limit", retryable: true, summary: "retry limit exhausted" }),
			received("req-2"),
			terminal("req-2", "failed", { origin: "provider", code: "retry-refused-after-effect", retryable: false }),
		]);
		assert.equal(reading.requests, 2);
		assert.deepEqual(reading.failures.map((failure) => failure.reason), ["failed", "failed"], "the class is the same...");
		assert.deepEqual(reading.failures.map((failure) => failure.mechanism.code), ["provider-attempt-limit", "retry-refused-after-effect"], "...and the mechanism is not");
		assert.equal(reading.failures[0]?.mechanism.retryable, true);
		assert.equal(reading.failures[0]?.mechanism.summary, "retry limit exhausted");
		assert.equal(reading.failures[0]?.class, "failure");
	});

	it("counts only the terminals the axis calls failures", () => {
		// The SSM axis owns the classification; the reader must not disagree with it about what a failure is.
		const reading = readFailures([
			received("req-1"),
			terminal("req-1", "completed", { origin: "session", code: "completed", retryable: false }),
			received("req-2"),
			terminal("req-2", "cancelled", { origin: "user", code: "user-cancelled", retryable: false }),
			received("req-3"),
			terminal("req-3", "startup-conflict", { origin: "session", code: "startup-conflict", retryable: false }),
		]);
		assert.equal(reading.requests, 3);
		assert.deepEqual(reading.failures.map((failure) => failure.requestId), ["req-3"], "a completed request and a cancelled one are not failures");
	});

	it("attributes a refusal by request id, and reports the ones that carry none", () => {
		// Position is deliberately not a fallback: issueRequestHostAbort settles a previous request late, so a
		// positional rule would attribute a refusal to the wrong request.
		const reading = readFailures([
			received("req-1"),
			refused("req-1", "fence", "the write is outside the fence"),
			refused(undefined, "scope", "an orphan from before the producer fix"),
			terminal("req-1", "failed", { origin: "convergence", code: "convergence-ready_to_finish", retryable: false }),
		]);
		assert.deepEqual(reading.failures[0]?.refusals, [{ gate: "fence", reason: "the write is outside the fence" }]);
		assert.equal(reading.unrefused, 1, "the unattributable refusal is counted, not guessed at");
		assert.match(reading.corpus.join(" "), /1 refusal\(s\) carry no request id/);
	});

	it("carries the convergence state and the resources the request cost", () => {
		const reading = readFailures([
			received("req-1"),
			record("task.convergence.decision", "req-1", { eventKind: "progress", state: "verifying", acceptanceId: "AC-002" }),
			record("task.convergence.observed", "req-1", { observationOnly: true, toolCalls: 3, providerRounds: 2, elapsedMs: 1200, outputTokens: 40 }),
			terminal("req-1", "failed", { origin: "progress-guard", code: "progress-guard-stalled", retryable: false }),
		]);
		const failure = reading.failures[0]!;
		assert.deepEqual(failure.convergence, { state: "verifying", acceptanceId: "AC-002" });
		assert.equal(failure.resources?.toolCalls, 3);
		assert.equal(failure.resources?.elapsedMs, 1200);
	});

	it("emits a failure whose code it has never seen, rather than dropping it", () => {
		// A new mechanism must reach the reader, or the loop would be blind exactly when something new goes wrong.
		const reading = readFailures([received("req-1"), terminal("req-1", "failed", { origin: "provider", code: "provider-brand-new", retryable: true })]);
		assert.equal(reading.failures.length, 1);
		assert.equal(reading.failures[0]?.mechanism.code, "provider-brand-new");
	});

	it("reports an empty corpus as a finding, not as an empty list", () => {
		const reading = readFailures([received("req-1"), terminal("req-1", "completed", { origin: "session", code: "completed", retryable: false })]);
		assert.deepEqual(reading.failures, []);
		assert.match(reading.corpus.join(" "), /no request ended in a failure class across 1 request/);
		assert.match(reading.corpus.join(" "), /no tool\.observed record/);
		const nothing = readFailures([]);
		assert.equal(nothing.requests, 0);
		assert.ok(nothing.corpus.length > 0, "even an empty ledger says what it does not contain");
	});

	it("states which component a failure points at, and admits when the records do not say", () => {
		assert.equal(componentForFailure({ refusalLabels: ["fence"] }).component, "middleware");
		assert.equal(componentForFailure({ refusalLabels: [], origin: "convergence" }).component, "middleware");
		assert.equal(componentForFailure({ refusalLabels: [], code: "retry-refused-after-effect" }).component, "middleware");
		const budget = componentForFailure({ refusalLabels: [], origin: "model-budget" });
		assert.equal(budget.component, "unattributed");
		assert.match(budget.evidence, /tool-implementation/, "and says why: the map declares src wholesale, which points nowhere");
		const provider = componentForFailure({ refusalLabels: [], origin: "provider" });
		assert.equal(provider.component, "unattributed");
		assert.match(provider.evidence, /outside the harness/);
		assert.equal(componentForFailure({ refusalLabels: [], origin: "unheard-of" }).component, "unattributed");
	});

	it("names the failure component from the refusal that preceded it, not from the terminal alone", () => {
		const reading = readFailures([
			received("req-1"),
			refused("req-1", "technique"),
			terminal("req-1", "failed", { origin: "provider", code: "provider-x", retryable: true }),
		]);
		const failure = reading.failures[0]!;
		assert.equal(failure.component, "middleware", "a refusal is stronger evidence than the provider origin");
		assert.match(failure.componentEvidence, /action-policy\.ts/);
	});

	it("carries what the provider said as well, without inventing a third name for it", () => {
		// The measured case, from the black-box suite: Pi rejected the request in preflight, so the ledger terminal says
		// host-shutdown-preflight while the provider call recorded an error with a status. Both are true, they come from
		// different boundaries, and a merged code would claim a translation nobody performs.
		const reading = readFailures([
			received("req-1"),
			record("provider.request.started", "req-1", { providerCallId: "call-1" }),
			record("provider.request.completed", "req-1", { providerCallId: "call-1", stopReason: "error", usage: { httpStatus: 401 } }),
			terminal("req-1", "startup-failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
		]);
		const failure = reading.failures[0]!;
		assert.equal(failure.mechanism.code, "host-shutdown-preflight", "the terminal keeps Dove own name for what it observed");
		assert.deepEqual(failure.provider, { stopReason: "error", httpStatus: 401 }, "and the provider outcome rides beside it");
		assert.notEqual(failure.provider?.stopReason, failure.mechanism.code, "two vocabularies, never one merged code");
	});

	it("carries a rejected provider call diagnostic", () => {
		const reading = readFailures([
			received("req-1"),
			record("provider.request.rejected", "req-1", { providerCallId: "call-1", diagnostic: "the model refused the request shape" }),
			terminal("req-1", "failed", { origin: "model-budget", code: "model-budget-rejected", retryable: true }),
		]);
		assert.deepEqual(reading.failures[0]?.provider, { stopReason: "rejected", diagnostic: "the model refused the request shape" });
	});

	it("says nothing about the provider when the ledger holds no trouble from it", () => {
		// A healthy provider call on a request that failed elsewhere says nothing about the failure, and reporting it
		// would be worse than reporting nothing.
		const healthy = readFailures([
			received("req-1"),
			record("provider.request.completed", "req-1", { providerCallId: "call-1", stopReason: "end_turn" }),
			terminal("req-1", "failed", { origin: "progress-guard", code: "progress-guard-stalled", retryable: false }),
		]);
		assert.equal(healthy.failures[0]?.provider, undefined);
		const absent = readFailures([received("req-1"), terminal("req-1", "failed", { origin: "provider", code: "provider-x", retryable: true })]);
		assert.equal(absent.failures[0]?.provider, undefined, "and a request with no provider record is unchanged");
	});

	it("matches the provider record by request id, never by position", () => {
		const reading = readFailures([
			received("req-1"),
			record("provider.request.completed", "req-2", { providerCallId: "call-other", stopReason: "error", usage: { httpStatus: 500 } }),
			terminal("req-1", "failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
			received("req-2"),
			record("provider.request.completed", "req-2", { providerCallId: "call-2", stopReason: "end_turn" }),
			terminal("req-2", "failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
		]);
		assert.equal(reading.failures.find((failure) => failure.requestId === "req-1")?.provider, undefined, "the other request error is not borrowed");
		// And the request the error belongs to keeps it, even though a healthy call followed: the last outcome that
		// reported trouble is the one worth attaching, and a later success does not erase what went wrong earlier.
		assert.deepEqual(reading.failures.find((failure) => failure.requestId === "req-2")?.provider, { stopReason: "error", httpStatus: 500 });
	});
});
