import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FINGERPRINT_KEY, fingerprintOf, fingerprintsOf, toSarifLog, type Finding } from "../src/core/evidence-sarif.ts";

const finding = (overrides: Partial<Finding> = {}): Finding => ({
	path: "src/db/query.ts",
	category: "sql-injection",
	existingCode: 'db.query("SELECT * FROM users WHERE id = " + id)',
	message: "User input is concatenated into a SQL statement.",
	severity: "error",
	startLine: 42,
	...overrides,
});

describe("finding identity", () => {
	it("does not change when the model rewords the message", () => {
		const first = fingerprintOf(finding());
		const reworded = fingerprintOf(finding({ message: "This query is vulnerable to injection because it interpolates input." }));
		assert.equal(first, reworded, "a prose-derived identity would make every re-run a wall of spurious new findings");
	});

	it("changes when a stable component changes", () => {
		const base = fingerprintOf(finding());
		assert.notEqual(base, fingerprintOf(finding({ path: "src/other.ts" })));
		assert.notEqual(base, fingerprintOf(finding({ category: "xss" })));
		assert.notEqual(base, fingerprintOf(finding({ existingCode: "safe(id)" })));
	});

	it("is unaffected by severity and line numbers, which are presentation not identity", () => {
		const base = fingerprintOf(finding());
		assert.equal(base, fingerprintOf(finding({ severity: "note", startLine: 999 })));
	});
});

describe("SARIF log", () => {
	it("emits a 2.1.0 log with a versioned fingerprint key", () => {
		const log = toSarifLog([finding()], { toolVersion: "0.2.0" });
		assert.equal(log.version, "2.1.0");
		const run = log.runs[0] as { tool: { driver: { name: string } }; results: { partialFingerprints: Record<string, string> }[] };
		assert.equal(run.tool.driver.name, "dove-pi");
		assert.ok(run.results[0]?.partialFingerprints[FINGERPRINT_KEY], "the key must be versioned so a changed derivation cannot silently compare against an old baseline");
		assert.equal(FINGERPRINT_KEY, "doveFinding/v1");
	});

	it("collapses findings that share an identity into one result with an occurrence count", () => {
		const log = toSarifLog([finding(), finding(), finding({ startLine: 90 })], { toolVersion: "0.2.0" });
		const run = log.runs[0] as { results: { occurrenceCount: number }[] };
		assert.equal(run.results.length, 1, "the same logical finding in three places is one result");
		assert.equal(run.results[0]?.occurrenceCount, 3);
	});

	it("marks a finding present in the baseline as unchanged, and a new one as new", () => {
		const first = toSarifLog([finding()], { toolVersion: "0.2.0" });
		const baseline = fingerprintsOf(first);
		const second = toSarifLog([finding(), finding({ path: "src/new.ts" })], { toolVersion: "0.2.0", baseline });
		const run = second.runs[0] as { results: { baselineState: string; locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] };
		const byPath = new Map(run.results.map((r) => [r.locations[0]?.physicalLocation.artifactLocation.uri, r.baselineState]));
		assert.equal(byPath.get("src/db/query.ts"), "unchanged");
		assert.equal(byPath.get("src/new.ts"), "new");
	});

	it("marks every finding new when there is no baseline", () => {
		const log = toSarifLog([finding()], { toolVersion: "0.2.0" });
		assert.equal((log.runs[0] as { results: { baselineState: string }[] }).results[0]?.baselineState, "new");
	});

	it("derives rank from severity rather than leaving it unset", () => {
		// Distinct stable components, so these stay two results rather than collapsing into one.
		const log = toSarifLog([finding(), finding({ path: "src/other.ts", severity: "note" })], { toolVersion: "0.2.0" });
		const ranks = (log.runs[0] as { results: { rank: number }[] }).results.map((r) => r.rank).sort((a, b) => b - a);
		assert.deepEqual(ranks, [80, 20]);
	});

	it("round-trips fingerprints for use as the next baseline", () => {
		const log = toSarifLog([finding(), finding({ path: "src/b.ts" })], { toolVersion: "0.2.0" });
		assert.equal(fingerprintsOf(log).size, 2);
	});
});
