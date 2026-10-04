#!/usr/bin/env node
/**
 * Task artifact linter: four shape checks over the task PRDs and plans, and nothing else.
 *
 * **Why it exists.** `task.py validate` reads `implement.jsonl` and `check.jsonl` and nothing else - measured across
 * `.trellis/scripts/**`, no code path reads the body of `prd.md`, `design.md` or `implement.md`. That body is where
 * the defect this file was built from lived: a task whose acceptance criteria were fourteen prose lines with no
 * checkbox, so the file could not say what was done (`archive/2026-09/09-29-read-interop/prd.md`).
 *
 * **Every check has a measured defect behind it.** The four checks, the defect each one caught, and the four
 * candidate checks that were dropped (required sections, `completed` implying every box ticked, `file:line` anchors,
 * pstack prose hygiene) are in `.trellis/tasks/10-05-pstack-reference-audit/research/design-artifact-linter.md`,
 * sections 2.2 and 2.3, with the cost of each. A dropped check comes back only with a new measurement: each was
 * dropped because it would have produced more findings than the corpus holds defects, and a check with false
 * findings is worse than no check, because a boundary people turn off protects nothing.
 *
 * **No second way in.** A check runs only by being registered in `CHECKS` below. `--list-checks` prints that array,
 * and `tests/task-artifact-lint.test.ts` asserts its id set equals the key set of
 * `tests/fixtures/artifact-lint/manifest.json` in both directions, and that each check finds exactly one thing on
 * its own fixture and nothing on the compliant one. So a check without a fixture, or a fixture without a check,
 * fails the suite.
 *
 * **Output contract.** Exit `0` clean, `1` findings, `2` usage error. One finding per line on stderr, shaped
 * `<file>:<line>: <id>: <message>` - the same jumpable reading `task.py validate` prints. Paths carry forward
 * slashes and are relative to the current directory, so a finding reads the same on Windows and elsewhere. stdout
 * carries one summary line, `<n> artifacts, <m> problems, <k> checks`, or the `--json` object instead of it. A
 * non-finding note (a task directory with no `task.json`, say) is printed as `note: ...` and moves no exit code.
 *
 * **The envelope this does not copy.** pstack's `watch-pr` maps a family of blockers onto exit codes 2 through 7 and
 * versioned envelopes, because a poller has to decide whether to retry or to give up. Here there is one kind of
 * artifact, one action and one caller, so one exit code carries all the information there is and six of them would
 * be a second contract to keep. `--json` is the one machine-readable interface.
 *
 * Usage:
 *
 *     node scripts/task-artifact-lint.mjs <task-dir> [<task-dir> ...]
 *     node scripts/task-artifact-lint.mjs --status-not-completed     # .trellis/tasks/*, status != completed
 *     node scripts/task-artifact-lint.mjs --assert-corpus            # the same, gated by DOVE_PI_TASK_ARTIFACT_CORPUS
 *     node scripts/task-artifact-lint.mjs --list-checks
 *     node scripts/task-artifact-lint.mjs --json <task-dir>
 *     node scripts/task-artifact-lint.mjs --only TAL-002 --skip TAL-001 <task-dir>
 *
 * `--only` and `--skip` are not conveniences for people: they are how the test proves that a red fixture is red
 * because of one check and not because of another one, or because the parser died.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SCHEMA_VERSION = 1;
/** The artifacts a task directory may carry. `prd.md` is the one the corpus always has; the other two are optional. */
const ARTIFACT_NAMES = ["prd.md", "design.md", "implement.md"];
/** The corpus root, relative to the current directory. `archive/` is history and is not walked. */
const CORPUS_DIRECTORY = join(".trellis", "tasks");
/** The status that means "not written yet", where the seed placeholders are legitimate. */
const PLANNING = "planning";
/** Set this to assert the repository's own corpus. Unset, `--assert-corpus` skips and says so on stderr. */
const CORPUS_ENV = "DOVE_PI_TASK_ARTIFACT_CORPUS";

