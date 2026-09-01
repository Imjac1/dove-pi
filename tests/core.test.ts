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
import { executeFastPath } from "../src/core/fast-path.ts";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { accountModelBudget } from "../src/core/model-gateway.ts";
import { canTransitionCapabilityExecution, createCapabilityExecution, transitionCapabilityExecution } from "../src/core/capability-runtime.ts";

describe("capability execution state machine", () => {
	it("allows approval and terminal recovery paths but rejects skips", () => {
		let execution = createCapabilityExecution({ executionId: "exec-1", capability: "test.write", version: "1.0.0" });
		execution = transitionCapabilityExecution(execution, "approval_pending");
		execution = transitionCapabilityExecution(execution, "approved");
		execution = transitionCapabilityExecution(execution, "started");
		execution = transitionCapabilityExecution(execution, "timed_out", "deadline");
		execution = transitionCapabilityExecution(execution, "recovered", "reconciled");
		assert.equal(execution.state, "recovered");
		assert.equal(canTransitionCapabilityExecution("planned", "completed"), false);
		assert.throws(() => transitionCapabilityExecution(execution, "started"), /Invalid capability transition/);
	});
});

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
		await ledger.appendProjectMutationStarted("pi-session", "step-2", "standard", "mutation-2", "finish", "trellis", "before", [], [], "trellis:demo", "in_progress", "trellis:demo");
		const targeted = await ledger.findIncompleteProjectMutations();
		assert.equal(targeted.find((intent) => intent.mutationId === "mutation-2")?.targetTaskId, "trellis:demo");
		assert.equal(targeted.find((intent) => intent.mutationId === "mutation-2")?.beforeTargetStatus, "in_progress");
		assert.equal(targeted.find((intent) => intent.mutationId === "mutation-2")?.beforeCurrentTaskId, "trellis:demo");
		await ledger.appendProjectMutationReconciled("trellis:demo", "step-1", "standard", "mutation-1", "start", "trellis", "after", "observed");
		await ledger.appendProjectMutationReconciled("pi-session", "step-2", "standard", "mutation-2", "finish", "trellis", "after", "unknown");
		pending = await ledger.findIncompleteProjectMutations();
		assert.equal(pending.length, 0);
		await rm(temporary, { recursive: true, force: true });
	});
});

describe("capability recovery", () => {
	it("finds started executions and closes them without replay", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-capability-recovery-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		await ledger.append({ taskId: "task", stepId: "step", kind: "capability.started", timestamp: new Date().toISOString(), mode: "standard", details: { executionId: "exec-1", capability: "test.write", version: "1.0.0" } });
		assert.equal((await ledger.findIncompleteCapabilityExecutions()).length, 1);
		await ledger.appendCapabilityTerminal({ taskId: "task", stepId: "step", mode: "standard", executionId: "exec-1", capability: "test.write", status: "recovered", reason: "test" });
		assert.equal((await ledger.findIncompleteCapabilityExecutions()).length, 0);
		await rm(temporary, { recursive: true, force: true });
	});

	it("does not recover an execution owned by another live process", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-capability-owner-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		await ledger.append({ taskId: "task", stepId: "step", kind: "capability.started", timestamp: new Date().toISOString(), mode: "standard", details: { executionId: "exec-live", capability: "test.write", version: "1.0.0", ownerPid: 4242 } });
		assert.equal((await ledger.findIncompleteCapabilityExecutions({ isProcessActive: (pid) => pid === 4242 })).length, 0);
		assert.equal((await ledger.findIncompleteCapabilityExecutions({ isProcessActive: () => false })).length, 1);
		await rm(temporary, { recursive: true, force: true });
	});
});

describe("provider request recovery", () => {
	it("closes an interrupted provider intent without claiming success", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-provider-recovery-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		await ledger.appendProviderRequestStarted({ taskId: "task", stepId: "step", mode: "standard", requestId: "req-1", providerCallId: "call-1", inputTokens: 42, providerToolCount: 1, providerToolSchemaBytes: 128, cachePolicyVersion: 2 });
		assert.equal((await ledger.findIncompleteProviderRequests()).length, 1);
		await ledger.appendProviderRequestRecovered({ taskId: "task", stepId: "step", mode: "standard", requestId: "req-1", providerCallId: "call-1" });
		assert.equal((await ledger.findIncompleteProviderRequests()).length, 0);
		const records = await ledger.read();
		assert.equal(records[0]?.details.providerToolCount, 1);
		assert.equal(records[0]?.details.providerToolSchemaBytes, 128);
		assert.equal(records[0]?.details.cachePolicyVersion, 2);
		assert.equal(records.at(-1)?.details.recovered, true);
		await rm(temporary, { recursive: true, force: true });
	});

	it("does not recover a provider request owned by another live process", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-provider-owner-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		await ledger.appendProviderRequestStarted({ taskId: "task", stepId: "step", mode: "standard", requestId: "req-live", providerCallId: "call-live", inputTokens: 42, providerToolCount: 0, providerToolSchemaBytes: 0, cachePolicyVersion: 2, ownerPid: 4242 });
		assert.equal((await ledger.findIncompleteProviderRequests({ isProcessActive: (pid) => pid === 4242 })).length, 0);
		assert.equal((await ledger.findIncompleteProviderRequests({ isProcessActive: () => false })).length, 1);
		await rm(temporary, { recursive: true, force: true });
	});
});

