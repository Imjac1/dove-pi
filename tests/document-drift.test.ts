import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseHarnessSurface } from "../src/core/harness-surface.ts";
import { convergenceOperationFromPiInput } from "../src/pi-adapter/extension.ts";
import * as record from "../src/core/task-convergence.ts";

/**
 * **What the documents name, checked against what exists.**
 *
 * Six kinds of naming live here, and they share one shape: a document says a thing is called something, and the thing is asked what it
 * is actually called.
 *
 * - **Declaration symbols** - `verifier.embedded` names symbols inside a mostly-harness file, so the module is imported and each
 *   symbol asserted to be an exported function.
 * - **Guide fields** - the turn guide tells a person which tool call to make with which fields, so the mapper is called with exactly
 *   those fields, and `status` is asserted to refuse as read-only because the guide says it is a read.
 * - **Indexes** - a specification index lists every file in its own directory, names a Pre-Development Checklist and a Quality Check,
 *   and every name it gives exists.
 * - **Boundaries** - this repository content in `AGENTS.md` sits outside the Trellis-managed block, and no specification is tracked
 *   by the tool, so a version that starts tracking them is noticed rather than discovered by losing an edit.
 * - **Paths** - the paths the specifications name, and the ones the front door names, resolve from the repository root or from the
 *   file own directory.
 * - **Citations** - a comment in the live code names a thing rather than a line, because a line drifts the moment somebody edits
 *   above it.
 *
 * **What this does not check, and every case below carries its own limit.** They share one: a check holds that a name resolves, never
 * that the sentence around it is still true. Two are worth repeating because a reader is most likely to assume they are covered:
 *
 * - **`operation=applied` is not mapped.** The mapper union has ten operations and `applied` is not among them: the tool execute
 *   handles it before the mapper, which is where its refusals live and where `tests/pi-adapter.test.ts` exercises them.
 * - **The guide prose is not checked.** Which surface to choose, what to predict, whether to keep or revert - the judgments the guide
 *   exists to leave visible.
 *
 * **Why eleven cases in one file rather than four files**: they are one shape and the helpers are the rules. Splitting by subject would
 * produce files of two cases each, which is more surface for no gain. The measurement is in the task that wrote this header.
 */

const DECLARATION = join(process.cwd(), ".trellis", "harness-surface.yaml");
const GUIDE = join(process.cwd(), ".trellis", "spec", "guides", "harness-loop-turn.md");

/** The modules the declaration may name as embedding verifier code, by the path it names them with. */
const EMBEDDING_MODULES: Readonly<Record<string, Record<string, unknown>>> = {
	"src/core/task-convergence.ts": record as unknown as Record<string, unknown>,
};

/** Every TypeScript file under the given roots, for the two checks that read the live code. */
function walk(roots: readonly string[]): readonly string[] {
	const found: string[] = [];
	for (const root of roots) {
		const stack = [root];
		while (stack.length > 0) {
			const dir = stack.pop() as string;
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) stack.push(path);
				else if (/\.(ts|mts)$/.test(path)) found.push(path);
			}
		}
	}
	return found;
}

