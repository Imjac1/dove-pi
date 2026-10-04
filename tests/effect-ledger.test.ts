import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createEffectLedger,
	createInMemoryEffectStore,
	deriveEffectKey,
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

describe("the claim, which is where exactly-once starts", () => {
	it("does not claim an effect that already completed, and reports the completion", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		const first = await ledger.begin(rec);
		assert.equal(first.claimed, true);
		await ledger.complete(rec.effectKey, { outcome: "completed" });
		const second = await ledger.begin(rec);
		assert.equal(second.claimed, false, "a completed effect must not be claimed again");
		assert.equal(second.existing?.outcome, "completed", "and the caller can see why it was refused");
	});

	it("claims exactly once when several resumers race for the same effect", async () => {
		// **The property the product depends on, asserted on the product's own path.** This was asserted through the deleted
		// `dispatchOnce` wrapper, whose only caller was this file: the atomicity lives in the store's `claim`, so the race is
		// driven through `begin` here. The failure it prevents crosses hosts - k resumers must not fire the effect k times.
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		const claims = await Promise.all(Array.from({ length: 8 }, () => ledger.begin(rec)));
		assert.equal(claims.filter((claim) => claim.claimed).length, 1);
		assert.equal(ledger.records().length, 1, "and only the winner is in the log");
	});

	it("does not claim a claimed-but-incomplete effect, and says it is stuck rather than done", async () => {
		// A claimed effect with no outcome is ambiguous: the previous attempt may be in flight right now, or it may have died
		// mid-effect, and the ledger cannot tell those apart (the late-commit problem). Whether that is retried is a policy
		// decision this module does not make - `effect-boundary.ts` makes it from the mode's effect class, and
		// `tests/effect-boundary.test.ts` asserts both directions.
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		await ledger.begin(rec);
		const again = await ledger.begin(rec);
		assert.equal(again.claimed, false);
		assert.equal(again.existing?.outcome, undefined, "the caller can see it is stuck rather than completed");
	});

	it("reports a failed attempt's outcome, so a caller is not left guessing what happened", async () => {
		const ledger = createEffectLedger({ engagement: "eng-1", store: createInMemoryEffectStore() });
		const rec = record();
		await ledger.begin(rec);
		await ledger.complete(rec.effectKey, { outcome: "failed" });
		const again = await ledger.begin(rec);
		assert.equal(again.claimed, false, "a failure may have landed after the effect, so it is not a permission to re-run");
		assert.equal(again.existing?.outcome, "failed");
	});
});