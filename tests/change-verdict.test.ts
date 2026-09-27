import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	decidableChanges,
	parsePredictedMovement,
	verdictFor,
	TaskConvergenceValidationError,
	type ChangeObservables,
	type PredictedMovement,
	type TaskChange,
	type TaskConvergenceSnapshot,
} from "../src/core/task-convergence.ts";

function snapshot(overrides: Partial<TaskConvergenceSnapshot> = {}): TaskConvergenceSnapshot {
	return {
		schemaVersion: 1,
		taskId: "task-1",
		revision: AT_REVISION + 1,
		acceptanceRevision: "acc-1",
		state: "working",
		criteria: [{ id: "AC-003", text: "the boundary reads the target", status: "passed", evidenceRefs: [] }],
		findings: [],
		completedStepIds: [],
		consecutiveNoProgress: 0,
		meaningfulProgressSinceReview: true,
		observedResources: { toolCalls: 0, providerRounds: 0, elapsedMs: 0 },
		...overrides,
	};
}

describe("a verdict is decided once, at the round boundary that makes it readable", () => {
	it("returns the change whose next read has happened, with the revision frozen against it", () => {
		const decided = decidableChanges(snapshot({ changes: [change()] }), read(), new Set());
		assert.deepEqual(decided, [{ changeId: "chg-1", verdict: "confirmed", observed: ["criterion-status:AC-003: pending -> passed (predicted)"], revision: AT_REVISION + 1 }]);
	});

	it("returns nothing while the round has not happened", () => {
		// A verdict of `pending` means the next read has not occurred; writing "not yet" on every round for every change
		// would turn the record into noise.
		assert.deepEqual(decidableChanges(snapshot({ changes: [change()] }), read({ currentRevision: AT_REVISION }), new Set()), []);
	});

	it("returns nothing for a change that already carries a decision", () => {
		// The caller supplies the decided set from the ledger; a process-local set would re-decide after a restart.
		assert.deepEqual(decidableChanges(snapshot({ changes: [change()] }), read(), new Set(["chg-1"])), []);
	});

	it("records a contradicted prediction as readily as a confirmed one", () => {
		// The case that matters most: an edit that did not do what it predicted is the one the loop has to learn from.
		const unmet = decidableChanges(snapshot({ changes: [change()] }), read({ criterionStatus: { "AC-003": "in_progress" } }), new Set());
		assert.equal(unmet[0]?.verdict, "contradicted");
		assert.match(unmet[0]?.observed.join(" | ") ?? "", /prediction not met/);
	});

	it("returns unobserved rather than skipping it, because it is a real answer", () => {
		// A prediction naming something the record does not carry is a decision that reads `unobserved`, which is not the
		// same as no decision at all.
		const unreadable = decidableChanges(snapshot({ changes: [change()] }), read({ criterionStatus: {} }), new Set());
		assert.equal(unreadable[0]?.verdict, "unobserved");
		assert.match(unreadable[0]?.observed.join(" | ") ?? "", /unreadable/);
	});

	it("decides each change independently, and says nothing about a snapshot with none", () => {
		const decided = decidableChanges(snapshot({ changes: [change(), change({ id: "chg-2", baseline: { "criterion-status:AC-003": "passed" } })] }), read(), new Set(["chg-1"]));
		assert.deepEqual(decided.map((entry) => entry.changeId), ["chg-2"], "the decided one is skipped and the other is not");
		assert.deepEqual(decidableChanges(snapshot(), read(), new Set()), [], "no changes, no decisions");
	});
});


/**
 * The pure half of the change manifest: what a prediction may name, and what verdict it earns.
 *
 * Every case here is a case the host tests would otherwise reach only through a session, which is why this module
 * is pure. The rule it pins is AHE's: compare the movement against **observed movements**, not against the existence
 * of a record - "rationale-driven self-justification" is what that design exists to replace.
 */

const AT_REVISION = 4;

/** The same shape `tests/work-mode.test.ts` uses: `assert.throws` returns nothing to inspect. */
function expectRefusal(run: () => unknown): TaskConvergenceValidationError {
	try {
		run();
	} catch (error) {
		assert.ok(error instanceof TaskConvergenceValidationError, "expected a refusal, got " + String(error));
		return error;
	}
	throw new Error("expected a refusal, but nothing was thrown");
}

function change(overrides: Partial<TaskChange> = {}): TaskChange {
	return {
		id: "chg-1",
		surface: "tool-implementation",
		failureEvidenceRef: "ledger:tool:suite-run",
		rootCause: "the boundary read the tool name where the target lives in the arguments",
		fix: "read the target argument before deciding",
		predictedFixes: [{ observable: "criterion-status", subject: "AC-003", to: "passed" }],
		predictedRegressions: [],
		baseline: { "criterion-status:AC-003": "pending" },
		recordedAtRevision: AT_REVISION,
		...overrides,
	};
}

function read(overrides: Partial<ChangeObservables> = {}): ChangeObservables {
	return {
		currentRevision: AT_REVISION + 1,
		criterionStatus: { "AC-003": "passed" },
		verificationState: {},
		gateRefusals: {},
		...overrides,
	};
}

