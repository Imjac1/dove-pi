import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExecutionRecordKind } from "../src/core/contracts.ts";
import { computeAcceptanceRevision } from "../src/core/task-convergence.ts";

/**
 * **The readings, run as scripts and pushed until they break.**
 *
 * The first case is the layer nobody had exercised: each reading has unit tests over constructed records, and no test spawned one as a
 * **script** - the walk over roots, the load of the declaration from the harness own root, the state-directory resolution, the printing
 * and the exit code. That layer is not incidental: these four invocations **are** the first and last steps of a turn, and the guide a
 * person follows quotes them.
 *
 * **The rest are the failure modes of that layer**, each measured before it was tested:
 *
 * - a ledger whose last append a crash cut short - the mining readings used to print nothing at all on it,
 * - a task record the decoder refuses, which used to be cast into a shape and counted as four characters,
 * - a decision the record no longer carries, which used to be dropped without a line,
 * - a path that is not there, which each reading is expected to describe rather than die on.
 *
 * **What it does not check**: what a reading means. A reading that prints a number for the wrong reason passes every case here.
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
/**
 * A ledger line, with its kind typed as **the union that owns kinds**. A probe written from memory invented
 * `task.resource.observed`, which nothing writes and nothing reads, and the conclusion drawn from it was about the fixture rather
 * than about the code. A hand-written literal is not checked; this one is.
 */
