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
			tokens: 160_000,
			contextWindow: 1_000_000,
			mode: "ultra",
		});
		assert.equal(guard.compactAdvised, true);
		assert.ok(guard.hint!.includes("160,000"));
	});

	it("does not advise below the absolute soft cap on a wide window", () => {
		const guard = guardContext({
			tokens: 30_000,
			contextWindow: 1_000_000,
			mode: "ultra",
		});
		assert.equal(guard.compactAdvised, false);
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
			messagesAdvised: false,
			messageCount: undefined,
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

	it("advises on the turn count, and names both ways out without taking either", () => {
		withEnv({ DOVE_PI_MAX_MESSAGES: "120" }, () => {
			const under = guardContext({ tokens: 30_000, contextWindow: 1_000_000, messages: 120, mode: "standard" });
			assert.equal(under.messagesAdvised, false, "the cap is reached at 120, not below it");
			assert.equal(under.compactAdvised, false, "and nothing else fires either");
			const over = guardContext({ tokens: 30_000, contextWindow: 1_000_000, messages: 121, mode: "standard" });
			assert.equal(over.messagesAdvised, true);
			assert.equal(over.compactAdvised, true, "the cap advises through the same field the adapter already surfaces");
			assert.equal(over.messageCount, 121);
			assert.match(over.hint ?? "", /\/compact/, "it names the first way out");
			assert.match(over.hint ?? "", /新的会话|new session/, "and the second");
		});
	});

	it("stays quiet on the turn count when the caller does not supply one", () => {
		withEnv({ DOVE_PI_MAX_MESSAGES: "1" }, () => {
			// The control: with the cap set to 1 a supplied count would fire, so silence means the absence, not the value.
			const guard = guardContext({ tokens: 30_000, contextWindow: 1_000_000, mode: "standard" });
			assert.equal(guard.messagesAdvised, false);
			assert.equal(guard.messageCount, undefined, "a count nobody supplied is not invented");
			assert.equal(guardContext({ tokens: 30_000, contextWindow: 1_000_000, messages: 2, mode: "standard" }).messagesAdvised, true);
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
