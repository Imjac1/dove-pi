import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	computeAcceptanceRevision,
	decodeTaskConvergenceEvent,
	decodeTaskConvergenceSnapshot,
	reduceTaskConvergence,
	replayTaskConvergence,
	type TaskConvergenceSnapshot,
} from "../src/core/task-convergence.ts";

interface TraceStep {
	readonly event: unknown;
	readonly expected: unknown;
}

interface TraceFixture {
	readonly schemaVersion: number;
	readonly resourcePolicy: string;
	readonly frozenContract: {
		readonly taskId: string;
		readonly acceptanceRevision: string;
		readonly criteria: readonly { readonly id: string; readonly text: string }[];
	};
	readonly traces: readonly { readonly name: string; readonly steps: readonly TraceStep[] }[];
}

const fixture = JSON.parse(readFileSync(new URL("./fixtures/task-convergence-traces.json", import.meta.url), "utf8")) as TraceFixture;

describe("task convergence shared trace contract", () => {
	it("freezes the reviewed AC-001 through AC-010 contract", () => {
		assert.equal(fixture.schemaVersion, 1);
		assert.equal(fixture.resourcePolicy, "observation_only");
		assert.deepEqual(fixture.frozenContract.criteria.map((criterion) => criterion.id), [
			"AC-001", "AC-002", "AC-003", "AC-004", "AC-005",
			"AC-006", "AC-007", "AC-008", "AC-009", "AC-010",
		]);
		assert.equal(computeAcceptanceRevision(fixture.frozenContract.criteria), fixture.frozenContract.acceptanceRevision);
	});

	for (const trace of fixture.traces) {
		it(`replays ${trace.name} with the expected state after every event`, () => {
			let snapshot: TaskConvergenceSnapshot | undefined;
			for (const [index, step] of trace.steps.entries()) {
				snapshot = reduceTaskConvergence(snapshot, step.event);
				assert.deepEqual(projectSnapshot(snapshot), step.expected, `step ${index + 1}`);
			}
			const replayed = replayTaskConvergence(trace.steps.map((step) => step.event));
			assert.deepEqual(replayed, snapshot);
		});
	}
});

