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
function writeFixture(directory: string, neverAllow: readonly string[]): string {
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
			"  grant: local-fixture",
			"  capabilities: []",
			'  expires: "2027-01-01T00:00:00.000Z"',
			"gate:",
			"  semantics: none",
			"  approval: none",
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
