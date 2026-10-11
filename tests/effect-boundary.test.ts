import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { temporaryDirectory } from "./temporary-directory.ts";
import assert from "node:assert/strict";
import { argumentsDigest, createEffectBoundary } from "../src/core/effect-boundary.ts";
import { deriveEffectKey } from "../src/core/effect-ledger.ts";
import { createFileEffectStore } from "../src/core/effect-store-file.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

const NOW = "2026-09-26T12:00:00.000Z";

function mode(effectClasses: WorkMode["effectClasses"]): WorkMode {
	return {
		id: "code-audit",
		description: "review a repository",
		body: "",
		governanceVersion: "1.4.0",
		frameworkRange: ">=0.2.0 <0.3.0",
		governance: {},
		capabilities: ["read", "edit", "code-audit.diff"],
		gateSemantics: "conformance",
		permissions: { unlisted: "allow", always_allow: [], ask_before: [], never_allow: ["bash", "powershell"] },
		limits: [],
		effectClasses,
	};
}

function boundary(effectClasses: WorkMode["effectClasses"] = { read: "idempotent", "code-audit.diff": "idempotent" }) {
	const directory = join(temporaryDirectory("dove-boundary-"), "effects");
	const store = createFileEffectStore({ directory });
	return { boundary: createEffectBoundary({ engagement: "eng-1", mode: mode(effectClasses), store, now: () => NOW }), directory, mode: mode(effectClasses) };
}

describe("effect boundary: the claim guards the resumption path, not a deliberate repeat", () => {
	it("never refuses on a first attempt, because there is no earlier attempt to duplicate", async () => {
		const { boundary: effects } = boundary();
		const first = await effects.prepare({ action: "code-audit.diff", arguments: { roots: ["src"] }, replayed: false });
		assert.equal(first.dispatch, true, JSON.stringify(first));
		assert.equal(first.effectClass, "idempotent");
		assert.equal(first.declared, true);
	});

	it("dispatches the same call twice in one attempt, which is what a model legitimately does", async () => {
		// This is the case an argument-derived identity cannot tell from a replay, and the one that would break
		// ordinary work if the claim refused it. Reading the same file twice must keep working.
		const { boundary: effects } = boundary();
		const args = { path: "README.md" };
		const first = await effects.prepare({ action: "read", arguments: args, replayed: false });
		const second = await effects.prepare({ action: "read", arguments: args, replayed: false });
		assert.equal(first.dispatch, true);
		assert.equal(second.dispatch, true, "a deliberate repeat is not a duplicate dispatch");
	});

	it("refuses a replayed dispatch whose class says a second run is not harmless", async () => {
		const { boundary: effects } = boundary({ edit: "non-idempotent" });
		const args = { path: "src/a.ts", find: "x", replace: "y" };
		await effects.prepare({ action: "edit", arguments: args, replayed: false });
		await effects.complete(deriveEffectKey({ engagement: "eng-1", mode: { id: "code-audit", version: "1.4.0", governanceVersion: "1.4.0" }, tool: "edit", argumentsDigest: argumentsDigest(args) }), "completed");
		const replayed = await effects.prepare({ action: "edit", arguments: args, replayed: true });
		assert.equal(replayed.dispatch, false, "an edit replayed by a retry can apply twice");
		assert.match(replayed.refusal ?? "", /already reached dispatch/);
		assert.match(replayed.refusal ?? "", /completed/, "and it reports the outcome the earlier attempt recorded");
	});

	it("lets a retryable class re-dispatch on a replay, because the class is the reason that is safe", async () => {
		const { boundary: effects } = boundary({ "code-audit.diff": "idempotent" });
		const args = { roots: ["src"] };
		const first = await effects.prepare({ action: "code-audit.diff", arguments: args, replayed: false });
		await effects.complete(first.effectKey, "completed");
		const replayed = await effects.prepare({ action: "code-audit.diff", arguments: args, replayed: true });
		assert.equal(replayed.dispatch, true);
	});

	it("treats an undeclared action as non-idempotent, so an omission cannot grant a retry", async () => {
		const { boundary: effects } = boundary({ read: "idempotent" });
		const args = { command: "npm test" };
		await effects.prepare({ action: "bash", arguments: args, replayed: false });
		const replayed = await effects.prepare({ action: "bash", arguments: args, replayed: true });
		assert.equal(replayed.dispatch, false);
		assert.equal(replayed.declared, false, "and the refusal says the class was not declared: " + replayed.refusal);
		assert.match(replayed.refusal ?? "", /undeclared/);
	});

	it("refuses a claim whose record cannot be read, on any attempt", async () => {
		const { boundary: effects, directory } = boundary();
		const args = { path: "src/a.ts" };
		const digest = argumentsDigest(args);
		const effectKey = deriveEffectKey({ engagement: "eng-1", mode: { id: "code-audit", version: "1.4.0", governanceVersion: "1.4.0" }, tool: "read", argumentsDigest: digest });
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, effectKey + ".json"), "");
		const decision = await effects.prepare({ action: "read", arguments: args, replayed: false });
		assert.equal(decision.dispatch, false, "an unreadable claim is never a permission");
		assert.match(decision.refusal ?? "", /cannot be read/);
	});

	it("identifies an action by its arguments and not by the order they were written", () => {
		assert.equal(argumentsDigest({ a: 1, b: { c: 2, d: 3 } }), argumentsDigest({ b: { d: 3, c: 2 }, a: 1 }));
		assert.notEqual(argumentsDigest({ a: 1 }), argumentsDigest({ a: 2 }));
	});

	it("reads an interrupted dispatch as unknown rather than as absent or failed", async () => {
		const { boundary: effects } = boundary();
		const decision = await effects.prepare({ action: "code-audit.diff", arguments: { roots: ["src"] }, replayed: false });
		assert.equal(await effects.ledger.outcomeOf(decision.effectKey), "unknown", "claimed and never completed is the fact");
		await effects.complete(decision.effectKey, "completed");
		assert.equal(await effects.ledger.outcomeOf(decision.effectKey), "completed");
	});
});
