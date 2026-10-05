import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectExecutionDiagnostics } from "../src/core/execution-ledger.ts";
import type { ExecutionRecord } from "../src/core/contracts.ts";

/**
 * **Two defects of one shape live here: a key that must be absent, and rows that were recorded and never read back.**
 *
 * The first is the absence case. The contract named `lastTerminal` and `lastResourceObservation` as if they were always there;
 * the interface marks them optional and the builder spreads them conditionally, so the prose was the one place that overstated.
 * Measured on a real `doctor` run in a workspace with no ledger records: `schemaVersion` alone, and neither key present. The
 * presence case for those two is asserted elsewhere, in the CLI, adapter and RPC suites.
 *
 * The second is `lastRefusals`, and it is the one this file now owns whole. `gate.refused` rows have been written since the
 * gate boundary existed and **no projection exposed them**, so a refused action was readable only in the tool result that
 * carried it and in a notification that scrolls away. The bound, the order, the truncation and the two filters are the contract;
 * a case here checks each, because a bound that is off by one or a filter that is ignored still returns a plausible array.
 *
 * **What this does not check:** that the projection is *reached* by a user-facing command. That is `tests/pi-adapter.test.ts`,
 * which drives `/status full` through a fake host - a projection nothing displays is the defect this file's second subject
 * exists to close, and this file cannot see it.
 */
describe("the execution diagnostics projection", () => {
	it("carries only the schema version when the ledger holds nothing to project", () => {
		const projection = projectExecutionDiagnostics([]);
		assert.equal(projection.schemaVersion, 1);
		assert.equal("lastTerminal" in projection, false, "the key is omitted, not present with an undefined value");
		assert.equal("lastResourceObservation" in projection, false);
		assert.equal("lastRefusals" in projection, false, "a session with no refusal must not look like one whose refusals were dropped");
		assert.deepEqual(Object.keys(projection), ["schemaVersion"], "a key-by-key consumer sees exactly one field here");
	});

	it("returns the refusals it recorded, oldest first, so the sequence a user reads is the sequence that happened", () => {
		const projection = projectExecutionDiagnostics([refusal(1), refusal(2), refusal(3)]);
		assert.deepEqual(
			projection.lastRefusals?.map((entry) => entry.action),
			["action-1", "action-2", "action-3"],
		);
		assert.equal(projection.lastRefusals?.[0]?.gate, "limit");
		assert.equal(projection.lastRefusals?.[0]?.reason, "reason-1");
		assert.equal(projection.lastRefusals?.[0]?.requestId, "req-1");
	});

	it("keeps the most recent refusals under the bound, and reports nothing before them", () => {
		const projection = projectExecutionDiagnostics(Array.from({ length: 12 }, (_, index) => refusal(index + 1)));
		const refusals = projection.lastRefusals ?? [];
		assert.equal(refusals.length, 8, "the bound is 8");
		assert.equal(refusals[0]?.action, "action-5", "the earliest four fall outside the window");
		assert.equal(refusals[refusals.length - 1]?.action, "action-12", "the newest refusal is last");
	});

	it("filters by session, so one workspace whose ledger holds two sessions reports one", () => {
		const projection = projectExecutionDiagnostics(
			[refusal(1, { sessionId: "session-a" }), refusal(2, { sessionId: "session-b" }), refusal(3, { sessionId: "session-a" })],
			{ sessionId: "session-a" },
		);
		assert.deepEqual(projection.lastRefusals?.map((entry) => entry.action), ["action-1", "action-3"]);
	});

	it("filters by request, so one request's refusals can be read without the ones after it", () => {
		const projection = projectExecutionDiagnostics(
			[refusal(1, { requestId: "req-a" }), refusal(2, { requestId: "req-b" }), refusal(3, { requestId: "req-a" })],
			{ requestId: "req-a" },
		);
		assert.deepEqual(projection.lastRefusals?.map((entry) => entry.action), ["action-1", "action-3"]);
	});

	it("bounds a long reason, and does not carry the remediation the ledger also recorded", () => {
		const long = "r".repeat(4_000);
		const projection = projectExecutionDiagnostics([refusal(1, { reason: long })]);
		const entry = projection.lastRefusals?.[0];
		assert.equal(entry?.reason.length, 1_024, "a refused action cannot push unbounded prose into every diagnostic read");
		assert.equal("remediation" in (entry as object), false, "the projection never echoes arbitrary ledger details");
	});

	it("names a field it could not read rather than dropping the refusal", () => {
		const partial = { ...refusal(1), details: { gate: "deny" } } as ExecutionRecord;
		const projection = projectExecutionDiagnostics([partial]);
		assert.equal(projection.lastRefusals?.length, 1, "a malformed row is still a refusal that happened");
		assert.equal(projection.lastRefusals?.[0]?.action, "unknown");
		assert.equal(projection.lastRefusals?.[0]?.reason, "no reason recorded");
	});

	it("separates a call that has not returned from one that did, and from a ledger where no call started", () => {
		// **The reading a hang leaves.** `tool.observed` is written at `tool_result` and only when the call did not error,
		// so before `tool.started` existed a call that never returned was indistinguishable from one that was never
		// made - measured twice, six and a half minutes in one run and forty-five in another, with the outer watchdog as
		// the only record of either. The relation is the one `unterminatedRequests` already states for requests, and the
		// absence case follows the rule this file already owns: a ledger where nothing started must not read as one
		// whose calls were dropped.
		const outstanding = projectExecutionDiagnostics([toolStarted("call-a")]);
		assert.equal(outstanding.toolCallsStarted, 1);
		assert.equal(outstanding.toolCallsObserved, 0);
		assert.deepEqual(outstanding.unterminatedToolCalls, ["call-a"], "a call with no observation is the call that has not returned");

		const settled = projectExecutionDiagnostics([toolStarted("call-a"), toolObserved("call-a")]);
		assert.equal(settled.toolCallsStarted, 1);
		assert.equal(settled.toolCallsObserved, 1);
		assert.equal("unterminatedToolCalls" in settled, false, "a call that returned leaves the key out rather than emptying it");

		const startedAndAnother = projectExecutionDiagnostics([toolStarted("call-a"), toolStarted("call-b"), toolObserved("call-a")]);
		assert.deepEqual(startedAndAnother.unterminatedToolCalls, ["call-b"], "only the call still outstanding is named");

		const none = projectExecutionDiagnostics([]);
		assert.equal("toolCallsStarted" in none, false, "a ledger where no call started must not read as one whose calls were dropped");
	});
});

