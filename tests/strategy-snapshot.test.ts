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

	it("prints the mode body it carried, and only when it carried one", () => {
		// The reading for the block the prompt now carries: how much of a mode's own instructions went in, and whether a cut
		// happened. It is printed from the same value the prompt was built from, so the number an operator reads cannot
		// describe a block that was not sent.
		const base = {
			interactionMode: "work" as const, executionMode: "standard" as const, thinkingPolicy: "auto", toolProfile: "auto", activeToolCount: 1,
			providerRound: { used: 0 }, readOnlyBudget: { used: 0 },
		};
		const carried = createStrategySnapshot({ ...base, context: { omitted: false, compacted: false, modeBodyChars: 1_606 } });
		assert.equal(carried.context.modeBodyChars, 1_606);
		assert.match(formatStrategySnapshot(carried), /modeBody=1606/, "the line reports what entered the prompt");

		const cut = createStrategySnapshot({ ...base, context: { omitted: false, compacted: false, modeBodyChars: 8_000, modeBodyTruncated: true } });
		assert.match(formatStrategySnapshot(cut), /modeBody=8000\+/, "and marks a body that was cut at the ceiling");

		const none = createStrategySnapshot({ ...base, context: { omitted: false, compacted: false } });
		assert.equal(none.context.modeBodyChars, undefined);
		assert.doesNotMatch(formatStrategySnapshot(none), /modeBody=/, "no mode body means no reading, rather than a zero every line carries");

		// **The case production is actually in**: a session with no mode declared reports zero characters, and zero has to read
		// the same as absent - a `modeBody=0` on every line is noise, and noise is what a reader stops seeing.
		const zero = createStrategySnapshot({ ...base, context: { omitted: false, compacted: false, modeBodyChars: 0 } });
		assert.equal(zero.context.modeBodyChars, 0);
		assert.doesNotMatch(formatStrategySnapshot(zero), /modeBody=/, "a mode with no body reports zero and the line stays clean");
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
