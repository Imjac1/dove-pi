/**
 * A junction inside the workspace names a fenced file without spelling it.
 *
 * **Why this is the same defect as the Win32 spellings, one step further.** `2609.30217`'s evasion is spelled
 * "encode the forbidden command", and the cheapest encodings are the ones the platform performs for free: a
 * trailing dot, an extended-length prefix, or - here - a directory alias. `mklink /J` needs no administrator
 * (measured: status 0), and a junction is not a shortcut the agent has to lie about: `link\harness-surface.yaml`
 * is a path the filesystem resolves to the fenced file while a lexical comparison reads it as somewhere else.
 *
 * **The pair.** The first case is the control - the fenced file spelled directly is refused, so this file cannot
 * pass by having a fence that refuses nothing. The third case is the utility arm - a file behind the same
 * junction that the fence does *not* name must still be writable, because canonicalizing everything into a
 * refusal would be an availability failure wearing a boundary's clothes.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createActionPolicy } from "../src/core/action-policy.ts";
import type { GateInvocation } from "../src/core/loop.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

const root = mkdtempSync(join(tmpdir(), "fence-junction-"));
const aliased = join(root, "link");
const fenced = join(".trellis", "harness-surface.yaml");

const MODE = {
	id: "fenced",
	description: "a mode that fences one file",
	body: "",
	governanceVersion: "1.0.0",
	frameworkRange: ">=0.2.0 <0.3.0",
	governance: {},
	capabilities: [],
	gateSemantics: "none",
	permissions: { unlisted: "allow", always_allow: [], ask_before: [], never_allow: [] },
	limits: [],
	fence: { paths: [".trellis/harness-surface.yaml"], shell: "uncovered", targets: { probe_write: "path" } },
	effectClasses: {},
} as unknown as WorkMode;

function verdict(target: string): string {
	const policy = createActionPolicy({ mode: MODE, workspaceRoot: root, registeredCapabilities: [] });
	const invocation = {
		tool: "probe_write",
		arguments: { path: target },
		mode: { id: MODE.id, version: MODE.governanceVersion, governanceVersion: MODE.governanceVersion },
		at: new Date().toISOString(),
		elapsedMs: 0,
		accumulatedIntensity: {},
	} as unknown as GateInvocation;
	return policy.evaluate(invocation, { viaCapability: false }).outcome;
}

describe("a directory alias is not a way around the fence", () => {
	before(() => {
		mkdirSync(join(root, ".trellis"), { recursive: true });
		writeFileSync(join(root, fenced), "version: 1\n", "utf8");
		writeFileSync(join(root, ".trellis", "unfenced.md"), "notes\n", "utf8");
		// `mklink` is a cmd builtin, and the command line has to survive Node's argument escaping intact: the
		// recorded lesson in this repository is that it takes windowsVerbatimArguments, which is a spawn option
		// and not an execFile one. Output is discarded rather than piped, so the fixture does not depend on
		// whether this process may open a pipe.
		const made = spawnSync("cmd", ["/c", `mklink /J "${aliased}" "${join(root, ".trellis")}"`], { windowsVerbatimArguments: true, stdio: "ignore" });
		assert.equal(made.status, 0, "the fixture junction could not be created, so every case below would pass vacuously");
	});

	after(() => {
		// A junction must be removed as a link, not walked: a recursive delete would follow it into the target.
		if (existsSync(aliased)) rmdirSync(aliased);
		rmSync(root, { recursive: true, force: true });
	});

	it("refuses the fenced file spelled directly, which is the control", () => {
		assert.equal(verdict(fenced), "block");
	});

	it("refuses it when a junction names it instead", () => {
		assert.equal(existsSync(aliased), true, "the fixture junction was not created, so this case would pass vacuously");
		assert.equal(verdict(join("link", "harness-surface.yaml")), "block", "an alias named the fenced file and the fence did not see it");
	});

	it("still allows a file behind the same junction that the fence does not name", () => {
		assert.equal(verdict(join("link", "unfenced.md")), "allow");
	});

	it("leaves the target of the alias alone when the link goes away", () => {
		// The cleanup above is load-bearing: `rmSync(..., {recursive: true})` follows a junction and would delete
		// the fenced file's directory through it. Asserting this keeps the fixture honest about being a link.
		rmdirSync(aliased);
		assert.equal(existsSync(join(root, fenced)), true, "removing the junction removed the file it pointed at");
	});
});
