import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContextCompiler } from "../src/core/context-compiler.ts";
import { decideDispatch } from "../src/core/dispatch-policy.ts";
import { executeDispatch } from "../src/core/dispatcher.ts";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("strategy evaluation", () => {
	it("gets a measurable wall-time benefit from parallel independent work", async () => {
		const branch = async (name: string): Promise<string> => { await sleep(90); return name; };
		const sequentialStart = Date.now();
		await branch("one");
		await branch("two");
		const sequentialMs = Date.now() - sequentialStart;

		const parallelStart = Date.now();
		const outcome = await executeDispatch({
			estimate: { inlineCost: 100, dispatchCost: 70, predictedWallTimeMs: 90_000, independentBranches: 2, hasSharedMutableState: false },
			runInline: async () => "inline",
			branches: [() => branch("one"), () => branch("two")],
		});
		const parallelMs = Date.now() - parallelStart;

		assert.equal(outcome.decision.route, "parallel");
		assert.deepEqual(outcome.result, ["one", "two"]);
		assert.ok(parallelMs < sequentialMs * 0.8, `expected parallel ${parallelMs}ms to beat sequential ${sequentialMs}ms`);
		console.log(JSON.stringify({ scenario: "independent branches", route: outcome.decision.route, sequentialMs, parallelMs, speedup: Number((sequentialMs / parallelMs).toFixed(2)) }));
	});

	it("keeps shared mutable work inline even when it looks expensive", async () => {
		const decision = decideDispatch({ inlineCost: 10, dispatchCost: 1, predictedWallTimeMs: 180_000, independentBranches: 2, hasSharedMutableState: true });
		assert.equal(decision.route, "inline");
		console.log(JSON.stringify({ scenario: "shared mutable state", route: decision.route, reason: decision.reason }));
	});

	it("isolates genuinely long work when a worker is available", async () => {
		let inlineCalls = 0;
		let workerCalls = 0;
		const outcome = await executeDispatch({
			estimate: { inlineCost: 200, dispatchCost: 120, predictedWallTimeMs: 180_000, independentBranches: 1, hasSharedMutableState: false },
			longRunningIsolation: true,
			runInline: async () => { inlineCalls += 1; return "inline"; },
			runSubagent: async () => { workerCalls += 1; await sleep(20); return "isolated"; },
		});
		assert.equal(outcome.decision.route, "subagent");
		assert.equal(outcome.result, "isolated");
		assert.equal(inlineCalls, 0);
		assert.equal(workerCalls, 1);
		console.log(JSON.stringify({ scenario: "isolated long work", route: outcome.decision.route, inlineCalls, workerCalls }));
	});

	it("expands context only as the policy becomes more capable", () => {
		const compiler = new ContextCompiler();
		compiler.add({ id: "active-task", kind: "task", content: "current task", required: true });
		compiler.add({ id: "runtime-spec", kind: "spec", content: "runtime rules" });
		compiler.add({ id: "historical-memory", kind: "memory", content: "previous decision" });
		const fast = compiler.compile("", "fast");
		const standard = compiler.compile("", "standard");
		const ultra = compiler.compile("", "ultra");
		assert.deepEqual(fast.items.map((item) => item.id), ["active-task"]);
		assert.deepEqual(standard.items.map((item) => item.id), ["active-task"]);
		assert.deepEqual(ultra.items.map((item) => item.id), ["active-task", "runtime-spec", "historical-memory"]);
		console.log(JSON.stringify({ scenario: "context policy", fast: fast.items.length, standard: standard.items.length, ultra: ultra.items.length }));
	});
});
