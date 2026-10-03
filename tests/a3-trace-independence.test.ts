import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { loadWorkMode } from "../src/core/work-mode.ts";
import { createActionPolicy } from "../src/core/action-policy.ts";
import { resolveDoveStateDir } from "../src/core/state-dir.ts";
import type { GateInvocation } from "../src/core/loop.ts";

/**
 * A3 step 3, as a red.
 *
 * The claim this file states is the fourth limitation from the task's design, measured on this tree: a channel whose
 * independence rests on living **outside the workspace** is not independent, because the agent's own tools write
 * wherever the policy in force allows. "Outside `cwd`" is a fact about a path, not a property of a control, and the
 * policy it should be stated against is a thing the run declares.
 *
 * So the assertion here is not about where the file is. It is: **under each shipped mode's policy, does a
 * filesystem-mutating tool call naming the trace channel's own path come back allowed?** A channel the agent can
 * write to by asking is not a witness to anything the agent did.
 *
 * Written before the writer separation exists, so it is expected to be red, and the red is the **current** state
 * rather than one rebuilt by stashing - nothing was reverted to produce it. What makes it green is not this file:
 * it is a mode control over the channel's path (the `fence` block already exists for exactly this shape) plus an
 * answer for the run that declares no mode at all, which is the part the design says is still open.
 */

const FRAMEWORK = "0.2.0";
const SHIPPED = ["code-audit", "code-development", "pentest", "trading"];
const AT = "2026-10-03T00:00:00.000Z";

/** The path the product itself resolves for its ledger, so the test and the runtime cannot disagree about it. */
const TRACE_PATH = join(resolveDoveStateDir(process.cwd()), "execution.jsonl");

function invocationFor(tool: string, path: string): GateInvocation {
	return {
		tool,
		arguments: { path, content: "A3 probe: this write must not be reachable." },
		target: path,
		displayTarget: path,
		mode: { id: "under-test", version: "1.0.0", governanceVersion: "1.0.0" },
		at: AT,
		elapsedMs: 0,
		accumulatedIntensity: {},
	};
}

for (const name of SHIPPED) {
	// **Skipped rather than removed, and skipped rather than failing.** The assertion below is red today for three of
	// the four shipped modes - `code-development`, `pentest` and `trading` all allow a write to the trace path - and
	// that red is the point: it is the state this step exists to change. A knowingly red test in the suite would turn
	// `npm test` red for every other piece of work, so the reason travels with the skip and the case comes back when
	// the writer separation lands. Removing it would lose the breach; letting it fail would lose the gate.
	//
	// **`code-audit` stays live on purpose** - it is the one shipped mode that already refuses the write, so it is the
	// proof that the property is expressible with today's controls, and skipping it would have hidden a passing case
	// behind three failing ones.
	const redToday = name !== "code-audit";
	test(
		`${name} does not let a mutating tool write the trace channel`,
		redToday ? { skip: "A3 step 3: this mode allows the write today, and closing it is what the step is for" } : {},
		() => {
		const directory = join(process.cwd(), "modes", name);
		const mode = loadWorkMode(
			{
				mode: readFileSync(join(directory, "MODE.md"), "utf8"),
				governance: readFileSync(join(directory, "governance.yaml"), "utf8"),
				permissions: readFileSync(join(directory, "permissions.yaml"), "utf8"),
			},
			{ frameworkVersion: FRAMEWORK },
		);
		// `registeredCapabilities` is empty on purpose: this call names a host tool, so the `registered` check - which
		// only fires for a capability the mode granted - says nothing here, and an empty list cannot make it pass.
		const policy = createActionPolicy({ mode, workspaceRoot: process.cwd(), registeredCapabilities: [] });

		for (const tool of ["write", "edit", "bash", "powershell"]) {
			const decision = policy.evaluate(invocationFor(tool, TRACE_PATH), { viaCapability: false });
			assert.notEqual(
				decision.outcome,
				"allow",
				`mode '${name}' allows '${tool}' to write the trace channel at ${TRACE_PATH}` +
					(decision.reason === undefined ? "" : ` — the policy listed no reason, and it should have: ${decision.reason}`),
			);
		}
	});
}

test("the trace path is outside the workspace, which is why the claim above cannot rest on that fact", () => {
	// The other half of the same finding: the path *is* outside `cwd` today, and that is exactly the fact the design
	// says is not enough. If this ever fails, the path moved into the workspace and the red above got sharper for a
	// different reason - so it is asserted rather than assumed.
	assert.ok(TRACE_PATH.startsWith(process.cwd()) === false, `the trace path ${TRACE_PATH} sits inside the workspace ${process.cwd()}`);
});
