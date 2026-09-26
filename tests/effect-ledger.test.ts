import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createEffectLedger,
	createInMemoryEffectStore,
	deriveEffectKey,
	dispatchOnce,
	EffectIsolationError,
	type EffectRecord,
} from "../src/core/effect-ledger.ts";

const MODE = { id: "code-audit", version: "1.0.0", governanceVersion: "1" };
const NOW = "2026-09-25T12:00:00.000Z";

function record(overrides: Partial<EffectRecord> = {}): Omit<EffectRecord, "startedAt"> {
	const base = {
		effectKey: deriveEffectKey({ engagement: "eng-1", mode: MODE, tool: "write_report", argumentsDigest: "d1" }),
		engagement: "eng-1",
		mode: MODE,
		tool: "write_report",
		decision: "allowed" as const,
	};
	return { ...base, ...overrides };
}

describe("effect identity", () => {
	it("is stable for the same logical effect and changes with any component", () => {
		const key = (o: Parameters<typeof deriveEffectKey>[0]) => deriveEffectKey(o);
		const a = key({ engagement: "eng-1", mode: MODE, tool: "t", argumentsDigest: "d" });
		assert.equal(a, key({ engagement: "eng-1", mode: MODE, tool: "t", argumentsDigest: "d" }), "a retry must derive the same key");
		assert.notEqual(a, key({ engagement: "eng-2", mode: MODE, tool: "t", argumentsDigest: "d" }));
		assert.notEqual(a, key({ engagement: "eng-1", mode: { ...MODE, version: "1.0.1" }, tool: "t", argumentsDigest: "d" }));
		assert.notEqual(a, key({ engagement: "eng-1", mode: MODE, tool: "t", argumentsDigest: "d2" }));
	});

	it("lets an explicit key win, so a venue-level idempotency key can be used", () => {
		const withExplicit = deriveEffectKey({ engagement: "eng-1", mode: MODE, tool: "order.submit", argumentsDigest: "d", explicitKey: "client-order-42" });
		const without = deriveEffectKey({ engagement: "eng-1", mode: MODE, tool: "order.submit", argumentsDigest: "d" });
		assert.notEqual(withExplicit, without);
		assert.equal(withExplicit, deriveEffectKey({ engagement: "eng-1", mode: MODE, tool: "order.submit", argumentsDigest: "d", explicitKey: "client-order-42" }));
	});
});

describe("effect ledger", () => {
	it("records the mode identity and the resolved grants on every entry", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore(), now: () => NOW });
		const result = await ledger.begin({ ...record(), grantIds: ["g-1"] });
		assert.equal(result.claimed, true);
		const entries = ledger.records();
		assert.equal(entries.length, 1);
		assert.deepEqual(entries[0]?.mode, MODE, "the record must answer what was allowed when this ran");
		assert.deepEqual(entries[0]?.grantIds, ["g-1"]);
		assert.equal(entries[0]?.startedAt, NOW);
	});

	it("refuses a record from another engagement rather than mixing evidence", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		await assert.rejects(() => ledger.begin(record({ engagement: "eng-2" })), EffectIsolationError);
	});

	it("marks a completed effect and exposes the outcome", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore(), now: () => NOW });
		const rec = record();
		await ledger.begin(rec);
		await ledger.complete(rec.effectKey, { outcome: "completed", artifacts: ["report.sarif"] });
		const entry = ledger.records()[0];
		assert.equal(entry?.outcome, "completed");
		assert.deepEqual(entry?.artifacts, ["report.sarif"]);
	});
});

describe("dispatchOnce (exactly-once at the effect boundary)", () => {
	it("does not re-dispatch an effect that already completed", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		let executions = 0;
		const first = await dispatchOnce(ledger, rec, async () => { executions += 1; return "first"; });
		const second = await dispatchOnce(ledger, rec, async () => { executions += 1; return "second"; });
		assert.equal(first.executed, true);
		assert.equal(first.value, "first");
		assert.equal(second.executed, false, "a completed effect must not run again");
		assert.equal(second.existing?.outcome, "completed");
		assert.equal(executions, 1);
	});

	it("executes exactly once when several resumers race for the same effect", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		let executions = 0;
		const results = await Promise.all(
			Array.from({ length: 8 }, () => dispatchOnce(ledger, rec, async () => { executions += 1; return "x"; })),
		);
		assert.equal(executions, 1, "the failure this prevents crosses hosts: k resumers must not fire the effect k times");
		assert.equal(results.filter((r) => r.executed).length, 1);
	});

	it("does not re-dispatch a claimed-but-incomplete effect by default", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		await ledger.begin(rec); // simulates a previous attempt that is either in flight or died mid-effect
		let executions = 0;
		const result = await dispatchOnce(ledger, rec, async () => { executions += 1; return "x"; });
		assert.equal(result.executed, false, "the default must not duplicate: the ambiguity is unresolvable here");
		assert.equal(result.existing?.outcome, undefined, "the caller can see it is stuck rather than completed");
		assert.equal(executions, 0);
	});

	it("re-dispatches an incomplete effect only when the caller opts in, because the backend's key makes it safe", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		await ledger.begin(rec);
		let executions = 0;
		// The class is now the thing that makes the opt-in safe, so the test states which class it asserts.
		// Before M1 the opt-in alone was accepted, which meant the caller's belief stood in for the backend's
		// enforcement - the exact substitution this contract exists to prevent.
		const result = await dispatchOnce(ledger, rec, async () => { executions += 1; return "recovered"; }, { retryPriorAttempt: true, effectClass: "key-idempotent" });
		assert.equal(result.executed, true, "work is not lost when a process dies mid-effect");
		assert.equal(executions, 1);
	});

	it("does not retry a failed effect by default, because a failure may have landed after the effect", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		await assert.rejects(() => dispatchOnce(ledger, rec, async () => { throw new Error("transient"); }));
		assert.equal(ledger.records()[0]?.outcome, "failed");
		const retry = await dispatchOnce(ledger, rec, async () => "ok");
		assert.equal(retry.executed, false, "a timeout that failed after the effect landed is indistinguishable from one that did not");
		const optedIn = await dispatchOnce(ledger, rec, async () => "ok", { retryPriorAttempt: true, effectClass: "key-idempotent" });
		assert.equal(optedIn.executed, true, "the mode declares this effect key-idempotent, which is what makes the retry safe");
	});
});