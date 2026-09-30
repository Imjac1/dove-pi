import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FENCE_MUTATION_TOOLS, FILESYSTEM_MUTATORS } from "../src/core/action-policy.ts";
import { FENCE_TARGETS } from "../src/core/work-mode.ts";
import { declaredMutatingToolNames } from "../src/core/invocation-disposition.ts";

/**
 * **The fence decides by tool name, and this repository already keeps two lists of names that mutate.**
 *
 * The fence's set is their union - maintained in `action-policy.ts` rather than imported, because `core` takes no
 * Pi imports and the adapter's declaration lives on the other side of that boundary. A union maintained by hand is a
 * third list, and a third list is how the first two came to disagree: `FILESYSTEM_MUTATORS` names `bash` and
 * `notebook_edit`, the declaration table names `delete`, `mkdir` and the two `agent_workspace_*` tools, and neither
 * is a superset of the other.
 *
 * **The second list is now read out of the declaration table** (`invocation-disposition.ts`), which replaced the two
 * name sets the adapter used to export - the mutation set and the read-only allowlist were one question asked twice.
 * `declaredMutatingToolNames()` derives the names from the table itself, so this comparison has no copy to drift
 * against.
 *
 * This test is the coupling. It fails in both directions: a name either list gains that the fence's set lacks, and
 * a name the fence refuses that no list claims mutates anything. The second direction matters because a fence that
 * refuses too much is a fence people turn off.
 *
 * **The shell is excluded on purpose.** `bash` and `powershell` are mutation routes the fence cannot classify by
 * path - the adapter's classifier reads command names and never paths - so the mode's `fence.shell` stance governs
 * them instead, and they belong in neither direction of this comparison.
 */
const SHELL = new Set(["bash", "powershell"]);
const PRODUCT_MUTATION_TOOLS = declaredMutatingToolNames();

describe("the fence's mutation set is the union of the two this repository keeps", () => {
	it("covers every name the policy's own boundary list calls a filesystem mutation", () => {
		const missing = [...FILESYSTEM_MUTATORS].filter((tool) => !SHELL.has(tool) && !FENCE_MUTATION_TOOLS.has(tool));
		assert.deepEqual(missing, [], "the policy knows these mutate the workspace and a fenced run would not refuse them");
	});

	it("covers every name the declaration table calls a product mutation", () => {
		const missing = PRODUCT_MUTATION_TOOLS.filter((tool) => !SHELL.has(tool) && !FENCE_MUTATION_TOOLS.has(tool));
		assert.deepEqual(missing, [], "the adapter knows these mutate the workspace and a fenced run would not refuse them");
	});

	it("refuses nothing that neither list claims mutates, because a fence people turn off protects nothing", () => {
		const union = new Set([...FILESYSTEM_MUTATORS, ...PRODUCT_MUTATION_TOOLS]);
		const extra = [...FENCE_MUTATION_TOOLS].filter((tool) => !union.has(tool));
		assert.deepEqual(extra, [], "these are refused in a fenced run by a list that no other list backs");
	});

	it("maps a target only for tools it also refuses, so a target map cannot outlive its tool", () => {
		const extra = Object.keys(FENCE_TARGETS).filter((tool) => !FENCE_MUTATION_TOOLS.has(tool));
		assert.deepEqual(extra, [], "these name a target the fence would never consult");
	});
});
