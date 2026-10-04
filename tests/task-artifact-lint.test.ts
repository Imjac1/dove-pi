/**
 * The task artifact linter, driven the way its callers drive it - as a script, over fixtures.
 *
 * **Why this file is the linter's teeth rather than its documentation.** pstack's own test suite states the rule this
 * one is built on, and it states it from a defect: *"A check that quietly matches nothing looks identical to a pass,
 * and that already happened once (the 0.9.10 quad check hunted a retired slug for a whole release), so every check
 * gets a fixture that must trip it"*
 * (`.trellis/.runtime/pstack-research/pstack-claude-main/tests/invariants.test.mjs:1-4`). A linter whose checks are
 * only ever run against a corpus that happens to be clean cannot tell the two apart, so every check here has a
 * paired fixture and three assertions: red under `--only`, green under `--skip`, and silent on the compliant one.
 *
 * **And why the manifest is asserted in both directions.** A fixture per check does not stop a check being *added*
 * without one - it would pass forever on nothing - so `--list-checks` and `manifest.json` are held equal as sets:
 * a check with no fixture, and a fixture with no check, each fail here. `tests/fence-drift.test.ts:21-23` says why
 * the second direction matters too: "a fence that refuses too much is a fence people turn off".
 *
 * **What it does not check**: whether the four checks are the right four. That is the measurement in
 * `.trellis/tasks/10-05-pstack-reference-audit/research/design-artifact-linter.md`, including the four checks that
 * were dropped and what each would have cost.
 *
 * **And what it deliberately never touches.** Every run in this file starts in
 * `tests/fixtures/artifact-lint/` or in a temporary directory, and neither has a `.trellis` under it, so `npm test`
 * cannot read the repository's own corpus: this suite is hermetic, and the corpus is asserted in CI instead, where
 * it does not move under a second session's hands.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const REPO = resolve(import.meta.dirname, "..");
const SCRIPT = join(REPO, "scripts", "task-artifact-lint.mjs");
const FIXTURES = join(REPO, "tests", "fixtures", "artifact-lint");
/** The gate `--assert-corpus` reads. Unset everywhere here except where a case sets it on purpose. */
const CORPUS_ENV = "DOVE_PI_TASK_ARTIFACT_CORPUS";

/**
 * The four checks, named here as well as printed by `--list-checks`.
 *
 * Written out rather than imported, so that adding a fifth check to the linter fails this file: the rig for a check
 * is a fixture, a manifest row and a red run observed before it was wired, and a list nobody has to touch would let
 * a check arrive with none of them.
 */
const CHECKS = ["TAL-001", "TAL-002", "TAL-003", "TAL-004"];

interface ManifestEntry {
	readonly why: string;
	readonly artifact: string;
	readonly bad: string;
	readonly good: string;
}

interface Finding {
	readonly file: string;
	readonly line: number;
	readonly check: string;
	readonly message: string;
}

interface Reading {
	readonly code: number;
	readonly stdout: string;
	readonly stderr: string;
}

interface Report {
	readonly schemaVersion: number;
	readonly artifacts: number;
	readonly findings: readonly Finding[];
}

const MANIFEST = JSON.parse(readFileSync(join(FIXTURES, "manifest.json"), "utf8")) as Record<string, ManifestEntry>;

/** `<file>:<line>: <id>: <message>`, the contract the linter prints one per line on stderr. */
const FINDING_LINE = /^(?<file>.+?):(?<line>\d+): (?<check>TAL-\d+): (?<message>.+)$/u;
/** A non-finding note, which moves no exit code. Named so that it can be acknowledged rather than skipped over. */
const NOTE_LINE = /^note: /u;

function baseEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	// The gate is off unless a case asks for it, so this suite cannot inherit a developer's environment.
	delete env[CORPUS_ENV];
	return env;
}