describe("a predicted movement is parsed into a nameable movement, or refused by naming the set", () => {
	it("accepts the three shapes, one per observable", () => {
		assert.deepEqual(parsePredictedMovement("criterion-status:AC-003=passed"), { observable: "criterion-status", subject: "AC-003", to: "passed" });
		assert.deepEqual(parsePredictedMovement("verification-state:AC-008=verified"), { observable: "verification-state", subject: "AC-008", to: "verified" });
		assert.deepEqual(parsePredictedMovement("gate-refusals:fence=down"), { observable: "gate-refusals", subject: "fence", direction: "down" });
	});

	it("refuses an unknown observable and names every observable there is", () => {
		const error = expectRefusal(() => parsePredictedMovement("vibes:AC-003=better"));
		assert.match(error.message, /criterion-status, verification-state, gate-refusals/);
	});

	it("refuses a subject outside the closed set, and says why a composite is not one", () => {
		// The ledger can record deny+scope+registered+ask, so the temptation is to predict that string. It is not a
		// subject: the read splits it, so a prediction naming it could never be met.
		const error = expectRefusal(() => parsePredictedMovement("gate-refusals:deny+scope=down"));
		assert.match(error.message, /deny, scope, registered, limit, conformance, sandbox, technique, fence, ask, effect-claim/);
		assert.match(error.message, /counts its atoms/);
	});

	it("refuses a target outside the vocabulary of its own observable", () => {
		expectRefusal(() => parsePredictedMovement("criterion-status:AC-003=verified"));
		expectRefusal(() => parsePredictedMovement("gate-refusals:fence=sideways"));
		expectRefusal(() => parsePredictedMovement("criterion-status:not-an-id=passed"));
		expectRefusal(() => parsePredictedMovement("criterion-status:AC-003"));
	});
});

describe("the verdict a manifest earns", () => {
	it("is pending until something has happened since the manifest, instead of comparing a baseline with itself", () => {
		// Without a boundary the first read after recording reports contradicted, which would teach the loop that
		// every change fails - worse than reporting nothing. The boundary is the revision of the read itself: any
		// event after the manifest's own revision is enough for the comparison to mean something.
		assert.equal(verdictFor(change(), read({ currentRevision: AT_REVISION })).verdict, "pending");
		assert.equal(verdictFor(change(), read()).verdict, "confirmed", "and the same manifest is decidable once anything lands");
	});

	it("confirms a state movement that happened between the baseline and the read", () => {
		const movement: PredictedMovement = { observable: "verification-state", subject: "AC-008", to: "verified" };
		const confirmed = verdictFor(
			change({ predictedFixes: [movement], baseline: { "verification-state:AC-008": "unresolved_evidence" } }),
			read({ verificationState: { "AC-008": "verified" } }),
		);
		assert.equal(confirmed.verdict, "confirmed");
		assert.match(confirmed.observed.join(" | "), /unresolved_evidence -> verified \(predicted\)/);
	});

	it("confirms a count that moved the predicted way, and contradicts one that moved the other way", () => {
		const down: PredictedMovement = { observable: "gate-refusals", subject: "fence", direction: "down" };
		const falling = change({ predictedFixes: [down], baseline: { "gate-refusals:fence": 7 } });
		assert.equal(verdictFor(falling, read({ gateRefusals: { fence: 2 } })).verdict, "confirmed");
		assert.equal(verdictFor(falling, read({ gateRefusals: { fence: 7 } })).verdict, "contradicted", "a count that did not move is not evidence");
		assert.equal(verdictFor(falling, read({ gateRefusals: { fence: 9 } })).verdict, "contradicted", "and one that moved the wrong way is evidence against");
	});

	it("refuses to count a movement that had already happened, because that is not evidence for the change", () => {
		const already = change({ baseline: { "criterion-status:AC-003": "passed" } });
		const result = verdictFor(already, read());
		assert.equal(result.verdict, "contradicted");
		assert.match(result.observed.join(" | "), /prediction not met/);
	});

	it("reports unobserved for an observable it cannot read, and never confirms it", () => {
		assert.equal(verdictFor(change(), read({ criterionStatus: {} })).verdict, "unobserved");
		assert.equal(verdictFor(change({ baseline: {} }), read()).verdict, "unobserved", "a baseline the harness never read is not a baseline of zero");
	});

	it("lets a contradicted prediction outrank an unreadable one, so a miss is never hidden by a gap", () => {
		const two: PredictedMovement[] = [
			{ observable: "criterion-status", subject: "AC-003", to: "passed" },
			{ observable: "criterion-status", subject: "AC-004", to: "passed" },
		];
		const result = verdictFor(
			change({ predictedFixes: two, baseline: { "criterion-status:AC-003": "pending", "criterion-status:AC-004": "pending" } }),
			read({ criterionStatus: { "AC-003": "pending" } }),
		);
		assert.equal(result.verdict, "contradicted");
	});
});
