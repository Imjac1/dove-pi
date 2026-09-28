import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSessionFuse, SESSION_FUSE_PREFIX_RATIO } from "../src/pi-adapter/cache-diagnostics.ts";
import type { CacheDiagnostics } from "../src/pi-adapter/cache-diagnostics.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the session-size fuse: the three answers
 * it gives, that a cold start is reported when the last miss was not a warmup, that the prefix ratio is measured
 * against a known window, and that an unknown window yields `ok` rather than a ratio that looks like a
 * measurement.
 *
 * **It does not hold compaction**, which the fuse deliberately does not do - it recommends. And it does not hold
 * the collection of the diagnostics themselves, which the adapter own tests cover.
 */

function diagnostics(overrides: Partial<CacheDiagnostics> = {}): CacheDiagnostics {
	return {
		requestCount: 10,
		promptTokens: 40_000,
		inputTokens: 400,
		cacheReadTokens: 39_600,
		cacheWriteTokens: 0,
		recentRequestHits: 10,
		recentRequestCount: 10,
		warmPromptTokens: 40_000,
		warmCacheReadTokens: 39_600,
		warmInputTokens: 400,
		warmupRequests: 1,
		fullMisses: 0,
		...overrides,
	};
}

describe("the session-size fuse", () => {
	it("answers ok for a session that is well inside the window", () => {
		const reading = evaluateSessionFuse(diagnostics(), 128_000);
		assert.equal(reading.state, "ok");
		assert.equal(reading.recommendation, undefined, "nothing to suggest is not a missing message");
		assert.ok(Math.abs(reading.usageRatio - 40_000 / 128_000) < 1e-9);
	});

	it("answers near_limit at the ratio the review names, and names /compact", () => {
		const reading = evaluateSessionFuse(diagnostics({ promptTokens: 108_000 }), 128_000);
		assert.equal(reading.state, "near_limit");
		assert.match(reading.recommendation ?? "", /\/compact/);
		assert.match(reading.recommendation ?? "", /108000-token window|128000-token window/);
	});

	it("does not fire below the ratio, at the boundary, or above it", () => {
		const window = 100_000;
		assert.equal(evaluateSessionFuse(diagnostics({ promptTokens: 79_999 }), window).state, "ok");
		assert.equal(evaluateSessionFuse(diagnostics({ promptTokens: 80_000 }), window).state, "near_limit",
			`the ratio is ${SESSION_FUSE_PREFIX_RATIO}, which 80000 of 100000 is`);
		assert.equal(evaluateSessionFuse(diagnostics({ promptTokens: 101_000 }), window).state, "near_limit");
	});

	it("calls a cold start by the miss reason, and does not call a warmup one", () => {
		for (const reason of ["model-change", "idle", "provider-miss-or-expiry"] as const) {
			const reading = evaluateSessionFuse(diagnostics({ lastMissReason: reason }), 128_000);
			assert.equal(reading.state, "cold_start", reason);
			assert.match(reading.recommendation ?? "", new RegExp(reason));
		}
		// The control: the expected first call is a miss too, and it is not a defect.
		assert.equal(evaluateSessionFuse(diagnostics({ lastMissReason: "warmup" }), 128_000).state, "ok");
	});

	it("reports cold_start ahead of near_limit, because the billed prefix is the larger fact", () => {
		const reading = evaluateSessionFuse(diagnostics({ promptTokens: 120_000, lastMissReason: "idle" }), 128_000);
		assert.equal(reading.state, "cold_start");
	});

	it("answers ok for an unknown window rather than a ratio that looks like a measurement", () => {
		for (const window of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			const reading = evaluateSessionFuse(diagnostics({ promptTokens: 200_000, lastMissReason: "idle" }), window);
			// The cold start still reports: it is a fact about the miss, not about the window.
			assert.equal(reading.state, "cold_start", String(window));
			assert.equal(reading.usageRatio, 0, `${window} must not produce a ratio`);
			assert.equal(reading.contextWindowTokens, 0, `${window} must not be echoed as a window`);
		}
		// And with no miss reason and no window, there is nothing to say.
		const quiet = evaluateSessionFuse(diagnostics({ promptTokens: 200_000 }), 0);
		assert.equal(quiet.state, "ok");
		assert.equal(quiet.usageRatio, 0);
	});
});
