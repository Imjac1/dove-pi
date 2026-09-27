import { existsSync, readFileSync } from "node:fs";
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
});
