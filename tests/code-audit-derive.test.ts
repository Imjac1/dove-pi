import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveFindings, relativeToRoot } from "../src/code-audit/derive-findings.ts";
import type { SeedCandidate } from "../src/code-audit/seed-scanner.ts";

const seed = (overrides: Partial<SeedCandidate> = {}): SeedCandidate =>
	({
		candidateId: "SQL-1",
		category: "SQL_INJECTION",
		engine: "deterministic-catalog",
		sourceScope: "test",
		route: null,
		authState: "UNKNOWN",
		source: null,
		propagation: [],
		sink: { family: "raw_query", symbol: ".query(", location: "app/Dao.php:88" },
		sanitizers: [],
		evidence: [{ path: "app/Dao.php", line: 88, excerpt: "$rows = $db->query($sql);" }],
		coverage: { searched: ["app"], gaps: [] },
		status: "PENDING",
		...overrides,
	}) as SeedCandidate;

const claim = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	candidateId: "SQL-1",
	category: "SQL_INJECTION",
	severity: "HIGH",
	status: "CONFIRMED",
	title: "An identifier reaches a statement unbound",
	...overrides,
});

describe("finding derivation (the writer's own refusals, testable here)", () => {
	it("derives a finding from the seed, not from the claim", () => {
		const { findings } = deriveFindings([seed()], [claim({ title: "Prose the model wrote" })]);
		assert.equal(findings.length, 1);
		// Location and matched code are the seed's; only the prose and severity are the claim's.
		assert.equal(findings[0]?.path, "Dao.php");
		assert.equal(findings[0]?.existingCode, "$rows = $db->query($sql);");
		assert.equal(findings[0]?.startLine, 88);
		assert.equal(findings[0]?.message, "Prose the model wrote");
		assert.deepEqual(findings[0]?.properties, { "dove/severity": "HIGH", "dove/status": "CONFIRMED" });
	});

	it("counts every status, including the ones that produce no result", () => {
		const { findings, counts } = deriveFindings(
			[seed({ candidateId: "SQL-1" }), seed({ candidateId: "SQL-2" })],
			[claim({ candidateId: "SQL-1" }), claim({ candidateId: "SQL-2", status: "FILTERED" })],
		);
		assert.equal(findings.length, 1, "a filtered claim is an exclusion, not a result");
		assert.deepEqual(counts, { CONFIRMED: 1, FILTERED: 1 });
	});

	it("caps a hypothesis at warning, however high it is rated", () => {
		const { findings } = deriveFindings([seed()], [claim({ status: "HYPOTHESIS", severity: "CRITICAL" })]);
		assert.equal(findings[0]?.severity, "warning", "an unconfirmed finding must not be able to fail a build");
		assert.equal(findings[0]?.properties?.["dove/severity"], "CRITICAL", "and the claim's own value survives");
	});

	it("refuses a claim whose category is not its seed's", () => {
		// Without this the obligations of one defect class satisfy the gate for another, and the artifact
		// disagrees with the record silently.
		assert.throws(
			() => deriveFindings([seed()], [claim({ category: "COMMAND_EXEC" })]),
			/says COMMAND_EXEC but the seed it names is SQL_INJECTION/,
		);
	});

	it("refuses a claim that binds to no seed, and a seed with no evidence", () => {
		assert.throws(() => deriveFindings([seed()], [claim({ candidateId: "SQL-9" })]), /binds to no seed/);
		const noEvidence = seed({ evidence: [] });
		assert.throws(() => deriveFindings([noEvidence], [claim()]), /carries no evidence/);
	});

	it("refuses a path the recorded roots do not contain", () => {
		// Unreachable through the capability - the receipt checks refuse first - which is why it went
		// unasserted for three rewrites. Here it is the function's own contract.
		assert.throws(() => relativeToRoot("C:/Windows/notepad.exe", ["C:/repo"]), /no recorded scan root contains/);
		assert.equal(relativeToRoot("C:/repo/src/db/query.ts", ["C:/repo"]), "src/db/query.ts");
		assert.equal(relativeToRoot("C:/repo/src/db/query.ts".replace(/\//g, "\\"), ["C:/repo"]), "src/db/query.ts", "separators are normalized");
	});
});
