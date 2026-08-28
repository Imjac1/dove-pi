import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	guardContext,
	type ContextGuard,
} from "../src/pi-adapter/context-guard.ts";

function withEnv(
	entries: Record<string, string | undefined>,
	fn: () => void,
): void {
	const previous = new Map<string, string | undefined>();
	for (const [key, value] of Object.entries(entries)) {
		previous.set(key, process.env[key]);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	try {
		fn();
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

describe("context guard (prefix fuse)", () => {
	it("does not advise below the 82% window fraction", () => {
		const guard = guardContext({
			tokens: 24_000,
			contextWindow: 32_000,
			mode: "ultra",
		});
		assert.equal(guard.compactAdvised, false);
		assert.equal(guard.fractionUsed, 0.75);
	});

	it("advises compaction when the prefix reaches the window fraction threshold", () => {
		const guard = guardContext({
			tokens: 28_000,
			contextWindow: 32_000,
			mode: "ultra",
		});
		assert.equal(guard.compactAdvised, true);
		assert.ok(guard.hint);
		assert.ok(guard.hint!.includes("/compact"));
		assert.equal(guard.fractionUsed, 0.875);
	});

	it("advises on the absolute soft cap even for very wide windows", () => {
		const guard = guardContext({
			tokens: 30_000,
			contextWindow: 200_000,
			mode: "ultra",
		});
		assert.equal(guard.compactAdvised, true);
		assert.ok(guard.hint!.includes("30,000"));
	});

	it("is a no-op when tokens are unknown", () => {
		const guard = guardContext({
			tokens: null,
			contextWindow: undefined,
			mode: "standard",
		});
		assert.deepEqual(guard, {
			compactAdvised: false,
			hint: undefined,
			fractionUsed: undefined,
		});
	});

	it("can be disabled with DOVE_PI_PREFIX_FUSE=0", () => {
		withEnv({ DOVE_PI_PREFIX_FUSE: "0" }, () => {
			const guard = guardContext({
				tokens: 999_999,
				contextWindow: 1_000_000,
				mode: "ultra",
			});
			assert.equal(guard.compactAdvised, false);
			assert.equal(guard.hint, undefined);
		});
	});

	it("respects a custom fraction threshold from the environment", () => {
		withEnv({ DOVE_PI_MAX_CONTEXT_FRACTION: "0.5" }, () => {
			const guard = guardContext({
				tokens: 18_000,
				contextWindow: 32_000,
				mode: "ultra",
			});
			assert.equal(guard.compactAdvised, true);
		});
	});

	it("is advisory-only: never mutates or drops anything (type-level contract)", () => {
		const guard: ContextGuard = guardContext({
			tokens: 30_000,
			contextWindow: 32_000,
			mode: "ultra",
		});
		assert.equal(typeof guard.compactAdvised, "boolean");
		assert.equal(typeof guard.fractionUsed, "number");
		assert.equal(typeof guard.hint, "string");
	});
});
