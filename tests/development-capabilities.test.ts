import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
import { registerDevelopmentCapabilities } from "../src/capabilities/development.ts";
import { executeFastPath } from "../src/core/fast-path.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("development capabilities", () => {
	it("registers fixed reusable commands instead of arbitrary shell input", () => {
		const registry = new CapabilityRegistry();
		registerDevelopmentCapabilities(registry);
		assert.deepEqual(registry.list().map((capability) => capability.name), [
			"dev.git_status",
			"dev.node_version",
			"dev.python_version",
			"dev.project_test",
			"dev.npm_install",
			"dev.npm_build",
			"dev.typecheck",
		]);
		assert.equal(registry.require("dev.project_test").sideEffects[0], "workspace_write");
		assert.equal(registry.require("dev.typecheck").sideEffects[0], "read_only");
	});

	it("runs the fixed Node version capability through Fast Path", async () => {
		const registry = new CapabilityRegistry();
		registerDevelopmentCapabilities(registry);
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-dev-capability-"));
		const result = await executeFastPath(registry, new ExecutionLedger(join(temporary, "ledger.jsonl")), "dev.node_version", {}, {
			cwd: process.cwd(),
			mode: "fast",
			taskId: "test",
			stepId: "node-version",
		});
		assert.equal(result.status, "success");
		assert.match(String((result.result as { stdout: string }).stdout), /^v\d+/m);
		await rm(temporary, { recursive: true, force: true });
	});
});
