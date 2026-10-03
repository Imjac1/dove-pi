import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptanceIdsMentioned, findUnsupportedCriteria, parseAcceptanceCriteria } from "../src/project-provider/record-freshness.ts";

/**
 * The shapes here are copied from a real task in a real session, not invented: `acceptance.md` writes
 * `- [x] **AC-001** — …` under `## Criteria`, and `evidence.jsonl` writes records carrying
 * `"kind":"convergence.decision"` and, for the acceptance events, `"acceptanceId":"AC-001"`.
 *
 * The case that matters is the measured one: five criteria ticked, and an evidence file mentioning only the
 * first. Four criteria claimed work the ledger does not support, and nothing in the product noticed.
 */
const REAL_LOOKING_ACCEPTANCE = [
	"# Acceptance: Decide Node engine floor for the `peek()` optional-chaining simplification",
	"",
	"## Decision",
	"",
	"Keep the floor.",
	"",
	"## Criteria",
	"",
	"- [x] **AC-001** — the implementation and `engines.node` agree",
	"- [x] **AC-002** — the TODO note stays verbatim",
	"- [x] **AC-003** — no optional chaining in the file",
	"- [x] **AC-004** — `npm test` passes",
	"- [x] **AC-005** — the rationale is recorded",
	"",
	"## Evidence",
	"",
	"- `npm test` on the day.",
	"",
].join("\n");

const REAL_LOOKING_EVIDENCE = [
	'{"schemaVersion":1,"timestamp":"2026-10-03T11:49:36.641Z","kind":"convergence.decision","eventKind":"acceptance.frozen","acceptanceId":"AC-ENGINE-FLOOR"}',
	'{"schemaVersion":1,"timestamp":"2026-10-03T16:25:00.861Z","kind":"convergence.decision","eventKind":"acceptance.started","acceptanceId":"AC-001"}',
].join("\n");

test("a criterion is read only from its own syntax, and its tick is read with it", () => {
	const criteria = parseAcceptanceCriteria(REAL_LOOKING_ACCEPTANCE);
	assert.deepEqual(
		criteria.map((c) => c.id),
		["AC-001", "AC-002", "AC-003", "AC-004", "AC-005"],
		"the five criteria the file lists, in order",
	);
	assert.equal(criteria.every((c) => c.ticked), true, "all five are ticked");
	assert.deepEqual(parseAcceptanceCriteria("- [ ] **AC-009** — not done").map((c) => c.ticked), [false], "an unticked criterion is unticked");
	assert.deepEqual(parseAcceptanceCriteria("prose mentioning AC-999 in passing").length, 0, "prose is not a criterion");
});

test("the ids an evidence file mentions are the ids it actually names", () => {
	const ids = acceptanceIdsMentioned(REAL_LOOKING_EVIDENCE);
	assert.equal(ids.has("AC-001"), true, "the second record names AC-001");
	assert.equal(ids.has("AC-ENGINE-FLOOR"), true, "the first names the frozen acceptance");
	assert.equal(ids.has("AC-002"), false, "and nothing names AC-002");
});

test("a ticked criterion the ledger never mentions is reported, because the record would be claiming work it cannot back", () => {
	const unsupported = findUnsupportedCriteria(REAL_LOOKING_ACCEPTANCE, REAL_LOOKING_EVIDENCE);
	assert.deepEqual(
		unsupported.map((u) => u.id),
		["AC-002", "AC-003", "AC-004", "AC-005"],
		"four ticked criteria are named nowhere in the evidence, which is what the real task's record does",
	);
});

test("a record whose ticks are all backed reports nothing, so the check is not vacuous", () => {
	const backed = ['{"kind":"convergence.decision","acceptanceId":"AC-001"}', '{"kind":"convergence.decision","acceptanceId":"AC-002"}'].join("\n");
	const unsupported = findUnsupportedCriteria("- [x] **AC-001** — a\n- [x] **AC-002** — b\n", backed);
	assert.deepEqual(unsupported, [], "every tick has an event, so there is nothing to report");
});
