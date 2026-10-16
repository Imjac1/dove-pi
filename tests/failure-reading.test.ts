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

	it("carries the reference a manifest can cite, taken from the record", () => {
		// The resolver matches ledger:<stepId> by equality, so the reference has to be the record own step id rather than a
		// string rebuilt from the naming convention - which is the writer rule, not a contract a reader should copy.
		const terminalRecord: ExecutionRecord = { taskId: "t", stepId: "request:req-real", kind: "request.terminal", timestamp: AT, mode: "standard", correlation: { requestId: "req-real" }, details: { logicalRequestId: "req-real", reason: "startup-failed", terminal: { origin: "session", code: "host-shutdown-preflight", retryable: false } } };
		const reading = readFailures([received("req-real"), terminalRecord]);
		assert.equal(reading.failures[0]?.evidenceRef, "ledger:request:req-real", "the reference is the record step id with the prefix the resolver looks for");
	});

	it("carries the behaviours a fix must not regress, from the component the evidence points at", () => {
		// Self-Harness requires this of a failure record: a proposal must not regress behaviours that were passing. The
		// suites come from the declaration, so what the record carries is what the harness states - not a guess.
		const verifiedBy = { middleware: ["tests/action-policy.test.ts"] } as const;
		const reading = readFailures([received("req-1"), refused("req-1", "fence"), terminal("req-1", "failed", { origin: "session", code: "host-shutdown-preflight", retryable: false })], { verifiedBy });
		const failure = reading.failures[0]!;
		assert.equal(failure.component, "middleware", "a refusal points at the policy");
		assert.deepEqual(failure.preserve, ["tests/action-policy.test.ts"], "and the suites that verify it ride with the record");
	});

	it("carries none when the evidence points at no component, rather than inventing a list", () => {
		const verifiedBy = { middleware: ["tests/action-policy.test.ts"] } as const;
		const reading = readFailures([received("req-1"), terminal("req-1", "failed", { origin: "provider", code: "provider-x", retryable: true })], { verifiedBy });
		assert.deepEqual(reading.failures[0]?.preserve, [], "no component named, so nothing to preserve is named either");
		assert.match(String(reading.failures[0]?.componentEvidence ?? ""), /outside the harness/, "and the record still says why: a provider outcome is not one of our components");
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

	it("carries the classification of a provider failure, not only its stop reason", () => {
		// **The other half of the reader for `failureKind`/`failureReason`.** The adapter always classified the failure to
		// decide whether it could retry, and the ledger used to keep only `stopReason: "error"` - so a reading could say a
		// provider call failed and not why, which is the one question an operator asks of it. The classification rides beside
		// the provider's own account rather than inside it: the status is what the boundary saw, the kind is what Dove made
		// of it.
		const reading = readFailures([
			received("req-1"),
			record("provider.request.started", "req-1", { providerCallId: "call-1" }),
			record("provider.request.completed", "req-1", { providerCallId: "call-1", stopReason: "error", usage: { input: 0 }, failureKind: "transient", failureReason: "http_429" }),
			terminal("req-1", "failed", { origin: "provider", code: "provider-attempt-limit", retryable: true }),
		]);
		assert.deepEqual(
			reading.failures[0]?.provider,
			{ stopReason: "error", failureKind: "transient", failureReason: "http_429" },
			"the cause the adapter recorded reaches the reading",
		);
	});

	it("carries the provider's own word and the status beside Dove's classification of them", () => {
		// **The reader's half of the evidence, and the half that decides whether a classification can be argued with.**
		// Measured 2026-10-16: an unpaid account reached the record as `transient/reviewed-provider-message`, and the
		// reading had no field the provider's `insufficient_balance` or its `402` could have appeared in - so a reader
		// who suspected the classification had nothing to suspect it *with*. `providerCode` sits beside the provider's
		// own status rather than inside Dove's inference, because it is a fact the provider stated.
		const reading = readFailures([
			received("req-1"),
			record("provider.request.started", "req-1", { providerCallId: "call-1" }),
			record("provider.request.completed", "req-1", { providerCallId: "call-1", stopReason: "error", usage: { input: 0 }, failureKind: "terminal", failureReason: "account-unpaid", providerCode: "insufficient_balance", httpStatus: 402 }),
			terminal("req-1", "account-unpaid", { origin: "provider", code: "provider-account-unpaid", retryable: false }),
		]);
		assert.deepEqual(
			reading.failures[0]?.provider,
			{ stopReason: "error", httpStatus: 402, failureKind: "terminal", failureReason: "account-unpaid", providerCode: "insufficient_balance" },
			"the provider's word and the status it arrived with reach the reading beside the classification they produced",
		);
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

	it("declares what it cannot see when the cause is upstream of every recording hook", () => {
		// The first real failure the corpus ever held looked like this: two records, no provider record at all, and a
		// terminal naming what Dove observed rather than what rejected the request. A reader has to be told that.
		const reading = readFailures([
			received("req-1"),
			terminal("req-1", "startup-failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
		]);
		const failure = reading.failures[0]!;
		assert.match(String(failure.unseen ?? ""), /upstream of every recording hook/);
		assert.match(String(failure.unseen ?? ""), /cannot name the cause/);
		assert.doesNotMatch(String(failure.unseen ?? ""), /authorization|provider-authorization-denied/, "the ledger does not hold that name, so the record must not claim it");
		assert.equal(failure.mechanism.code, "host-shutdown-preflight", "and the mechanism stays what Dove observed");
	});

	it("declares no limit when the cause is on the record", () => {
		// Both halves of the rule matter. A preflight closure whose request also has a provider outcome has its cause on
		// the record, so a limit there would be a false absence - which is worse than no note at all.
		const withProvider = readFailures([
			received("req-1"),
			record("provider.request.completed", "req-1", { providerCallId: "call-1", stopReason: "error", usage: { httpStatus: 401 } }),
			terminal("req-1", "startup-failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
		]);
		assert.equal(withProvider.failures[0]?.unseen, undefined);
		assert.deepEqual(withProvider.failures[0]?.provider, { stopReason: "error", httpStatus: 401 });
	});

	it("declares no limit for a failure that reached the loop", () => {
		const reached = readFailures([
			received("req-1"),
			terminal("req-1", "failed", { origin: "provider", code: "provider-attempt-limit", retryable: true }),
			terminal("req-2", "failed", { origin: "convergence", code: "convergence-ready_to_finish", retryable: false }),
		]);
		assert.equal(reached.failures[0]?.unseen, undefined, "a provider failure is on the record under its own name");
		assert.equal(reached.failures[1]?.unseen, undefined, "and a convergence refusal is a different boundary altogether");
	});

	it("carries a client account when the caller supplies one, and never merges it into the mechanism", () => {
		// The account is keyed by request id, so it can only land on the failure whose request it describes - and the
		// source is carried because this one came from a regex over an error text, not from a recorded status.
		const accounts = new Map([["req-1", { code: "provider-authorization-denied", source: "classified from the provider error text by the black-box client" }]]);
		const reading = readFailures([received("req-1"), terminal("req-1", "startup-failed", { origin: "session", code: "host-shutdown-preflight", retryable: false })], { clientAccounts: accounts });
		const failure = reading.failures[0]!;
		assert.deepEqual(failure.client, { code: "provider-authorization-denied", source: "classified from the provider error text by the black-box client" });
		assert.equal(failure.mechanism.code, "host-shutdown-preflight", "the mechanism stays what Dove observed: the two names are not merged");
		assert.match(String(failure.unseen ?? ""), /cannot name the cause/, "and the limit still says the ledger could not see it");
	});

	it("leaves the other failures alone when a ledger holds more than one", () => {
		const accounts = new Map([["req-2", { code: "provider-authorization-denied", source: "classified by the client" }]]);
		const reading = readFailures([
			received("req-1"),
			terminal("req-1", "failed", { origin: "provider", code: "provider-attempt-limit", retryable: true }),
			received("req-2"),
			terminal("req-2", "startup-failed", { origin: "session", code: "host-shutdown-preflight", retryable: false }),
		], { clientAccounts: accounts });
		assert.equal(reading.failures.find((failure) => failure.requestId === "req-1")?.client, undefined, "the account describes one request and does not smear across the ledger");
		assert.equal(reading.failures.find((failure) => failure.requestId === "req-2")?.client?.code, "provider-authorization-denied");
	});
});
