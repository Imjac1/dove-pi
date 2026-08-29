import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { ModelBudgetError, ModelGateway, normalizeStopReason, accountModelBudget, modelPayloadFromProvider } from "../src/core/model-gateway.ts";
import { requestPolicy } from "../src/core/prompt-policy.ts";

describe("request planning", () => {
	it("keeps policy ownership single-sourced by intent", () => {
		assert.match(requestPolicy("chat"), /agent_run_capability/);
		assert.doesNotMatch(requestPolicy("chat"), /Web access/);
		assert.match(requestPolicy("lookup"), /Web access/);
		assert.match(requestPolicy("execution"), /Parallelize/);
	});
	it("keeps an ordinary hi turn as isolated chat", () => {
		const plan = createRequestPlan({ message: "hi", projectAvailable: true, requestId: "r1" });
		assert.equal(plan.intent, "chat");
		assert.deepEqual(plan.contextClasses, ["conversation"]);
		assert.deepEqual(plan.capabilityIds, []);
		assert.equal(plan.approval, "none");
		assert.equal(Object.isFrozen(plan), true);
	});

	it("distinguishes lookup, project work, and execution", () => {
		assert.equal(createRequestPlan({ message: "show project status", projectAvailable: true }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "implement the login feature", projectAvailable: true }).intent, "project-work");
		assert.equal(createRequestPlan({ message: "work on the project plan", projectAvailable: true }).intent, "project-work");
	});

	it("does not let explicit chat intent bypass mutation safety", () => {
		assert.equal(createRequestPlan({ message: "delete the temp file", explicitIntent: "chat" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "hello", explicitIntent: "invalid" as never }).intent, "chat");
	});
});

describe("model gateway budget", () => {
	const config = { contextWindow: 100, reservedOutput: 20, reservedReasoning: 10, toolSchemaOverhead: 5, providerOverhead: 5 };

	it("audits the final provider message envelope", () => {
		const request = modelPayloadFromProvider({ messages: [{ role: "system", content: "abcd" }, { role: "user", content: [{ type: "text", text: "你好" }] }] });
		assert.equal(request.segments.length, 2);
		assert.equal(request.segments[1]?.source, "provider:user");
		assert.match(request.segments[1]?.content ?? "", /你好/);
	});

	it("accounts for all reservations", () => {
		const budget = accountModelBudget({ payload: {}, segments: [{ id: "user", source: "user", content: "a".repeat(120) }] }, config);
		assert.equal(budget.availableInput, 60);
		assert.equal(budget.overflowTokens, 0); // ASCII estimate is 30 tokens.
	});

	it("rejects an over-budget required segment before transport dispatch", async () => {
		let calls = 0;
		const gateway = new ModelGateway({ contextWindow: 100, reservedOutput: 20, reservedReasoning: 10, toolSchemaOverhead: 5, providerOverhead: 5 });
		const request = { payload: { messages: [] }, segments: [{ id: "required-prd", source: "prd", content: "x".repeat(400), required: true }] };
		await assert.rejects(() => gateway.dispatch(request, { send: async () => { calls++; return { result: "ok", stopReason: "stop" }; } }), (error: unknown) => {
			assert.ok(error instanceof ModelBudgetError);
			assert.equal(error.diagnostic.code, "MODEL_CONTEXT_OVER_BUDGET");
			assert.deepEqual(error.diagnostic.requiredSegments, ["required-prd"]);
			return true;
		});
		assert.equal(calls, 0);
	});

	it("normalizes provider stop reasons", () => {
		assert.equal(normalizeStopReason("max_tokens"), "length");
		assert.equal(normalizeStopReason("toolUse"), "tool_call");
		assert.equal(normalizeStopReason("cancelled"), "cancelled");
		assert.equal(normalizeStopReason("stop"), "completed");
	});
});
