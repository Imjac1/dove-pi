import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeExecutionRecords } from "../src/core/execution-ledger.ts";
import type { ExecutionRecord, ExecutionRecordKind } from "../src/core/contracts.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the audit summary projection: the
 * counts the child task acceptance criteria name - lifecycle, abort reasons, coalesced redeliveries, duplicate
 * tool calls - and the rule that a field which is not there is reported `unknown` rather than inferred.
 *
 * **It does not hold cross-turn stagnation or cache-prefix changes**, because the summary deliberately does not
 * claim them, and it does not hold the CLI wiring or the rendering, which consume this projection.
 */

function record(kind: ExecutionRecordKind, details: Record<string, unknown> = {}, correlation?: ExecutionRecord["correlation"]): ExecutionRecord {
	return {
		taskId: "task-1",
		stepId: "step-1",
		kind,
		timestamp: "2026-09-29T00:00:00.000Z",
		mode: "standard",
		details,
		...(correlation === undefined ? {} : { correlation }),
	};
}

const lines = (...records: readonly ExecutionRecord[]): string => records.map((entry) => JSON.stringify(entry)).join("\n");

describe("summarizing a ledger read-only", () => {
	it("counts the lifecycle, and reports an abort reason it finds", () => {
		const summary = summarizeExecutionRecords(lines(
			record("request.received", {}, { requestId: "req-1" }),
			record("request.terminal", { reason: "user_cancelled", policyAbort: true }, { requestId: "req-1" }),
			record("request.terminal", { reason: "provider_failed" }, { requestId: "req-2" }),
		));
		assert.equal(summary.lifecycle.received, 1);
		assert.equal(summary.lifecycle.terminal, 2);
		assert.equal(summary.lifecycle.aborted, 1, "only the terminal carrying policyAbort is an abort");
		assert.deepEqual(summary.lifecycle.terminalReasons, { user_cancelled: 1, provider_failed: 1 });
	});

	it("labels a terminal whose reason is absent rather than dropping or guessing it", () => {
		const summary = summarizeExecutionRecords(lines(record("request.terminal", {}, { requestId: "req-1" })));
		assert.deepEqual(summary.lifecycle.terminalReasons, { unknown: 1 });
		assert.equal(summary.lifecycle.terminal, 1);
	});

	it("counts a coalesced redelivery, which is the defect the idempotency child removed", () => {
		const summary = summarizeExecutionRecords(lines(
			record("request.received", {}, { requestId: "req-1" }),
			record("request.redelivery.coalesced", {}, { requestId: "req-1" }),
			record("request.redelivery.coalesced", {}, { requestId: "req-1" }),
		));
		assert.equal(summary.lifecycle.coalescedRedeliveries, 2);
	});

	it("counts a tool call identifier seen twice, and separates the ones with no identifier at all", () => {
		const summary = summarizeExecutionRecords(lines(
			record("tool.observed", {}, { requestId: "req-1", toolCallId: "call-1" }),
			record("tool.observed", {}, { requestId: "req-1", toolCallId: "call-1" }),
			record("tool.observed", {}, { requestId: "req-1", toolCallId: "call-2" }),
			record("tool.observed", {}, { requestId: "req-1" }),
		));
		assert.equal(summary.tools.duplicateToolCalls, 1, "one identifier was seen twice");
		assert.equal(summary.tools.unattributable, 1, "a call with no identifier cannot be counted as a duplicate");
		assert.equal(summary.tools.observed, 4);
	});

	it("carries the family counts and the groups, and how many groups are incomplete", () => {
		const summary = summarizeExecutionRecords(lines(
			record("model.budget.checked", {}, { requestId: "req-1" }),
			record("request.received", {}, { requestId: "req-1" }),
			record("mode.changed"),
		));
		assert.equal(summary.records, 3);
		assert.equal(summary.groups, 2);
		assert.equal(summary.groupsMissingCorrelation, 1, "the legacy record cannot be joined to anything");
		assert.equal(summary.families.tool_loop, 1);
		assert.equal(summary.families.request_lifecycle, 1);
		assert.equal(summary.families.other, 1);
	});

	it("reads an empty ledger as empty, and a truncated last line as no record", () => {
		assert.equal(summarizeExecutionRecords("").records, 0);
		const truncated = summarizeExecutionRecords(lines(record("request.received", {}, { requestId: "req-1" })) + "\n{\"taskId\":\"task-1\",");
		assert.equal(truncated.records, 1, "the one reader decides what is a record, and this adds no second reading");
	});
});
