import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { judgeRung, runVerificationLadder, type RungEvidence } from "../src/core/verification-ladder.ts";

function rung(name: string, cost: number, evidence: RungEvidence | undefined) {
	return { name, cost, run: async () => evidence };
}

describe("the verification ladder", () => {
	it("stops at the first rung that settles, and says which one it was", async () => {
		const verdict = await runVerificationLadder([
			rung("expensive", 30, { exitStatus: 0, detail: "third" }),
			rung("cheap", 1, { exitStatus: 1, detail: "first" }),
			rung("middle", 10, { exitStatus: 0, detail: "second" }),
		]);
		assert.equal(verdict.outcome, "fail");
		assert.equal(verdict.decidedBy, "cheap", "the cheapest rung ran, and it decided");
		assert.equal(verdict.attempted.length, 1, "the rungs after it were never attempted");
	});

	it("counts a check that did not run as a failure, not as a skip", () => {
		const noStatus = judgeRung("typecheck", { detail: "the command was not started" });
		assert.equal(noStatus.outcome, "fail", "a skipped check that reads as 'nothing wrong' is how the ladder gets weakened");
		assert.match(noStatus.detail, /did not run to a verdict/);
		assert.equal(judgeRung("killed", { exitStatus: null, detail: "terminated by a signal" }).outcome, "fail");
	});

	it("cross-checks the parsed result against the exit status", () => {
		const contradiction = judgeRung("suite", { exitStatus: 0, claimedOutcome: "fail", detail: "fail 3" });
		assert.equal(contradiction.outcome, "fail", "a wrapper that forwards 0 for a failing suite is a failing suite");
		assert.match(contradiction.detail, /exited 0 but its own output reports a failure/);
		assert.equal(judgeRung("suite", { exitStatus: 0, claimedOutcome: "pass", detail: "fail 0" }).outcome, "pass");
		assert.equal(judgeRung("suite", { exitStatus: 0, detail: "no summary line" }).outcome, "pass", "an unparsed claim is not a claim");
	});

	it("returns unscored rather than a default when nothing settles", async () => {
		assert.equal((await runVerificationLadder([])).outcome, "unscored");
		const skipped = await runVerificationLadder([rung("not-applicable", 1, undefined)]);
		assert.equal(skipped.outcome, "unscored", "a rung that does not apply is not a verdict");
		assert.equal(skipped.decidedBy, undefined);
		assert.equal(skipped.attempted[0]?.outcome, "unscored");
	});

	it("treats a rung that could not run as a failed check", async () => {
		const verdict = await runVerificationLadder([
			{
				name: "broken",
				cost: 1,
				run: async () => {
					throw new Error("no such command");
				},
			},
		]);
		assert.equal(verdict.outcome, "fail");
		assert.match(verdict.attempted[0]?.detail ?? "", /could not run: no such command/);
	});
});
