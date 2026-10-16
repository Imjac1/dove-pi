import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

/** Every `.ts` under a directory, at any depth. */
function testFilesIn(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) found.push(...testFilesIn(path));
		else if (entry.name.endsWith(".ts")) found.push(path);
	}
	return found;
}

describe("the suite's own timing discipline", () => {
	it("holds a state instead of sleeping into it, so no case waits on a duration", () => {
		// **The form this forbids, and what the mechanism actually holds.** `await new Promise((resolve) => setTimeout(resolve, N))`
		// inside a test is a fixed duration standing where a state should be. Measured 2026-10-15: the batch case's 600 ms
		// lost its race on a slower CI runner - `0 !== 2` in 2807 ms, on a commit that only changed a task status - and the
		// lock case's 5 ms could pass while proving nothing, because its assertion was about order and a second launch that
		// landed after the first had finished still satisfies it. Both are rewritten to hold the state they need.
		//
		// **This is a door, not a proof, and it took a verifier to show how wide the gap was.** Its first version was three
		// times weaker than the rule it was written for: it read only the top level of `tests/`, so seven files under
		// `tests/fixtures/` were invisible, and its pattern demanded the parameter be named `resolve`, so renaming one
		// character defeated it. What it holds now is one line, at any depth, with any parameter name - required to be the
		// same name twice, which is what a real `new Promise` executor looks like. It still does not catch a fence written
		// across two lines, with an aliased `setTimeout`, or with a variable delay. Those are named here rather than
		// implied, because a rule row that reads stronger than its mechanism is the defect this repository keeps finding.
		//
		// Two legitimate uses exist in this suite and neither is this form: a `setTimeout` written **into a generated child
		// script**, where the slowness is the behaviour under test, and a timeout handle stored so an abort listener can
		// clear it. Product code is out of scope on purpose - a bounded retry loop in `src/project-provider/lock.ts` uses
		// the same text and is not a fence, which is the clearest argument for pointing this scan at tests only.
		//
		// **The pattern demands a digit**, which is not a detail: this comment names the forbidden shape with a placeholder
		// (`N`), and without the digit the scan flagged its own documentation the first time it ran.
		const offenders: string[] = [];
		for (const file of testFilesIn("tests")) {
			readFileSync(file, "utf8")
				.split("\n")
				.forEach((line, index) => {
					if (/await new Promise\(\((\w+)\) => setTimeout\(\1, \d/.test(line)) offenders.push(`${file}:${index + 1}`);
				});
		}
		assert.deepEqual(offenders, [], `a case that needs a state should hold it rather than sleep into it: ${offenders.join(", ")}`);
	});
});