/** A checkbox line. The whole point of TAL-001 and TAL-002, and the one shape a reader can tick. */
const CHECKBOX = /^\s*-\s*\[[ xX]\]/u;
/** The two placeholder lines `task.py create` writes into every new PRD (`common/task_store.py:277,281`). */
const SEED_PLACEHOLDER = /^-\s*(?:\[[ xX]\]\s*)?TBD$/u;
/** A level-two heading. `(?!#)` keeps `###` out, and the title is trimmed on both sides. */
const SECTION = /^##(?!#)[ \t]*(?<title>.*?)[ \t]*$/u;
/** A fenced code block opens and closes on the same shape. Headings inside one are prose, not sections. */
const FENCE = /^[ \t]*(?:```|~~~)/u;
/** `Acceptance Criteria` and `Acceptance criteria` are both in the corpus; the check is case-insensitive. */
const ACCEPTANCE_TITLE = /^acceptance criteria$/iu;

/**
 * The section whose title is the acceptance criteria one, with `body` holding its non-heading lines.
 *
 * Fences are skipped when headings are read, because these artifacts quote markdown and shell inside fenced
 * blocks. They are **not** skipped when boxes are counted: that is how the corpus measurement counted them
 * (`research/design-artifact-linter.md` section 2.2), and no artifact in the corpus writes its criteria inside a
 * fence. Reading them differently would make this file's own number disagree with the one it was built on.
 */
function sectionsOf(lines) {
	const sections = [];
	let fenced = false;
	let current = null;
	for (let index = 0; index < lines.length; index += 1) {
		const text = lines[index] ?? "";
		if (FENCE.test(text)) {
			fenced = !fenced;
		} else if (!fenced) {
			const heading = SECTION.exec(text);
			if (heading !== null) {
				current = { title: (heading.groups?.title ?? "").trim(), line: index + 1, body: [] };
				sections.push(current);
				continue;
			}
		}
		if (current !== null) current.body.push({ line: index + 1, text });
	}
	return sections;
}

function acceptanceSection(artifact) {
	return artifact.sections.find((section) => ACCEPTANCE_TITLE.test(section.title)) ?? null;
}

function linesOf(text) {
	return text.split(/\r?\n/u);
}

/**
 * The four checks.
 *
 * `artifact` names the file a check reads; a check whose file is absent from a task directory does not apply and
 * says nothing. A check returns the findings it holds, each `{ line, message }`, and the runner adds the file and
 * the id. Nothing else registers a check.
 */
const CHECKS = [
	{
		id: "TAL-001",
		name: "ac-boxes",
		artifact: "prd.md",
		describe: "the Acceptance Criteria section carries at least one checkbox line",
		evaluate(task, artifact) {
			const section = acceptanceSection(artifact);
			// A missing section is TAL-004's finding. Reporting it here as well would put two ids on one defect and
			// would make TAL-004's fixture impossible to skip: `--skip TAL-004` has to leave that file green.
			if (section === null) return [];
			if (section.body.some((line) => CHECKBOX.test(line.text))) return [];
			return [
				{
					line: section.line,
					message: `the ${section.title} section carries no checkbox line (\`- [ ]\` / \`- [x]\`), so the file cannot say what is done`,
				},
			];
		},
	},
	{
		id: "TAL-002",
		name: "plan-boxes",
		artifact: "implement.md",
		describe: "the implementation plan carries at least one checkbox line",
		evaluate(task, artifact) {
			if (artifact.lines.some((text) => CHECKBOX.test(text))) return [];
			return [
				{
					line: 1,
					message: "this plan carries no checkbox line (\`- [ ]\` / \`- [x]\`), so it cannot say what step is done",
				},
			];
		},
	},
	{
		id: "TAL-003",
		name: "no-seed-placeholder",
		artifact: "prd.md",
		describe: "a task past planning carries no placeholder line the task skeleton seeded",
		evaluate(task, artifact) {
			// `planning` is the one status where the skeleton's `- TBD` is the honest answer. A directory with no
			// `task.json` has no status to read, and "not planning" is the safe reading of that: the alternative is a
			// file nobody can see through the filter.
			if (task.status === PLANNING) return [];
			return artifact.lines
				.map((text, index) => ({ line: index + 1, text: text.trim() }))
				.filter((line) => SEED_PLACEHOLDER.test(line.text))
				.map((line) => ({
					line: line.line,
					message: "this is the placeholder line `task.py create` seeds, and this task is past planning",
				}));
		},
	},
	{
		id: "TAL-004",
		name: "criteria-section",
		artifact: "prd.md",
		describe: "the Acceptance Criteria section exists and is not empty",
		evaluate(task, artifact) {
			const section = acceptanceSection(artifact);
			if (section === null) {
				return [{ line: 1, message: "prd.md has no `## Acceptance Criteria` section" }];
			}
			if (!section.body.some((line) => line.text.trim() !== "")) {
				return [{ line: section.line, message: `the ${section.title} section is empty` }];
			}
			return [];
		},
	},
];