function refusal(
	index: number,
	overrides: { sessionId?: string; requestId?: string; reason?: string } = {},
): ExecutionRecord {
	return {
		taskId: "task",
		stepId: `gate:${index}`,
		kind: "gate.refused",
		timestamp: `2026-09-29T00:00:${String(index).padStart(2, "0")}.000Z`,
		mode: "standard",
		correlation: {
			requestId: overrides.requestId ?? `req-${index}`,
			...(overrides.sessionId === undefined ? {} : { sessionId: overrides.sessionId }),
			toolCallId: `call-${index}`,
			taskId: "task",
		},
		details: {
			tool: "write",
			action: `action-${index}`,
			viaCapability: false,
			gate: "limit",
			reason: overrides.reason ?? `reason-${index}`,
			remediation: "do something else",
		},
	} as ExecutionRecord;
}

/** A call that began. The pair with `toolObserved` is what the projection reads as outstanding or returned. */
function toolStarted(id: string): ExecutionRecord {
	return {
		taskId: "task",
		stepId: `tool:${id}`,
		kind: "tool.started",
		timestamp: "2026-09-29T00:00:01.000Z",
		mode: "standard",
		correlation: { requestId: "req-1", toolCallId: id, taskId: "task" },
		details: { tool: "bash", timeoutApplied: false, toolCallId: id },
	} as ExecutionRecord;
}

/** A call the harness saw return. Written at `tool_result`, so its absence is what a hang looks like. */
function toolObserved(id: string): ExecutionRecord {
	return {
		taskId: "task",
		stepId: `tool:${id}`,
		kind: "tool.observed",
		timestamp: "2026-09-29T00:00:02.000Z",
		mode: "standard",
		correlation: { requestId: "req-1", toolCallId: id, taskId: "task" },
		details: { tool: "bash", isError: false, toolCallId: id },
	} as ExecutionRecord;
}
