import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lensEnabledForWorkspaceMode, readWorkspacePolicy, writeWorkspacePolicy } from "../src/core/workspace-policy.ts";

describe("workspace policy", () => {
	it("defaults to development without creating metadata", () => {
		const root = mkdtempSync(join(tmpdir(), "dove-workspace-policy-"));
		try {
			const result = readWorkspacePolicy(root);
			assert.equal(result.policy.mode, "development");
			assert.equal(result.source, "default");
			assert.equal(result.malformed, false);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("persists pentest atomically and reads it from nested paths", async () => {
		const root = mkdtempSync(join(tmpdir(), "dove-workspace-policy-"));
		try {
			await writeWorkspacePolicy(root, "pentest");
			const result = readWorkspacePolicy(join(root, "nested"));
			assert.equal(result.workspaceRoot, root);
			assert.equal(result.policy.mode, "pentest");
			assert.equal(result.source, "workspace");
			assert.equal(JSON.parse(readFileSync(result.path, "utf8")).mode, "pentest");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("falls back safely for malformed policy and accepts a one-shot override", () => {
		const root = mkdtempSync(join(tmpdir(), "dove-workspace-policy-"));
		try {
			writeFileSync(join(root, ".pi-lens.json"), "{}", "utf8");
			const directory = join(root, ".dove");
			mkdirSync(directory);
			writeFileSync(join(directory, "workspace.json"), "{\"mode\":\"unknown\"}", "utf8");
			assert.equal(readWorkspacePolicy(root).policy.mode, "development");
			assert.equal(readWorkspacePolicy(root).malformed, true);
			assert.equal(readWorkspacePolicy(root, "pentest").policy.mode, "pentest");
			assert.equal(readWorkspacePolicy(root, "invalid").policy.mode, "development");
			assert.equal(lensEnabledForWorkspaceMode("development"), true);
			assert.equal(lensEnabledForWorkspaceMode("pentest"), false);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});
});
