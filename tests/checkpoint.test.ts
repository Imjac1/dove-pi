import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { captureCheckpoint, computeGraphSignature, createInMemoryCheckpointStore, restoreCheckpoint, type GraphShape } from "../src/core/checkpoint.ts";
import type { EffectRecord, ModeIdentity } from "../src/core/effect-ledger.ts";

const MODE: ModeIdentity = { id: "code-audit", version: "1.0.0", governanceVersion: "1" };
const SHAPE: GraphShape = { mode: MODE, toolNames: ["read", "write_report"], gateId: "conformance" };
const NOW = "2026-09-25T12:00:00.000Z";

function effect(key: string, outcome: EffectRecord["outcome"]): EffectRecord {
	return {
		effectKey: key,
		engagement: "eng-1",
		mode: MODE,
		tool: "write_report",
		decision: "allowed",
		startedAt: NOW,
		...(outcome === undefined ? {} : { outcome }),
	};
}

describe("action-boundary checkpoint", () => {
	it("records only effects that completed, since blocked and failed ones must not be treated as done", () => {
		const checkpoint = captureCheckpoint({
			mode: MODE,
			shape: SHAPE,
			effects: [effect("a", "completed"), effect("b", "failed"), { ...effect("c", "completed"), decision: "blocked" }, effect("d", undefined)],
			now: () => NOW,
		});
		assert.deepEqual(checkpoint.completedEffectKeys, ["a", "c"]);
		assert.equal(checkpoint.createdAt, NOW);
		assert.equal(checkpoint.sequence, 1);
	});

	it("chains lineage rather than relying on timestamps", () => {
		const first = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], now: () => NOW });
		const second = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed"), effect("b", "completed")], previous: first, now: () => NOW });
		assert.equal(second.previousCheckpointId, first.checkpointId);
		assert.equal(second.sequence, 2);
		assert.notEqual(second.checkpointId, first.checkpointId);
	});

	it("computes a graph signature that does not depend on tool registration order", () => {
		const a = computeGraphSignature({ mode: MODE, toolNames: ["read", "write_report"], gateId: "conformance" });
		const b = computeGraphSignature({ mode: MODE, toolNames: ["write_report", "read"], gateId: "conformance" });
		assert.equal(a, b);
		assert.notEqual(a, computeGraphSignature({ mode: MODE, toolNames: ["read"], gateId: "conformance" }));
		assert.notEqual(a, computeGraphSignature({ mode: MODE, toolNames: ["read", "write_report"], gateId: "limit" }));
	});

	it("restores when the shape matches", () => {
		const checkpoint = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], now: () => NOW });
		const result = restoreCheckpoint(checkpoint, SHAPE);
		assert.equal(result.ok, true);
		assert.deepEqual(result.ok === true ? result.completedEffectKeys : [], ["a"]);
	});

	it("refuses to resume under a different mode version, rather than continuing another mode's work", () => {
		const checkpoint = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], now: () => NOW });
		const result = restoreCheckpoint(checkpoint, { ...SHAPE, mode: { ...MODE, version: "1.0.1" } });
		assert.equal(result.ok, false);
		assert.match(result.ok === false ? result.reason : "", /was taken under mode code-audit@1.0.0/);
	});

	it("refuses to resume when the tool set or gate changed", () => {
		const checkpoint = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], now: () => NOW });
		const toolsChanged = restoreCheckpoint(checkpoint, { ...SHAPE, toolNames: ["read"] });
		const gateChanged = restoreCheckpoint(checkpoint, { ...SHAPE, gateId: "limit" });
		assert.equal(toolsChanged.ok, false);
		assert.match(toolsChanged.ok === false ? toolsChanged.reason : "", /different orchestration shape/);
		assert.equal(gateChanged.ok, false);
	});

	it("stores and returns the newest checkpoint", async () => {
		const store = createInMemoryCheckpointStore();
		const first = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], now: () => NOW });
		const second = captureCheckpoint({ mode: MODE, shape: SHAPE, effects: [effect("a", "completed")], previous: first, now: () => NOW });
		await store.save(first);
		await store.save(second);
		assert.equal((await store.latest())?.checkpointId, second.checkpointId);
		assert.equal((await store.load(first.checkpointId))?.sequence, 1);
	});
});
