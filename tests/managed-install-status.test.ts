import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectManagedInstall } from "../src/managed-install-status.ts";

describe("managed install doctor status", () => {
	it("reports managed extension degradation from local state without mutating it", () => {
		const root = mkdtempSync(join(tmpdir(), "dove-pi-managed-status-"));
		try {
			mkdirSync(join(root, "state"));
			writeFileSync(join(root, "state", "install.json"), JSON.stringify({
				schemaVersion: 2,
				current: { releaseId: "0.2.0+test", installPath: join(root, "app", "versions", "current") },
				profile: "max",
				managedExtensions: [
					{ identity: "npm:healthy", spec: "npm:healthy@1.0.0", status: "healthy" },
					{ identity: "npm:broken", spec: "npm:broken@1.0.0", status: "degraded", error: "private detail" },
				],
			}));
			const result = inspectManagedInstall({ DOVE_PI_HOME: root });
			assert.equal(result.installed, true);
			assert.equal(result.currentRelease, "0.2.0+test");
			assert.deepEqual(result.extensions.map((entry) => entry.status), ["healthy", "degraded"]);
			assert.equal("error" in result.extensions[1]!, false);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
