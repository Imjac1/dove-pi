import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStrategySnapshot, formatStrategySnapshot } from "../src/core/strategy-snapshot.ts";

describe("strategy snapshot", () => {
	it("projects the effective values without changing policy ownership", () => {
		const snapshot = createStrategySnapshot({
			plan: { requestId: "req-1", intent: "lookup", lane: "fast", interactionMode: "work", workflowAction: undefined },
			interactionMode: "work",
			executionMode: "standard",
			executionModeSource: "user",
			thinkingPolicy: "auto",
			thinkingPolicySource: "auto",
			thinkingLevel: "high",
			toolProfile: "auto",
			toolProfileSource: "pi",
			activeToolCount: 12,
			providerRound: { used: 2, limit: 5 },
			readOnlyBudget: { used: 3, warning: 6, hardStop: 12 },
			context: { contextWindow: 128_000, observedTokens: 18_000, doveBudgetChars: 64_000, budgetSource: "provider-window", omitted: false, compacted: false },
			resources: { toolCalls: 4, elapsedMs: 1200, stopReasons: ["provider-round"] },
		});
		assert.equal(snapshot.schemaVersion, 1);
		assert.equal(snapshot.logicalRequestId, "req-1");
		assert.equal(snapshot.providerRound.limit, 5);
		assert.equal(snapshot.toolProfileSource, "pi");
		assert.equal(snapshot.context.budgetSource, "provider-window");
		assert.deepEqual(snapshot.resources.stopReasons, ["provider-round"]);
		assert.match(formatStrategySnapshot(snapshot), /strategy=lookup\/fast/);
	});

	it("bounds diagnostic text and preserves unknown resource values", () => {
		const snapshot = createStrategySnapshot({
			interactionMode: "auto",
			executionMode: "ultra",
			thinkingPolicy: "off",
			toolProfile: "full",
			activeToolCount: 1,
			providerRound: { used: 0 },
			readOnlyBudget: { used: 0 },
			context: { omitted: true },
			resources: { inputTokens: -1, stopReasons: ["x".repeat(500)] },
		});
		assert.equal(snapshot.resources.inputTokens, undefined);
		assert.equal(snapshot.context.omitted, true);
		assert.equal(snapshot.resources.stopReasons[0]?.length, 128);
	});

	it("does not imply a previous request terminal belongs to a new request", () => {
		const previous = createStrategySnapshot({
			plan: { requestId: "old", intent: "execution", lane: "fast", interactionMode: "auto" },
			interactionMode: "auto", executionMode: "standard", thinkingPolicy: "auto", toolProfile: "auto", activeToolCount: 1,
			providerRound: { used: 1, limit: 5 }, readOnlyBudget: { used: 0 }, context: {},
			terminal: { origin: "provider-round", code: "provider-round-budget", summary: "old", retryable: false },
		});
		const current = createStrategySnapshot({
			plan: { requestId: "new", intent: "chat", lane: "fast", interactionMode: "auto" },
			interactionMode: "auto", executionMode: "standard", thinkingPolicy: "auto", toolProfile: "auto", activeToolCount: 1,
			providerRound: { used: 0, limit: 1 }, readOnlyBudget: { used: 0 }, context: {},
		});
		assert.equal(previous.terminal?.code, "provider-round-budget");
		assert.equal(current.terminal, undefined);
	});
});
