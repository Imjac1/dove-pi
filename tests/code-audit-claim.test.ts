import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AUDIT_CATEGORIES, PROOF_FIELDS_BY_CATEGORY, RULE_CHECKS, findRepeatedExplanations, findUndispositionedSeeds, validateClaim, type FindingClaim } from "../src/code-audit/claim-schema.ts";

const SEEDS = new Set(["SQL-1", "SQL-2", "SSRF-1"]);

const checks = (): Record<string, string> => Object.fromEntries(RULE_CHECKS.map((check) => [check, "Examined the " + check + " and found a concrete reason."]));

const proofFor = (category: string): Record<string, string> =>
	Object.fromEntries(((PROOF_FIELDS_BY_CATEGORY as Record<string, readonly string[]>)[category] ?? []).map((field) => [field, "Established by reading the " + field + " path."]));

/** A claim that passes, so each test changes exactly one thing. */
const validClaim = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	candidateId: "SQL-1",
	category: "SQL_INJECTION",
	severity: "HIGH",
	status: "CONFIRMED",
	ruleChecks: checks(),
	runtimeStatus: "NOT_TESTED",
	categoryProof: proofFor("SQL_INJECTION"),
	title: "An identifier is concatenated into a statement",
	impact: "An attacker can read rows outside their own tenant.",
	callChain: [
		{ kind: "ROUTE", location: "src/db/query.ts:42", note: "The request reaches this handler." },
		{ kind: "SINK", location: "src/db/query.ts:45", note: "The statement is executed here." },
	],
	poc: { format: "curl", request: "curl -s localhost/api/users?id=1", successIndicator: "The response contains rows from another tenant." },
	remediation: "Use a parameterized statement.",
	...overrides,
});

