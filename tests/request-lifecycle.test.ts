import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	RequestLifecycleController,
	classifyProviderFailure,
} from "../src/core/request-lifecycle.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";

function deterministicIds(): () => string {
	let sequence = 0;
	return () => `id-${++sequence}`;
}

describe("request lifecycle", () => {
	it("represents five automatic attempts with one logical request", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const accepted = lifecycle.acceptSubmission({ text: "fix login", source: "interactive" });
		const request = lifecycle.beginRequest({ prompt: "fix login" });

		assert.equal(request.logicalRequestId, accepted.lease.logicalRequestId);
		assert.equal(request.isNewRequest, true);
		const attempts = Array.from({ length: 5 }, (_, index) => {
			const attempt = lifecycle.startAttempt(index === 0 ? "initial" : "provider-retry");
			lifecycle.finishAttempt(attempt.attemptId, index === 4 ? "completed" : "transient-failure");
			return attempt;
		});

		assert.equal(new Set(attempts.map((attempt) => attempt.logicalRequestId)).size, 1);
		assert.equal(new Set(attempts.map((attempt) => attempt.attemptId)).size, 5);
		assert.deepEqual(attempts.map((attempt) => attempt.number), [1, 2, 3, 4, 5]);
	});

	it("coalesces in-flight redelivery but not the same text after settlement", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const first = lifecycle.acceptSubmission({ text: "hi", source: "rpc", hostSubmissionId: "rpc-7" });
		lifecycle.beginRequest({ prompt: "hi" });
		const redelivered = lifecycle.acceptSubmission({ text: "hi", source: "rpc", hostSubmissionId: "rpc-7" });

		assert.equal(redelivered.coalesced, true);
		assert.equal(redelivered.lease.logicalRequestId, first.lease.logicalRequestId);
		lifecycle.settle("completed");

		const deliberateRepeat = lifecycle.acceptSubmission({ text: "hi", source: "rpc", hostSubmissionId: "rpc-8" });
		assert.equal(deliberateRepeat.coalesced, false);
		assert.notEqual(deliberateRepeat.lease.logicalRequestId, first.lease.logicalRequestId);
	});

	it("associates steering and follow-up deliveries with the active logical request instead of retry attempts", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const original = lifecycle.acceptSubmission({ text: "implement it", source: "interactive" });
		lifecycle.beginRequest({ prompt: "implement it" });
		const steering = lifecycle.acceptSubmission({ text: "stop, use the other file", source: "interactive", streamingBehavior: "steer" });
		const followUp = lifecycle.acceptSubmission({ text: "then run tests", source: "interactive", streamingBehavior: "followUp" });

		assert.equal(steering.reason, "active-delivery");
		assert.equal(followUp.reason, "active-delivery");
		assert.equal(steering.delivery, "steer");
		assert.equal(followUp.delivery, "follow-up");
		assert.equal(steering.newLogicalRequest, false);
		assert.equal(followUp.newLogicalRequest, false);
		assert.equal(steering.lease.logicalRequestId, original.lease.logicalRequestId);
		assert.equal(followUp.lease.logicalRequestId, original.lease.logicalRequestId);
		const settled = lifecycle.settle("completed");
		assert.deepEqual(settled.map((transition) => transition.logicalRequestId), [original.lease.logicalRequestId]);
		const next = lifecycle.acceptSubmission({ text: "new prompt", source: "interactive" });
		assert.equal(lifecycle.beginRequest({ prompt: "new prompt" }).logicalRequestId, next.lease.logicalRequestId);
	});

	it("uses prompt evidence only while an equivalent submission is in flight", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const first = lifecycle.acceptSubmission({ text: "status", source: "extension" });
		lifecycle.beginRequest({ prompt: "status" });
		const deliveryRetry = lifecycle.acceptSubmission({ text: "status", source: "extension" });
		assert.equal(deliveryRetry.coalesced, true);
		assert.equal(deliveryRetry.reason, "in-flight-redelivery");
		assert.equal(deliveryRetry.lease.logicalRequestId, first.lease.logicalRequestId);

		lifecycle.settle("completed");
		const later = lifecycle.acceptSubmission({ text: "status", source: "extension" });
		assert.equal(later.coalesced, false);
	});

	it("allows only bounded transient retries before non-idempotent effects", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds(), maxAttempts: 3 });
		lifecycle.acceptSubmission({ text: "deploy", source: "interactive" });
		lifecycle.beginRequest({ prompt: "deploy" });
		lifecycle.startAttempt("initial");

		assert.deepEqual(classifyProviderFailure({ httpStatus: 429 }), { kind: "transient", reason: "http_429" });
		assert.deepEqual(classifyProviderFailure({ httpStatus: 501 }), { kind: "transient", reason: "http_501" });
		assert.deepEqual(classifyProviderFailure({ httpStatus: 524 }), { kind: "transient", reason: "http_524" });
		assert.deepEqual(classifyProviderFailure({ httpStatus: 401 }), { kind: "terminal", reason: "authorization-denied" });
		assert.deepEqual(classifyProviderFailure({ code: "ECONNRESET" }), { kind: "transient", reason: "ECONNRESET" });
		assert.equal(lifecycle.retryDecision(classifyProviderFailure({ httpStatus: 503 })).retry, true);

		lifecycle.startAttempt("provider-retry");
		lifecycle.startAttempt("provider-retry");
		assert.deepEqual(lifecycle.retryDecision(classifyProviderFailure({ httpStatus: 503 })), { retry: false, reason: "attempt-limit" });

		const second = new RequestLifecycleController({ createId: deterministicIds() });
		second.acceptSubmission({ text: "deploy", source: "interactive" });
		second.beginRequest({ prompt: "deploy" });
		second.startAttempt("initial");
		second.markEffectStarted({ effectId: "tool-1", idempotent: false });
		assert.deepEqual(second.retryDecision(classifyProviderFailure({ httpStatus: 503 })), { retry: false, reason: "non-idempotent-effect" });
	});

	it("never retries cancellation, startup/configuration failures, or authorization denial", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		lifecycle.acceptSubmission({ text: "do it", source: "interactive" });
		lifecycle.beginRequest({ prompt: "do it" });
		lifecycle.startAttempt("initial");

		for (const failure of [
			classifyProviderFailure({ cancelled: true }),
			classifyProviderFailure({ category: "startup-conflict" }),
			classifyProviderFailure({ category: "invalid-configuration" }),
			classifyProviderFailure({ category: "authorization-denied" }),
		]) {
			assert.equal(failure.kind, "terminal");
			assert.equal(lifecycle.retryDecision(failure).retry, false);
		}
	});

	it("creates a fresh synthetic request for hosts that omit the input hook", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const first = lifecycle.beginRequest({ prompt: "hi" });
		const second = lifecycle.beginRequest({ prompt: "hi" });
		assert.notEqual(second.logicalRequestId, first.logicalRequestId);
		assert.equal(lifecycle.terminalHistory().at(-1)?.reason, "superseded");
	});

	it("does not reuse a queued lease after Pi preflight fails before before_agent_start", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const failedPreflight = lifecycle.acceptSubmission({ text: "hi", source: "interactive" });
		const later = lifecycle.acceptSubmission({ text: "hi", source: "interactive" });

		assert.equal(later.coalesced, false);
		assert.notEqual(later.lease.logicalRequestId, failedPreflight.lease.logicalRequestId);
		assert.deepEqual(later.terminalized, [{
			logicalRequestId: failedPreflight.lease.logicalRequestId,
			reason: "startup-failed",
			settledAt: later.terminalized[0]?.settledAt,
		}]);
		assert.equal(lifecycle.beginRequest({ prompt: "hi" }).logicalRequestId, later.lease.logicalRequestId);
	});

	it("closes queued preflight leases on host shutdown without leaking them", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		const queued = lifecycle.acceptSubmission({ text: "hi", source: "interactive" });
		const transitions = lifecycle.terminateAll("cancelled");
		assert.deepEqual(transitions.map((transition) => transition.logicalRequestId), [queued.lease.logicalRequestId]);
		assert.equal(transitions[0]?.reason, "startup-failed");
		assert.equal(transitions[0]?.detail, "host-shutdown-preflight");
		assert.equal(lifecycle.activeLease(), undefined);
	});

	it("preserves structured policy terminal details separately from cancellation", () => {
		const lifecycle = new RequestLifecycleController({ createId: deterministicIds() });
		lifecycle.acceptSubmission({ text: "deploy", source: "interactive" });
		lifecycle.beginRequest({ prompt: "deploy" });
		const [terminal] = lifecycle.settle("authorization-denied", { detail: "http_401", policyAbort: true });
		assert.equal(terminal?.reason, "authorization-denied");
		assert.equal(terminal?.detail, "http_401");
		assert.equal(terminal?.policyAbort, true);
	});

	it("persists additive logical, attempt, and terminal ledger records", async () => {
		const directory = await mkdtemp(join(tmpdir(), "dove-lifecycle-ledger-"));
		try {
			const ledger = new ExecutionLedger(join(directory, "execution.jsonl"));
			await ledger.appendRequestReceived({ taskId: "task", stepId: "request:req-1", mode: "standard", requestId: "req-1", sessionId: "session-1", source: "rpc", delivery: "initial" });
			for (let number = 1; number <= 5; number++) {
				await ledger.appendRequestAttemptStarted({ taskId: "task", stepId: "request:req-1", mode: "standard", requestId: "req-1", sessionId: "session-1", attemptId: `attempt-${number}`, number, trigger: number === 1 ? "initial" : "provider-retry" });
				await ledger.appendRequestAttemptCompleted({ taskId: "task", stepId: "request:req-1", mode: "standard", requestId: "req-1", sessionId: "session-1", attemptId: `attempt-${number}`, number, outcome: number === 5 ? "completed" : "transient-failure" });
			}
			await ledger.appendRequestTerminal({ taskId: "task", stepId: "request:req-1", mode: "standard", requestId: "req-1", sessionId: "session-1", reason: "failed", detail: "attempt-limit", policyAbort: true });

			const records = await ledger.read();
			assert.equal(records.filter((record) => record.kind === "request.received").length, 1);
			assert.equal(records.filter((record) => record.kind === "request.attempt.started").length, 5);
			assert.equal(records.filter((record) => record.kind === "request.attempt.completed").length, 5);
			assert.equal(records.filter((record) => record.kind === "request.terminal").length, 1);
			assert.deepEqual(records.find((record) => record.kind === "request.terminal")?.details, { logicalRequestId: "req-1", reason: "failed", detail: "attempt-limit", policyAbort: true });
			assert.deepEqual(
				records.filter((record) => record.kind === "request.attempt.started").map((record) => record.correlation?.attemptId),
				["attempt-1", "attempt-2", "attempt-3", "attempt-4", "attempt-5"],
			);
			assert.ok(records.every((record) => record.correlation?.requestId === "req-1"));
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
