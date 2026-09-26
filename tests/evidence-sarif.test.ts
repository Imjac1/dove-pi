import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_HASH_KEY, FINGERPRINT_KEY, baselineOf, contentHashOf, fingerprintOf, fingerprintsOf, toSarifLog, type Finding } from "../src/core/evidence-sarif.ts";

const finding = (overrides: Partial<Finding> = {}): Finding => ({
	path: "src/db/query.ts",
	category: "sql-injection",
	existingCode: 'db.query("SELECT * FROM users WHERE id = " + id)',
	message: "User input is concatenated into a SQL statement.",
	severity: "error",
	startLine: 42,
	...overrides,
});

interface Result {
	readonly baselineState: string;
	readonly occurrenceCount: number;
	readonly rank: number;
	readonly partialFingerprints: Record<string, string>;
	readonly properties?: Record<string, unknown>;
	readonly locations: { physicalLocation: { artifactLocation: { uri: string } } }[];
}
const results = (log: unknown): Result[] => ((log as { runs: { results: Result[] }[] }).runs[0]?.results ?? []);
const stateAt = (log: unknown, uri: string): string | undefined => results(log).find((r) => r.locations[0]?.physicalLocation.artifactLocation.uri === uri)?.baselineState;

describe("finding identity", () => {
	it("does not change when the model rewords the message", () => {
		const first = fingerprintOf(finding());
		const reworded = fingerprintOf(finding({ message: "This query is vulnerable to injection because it interpolates input." }));
		assert.equal(first, reworded, "a prose-derived identity would make every re-run a wall of spurious new findings");
	});

	it("does not change when the finding moves to another path", () => {
		// This assertion is the inverse of the v1 contract, and the inversion is the fix. v1 hashed
		// path | category | code, so a moved finding looked like a different finding and a re-run read as
		// one new finding plus one silent disappearance. Semgrep keeps a content-only hash for exactly
		// this reason: hashing ONLY the code contents is what lets it tell a move from an edit. A move is
		// recovered by the baseline match and reported as a move (see the SARIF log cases below).
		assert.equal(fingerprintOf(finding()), fingerprintOf(finding({ path: "src/other.ts" })), "a move is not an edit");
		assert.equal(contentHashOf(finding()), contentHashOf(finding({ path: "src/other.ts" })));
	});

	it("still changes when the category or the matched code changes", () => {
		const base = fingerprintOf(finding());
		assert.notEqual(base, fingerprintOf(finding({ category: "xss" })));
		assert.notEqual(base, fingerprintOf(finding({ existingCode: "safe(id)" })));
	});

	it("separates two identical matches by occurrence index, so neither is lost", () => {
		// Without the index, two findings of one category on identical matched code in one file collapse
		// into one result and a real defect disappears. GitHub emits hash:occurrenceIndex; Semgrep puts
		// index inside syntactic_id; SARIF itself defines occurrenceCount.
		assert.notEqual(fingerprintOf(finding(), 0), fingerprintOf(finding(), 1));
	});

	it("is unaffected by severity, line numbers, and reindentation", () => {
		const base = fingerprintOf(finding());
		assert.equal(base, fingerprintOf(finding({ severity: "note", startLine: 999 })));
		assert.equal(base, fingerprintOf(finding({ existingCode: '  db.query("SELECT * FROM users WHERE id = " + id)   ' })), "reindentation is not an edit");
	});
});

