/**
 * The narrowest end-to-end turn, as a paired reading.
 *
 * **The design of the pair.** One scripted provider, run twice through the same loop with the same tool and
 * the same prompt; the only variable is the mode's `never_allow`. The provider is deterministic and offline
 * (`src/adapters/loop-scripted.ts` says exactly this is why it exists), so a difference between the two
 * runs can only have come from the gate.
 *
 * **Why `executedActions` and not "the tool was called".** The field's own doc comment in `src/core/loop.ts`
 * says what it counts: actions that actually reached `executeTool`. A loop that merely decided to run
 * something cannot satisfy it.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAxiTurn } from "../src/commands/axi-turn.ts";

const root = join(tmpdir(), `axi-turn-${String(process.pid)}`);

/** A workspace with one readable file, and a mode whose `never_allow` is the only thing that changes. */
function writeFixture(directory: string, neverAllow: readonly string[], turns?: number): string {
	const workspace = join(directory, "workspace");
	mkdirSync(join(workspace, "notes"), { recursive: true });
	writeFileSync(join(workspace, "notes", "reading.txt"), "the turn read this file\n", "utf8");

	const mode = join(workspace, "modes", "reading");
	mkdirSync(mode, { recursive: true });
	writeFileSync(
		join(mode, "MODE.md"),
		["---", "name: reading", "description: A fixture mode for the narrowest turn.", "license: MIT", "---", "", "One read-only action.", ""].join("\n"),
	);
	writeFileSync(
		join(mode, "governance.yaml"),
		[
			"version: 1.0.0",
			'framework: ">=0.2.0 <0.3.0"',
			"scope:",
			"  targets: [workspace]",
			"  environment: non-production",
			"  exclusions: []",
			"authority:",
			// No `grant`: this mode names no engagement and has no capabilities to check against one, and a name that
			// resolves to nothing reads as authority nobody granted - the loader refuses one now. `local-fixture` was
			// decoration here from the day it was written.
			"  capabilities: []",
			// No `expires`: the loader refuses a mode-level expiry, because a calendar window is a property of the
			// engagement document's grant and this runtime cannot honour it in the mode. This fixture declared one
			// from the day it was written, when the field did nothing.
			// **The mode's own turn budget, when a case asks for one.** The reference loop reads it, and a bound *smaller
			// than the default* is what makes the wiring observable: with the default four the scripted run completes,
			// with one it stops first.
			...(turns === undefined ? [] : ["session:", "  budget:", "    turns: " + String(turns)]),
			"gate:",
			"  semantics: none",
			// No `approval`: nothing read it, and the loader refuses it now - a mode's consent stance is its permissions.
			"",
		].join("\n"),
	);
	writeFileSync(
		join(mode, "permissions.yaml"),
		["unlisted: allow", "always_allow: []", "ask_before: []", "never_allow: [" + neverAllow.join(", ") + "]", ""].join("\n"),
	);
	return workspace;
}

