import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAxiTurn, type BoundaryPort } from "../src/commands/axi-turn.ts";
import type { BoundarySpec, SelfCheck } from "../src/jailer/types.ts";

/**
 * The boundary, as the turn meets it: **before anything else, and refusing rather than warning.**
 *
 * The mechanism itself is measured by `tests/jailer.test.ts` (seven cases, including the positive control that keeps
 * "it blocked" apart from "the probe was blind"). What these cases hold is the caller's discipline, which the
 * mechanism cannot hold for it: that each of the three readings is checked in order, that a boundary which is not as
 * declared stops the turn instead of being reported next to it, and that the child's exit code is recorded rather
 * than judged - a blocked write is criterion 1 *succeeding*, and reading it as a failure is the over-refusal shape
 * this project measured at 88/120.
 *
 * The port is what makes that testable: the real one can only be made wrong by changing the machine's ACLs.
 */

const SPEC: BoundarySpec = {
	planePaths: [join(tmpdir(), "held-out")],
	workPaths: [process.cwd()],
	workSid: "S-1-1-0",
	hostScript: join(process.cwd(), "src", "windows-runtime", "jailer-host.ps1"),
	scratchDir: join(tmpdir(), "dove-jailer-test"),
	ownerAccount: "TEST\\owner",
};

interface Recorder {
	readonly port: BoundaryPort;
	readonly calls: string[];
}

function recorder(overrides: {
	ensure?: () => { violations: readonly string[]; missing: readonly string[] };
	probe?: () => { selfCheck: SelfCheck };
	launch?: () => { selfCheck: SelfCheck; exitCode: number };
}): Recorder {
	const calls: string[] = [];
	const port: BoundaryPort = {
		ensure: () => {
			calls.push("ensure");
			return overrides.ensure?.() ?? { violations: [], missing: [] };
		},
		probe: () => {
			calls.push("probe");
			return overrides.probe?.() ?? { selfCheck: "pass" };
		},
		launch: () => {
			calls.push("launch");
			return overrides.launch?.() ?? { selfCheck: "pass", exitCode: 0 };
		},
	};
	return { port, calls };
}

async function turnWith(port: BoundaryPort, directory: string) {
	return runAxiTurn({
		workspaceRoot: process.cwd(),
		modeName: "code-audit",
		ledgerPath: join(directory, "ledger.jsonl"),
		prompt: "read the notes and stop",
		steps: [{ kind: "text", text: "stopped" }],
		boundary: { spec: SPEC, command: "cmd.exe /c exit 0", port },
	});
}

describe("the turn's own discipline at the boundary", () => {
	it("refuses to run when the ACL invariants are not as declared, and never starts a child", async () => {
		const directory = mkdtempSync(join(tmpdir(), "axi-turn-refuse-"));
		try {
			const { port, calls } = recorder({ ensure: () => ({ violations: ["held-out path carries a grant for the work SID"], missing: [] }) });
			await assert.rejects(turnWith(port, directory), /refusing to start: the boundary is not as declared.*1 violation/s);
			assert.deepEqual(calls, ["ensure"], "the later readings are not taken once the first one fails: the order is the mechanism's");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("refuses to run when the restricting list could not be verified, rather than trusting the token", async () => {
		const directory = mkdtempSync(join(tmpdir(), "axi-turn-token-"));
		try {
			const { port, calls } = recorder({ probe: () => ({ selfCheck: "mismatch" }) });
			await assert.rejects(turnWith(port, directory), /refusing to start: the restricted token self-check reported 'mismatch'/);
			assert.deepEqual(calls, ["ensure", "probe"], "a child is not started under a token whose restricting list is unverified");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("runs under a boundary that holds, and records a non-zero child exit as a reading rather than a failure", async () => {
		const directory = mkdtempSync(join(tmpdir(), "axi-turn-run-"));
		try {
			const { port, calls } = recorder({ launch: () => ({ selfCheck: "pass", exitCode: 1 }) });
			const report = await turnWith(port, directory);
			assert.deepEqual(calls, ["ensure", "probe", "launch"]);
			assert.equal(report.boundary?.tokenSelfCheck, "pass");
			assert.equal(report.boundary?.childExitCode, 1, "a blocked write is criterion 1 succeeding: the code is recorded, not judged");
			assert.equal(report.outcome.executedActions >= 0, true, "and the turn still ran, so the refusal did not become the turn failing");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("leaves the diagnostic turn exactly as it was when no boundary is asked for", async () => {
		const directory = mkdtempSync(join(tmpdir(), "axi-turn-plain-"));
		try {
			const report = await runAxiTurn({
				workspaceRoot: process.cwd(),
				modeName: "code-audit",
				ledgerPath: join(directory, "ledger.jsonl"),
				prompt: "read the notes and stop",
				steps: [{ kind: "text", text: "stopped" }],
			});
			assert.equal(report.boundary, undefined, "absent is `never asked`, which is not the same reading as `held`");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
