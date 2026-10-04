import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_SOURCE_ROOTS } from "../scripts/release-roots.mts";

/**
 * **What the release digest covers, held by a test.** The builder walks these roots and nothing else, so a root missing from the list
 * is content the digest does not describe - and the digest is the manifest own claim about which source produced a release.
 *
 * Found by reading the list: `modes` was absent while `work-mode.ts` loads `modes/<id>/MODE.md` and the code-audit capability reads a
 * catalog under it, so two releases with different mode definitions could carry the same digest. **The modes are the part of the tree
 * that decides what the running agent is permitted to do.**
 */
describe("the release source roots", () => {
	it("cover the mode definitions the runtime loads", () => {
		assert.ok((RELEASE_SOURCE_ROOTS as readonly string[]).includes("modes"), "modes is product content: work-mode.ts loads MODE.md from it");
	});

	it("cover the list itself, so the claim cannot be edited without the artifact noticing", () => {
		assert.ok((RELEASE_SOURCE_ROOTS as readonly string[]).includes("scripts/release-roots.mts"), "a change to which roots are walked must change the digest");
		assert.ok((RELEASE_SOURCE_ROOTS as readonly string[]).includes("scripts/build-release-manifest.mts"), "and so must a change to the builder");
	});

	it("name only paths that exist, because a root that resolves to nothing is silently skipped", () => {
		for (const root of RELEASE_SOURCE_ROOTS) {
			assert.ok(existsSync(join(process.cwd(), root)), root + " is a release root and does not exist");
		}
	});

	it("copies every root the digest covers into the archive the release job assembles", () => {
		// **Two claims about one release, and nothing compared them.** `RELEASE_SOURCE_ROOTS` is what the manifest's digest
		// covers; the `$include` list in `.github/workflows/release.yml` is what the published zip is assembled from. `modes` is
		// in the first and was missing from the second, so the digest described a release whose mode definitions were not in it -
		// and the pair is worse than either alone: an installed release that selects a mode it cannot read refuses **every tool
		// call** (the adapter refuses at the `tool_call` boundary when the mode failed to load).
		//
		// The check derives rather than lists: a root counts as copied when the archive takes it, or takes a directory it lives
		// under. That is what makes it hold for a root added later, without anyone remembering this case.
		const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");
		const assignment = /\$include = @\(([^)]*)\)/u.exec(workflow);
		assert.ok(assignment, "the release job still declares the archive's contents in one list");
		const copied = new Set([...(assignment[1] ?? "").matchAll(/'([^']+)'/gu)].map((match) => match[1] as string));
		assert.ok(copied.size > 5, "a list this small would pass this check vacuously");
		const missing = RELEASE_SOURCE_ROOTS.filter((root) => {
			const top = (root as string).split("/")[0] as string;
			return !copied.has(root) && !copied.has(top);
		});
		assert.deepEqual(missing, [], "these roots are in the digest and not in the archive: " + missing.join(", "));
	});
});
