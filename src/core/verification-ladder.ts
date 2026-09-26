/**
 * The verification ladder (design 5.6).
 *
 * **Its premise, stated rather than implied.** A check's value as *evidence* is not the same thing as its verdict. A
 * check that never ran, a check whose own output contradicts its exit status, and a check that finished cleanly are
 * three different facts, and a runner that reports "failed" for all three throws away the one distinction that
 * decides what to do next.
 *
 * Three rules, each because of a specific way a check can lie:
 *
 * 1. **A check that did not run is a failure, not a skip.** A skipped check that reads as "nothing wrong" is how the
 *    agent weakens the ladder it is being measured by.
 * 2. **Positive evidence that it ran is required**: an exit status. Without one there is no evidence the process
 *    existed, and absence of evidence must not read as clean.
 * 3. **The parsed result is cross-checked against the exit status.** A command that exits 0 while its own output
 *    reports a failure is a failure - the exit status is what a wrapper usually forwards, and the output is what
 *    actually happened.
 *
 * Cheap rungs first, and the ladder **stops at the first rung that settles**. If nothing settles, the answer is
 * **`unscored`**, never a default: a default here is a verdict nobody reached, which is the failure mode this
 * exists to avoid.
 *
 * **No model in any rung.** A rung is a command's result or a comparison, and a rung that needs a model's opinion is
 * not evidence - it is another claim.
 *
 * **What is not built here:** rung three of the design's set - comparison against a *second implementation*
 * (roundtrip, idempotence). Nothing in this repository currently has a second implementation to compare against, and
 * writing one would be manufacturing a test double rather than adding a rung. Stated rather than implied.
 */
export type RungOutcome = "pass" | "fail" | "unscored";

export interface RungEvidence {
	/** What the check's own output claimed, where it can be parsed. */
	readonly claimedOutcome?: "pass" | "fail";
	/** The exit status the runner observed. Absent, or `null` for a signal, means it did not run to a verdict. */
	readonly exitStatus?: number | null;
	readonly detail: string;
}

export interface VerificationRung {
	readonly name: string;
	/** Lower runs first. Declared, so the order is a decision rather than an accident of array order. */
	readonly cost: number;
	/** `undefined` means this rung does not apply here - which is not the same as a rung that failed. */
	run(): Promise<RungEvidence | undefined>;
}

export interface RungVerdict {
	readonly rung: string;
	readonly outcome: RungOutcome;
	readonly detail: string;
}

export interface LadderVerdict {
	readonly outcome: RungOutcome;
	/** Which rung settled it. Absent when nothing did, which is what `unscored` means. */
	readonly decidedBy?: string;
	readonly attempted: readonly RungVerdict[];
}

/** The three rules, in one place, so a rung cannot be judged two ways. */
export function judgeRung(name: string, evidence: RungEvidence): RungVerdict {
	if (evidence.exitStatus === undefined || evidence.exitStatus === null) {
		return { rung: name, outcome: "fail", detail: "the check did not run to a verdict (" + evidence.detail + ")" };
	}
	if (evidence.exitStatus !== 0) return { rung: name, outcome: "fail", detail: evidence.detail };
	if (evidence.claimedOutcome === "fail") {
		return { rung: name, outcome: "fail", detail: "the check exited 0 but its own output reports a failure: " + evidence.detail };
	}
	return { rung: name, outcome: "pass", detail: evidence.detail };
}

export async function runVerificationLadder(rungs: readonly VerificationRung[]): Promise<LadderVerdict> {
	const attempted: RungVerdict[] = [];
	for (const rung of [...rungs].sort((left, right) => left.cost - right.cost)) {
		let evidence: RungEvidence | undefined;
		try {
			evidence = await rung.run();
		} catch (error) {
			// A rung that could not run is a failed check, not a missing one - rule 1 applied to the failure to start.
			attempted.push({ rung: rung.name, outcome: "fail", detail: "the check could not run: " + (error instanceof Error ? error.message : String(error)) });
			return { outcome: "fail", decidedBy: rung.name, attempted };
		}
		if (evidence === undefined) {
			attempted.push({ rung: rung.name, outcome: "unscored", detail: "this rung does not apply here" });
			continue;
		}
		const verdict = judgeRung(rung.name, evidence);
		attempted.push(verdict);
		return { outcome: verdict.outcome, decidedBy: rung.name, attempted };
	}
	return { outcome: "unscored", attempted };
}
