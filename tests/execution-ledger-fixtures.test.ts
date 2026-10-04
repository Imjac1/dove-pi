import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLedgerLines, summarizeExecutionRecords } from "../src/core/execution-ledger.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the reader and the projection against
 * inputs designed to break them: a legacy ledger with no correlation at all, a line that is not JSON, JSON
 * that is not an object, a ledger whose last line a crash cut short, and records carrying the shapes the child
 * task redaction requirements name.
 *
 * **It does not hold the maintenance-side redaction**, which the installer suite covers, and it does not hold
 * the CLI rendering, which consumes these projections rather than forming them.
 */

const fixture = (name: string): string => readFileSync(join(process.cwd(), "tests", "fixtures", "ledger", name), "utf8");

describe("the ledger reader against fixtures built to break it", () => {
	it("reads a legacy ledger, where no record carries a correlation", () => {
		const summary = summarizeExecutionRecords(fixture("legacy.jsonl"));
		assert.equal(summary.records, 3, "every legacy line parses");
		assert.equal(summary.lifecycle.received, 1);
		assert.equal(summary.lifecycle.terminal, 1);
		assert.equal(summary.lifecycle.terminalReasons.unknown, 1, "the legacy terminal has no reason to report");
		assert.equal(summary.groupsMissingCorrelation, 1, "all three land in one unlinked group");
		// The legacy fixture's third line names a kind no child claims, which is what puts it in `other`: a reader must read a
		// kind it does not know rather than refuse the ledger, and that is the property this line holds.
		assert.equal(summary.families.other, 1, "a kind no child claims lands in other");
	});

	it("drops a line that is not a record and keeps the ones that are", () => {
		const records = parseLedgerLines(fixture("malformed.jsonl"));
		const kinds = records.map((record) => record?.kind);
		assert.deepEqual(kinds, ["request.received", "request.terminal"], "only the two real records survive");
		for (const kind of kinds) {
			assert.equal(typeof kind, "string", "a surviving record has a kind the projection can read");
		}
	});

	it("summarizes a malformed ledger without throwing, and counts only what it read", () => {
		const summary = summarizeExecutionRecords(fixture("malformed.jsonl"));
		assert.equal(summary.records, 2);
		assert.deepEqual(summary.lifecycle.terminalReasons, { shutdown: 1 });
	});

	it("reads a truncated last line as no record, which is what the one reader decides", () => {
		const content = fixture("incomplete.jsonl");
		assert.ok(!content.endsWith("\n"), "the fixture ends mid-line on purpose");
		// **Counted from the file rather than asserted from memory**: five raw lines, one of which a crash cut
		// short, so four records - and the cut line is the one whose JSON never closed.
		assert.equal(content.split(/\r?\n/).length, 5, "the fixture holds five raw lines");
		assert.equal(parseLedgerLines(content).length, 4, "and the cut-short line is not a record");
	});

	it("counts an incomplete ledger, and a duplicate tool call, without inventing either", () => {
		const summary = summarizeExecutionRecords(fixture("incomplete.jsonl"));
		// Three tool.observed records parse - the fourth raw one is the line the crash cut - and one of the three
		// carries no correlation at all, which is the count that must not be folded into the duplicates.
		assert.equal(summary.tools.observed, 3, "three tool calls survived the cut");
		assert.equal(summary.tools.duplicateToolCalls, 1, "call-1 appears twice");
		assert.equal(summary.tools.unattributable, 1, "and one call carries no identifier");
	});

	it("reports an aborted terminal by its policy flag even with no correlation", () => {
		const summary = summarizeExecutionRecords(fixture("incomplete.jsonl"));
		assert.equal(summary.lifecycle.aborted, 1);
		assert.ok(summary.groupsMissingCorrelation >= 1);
	});

	it("keeps a secret out of the summary it produces", () => {
		const summary = summarizeExecutionRecords(fixture("secret-bearing.jsonl"));
		const rendered = JSON.stringify(summary);
		for (const secret of ["ghp_thislookslikeatoken", "sk-live-shouldnotappear", "hunter2"]) {
			assert.ok(!rendered.includes(secret), `the summary must not carry ${secret}`);
		}
		assert.equal(summary.records, 3, "and it still counted the records it read");
	});
});