describe("claim schema", () => {
	it("accepts a complete CONFIRMED claim", () => {
		assert.deepEqual(validateClaim(validClaim(), SEEDS), []);
	});

	it("rejects a claim about a candidate nobody produced", () => {
		const errors = validateClaim(validClaim({ candidateId: "SQL-999" }), SEEDS);
		assert.ok(errors.some((e) => e.includes("does not correspond to any seed")), "got: " + errors.join("; "));
	});

	it("requires every one of the nine checks, and no others", () => {
		const partial = checks();
		delete partial["data_flow"];
		partial["extra_check"] = "A check nobody defined.";
		const errors = validateClaim(validClaim({ ruleChecks: partial }), SEEDS);
		assert.ok(errors.some((e) => e.includes("missing: data_flow")), "got: " + errors.join("; "));
		assert.ok(errors.some((e) => e.includes("unknown checks: extra_check")), "got: " + errors.join("; "));
	});

	it("rejects a tick instead of an explanation", () => {
		// The checks ask what was examined and what was found. "done" answers neither.
		const ticked = checks();
		ticked["data_flow"] = "done";
		const errors = validateClaim(validClaim({ ruleChecks: ticked }), SEEDS);
		assert.ok(errors.some((e) => e.includes("placeholder")), "got: " + errors.join("; "));
	});

	it("rejects a CONFIRMED claim with no category proof at all", () => {
		const claim = validClaim();
		delete claim["categoryProof"];
		const errors = validateClaim(claim, SEEDS);
		assert.ok(errors.some((e) => e.includes("must carry a categoryProof")), "got: " + errors.join("; "));
	});

	it("rejects a CONFIRMED claim with a partial proof, naming the missing obligation", () => {
		const partial = proofFor("SQL_INJECTION");
		delete partial["parameterization_absent"];
		const errors = validateClaim(validClaim({ categoryProof: partial }), SEEDS);
		assert.ok(errors.some((e) => e.includes("parameterization_absent") && e.includes("missing")), "got: " + errors.join("; "));
	});

	it("holds every category to its own obligations, not to a shared checklist", () => {
		// FILE_UPLOAD has seven obligations and SQL_INJECTION four, so satisfying one category must not
		// accidentally satisfy another.
		assert.equal(PROOF_FIELDS_BY_CATEGORY.FILE_UPLOAD.length, 7);
		assert.equal(PROOF_FIELDS_BY_CATEGORY.SQL_INJECTION.length, 4);
		for (const category of AUDIT_CATEGORIES) {
			if (category === "SQL_INJECTION") continue;
			const errors = validateClaim(validClaim({ category, categoryProof: proofFor("SQL_INJECTION") }), SEEDS);
			assert.ok(errors.some((e) => e.includes("categoryProof")), category + " must reject another category proof");
		}
	});

	it("rejects a proof that asserts an obligation the category does not have", () => {
		const padded = { ...proofFor("SQL_INJECTION"), sandbox_absent: "Borrowed from TEMPLATE_INJECTION." };
		const errors = validateClaim(validClaim({ categoryProof: padded }), SEEDS);
		assert.ok(errors.some((e) => e.includes("not obligations for SQL_INJECTION")), "got: " + errors.join("; "));
	});

	it("requires the report fields a CONFIRMED claim is read for", () => {
		for (const field of ["title", "impact", "remediation"]) {
			const claim = validClaim();
			delete claim[field];
			assert.ok(validateClaim(claim, SEEDS).some((e) => e.includes("must carry") && e.includes(field)), field + " should be required");
		}
	});

	it("requires a call chain that runs from a route to a sink", () => {
		const noEntry = validClaim({ callChain: [{ kind: "SINK", location: "src/db/query.ts:45", note: "The statement is executed here." }] });
		assert.ok(validateClaim(noEntry, SEEDS).some((e) => e.includes("at least an entry and a sink")));

		const wrongEnds = validClaim({ callChain: [
			{ kind: "PROPAGATION", location: "src/db/query.ts:42", note: "A value is passed along the chain." },
			{ kind: "DEFENSE", location: "src/db/query.ts:44", note: "A check is applied before the call." },
		] });
		const errors = validateClaim(wrongEnds, SEEDS);
		assert.ok(errors.some((e) => e.includes("must start at a ROUTE")), "got: " + errors.join("; "));
		assert.ok(errors.some((e) => e.includes("must end at a SINK")), "got: " + errors.join("; "));
	});

	it("requires a proof of concept to say what success looks like", () => {
		const noIndicator = validClaim({ poc: { format: "curl", request: "curl -s localhost/api/users?id=1" } });
		assert.ok(validateClaim(noIndicator, SEEDS).some((e) => e.includes("successIndicator")));
		const badFormat = validClaim({ poc: { format: "sqlmap", request: "curl -s localhost", successIndicator: "Rows come back from another tenant." } });
		assert.ok(validateClaim(badFormat, SEEDS).some((e) => e.includes("poc.format")));
	});

	it("requires a HYPOTHESIS to name its missing evidence", () => {
		const bare = validClaim({ status: "HYPOTHESIS" });
		delete bare["categoryProof"];
		assert.ok(validateClaim(bare, SEEDS).some((e) => e.includes("must name the missing evidence")));

		const named = { ...bare, missingEvidence: ["Whether the query builder escapes the identifier."] };
		assert.deepEqual(validateClaim(named, SEEDS), []);
	});

	it("requires FILTERED and NOT_REACHABLE to explain why", () => {
		for (const status of ["FILTERED", "NOT_REACHABLE"]) {
			const claim = validClaim({ status });
			delete claim["categoryProof"];
			assert.ok(validateClaim(claim, SEEDS).some((e) => e.includes("must explain why")), status + " should require a reason");
			assert.deepEqual(validateClaim({ ...claim, rejectionReason: "Parameterization is applied before the call." }, SEEDS), [], status + " should accept a reason");
		}
	});

	it("rejects a static claim that carries a runtime status", () => {
		// A static record must not claim a runtime result it did not get, and a runtime failure must not
		// be able to downgrade a statically well-evidenced conclusion.
		const errors = validateClaim(validClaim({ runtimeStatus: "VALIDATED" }), SEEDS);
		assert.ok(errors.some((e) => e.includes("NOT_TESTED")), "got: " + errors.join("; "));
	});

	it("rejects an unknown field by name, so nothing is silently ignored", () => {
		const errors = validateClaim(validClaim({ confidence: 0.95 }), SEEDS);
		assert.ok(errors.some((e) => e.includes("confidence") && e.includes("unknown field")), "got: " + errors.join("; "));
	});

	it("reports one explanation reused across candidates", () => {
		// Only data_flow is shared; every other check is answered separately for each candidate, which is
		// what makes the check meaningful. One explanation cannot be true of two different sinks.
		const shared = "Examined the data_flow and found a concrete reason.";
		const claimFor = (id: string): FindingClaim =>
			({
				...(validClaim() as unknown as FindingClaim),
				candidateId: id,
				ruleChecks: Object.fromEntries(
					RULE_CHECKS.map((check) => [check, check === "data_flow" ? shared : "For " + id + ", examined the " + check + " and found a concrete reason."]),
				) as unknown as FindingClaim["ruleChecks"],
			}) as FindingClaim;
		const repeated = findRepeatedExplanations([claimFor("SQL-1"), claimFor("SQL-2")]);
		assert.equal(repeated.length, 1);
		assert.ok(repeated[0]!.includes("data_flow"));
		assert.equal(findRepeatedExplanations([claimFor("SQL-1")]).length, 0, "a claim cannot repeat itself");
	});

	it("reports every seed that no claim mentions", () => {
		// Non-deletability is only real if something checks it. A seed nobody mentions is a candidate
		// that vanished, and losing a candidate is the failure this arrangement exists to prevent.
		assert.deepEqual(findUndispositionedSeeds(["SQL-1", "SQL-2"], ["SQL-1", "SQL-2"]), []);
		assert.deepEqual(findUndispositionedSeeds(["SQL-1", "SQL-2", "SQL-3"], ["SQL-1", "SQL-2"]), ["SQL-3"]);
		// The reason for the omission does not matter: a disposition is what matters, and it may be any
		// of the four statuses.
		assert.deepEqual(findUndispositionedSeeds(["SQL-1", "SQL-2", "SQL-3"], ["SQL-1", "SQL-2", "SQL-3"]), []);
		assert.deepEqual(findUndispositionedSeeds([], []), []);
	});
});
