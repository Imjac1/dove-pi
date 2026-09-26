import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CatalogError, familyIdsOf, parseCatalog, validateCatalog } from "../src/code-audit/catalog.ts";
import { GAP_UNREADABLE, RECEIPT_SCHEMA_VERSION, supportsCleanClaim, validateReceipt, type CoverageReceipt } from "../src/code-audit/receipt.ts";
import { ScanError, scanCategory, seedDigest } from "../src/code-audit/seed-scanner.ts";

const CATALOG_PATH = join(process.cwd(), "modes", "code-audit", "catalog", "typescript.json");
const VULNERABLE = join(process.cwd(), "tests", "fixtures", "code-audit", "vulnerable");
const SAFE = join(process.cwd(), "tests", "fixtures", "code-audit", "safe");

const catalog = parseCatalog(readFileSync(CATALOG_PATH, "utf8"));
const scan = (category: string, roots: readonly string[]) => scanCategory({ catalog, category, roots, scope: "fixture" });

describe("seed catalog", () => {
	it("loads the shipped catalog with every category and family accounted for", () => {
		assert.equal(catalog.schemaVersion, 1);
		assert.equal(catalog.language, "typescript");
		assert.equal(Object.keys(catalog.categories).length, 11);
		for (const category of Object.keys(catalog.categories)) assert.ok(familyIdsOf(catalog, category).length > 0, category + " must declare families");
	});

	it("rejects a pattern that does not compile, rather than skipping it", () => {
		// A skipped pattern yields a clean-looking result for code that was never searched.
		const broken = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as { categories: Record<string, { families: { patterns: string[] }[] }> };
		broken.categories["SQL_INJECTION"]!.families[0]!.patterns = ["(unclosed"];
		const errors = validateCatalog(broken);
		assert.ok(errors.some((e) => e.includes("does not compile")), "expected a compile error, got: " + errors.join("; "));
		assert.throws(() => parseCatalog(JSON.stringify(broken)), CatalogError);
	});

	it("rejects unknown fields, an empty category, and a missing prefix", () => {
		assert.ok(validateCatalog({ schema_version: 1, language: "x", categories: {}, extra: 1 }).length >= 2);
		const noPrefix = { schema_version: 1, language: "x", categories: { A: { suffixes: [".x"], families: [{ id: "f", patterns: ["a"] }] } } };
		assert.ok(validateCatalog(noPrefix).some((e) => e.includes("prefix")));
	});
});

