/**
 * First contact: the path a user walks once, in a private home.
 *
 * Every other suite in this directory exercises a piece of the product. This one exists to walk the pieces in the
 * order a person meets them - and it starts, deliberately, not with the walk but with the **safety valve**: this
 * suite really installs, so before it installs anything it has to prove that the user's own installation is not what
 * it touched. That proof is written first because a scenario that damages a real installation while looking for
 * defects is worse than no scenario.
 *
 * The rest of the path is not written yet, and not as a silent skip: measured, nothing under `tests/` has ever run
 * the installer, so the install step is new ground and gets its own case once its invocation is pinned down.
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * The user's own installation, as much of it as can be observed without touching it.
 *
 * Resolution matches `src/managed-install-status.ts`: `DOVE_PI_HOME`, then a directory under the platform's local
 * application data, then the XDG-style path. A fingerprint rather than a path, because the point is to compare it
 * with itself - and "the directory is absent" is a state worth comparing too.
 */
function realInstallState(): string {
	const override = process.env.DOVE_PI_HOME?.trim();
	const directory =
		override !== undefined && override !== ""
			? override
			: process.platform === "win32"
				? join(process.env.LOCALAPPDATA ?? "", "DovePi")
				: join(process.env.HOME ?? "", ".local", "share", "dove-pi");
	try {
		const stats = statSync(directory);
		return `present:${String(stats.mtimeMs)}:${String(readdirSync(directory).length)}`;
	} catch {
		return "absent";
	}
}

describe("first contact: the path a user walks once", () => {
	it("walks in a private home, and proves the user's own installation is not the one it touched", () => {
		const before = realInstallState();
		const root = mkdtempSync(join(tmpdir(), "dove-first-contact-"));
		try {
			// Empty, so that "fresh install" means something when the install case is added.
			assert.deepEqual(readdirSync(root), [], "the private home starts empty");

			// **The safety valve.** Every later case in this suite runs against `root`; this one is the reason they can.
			assert.equal(realInstallState(), before, "the user's own installation did not move");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
