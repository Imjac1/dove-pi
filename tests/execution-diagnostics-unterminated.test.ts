import { test } from "node:test";
import assert from "node:assert/strict";
import { projectExecutionDiagnostics } from "../src/core/execution-ledger.ts";

/** The record type is not exported, so it is taken from the function's own parameter - the shape stays its business. */
type ExecutionRecord = Parameters<typeof projectExecutionDiagnostics>[0][number];

/**
 * A session that never terminated must be visible from the ledger alone.
 *
 * The twelve-session run hit three host-level hard stops with three different signatures and could locate none
 * of them, and the whole of that difficulty was that "the process is still working" and "the process is gone"
 * looked the same from outside. The ledger already records both ends of that question - `request.received` when
 * a request arrives and `request.terminal` when it ends - so a killed process is a request that was received
 * and never terminated. The projection reported the *last* terminal it saw and not whether the counts matched,
 * which is the one comparison that answers it.
 *
 * This is the same shape as the rule in `harness-axes.ts` that a ledger with no terminals must not report a
 * perfect score: an absence is evidence, and a projection that cannot express the absence cannot carry it.
 */
const mode = { id: "code-development", version: "1.0.0", governanceVersion: "1.0.0" } as unknown as ExecutionRecord["mode"];

function record(kind: ExecutionRecord["kind"], requestId: string, at: string): ExecutionRecord {
	return { taskId: "t-1", stepId: `request:${requestId}`, kind, timestamp: at, mode, details: {}, correlation: { requestId } };
}

test("a projection over a ledger whose requests all terminated reports no gap", () => {
	const records = [
		record("request.received", "req_1", "2026-10-04T00:00:00.000Z"),
		record("request.terminal", "req_1", "2026-10-04T00:01:00.000Z"),
		record("request.received", "req_2", "2026-10-04T00:02:00.000Z"),
		record("request.terminal", "req_2", "2026-10-04T00:03:00.000Z"),
	];
	const projection = projectExecutionDiagnostics(records) as unknown as { requestsReceived?: number; requestsTerminated?: number; unterminatedRequests?: readonly string[] };
	assert.equal(projection.requestsReceived, 2, "two requests arrived");
	assert.equal(projection.requestsTerminated, 2, "and two ended");
	assert.deepEqual(projection.unterminatedRequests ?? [], [], "so nothing is unterminated, and the check is not vacuous");
});

test("a received request with no terminal record is reported, because that is what a killed process looks like", () => {
	const records = [
		record("request.received", "req_1", "2026-10-04T00:00:00.000Z"),
		record("request.terminal", "req_1", "2026-10-04T00:01:00.000Z"),
		record("request.received", "req_2", "2026-10-04T00:02:00.000Z"),
	];
	const projection = projectExecutionDiagnostics(records) as unknown as { requestsReceived?: number; requestsTerminated?: number; unterminatedRequests?: readonly string[] };
	assert.equal(projection.requestsReceived, 2, "the projection must say how many requests arrived");
	assert.equal(projection.requestsTerminated, 1, "and how many ended");
	assert.deepEqual(
		projection.unterminatedRequests,
		["req_2"],
		"a request that arrived and never terminated is the only evidence a killed process leaves, and the projection must carry it",
	);
});
