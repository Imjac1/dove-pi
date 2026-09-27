import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExecutionRecord, ExecutionRecordKind } from "../src/core/contracts.ts";
import { summarizeCorpus, type CorpusLedger } from "../src/core/harness-corpus.ts";

/**
 * The corpus summary, over constructed ledgers. Every count in it comes from a rule that already exists - the axis
 * classification, the failure reading, the refusal split - so what these tests pin is that the summary uses them rather
 * than approximating them, and that an empty corpus says **why** it is empty.
 */

const AT = "2026-09-28T00:00:00.000Z";

function record(kind: ExecutionRecordKind, details: Record<string, unknown>, requestId?: string): ExecutionRecord {
	return { taskId: "t", stepId: "s", kind, timestamp: AT, mode: "standard", details, ...(requestId === undefined ? {} : { correlation: { requestId } }) };
}

function terminal(reason: string, origin = "session", code = reason, requestId = "req-" + reason): ExecutionRecord {
	return record("request.terminal", { reason, terminal: { origin, code, retryable: false } }, requestId);
}

function ledger(...records: ExecutionRecord[]): CorpusLedger {
	return { path: "fixture.jsonl", records };
}

describe("what the recorded corpus contains", () => {
	it("counts ledgers, records, kinds and requests", () => {
		// The received record and the terminal carry the **same** id: a terminal belongs to the request it ends, and a
		// fixture that gave them different ids would count two requests where a run had one.
		const summary = summarizeCorpus([
			ledger(record("request.received", {}, "req-1"), terminal("completed", "session", "completed", "req-1"), record("runtime.phase.completed", {})),
			ledger(record("request.received", {}, "req-2"), terminal("completed", "session", "completed", "req-2")),
		]);
		assert.equal(summary.ledgers, 2);
		assert.equal(summary.records, 5);
		assert.equal(summary.requests, 2);
		assert.equal(summary.kinds["request.terminal"], 2);
		assert.equal(summary.kinds["request.received"], 2);
	});

	it("classifies terminals with the axis rule, and reports the failures as failure records", () => {
		const summary = summarizeCorpus([ledger(terminal("completed"), terminal("recovered", "session", "recovered"), terminal("cancelled", "user", "user-cancelled"), terminal("failed", "provider", "provider-attempt-limit"))]);
		assert.deepEqual(summary.terminalClasses, { clean: 1, recovered: 1, interrupted: 1, failure: 1 });
		assert.equal(summary.failures.length, 1, "the class the axis calls a failure is the one the reading emits");
		assert.equal(summary.failures[0]?.mechanism.code, "provider-attempt-limit");
	});

	it("splits a composite refusal label and counts one with no request id as unrefused", () => {
		const summary = summarizeCorpus([ledger(record("gate.refused", { gate: "deny+scope" }, "req-1"), record("gate.refused", { gate: "fence" }))]);
		assert.deepEqual(summary.refusals.byLabel, { deny: 1, scope: 1, fence: 1 });
		assert.equal(summary.refusals.total, 3, "the atom count, not the entry count");
		assert.equal(summary.unrefused, 1);
		assert.match(summary.corpus.join(" "), /1 refusal\(s\) carry no request id/);
	});

	it("says why a corpus with no failure has none, instead of only saying zero", () => {
		// The point of the reading: "zero failures" on its own reads as a healthy harness, and it is a statement about
		// what was kept. The note is the measured cause, not a guess.
		const summary = summarizeCorpus([ledger(terminal("completed"))]);
		assert.deepEqual(summary.failures, []);
		assert.match(summary.corpus.join(" "), /no failure record in the corpus/);
		assert.match(summary.corpus.join(" "), /state directories are not preserved/);
	});

	it("does not say it when the corpus holds a failure", () => {
		const summary = summarizeCorpus([ledger(terminal("failed", "provider", "provider-x"))]);
		assert.equal(summary.failures.length, 1);
		assert.doesNotMatch(summary.corpus.join(" "), /no failure record/, "the note is about an absence, and there is no absence here");
	});

	it("says nothing to read when there is nothing at all", () => {
		const summary = summarizeCorpus([]);
		assert.equal(summary.ledgers, 0);
		assert.equal(summary.records, 0);
		assert.deepEqual(summary.failures, []);
		assert.match(summary.corpus.join(" "), /no ledger at all/);
	});
});
