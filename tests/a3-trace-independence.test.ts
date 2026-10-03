import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
	// **No mode needs to declare anything for this to hold.** The runtime holds its own state root, so the property
	// is the same under all four shipped modes and a fifth mode cannot break it by forgetting. What still varies by
	// mode is the shell, and that gap has its own case below rather than being folded in here.
	test(
		`${name} does not let a mutating tool write the trace channel`,
		{},
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

		// **The tools whose target the runtime can read.** `replace`, `insert` and `notebook_edit` are mutators the
		// built-in map does not carry, and the map's smallness is deliberate: the installed catalog holds 57 tool names
		// the repository cannot read schemas for, so "which other tools mutate, and where is their path" is a claim it
		// cannot back. A mode that wants them covered declares `fence.targets`, which wins over the built-in map.
		for (const tool of ["write", "edit"]) {
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

test("a mode that declares no fence at all still cannot write the runtime's own state root", () => {
	// **(b) from the walk's report.** A fence protects only what a mode declares, so a mode that declares nothing -
	// or the next mode somebody adds and forgets - leaves the runtime's own evidence surface writable. The channel's
	// root is the runtime's, not the mode's, so the runtime is what should hold it: no new syntax for a mode author to
	// get wrong, and nothing to forget.
	const mode = loadWorkMode(
		{
			mode: "---\nname: plain\ndescription: A mode with no fence and an unrestricted filesystem.\nlicense: MIT\ncompatibility: fixture\n---\n\nProbe.\n",
			governance: [
				"version: 1.0.0",
				`framework: ">=0.2.0 <0.3.0"`,
				"scope:",
				"  targets: [repository]",
				"  environment: non-production",
				"  exclusions: []",
				"authority:",
				"  capabilities: [source.read]",
				"gate:",
				"  semantics: none",
				"sandbox:",
				"  network: none",
				"  filesystem: unrestricted",
			].join("\n"),
			permissions: "unlisted: allow\nask_before: []\nnever_allow: []\n",
		},
		{ frameworkVersion: FRAMEWORK },
	);
	const policy = createActionPolicy({ mode, workspaceRoot: process.cwd(), registeredCapabilities: [] });
	// **The tools this repository has verified a target for, and only those.** The set is narrower than the list of
	// filesystem mutators, and the difference is measured rather than overlooked: `replace`, `insert` and
	// `notebook_edit` are mutators the built-in target map does not carry, so the check cannot see which path they
	// name and neither can this test - the host bundle exposes no readable schema for them, so their argument names
	// cannot be verified from here. They belong in the limitation with the shell tools, not behind a green case.
	for (const tool of ["write", "edit"]) {
		const decision = policy.evaluate(invocationFor(tool, TRACE_PATH), { viaCapability: false });
		assert.notEqual(
			decision.outcome,
			"allow",
			`mode 'plain' declares no fence and allows '${tool}' to write the runtime's own state root at ${TRACE_PATH}`,
		);
	}
});

test("the shell is the gap this control does not cover, and this case holds it in place", () => {
	// **A case that asserts the limitation, on purpose.** A shell command writes wherever it likes and nothing in the
	// policy can see which path it names, so `bash` and `powershell` are allowed to write the runtime's state root
	// even after the runtime started holding it. The only control that covers them is a mode giving up the shell
	// altogether - `fence.shell: denied` - which a mode whose work is running the project's tests cannot do.
	//
	// This asserts that the write **is** allowed, which reads backwards until you see what it buys: the gap cannot be
	// closed silently, because closing it turns this case red and whoever closes it must come here and say so. The
	// alternative - a skipped case - would let the gap close without anyone noticing the limitation had changed.
	const mode = loadWorkMode(
		{
			mode: "---\nname: plain\ndescription: A mode with no fence and an unrestricted filesystem.\nlicense: MIT\ncompatibility: fixture\n---\n\nProbe.\n",
			governance: [
				"version: 1.0.0",
				`framework: ">=0.2.0 <0.3.0"`,
				"scope:",
				"  targets: [repository]",
				"  environment: non-production",
				"  exclusions: []",
				"authority:",
				"  capabilities: [source.read]",
				"gate:",
				"  semantics: none",
				"sandbox:",
				"  network: none",
				"  filesystem: unrestricted",
			].join("\n"),
			permissions: "unlisted: allow\nask_before: []\nnever_allow: []\n",
		},
		{ frameworkVersion: FRAMEWORK },
	);
	const policy = createActionPolicy({ mode, workspaceRoot: process.cwd(), registeredCapabilities: [] });
	for (const tool of ["bash", "powershell"]) {
		const decision = policy.evaluate(invocationFor(tool, TRACE_PATH), { viaCapability: false });
		assert.equal(
			decision.outcome,
			"allow",
			`'${tool}' is no longer allowed to write the runtime's state root (it answered '${decision.outcome}'): the shell gap has been closed, so this case and the limitation that records it both need updating`,
		);
	}
});

test("the trace path is outside the workspace, which is why the claim above cannot rest on that fact", () => {
	// The other half of the same finding: the path *is* outside `cwd` today, and that is exactly the fact the design
	// says is not enough. If this ever fails, the path moved into the workspace and the red above got sharper for a
	// different reason - so it is asserted rather than assumed.
	assert.ok(TRACE_PATH.startsWith(process.cwd()) === false, `the trace path ${TRACE_PATH} sits inside the workspace ${process.cwd()}`);
});

test("a fence entry can name a path outside the workspace", () => {
	// **Red before the change, and the change is ① from the walk's report.** The mechanism exists and refuses writes
	// into paths it names, but every comparison it makes happens after the target has been reduced to a
	// workspace-relative form - and a target outside the workspace has no such form, so the fence sees `undefined` and
	// lets the write through. An absolute entry survives normalisation (`normalizeFencePath` strips `./`, trailing
	// `/*` and `/**`, and nothing else), so the gap is in the comparison rather than in the declaration.
	//
	// This case is deliberately narrow: it asserts the mechanism, on a path under the operating system's temp
	// directory, so it does not depend on where this machine keeps the runtime's state root.
	const outside = join(tmpdir(), "dove-fence-probe", "execution.jsonl");
	// **Forward slashes in the YAML, and that is not cosmetic.** A double-quoted YAML scalar reads `\U` as an escape,
	// so a Windows path written with backslashes makes the whole document unparseable - which is how the first run of
	// this case failed, for a reason that had nothing to do with the fence. The runtime normalises the two spellings
	// to one anyway (`normalizeFencePath` turns backslashes into slashes), so writing the slash form here tests the
	// same path and cannot silently become a test of the parser.
	const outsideDeclared = join(tmpdir(), "dove-fence-probe").replace(/\\/gu, "/");
	const mode = loadWorkMode(
		{
			mode: "---\nname: fenced-outside\ndescription: A mode that fences a path outside its workspace.\nlicense: MIT\ncompatibility: fixture\n---\n\nProbe.\n",
			governance: [
				"version: 1.0.0",
				`framework: ">=0.2.0 <0.3.0"`,
				"scope:",
				"  targets: [repository]",
				"  environment: non-production",
				"  exclusions: []",
				"authority:",
				"  capabilities: [source.read]",
				"gate:",
				"  semantics: none",
				"fence:",
				`  paths: ["${join(tmpdir(), "dove-fence-probe").replace(/\\/gu, "/")}"]`,
				"  shell: uncovered",
				"sandbox:",
				"  network: none",
				"  filesystem: unrestricted",
			].join("\n"),
			permissions: "unlisted: allow\nask_before: []\nnever_allow: []\n",
		},
		{ frameworkVersion: FRAMEWORK },
	);
	const policy = createActionPolicy({ mode, workspaceRoot: process.cwd(), registeredCapabilities: [] });
	const decision = policy.evaluate(invocationFor("write", outside), { viaCapability: false });
	assert.equal(
		decision.outcome,
		"block",
		`a fence over ${join(tmpdir(), "dove-fence-probe")} did not refuse a write to ${outside}: the policy answered '${decision.outcome}'`,
	);
});