function record(kind: ExecutionRecordKind, stepId: string, details: Record<string, unknown>, requestId = "req-1"): string {
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
			const CRITERIA = [{ id: "AC-001", text: "the boundary reads the target" }];
			writeFileSync(join(project, ".dove", "tasks", "t1", "convergence.json"), JSON.stringify({
				// **The revision must be the one the criteria produce**, because that is what a real record carries and what the
				// decoder checks. This fixture used a literal, and the reading accepted it for two rounds because it cast the record
				// into a shape instead of decoding it - a fixture that could not exist is not a fixture.
				schemaVersion: 1, taskId: "t1", revision: 7, acceptanceRevision: computeAcceptanceRevision(CRITERIA), state: "working",
				criteria: [{ ...CRITERIA[0], status: "pending", evidenceRefs: [] }], findings: [], completedStepIds: [], consecutiveNoProgress: 0, meaningfulProgressSinceReview: true,
				changes: [{ id: "chg-1", surface: "tool-implementation", failureEvidenceRef: "ledger:request:req-1", rootCause: "x", fix: "y", predictedFixes: [{ observable: "gate-refusals", subject: "fence", direction: "down" }], predictedRegressions: [], baseline: { "gate-refusals:fence": 3 }, recordedAtRevision: 6 }],
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
			// **The observable the verdict machinery is built around, printed as a movement rather than as undefined.** The
			// reading read `.to` for every arm of the union while a refusal count names its target `direction`, and printed
			// `gate-refusals:fence=undefined` in every turn output until the scripts entered the type gate.
			assert.match(turn.stdout, /predicted:\s+gate-refusals:fence=down/, "the prediction prints its direction");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("reads a ledger a crash truncated, instead of dying on it", () => {
		// **The failure this test exists for, measured before it was written.** A ledger whose last append was cut short made
		// `harness-failures.mts` and `harness-axes.mts` exit 1 with **no output at all** - blind on exactly the run the harness
		// exists to explain. Five readers parsed this format; two of them threw, because they were copies of the tolerant one
		// with the try removed. There is one reader now, and this is the case that proves it.
		const root = mkdtempSync(join(tmpdir(), "dove-readings-partial-"));
		try {
			const state = join(root, "state");
			mkdirSync(state, { recursive: true });
			const complete = [
				record("request.received", "request:req-1", { logicalRequestId: "req-1" }),
				record("request.terminal", "request:req-1", { logicalRequestId: "req-1", reason: "failed", terminal: { origin: "provider", code: "provider-attempt-limit", retryable: true } }),
			].join("\n");
			// A half-written final line, with no newline after it: the append guarantee is one line per call, so this line was
			// never finished, which is why it is not a record.
			writeFileSync(join(state, "execution.jsonl"), complete + "\n" + '{"taskId":"t1","stepId":"request:req-2","kind":"request.rece');
			const env = { DOVE_PI_STATE_DIR: state };
			for (const script of ["harness-failures.mts", "harness-axes.mts", "harness-rounds.mts"]) {
				const result = run(script, [join(state, "execution.jsonl")], env);
				assert.equal(result.status, 0, script + " must survive a truncated final line: " + result.stdout);
			}
			const corpus = run("harness-corpus.mts", [state], env);
			assert.equal(corpus.status, 0, "the corpus reading must survive it too: " + corpus.stdout);
			const failures = run("harness-failures.mts", [join(state, "execution.jsonl")], env);
			assert.match(failures.stdout, /provider-attempt-limit/, "the record that was written is still read");
			assert.doesNotMatch(failures.stdout, /req-2/, "and the line the writer never finished is not a record");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
	it("says it cannot read a task record, instead of inventing a count from it", () => {
		// **Measured before the fix.** A record carrying `changes: "none"` satisfied the cast the reading used, and because a
		// string is iterable it printed "changes recorded: 4" and then died on the first character. The reading decodes through
		// the decoder that owns the format now, and a record it refuses is reported: silently dropping it would make the count
		// above it incomplete without looking incomplete.
		const root = mkdtempSync(join(tmpdir(), "dove-readings-badrecord-"));
		try {
			const project = join(root, "project");
			mkdirSync(join(project, ".dove", "tasks", "t1"), { recursive: true });
			writeFileSync(
				join(project, ".dove", "tasks", "t1", "convergence.json"),
				JSON.stringify({ schemaVersion: 1, taskId: "t1", revision: 9, state: "working", changes: "none" }),
			);
			const result = run("harness-rounds.mts", [project], { DOVE_PI_STATE_DIR: join(root, "state") });
			assert.equal(result.status, 0, "must not die on a record it cannot decode: " + result.stdout);
			assert.doesNotMatch(result.stdout, /changes recorded: 4/, "and must not count four characters as four changes");
			assert.match(result.stdout, /cannot read/, "it says what it cannot do instead");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("reports a decision the record no longer carries, without calling it nothing", () => {
		// **The state is designed, not corrupt.** The record is bounded and drops a change whose verdict is still pending; the
		// ledger is append-only and keeps it. Probed before the fix: a `change.decided` for a change the snapshot does not carry
		// produced no line anywhere, while the change beside it printed "the next round has not been observed" - a true sentence
		// about the wrong thing, on a turn whose decision was sitting in the file the reader was told to read.
		const root = mkdtempSync(join(tmpdir(), "dove-readings-orphan-"));
		try {
			const state = join(root, "state");
			const project = join(root, "project");
			mkdirSync(state, { recursive: true });
			mkdirSync(join(project, ".dove", "tasks", "t1"), { recursive: true });
			const CRITERIA = [{ id: "AC-001", text: "the boundary reads the target" }];
			writeFileSync(join(state, "execution.jsonl"), [
				record("request.received", "request:req-1", { logicalRequestId: "req-1" }),
				record("change.decided", "change:chg-9", { changeId: "chg-9", verdict: "confirmed", observed: [], decidedAtRevision: 9, verdictOnly: true }),
			].join("\n"));
			writeFileSync(join(project, ".dove", "tasks", "t1", "convergence.json"), JSON.stringify({
				schemaVersion: 1, taskId: "t1", revision: 9, acceptanceRevision: computeAcceptanceRevision(CRITERIA), state: "working",
				criteria: [{ ...CRITERIA[0], status: "pending", evidenceRefs: [] }], findings: [], completedStepIds: [],
				consecutiveNoProgress: 0, meaningfulProgressSinceReview: true,
				changes: [{ id: "chg-1", surface: "tool-implementation", failureEvidenceRef: "ledger:request:req-1", rootCause: "x", fix: "y",
					predictedFixes: [{ observable: "gate-refusals", subject: "fence", direction: "down" }], predictedRegressions: [],
					baseline: { "gate-refusals:fence": 3 }, recordedAtRevision: 6 }],
				observedResources: { toolCalls: 0, providerRounds: 0, elapsedMs: 0 },
			}));
			const result = run("harness-rounds.mts", [project], { DOVE_PI_STATE_DIR: state });
			assert.equal(result.status, 0, result.stdout);
			assert.match(result.stdout, /decisions the record does not carry: chg-9/, "the orphan is reported by id");
			assert.match(result.stdout, /decision:\s+\(none yet\) - the next round has not been observed/, "and the change own line keeps its meaning");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("rehearses the last mile on a real commit of this repository", () => {
		// **The chain the guide promises at step 7, and the only part never asserted against a real commit.** Every script step runs
		// against fixtures; the applied line, the verifier line and the decision line have been read by hand in earlier rounds and
		// never by a test. `harness-rounds.mts` resolves a commit with `git show` in the harness root, so a commit of the real
		// repository can be handed to it.
		//
		// **The subject is the root commit, resolved at runtime.** A hard-coded sha would pass here and be wrong in a clone with a
		// different history, and a recent commit would be absent from a shallow one - while `git rev-list --max-parents=0 HEAD`
		// answers in any full clone. It touches 169 files across every top-level directory, so it is **outside** every surface, and
		// the answer names the files - which is the property a previous round decided is information rather than a violation.
		//
		// **The third answer gets its own subject**: a commit that does not exist reads `unresolved`, which is not a nicer word for
		// outside but the statement that nobody could tell. **The inside path is not asserted here**: it needs a commit that stays
		// within one surface, and measured, this history has eleven - all recent, so a shallow clone would not have them. It is
		// covered by `tests/harness-round.test.ts` at the unit level, and the reading own line is what this rehearsal adds.
		const rev = execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
		assert.match(rev, /^[0-9a-f]{40}$/, "the root commit of this repository resolves at runtime");

		const root = mkdtempSync(join(tmpdir(), "dove-rehearsal-"));
		try {
			const state = join(root, "state");
			const project = join(root, "project");
			mkdirSync(join(project, ".dove", "tasks", "t1"), { recursive: true });
			mkdirSync(state, { recursive: true });
			const CRITERIA = [{ id: "AC-001", text: "the last mile of the turn is rehearsed" }];
			const change = (id: string, surface: string, commitRef: string) => ({
				id, surface, failureEvidenceRef: "ledger:request:req-1", rootCause: "x", fix: "y",
				predictedFixes: [{ observable: "gate-refusals", subject: "fence", direction: "down" }],
				predictedRegressions: [], baseline: { "gate-refusals:fence": 3 }, recordedAtRevision: 6, commitRef,
			});
			writeFileSync(join(state, "execution.jsonl"), [
				record("request.received", "request:req-1", { logicalRequestId: "req-1" }),
				record("change.applied", "applied:chg-real", { changeId: "chg-real", commit: rev }),
				record("change.applied", "applied:chg-ghost", { changeId: "chg-ghost", commit: "0".repeat(40) }),
				record("change.decided", "change:chg-real", { changeId: "chg-real", verdict: "confirmed", observed: [], decidedAtRevision: 9, verdictOnly: true }),
			].join("\n"));
			writeFileSync(join(project, ".dove", "tasks", "t1", "convergence.json"), JSON.stringify({
				schemaVersion: 1, taskId: "t1", revision: 9, acceptanceRevision: computeAcceptanceRevision(CRITERIA), state: "working",
				criteria: [{ ...CRITERIA[0], status: "pending", evidenceRefs: [] }], findings: [], completedStepIds: [],
				consecutiveNoProgress: 0, meaningfulProgressSinceReview: true,
				changes: [change("chg-real", "tool-implementation", rev), change("chg-ghost", "tool-implementation", "0".repeat(40))],
				observedResources: { toolCalls: 0, providerRounds: 0, elapsedMs: 0 },
			}));
			const result = run("harness-rounds.mts", [project], { DOVE_PI_STATE_DIR: state });
			assert.equal(result.status, 0, result.stdout);
			// A real commit, outside its declared surface, with the files named.
			assert.match(result.stdout, /applied:\s+[0-9a-f]{7,}\s+outside tool-implementation/, "the root commit is outside the source surface");
			// The files outside are named on their own line, which is where the guide says to look for them.
			const shown = (result.stdout.match(/outside:.*/) ?? ["(no outside line)"])[0];
			assert.match(result.stdout, /outside:\s+\S/, "and the files outside it are named: " + shown.slice(0, 160));
			// **The list is what is *not* in the declared surface**, so it names the skill and tool files the commit touched and
			// correctly does not name src/ or tests/ - which belong to the surface being checked. Asserting the presence of a
			// source path here would be asserting a bug.
			assert.match(shown, /\.agents\/skills\//, "the files outside the surface are named: " + shown.slice(0, 160));
			assert.doesNotMatch(shown, /(^|, )src\//, "and a file inside the surface is not called outside: " + shown.slice(0, 160));
			// A commit nobody can resolve, which is its own answer.
			assert.match(result.stdout, /applied:\s+0{7,}\s+unresolved/, "a commit git cannot resolve reads unresolved");
			// The verifier answer and the decision, which are the rest of step 7.
			assert.match(result.stdout, /verifier:\s+(definite|possible|none)/, "the verifier answer is printed");
			assert.match(result.stdout, /decision:\s+confirmed at revision 9/, "and the decision the record carries");
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