function runLint(args: readonly string[], cwd: string = FIXTURES, env: Record<string, string> = {}): Reading {
	const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8", env: { ...baseEnv(), ...env } });
	return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Read stderr strictly: every line is either a finding in the contract's shape or an acknowledged note.
 *
 * A parser that dropped what it did not recognise would pass over a finding the day the shape changed, which is the
 * failure this whole file is about.
 */
function readStderr(reading: Reading): { readonly findings: readonly Finding[]; readonly notes: readonly string[] } {
	const findings: Finding[] = [];
	const notes: string[] = [];
	for (const line of reading.stderr.split(/\r?\n/u).filter((candidate) => candidate !== "")) {
		if (NOTE_LINE.test(line)) {
			notes.push(line);
			continue;
		}
		const parsed = FINDING_LINE.exec(line);
		const groups = parsed?.groups;
		if (groups === undefined) throw new Error(`this line is neither a finding nor a note: ${line}`);
		findings.push({
			file: groups.file ?? "",
			line: Number(groups.line ?? "0"),
			check: groups.check ?? "",
			message: groups.message ?? "",
		});
	}
	return { findings, notes };
}

function reportOf(reading: Reading): Report {
	return JSON.parse(reading.stdout) as Report;
}

function describeReading(reading: Reading): string {
	return `exit ${String(reading.code)}\nstdout: ${reading.stdout.trimEnd()}\nstderr:\n${reading.stderr.trimEnd()}`;
}

const SEEDED_PRD = [
	"# Seeded by the skeleton",
	"",
	"## Goal",
	"",
	"Say what this task is for.",
	"",
	"## Requirements",
	"",
	"- TBD",
	"",
	"## Acceptance Criteria",
	"",
	"- [ ] TBD",
	"",
].join("\n");

const CLEAN_PRD = [
	"# A task whose criteria are boxes",
	"",
	"## Goal",
	"",
	"Say what this task is for.",
	"",
	"## Acceptance Criteria",
	"",
	"- [ ] It is done when this line is a checkbox.",
	"",
].join("\n");

const CLEAN_PLAN = ["# Implementation plan", "", "- [ ] Do the one step this plan has.", ""].join("\n");

/** A task directory as the corpus mode finds it: a `task.json` with a status, and the artifacts it names. */
function writeTask(root: string, name: string, status: string, artifacts: Record<string, string>): void {
	const directory = join(root, ".trellis", "tasks", name);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "task.json"), JSON.stringify({ name, status }), "utf8");
	for (const [file, text] of Object.entries(artifacts)) writeFileSync(join(directory, file), text, "utf8");
}

/**
 * The corpus fixture, in a temporary directory.
 *
 * Four tasks and two directories that are not tasks: `planning-seeded` where the seed placeholders are legitimate,
 * `working-seeded` where they are the finding, `working-clean` which must stay silent, `finished-seeded` which the
 * status filter has to exclude, `no-record` which has no `task.json` and must be named rather than dropped, and
 * `archive/2026-09/old` which must not be walked at all.
 */
function writeCorpus(root: string): void {
	writeTask(root, "planning-seeded", "planning", { "prd.md": SEEDED_PRD });
	writeTask(root, "working-seeded", "in_progress", { "prd.md": SEEDED_PRD });
	writeTask(root, "working-clean", "in_progress", { "prd.md": CLEAN_PRD, "implement.md": CLEAN_PLAN });
	writeTask(root, "finished-seeded", "completed", { "prd.md": SEEDED_PRD });
	mkdirSync(join(root, ".trellis", "tasks", "no-record"), { recursive: true });
	writeFileSync(join(root, ".trellis", "tasks", "no-record", "prd.md"), SEEDED_PRD, "utf8");
	mkdirSync(join(root, ".trellis", "tasks", "archive", "2026-09", "old"), { recursive: true });
	writeFileSync(join(root, ".trellis", "tasks", "archive", "2026-09", "old", "prd.md"), SEEDED_PRD, "utf8");
}

