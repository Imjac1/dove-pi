import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCacheDiagnostics, formatGoalEfficiency, inspectCacheDiagnostics, inspectGoalEfficiency } from "../src/pi-adapter/cache-diagnostics.ts";
import type { ExecutionRecord } from "../src/core/contracts.ts";

describe("cache diagnostics", () => {
	it("distinguishes latest-request hit rate from session hit rate", () => {
		const result = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "p", model: "m", timestamp: 1, usage: { input: 2_000, cacheRead: 0, cacheWrite: 2_000 } } },
			{ type: "message", message: { role: "assistant", provider: "p", model: "m", timestamp: 2_000, usage: { input: 500, cacheRead: 3_500, cacheWrite: 0 } } },
		]);
		assert.equal(result.requestCount, 2);
		assert.equal(result.warmupRequests, 1);
		assert.equal(result.fullMisses, 0);
		assert.equal(result.lastHitRate, 87.5);
		assert.equal(result.sessionHitRate, 43.75);
		assert.equal(result.warmHitRate, 87.5);
		assert.equal(result.recentRequestHits, 1);
		assert.equal(result.recentRequestCount, 2);
		assert.equal(result.recentRequestHitRate, 50);
		assert.match(formatCacheDiagnostics(result), /Last CH 87\.5%/);
		assert.match(formatCacheDiagnostics(result), /Session CH 43\.8%/);
		assert.match(formatCacheDiagnostics(result), /Warm CH 87\.5%/);
	});

	it("reports the exported session reuse rate after excluding cold start", () => {
		const result = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "12321", model: "v4", timestamp: 1, usage: { input: 9_055, cacheRead: 0, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "12321", model: "v4", timestamp: 2, usage: { input: 756, cacheRead: 8_960, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "12321", model: "v4", timestamp: 3, usage: { input: 10_806, cacheRead: 9_472, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "12321", model: "v4", timestamp: 4, usage: { input: 401, cacheRead: 20_224, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "12321", model: "v4", timestamp: 5, usage: { input: 8_211, cacheRead: 20_480, cacheWrite: 0 } } },
		]);
		assert.ok(result.warmHitRate !== undefined && result.warmHitRate > 74 && result.warmHitRate < 75);
		assert.equal(result.warmupRequests, 1);
		assert.equal(result.fullMisses, 0);
		assert.equal(result.recentRequestHitRate, 80);
	});

	it("labels a later zero-read request by model change or idle gap", () => {
		const modelChange = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "p", model: "one", timestamp: 1, usage: { input: 10, cacheRead: 100, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "p", model: "two", timestamp: 2, usage: { input: 110, cacheRead: 0, cacheWrite: 0 } } },
		]);
		assert.equal(modelChange.fullMisses, 1);
		assert.equal(modelChange.lastMissReason, "model-change");

		const idle = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "p", model: "one", timestamp: 1, usage: { input: 10, cacheRead: 100, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "p", model: "one", timestamp: 5 * 60 * 1000 + 2, usage: { input: 110, cacheRead: 0, cacheWrite: 0 } } },
		]);
		assert.equal(idle.lastMissReason, "idle");

		const isoIdle = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "p", model: "one", timestamp: "2026-08-27T00:00:00.000Z", usage: { input: 10, cacheRead: 100, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "p", model: "one", timestamp: "2026-08-27T00:06:00.000Z", usage: { input: 110, cacheRead: 0, cacheWrite: 0 } } },
		]);
		assert.equal(isoIdle.lastMissReason, "idle");
	});

	it("does not infer a Dove prefix change from usage-only evidence", () => {
		const result = inspectCacheDiagnostics([
			{ type: "message", message: { role: "assistant", provider: "p", model: "m", timestamp: 1, usage: { input: 100, cacheRead: 900, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", provider: "p", model: "m", timestamp: 2, usage: { input: 1_000, cacheRead: 0, cacheWrite: 0 } } },
		]);
		assert.equal(result.fullMisses, 1);
		assert.equal(result.lastMissReason, "provider-miss-or-expiry");
	});

	it("ignores non-assistant and zero-usage entries", () => {
		const result = inspectCacheDiagnostics([
			{ type: "message", message: { role: "user", usage: { input: 1, cacheRead: 99, cacheWrite: 0 } } },
			{ type: "message", message: { role: "assistant", usage: { input: 0, cacheRead: 0, cacheWrite: 0 } } },
		]);
		assert.equal(result.requestCount, 0);
		assert.equal(result.lastHitRate, undefined);
		assert.equal(result.sessionHitRate, undefined);
		assert.equal(result.warmHitRate, undefined);
	});

	it("reports uncached cost and first-call reuse per completed goal", () => {
		const record = (kind: ExecutionRecord["kind"], requestId: string, details: Record<string, unknown>): ExecutionRecord => ({
			taskId: "task", stepId: "step", kind, timestamp: "2026-09-01T00:00:00.000Z", mode: "standard",
			correlation: { requestId, sessionId: "session" }, details,
		});
		const result = inspectGoalEfficiency([
			record("request.planned", "one", {}),
			record("provider.request.completed", "one", { usage: { input: 8_000, cacheRead: 0 } }),
			record("runtime.phase.completed", "one", { phase: "tool", name: "ask_user_question" }),
			record("request.terminal", "one", { reason: "completed" }),
			record("request.planned", "two", { continuedFromRequestId: "one" }),
			record("provider.request.completed", "two", { usage: { input: 500, cacheRead: 9_000 } }),
			record("provider.request.completed", "two", { usage: { input: 300, cacheRead: 9_500 } }),
			record("runtime.phase.completed", "two", { phase: "tool", name: "write" }),
			record("request.terminal", "two", { reason: "completed" }),
			record("request.planned", "three", {}),
			record("provider.request.completed", "three", { usage: { input: 2_000, cacheRead: 0 } }),
			record("request.terminal", "three", { reason: "cancelled" }),
		], "session");
		assert.equal(result.goalCount, 2);
		assert.equal(result.completedGoalCount, 1);
		assert.equal(result.cancelledGoalCount, 1);
		assert.equal(result.providerRounds, 4);
		assert.equal(result.toolCalls, 2);
		assert.equal(result.questionCalls, 1);
		assert.equal(result.uncachedInputTokens, 10_800);
		assert.equal(result.uncachedInputPerCompletedGoal, 10_800);
		assert.equal(result.warmFirstCallHitRate, 50);
		assert.equal(result.coldFirstCallCount, 2);
		assert.match(formatGoalEfficiency(result), /Uncached\/completed 11k/);
		assert.match(formatGoalEfficiency(result), /Warm first-call 50\.0% \(1\/2\)/);
	});
});
