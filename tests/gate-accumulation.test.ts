/**
 * Splitting one operation across calls, which is the second evasion the corpus measured.
 *
 * **The shape of the attack.** Every call in the sequence sits inside the per-call limit, so a check that
 * reads one invocation at a time sees a series of well-behaved calls; the sum is what the mode forbade. The
 * measured version (`2609.30217`) is retries and small steps, and it needs no adversarial intent - batching
 * work is what a competent agent does.
 *
 * **The rule this file holds to.** A ceiling a mode declares with `limits[].max` is a ceiling per call *and*
 * per session: the decision reads the sum the session has already recorded plus the value in front of it. The
 * window is the session because that is where the state lives (`design.md`: session-scoped, apart from the
 * message history), and the remedy stays the one the limit gate already gives - do it in one call inside the
 * ceiling, or raise the ceiling through the authority document rather than around it.
 *
 * **What it does not catch, stated rather than implied.** A split whose parts carry no limited argument. That
 * needs a statement of what makes two actions semantically the same, which is the syntax layer's job, not a
 * counting rule's.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createActionPolicy } from "../src/core/action-policy.ts";
import type { GateInvocation } from "../src/core/loop.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

const MODE = {
	id: "fixture",
	description: "a mode with one declared ceiling",
	body: "",
	governanceVersion: "1.0.0",
	frameworkRange: ">=0.2.0 <0.3.0",
	governance: {},
	capabilities: [],
	gateSemantics: "none",
	permissions: { unlisted: "allow", always_allow: [], ask_before: [], never_allow: [] },
	limits: [{ id: "batch", argument: "count", max: 3, tools: ["bulk"] }],
	effectClasses: {},
} as unknown as WorkMode;

const invocation = (count: number, tool = "bulk"): GateInvocation => ({
	tool,
	arguments: { count },
	mode: { id: MODE.id, version: MODE.governanceVersion, governanceVersion: MODE.governanceVersion },
	at: new Date().toISOString(),
	elapsedMs: 0,
	accumulatedIntensity: {},
});

describe("a ceiling is per call and per session", () => {
	it("allows each call on its own, and refuses the one that pushes the session past the ceiling", () => {
		const policy = createActionPolicy({ mode: MODE, workspaceRoot: process.cwd(), registeredCapabilities: [] });

		const first = policy.evaluate(invocation(2), { viaCapability: false });
		assert.equal(first.outcome, "allow", "the first call is inside the ceiling on its own");
		policy.recordRun(invocation(2));

		const second = policy.evaluate(invocation(2), { viaCapability: false });
		assert.equal(second.outcome, "block", "2 + 2 exceeds a ceiling of 3, and the sequence is what the mode forbade");
		if (second.outcome !== "block") throw new Error("unreachable");
		assert.match(second.reason, /cumulat|session|total/iu, "the refusal says it is about the sum, not the call");
		assert.notEqual(second.remediation.trim(), "", "a block without a remedy is the failure this project exists to avoid");
	});

	it("does not count a call it refused, so a refused call cannot spend the ceiling", () => {
		const policy = createActionPolicy({ mode: MODE, workspaceRoot: process.cwd(), registeredCapabilities: [] });
		policy.recordRun(invocation(2));

		const refused = policy.evaluate(invocation(2), { viaCapability: false });
		assert.equal(refused.outcome, "block");
		// A refused call records nothing, which is the existing contract for `recordRun` ("an allowed action
		// that never runs, and a blocked one, must not spend the phase's budget").
		const after = policy.evaluate(invocation(1), { viaCapability: false });
		assert.equal(after.outcome, "allow", "the refused call must not have been counted against the session");
	});

	it("keeps the utility arm: one call inside the ceiling still passes, and a fresh session starts clean", () => {
		const policy = createActionPolicy({ mode: MODE, workspaceRoot: process.cwd(), registeredCapabilities: [] });
		assert.equal(policy.evaluate(invocation(3), { viaCapability: false }).outcome, "allow");

		const fresh = createActionPolicy({ mode: MODE, workspaceRoot: process.cwd(), registeredCapabilities: [] });
		assert.equal(fresh.evaluate(invocation(2), { viaCapability: false }).outcome, "allow", "state is per session, not global");

		// A tool the limit does not name is not accumulated against it.
		const other = policy.evaluate(invocation(9, "read_file"), { viaCapability: false });
		assert.equal(other.outcome, "allow", "a ceiling scoped to one tool must not restrain another");
	});
});
