import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODE_BODY_MAX_CHARS, workModeInstructions, type WorkModePromptSource } from "../src/core/prompt-policy.ts";

/**
 * The block a mode's own instructions arrive in.
 *
 * **Why these are unit cases and the host case is elsewhere.** The block is built by a pure function, so its envelope, its
 * ceiling and its omissions are decided here without a host; `tests/host-work-mode.test.ts` is what proves the block reaches
 * a real assembled prompt. Splitting them is deliberate: the host case fails if the block is never appended, and these fail
 * if it is appended wrong, which is two different findings.
 */

const mode = (overrides: Partial<WorkModePromptSource> = {}): WorkModePromptSource => ({
	id: "code-development",
	governanceVersion: "1.0.0",
	source: "code-development",
	body: "Develop the repository in scope: read it, change it, and let its own tests decide.",
	...overrides,
});

describe("the mode-instructions block", () => {
	it("carries nothing at all when there is no mode, so the prompt is unchanged byte for byte", () => {
		// The state a session with no declaration is in. An empty block is not an empty-looking block: it is the empty string,
		// because a prompt that grew two newlines and a pair of empty tags would be a cache prefix that changed for no rule.
		assert.deepEqual(workModeInstructions(undefined), { text: "", bodyChars: 0, truncated: false });
	});

	it("carries nothing for a mode whose body is empty or blank", () => {
		// **A mode body is optional and the loader accepts an empty one** on purpose, so an empty body cannot be fatal here:
		// this is the shape a mode that declares only permissions and a sandbox has.
		for (const body of ["", "   ", "\n", " \n\t "]) {
			assert.deepEqual(workModeInstructions(mode({ body })), { text: "", bodyChars: 0, truncated: false }, JSON.stringify(body));
		}
	});

	it("labels the body authoritative, because the compiled project documents are not", () => {
		// The two arrive in the same request: `[PROJECT_CONTEXT trust=untrusted ...]` is what a repository's own files get, and
		// the mode's rules come from the operator. A reader that cannot tell which one a rule came from cannot apply either.
		const instructions = workModeInstructions(mode());
		assert.match(instructions.text, /^\[DOVE MODE INSTRUCTIONS id=code-development governance=1\.0\.0 source=modes\/code-development\/MODE\.md trust=authoritative\]\n/);
		assert.ok(instructions.text.includes("let its own tests decide"), "the body is carried verbatim");
		assert.match(instructions.text, /\n\[\/DOVE MODE INSTRUCTIONS\]$/, "the block is closed, so the next block cannot be read as part of it");
		assert.equal(instructions.bodyChars, mode().body.length);
		assert.equal(instructions.truncated, false);
	});

	it("cites the directory the mode was loaded from, and the id separately, because the two need not agree", () => {
		// The citation exists so the model can go and read the file; a `name:` in the frontmatter is a display name, and citing
		// `modes/<name>/MODE.md` would be a path that need not exist - the defect this repository keeps finding in its own
		// declarations. So the source is the loader's directory name and the id is the mode's own.
		const instructions = workModeInstructions(mode({ id: "Code Development", source: "code-development" }));
		assert.match(instructions.text, / id=Code Development /);
		assert.match(instructions.text, / source=modes\/code-development\/MODE\.md /);
	});

	it("omits the citation rather than guessing one when the mode was loaded from file contents alone", () => {
		const instructions = workModeInstructions(mode({ source: undefined }));
		assert.doesNotMatch(instructions.text, /source=/, "no path is named that nobody read");
		assert.match(instructions.text, / id=code-development /);
	});

	it("cuts a body past the ceiling, states the cut in the block, and reports both numbers", () => {
		const body = "y".repeat(MODE_BODY_MAX_CHARS + 250);
		const instructions = workModeInstructions(mode({ body }));
		assert.equal(instructions.truncated, true);
		assert.equal(instructions.bodyChars, MODE_BODY_MAX_CHARS, "the reading is the characters that entered, not the characters offered");
		assert.ok(instructions.text.includes(`[DOVE MODE INSTRUCTIONS budget: truncated at ${MODE_BODY_MAX_CHARS} characters, 250 omitted]`), "the cut is stated in the block itself: " + instructions.text.slice(-200));
		assert.ok(!instructions.text.includes("y".repeat(MODE_BODY_MAX_CHARS + 1)), "and no more than the ceiling is carried");
	});

	it("does not mark a body that is exactly at the ceiling", () => {
		// The boundary is where a truncation notice starts lying: a body of exactly the ceiling is complete, and a block that
		// said otherwise would report an omission that did not happen.
		const instructions = workModeInstructions(mode({ body: "z".repeat(MODE_BODY_MAX_CHARS) }));
		assert.equal(instructions.truncated, false);
		assert.equal(instructions.bodyChars, MODE_BODY_MAX_CHARS);
		assert.doesNotMatch(instructions.text, /budget: truncated/);
	});

	it("is a function of its input, so the block can be part of a cacheable prefix", () => {
		const first = workModeInstructions(mode()).text;
		const second = workModeInstructions(mode()).text;
		assert.equal(first, second, "the same mode produces the same bytes, which is what makes it safe in a stable prefix");
	});
});
