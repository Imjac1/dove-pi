import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

describe("the suite's own timing discipline", () => {
	it("holds a state instead of sleeping into it, so no case waits on a duration", () => {
		// **The form this forbids, and why the form is exact.** `await new Promise((resolve) => setTimeout(resolve, N))`
		// inside a test is a fixed duration standing where a state should be. Measured 2026-10-15: the batch case's 600 ms
		// lost its race on a slower CI runner - `0 !== 2` in 2807 ms, on a commit that only changed a task status - and the
		// lock case's 5 ms could pass while proving nothing, because its assertion was about order and a second launch that
		// landed after the first had finished still satisfies it. Both are rewritten to hold the state they need; this case
		// is what keeps the next one from being written the old way.
		//
		// **The scan is deliberately narrow.** It does not try to detect every timing assumption - it forbids the one form
		// that has actually hurt, and it would be defeated by respacing the same fence. That is accepted: the goal is to
		// make the wrong thing require a deliberate act, not to make it impossible. A poll is not what it forbids either;
		// the suite polls with `timers/promises`, which is a bounded wait on an observable state.
		//
		// Two legitimate uses exist in this suite and neither is this form: a `setTimeout` written **into a generated child
		// script**, where the slowness is the behaviour under test, and a timeout handle stored so an abort listener can
		// clear it. Product code is out of scope on purpose - a bounded retry loop in `src/project-provider/lock.ts` uses
		// the same text and is not a fence, which is the clearest argument for pointing this scan at tests only.
		//
		// **The pattern demands a digit**, which is not a detail: this comment names the forbidden shape with a placeholder
		// (`N`) rather than a number, and without the digit the scan flagged its own documentation the first time it ran.
		// The harm is the number - a duration standing where a state should be - so requiring one is both narrower and more
		// accurate, and it lets the rule be written down in the file that enforces it.
		const offenders: string[] = [];
		for (const file of readdirSync("tests").filter((name) => name.endsWith(".ts"))) {
			readFileSync(join("tests", file), "utf8")
				.split("\n")
				.forEach((line, index) => {
					if (/await new Promise\(\(resolve\) => setTimeout\(resolve, \d/.test(line)) offenders.push(`${file}:${index + 1}`);
				});
		}
		assert.deepEqual(offenders, [], `a case that needs a state should hold it rather than sleep into it: ${offenders.join(", ")}`);
	});
});