function scratch(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

describe("the task artifact linter lists exactly the checks the fixture manifest covers", () => {
	it("prints the four checks it can run, and no more", () => {
		const reading = runLint(["--list-checks"]);
		assert.equal(reading.code, 0, `--list-checks must succeed\n${describeReading(reading)}`);
		assert.equal(reading.stderr, "", "--list-checks has nothing to report on stderr");
		const ids = reading.stdout
			.trimEnd()
			.split(/\r?\n/u)
			.map((line) => (/^(?<id>TAL-\d+): \S/u.exec(line)?.groups?.id ?? line));
		assert.deepEqual(ids, CHECKS, `the registry is these four; a fifth check needs a fixture and a red run before it belongs here\n${reading.stdout}`);
	});

	it("holds --list-checks and the manifest equal in both directions, and names which way it broke", () => {
		const listed = runLint(["--list-checks"]).stdout;
		const ids = listed
			.trimEnd()
			.split(/\r?\n/u)
			.map((line) => /^(?<id>TAL-\d+): \S/u.exec(line)?.groups?.id ?? line);
		const keys = Object.keys(MANIFEST);
		const withoutFixture = ids.filter((id) => !keys.includes(id));
		const withoutCheck = keys.filter((key) => !ids.includes(key));
		assert.deepEqual(withoutFixture, [], "these checks have no fixture, so they would pass on nothing forever");
		assert.deepEqual(withoutCheck, [], "these fixtures belong to no check, so nothing in the linter reaches them");
	});
});

describe("the fixture manifest says where each check came from", () => {
	it("gives every check a measured source, and names the artifact files that source produced", () => {
		for (const id of CHECKS) {
			const entry = MANIFEST[id];
			assert.notEqual(entry, undefined, `${id} has no manifest row`);
			const why = entry?.why ?? "";
			assert.equal(why.trim().length > 0, true, `${id} carries no reason for existing`);
			assert.match(why, /(?:\.trellis\/tasks|tests)\//u, `${id}'s reason names no defect in this repository: ${why}`);
			assert.equal(existsSync(join(FIXTURES, entry?.good ?? "")), true, `${id}'s good fixture is not there: ${entry?.good ?? ""}`);
			const bad = join(FIXTURES, entry?.bad ?? "");
			assert.equal(existsSync(bad) && statSync(bad).isDirectory(), true, `${id}'s bad fixture is not a directory: ${entry?.bad ?? ""}`);
			assert.equal(existsSync(join(bad, entry?.artifact ?? "")), true, `${id}'s bad fixture does not hold the file its check reads`);
		}
	});
});

for (const id of CHECKS) {
	describe(`${id}, on its own fixture`, () => {
		it("is red, with exactly one finding, and the finding names this check", () => {
			const entry = MANIFEST[id];
			const target = entry?.bad ?? "";
			const artifact = entry?.artifact ?? "";
			const reading = runLint(["--json", "--only", id, target]);
			assert.equal(reading.code, 1, `${id} must be red on its fixture\n${describeReading(reading)}`);
			const { findings, notes } = readStderr(reading);
			assert.deepEqual(notes, [], `${id}'s fixture produced a note, which is not what it is for`);
			// Exactly one, not "at least one": a check that reports twice on one file is a check nobody will read.
			assert.equal(findings.length, 1, `expected exactly one finding\n${describeReading(reading)}`);
			assert.equal(findings[0]?.check, id, `the one finding is not this check's\n${describeReading(reading)}`);
			assert.equal(findings[0]?.file, `${target}/${artifact}`, "the finding does not point at the file the check reads");
			assert.equal((findings[0]?.line ?? 0) > 0, true, "a finding with no line is not a place a reader can go");
			assert.equal((findings[0]?.message ?? "").trim().length > 0, true, "a finding with no message is not a reading");
			// The positive control: this run read the artifact, so its one finding is a reading of a file.
			assert.deepEqual(reportOf(reading), { schemaVersion: 1, artifacts: 1, findings: findings }, "--json and stderr must say the same thing about the same file");
		});

		it("is green with this check skipped, so the red was this check's and nobody else's", () => {
			const entry = MANIFEST[id];
			const reading = runLint(["--skip", id, entry?.bad ?? ""]);
			assert.equal(reading.code, 0, `${id}'s fixture is red for a reason other than ${id}\n${describeReading(reading)}`);
			assert.deepEqual(readStderr(reading).findings, [], "a skipped check must leave nothing behind on the same file");
			assert.equal(reading.stdout.trim(), `1 artifacts, 0 problems, ${String(CHECKS.length - 1)} checks`);
		});

		it("says nothing about the compliant fixture", () => {
			const reading = runLint(["--json", "--only", id, "good"]);
			assert.equal(reading.code, 0, `a check that fires on a compliant artifact is the check's fault, not the fixture's\n${describeReading(reading)}`);
			assert.deepEqual(reportOf(reading).findings, []);
		});
	});
}

describe("the compliant fixture, with every check on", () => {
	it("is green, and the run really read both of its artifacts", () => {
		const reading = runLint(["--json", "good"]);
		assert.equal(reading.code, 0, describeReading(reading));
		const report = reportOf(reading);
		assert.deepEqual(report.findings, []);
		// A reading with no findings is only worth as much as what it looked at: two files are in `good/`, so a
		// number below two means the walk or the reader lost one and this case proved less than it says.
		assert.equal(report.artifacts, 2, `only ${String(report.artifacts)} artifacts were read, so this run proves little`);
	});

	it("reports one finding per line on stderr in the shape <file>:<line>: <id>: <message>", () => {
		const reading = runLint(["--only", "TAL-001", "bad/TAL-001-ac-boxes"]);
		assert.equal(reading.code, 1);
		assert.equal(
			reading.stderr,
			"bad/TAL-001-ac-boxes/prd.md:11: TAL-001: the Acceptance Criteria section carries no checkbox line (`- [ ]` / `- [x]`), so the file cannot say what is done\n",
		);
	});
});

describe("the corpus mode walks the tasks whose status is not completed", () => {
	it("reads the artifacts of exactly those tasks, and names the directory it cannot see into", () => {
		const root = scratch("artifact-lint-corpus-");
		try {
			writeCorpus(root);
			const reading = runLint(["--json", "--status-not-completed"], root);
			const { findings, notes } = readStderr(reading);
			// One task in the tree is `completed` and one is under `archive/`, and both hold a seeded PRD. Six
			// directories, four artifacts, two findings: the numbers are what prove the status filter and the archive
			// skip ran, rather than the walk having quietly found nothing.
			assert.equal(reportOf(reading).artifacts, 4, `the walk read these artifacts: ${JSON.stringify(reportOf(reading).artifacts)}\n${describeReading(reading)}`);
			assert.equal(reading.code, 1, describeReading(reading));
			// Two lines, not one: the seeded PRD carries both placeholders the skeleton writes, and a leftover line is
			// a place to fix whether or not another one is already reported.
			assert.deepEqual(
				findings.map((finding) => `${finding.file}:${String(finding.line)}: ${finding.check}`),
				[".trellis/tasks/working-seeded/prd.md:9: TAL-003", ".trellis/tasks/working-seeded/prd.md:13: TAL-003"],
				describeReading(reading),
			);
			// The seed placeholders in `planning-seeded` are legitimate, in `finished-seeded` and under `archive/` they
			// are out of scope - and the one in `no-record` is named as unreadable instead of being counted or dropped.
			assert.deepEqual(notes, ["note: .trellis/tasks/no-record has no task.json, so its status is unknown and it was not walked"]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("is green with the one red check skipped, and then the summary line says so", () => {
		const root = scratch("artifact-lint-corpus-skip-");
		try {
			writeCorpus(root);
			const reading = runLint(["--status-not-completed", "--skip", "TAL-003"], root);
			assert.equal(reading.code, 0, describeReading(reading));
			assert.equal(reading.stdout.trim(), "4 artifacts, 0 problems, 3 checks");
			assert.deepEqual(readStderr(reading).findings, []);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("exits 2 rather than 0 when there is no corpus to walk", () => {
		const root = scratch("artifact-lint-empty-");
		try {
			const reading = runLint(["--status-not-completed"], root);
			assert.equal(reading.code, 2, `an empty run must not read as a clean one\n${describeReading(reading)}`);
			assert.match(reading.stderr, /no task corpus at/u);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});

describe("--assert-corpus is the repository's assertion, and it is off unless asked for", () => {
	it("skips, and says it skipped, when the environment has not turned it on", () => {
		const root = scratch("artifact-lint-assert-clean-");
		try {
			writeTask(root, "working-clean", "in_progress", { "prd.md": CLEAN_PRD, "implement.md": CLEAN_PLAN });
			const reading = runLint(["--assert-corpus"], root);
			assert.equal(reading.code, 0, describeReading(reading));
			assert.match(reading.stderr, new RegExp(`^skipped: .*${CORPUS_ENV} is not set`, "u"), describeReading(reading));
			assert.equal(reading.stdout, "", "a skipped assertion reads no corpus, so it has no summary to print");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("fails where the corpus mode fails, once the environment asks for it", () => {
		const root = scratch("artifact-lint-assert-dirty-");
		try {
			writeCorpus(root);
			const skipped = runLint(["--assert-corpus"], root);
			assert.equal(skipped.code, 0, `a dirty corpus must still skip while the gate is off\n${describeReading(skipped)}`);
			const gated = runLint(["--assert-corpus"], root, { [CORPUS_ENV]: "1" });
			assert.equal(gated.code, 1, `with the gate on, the same corpus is a failure\n${describeReading(gated)}`);
			const { findings } = readStderr(gated);
			assert.deepEqual(findings.map((finding) => finding.check), ["TAL-003", "TAL-003"], "and they are the same findings the ungated mode reports");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("passes with the gate on when the corpus is clean, and prints what it read", () => {
		const root = scratch("artifact-lint-assert-pass-");
		try {
			writeTask(root, "working-clean", "in_progress", { "prd.md": CLEAN_PRD, "implement.md": CLEAN_PLAN });
			const reading = runLint(["--assert-corpus"], root, { [CORPUS_ENV]: "1" });
			assert.equal(reading.code, 0, describeReading(reading));
			assert.equal(reading.stdout.trim(), "2 artifacts, 0 problems, 4 checks");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});

describe("the linter refuses to run on something that is not a task artifact", () => {
	it("exits 2 for every way of asking it nothing", () => {
		const root = scratch("artifact-lint-usage-");
		try {
			const cases: readonly (readonly string[])[] = [
				[],
				["--nonsense"],
				["--only", "TAL-999", "good"],
				["--only", "TAL-001", "--skip", "TAL-001", "good"],
				["--status-not-completed", "good"],
				["."],
				["there-is-no-such-directory"],
			];
			for (const args of cases) {
				const reading = runLint(args, root);
				assert.equal(reading.code, 2, `${JSON.stringify(args)} must be a usage error\n${describeReading(reading)}`);
				assert.match(reading.stderr, /usage:/u, `${JSON.stringify(args)} must print the usage`);
			}
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("exits 2 on a task record it cannot read, instead of reporting the file as clean", () => {
		const root = scratch("artifact-lint-bad-record-");
		try {
			writeTask(root, "working-clean", "in_progress", { "prd.md": CLEAN_PRD });
			writeFileSync(join(root, ".trellis", "tasks", "working-clean", "task.json"), "{ not json", "utf8");
			const reading = runLint(["--status-not-completed"], root);
			assert.equal(reading.code, 2, describeReading(reading));
			assert.match(reading.stderr, /unreadable task\.json/u);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
