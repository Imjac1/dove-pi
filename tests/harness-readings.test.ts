import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * **The layer only a hand had run.** Each reading has unit tests over constructed records; until this file, no test spawned
 * a reading as a **script** - the walk over roots, the load of the declaration from the harness own root, the state-directory
 * resolution, the printing and the exit code were exercised by hand in a working session and nowhere else.
 *
 * That layer is not incidental: `handbook` aside, these four invocations **are** the first and last steps of the turn, and
 * the guide a person follows quotes them. A script that dies on a missing ledger, or that prints a reading with the wrong
 * shape, is a turn that stops at step one.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");

function run(script: string, args: readonly string[], env: Record<string, string>): { readonly stdout: string; readonly status: number } {
	try {
		const stdout = execFileSync(process.execPath, ["--import", "tsx", join(REPO, "scripts", script), ...args], {
			cwd: REPO,
			encoding: "utf8",
			env: { ...process.env, ...env },
			timeout: 120_000,
		});
		return { stdout, status: 0 };
	} catch (error) {
		const failure = error as { readonly stdout?: string; readonly status?: number };
		return { stdout: failure.stdout ?? "", status: failure.status ?? 1 };
	}
}

const AT = "2026-09-28T16:00:00.000Z";
function record(kind: string, stepId: string, details: Record<string, unknown>, requestId = "req-1"): string {
	return JSON.stringify({ taskId: "t1", stepId, kind, timestamp: AT, mode: "standard", correlation: { requestId }, details });
}

describe("the readings, exercised as scripts", () => {
	it("runs all four against one fixture, and asserts what each one prints", () => {
		const root = mkdtempSync(join(tmpdir(), "dove-readings-"));
		try {
			const state = join(root, "state");
			const project = join(root, "project");
			mkdirSync(state, { recursive: true });
			mkdirSync(join(project, ".dove", "tasks", "t1"), { recursive: true });
			// A request that failed, with a refusal before it: enough for the failure reading to attribute a component.
			writeFileSync(join(state, "execution.jsonl"), [
				record("request.received", "request:req-1", { logicalRequestId: "req-1" }),
				record("gate.refused", "gate:c1", { gate: "fence", reason: "the write is outside the fence" }),
				record("request.terminal", "request:req-1", { logicalRequestId: "req-1", reason: "failed", terminal: { origin: "provider", code: "provider-attempt-limit", retryable: true } }),
				record("change.applied", "applied:chg-1", { changeId: "chg-1", commit: "abc1234" }),
				record("change.decided", "change:chg-1", { changeId: "chg-1", verdict: "contradicted", observed: ["gate-refusals:fence: 3 -> 4 (prediction not met)"], decidedAtRevision: 7, verdictOnly: true }),
			].join("\n"));
			writeFileSync(join(project, ".dove", "tasks", "t1", "convergence.json"), JSON.stringify({
				schemaVersion: 1, taskId: "t1", revision: 7, acceptanceRevision: "a", state: "working",
				criteria: [], findings: [], completedStepIds: [], consecutiveNoProgress: 0, meaningfulProgressSinceReview: true,
				changes: [{ id: "chg-1", surface: "tool-implementation", failureEvidenceRef: "ledger:request:req-1", rootCause: "x", fix: "y", predictedFixes: [{ observable: "gate-refusals", subject: "fence", to: "down" }], predictedRegressions: [], baseline: { "gate-refusals:fence": 3 }, recordedAtRevision: 6 }],
				observedResources: { toolCalls: 0, providerRounds: 0, elapsedMs: 0 },
			}));
			const env = { DOVE_PI_STATE_DIR: state };

			// The failure reading: the record, its citation, and the behaviours a fix must not regress.
			const failures = run("harness-failures.mts", [join(state, "execution.jsonl")], env);
			assert.equal(failures.status, 0, failures.stdout);
			assert.match(failures.stdout, /provider-attempt-limit/, "the mechanism is printed");
			assert.match(failures.stdout, /cite:\s+ledger:request:req-1/, "and the reference a manifest cites");
			assert.match(failures.stdout, /preserve:\s+\S/, "and the suites the declared component carries");

			// The SSM axis: two classes, because the fixture has one clean terminal and one failure.
			const axes = run("harness-axes.mts", [join(state, "execution.jsonl")], env);
			assert.equal(axes.status, 0, axes.stdout);
			assert.match(axes.stdout, /Safety & Stability \(SSM\)/);
			assert.match(axes.stdout, /crash-free ratio/);
			assert.match(axes.stdout, /isolation refusals/, "the fence refusal is counted as an isolation control");

			// The corpus: the walk, and the count it reports for the root it walked.
			const corpus = run("harness-corpus.mts", [root], env);
			assert.equal(corpus.status, 0, corpus.stdout);
			assert.match(corpus.stdout, /ledgers \.+ 1/);
			assert.match(corpus.stdout, /failures: 1/);

			// The turn: the applied commit, the verifier answer, and the decision.
			const turn = run("harness-rounds.mts", [project], env);
			assert.equal(turn.status, 0, turn.stdout);
			assert.match(turn.stdout, /chg-1\s+surface tool-implementation/);
			assert.match(turn.stdout, /applied:\s+abc1234\s+(inside|outside|unresolved)/);
			assert.match(turn.stdout, /verifier:\s+(definite|possible|none)/);
			assert.match(turn.stdout, /decision:\s+contradicted at revision 7/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("says what it did not find, instead of dying on a path that is not there", () => {
		// The behaviour the scripts were written for, and the reason they can be run at all: a reading that dies on a missing
		// ledger is a reading nobody runs twice.
		const missing = join(tmpdir(), "dove-readings-does-not-exist-" + String(process.pid));
		const ledger = join(missing, "execution.jsonl");
		for (const [script, args, expected] of [
			["harness-failures.mts", [ledger], /No execution ledger at/],
			["harness-axes.mts", [ledger], /No execution ledger at/],
			["harness-corpus.mts", [missing], /No execution ledger under any root|Nothing to summarise/],
			["harness-rounds.mts", [missing], /No change manifest in this workspace/],
		] as const) {
			const result = run(script, args, {});
			assert.equal(result.status, 0, script + " must exit 0: " + result.stdout);
			assert.match(result.stdout, expected, script + " must say what it did not find");
		}
	});
});
