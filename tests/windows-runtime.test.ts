import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPowerShell } from "../src/windows-runtime/powershell.ts";
import { inspectWindowsEnvironment } from "../src/windows-runtime/doctor.ts";
import { applyWorkspacePatch, createWorkspaceSnapshot, restoreWorkspaceSnapshot, verifyWorkspaceSnapshot } from "../src/windows-runtime/workspace.ts";

describe("PowerShell runtime", () => {
	it("returns structured output for a read-only command", async () => {
		const result = await runPowerShell("Write-Output 'personal-agent-ok'", { timeoutMs: 10_000 });
		assert.equal(result.exitCode, 0);
		assert.match(result.stdout, /personal-agent-ok/);
		assert.equal(result.interrupted, false);
	});
});

describe("Windows doctor", () => {
	it("reports runtime and tool availability", async () => {
		const report = await inspectWindowsEnvironment(process.cwd());
		assert.equal(report.available, true);
		assert.equal(typeof report.version, "string");
		assert.equal(typeof report.isAdministrator, "boolean");
		assert.ok("git" in report.tools);
	});
});

describe("Workspace transactions", () => {
	it("snapshots, detects drift, and restores files plus additions", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-"));
		await writeFile(join(temporary, "a.txt"), "before", "utf8");
		await writeFile(join(temporary, "b.txt"), "keep", "utf8");
		const snapshot = await createWorkspaceSnapshot(temporary, ["."]);
		await writeFile(join(temporary, "a.txt"), "changed", "utf8");
		await writeFile(join(temporary, "new.txt"), "new", "utf8");
		const drift = await verifyWorkspaceSnapshot(temporary, snapshot.id);
		assert.equal(drift.ok, false);
		assert.ok(drift.changed.includes("a.txt"));
		assert.ok(drift.extra.includes("new.txt"));
		const restored = await restoreWorkspaceSnapshot(temporary, snapshot.id);
		assert.equal(restored.ok, true);
		assert.equal(await readFile(join(temporary, "a.txt"), "utf8"), "before");
		await assert.rejects(() => readFile(join(temporary, "new.txt"), "utf8"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("rolls back a patch when an operation fails", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-patch-"));
		await writeFile(join(temporary, "state.txt"), "original", "utf8");
		await assert.rejects(() => applyWorkspacePatch(temporary, [
			{ kind: "write", path: "state.txt", content: "temporary" },
			{ kind: "unsupported" as "write", path: "ignored", content: "x" },
		]), /Unsupported workspace patch operation/);
		assert.equal(await readFile(join(temporary, "state.txt"), "utf8"), "original");
		await rm(temporary, { recursive: true, force: true });
	});

	it("rejects traversal and reserved snapshot paths", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-workspace-paths-"));
		await assert.rejects(() => createWorkspaceSnapshot(temporary, [".."]), /escapes root/);
		await assert.rejects(() => createWorkspaceSnapshot(temporary, [".agent-data/workspace-snapshots"]), /reserved/);
		await rm(temporary, { recursive: true, force: true });
	});
});
