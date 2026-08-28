import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	modeThinkingLevel,
	parsePolicy,
	parseThinkingLevel,
	resolveThinkingLevel,
	serializePolicy,
	THINKING_LEVELS,
	type ThinkingPolicyState,
} from "../src/pi-adapter/thinking-policy.ts";

describe("thinking policy (mode-driven + lock)", () => {
	it("maps execution modes to thinking levels", () => {
		assert.equal(modeThinkingLevel("fast"), "low");
		assert.equal(modeThinkingLevel("standard"), "high");
		assert.equal(modeThinkingLevel("ultra"), "max");
	});

	it("parses valid thinking levels and rejects invalid ones", () => {
		assert.equal(parseThinkingLevel("max"), "max");
		assert.equal(parseThinkingLevel("medium"), "medium");
		assert.equal(parseThinkingLevel("off"), "off");
		assert.equal(parseThinkingLevel(" HIGH "), "high");
		assert.equal(parseThinkingLevel("all"), undefined);
		assert.equal(parseThinkingLevel(""), undefined);
	});

	it("defaults to auto when no policy is persisted", () => {
		assert.deepEqual(parsePolicy(undefined), { kind: "auto" });
		assert.deepEqual(parsePolicy(""), { kind: "auto" });
	});

	it("parses and serializes lock:level round-trip", () => {
		const state: ThinkingPolicyState = { kind: "lock", level: "max" };
		assert.equal(serializePolicy(state), "lock:max");
		assert.deepEqual(parsePolicy("lock:max"), { kind: "lock", level: "max" });
	});

	it("parses explicit off", () => {
		assert.deepEqual(parsePolicy("off"), { kind: "off", reason: "disabled" });
	});

	it("falls back to auto for unknown policy strings", () => {
		assert.deepEqual(parsePolicy("lock:nonsense"), { kind: "auto" });
		assert.deepEqual(parsePolicy("banana"), { kind: "auto" });
	});

	it("resolves the locked level regardless of mode", () => {
		const state: ThinkingPolicyState = { kind: "lock", level: "medium" };
		assert.equal(resolveThinkingLevel(state, "ultra"), "medium");
		assert.equal(resolveThinkingLevel(state, "fast"), "medium");
	});

	it("resolves from the execution mode in auto policy", () => {
		assert.equal(resolveThinkingLevel({ kind: "auto" }, "fast"), "low");
		assert.equal(resolveThinkingLevel({ kind: "auto" }, "standard"), "high");
		assert.equal(resolveThinkingLevel({ kind: "auto" }, "ultra"), "max");
	});

	it("exports the standard thinking level vocabulary", () => {
		assert.deepEqual(THINKING_LEVELS, [
			"off",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
		]);
	});
});