const CHECKS_BY_ID = new Map(CHECKS.map((check) => [check.id, check]));

function usage(problem) {
	if (problem !== undefined) console.error(`task-artifact-lint: ${problem}`);
	console.error(
		[
			"usage:",
			"  node scripts/task-artifact-lint.mjs <task-dir> [<task-dir> ...]",
			"  node scripts/task-artifact-lint.mjs --status-not-completed",
			`  node scripts/task-artifact-lint.mjs --assert-corpus            (needs ${CORPUS_ENV})`,
			"  node scripts/task-artifact-lint.mjs --list-checks",
			"  node scripts/task-artifact-lint.mjs --json <task-dir>",
			"  node scripts/task-artifact-lint.mjs --only TAL-002 --skip TAL-001 <task-dir>",
		].join("\n"),
	);
	process.exit(2);
}

function parseArgs(argv) {
	const options = { json: false, listChecks: false, statusNotCompleted: false, assertCorpus: false, only: null, skip: null, targets: [] };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index] ?? "";
		if (arg === "--json") options.json = true;
		else if (arg === "--list-checks") options.listChecks = true;
		else if (arg === "--status-not-completed") options.statusNotCompleted = true;
		else if (arg === "--assert-corpus") options.assertCorpus = true;
		else if (arg === "--only" || arg === "--skip") {
			const id = argv[index + 1];
			if (id === undefined) usage(`${arg} needs a check id`);
			if (!CHECKS_BY_ID.has(id)) usage(`${arg} names ${id}, which is not a check; --list-checks prints them`);
			if (arg === "--only") options.only = id;
			else options.skip = id;
			index += 1;
		} else if (arg.startsWith("--")) usage(`unknown option ${arg}`);
		else options.targets.push(arg);
	}
	return options;
}

function selectedChecks(options) {
	const chosen = options.only === null ? CHECKS : CHECKS.filter((check) => check.id === options.only);
	const kept = chosen.filter((check) => check.id !== options.skip);
	if (kept.length === 0) usage("that combination selects no check, so a clean run would mean nothing");
	return kept;
}

function displayPath(absolute, cwd) {
	return relative(cwd, absolute).replaceAll("\\", "/");
}

/**
 * One task directory: its artifacts in a fixed order, and the status its `task.json` declares, if it has one.
 *
 * A directory counts as a task directory when it holds at least one artifact or a `task.json`; anything else is a
 * usage error rather than a clean run, because "read nothing" and "found nothing wrong" must not look alike.
 */
function readTask(directory, cwd) {
	const artifacts = [];
	for (const name of ARTIFACT_NAMES) {
		const file = join(directory, name);
		if (!existsSync(file) || !statSync(file).isFile()) continue;
		const lines = linesOf(readFileSync(file, "utf8"));
		artifacts.push({ name, display: displayPath(file, cwd), lines, sections: sectionsOf(lines) });
	}
	const record = join(directory, "task.json");
	let status = null;
	if (existsSync(record) && statSync(record).isFile()) {
		let parsed;
		try {
			parsed = JSON.parse(readFileSync(record, "utf8"));
		} catch (error) {
			console.error(`${displayPath(record, cwd)}: unreadable task.json (${error instanceof Error ? error.message : String(error)})`);
			process.exit(2);
		}
		status = typeof parsed?.status === "string" ? parsed.status : null;
	}
	return { directory, display: displayPath(directory, cwd), status, artifacts };
}

