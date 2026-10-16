import { describe, it } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

/**
 * The archive must carry what the manifest covers, and nothing else.
 *
 * Measured 2026-10-16 by a verifier over the shipped v0.2.4: the archive holds **17 `.pyc` files** that are in no commit
 * and that `sourceDigest` deliberately skips, so the manifest described a **smaller scope than the archive delivered** -
 * the defect class this repository keeps finding, this time shipping a CI builder's absolute path
 * (`D:\a\dove-pi\dove-pi\installer\...`) to every downloader. It was present in v0.2.3 as well.
 *
 * The case builds the smallest archive that could carry one and hands it to the real readiness script, because the
 * refusal belongs there: assembly and checking must agree about what an archive is, and the check is the half that fails
 * loudly.
 */
describe("the release archive and its declaration", () => {
	it("refuses an archive that carries a cache, naming the entry", () => {
		// **The four names the assembly half removes, because two of them used to pass.** A verifier drove the refusal on
		// archives carrying one extra entry each on 2026-10-16 and measured that `.pytest_cache/CACHEDIR.TAG` passed while
		// `scripts/stage-release.ps1` removed that directory - so the enforcement covered two of the four names and the
		// claim that the halves matched was false for the other two. A name nobody thought of still passes; that limit is
		// in the front door's row rather than being papered over here.
		const cacheEntries = [
			// The two shapes the published v0.2.4 archive actually carried: bytecode beside an installer module, and under
			// `tests`. The file names are representative - the published `tests` caches are the eight `*_test` module names
			// - because what is being tested is the shape of the path, not a copy of that archive.
			"installer/__pycache__/layout.cpython-311.pyc",
			"tests/__pycache__/test_immutable.cpython-311.pyc",
			".pytest_cache/CACHEDIR.TAG",
			".mypy_cache/3.11/module.meta.json",
			".ruff_cache/content.json",
		];
		const root = mkdtempSync(join(tmpdir(), "dove-release-cache-"));
		try {
			for (const entry of cacheEntries) {
				const builder = join(root, "build.py");
				const archive = join(root, "dove-pi-windows.zip");
				writeFileSync(
					builder,
					[
						"import sys, zipfile",
						"archive, entry = sys.argv[1], sys.argv[2]",
						"with zipfile.ZipFile(archive, 'w') as bundle:",
						"    bundle.writestr('release.json', '{}')",
						"    bundle.writestr(entry, b'\\x00\\x00D:\\\\a\\\\dove-pi')",
						"",
					].join("\n"),
					"utf8",
				);
				const built = spawnSync("python", [builder, archive, entry], { encoding: "utf8" });
				assert.equal(built.status, 0, `the case's own archive builder failed: ${built.stderr}`);

				// The case calls the function that owns the rule rather than the whole command, and the reason is measured:
				// the command reads the manifest **before** it opens the archive, so a placeholder manifest makes it stop
				// with "Unable to read JSON" and the archive is never examined - which is how this case first went red for
				// the wrong reason. The full command path is covered by the release replay, which passes a real manifest.
				const probe = join(root, "probe.py");
				writeFileSync(
					probe,
					[
						"import importlib.util, sys",
						"from pathlib import Path",
						'spec = importlib.util.spec_from_file_location("readiness", "scripts/check_release_readiness.py")',
						"module = importlib.util.module_from_spec(spec)",
						"spec.loader.exec_module(module)",
						"try:",
						"    module.validate_archive(Path(sys.argv[1]), {})",
						"except Exception as error:",
						'    print(f"REFUSED: {error}")',
						"    sys.exit(3)",
						'print("ACCEPTED")',
						"sys.exit(0)",
						"",
					].join("\n"),
					"utf8",
				);
				const checked = spawnSync("python", [probe, archive], { encoding: "utf8" });
				const output = `${checked.stdout ?? ""}${checked.stderr ?? ""}`;
				assert.equal(checked.status, 3, `an archive carrying ${entry} must be refused: ${output}`);
				assert.match(output, /carries a cache/u, `and say what the problem is rather than which check failed: ${output}`);
				assert.ok(
					output.includes(entry.split("/")[entry.split("/").length - 1] as string),
					`and name the entry so a reader knows where to look: ${output}`,
				);
			}
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
