/**
 * Equivalent spellings of a target, and the fence's duty to treat them as the same file.
 *
 * **What this is.** The corpus's evasion measurement (`2609.30217`: 98% of attempts, 88% succeeding) is one
 * sentence long: a check that matches *names* is defeated by spelling the name differently. On Windows the
 * filesystem itself is one of the ways to do that - it treats `x.`, `x `, `X`, `dir\x` and
 * `\\?\C:\dir\x` as the same file - so a boundary that compares strings the way a person reads them refuses
 * one spelling and lets the others through.
 *
 * **Why the fence's exact-file entries are where it bites.** `declaredPrefixHit` matches a directory prefix
 * as `prefix + "/"`, so a trailing dot on the *file name* cannot escape a directory entry. An entry that
 * names a **file** is compared for equality, and there the trailing dot lands outside it.
 *
 * **The pair.** The first case is the control: the plain spelling is refused. Without it, a fence that
 * refused nothing at all would pass the rest of this file.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { declaredPrefixHit, workspaceRelativeTarget } from "../src/core/action-policy.ts";

const root = join("C:", "ws");
const FENCE = [".trellis/harness-surface.yaml"];

const refusalHits = (target: string): boolean => declaredPrefixHit(FENCE, workspaceRelativeTarget(root, target)) !== undefined;

describe("equivalent spellings of a target", () => {
	it("refuses the plain spelling, which is the control that says the fence works at all", () => {
		assert.equal(refusalHits(join(root, ".trellis", "harness-surface.yaml")), true);
	});

	it("refuses the spellings Win32 itself treats as that same file", () => {
		const spellings: readonly string[] = [
			join(root, ".trellis", "harness-surface.yaml."),
			join(root, ".trellis", "harness-surface.yaml "),
			join(root, ".trellis", "HARNESS-SURFACE.YAML"),
			join(root, ".trellis") + "\\harness-surface.yaml",
			join(root, ".", ".trellis", "harness-surface.yaml"),
			"\\\\?\\" + join(root, ".trellis", "harness-surface.yaml"),
			"\\\\.\\" + join(root, ".trellis", "harness-surface.yaml"),
		];
		for (const spelling of spellings) {
			assert.equal(refusalHits(spelling), true, `an equivalent spelling escaped the fence: ${spelling}`);
		}
	});

	it("does not refuse a file the fence does not name, because a fence nobody can work inside is turned off", () => {
		assert.equal(refusalHits(join(root, "notes", "reading.txt")), false);
		assert.equal(refusalHits(join(root, ".trellis", "spec", "backend", "index.md")), false);
	});

	it("keeps traversal meaningful: going up out of the workspace is still outside it", () => {
		// The two spellings of traversal must not be trimmed into the empty segment, which would read as
		// "the workspace root itself" - a normalization that turns a refusal into an allowance.
		assert.equal(workspaceRelativeTarget(root, join(root, "..", "elsewhere")), undefined);
		assert.equal(workspaceRelativeTarget(root, join(root, ".trellis", "..", "notes", "reading.txt")), "notes/reading.txt");
	});
});
