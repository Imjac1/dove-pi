import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadWorkMode, workModeDirectory, type WorkModeFiles } from "../src/core/work-mode.ts";

// **The owner's requirement, 2026-10-05**: a mode's machine tools are not hard prerequisites - nothing refuses a mode for their
// absence, and no load-time check was wanted for them - but the work must actually *use* what the machine has. Two halves, both
// stated as rules in the mode bodies: run the tool the work needs and keep what it printed, and a script written instead must be
// general enough that the next call reuses it rather than rewrites it.
//
// **Asserted on the body, not on the file**, for the reason the pentest case gives: the body is what the loader carries and what
// any consumer of the mode reads. The mode body is the rule's only carrier - a rule that is not in the model's context is not a
// rule - so these cases assert the sentences the rule is stated in. Rewriting a rule means rewriting its sentence here, which is
// the point: the failure this case produces is the reminder that a rule stated in prose is held by the sentence that says it.
//
// **`trading` is deliberately not covered.** Its surface is order submission against a venue with an id derived from the
// framework's effect identity, and its sections are about that; there is no script in it to make reusable, so a rule about
// scripts there would be noise in a body the model reads as instructions. The omission is a decision, not an oversight.
const FRAMEWORK = "0.2.0";

async function bodyOf(id: string): Promise<string> {
	const dir = workModeDirectory(process.cwd(), id);
	const files: WorkModeFiles = {
		mode: await readFile(join(dir, "MODE.md"), "utf8"),
		governance: await readFile(join(dir, "governance.yaml"), "utf8"),
		permissions: await readFile(join(dir, "permissions.yaml"), "utf8"),
	};
	return loadWorkMode(files, { frameworkVersion: FRAMEWORK }).body;
}

const RUN_IT = [
	["code-development", /call it and show what came back/],
	["code-audit", /Meet an obligation by running something/],
	["pentest", /Run the tool the technique calls for/],
] as const;

const REUSE_IT = [
	["code-development", /is meant to be used twice/],
	["code-audit", /to be reusable/],
	["pentest", /reused across targets/],
] as const;

describe("a mode tells the model to use what the machine has", () => {
	for (const [id, sentence] of RUN_IT) {
		it(`${id} says to run the tool rather than describe it`, async () => {
			assert.match(await bodyOf(id), sentence, `${id}'s body no longer states that the tool is to be run`);
		});
	}

	for (const [id, sentence] of REUSE_IT) {
		it(`${id} says a script written for one call is written again`, async () => {
			assert.match(await bodyOf(id), sentence, `${id}'s body no longer says a script must be reusable`);
		});
	}
});