describe("the narrowest end-to-end turn", () => {
	before(() => {
		rmSync(root, { recursive: true, force: true });
		mkdirSync(root, { recursive: true });
	});

	after(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("stops at the mode's own turn budget, which is the one loop this runtime owns", async () => {
		// **My claim that this had no observable seam was false**, and the check proved it with a probe rather than an
		// argument: the scripted fixture takes two provider steps, so a budget smaller than the default is visible in the
		// stop reason. This case is what replaced the claim.
		const boundedWorkspace = writeFixture(join(root, "bounded"), [], 1);
		const bounded = await runAxiTurn({
			workspaceRoot: boundedWorkspace,
			modeName: "reading",
			ledgerPath: join(root, "bounded.jsonl"),
			prompt: "read the reading",
		});
		assert.equal(bounded.outcome.stopReason.kind, "maxTurns", "a mode asking for one turn is stopped by a bound of one");

		// The pair, in the same case: same fixture, same prompt, no budget declared - so the default bound applies and the
		// run completes. Only the mode's own number differs, which is what makes this a reading rather than an assertion
		// about the fixture.
		const defaultWorkspace = writeFixture(join(root, "default"), []);
		const unbounded = await runAxiTurn({
			workspaceRoot: defaultWorkspace,
			modeName: "reading",
			ledgerPath: join(root, "default.jsonl"),
			prompt: "read the reading",
		});
		assert.equal(unbounded.outcome.stopReason.kind, "completed", "without a declared budget the default bound lets the run finish");
	});

	it("runs the action when the mode allows it, and none when the name layer refuses it", async () => {
		const allowedWorkspace = writeFixture(join(root, "allowed"), []);
		const refusedWorkspace = writeFixture(join(root, "refused"), ["read_file"]);

		const allowed = await runAxiTurn({
			workspaceRoot: allowedWorkspace,
			modeName: "reading",
			ledgerPath: join(root, "allowed.jsonl"),
			prompt: "read the reading",
		});
		const refused = await runAxiTurn({
			workspaceRoot: refusedWorkspace,
			modeName: "reading",
			ledgerPath: join(root, "refused.jsonl"),
			prompt: "read the reading",
		});

		// The pair: same steps, same tool, same prompt - only the mode's never_allow differs.
		assert.equal(allowed.outcome.executedActions, 1, "the allowed run did not reach executeTool");
		assert.equal(refused.outcome.executedActions, 0, "the name layer refused the action but it ran anyway");
		assert.equal(refused.outcome.blockedActions.length, 1, "the refusal was not reported as a blocked action");
		assert.match(refused.outcome.blockedActions[0]?.reason ?? "", /read_file/u, "the block does not name what it blocked");
		assert.equal(allowed.gateInvocations.length >= 1, true, "the gate was never consulted");
	});

	it("writes the turn to the ledger rather than leaving it in memory", async () => {
		const workspace = writeFixture(join(root, "ledger"), ["read_file"]);
		const ledgerPath = join(root, "ledger.jsonl");
		const report = await runAxiTurn({ workspaceRoot: workspace, modeName: "reading", ledgerPath, prompt: "read it" });

		assert.equal(existsSync(ledgerPath), true, "no ledger file was written");
		const lines = readFileSync(ledgerPath, "utf8").trim().split("\n").filter((line) => line !== "");
		assert.equal(lines.length, report.ledgerRecords, "the report and the file disagree about how many records were written");
		assert.equal(lines.length >= 1, true, "the ledger is empty");
		for (const line of lines) assert.doesNotThrow(() => JSON.parse(line) as unknown, "a ledger line is not one JSON object");
	});

	it("records a keep and a revert as commit hashes, in a scratch repository", async () => {
		const scratch = join(root, "scratch-repo");
		mkdirSync(scratch, { recursive: true });
		const git = (...args: string[]): string =>
			execFileSync("git", args, { cwd: scratch, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		git("init", "-q");
		git("config", "user.name", "axi-turn");
		git("config", "user.email", "axi-turn@local");
		// **The line ending is taken out of the equation on purpose.** This machine's global configuration is
		// `core.autocrlf=true` (the whole session is punctuated by LF-to-CRLF warnings), so a checkout can
		// rewrite the bytes of a file the revert restored perfectly - which is a reading about git's settings,
		// not about the revert. Setting it false here makes the rehearsal deterministic instead of lucky.
		git("config", "core.autocrlf", "false");
		writeFileSync(join(scratch, "note.txt"), "before\n", "utf8");
		git("add", "-A");
		git("commit", "-q", "-m", "baseline");

		// The change, kept as one commit.
		writeFileSync(join(scratch, "note.txt"), "after\n", "utf8");
		git("add", "-A");
		git("commit", "-q", "-m", "one logical change");
		const keepHash = git("rev-parse", "--short", "HEAD");

		// The revert, which is the only rollback path this project uses.
		git("revert", "--no-edit", keepHash);
		const revertHash = git("rev-parse", "--short", "HEAD");

		assert.match(keepHash, /^[0-9a-f]{7,}$/u, "the keep hash is unreadable");
		assert.match(revertHash, /^[0-9a-f]{7,}$/u, "the revert hash is unreadable");
		assert.notEqual(keepHash, revertHash, "the revert did not produce its own commit");
		assert.equal(readFileSync(join(scratch, "note.txt"), "utf8"), "before\n", "the revert did not restore the file");
	});
});