describe("request and model observability", () => {
	it("records the request plan and model budget decision in the ledger", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-request-ledger-"));
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		const plan = createRequestPlan({ message: "继续当前项目任务", projectAvailable: true, interactionMode: "work", requestId: "req-1" });
		await ledger.appendRequestPlan("session:test", "request:req-1", plan, "sess-1");
		await ledger.appendRuntimePhase({ taskId: "session:test", stepId: "prepare:req-1", mode: plan.mode, requestId: plan.requestId, sessionId: "sess-1", phase: "request-prepare", durationMs: 12.6, metrics: { intentMs: 1, projectContextMs: 8, contextRefreshed: true } });
		await ledger.appendModelBudgetChecked("session:test", "request:req-1", plan.mode, plan.requestId, accountModelBudget({ payload: {}, segments: [{ id: "user", source: "user", content: "hi" }] }, { contextWindow: 12800, reservedOutput: 1024 }), "sess-1");
		const records = await ledger.read();
		assert.deepEqual(records.map((record) => record.kind), ["request.planned", "runtime.phase.completed", "model.budget.checked"]);
		assert.equal(records[0]?.details.intent, "project-work");
		assert.equal(records[0]?.details.interactionMode, "work");
		assert.equal(records[0]?.details.projectAction, "continue");
		assert.equal(records[1]?.details.durationMs, 13);
		assert.deepEqual(records[1]?.details.metrics, { intentMs: 1, projectContextMs: 8, contextRefreshed: true });
		assert.equal(records[2]?.details.requestId, "req-1");
		assert.equal(records[0]?.correlation?.sessionId, "sess-1");
		await rm(temporary, { recursive: true, force: true });
	});
});

describe("capability authorization", () => {
	it("blocks side-effect capabilities without explicit approval and records it", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-approval-"));
		const registry = new CapabilityRegistry();
		let executions = 0;
		registry.register({ name: "test.write", version: "1.0.0", description: "write", platforms: ["any"], sideEffects: ["workspace_write"], idempotent: false, status: "stable", async execute() { executions++; return "ok"; } });
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		const blocked = await executeFastPath(registry, ledger, "test.write", {}, { cwd: temporary, mode: "standard", taskId: "task", stepId: "blocked" }, { required: true });
		assert.equal(blocked.status, "blocked");
		assert.equal(executions, 0);
		const approved = await executeFastPath(registry, ledger, "test.write", {}, { cwd: temporary, mode: "standard", taskId: "task", stepId: "approved", requestId: "req-correlation", sessionId: "session-correlation", attemptId: "attempt-correlation", toolCallId: "tool-correlation" }, { required: true, recordPending: true, authorize: () => true });
		assert.equal(approved.status, "success");
		assert.equal(executions, 1);
		const records = await ledger.read();
		assert.deepEqual(records.map((record) => record.kind), ["capability.blocked", "capability.approval.pending", "capability.approved", "capability.started", "capability.completed"]);
		assert.ok(records.slice(1).every((record) => record.correlation?.requestId === "req-correlation" && record.correlation?.attemptId === "attempt-correlation" && record.correlation?.toolCallId === "tool-correlation" && typeof record.correlation.executionId === "string"));
		await rm(temporary, { recursive: true, force: true });
	});

	it("captures evidence without turning evidence failure into execution failure", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-evidence-"));
		const registry = new CapabilityRegistry();
		registry.register({ name: "test.read", version: "1.0.0", description: "read", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "stable", async execute() { return "ok"; } });
		const ledger = new ExecutionLedger(join(temporary, "ledger.jsonl"));
		const result = await executeFastPath(registry, ledger, "test.read", {}, { cwd: temporary, mode: "fast", taskId: "task", stepId: "evidence" }, {}, { captureEvidence: () => { throw new Error("artifact unavailable"); } });
		assert.equal(result.status, "success");
		assert.deepEqual(result.evidenceRefs, []);
		await rm(temporary, { recursive: true, force: true });
	});

	it("retries idempotent capabilities and marks cancellation", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "personal-agent-retry-"));
		const registry = new CapabilityRegistry();
		let attempts = 0;
		registry.register({ name: "test.retry", version: "1.0.0", description: "retry", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "stable", async execute(_args, context) { attempts++; if (context.signal?.aborted) throw new Error("aborted"); if (attempts < 2) throw new Error("transient"); return "ok"; } });
		const result = await executeFastPath(registry, new ExecutionLedger(join(temporary, "ledger.jsonl")), "test.retry", {}, { cwd: temporary, mode: "fast", taskId: "task", stepId: "retry" }, {}, { retries: 1 });
		assert.equal(result.status, "success");
		assert.equal(result.retries, 1);
		const controller = new AbortController();
		controller.abort();
		const cancelled = await executeFastPath(registry, new ExecutionLedger(join(temporary, "cancel.jsonl")), "test.retry", {}, { cwd: temporary, mode: "fast", taskId: "task", stepId: "cancel", signal: controller.signal });
		assert.equal(cancelled.status, "failed");
		assert.equal(cancelled.interrupted, true);
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
