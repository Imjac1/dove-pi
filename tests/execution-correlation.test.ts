import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { correlateExecutionRecords, executionEvidenceFamily, UNLINKED_GROUP_KEY } from "../src/core/execution-ledger.ts";
import type { ExecutionRecord, ExecutionRecordKind } from "../src/core/contracts.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the correlation contract: records are
 * joined by the strongest identifier they carry, the key is chosen by strength rather than by position, each
 * group counts the defect families the child tasks eliminated, and a group holding a record with no
 * correlation is marked incomplete rather than given an invented key.
 *
 * **It does not hold how the writer populates `correlation`** - that is the request lifecycle child own work -
 * and it does not hold the audit summary rendering, which consumes these groups rather than forming them.
 */

function record(kind: ExecutionRecordKind, correlation?: ExecutionRecord["correlation"]): ExecutionRecord {
	return {
		taskId: "task-1",
		stepId: "step-1",
		kind,
		timestamp: "2026-09-29T00:00:00.000Z",
		mode: "standard",
		details: {},
		...(correlation === undefined ? {} : { correlation }),
	};
}

describe("correlating lifecycle records", () => {
	it("joins records by request id, and counts the families the children eliminated", () => {
		const groups = correlateExecutionRecords([
			record("model.budget.checked", { requestId: "req-1" }),
			record("request.received", { requestId: "req-1" }),
			record("request.terminal", { requestId: "req-1" }),
			record("tool.observed", { requestId: "req-1" }),
		]);
		assert.equal(groups.length, 1, "one logical request is one group");
		const group = groups[0]!;
		assert.equal(group.key, "req-1");
		assert.equal(group.keyKind, "requestId");
		assert.equal(group.complete, true);
		assert.equal(group.families.request_lifecycle, 2);
		assert.equal(group.families.tool_loop, 2);
	});

	it("prefers the strongest key, so a session-wide record does not swallow a request group", () => {
		const groups = correlateExecutionRecords([
			record("model.budget.checked", { sessionId: "sess-1" }),
			record("request.received", { sessionId: "sess-1", requestId: "req-1" }),
			record("request.attempt.started", { sessionId: "sess-1", requestId: "req-1", attemptId: "att-1" }),
		]);
		const byKey = new Map(groups.map((group) => [group.key, group]));
		assert.equal(byKey.get("req-1")?.keyKind, "requestId", "the request id is stronger than the session id");
		assert.equal(byKey.get("req-1")?.records.length, 2, "attemptId does not narrow a record out of its request");
		assert.equal(byKey.get("sess-1")?.keyKind, "sessionId");
	});

	it("groups a legacy record under the unlinked key and marks the group incomplete", () => {
		const groups = correlateExecutionRecords([record("capability.started")]);
		assert.equal(groups.length, 1);
		assert.equal(groups[0]!.key, UNLINKED_GROUP_KEY);
		assert.equal(groups[0]!.keyKind, "unlinked");
		assert.equal(groups[0]!.complete, false, "the contract says correlation is optional for legacy records");
		assert.equal(groups[0]!.families.other, 1);
	});

	it("names the family of a kind, and calls an unclaimed kind other", () => {
		assert.equal(executionEvidenceFamily("request.redelivery.coalesced"), "request_lifecycle");
		assert.equal(executionEvidenceFamily("model.budget.rejected"), "tool_loop");
		assert.equal(executionEvidenceFamily("provider.request.rejected"), "tool_loop");
		assert.equal(executionEvidenceFamily("tool.observed"), "tool_loop");
		// The control: a kind no child claimed is not forced into one of the three.
		assert.equal(executionEvidenceFamily("capability.started"), "other");
	});

	it("keeps an empty input empty rather than inventing a group", () => {
		assert.deepEqual(correlateExecutionRecords([]), []);
	});
});