describe("the documents that name things", () => {
	it("names only symbols that are exported functions, in every embedded entry", () => {
		const surface = parseHarnessSurface(readFileSync(DECLARATION, "utf8"));
		for (const entry of surface.verifier.embedded) {
			const imported = EMBEDDING_MODULES[entry.path];
			// A hole in the check is not a pass: an entry this test cannot import must fail here rather than be skipped, or the
			// declaration would be able to name a file nothing verifies and the test would report success.
			assert.ok(imported !== undefined, entry.path + " is embedded and this test has no import for it, so its symbols would go unchecked");
			for (const symbol of entry.symbols) {
				assert.equal(typeof imported[symbol], "function", symbol + " is named as verifier code in " + entry.path + " and is not an exported function there");
			}
		}
	});

	it("accepts the fields the guide tells a person to send, by calling the mapper", () => {
		// The step 3 fields, as the guide spells them. A typed call rather than a text scan: the question is what the mapper
		// accepts, and only the mapper can answer it.
		const change = convergenceOperationFromPiInput({
			operation: "change",
			acceptanceId: "AC-001",
			changeId: "chg-1",
			surface: "tool-implementation",
			failureEvidenceRef: "ledger:request:req-1",
			rootCause: "the boundary read the tool name where the target lives in the arguments",
			fix: "read the target argument before deciding",
			predictedFixes: ["criterion-status:AC-001=passed"],
			predictedRegressions: [],
		}, { "criterion-status:AC-001": "pending" });
		assert.equal(change.action, "change");
		assert.equal(change.acceptanceId, "AC-001");
		assert.equal(change.change.id, "chg-1");

		const freeze = convergenceOperationFromPiInput({ operation: "freeze", criteria: [{ id: "AC-001", text: "the boundary reads the target" }] });
		assert.equal(freeze.action, "freeze");
		assert.equal(freeze.criteria.length, 1, "the guide freeze step sends criteria and they reach the operation");
	});

	it("refuses a status call as read-only, which is what the guide says it is", () => {
		assert.throws(
			() => convergenceOperationFromPiInput({ operation: "status" }),
			/status is read-only/,
			"the guide tells a reader to run a status read, and a read is what it must stay",
		);
	});

	it("quotes scripts that exist, because a guide whose commands do not is a wasted first attempt", () => {
		const guide = readFileSync(GUIDE, "utf8");
		// **Three, not four, and the first version of this test asserted four.** The SSM axis is a ruler for comparing runs,
		// which is a variant comparison rather than a step of a turn, so the guide does not quote it - and a test that
		// expected it was asserting my assumption rather than the guide design. It was caught on this test first run, which
		// is the whole point of writing the check.
		for (const script of ["harness-failures.mts", "harness-corpus.mts", "harness-rounds.mts"]) {
			assert.ok(existsSync(join(process.cwd(), "scripts", script)), script + " is quoted by the guide and does not exist");
			assert.ok(guide.includes(script), script + " exists and the guide no longer quotes it");
		}
	});

	/**
	 * The files in a specification directory that its own index does not mention, plus the names it gives that are not there.
	 *
	 * A directory with no index is reported as a missing index rather than skipped: the drift this looks for happened three times in
	 * one directory because its table was not updated when a specification was added, and a directory that grew without any table
	 * would be the same problem with nothing to update.
	 */
	function indexProblems(specRoot: string): readonly string[] {
		const problems: string[] = [];
		for (const entry of readdirSync(specRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const directory = join(specRoot, entry.name);
			const indexPath = join(directory, "index.md");
			if (!existsSync(indexPath)) {
				problems.push(entry.name + " has no index.md");
				continue;
			}
			const index = readFileSync(indexPath, "utf8");
			const mentioned = new Set(index.match(/[A-Za-z0-9._-]+\.md/g) ?? []);
			for (const name of readdirSync(directory)) {
				if (name.endsWith(".md") && name !== "index.md" && !mentioned.has(name)) problems.push(entry.name + "/" + name + " is not listed");
			}
			for (const name of mentioned) {
				if (!name.endsWith(".md")) continue;
				// **A name may point at a sibling.** An index that says "the router is in the backend directory" is pointing at a real
				// file, and a check that only looked in its own directory would fail on a true sentence - which is what happened on
				// this check first run after the rule was widened. **Its limit**: a typo that happens to name a file in another
				// specification directory passes, and no name-based check can tell the difference between a pointer and a mistake.
				const here = existsSync(join(directory, name));
				const sibling = readdirSync(specRoot, { withFileTypes: true }).some(
					(other) => other.isDirectory() && other.name !== entry.name && existsSync(join(specRoot, other.name, name)),
				);
				if (!here && !sibling) problems.push(entry.name + " lists " + name + " and it is not in this directory or any sibling");
			}
		}
		return problems;
	}

	it("lists every specification in the directory it indexes, and every row it lists exists", () => {
		// **Widened from one directory to all of them, because of what a wide measurement found.** The rule was written after the
		// backend index turned out to list eight personal-agent specifications while the directory held eleven, with the harness loop
		// among the missing three. Measured across the repository: 139 markdown files, 61 links, none broken, and of the three
		// specification indexes only that one was stale. So the drift happens where a specification is added and the table is not
		// updated, and a check naming one directory leaves that open everywhere else.
		//
		// **And the rule is the tool own, not a preference of mine.** `.agents/skills/trellis-spec-bootstrap/SKILL.md` says, in its
		// checklist: "index.md files match the final spec file set." This test is that sentence made mechanical - and it was not
		// being kept, since the backend index was missing three specifications when the test was written.
		assert.deepEqual(indexProblems(join(process.cwd(), ".trellis", "spec")), [], "a specification index and its directory disagree");

		// **And the entry point names what the workflow promises.** `workflow.md` says a spec index is the entry point with a
		// Pre-Development Checklist and a Quality Check, and `trellis-before-dev` sends every agent to read the files listed in
		// that checklist - so an index that names neither is a pointer into nothing. Measured when this was written: neither index
		// had either section, and the phrase appeared nowhere in the repository as a section of a specification.
		//
		// **What it cannot see**: whether the sections say anything useful, or point at the right files. Presence is what a check
		// can hold; content is what a reader holds.
		for (const directory of ["backend", "frontend"]) {
			const index = readFileSync(join(process.cwd(), ".trellis", "spec", directory, "index.md"), "utf8");
			for (const section of ["Pre-Development Checklist", "Quality Check"]) {
				assert.ok(index.includes(section), directory + "/index.md does not name its " + section);
			}
		}

		// **And the comparison is proved to fail**, because a check nobody has seen refuse is a check whose wiring is unproven: a
		// seeded directory whose index omits a file must be reported, a name an index gives and the directory lacks must be reported,
		// and a directory with no index at all must be reported rather than skipped.
		const seed = mkdtempSync(join(tmpdir(), "dove-index-problems-"));
		try {
			mkdirSync(join(seed, "seeded"), { recursive: true });
			writeFileSync(join(seed, "seeded", "index.md"), "# Index\n| [A](./a.md) |\n");
			writeFileSync(join(seed, "seeded", "a.md"), "# A\n");
			writeFileSync(join(seed, "seeded", "b.md"), "# B\n");
			assert.deepEqual(indexProblems(seed), ["seeded/b.md is not listed"], "an omission is reported");
			writeFileSync(join(seed, "seeded", "index.md"), "# Index\n| [A](./a.md) | [Gone](./gone.md) |\n");
			assert.deepEqual(indexProblems(seed), ["seeded/b.md is not listed", "seeded lists gone.md and it is not in this directory or any sibling"], "and so is a name that is not there");
			mkdirSync(join(seed, "bare"), { recursive: true });
			writeFileSync(join(seed, "bare", "only.md"), "# Only\n");
			assert.ok(indexProblems(seed).includes("bare has no index.md"), "and a directory with no index at all");
		} finally {
			rmSync(seed, { recursive: true, force: true });
		}
	});

	/** The text between the managed-block markers, which is the region a tool update owns. */
	function managedRegion(text: string): string {
		const start = text.indexOf("<!-- TRELLIS:START -->");
		const end = text.indexOf("<!-- TRELLIS:END -->");
		if (start < 0 || end < start) return "";
		return text.slice(start, end);
	}

	it("keeps this repository content outside the managed block, and the specifications untracked", () => {
		// **Two arrangements a reader cannot see, and both were guessed at before they were measured.** A previous round removed text
		// from the specification indexes on the reasoning that a tool update might rewrite them. The tool own bookkeeping answers it:
		// `.trellis/.template-hashes.json` tracks 181 files - AGENTS.md, workflow.md, the tool directories - and **not one
		// `.trellis/spec/**` path**. So the specifications are project content, and the block is the region an update owns.
		//
		// **And what those hashes can and cannot say**, measured by recomputing all 181: 73 match, 34 differ, 74 are absent - and
		// classified, the differences are a tool update since the baseline was written, generated bytecode under `__pycache__` (which
		// can never match, because CPython rewrites it), and gitignored runtime state under `.runtime/`. **`AGENTS.md` is the only
		// file this repository edited on purpose.** So the file is an init-time baseline and not a tamper check: a rule that guessed
		// at a difference would be wrong about two of its three causes, which is why this check asserts only what it can see.
		//
		// **What the marker check cannot see**: whether an update replaces the block correctly, only that our content is outside it.
		// **What the ownership check cannot see**: anything, when the bookkeeping file is absent - which is a fresh clone, and a
		// check that failed there would punish a clean checkout.
		const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");
		const SECTION = "Where this harness is documented";
		assert.ok(agents.includes(SECTION), "AGENTS.md still carries this repository own section");
		assert.ok(!managedRegion(agents).includes(SECTION), "and it is outside the managed block, which a tool update may overwrite");
		assert.ok(agents.slice(agents.indexOf("<!-- TRELLIS:END -->")).includes(SECTION), "which is to say, after the end marker");

		// **Seeded to fail**, because a rule nobody has seen refuse is a rule with unproven wiring: a document that puts the same
		// section *inside* the markers must be reported as inside.
		const seeded = "<!-- TRELLIS:START -->\n" + SECTION + "\n<!-- TRELLIS:END -->\n";
		assert.ok(managedRegion(seeded).includes(SECTION), "the rule sees content inside the block");

		const tracked = join(process.cwd(), ".trellis", ".template-hashes.json");
		if (!existsSync(tracked)) {
			// A fresh clone: the bookkeeping is management state and may simply not be there, and no ownership claim is made.
			return;
		}
		const hashes = JSON.parse(readFileSync(tracked, "utf8")) as { hashes?: Record<string, string> };
		const specs = Object.keys(hashes.hashes ?? {}).filter((path) => path.startsWith(".trellis/spec/"));
		assert.deepEqual(specs, [], "a tool update tracks a specification now, so editing one may be reverted by it");
	});

	/**
	 * Paths this repository owns, named in a specification, which do not resolve - from the repository root or from the file own
	 * directory.
	 *
	 * **Two bases, and the first version of this rule used one.** Specifications write `src/core/execution-ledger.ts` from the
	 * repository root and a handful write `../backend/personal-agent-runtime.md` from their own directory; resolving from the file
	 * alone reported all forty-two paths missing, including files that exist. A check that fires on true sentences teaches people to
	 * ignore it.
	 *
	 * **Scope: the specifications, not the guides.** A guide gives examples - `scripts/path/file.py` is a shape rather than a claim -
	 * and a rule that read them would report two true sentences.
	 */
	function specPathProblems(root: string, directories: readonly string[]): readonly string[] {
		const owns = /^(\.\/|\.\.\/)*(\.trellis|src|tests|scripts|AGENTS\.md|package\.json|tsconfig\.json)/;
		const pathInCode = /[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[a-z]{2,4}/g;
		const problems: string[] = [];
		for (const directory of directories) {
			const specDir = join(root, ".trellis", "spec", directory);
			if (!existsSync(specDir)) continue;
			for (const name of readdirSync(specDir).filter((entry) => entry.endsWith(".md"))) {
				const text = readFileSync(join(specDir, name), "utf8");
				for (const code of text.matchAll(/`([^`\n]+)`/g)) {
					for (const path of code[1].match(pathInCode) ?? []) {
						if (!owns.test(path)) continue;
						if (!existsSync(join(root, path)) && !existsSync(join(specDir, path))) problems.push(directory + "/" + name + ": " + path);
					}
				}
			}
		}
		return problems;
	}

	it("names only paths that exist, in the specifications that describe this repository", () => {
		// The rule comes from the tool own skill: `.trellis/spec/` describes the project as it exists now. Its strongest mechanical
		// part is that the paths a specification names exist.
		//
		// **What it cannot see**: whether the sentence around a path is still true. A specification may cite a real file for behaviour
		// it no longer has, and no path check can tell - which is the part a reader checks and a check cannot.
		assert.deepEqual(specPathProblems(process.cwd(), ["backend", "frontend"]), [], "a specification names a path this repository does not have");

		// **Seeded both ways**: a specification naming a missing file is reported, and one naming a file that is there is not.
		const seed = mkdtempSync(join(tmpdir(), "dove-spec-paths-"));
		try {
			mkdirSync(join(seed, ".trellis", "spec", "backend"), { recursive: true });
			mkdirSync(join(seed, "src", "core"), { recursive: true });
			writeFileSync(join(seed, "src", "core", "contracts.ts"), "export const present = true;\n");
			writeFileSync(join(seed, ".trellis", "spec", "backend", "a.md"), "# A\n\nSee `src/core/contracts.ts`.\n");
			assert.deepEqual(specPathProblems(seed, ["backend"]), [], "an existing path is not reported");
			writeFileSync(join(seed, ".trellis", "spec", "backend", "b.md"), "# B\n\nSee `src/core/gone.ts`.\n");
			assert.deepEqual(specPathProblems(seed, ["backend"]), ["backend/b.md: src/core/gone.ts"], "a missing path is");
		} finally {
			rmSync(seed, { recursive: true, force: true });
		}
	});

	/**
	 * Owned paths that the front-door documents name and this repository does not have.
	 *
	 * The front door is `README.md`, this repository own section of `AGENTS.md`, and the tracked workflow document - the three things
	 * a reader or an agent reads before anything else.
	 */
	function frontDoorProblems(root: string): readonly string[] {
		const owns = /^(\.\/|\.\.\/)*(\.trellis|src|tests|scripts|\.agents|\.codex|modes|docs|AGENTS\.md|package\.json|tsconfig\.json)/;
		const pathInCode = /[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[a-z]{2,4}/g;
		const problems: string[] = [];
		for (const file of ["README.md", "AGENTS.md", ".trellis/workflow.md"]) {
			const text = readFileSync(join(root, file), "utf8");
			for (const code of text.matchAll(/`([^`\n]+)`/g)) {
				for (const path of code[1].match(pathInCode) ?? []) {
					if (!owns.test(path)) continue;
					if (!existsSync(join(root, path)) && !existsSync(join(root, file, "..", path))) {
						problems.push(file + ": " + path);
					}
				}
			}
		}
		return problems.sort();
	}

	it("holds the front door to the paths it names, and knows which of them is not ours to fix", () => {
		// **Our own documents pass the rule the specifications carry.** `README.md` and our section of `AGENTS.md` name only paths
		// that exist - checked here rather than assumed, because the front door is what a newcomer reads first.
		//
		// **And the tracked workflow document does not, which is recorded rather than skipped.** `.trellis/workflow.md` calls itself
		// the workflow source of truth and is what the Trellis block points every agent at, and it names
		// `.trellis/scripts/inject-workflow-state.py`, which in this install ships as `.claude/hooks/inject-workflow-state.py` and
		// `.codex/hooks/inject-workflow-state.py` - a path from an older layout. The mechanism it describes works: that document
		// carries thirty `[workflow-state:...]` blocks.
		//
		// **The expected set is exact on purpose.** A check that skipped the tracked document would never say the day it stopped
		// being broken, and the note this repository added to `AGENTS.md` is correct for exactly as long as these two paths are
		// wrong - so an update that fixes the document makes this test fail, which is the reminder to remove the note.
		//
		// **One convention this check forced**: the note in AGENTS.md names the wrong path **without code marks**, because a note that
		// dressed a wrong path as code read as a wrong path - the first run of this check reported AGENTS.md as well. A correction has
		// to be able to name what it corrects, and the rule has to be able to tell prose from a claim.
		const missing = frontDoorProblems(process.cwd());
		// **Our own documents contribute nothing**, which is the part this repository is responsible for.
		assert.deepEqual(missing.filter((entry) => !entry.startsWith(".trellis/workflow.md:")), [], "a document this repository owns names a path that is not there");
		// **And the tracked document is still wrong about both paths.** Asserted as a containment rather than an exact set, because
		// the two failure modes are equal in kind: an update that fixes the document drops an entry and fails here, and so does a
		// document that grows a new wrong path.
		for (const known of [
			".trellis/workflow.md: .trellis/spec/cli/backend/workflow-state-contract.md",
			".trellis/workflow.md: .trellis/scripts/inject-workflow-state.py",
		]) {
			assert.ok(missing.includes(known), "the tool document no longer names " + known + ", so the note in AGENTS.md can be revisited");
		}
	});

	/** Which of the three shape counts differ between the two front doors - empty when they are in step. */
	function frontDoorDrift(zh: string, en: string): readonly string[] {
		const shape = (text: string) => ({
			headings: (text.match(/^#{2,3} .*/gm) ?? []).length,
			fences: (text.match(/```/g) ?? []).length,
			tableRows: (text.match(/^\|/gm) ?? []).length,
		});
		const a = shape(zh);
		const b = shape(en);
		return Object.keys(a).filter((key) => a[key as keyof typeof a] !== b[key as keyof typeof b]);
	}

	it("keeps the two front doors in step, in shape if not in meaning", () => {
		// **The only pair of user-facing documents in this repository, and nothing connected them.** A census of the tree found no
		// orphan - every directory is named in the specifications or is tool content - and one thing with no guard: `README.md` and
		// `README.en.md`, 26 KB each, structurally identical by hand. Measured when this check was written: 31 headings, 33 code
		// fences and 14 table rows in each, the headings differing only as translations, and a five percent byte difference which
		// is the language itself.
		//
		// **What it cannot do**: it compares shape, not meaning. A section translated badly, or a command changed in one language
		// and not the other, passes - and saying so is the point, because a reader who trusted this for content would be wrong.
		const read = (name: string): string => readFileSync(join(process.cwd(), name), "utf8");
		assert.deepEqual(frontDoorDrift(read("README.md"), read("README.en.md")), [], "the two READMEs drifted in shape, so one language is missing a section");

		// **Seeded both ways**: two matching documents are not reported, and an added section, then an added code block, are.
		const base = "# R\n\n## A\n\n```sh\nx\n```\n";
		assert.deepEqual(frontDoorDrift(base, base), [], "a matching pair");
		assert.deepEqual(frontDoorDrift(base, base + "\n## B\n"), ["headings"], "a section in one language only");
		assert.deepEqual(frontDoorDrift(base, base + "\n## B\n\n```sh\ny\n```\n"), ["headings", "fences"], "and a code block with it");
	});

	it("cites a thing and not a position, in the live code", () => {
		// **A prohibition, which is the one thing a pattern check can honestly do.** A comment citing a line of this
		// repository is wrong the moment somebody edits above it, and nothing notices: of the eighteen citations this round
		// found, two were already stale, and one of those went stale when an extraction moved every line of the adapter. So a
		// citation names what it points at - a file, a symbol, a tool - and the position is not written down.
		//
		// **Two allowances, named rather than implied.** \`types.d.ts\` is the Pi host own type file, pinned by version and not
		// ours to keep in sync, so a citation into it is left alone. \`scripts/mode-behaviour-map.mts\` is the withdrawn map,
		// whose citations **are** its evidence - its finding is that specific lines did not mean what it claimed - so this
		// check reads the live code, which is \`src\` and \`tests\`.
		//
		// **What it cannot do**: it forbids a pattern, so it cannot tell whether the file a citation names is the right one. A
		// prohibition is a floor, not a proof, and a check that read as proof would be worse than none.
		const offenders: string[] = [];
		for (const file of walk(["src", "tests"])) {
			const lines = readFileSync(file, "utf8").split(/\r?\n/);
			lines.forEach((line, index) => {
				if (!/^\s*(\/\/|\*|\/\*)/.test(line)) return;
				for (const match of line.matchAll(/[A-Za-z0-9_./-]+\.(?:ts|mts):\d+/g)) {
					const name = match[0].slice(0, match[0].lastIndexOf(":"));
					if (name.endsWith("types.d.ts")) continue;
					offenders.push(file + ":" + String(index + 1) + "  " + match[0]);
				}
			});
		}
		assert.deepEqual(offenders, [], "a comment cites a line of this repository, which drifts: name the thing instead");
	});

	it("names only .dove paths that code builds, which is a different property from existing", () => {
		// **A runtime path need not exist, and the case above holds existence.** `.dove/state.json` and `.dove/tasks/<id>` are paths the
		// code builds when it runs, and a fresh checkout has neither. So this asserts the other property: a path a front door names must
		// be one some code constructs - which is what a previous round found the help violating, with a file that is not in the layout.
		//
		// **It errs toward silence**: any mention of the name in `src` counts, so it cannot call a built path unbuilt.
		const named = new Set<string>();
		for (const file of ["README.md", "README.en.md"]) {
			for (const match of readFileSync(join(process.cwd(), file), "utf8").matchAll(/\.dove\/([A-Za-z0-9_.-]+)/g)) {
				named.add(match[1] as string);
			}
		}
		assert.ok(named.size > 0, "the front doors no longer name a .dove path, which is its own kind of wrong");

		const built = walk(["src"])
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");
		const unbuilt = [...named].filter((name) => !built.includes('"' + name + '"'));
		assert.deepEqual(unbuilt, [], "a front door names a .dove path that no code builds: " + unbuilt.join(", "));
	});
});
/**
 * **Which class of defect this holds, and which it does not.** It holds a *pointer*: every test path named in the capability runtime
 * specification resolves to a file that exists. It does **not** hold that the named test actually exercises the promised behaviour -
 * that judgement needs a reader, and a check which implied it would be a control pretending to be a proof. The pointers exist so that
 * a reader knows where to look; this keeps them from rotting.
 */
describe("the capability runtime specification pointers", () => {
	it("names only test files that exist", () => {
		const spec = readFileSync(join(process.cwd(), ".trellis/spec/backend/personal-agent-capability-runtime.md"), "utf8");
		const named = [...spec.matchAll(/`(tests\/[^`]+\.test\.ts)`/g)].map((match) => match[1]);
		assert.ok(named.length >= 5, "the specification names several holders, so a zero or tiny extraction is a broken pattern");
		for (const path of new Set(named)) {
			assert.ok(existsSync(join(process.cwd(), path)), `${path} is named as a holder and does not exist`);
		}
	});
});