import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { createDoveRuntime } from "../src/runtime.ts";
import { parseCatalog } from "../src/code-audit/catalog.ts";
import { scanCategory, type SeedCandidate } from "../src/code-audit/seed-scanner.ts";
import { baselineOf, toSarifLog, type Finding } from "../src/core/evidence-sarif.ts";

const CATALOG_PATH = join(process.cwd(), "modes", "code-audit", "catalog", "typescript.json");
const FIXTURE = join(process.cwd(), "tests", "fixtures", "code-audit", "vulnerable");
const catalog = parseCatalog(readFileSync(CATALOG_PATH, "utf8"));

interface Result {
	readonly baselineState: string;
	readonly properties?: Record<string, unknown>;
	readonly locations: { physicalLocation: { artifactLocation: { uri: string } } }[];
}
const resultsOf = (log: unknown): Result[] => (log as { runs: { results: Result[] }[] }).runs[0]?.results ?? [];
const statesOf = (log: unknown): string[] => resultsOf(log).map((r) => r.baselineState).sort();

/** A fresh copy of the fixture, so a test that mutates files cannot affect another. */
function workspace(): string {
	const dir = mkdtempSync(join(tmpdir(), "dove-audit-"));
	cpSync(FIXTURE, dir, { recursive: true });
	return dir;
}

const scan = (root: string) => scanCategory({ catalog, category: "SQL_INJECTION", roots: [root], scope: "fixture" });

/** The verification stage stand-in: a seed becomes a finding carrying its matched text. */
const findingsFrom = (seeds: readonly SeedCandidate[]): Finding[] =>
	seeds.map((seed) => ({
		path: seed.evidence[0]!.path,
		category: seed.category,
		existingCode: seed.evidence[0]!.excerpt,
		message: "Candidate " + seed.candidateId + " in family " + seed.sink.family,
		severity: "warning",
		startLine: seed.evidence[0]!.line,
	}));

const runOnce = (root: string) => findingsFrom(scan(root).seeds);

/** A claim that passes the schema, for a seed of the SQL category the fixture exercises. */
const claimFor = (seed: { candidateId: string }): Record<string, unknown> => ({
	candidateId: seed.candidateId,
	category: "SQL_INJECTION",
	severity: "MEDIUM",
	status: "HYPOTHESIS",
	runtimeStatus: "NOT_TESTED",
	ruleChecks: Object.fromEntries(
		["sink_semantics", "entry_reachability", "source_controllability", "data_flow", "parameter_usage", "defense_effectiveness", "auth_boundary", "combination_chains", "category_requirements"].map((check) => [check, "For " + seed.candidateId + " the " + check + " was examined and a reason recorded."]),
	),
	missingEvidence: ["Whether the builder escapes the identifier before it reaches the driver."],
});

