import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
import { decideDispatch } from "../src/core/dispatch-policy.ts";
import { ModeController } from "../src/core/mode-controller.ts";
import { executeDispatch } from "../src/core/dispatcher.ts";
import { executeRecipe, RecipeRegistry } from "../src/core/recipe-registry.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";

describe("mode controller", () => {
	it("applies a change at the next step boundary", () => {
		const controller = new ModeController("standard");
		const runningStepMode = controller.snapshot();
		const change = controller.change("ultra", "step-02");
		assert.equal(runningStepMode, "standard");
		assert.equal(change.effectiveFromStep, "step-02");
		assert.equal(controller.snapshot(), "ultra");
	});
});

describe("capability registry", () => {
	it("resolves exact reusable capabilities", () => {
		const registry = new CapabilityRegistry();
		registry.register({
			name: "test.capability",
			version: "1.0.0",
			description: "test",
			platforms: ["any"],
			sideEffects: ["read_only"],
			idempotent: true,
			status: "stable",
			async execute() { return { ok: true }; },
		});
		assert.equal(registry.require("test.capability").name, "test.capability");
	});
});

describe("recipe registry", () => {
	it("reuses registered capabilities in order", async () => {
		const capabilities = new CapabilityRegistry();
		capabilities.register({
			name: "test.one",
			version: "1.0.0",
			description: "one",
			platforms: ["any"],
			sideEffects: ["read_only"],
			idempotent: true,
			status: "stable",
			async execute() { return { step: 1 }; },
		});
		capabilities.register({
			name: "test.two",
			version: "1.0.0",
			description: "two",
			platforms: ["any"],
			sideEffects: ["read_only"],
			idempotent: true,
			status: "stable",
			async execute() { return { step: 2 }; },
		});
		const recipes = new RecipeRegistry();
		recipes.register({ name: "test.recipe", version: "1.0.0", description: "recipe", status: "stable", steps: [{ capability: "test.one" }, { capability: "test.two" }] });
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-test-"));
		const results = await executeRecipe(recipes, capabilities, new ExecutionLedger(join(temporary, "ledger.jsonl")), "test.recipe", {}, { cwd: process.cwd(), mode: "fast", taskId: "test", stepId: "recipe" });
		await rm(temporary, { recursive: true, force: true });
		assert.deepEqual(results.map((result) => result.status), ["success", "success"]);
	});
});

describe("project mutation recovery", () => {
	it("finds started mutations without a terminal record", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-mutation-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		await ledger.appendProjectMutationStarted("trellis:demo", "step-1", "standard", "mutation-1", "start", "trellis", "before");
		let pending = await ledger.findIncompleteProjectMutations();
		assert.equal(pending.length, 1);
		assert.equal(pending[0]?.mutationId, "mutation-1");
		await ledger.appendProjectMutationReconciled("trellis:demo", "step-1", "standard", "mutation-1", "start", "trellis", "after", "observed");
		pending = await ledger.findIncompleteProjectMutations();
		assert.equal(pending.length, 0);
		await rm(temporary, { recursive: true, force: true });
	});
});

describe("dispatch policy", () => {
	it("keeps short work inline", () => {
		assert.equal(decideDispatch({ inlineCost: 10, dispatchCost: 20, predictedWallTimeMs: 30_000, independentBranches: 1, hasSharedMutableState: false }).route, "inline");
	});

	it("parallelizes independent long work", () => {
		assert.equal(decideDispatch({ inlineCost: 100, dispatchCost: 70, predictedWallTimeMs: 90_000, independentBranches: 2, hasSharedMutableState: false }).route, "parallel");
	});

	it("executes independent branches through the selected route", async () => {
		const outcome = await executeDispatch({
			estimate: { inlineCost: 100, dispatchCost: 70, predictedWallTimeMs: 90_000, independentBranches: 2, hasSharedMutableState: false },
			runInline: async () => "inline",
			branches: [async () => "one", async () => "two"],
		});
		assert.equal(outcome.decision.route, "parallel");
		assert.deepEqual(outcome.result, ["one", "two"]);
	});

	it("can persist the dispatch decision", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-dispatch-"));
		const ledgerPath = join(temporary, "ledger.jsonl");
		const ledger = new ExecutionLedger(ledgerPath);
		const outcome = await executeDispatch({
			estimate: { inlineCost: 10, dispatchCost: 20, predictedWallTimeMs: 30_000, independentBranches: 1, hasSharedMutableState: false },
			runInline: async () => "inline",
			reportActualMetrics: () => ({ contextTokens: 42, inputTokens: 10, outputTokens: 5, retries: 1, humanInterventions: 0 }),
			ledger,
			ledgerContext: { taskId: "test", stepId: "step-1", mode: "fast" },
		});
		assert.equal(outcome.decision.route, "inline");
		assert.equal(outcome.actual.contextTokens, 42);
		assert.equal(outcome.actual.status, "success");
		const records = await readFile(ledgerPath, "utf8");
		assert.match(records, /dispatch\.decided/);
		assert.match(records, /dispatch\.completed/);
		await rm(temporary, { recursive: true, force: true });
	});

	it("records failed dispatches for calibration", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-dispatch-failed-"));
		const ledgerPath = join(temporary, "ledger.jsonl");
		const ledger = new ExecutionLedger(ledgerPath);
		await assert.rejects(() => executeDispatch({
			estimate: { inlineCost: 100, dispatchCost: 70, predictedWallTimeMs: 90_000, independentBranches: 1, hasSharedMutableState: false },
			runInline: async () => { throw new Error("boom"); },
			ledger,
			ledgerContext: { taskId: "test", stepId: "failed", mode: "standard" },
		}), /boom/);
		const records = await readFile(ledgerPath, "utf8");
		assert.match(records, /"kind":"dispatch\.completed"/);
		assert.match(records, /"status":"failed"/);
		await rm(temporary, { recursive: true, force: true });
	});

	it("does not turn telemetry failure into worker failure", async () => {
		const outcome = await executeDispatch({
			estimate: { inlineCost: 10, dispatchCost: 20, predictedWallTimeMs: 30_000, independentBranches: 1, hasSharedMutableState: false },
			runInline: async () => "inline",
			reportActualMetrics: async () => { throw new Error("metrics unavailable"); },
		});
		assert.equal(outcome.result, "inline");
		assert.equal(outcome.actual.status, "success");
		assert.equal(outcome.actual.retries, 0);
	});
});
