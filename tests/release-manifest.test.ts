import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
});
