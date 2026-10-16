import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RELEASE_SOURCE_ROOTS } from "../scripts/release-roots.mts";
import { MANAGED_INSTALL_SOURCE_ROOTS } from "../src/managed-install-status.ts";

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
		// covers; the list of roots staged into the archive is what the published zip is assembled from. `modes` is in the
		// first and was missing from the second, so the digest described a release whose mode definitions were not in it -
		// and the pair is worse than either alone: an installed release that selects a mode it cannot read refuses **every
		// tool call** (the adapter refuses at the `tool_call` boundary when the mode failed to load).
		//
		// **Which file this list is read from changed on 2026-10-16, and this case is what noticed.** It used to be an
		// `$include` array inside `.github/workflows/release.yml`, while a local replay re-typed the same list by hand - the
		// same rule in two files, which is the shape that drifts. `scripts/stage-release.ps1` is now the one place that says
		// what an archive contains, and the workflow calls it. This case went red the moment the array left the workflow,
		// which is what a case holding two files equal should do: it cannot pass while the rule has no home it can find.
		//
		// The check derives rather than lists: a root counts as staged when the archive takes it, or takes a directory it
		// lives under. That is what makes it hold for a root added later, without anyone remembering this case.
		const stager = readFileSync(join(process.cwd(), "scripts", "stage-release.ps1"), "utf8");
		const assignment = /\$include = @\(([\s\S]*?)\)/u.exec(stager);
		assert.ok(assignment, "the release stager still declares the archive's contents in one list");
		const copied = new Set([...(assignment[1] ?? "").matchAll(/'([^']+)'/gu)].map((match) => match[1] as string));
		assert.ok(copied.size > 5, "a list this small would pass this check vacuously");
		const missing = RELEASE_SOURCE_ROOTS.filter((root) => {
			const top = (root as string).split("/")[0] as string;
			return !copied.has(root) && !copied.has(top);
		});
		assert.deepEqual(missing, [], "these roots are in the digest and not in the archive: " + missing.join(", "));
	});

	it("stages what it says it stages: every root, the two .trellis entries, and no cache", () => {
		// **The list is held by the case above; the stager itself was held by nothing.** Measured 2026-10-16 by a verifier:
		// dropping the stager's `.trellis` entries left the suite green, removing its cache exclusion left both release cases
		// green, and **no test executed it at all** - one reads it as text. So an archive staged without `.trellis/spec` and
		// `.trellis/workflow.md` passed the suite, passed readiness (their absence was not required then; `REQUIRED_ARCHIVE_FILES`
		// requires them now) and would have published, taking the specification index and the workflow document out of every
		// download. This case runs it, because reading it is what failed to notice.
		//
		const stage = mkdtempSync(join(tmpdir(), "dove-stage-"));
		try {
			// **Two interpreters, because the workflow's is not always on the PATH a test sees.** Measured on 2026-10-16: `pwsh`
		// could not be resolved by `spawnSync` here while `powershell` could, and the stager produced identical results under
		// both - 347 files staged, 3 cache directories removed, 0 left. The release workflow runs it with `shell: pwsh`, so
		// this case prefers that interpreter and falls back to the one Windows always has, rather than failing on a
		// distinction that makes no difference to what is staged.
		const interpreters = ["pwsh", "powershell"];
		let staged = spawnSync(interpreters[0] as string, ["-NoProfile", "-File", "scripts/stage-release.ps1", "-Stage", join(stage, "release")], { encoding: "utf8" });
		let interpreter = interpreters[0] as string;
		if (staged.error || staged.status !== 0) {
			interpreter = interpreters[1] as string;
			staged = spawnSync(interpreter, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/stage-release.ps1", "-Stage", join(stage, "release")], { encoding: "utf8" });
		}
		const output = `${staged.stdout ?? ""}${staged.stderr ?? ""}`;
		assert.ok(!staged.error, `the stager needs a PowerShell, as the release workflow does: ${staged.error?.message ?? ""}${output}`);
		assert.equal(staged.status, 0, `the stager failed under ${interpreter}: ${output}`);
			const entries = readdirSync(join(stage, "release"), { recursive: true, encoding: "utf8" }).map((entry) => entry.replace(/\\/gu, "/"));
			assert.ok(entries.length > 100, `a stage this small would pass the rest of this case vacuously: ${entries.length} entries`);
			for (const required of [".trellis/workflow.md", ".trellis/spec/backend/index.md"]) {
				assert.ok(entries.includes(required), `an archive a recipient gets must carry ${required}, and this one does not`);
			}
			const caches = entries.filter(
				(entry) =>
					entry.split("/").some((part) => ["__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"].includes(part)) ||
					entry.endsWith(".pyc"),
			);
			assert.deepEqual(caches, [], `a cache in the staged tree is what the readiness check refuses: ${caches.slice(0, 3).join(", ")}`);
		} finally {
			rmSync(stage, { recursive: true, force: true });
		}
	});

	it("are the same roots the installed release verifies its own digest over", () => {
		// **Two lists, one claim, and nothing compared them.** The builder writes `sourceDigest` over
		// `RELEASE_SOURCE_ROOTS`; `doctor` recomputes it over its own list and calls the install `drifted` when the two
		// disagree. They disagreed: the runtime list was missing `bin`, `modes` and `scripts/release-roots.mts`, so the
		// recomputed digest could never match - every install read as `drifted`, including one built from the very tree it
		// was comparing against. That is the field `README.md` sends a person to in order to decide whether a source fix
		// reached the global launcher, so the reading that exists to tell "not published" from "published" always said
		// "not published", and a true difference became indistinguishable from a false one.
		assert.deepEqual([...MANAGED_INSTALL_SOURCE_ROOTS], [...RELEASE_SOURCE_ROOTS]);
	});
});
