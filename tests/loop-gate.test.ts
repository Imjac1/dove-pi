import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAgentLoop } from "../src/core/loop-runner.ts";
import { createScriptedProvider } from "../src/adapters/loop-scripted.ts";
import type { ActionGate, GateDecision, GateInvocation, LoopOptions } from "../src/core/loop.ts";

const MODE = { id: "test-mode", version: "1.0.0", governanceVersion: "1" };

/** One tool call, then a final text turn. The same script is used with the gate on and off. */
const script = [
	{ kind: "tools" as const, calls: [{ name: "write_file", arguments: { path: "/tmp/out.txt" } }] },
	{ kind: "text" as const, text: "done" },
];

const TOOL = { name: "write_file", description: "write a file" };

function options(overrides: Partial<LoopOptions> = {}): LoopOptions {
	return {
		provider: createScriptedProvider({ steps: script }),
		model: "test-model",
		mode: MODE,
		systemPrompt: "test",
		tools: [TOOL],
		maxTurns: 5,
		executeTool: async () => ({ content: "wrote" }),
		...overrides,
	};
}

const blockGate = (reason = "target not in the authorized scope"): ActionGate => ({
	id: "test-gate",
	evaluate: (): GateDecision => ({ outcome: "block", reason, remediation: "Request a grant that covers this target." }),
});

describe("agent loop gate boundary", () => {
	it("paired: the same scripted provider executes the action with the gate off", async () => {
		const outcome = await createAgentLoop(options()).run("go");
		assert.equal(outcome.executedActions, 1);
		assert.equal(outcome.blockedActions.length, 0);
		assert.equal(outcome.stopReason.kind, "completed");
	});

	it("paired: the same scripted provider executes nothing with the gate on, and the reason reaches the transcript", async () => {
		const outcome = await createAgentLoop(options({ gate: blockGate("write outside the authorized tree") })).run("go");
		assert.equal(outcome.executedActions, 0, "a blocking gate must prevent the tool from running");
		assert.equal(outcome.blockedActions.length, 1);
		assert.equal(outcome.blockedActions[0]?.tool, "write_file");
		const toolResult = outcome.messages.find((m) => m.role === "toolResult");
		assert.ok(toolResult && toolResult.role === "toolResult");
		assert.match(toolResult.content, /write outside the authorized tree/);
		assert.match(toolResult.content, /Do this instead:/, "a block carries remediation, not only a refusal");
		assert.equal(toolResult.isError, true);
	});

	it("invokes the gate for allowed actions too, so an off-path gate is detectable", async () => {
		const seen: GateInvocation[] = [];
		const allowGate: ActionGate = { id: "allow", evaluate: () => ({ outcome: "allow" }) };
		const outcome = await createAgentLoop(
			options({ gate: allowGate, onGateInvoked: (invocation) => { seen.push(invocation); } }),
		).run("go");
		assert.equal(outcome.executedActions, 1);
		assert.equal(seen.length, 1, "the invocation log must record allowed actions");
		assert.equal(seen[0]?.tool, "write_file");
		assert.equal(seen[0]?.mode.id, "test-mode");
		assert.deepEqual(seen[0]?.mode, MODE, "mode identity is stamped so the evidence record can answer what was allowed");
	});

	it("fails closed when the gate throws", async () => {
		const throwing: ActionGate = { id: "throwing", evaluate: () => { throw new Error("policy service unreachable"); } };
		const outcome = await createAgentLoop(options({ gate: throwing })).run("go");
		assert.equal(outcome.executedActions, 0, "an unevaluable action is never allowed");
		assert.match(outcome.blockedActions[0]?.reason ?? "", /policy service unreachable/);
	});

	it("fails closed when the gate returns an unrecognised decision shape", async () => {
		const broken = { id: "broken", evaluate: (() => ({ outcome: "maybe" })) as unknown as ActionGate["evaluate"] };
		const outcome = await createAgentLoop(options({ gate: { id: "broken", evaluate: broken.evaluate } })).run("go");
		assert.equal(outcome.executedActions, 0);
		assert.match(outcome.blockedActions[0]?.reason ?? "", /unrecognised decision/);
	});

	it("blocks a target/display mismatch before consulting the gate", async () => {
		let consulted = 0;
		const counting: ActionGate = { id: "counting", evaluate: () => { consulted += 1; return { outcome: "allow" }; } };
		// The GhostApproval shape: the decision resolves the real target while the human-visible
		// string shows a benign one. This must be caught by the loop, not left to the gate.
		const outcome = await createAgentLoop(
			options({
				gate: counting,
				resolveTarget: () => ({ target: "/home/user/.zshrc", displayTarget: "/project/settings.json" }),
			}),
		).run("go");
		assert.equal(outcome.executedActions, 0, "a mismatched target representation must not execute");
		assert.equal(consulted, 0, "the loop blocks before consulting the gate, so a forgetful gate cannot allow it");
		assert.match(outcome.blockedActions[0]?.reason ?? "", /representation mismatch/);
	});

	it("allows the action when both target representations agree", async () => {
		let consulted = 0;
		const counting: ActionGate = { id: "counting", evaluate: () => { consulted += 1; return { outcome: "allow" }; } };
		const outcome = await createAgentLoop(
			options({
				gate: counting,
				resolveTarget: () => ({ target: "/project/settings.json", displayTarget: "/project/settings.json" }),
			}),
		).run("go");
		assert.equal(consulted, 1, "matching representations reach the gate normally");
		assert.equal(outcome.executedActions, 1);
	});
});
