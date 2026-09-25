import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPiAgentLoop } from "../src/adapters/loop-pi-agent-core.ts";
import type { ActionGate, GateInvocation } from "../src/core/loop.ts";

const MODE = { id: "code-audit", version: "1.0.0", governanceVersion: "1.0.0" };
const USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

function assistantMessage(content: unknown[], stopReason: string) {
	return { role: "assistant", content, api: "faux", provider: "faux", model: "scripted", usage: USAGE, stopReason, timestamp: Date.now() };
}

/**
 * A minimal Pi-shaped scripted stream function.
 *
 * This is a test double for Pi-ai's provider transport, not a bridge: it emits the event sequence
 * `streamAssistantResponse` consumes and answers `result()`. It exists so the adapter can be exercised
 * offline, which is the only reason the adapter needs anything Pi-shaped at all.
 */
function scriptedStreamFn(steps: readonly ({ kind: "text"; text: string } | { kind: "tool"; name: string; args: unknown })[]) {
	let index = 0;
	return () => {
		const step = steps[index++];
		const message =
			step === undefined
				? assistantMessage([{ type: "text", text: "" }], "stop")
				: step.kind === "text"
					? assistantMessage([{ type: "text", text: step.text }], "stop")
					: assistantMessage([{ type: "toolCall", id: `call-${index}`, name: step.name, arguments: step.args }], "toolUse");
		const events = [{ type: "start", partial: message }, { type: "done", reason: "stop", message }];
		return {
			async *[Symbol.asyncIterator]() {
				for (const event of events) yield event;
			},
			async result() {
				return message;
			},
		};
	};
}

function tool(name: string) {
	return { name, description: name, parameters: {}, execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }) };
}

function options(gate: ActionGate | undefined, seen?: GateInvocation[]) {
	return {
		streamFn: scriptedStreamFn([{ kind: "tool", name: "write_report", args: { path: "reports/out.md" } }, { kind: "text", text: "done" }]) as never,
		model: { id: "scripted" } as never,
		mode: MODE,
		systemPrompt: "audit",
		tools: [tool("write_report")] as never,
		gate,
		maxTurns: 4,
		onGateInvoked: seen === undefined ? undefined : (invocation: GateInvocation) => { seen.push(invocation); },
	};
}

const blockGate: ActionGate = { id: "conformance", evaluate: () => ({ outcome: "block", reason: "outside the authorized tree", remediation: "request a wider grant" }) };
const allowGate: ActionGate = { id: "conformance", evaluate: () => ({ outcome: "allow" }) };

describe("pi-agent-core adapter (the interface admits a second, external loop)", () => {
	it("executes an action when the gate allows it", async () => {
		const outcome = await createPiAgentLoop(options(allowGate)).run("audit");
		assert.equal(outcome.executedActions, 1);
		assert.equal(outcome.blockedActions.length, 0);
	});

	it("blocks the action in Pi's own pre-execution hook, and the reason reaches the transcript", async () => {
		const outcome = await createPiAgentLoop(options(blockGate)).run("audit");
		assert.equal(outcome.executedActions, 0, "Pi's beforeToolCall returns block:true, so the tool never runs");
		assert.equal(outcome.blockedActions.length, 1);
		assert.match(outcome.blockedActions[0]?.reason ?? "", /outside the authorized tree/);
	});

	it("records the invocation for allowed actions too, so an off-path gate stays detectable", async () => {
		const seen: GateInvocation[] = [];
		const outcome = await createPiAgentLoop(options(allowGate, seen)).run("audit");
		assert.equal(outcome.executedActions, 1);
		assert.equal(seen.length, 1);
		assert.equal(seen[0]?.tool, "write_report");
		assert.deepEqual(seen[0]?.mode, MODE, "the mode identity is stamped by the adapter as well as the reference loop");
	});

	it("applies the framework's own guards, so the guarantees do not depend on which loop is running", async () => {
		let consulted = 0;
		const counting: ActionGate = { id: "counting", evaluate: () => { consulted += 1; return { outcome: "allow" }; } };
		const mismatch = await createPiAgentLoop({
			...options(counting),
			resolveTarget: () => ({ target: "/home/user/.zshrc", displayTarget: "/project/settings.json" }),
		}).run("audit");
		assert.equal(mismatch.executedActions, 0, "the GhostApproval shape is blocked by the adapter, not left to the gate");
		assert.equal(consulted, 0);
		assert.match(mismatch.blockedActions[0]?.reason ?? "", /representation mismatch/);

		const throwing = await createPiAgentLoop({ ...options(undefined), gate: { id: "throwing", evaluate: () => { throw new Error("policy service down"); } } }).run("audit");
		assert.equal(throwing.executedActions, 0, "an unevaluable action is never allowed, in either loop");
		assert.match(throwing.blockedActions[0]?.reason ?? "", /policy service down/);
	});
});