describe("task convergence reducer invariants", () => {
	it("rejects unknown acceptance IDs before changing the snapshot", () => {
		const snapshot = freezeSingleCriterion("unknown-id");
		const before = structuredClone(snapshot);
		assert.throws(() => reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "acceptance.started",
			acceptanceId: "AC-999",
		}), /Unknown acceptance ID: AC-999/);
		assert.deepEqual(snapshot, before);
	});

	it("keeps resource observations outside semantic decisions", () => {
		let snapshot = freezeSingleCriterion("resource-only");
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "task.progress_reviewed",
			acceptanceId: "AC-001",
			nextAction: "Use the existing evidence.",
		});
		const semanticBefore = projectSemanticState(snapshot);
		const observed = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "request.observed",
			acceptanceId: "AC-001",
			resources: {
				toolCalls: Number.MAX_SAFE_INTEGER,
				providerRounds: Number.MAX_SAFE_INTEGER,
				elapsedMs: Number.MAX_SAFE_INTEGER,
			},
		});
		assert.deepEqual(projectSemanticState(observed), semanticBefore);
		assert.equal(observed.observedResources.toolCalls, Number.MAX_SAFE_INTEGER);
	});

	it("treats regression findings as blockers and reaches finish only after resolution", () => {
		let snapshot = freezeSingleCriterion("regression");
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "finding.recorded",
			acceptanceId: "AC-001",
			finding: { id: "regression-1", kind: "regression", summary: "Current work broke the accepted behavior.", evidenceRefs: ["evidence:regression"] },
		});
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "acceptance.passed", acceptanceId: "AC-001", evidenceRefs: ["evidence:pass"] });
		assert.equal(snapshot.state, "working");
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "finding.resolved", acceptanceId: "AC-001", findingId: "regression-1", evidenceRefs: ["evidence:fixed"] });
		assert.equal(snapshot.state, "ready_to_finish");
		assert.throws(() => reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "planned_step.completed", acceptanceId: "AC-001", stepId: "step-after-finish" }), /after ready_to_finish/);
	});

	it("amends an open finding with late evidence without creating a duplicate", () => {
		let snapshot = freezeSingleCriterion("finding-amend");
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "finding.recorded",
			acceptanceId: "AC-001",
			finding: { id: "blocker-1", kind: "blocking", summary: "Verification is blocked.", evidenceRefs: [] },
		});
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "finding.updated",
			acceptanceId: "AC-001",
			findingId: "blocker-1",
			evidenceRefs: ["evidence:blocker"],
			nextAction: "Create a follow-up task.",
		});
		assert.deepEqual(snapshot.findings[0], {
			id: "blocker-1",
			kind: "blocking",
			discoveredFromAcceptanceId: "AC-001",
			summary: "Verification is blocked.",
			open: true,
			evidenceRefs: ["evidence:blocker"],
			nextAction: "Create a follow-up task.",
		});
		assert.throws(() => reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "finding.updated", acceptanceId: "AC-002", findingId: "blocker-1", evidenceRefs: ["evidence:wrong"] }), /Unknown acceptance ID/);
		assert.throws(() => decodeTaskConvergenceEvent({ schemaVersion: 1, kind: "finding.updated", acceptanceId: "AC-001", findingId: "blocker-1" }), /requires evidenceRefs, summary, or nextAction/);
	});

	it("requires a concrete unblock condition and restores an external block", () => {
		let snapshot = freezeSingleCriterion("external-block");
		assert.throws(() => decodeTaskConvergenceEvent({ schemaVersion: 1, kind: "task.blocked", acceptanceId: "AC-001", nextAction: "Retry." }), /unblockCondition/);
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "task.blocked",
			acceptanceId: "AC-001",
			nextAction: "Retry the external verification.",
			unblockCondition: "The release service becomes available.",
		});
		assert.equal(snapshot.state, "blocked");
		assert.equal(snapshot.checkpoint?.unblockCondition, "The release service becomes available.");
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "task.resumed", acceptanceId: "AC-001", acceptanceRevision: snapshot.acceptanceRevision });
		assert.equal(snapshot.state, "working");
		assert.equal(snapshot.checkpoint, undefined);
	});

	it("decodes its own immutable snapshot and rejects malformed acceptance revisions", () => {
		const snapshot = freezeSingleCriterion("decode-roundtrip");
		assert.deepEqual(decodeTaskConvergenceSnapshot(JSON.parse(JSON.stringify(snapshot))), snapshot);
		assert.throws(() => decodeTaskConvergenceSnapshot({ ...snapshot, acceptanceRevision: "0".repeat(64) }), /does not match criteria/);
		assert.ok(Object.isFrozen(snapshot));
		assert.ok(Object.isFrozen(snapshot.criteria));
		assert.ok(Object.isFrozen(snapshot.criteria[0]));
	});

	it("accepts existing evidence URIs and binds planned-step progress to an acceptance ID", () => {
		const criteria = [
			{ id: "AC-001", text: "The first accepted behavior is observed." },
			{ id: "AC-002", text: "The second accepted behavior is observed." },
		] as const;
		let snapshot = reduceTaskConvergence(undefined, {
			schemaVersion: 1,
			kind: "acceptance.frozen",
			taskId: "evidence-and-steps",
			criteria,
			acceptanceRevision: computeAcceptanceRevision(criteria),
		});
		snapshot = reduceTaskConvergence(snapshot, {
			schemaVersion: 1,
			kind: "acceptance.evidence_attached",
			acceptanceId: "AC-001",
			evidenceRef: "evidence://safe/result.json",
		});
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "planned_step.completed", acceptanceId: "AC-001", stepId: "focused-test" });
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "task.progress_reviewed", acceptanceId: "AC-001", nextAction: "Continue AC-002." });
		snapshot = reduceTaskConvergence(snapshot, { schemaVersion: 1, kind: "planned_step.completed", acceptanceId: "AC-002", stepId: "focused-test" });
		assert.deepEqual(snapshot.completedStepIds, ["AC-001:focused-test", "AC-002:focused-test"]);
		assert.equal(snapshot.meaningfulProgressSinceReview, true);
	});
});

function freezeSingleCriterion(taskId: string): TaskConvergenceSnapshot {
	const criteria = [{ id: "AC-001", text: "The accepted behavior is observed." }] as const;
	return reduceTaskConvergence(undefined, {
		schemaVersion: 1,
		kind: "acceptance.frozen",
		taskId,
		criteria,
		acceptanceRevision: computeAcceptanceRevision(criteria),
	});
}

function projectSnapshot(snapshot: TaskConvergenceSnapshot): unknown {
	const openFindings = snapshot.findings.filter((finding) => finding.open).map(({ id, kind }) => ({ id, kind }));
	return {
		revision: snapshot.revision,
		state: snapshot.state,
		criteria: Object.fromEntries(snapshot.criteria.map((criterion) => [criterion.id, criterion.status])),
		openFindings,
		consecutiveNoProgress: snapshot.consecutiveNoProgress,
		meaningfulProgressSinceReview: snapshot.meaningfulProgressSinceReview,
		...(snapshot.correctiveAction ? { correctiveAction: snapshot.correctiveAction } : {}),
		...(snapshot.checkpoint ? {
			checkpoint: {
				nextAcceptanceId: snapshot.checkpoint.nextAcceptanceId,
				nextAction: snapshot.checkpoint.nextAction,
				openFindingIds: snapshot.checkpoint.openFindingIds,
				...(snapshot.checkpoint.unblockCondition ? { unblockCondition: snapshot.checkpoint.unblockCondition } : {}),
			},
		} : {}),
		observedResources: snapshot.observedResources,
	};
}

function projectSemanticState(snapshot: TaskConvergenceSnapshot): unknown {
	return {
		state: snapshot.state,
		criteria: snapshot.criteria,
		findings: snapshot.findings,
		completedStepIds: snapshot.completedStepIds,
		consecutiveNoProgress: snapshot.consecutiveNoProgress,
		meaningfulProgressSinceReview: snapshot.meaningfulProgressSinceReview,
		checkpoint: snapshot.checkpoint,
		correctiveAction: snapshot.correctiveAction,
	};
}