describe("code-audit vertical end to end", () => {
	it("runs the whole spine: seeds, receipt, findings, and a SARIF log", () => {
		const root = workspace();
		try {
			const { seeds, receipt } = scan(root);
			assert.ok(seeds.length > 0, "the fixture has concatenated statements to find");
			for (const seed of seeds) assert.equal(seed.status, "PENDING", "the scanner does not conclude anything");
			assert.ok(receipt.mandatoryFamilies.length > 0);
			assert.equal(receipt.seedSha256.length, 64);

			const log = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			assert.equal(log.version, "2.1.0");
			assert.deepEqual(statesOf(log), resultsOf(log).map(() => "new").sort(), "with no baseline everything is new");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("reports nothing at all when the same tree is scanned twice", () => {
		const root = workspace();
		try {
			const first = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			const secondScan = scan(root);
			const second = toSarifLog(findingsFrom(secondScan.seeds), { baseline: baselineOf(first), toolVersion: "0.3.0" });
			assert.deepEqual(statesOf(second), resultsOf(second).map(() => "unchanged").sort(), "a re-run must be silent, not a wall of new findings");
			assert.equal(scan(root).receipt.seedSha256, secondScan.receipt.seedSha256);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("reads a moved file as the same finding in a new place, not as a new finding", () => {
		const root = workspace();
		try {
			const first = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			renameSync(join(root, "src", "db", "query.ts"), join(root, "src", "db", "renamed.ts"));
			const second = toSarifLog(runOnce(root), { baseline: baselineOf(first), toolVersion: "0.3.0" });
			assert.equal(statesOf(second).includes("new"), false, "a move must not read as a new finding");
			assert.equal(statesOf(second).includes("absent"), false, "nor as a disappearance");
			assert.deepEqual([...new Set(statesOf(second))], ["unchanged"]);
			const moved = resultsOf(second).filter((r) => r.properties?.["dove/movedFrom"] !== undefined);
			assert.ok(moved.length > 0, "the move is recorded rather than left to be inferred");
			assert.ok(moved.some((r) => String(r.properties?.["dove/movedFrom"]).endsWith("query.ts")));
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("reads an edit in place as an update, and leaves the rest alone", () => {
		const root = workspace();
		try {
			const first = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			const target = join(root, "src", "db", "query.ts");
			// Parameterise the first statement. Its matched text changes, so its identity changes, while the
			// file, the category and the second statement are all untouched.
			writeFileSync(
				target,
				readFileSync(target, "utf8").replace(
					'return db.query("SELECT * FROM users WHERE id = " + id);',
					'return db.query("SELECT * FROM users WHERE id = ?", [id]);',
				),
				"utf8",
			);
			const second = toSarifLog(runOnce(root), { baseline: baselineOf(first), toolVersion: "0.3.0" });
			const states = statesOf(second);
			assert.ok(states.includes("updated"), "the edited statement must read as updated, not as new");
			assert.equal(states.includes("new"), false, "nothing else changed, so nothing is new");
			// Parameterising also removes the string-composition candidate on that line, because there is no
			// longer a concatenation to find. That candidate is genuinely gone and must be reported as gone.
			assert.ok(states.includes("absent"), "a candidate whose reason disappeared must be reported as absent");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("reads a deleted file as absent, so the removal is visible", () => {
		const root = workspace();
		try {
			const first = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			rmSync(join(root, "src", "db", "query.ts"));
			const second = toSarifLog(runOnce(root), { baseline: baselineOf(first), toolVersion: "0.3.0" });
			const absent = resultsOf(second).filter((r) => r.baselineState === "absent");
			assert.ok(absent.length > 0, "a deletion must be reported, not silently dropped");
			// Emitted from identity alone: an absent row is a statement about the baseline, so it repeats the
			// baseline's identity and carries no location. That is what keeps every location in the artifact
			// coming from the scan rather than from a file the caller supplied.
			assert.ok(absent.every((r) => r.locations === undefined), "an absent result carries no location");
			assert.equal(statesOf(second).includes("new"), false);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("reports exactly the newly introduced sink as new", () => {
		const root = workspace();
		try {
			const first = toSarifLog(runOnce(root), { toolVersion: "0.3.0" });
			writeFileSync(join(root, "src", "db", "added.ts"), "export function added(id: string) {\n\treturn db.query(\"SELECT * FROM invoices WHERE id = \" + id);\n}\n", "utf8");
			const second = toSarifLog(runOnce(root), { baseline: baselineOf(first), toolVersion: "0.3.0" });
			const fresh = resultsOf(second).filter((r) => r.baselineState === "new");
			// One added line can yield more than one candidate, because a line may match several families -
			// that is the design, not a duplicate: each family is a different way of reaching a sink. What
			// matters is that every new result comes from the added file and nothing else moved.
			assert.ok(fresh.length > 0, "the added sink must be found");
			assert.ok(fresh.every((r) => r.locations[0]!.physicalLocation.artifactLocation.uri.endsWith("added.ts")), "only the added file is new");
			assert.equal(statesOf(second).includes("absent"), false, "nothing went missing");
			assert.equal(statesOf(second).includes("updated"), false, "nothing was edited");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});


	it("produces the report through the writer, so the run properties and the write path are covered", async () => {
		// The spine test above drives toSarifLog directly, which leaves the vertical's only write path and
		// its closure claim untested. This goes through the capability: it re-derives the scan from the
		// receipt, refuses a receipt that does not describe the tree, and stamps the seed universe onto the
		// artifact so a reader can check the claim rather than take it.
		const root = workspace();
		try {
			const { seeds, receipt } = scan(root);
			const claims = seeds.map((seed) => ({
				candidateId: seed.candidateId,
				category: "SQL_INJECTION",
				severity: "MEDIUM",
				// A hypothesis is a legitimate result: the finding is derived from the seed the claim names, and
				// the hypothesis names what it could not establish.
				status: "HYPOTHESIS",
				runtimeStatus: "NOT_TESTED",
				ruleChecks: Object.fromEntries(
					["sink_semantics", "entry_reachability", "source_controllability", "data_flow", "parameter_usage", "defense_effectiveness", "auth_boundary", "combination_chains", "category_requirements"].map((check) => [
						check,
						"For " + seed.candidateId + " the " + check + " was examined and a reason recorded.",
					]),
				),
				missingEvidence: ["Whether the builder escapes the identifier before it reaches the driver."],
			}));
			// A baseline from an empty tree, so every finding is new and the result is reproducible.
			const baselinePath = join(root, "baseline.sarif");
			writeFileSync(baselinePath, JSON.stringify(toSarifLog([], { toolVersion: "0.3.0" }), null, 2), "utf8");
			// No findings file: the capability derives them from the seeds and the claims, so there is nothing
			// to hand in and nothing to forge.
			const outputPath = join(root, "report.sarif");

			const diff = createDoveRuntime().capabilities.require("code-audit.diff");
			const summary = (await diff.execute(
				{ baselinePath, outputPath, seeds, receipt, claims },
				{ cwd: process.cwd(), mode: "default" } as never,
			)) as { new: readonly string[] };
			assert.equal(summary.new.length, seeds.length, "against an empty baseline every finding is new");

			// The artifact exists and carries the seed universe, so the closure claim is auditable from it.
			const written = JSON.parse(readFileSync(outputPath, "utf8")) as { runs: { properties?: Record<string, unknown> }[] };
			assert.equal(written.runs[0]?.properties?.["dove/seedCount"], seeds.length);
			assert.equal(written.runs[0]?.properties?.["dove/seedSha256"], receipt.seedSha256);
			assert.equal(written.runs[0]?.properties?.["dove/seedDigestVerified"], true);
			assert.equal(existsSync(outputPath + ".partial"), false, "the temporary file is renamed, not left behind");

			const report = JSON.parse(readFileSync(outputPath, "utf8")) as {
				runs: { results: { level?: string; baselineState?: string; properties?: Record<string, unknown>; locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] }[];
			};
			const results = report.runs[0]!.results;

			// Every result names a file the scan actually read. That is the binding: a finding cannot be
			// invented for a path the seeds do not cover, because the location comes from the seed itself.
			// Scoped to this run's results. An `absent` result describes what the **baseline** had and this run did
			// not - a deletion has to be reportable, so its location legitimately comes from the baseline rather
			// than from a seed. Asserting over every result passed only because this test uses an empty
			// baseline, and it would have failed the first time a real one was used.
			// The scan ran over the temporary copy, so the root to relativize against is the one the receipt
			// recorded rather than the fixture it was copied from.
			const scanRoot = receipt.sourceRoots[0]!;
			const seeded = new Set(seeds.map((seed) => relative(scanRoot, seed.evidence[0]!.path).split(sep).join("/")));
			for (const result of results) {
				if (result.baselineState === "absent") continue;
				const uri = result.locations[0]!.physicalLocation.artifactLocation.uri;
				assert.ok(seeded.has(uri), "a result from this run must name a seeded path, not " + uri);
				assert.equal(isAbsolute(uri), false, "SARIF artifactLocation.uri must not be an absolute local path");
				assert.equal(uri.includes("\\"), false, "and must not carry Windows separators");
			}

			// The claim's category is tied to the seed's. Without that, one defect class's proof obligations
			// satisfy the gate for another and the artifact disagrees with the record.
			const wrongCategory = claims.map((claim, index) => (index === 0 ? { ...claim, category: "COMMAND_EXEC" } : claim));
			await assert.rejects(
				async () => diff.execute({ baselinePath, outputPath: join(root, "wrong.sarif"), seeds, receipt, claims: wrongCategory }, { cwd: process.cwd(), mode: "default" } as never),
				/says COMMAND_EXEC but the seed it names is SQL_INJECTION/,
			);

			// The severity survives the mapping onto SARIF, which has three levels and cannot express the
			// schema's four severities. The claim says MEDIUM; the result must still say so.
			assert.equal(results[0]?.properties?.["dove/severity"], "MEDIUM", "the producer vocabulary survives the mapping");
			assert.equal(results[0]?.properties?.["dove/status"], "HYPOTHESIS");
			assert.equal(results[0]?.level, "warning");

			// A receipt that does not describe this tree is refused before anything is written.
			const forged = { ...receipt, seedSha256: "0".repeat(64) };
			await assert.rejects(
				async () => diff.execute({ baselinePath, outputPath: join(root, "forged.sarif"), seeds, receipt: forged, claims }, { cwd: process.cwd(), mode: "default" } as never),
				/do not match the receipt/,
			);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});


	it("refuses a receipt that does not describe the tree, on all three branches", async () => {
		// The re-derivation is the vertical's only defense against an artifact asserting verification for a
		// tree that produced a different seed set, and until this test it had none: a review deleted the
		// block and re-pointed the findings at the supplied seeds, and every suite stayed green - 56 of 56.
		// The comment above the disposition refusal claimed this check, and the assertion under it matched
		// the **upstream** disposition wording, so nothing exercised the two branches below.
		const root = workspace();
		try {
			const { seeds, receipt } = scan(root);
			const claims = seeds.map((seed) => ({
				candidateId: seed.candidateId,
				category: "SQL_INJECTION",
				severity: "MEDIUM",
				status: "HYPOTHESIS",
				runtimeStatus: "NOT_TESTED",
				ruleChecks: Object.fromEntries(
					["sink_semantics", "entry_reachability", "source_controllability", "data_flow", "parameter_usage", "defense_effectiveness", "auth_boundary", "combination_chains", "category_requirements"].map((check) => [check, "For " + seed.candidateId + " the " + check + " was examined and a reason recorded."]),
				),
				missingEvidence: ["Whether the builder escapes the identifier before it reaches the driver."],
			}));
			const baselinePath = join(root, "baseline.sarif");
			writeFileSync(baselinePath, JSON.stringify(toSarifLog([], { toolVersion: "0.3.0" }), null, 2), "utf8");
			const diff = createDoveRuntime().capabilities.require("code-audit.diff");
			const context = { cwd: process.cwd(), mode: "default" } as never;
			const attempt = () => diff.execute({ baselinePath, outputPath: join(root, "out.sarif"), seeds, receipt, claims }, context);

			// Branch three: the **rulebook** changed. The re-scan reads its catalog from a path resolved against
			// the caller's cwd, so the receipt and the fresh scan could disagree about what was looked for while
			// agreeing about what was found. A narrowed catalog over this tree yields one seed where the shipped
			// one yields four, and both receipts report the same catalogVersion and language.
			const narrowed = join(root, "narrowed.json");
			const catalog = JSON.parse(readFileSync(join(process.cwd(), "modes", "code-audit", "catalog", "typescript.json"), "utf8")) as { categories: Record<string, { families: unknown[] }> };
			catalog.categories["SQL_INJECTION"]!.families = [{ id: "raw_query", patterns: ["\\.whereRaw\\s*\\("] }];
			writeFileSync(narrowed, JSON.stringify(catalog, null, 2), "utf8");
			await assert.rejects(
				async () => diff.execute({ baselinePath, outputPath: join(root, "narrow.sarif"), seeds, receipt, claims, catalogPath: narrowed }, context),
				/the receipt was produced by a different catalog/,
			);

			// Branch one: the tree gained a sink after the scan, so the seeds no longer describe it. The
			// supplied seeds and receipt are internally consistent, so only the re-scan can catch this.
			writeFileSync(join(root, "src", "db", "added.ts"), 'export function added(id: string) {\n\treturn db.query("SELECT * FROM invoices WHERE id = " + id);\n}\n', "utf8");
			await assert.rejects(attempt, /a fresh scan produced a different seed set/);

			// Branch two: the seed set is identical but the file bytes are not, caught by the hashes. The edit has
			// to avoid the matched lines entirely - prepending a line shifts their numbers and changes the seeds,
			// which is branch one again. Rewriting a comment that no family matches changes only the bytes.
			rmSync(join(root, "src", "db", "added.ts"));
			const target = join(root, "src", "db", "query.ts");
			writeFileSync(target, readFileSync(target, "utf8").replace("// The identifier is concatenated straight into the statement.", "// Reworded, with no change to the matched lines or their numbers."), "utf8");
			const unchangedSeeds = scan(root);
			assert.equal(unchangedSeeds.receipt.seedSha256, receipt.seedSha256, "the seed set is unchanged, so only the file hashes can catch this");
			await assert.rejects(attempt, /the files it names are not the files this scan read/);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});


	it("writes a report for a run that reports a deletion", async () => {
		// The only test that reaches the writer with a **real baseline and an absent row**, and the reason it
		// exists: every other diff.execute in the suite either expects a rejection or uses an empty baseline,
		// so nothing exercised the absent path through the writer. The absent row carries no location, and
		// the summary used to read one - it threw *after* the artifact had been renamed into place, so the
		// deliverable was on disk and the capability reported failure.
		const root = workspace();
		try {
			const firstScan = scan(root);
			const firstClaims = firstScan.seeds.map(claimFor);
			const firstBaseline = join(root, "baseline.sarif");
			const diff = createDoveRuntime().capabilities.require("code-audit.diff");
			const context = { cwd: process.cwd(), mode: "default" } as never;
			// The first run writes the baseline it will be compared against, through the writer itself, so the
			// baseline is a real artifact this capability produced rather than a hand-built one.
			writeFileSync(firstBaseline, JSON.stringify(toSarifLog([], { toolVersion: "0.3.0" }), null, 2), "utf8");
			await diff.execute(
				{ baselinePath: firstBaseline, outputPath: firstBaseline, seeds: firstScan.seeds, receipt: firstScan.receipt, claims: firstClaims },
				context,
			);

			// A whole file gone, so its seeds drop out and the baseline entries for them are unmatched.
			rmSync(join(root, "src", "db", "query.ts"));
			const second = scan(root);
			assert.ok(second.seeds.length < firstScan.seeds.length, "the deleted file took its seeds with it");
			const outputPath = join(root, "second.sarif");
			const summary = (await diff.execute(
				{ baselinePath: firstBaseline, outputPath, seeds: second.seeds, receipt: second.receipt, claims: second.seeds.map(claimFor) },
				context,
			)) as { absent: readonly { fingerprint: string }[] };

			// The refusal did not happen and the deliverable is real.
			assert.ok(summary.absent.length > 0, "the deletion is reported as data, not only as a row");
			assert.equal(existsSync(outputPath), true);
			const written = JSON.parse(readFileSync(outputPath, "utf8")) as { runs: { results: { baselineState?: string; locations?: unknown }[] }[] };
			const absent = written.runs[0]!.results.filter((result) => result.baselineState === "absent");
			assert.ok(absent.length > 0, "and it is in the artifact");
			assert.ok(absent.every((result) => result.locations === undefined), "an absent row carries identity, not a location");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});
	it("makes a narrowed catalog visible in the receipt rather than silently keeping the claim", () => {
		const root = workspace();
		try {
			const before = scan(root).receipt;
			assert.ok(before.scannedFiles.some((file) => file.endsWith("query.ts")), "the file is covered to begin with");

			// The same catalog with the category no longer claiming .ts files. Coverage shrank, and the
			// receipt has to show it: a reader comparing two receipts must see that the claim changed.
			const narrowed = parseCatalog(JSON.stringify({
				schema_version: 1,
				language: catalog.language,
				categories: { ...catalog.categories, SQL_INJECTION: { ...catalog.categories["SQL_INJECTION"]!, suffixes: [".tsx"] } },
			}));
			const after = scanCategory({ catalog: narrowed, category: "SQL_INJECTION", roots: [root], scope: "fixture" });
			assert.equal(after.receipt.scannedFiles.some((file) => file.endsWith("query.ts")), false);
			assert.equal(after.seeds.length, 0, "nothing is found, because nothing is claimed");
			assert.equal(after.receipt.scannedFileCount, 0);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});
});