describe("SARIF log", () => {
	it("emits a 2.1.0 log with versioned fingerprint keys", () => {
		const log = toSarifLog([finding()], { toolVersion: "0.2.0" });
		assert.equal(log.version, "2.1.0");
		const run = log.runs[0] as { tool: { driver: { name: string } } };
		assert.equal(run.tool.driver.name, "dove-pi");
		const first = results(log)[0];
		assert.ok(first?.partialFingerprints[FINGERPRINT_KEY], "the key must be versioned so a changed derivation cannot silently compare against an old baseline");
		assert.ok(first?.partialFingerprints[CONTENT_HASH_KEY], "the path-free hash is what makes a move recoverable");
		assert.equal(FINGERPRINT_KEY, "doveFinding/v2");
	});

	it("keeps two findings on identical matched code distinct within one file", () => {
		const log = toSarifLog([finding(), finding(), finding({ startLine: 90 })], { toolVersion: "0.2.0" });
		assert.equal(results(log).length, 3, "three matches are three findings, not one collapsed result");
		assert.deepEqual([...fingerprintsOf(log)].length, 3);
		assert.deepEqual(results(log).map((r) => r.occurrenceCount), [1, 1, 1], "each identity is observed once");
	});

	it("marks every finding new when there is no baseline", () => {
		assert.equal(stateAt(toSarifLog([finding()], { toolVersion: "0.2.0" }), "src/db/query.ts"), "new");
	});

	it("reports an unchanged finding as unchanged", () => {
		const baseline = baselineOf(toSarifLog([finding()], { toolVersion: "0.2.0" }));
		const second = toSarifLog([finding()], { toolVersion: "0.2.0", baseline });
		assert.equal(stateAt(second, "src/db/query.ts"), "unchanged");
	});

	it("recovers a moved finding through the content hash and records the move", () => {
		const baseline = baselineOf(toSarifLog([finding()], { toolVersion: "0.2.0" }));
		const moved = toSarifLog([finding({ path: "src/db/renamed.ts" })], { toolVersion: "0.2.0", baseline });
		assert.equal(stateAt(moved, "src/db/renamed.ts"), "unchanged", "a move is the same finding in a new place");
		assert.equal(results(moved).length, 1, "and it is not also reported as an absent one");
		assert.equal(results(moved)[0]?.properties?.["dove/movedFrom"], "src/db/query.ts", "the move is recorded rather than left to be inferred");
	});

	it("reports an edited finding as updated, not as new", () => {
		const baseline = baselineOf(toSarifLog([finding()], { toolVersion: "0.2.0" }));
		const edited = toSarifLog([finding({ existingCode: 'db.query(safeSql, [id])' })], { toolVersion: "0.2.0", baseline });
		assert.equal(stateAt(edited, "src/db/query.ts"), "updated", "the code changed where the finding was; that is an update, not a new defect");
	});

	it("handles several findings in one file without inventing new ones", () => {
		// A regression test for a defect this milestone found: the same-place tier kept only the first
		// baseline index per (category, path), so with several findings in one file only one could match
		// it. The rest fell through to absent while their current counterparts were reported new - the
		// spurious churn the identity contract exists to prevent.
		const at = (path: string, code: string, line: number): Finding => finding({ path, existingCode: code, startLine: line });
		const before = [at("src/db/query.ts", "db.query(sqlA)", 10), at("src/db/query.ts", "db.query(sqlB)", 20), at("src/db/query.ts", "db.query(sqlC)", 30)];
		const baseline = baselineOf(toSarifLog(before, { toolVersion: "0.2.0" }));
		// Two of the three are edited in place; the third is untouched.
		const after = [at("src/db/query.ts", "db.query(sqlA2)", 10), at("src/db/query.ts", "db.query(sqlB2)", 20), at("src/db/query.ts", "db.query(sqlC)", 30)];
		const states = results(toSarifLog(after, { toolVersion: "0.2.0", baseline })).map((r) => r.baselineState).sort();
		assert.deepEqual(states, ["unchanged", "updated", "updated"], "two edits and one untouched finding, and nothing new or absent");
	});


	it("does not let a newly added copy of identical code claim an existing finding", () => {
		// A content-derived identity cannot tell two identical matches apart, so matching runs in two
		// passes with every same-path match decided first. Without that, a new finding whose code is
		// identical to an existing one takes over the existing finding baseline entry: the pre-existing
		// finding is reported as new and the new one is reported as a move. The counts are right and the
		// narrative is wrong, which is worse than useless in a change report. Identical code at a
		// different path is genuinely ambiguous, so the tie goes to the location that already existed.
		const same = (path: string): Finding => finding({ path, existingCode: "db.query(sql)", startLine: 10 });
		const base = baselineOf(toSarifLog([same("src/b.ts")], { toolVersion: "0.2.0" }));
		const now = [same("src/a.ts"), same("src/b.ts")];
		const log = toSarifLog(now, { toolVersion: "0.2.0", baseline: base });
		assert.equal(stateAt(log, "src/b.ts"), "unchanged", "the finding that was already there is unchanged");
		assert.equal(stateAt(log, "src/a.ts"), "new", "and the added copy is new, not a move of it");
		assert.ok(!results(log).some((r) => r.properties?.["dove/movedFrom"] !== undefined), "nothing moved, so nothing is recorded as moved");
	});

	it("decides every same-path case before any cross-path case", () => {
		// A merge of two fixes to this function lost the same-path edit tier out of the first pass, which
		// put it after the cross-path content tier. The consequence was not a mislabel but a hole: an edit
		// in place to code that another file used was narrated as a move from that file, and the file that
		// was actually deleted produced no result of its own. Two results pointed at one path, and the real
		// deletion was never reported.
		const base = baselineOf(
			toSarifLog([finding({ path: "src/a.ts", existingCode: "db.query(X)", startLine: 10 }), finding({ path: "src/b.ts", existingCode: "db.query(Y)", startLine: 10 })], { toolVersion: "0.2.0" }),
		);
		const log = toSarifLog([finding({ path: "src/a.ts", existingCode: "db.query(Y)", startLine: 10 })], { toolVersion: "0.2.0", baseline: base });
		assert.equal(stateAt(log, "src/a.ts"), "updated", "the code changed where the finding already was");
		// An absent result is emitted from identity alone, so it carries no location - no location in the log
		// comes from anywhere but the scan, and the deletion is still reported.
		const absent = results(log).filter((r) => r.baselineState === "absent");
		assert.equal(absent.length, 1, "the deleted file is reported");
		assert.equal(absent[0]?.locations, undefined, "and it carries no location to attribute");
		assert.ok(!results(log).some((r) => r.properties?.["dove/movedFrom"] !== undefined), "nothing moved, so nothing is recorded as moved");
	});

	it("reads a move that is also an edit as new plus absent, and that is deliberate", () => {
		// A limit, pinned so it is not rediscovered as a defect. A content-only identity cannot tell
		// "changed and went elsewhere" from "deleted, and something else appeared"; from two runs alone
		// those are the same observation. Resolving it needs a similarity match, which trades a false new
		// for a false match - and a false match can suppress a real finding, the worse error in an audit.
		const base = baselineOf(toSarifLog([finding({ path: "src/a.ts", existingCode: "db.query(X)" })], { toolVersion: "0.2.0" }));
		const log = toSarifLog([finding({ path: "src/b.ts", existingCode: "db.query(Y)" })], { toolVersion: "0.2.0", baseline: base });
		assert.equal(stateAt(log, "src/b.ts"), "new");
		assert.equal(results(log).filter((r) => r.baselineState === "absent").length, 1, "and the old identity is gone");
	});
	it("reports a deleted finding as absent, not as silence", () => {
		const baseline = baselineOf(toSarifLog([finding()], { toolVersion: "0.2.0" }));
		const gone = toSarifLog([finding({ path: "src/elsewhere.ts", existingCode: "other()", category: "other" })], { toolVersion: "0.2.0", baseline });
		assert.equal(results(gone).filter((r) => r.baselineState === "absent").length, 1, "a deletion must be visible, and absent is one of the four values the schema defines");
		// And an absent result is not carried into the next baseline, or it would be re-reported forever.
		assert.equal(baselineOf(gone).entries.some((e) => e.path === "src/db/query.ts"), false);
	});


	it("carries run-level properties into the artifact", () => {
		// The closure claim - no seed disappeared - has to be checkable by whoever reads the report, not
		// only true of the process that produced it. On a first run there is no baseline, so absent-state
		// results cannot carry it; run properties can.
		const log = toSarifLog([finding()], { toolVersion: "0.2.0", runProperties: { "dove/seedCount": 7, "dove/seedSha256": "abc" } });
		const run = (log.runs[0] as { properties?: Record<string, unknown> });
		assert.equal(run.properties?.["dove/seedCount"], 7);
		assert.equal(run.properties?.["dove/seedSha256"], "abc");
		// And nothing is invented when none are supplied.
		const bare = toSarifLog([finding()], { toolVersion: "0.2.0" });
		assert.equal((bare.runs[0] as { properties?: unknown }).properties, undefined);
	});
	it("derives rank from severity rather than leaving it unset", () => {
		const log = toSarifLog([finding(), finding({ path: "src/other.ts", severity: "note" })], { toolVersion: "0.2.0" });
		const ranks = results(log).map((r) => r.rank).sort((a, b) => b - a);
		assert.deepEqual(ranks, [80, 20]);
	});

	it("round-trips a baseline from one log into the next", () => {
		const log = toSarifLog([finding(), finding({ path: "src/b.ts" })], { toolVersion: "0.2.0" });
		const baseline = baselineOf(log);
		assert.equal(baseline.entries.length, 2, "two matches at two paths are two entries");
		const again = toSarifLog([finding(), finding({ path: "src/b.ts" })], { toolVersion: "0.2.0", baseline });
		assert.deepEqual(results(again).map((r) => r.baselineState), ["unchanged", "unchanged"]);
	});

	it("is byte-stable across two runs over the same tree", () => {
		const first = toSarifLog([finding(), finding({ path: "src/b.ts" })], { toolVersion: "0.2.0" });
		const second = toSarifLog([finding(), finding({ path: "src/b.ts" })], { toolVersion: "0.2.0" });
		assert.deepEqual([...fingerprintsOf(second)].sort(), [...fingerprintsOf(first)].sort());
	});
});
