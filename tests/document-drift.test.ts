import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseHarnessSurface } from "../src/core/harness-surface.ts";
import { convergenceOperationFromPiInput } from "../src/pi-adapter/extension.ts";
import * as record from "../src/core/task-convergence.ts";

/**
 * **Two documents that name things, and the check that executes the names.**
 *
 * The turn guide tells a person which tool call to make and which fields to send; the declaration `embedded` list says which
 * symbols inside a mostly-harness file are verifier code. Nothing kept either claim true, so a rename or a field change would
 * leave both pointing at something that is gone - and a reader would follow the guide into a refusal, or look up a symbol that
 * no longer exists.
 *
 * **What this checks**: the declaration symbols are exported functions of the module their entry names, the fields the guide
 * lists are accepted by the mapper that consumes them, `status` refuses as read-only because the guide says it is, and the
 * scripts the guide quotes exist and are quoted.
 *
 * **What this does not check, stated rather than left to be assumed:**
 *
 * - **`operation=applied` is not mapped.** The mapper union has ten operations and `applied` is not among them: the tool
 *   execute handles it before the mapper, which is where its refusals live and where `tests/pi-adapter.test.ts` exercises
 *   them. A drift test cannot call the mapper for it, so it does not claim to.
 * - **The guide prose is not checked.** Which surface to choose, what to predict, whether to keep or revert - those are the
 *   judgments the guide exists to leave visible, and a test that "checked" them would check nothing.
 *
 * A drift check keeps names true and says nothing about meaning; one that reads as complete would be worse than one that
 * says where it stops.
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
				if (name.endsWith(".md") && !existsSync(join(directory, name))) problems.push(entry.name + " lists " + name + " and it does not exist");
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
		assert.deepEqual(indexProblems(join(process.cwd(), ".trellis", "spec")), [], "a specification index and its directory disagree");

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
			assert.deepEqual(indexProblems(seed), ["seeded/b.md is not listed", "seeded lists gone.md and it does not exist"], "and so is a name that is not there");
			mkdirSync(join(seed, "bare"), { recursive: true });
			writeFileSync(join(seed, "bare", "only.md"), "# Only\n");
			assert.ok(indexProblems(seed).includes("bare has no index.md"), "and a directory with no index at all");
		} finally {
			rmSync(seed, { recursive: true, force: true });
		}
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
});
