import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyTerminal, ISOLATION_CONTROLS, safetyAndStability, TERMINAL_CLASSES, UNCOMPUTABLE_AXES } from "../src/core/harness-axes.ts";
import type { ExecutionRecord } from "../src/core/contracts.ts";

/**
 * The axis module is pure, so every case here - including the ones about absences - is arithmetic rather than a
 * session. The absences are the point: "no data" and "no failures" must not be the same reading, and the axes this
 * harness cannot compute must be declared rather than omitted.
 */

const AT = "2026-09-27T00:00:00.000Z";

function terminal(reason: string): ExecutionRecord {
	return { taskId: "t", stepId: "request:r", kind: "request.terminal", timestamp: AT, mode: "standard", details: { reason } };
}

function refused(gate: string): ExecutionRecord {
	return { taskId: "t", stepId: "gate:c", kind: "gate.refused", timestamp: AT, mode: "standard", details: { gate } };
}

describe("the Safety and Stability axis", () => {
	it("classifies every terminal reason the type defines, so a new one cannot default", () => {
		// The list is written out here **on purpose**: derived from the module it would agree with the module, and the
		// point is to fail when the reason type grows without the classification growing with it.
		const REASONS = ["completed", "cancelled", "superseded", "startup-failed", "startup-conflict", "invalid-configuration", "authorization-denied", "recovered", "failed"] as const;
		assert.deepEqual(Object.keys(TERMINAL_CLASSES).sort(), [...REASONS].sort(), "every reason has a class");
		const classes = ["clean", "recovered", "interrupted", "failure"];
		for (const reason of REASONS) assert.ok(classes.includes(classifyTerminal(reason)), reason + " classifies into one of the four");
		assert.equal(classifyTerminal("completed"), "clean");
		assert.equal(classifyTerminal("cancelled"), "interrupted", "the operator ending a request is not the harness failing");
		assert.equal(classifyTerminal("superseded"), "interrupted");
		assert.equal(classifyTerminal("recovered"), "recovered", "a recovery is reported beside the ratio, not folded into it");
		assert.equal(classifyTerminal("authorization-denied"), "failure");
	});

	it("returns undefined rather than a perfect ratio when nothing has ended", () => {
		// A harness that reports a perfect crash-free ratio from no evidence is the defect this project keeps finding.
		const empty = safetyAndStability([]);
		assert.equal(empty.requests, 0);
		assert.equal(empty.crashFreeRatio, undefined);
		assert.equal(empty.recoveredRate, undefined);
		assert.equal(empty.isolationRefusalsPerRequest, undefined);
		assert.deepEqual(empty.terminals, { clean: 0, recovered: 0, interrupted: 0, failure: 0 });
	});

	it("counts clean, recovered, interrupted and failure separately, and ratios only over decided endings", () => {
		const reading = safetyAndStability([terminal("completed"), terminal("completed"), terminal("failed"), terminal("cancelled"), terminal("recovered")]);
		assert.equal(reading.axis, "SSM");
		assert.equal(reading.requests, 5);
		assert.deepEqual(reading.terminals, { clean: 2, recovered: 1, interrupted: 1, failure: 1 });
		assert.equal(reading.crashFreeRatio, 2 / 3, "the denominator is decided endings, so an interruption does not flatter the ratio");
		assert.equal(reading.recoveredRate, 1 / 5);
	});

	it("counts a terminal reason it does not know instead of classifying it as clean", () => {
		const reading = safetyAndStability([terminal("completed"), terminal("something-new")]);
		assert.equal(reading.requests, 2);
		assert.equal(reading.unclassifiedTerminals, 1);
		assert.deepEqual(reading.terminals, { clean: 1, recovered: 0, interrupted: 0, failure: 0 }, "the unknown one is in no class at all");
		assert.equal(reading.crashFreeRatio, 1, "and the ratio is over the endings it could classify");
	});

	it("groups refusals by control label, splitting a composite one into its atoms", () => {
		// The refusal path falls back to `gates.join("+")`, so an entry can read `deny+scope+registered+ask`. Without the
		// split every label it names would be invisible while the entry sat in the ledger.
		const reading = safetyAndStability([refused("fence"), refused("sandbox"), refused("deny+scope"), refused("technique")]);
		assert.deepEqual(reading.refusals.byLabel, { fence: 1, sandbox: 1, deny: 1, scope: 1, technique: 1 });
		assert.equal(reading.refusals.total, 5, "the atom count, not the entry count");
		assert.equal(reading.isolationRefusals, 2, "the two controls that make an isolation claim enforceable");
		assert.equal(reading.isolationRefusalsPerRequest, undefined, "and a rate needs a request");
	});

	it("derives the isolation refusal rate from the terminals, not from the entries", () => {
		const reading = safetyAndStability([terminal("completed"), terminal("completed"), refused("fence"), refused("deny")]);
		assert.equal(reading.isolationRefusals, 1);
		assert.equal(reading.isolationRefusalsPerRequest, 0.5);
	});

	it("ignores records of other kinds, and a refusal that names no control", () => {
		const noise: ExecutionRecord[] = [
			{ taskId: "t", stepId: "x", kind: "tool.observed", timestamp: AT, mode: "standard", details: {} },
			{ taskId: "t", stepId: "y", kind: "gate.refused", timestamp: AT, mode: "standard", details: {} },
		];
		const reading = safetyAndStability(noise);
		assert.equal(reading.requests, 0);
		assert.equal(reading.refusals.total, 0);
	});

	it("declares the axes it cannot read, with the evidence and what would change that", () => {
		const itq = UNCOMPUTABLE_AXES.find((entry) => entry.axis.includes("Improvement Trajectory"));
		assert.ok(itq, "the axis that cannot be measured is declared rather than omitted");
		assert.match(itq!.metric, /slope|stagnation/);
		assert.match(itq!.reason, /per-round score|round score/);
		assert.match(itq!.evidence, /acceptanceVector|appendTaskConvergenceDecision/, "and it cites where the absence is");
		assert.match(itq!.wouldNeed, /observation|recordRequestObservation/);
		const pareto = UNCOMPUTABLE_AXES.find((entry) => entry.metric.includes("Pareto"));
		assert.ok(pareto, "so is the metric of this axis nobody records a second objective for");
	});

	it("names the two controls whose refusal is an isolation violation", () => {
		assert.deepEqual([...ISOLATION_CONTROLS].sort(), ["fence", "sandbox"]);
	});
});
