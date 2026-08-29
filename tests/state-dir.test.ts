import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { legacyDoveStateDir, migrateLegacyDoveState, resolveDoveStateDir } from "../src/core/state-dir.ts";

describe("Dove runtime state directory", () => {
	it("keeps the explicit override authoritative", () => {
		assert.equal(resolveDoveStateDir("C:/workspace", { env: { DOVE_PI_STATE_DIR: "C:/custom-state" } }), resolve("C:/custom-state"));
	});

	it("isolates workspaces below the Pi agent directory", () => {
		const agentDir = resolve("C:/pi-agent-fixture");
		const first = resolveDoveStateDir("C:/Work/One", { env: {}, agentDir, platform: "win32" });
		const same = resolveDoveStateDir("c:/work/one/", { env: {}, agentDir, platform: "win32" });
		const second = resolveDoveStateDir("C:/Work/Two", { env: {}, agentDir, platform: "win32" });
		assert.equal(first, same);
		assert.notEqual(first, second);
		assert.match(first.replace(/\\/g, "/"), /\/dove\/workspaces\/[a-f0-9]{16}$/);
	});

	it("uses the physical workspace path when an alias can be resolved", () => {
		const root = mkdtempSync(join(tmpdir(), "dove-state-realpath-"));
		const workspace = join(root, "workspace");
		const alias = join(root, "alias");
		mkdirSync(workspace);
		try {
			symlinkSync(workspace, alias, process.platform === "win32" ? "junction" : "dir");
			const options = { env: {}, agentDir: join(root, "agent") };
			assert.equal(resolveDoveStateDir(alias, options), resolveDoveStateDir(workspace, options));
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("copies known legacy files once without deleting or overwriting", () => {
		const workspace = mkdtempSync(join(tmpdir(), "dove-state-workspace-"));
		const target = mkdtempSync(join(tmpdir(), "dove-state-target-"));
		const legacy = legacyDoveStateDir(workspace);
		mkdirSync(legacy, { recursive: true });
		writeFileSync(join(legacy, "execution.jsonl"), "legacy\n", "utf8");
		writeFileSync(join(legacy, "unknown"), "keep\n", "utf8");
		writeFileSync(join(target, "thinking-policy"), "new\n", "utf8");
		assert.deepEqual(migrateLegacyDoveState(workspace, target), ["execution.jsonl"]);
		assert.equal(readFileSync(join(target, "execution.jsonl"), "utf8"), "legacy\n");
		assert.equal(readFileSync(join(target, "thinking-policy"), "utf8"), "new\n");
		assert.equal(readFileSync(join(legacy, "unknown"), "utf8"), "keep\n");
		assert.deepEqual(migrateLegacyDoveState(workspace, target), []);
		rmSync(workspace, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});
});
