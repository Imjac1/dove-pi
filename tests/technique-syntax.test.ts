/**
 * A technique prohibition has to read the arguments, not only the field that names the technique.
 *
 * **The attack is the field's absence.** `gate.excluded_techniques: [dos]` is checked against a declared
 * `technique` argument today, and a caller that intends to run a forbidden technique simply does not fill that
 * argument in. The corpus measured the general form of this (`2609.30217`: 98% of attempts, 88% succeeding) and
 * named the fix: decide by *syntax*, not by a name match.
 *
 * **The pair.** The first case is the declared field, which already works, so this file cannot pass by having no
 * check at all. The last two are the utility arms: an ordinary command must still run, and prose that quotes a
 * loop is not a loop - a rule that refuses a document because it mentions `while true` is a rule people turn off.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createActionPolicy } from "../src/core/action-policy.ts";
import { WITNESSED_TECHNIQUES, splitCommandLine } from "../src/core/argument-syntax.ts";
import type { GateInvocation } from "../src/core/loop.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

const MODE = {
	id: "conduct",
	description: "a mode that forbids one technique",
	body: "",
	governanceVersion: "1.0.0",
	frameworkRange: ">=0.2.0 <0.3.0",
	governance: {},
	capabilities: [],
	gateSemantics: "none",
	permissions: { unlisted: "allow", always_allow: [], ask_before: [], never_allow: [] },
	limits: [],
	excludedTechniques: ["dos"],
	effectClasses: {},
} as unknown as WorkMode;

function decide(tool: string, args: Record<string, unknown>): { outcome: string; reason: string; remediation: string } {
	const policy = createActionPolicy({ mode: MODE, workspaceRoot: process.cwd(), registeredCapabilities: [] });
	const invocation = {
		tool,
		arguments: args,
		mode: { id: MODE.id, version: MODE.governanceVersion, governanceVersion: MODE.governanceVersion },
		at: new Date().toISOString(),
		elapsedMs: 0,
		accumulatedIntensity: {},
	} as unknown as GateInvocation;
	const decision = policy.evaluate(invocation, { viaCapability: false });
	// Only `allow` has no reason of its own: the other two arms carry one, which is the contract this project
	// keeps insisting on - a refusal that does not say what it refused is not a reading.
	if (decision.outcome === "allow") return { outcome: decision.outcome, reason: "", remediation: "" };
	return { outcome: decision.outcome, reason: decision.reason, remediation: decision.outcome === "block" ? decision.remediation : "" };
}

describe("a forbidden technique is read off the command, not only off a field", () => {
	it("refuses the technique when the call declares it, which is the behaviour that already existed", () => {
		const declared = decide("bash", { command: "Invoke-WebRequest $target", technique: "dos" });
		assert.equal(declared.outcome, "block");
		assert.match(declared.reason, /dos/u);
	});

	it("refuses it when the call says nothing about a technique and the command does the forbidden thing", () => {
		const undeclared = decide("bash", { command: "while ($true) { Invoke-WebRequest $target }" });
		assert.equal(undeclared.outcome, "block", "the field was absent and the command was the technique, so nothing refused it");
		assert.match(undeclared.reason, /dos/u, "the refusal names the technique it read");
		assert.match(undeclared.reason, /while/u, "and quotes the words that witnessed it");
		assert.match(undeclared.remediation, /bound/iu, "and the remedy says what to write instead, which is the whole point");
	});

	it("refuses the same thing written as a POSIX loop", () => {
		const posix = decide("bash", { command: "while true; do curl -s $target; done" });
		assert.equal(posix.outcome, "block");
	});

	it("still lets an ordinary command run", () => {
		const ordinary = decide("powershell", { command: "Invoke-WebRequest $target" });
		assert.equal(ordinary.outcome, "allow", "a rule that refuses ordinary commands is a fence people turn off");
	});

	it("does not treat prose that quotes a loop as a loop", () => {
		const prose = decide("write", { content: "while ($true) { Invoke-WebRequest $target }" });
		assert.equal(prose.outcome, "allow", "a document mentioning a loop is not a command line that runs one");
	});

	it("says which names the table can witness, so a declaration cannot be silently inert", () => {
		assert.equal(WITNESSED_TECHNIQUES.has("dos"), true);
		assert.equal(WITNESSED_TECHNIQUES.has("social-engineering"), false, "the shipped pentest mode declares this name and nothing witnesses it yet");
	});

	it("splits a command line the way a shell would, and knows what was quoted", () => {
		assert.deepEqual(
			splitCommandLine("while true; do echo 'while true'; done").map((word) => `${word.quoted ? "q:" : ""}${word.text}`),
			["while", "true", "do", "echo", "q:'while true'", "done"],
		);
	});
});