describe("seed scanner", () => {
	it("finds seeds in the vulnerable fixture and none in the clean one", () => {
		const sql = scan("SQL_INJECTION", [VULNERABLE]);
		assert.ok(sql.seeds.length >= 2, "expected the two concatenated statements, got " + sql.seeds.length);
		assert.equal(scan("SQL_INJECTION", [SAFE]).seeds.length, 0);
	});

	it("reports a hit count for every mandatory family, including the ones at zero", () => {
		const { receipt } = scan("SQL_INJECTION", [VULNERABLE]);
		const expected = familyIdsOf(catalog, "SQL_INJECTION");
		assert.deepEqual([...receipt.mandatoryFamilies].sort(), [...expected].sort());
		for (const family of expected) assert.equal(typeof receipt.familyHits[family], "number", family + " must have a count");
		assert.ok(Object.values(receipt.familyHits).some((n) => n === 0), "at least one family should have no hits here, and must still be recorded");
	});

	it("keys a hit by family, file and line, so one line yields at most one seed per family", () => {
		const { seeds } = scan("SQL_INJECTION", [VULNERABLE]);
		const keys = seeds.map((s) => s.sink.family + "|" + s.evidence[0]!.path + "|" + s.evidence[0]!.line);
		assert.equal(new Set(keys).size, keys.length);
	});

	it("applies the category suffixes rather than scanning everything", () => {
		const { receipt } = scan("SQL_INJECTION", [SAFE]);
		assert.equal(receipt.scannedFiles.some((f) => f.endsWith("README.md")), false, "a markdown file is not a TypeScript source file");
		assert.equal(receipt.scannedFiles.some((f) => f.endsWith("clean.ts")), true);
	});

	it("is byte-stable: two runs over the same tree agree on every seed and on the digest", () => {
		const first = scan("COMMAND_EXEC", [VULNERABLE]);
		const second = scan("COMMAND_EXEC", [VULNERABLE]);
		assert.deepEqual(second.seeds, first.seeds);
		assert.equal(second.receipt.seedSha256, first.receipt.seedSha256);
		assert.equal(seedDigest(first.seeds), first.receipt.seedSha256);
	});

	it("refuses to scan when there is no source root", () => {
		assert.throws(() => scan("SQL_INJECTION", [join(process.cwd(), "tests", "fixtures", "does-not-exist")]), ScanError);
	});


	it("fires the families its fixture is built to contain, per category", () => {
		// A pattern that can never match is a silent hole in coverage: the category reports clean because
		// nothing looked, not because nothing is there. Running the catalog against this fixture found two
		// such defects: the writeFile pattern could not match writeFileSync(, and an assignment-only
		// filename shape missed the property read file.originalname. Two others - the trailing "?" on
		// spawnSync? and readFileSync?, which misses the plain form - were found by reading the regexes,
		// because this fixture contains no spawn or readFile at all. The direct assertion below is what
		// pins those two; this test cannot, and the earlier version of this comment claimed it did.
		const expected: Record<string, readonly string[]> = {
			SQL_INJECTION: ["raw_query", "orm_raw", "string_composition"],
			COMMAND_EXEC: ["child_process"],
			FILE_UPLOAD: ["filename_from_request", "write_from_request"],
			SSRF: ["fetch_variable"],
			DESERIALIZATION: ["json_revive"],
			TEMPLATE_INJECTION: ["compile_from_string"],
		};
		for (const [category, families] of Object.entries(expected)) {
			const { receipt } = scan(category, [VULNERABLE]);
			for (const family of families) {
				assert.ok(
					(receipt.familyHits[family] ?? 0) > 0,
					category + "/" + family + " must fire on the fixture; a pattern that never matches reports clean without looking",
				);
			}
		}
	});

	it("matches both the plain and the suffixed form of the calls it names", () => {
		// The defect this pins directly, because the fixture test above does not. spawnSync? compiles and
		// means "spawnSyn" plus an optional "c", so it matched spawnSync( and never spawn( - the plain
		// form, which is the one most code uses. readFileSync? had the same shape. And writeFile\s*\( never
		// matched writeFileSync( at all. Each of these reported a clean category over code full of the
		// real thing, which is the failure a coverage claim exists to prevent. Asserting the pattern
		// against a sample is what pins the fix; a fixture only pins it if the fixture happens to reach
		// the family by that route, and this one reached COMMAND_EXEC through the import and exec instead.
		const cases: [string, string, string][] = [
			["COMMAND_EXEC", "child_process", "spawn(\"render\", args)"],
			["COMMAND_EXEC", "child_process", "execSync(cmd)"],
			["FILE_READ", "read_variable", "readFileSync(path, \"utf8\")"],
			["FILE_READ", "read_variable", "readFile(path, callback)"],
			["FILE_UPLOAD", "write_from_request", "writeFileSync(target, req.body)"],
			["FILE_UPLOAD", "write_from_request", "writeFile(target, req.body)"],
			["FILE_UPLOAD", "filename_from_request", "path.join(root, file.originalname)"],
		];
		for (const [category, family, sample] of cases) {
			const patterns = catalog.categories[category]!.families.find((entry) => entry.id === family)!.patterns;
			assert.ok(
				patterns.some((pattern) => new RegExp(pattern).test(sample)),
				category + "/" + family + " must match " + JSON.stringify(sample) + "; the patterns are " + JSON.stringify(patterns),
			);
		}
	});
	it("emits candidates, never findings", () => {
		const { seeds } = scan("SQL_INJECTION", [VULNERABLE]);
		for (const seed of seeds) {
			assert.equal(seed.status, "PENDING", "a regex hit is a place to look, not a conclusion");
			assert.equal(seed.engine, "deterministic-catalog");
			assert.equal(seed.authState, "UNKNOWN", "the scanner knows nothing about authorization, and says so rather than guessing");
		}
	});
});