/**
 * The corpus: every direct child of `.trellis/tasks` whose `task.json` says the task is not finished.
 *
 * `archive/` is skipped by name - the repository already ruled that archived artifacts are history
 * (`archive/2026-09/09-28-citation-sweep/prd.md:50`) - and a directory with no `task.json` is named on stderr
 * rather than dropped, because a task no status filter can see is exactly the hole this mode exists to close.
 */
function readCorpus(cwd) {
	const root = join(cwd, CORPUS_DIRECTORY);
	if (!existsSync(root) || !statSync(root).isDirectory()) usage(`no task corpus at ${displayPath(root, cwd)}`);
	const tasks = [];
	for (const entry of readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const directory = join(root, entry.name);
		const record = join(directory, "task.json");
		if (!existsSync(record)) {
			console.error(`note: ${displayPath(directory, cwd)} has no task.json, so its status is unknown and it was not walked`);
			continue;
		}
		const task = readTask(directory, cwd);
		if (task.status === "completed") continue;
		tasks.push(task);
	}
	return tasks;
}

function lint(tasks, checks) {
	const artifacts = [];
	const findings = [];
	for (const task of tasks) {
		for (const artifact of task.artifacts) {
			artifacts.push(artifact.display);
			for (const check of checks) {
				if (check.artifact !== artifact.name) continue;
				for (const found of check.evaluate(task, artifact)) {
					findings.push({ file: artifact.display, line: found.line, check: check.id, message: found.message });
				}
			}
		}
	}
	return { artifacts, findings };
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const cwd = process.cwd();

	if (options.listChecks) {
		if (options.targets.length > 0 || options.only !== null || options.skip !== null || options.json || options.statusNotCompleted || options.assertCorpus) {
			usage("--list-checks prints the check list and takes nothing else");
		}
		for (const check of CHECKS) console.log(`${check.id}: ${check.describe}`);
		return 0;
	}

	if (options.assertCorpus && !corpusEnabled()) {
		console.error(`skipped: the repository's corpus is asserted where it is stable, and ${CORPUS_ENV} is not set (set it to 1 to assert it here)`);
		return 0;
	}

	const corpusMode = options.statusNotCompleted || options.assertCorpus;
	if (corpusMode && options.targets.length > 0) usage("--status-not-completed walks the corpus and cannot also take a directory");

	const checks = selectedChecks(options);
	let tasks;
	if (corpusMode) {
		tasks = readCorpus(cwd);
	} else {
		if (options.targets.length === 0) usage("no task directory and no corpus mode");
		tasks = options.targets.map((target) => {
			const directory = resolve(cwd, target);
			if (!existsSync(directory) || !statSync(directory).isDirectory()) usage(`${target} is not a directory`);
			const task = readTask(directory, cwd);
			if (task.artifacts.length === 0 && task.status === null) usage(`${target} is not a task directory: it holds none of ${ARTIFACT_NAMES.join(", ")} and no task.json`);
			return task;
		});
	}

	const result = lint(tasks, checks);
	// A run that read no artifact is not a pass, whichever mode asked for it.
	if (result.artifacts.length === 0) usage(`no artifact was read: ${corpusMode ? displayPath(join(cwd, CORPUS_DIRECTORY), cwd) : options.targets.join(", ")}`);

	if (options.json) {
		console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, artifacts: result.artifacts.length, findings: result.findings }));
	} else {
		console.log(`${result.artifacts.length} artifacts, ${result.findings.length} problems, ${checks.length} checks`);
	}
	for (const finding of result.findings) console.error(`${finding.file}:${finding.line}: ${finding.check}: ${finding.message}`);
	return result.findings.length > 0 ? 1 : 0;
}

function corpusEnabled() {
	const value = process.env[CORPUS_ENV];
	return typeof value === "string" && value.trim() !== "" && value.trim() !== "0" && value.trim().toLowerCase() !== "false";
}

// `exitCode` rather than `process.exit`: an exit call can cut a stdout write short, and the summary line is part of
// the reading.
process.exitCode = main();
