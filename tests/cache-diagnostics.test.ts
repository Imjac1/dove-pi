import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCacheDiagnostics, inspectCacheDiagnostics } from "../src/pi-adapter/cache-diagnostics.ts";

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
});