describe("coverage receipt", () => {
	const base = (): CoverageReceipt => scan("SQL_INJECTION", [VULNERABLE]).receipt;

	it("fails when a mandatory family did not execute", () => {
		const receipt = base();
		const dropped = familyIdsOf(catalog, "SQL_INJECTION")[0]!;
		const damaged: CoverageReceipt = { ...receipt, executedPatterns: receipt.executedPatterns.filter((e) => e.family !== dropped) };
		const errors = validateReceipt(damaged, "SQL_INJECTION", catalog);
		assert.ok(errors.some((e) => e.includes("did not execute every mandatory family")), "got: " + errors.join("; "));
	});

	it("fails when the catalog has a family the receipt never covered", () => {
		const receipt = base();
		const wider = { ...catalog, categories: { ...catalog.categories, SQL_INJECTION: { ...catalog.categories["SQL_INJECTION"]!, families: [...catalog.categories["SQL_INJECTION"]!.families, { id: "brand_new", patterns: ["x"] }] } } };
		const errors = validateReceipt(receipt, "SQL_INJECTION", wider);
		assert.ok(errors.some((e) => e.includes("mandatoryFamilies does not match") || e.includes("did not execute every mandatory family")), "got: " + errors.join("; "));
	});

	it("fails on a version, category or language mismatch", () => {
		const receipt = base();
		assert.ok(validateReceipt({ ...receipt, schemaVersion: 1 }, "SQL_INJECTION", catalog).some((e) => e.includes("schemaVersion")));
		assert.ok(validateReceipt(receipt, "SSRF", catalog).some((e) => e.includes("category")));
		assert.ok(validateReceipt({ ...receipt, language: "php" }, "SQL_INJECTION", catalog).some((e) => e.includes("language")));
	});

	it("fails when a scanned file has no hash, or a family has no count", () => {
		const receipt = base();
		const path = receipt.scannedFiles[0]!;
		const hashes = { ...receipt.scannedFileSha256 };
		delete hashes[path];
		assert.ok(validateReceipt({ ...receipt, scannedFileSha256: hashes }, "SQL_INJECTION", catalog).some((e) => e.includes("hash")));
		const counts = { ...receipt.familyHits };
		delete counts[familyIdsOf(catalog, "SQL_INJECTION")[0]!];
		assert.ok(validateReceipt({ ...receipt, familyHits: counts }, "SQL_INJECTION", catalog).some((e) => e.includes("hit count")));
	});

	it("treats an unreadable file as a gap, and a gap blocks a clean claim", () => {
		// The scanner path for this is exercised by construction; provoking a real read failure needs
		// OS-level permissions, so what is asserted here is the contract that matters: a file nobody
		// could read is a hole in coverage, and a hole stops the category being called clean.
		const receipt = base();
		const withUnreadable: CoverageReceipt = { ...receipt, unreadableFiles: [{ path: join(VULNERABLE, "src", "db", "query.ts"), error: "EACCES" }] };
		const errors = validateReceipt(withUnreadable, "SQL_INJECTION", catalog);
		assert.ok(errors.some((e) => e.includes("does not declare the gap")), "got: " + errors.join("; "));

		const declared: CoverageReceipt = { ...withUnreadable, gaps: [GAP_UNREADABLE] };
		assert.deepEqual(validateReceipt(declared, "SQL_INJECTION", catalog), [], "a declared gap is a valid, honest receipt");
		assert.equal(supportsCleanClaim(receipt), true, "a complete scan supports a clean claim");
		assert.equal(supportsCleanClaim(declared), false, "a scan with a hole does not, even though the receipt itself is valid");
	});

	it("carries a seed digest that binds it to the seeds it describes", () => {
		const { receipt, seeds } = scan("SQL_INJECTION", [VULNERABLE]);
		assert.equal(receipt.seedSha256, seedDigest(seeds));
		const fewer = seeds.slice(1);
		assert.notEqual(seedDigest(fewer), receipt.seedSha256, "dropping a seed must change the digest");
	});
});
