import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { compileCategory, familyIdsOf, type SeedCatalog } from "./catalog.ts";
import { GAP_UNREADABLE, RECEIPT_SCHEMA_VERSION, type CoverageReceipt, type ExecutedPattern, type UnreadableFile, validateReceipt } from "./receipt.ts";

/**
 * The deterministic seed scanner.
 *
 * Offline, in-process, model-free, shell-free. It reads text and hashes files; it never executes the
 * audited code and never touches the network, which is why it needs no capability beyond read access
 * and does not disturb the mode's `never_allow: [bash, powershell]` rule.
 *
 * What it produces is **candidates, not findings**. A regex hit is a place worth looking, and every
 * seed is `PENDING` until something else classifies it. The bias is deliberate and stated: the cost of
 * a candidate is one verification pass, and the cost of a missed sink is a missed vulnerability. That
 * is also why seeds are **non-deletable** - a later stage may classify one, but a seed that vanishes
 * without a disposition is a coverage failure rather than a tidy result.
 */

export interface SeedSink {
	readonly family: string;
	readonly symbol: string;
	readonly location: string;
}

export interface SeedEvidence {
	readonly path: string;
	readonly line: number;
	readonly excerpt: string;
}

export interface SeedCandidate {
	readonly candidateId: string;
	readonly category: string;
	readonly engine: "deterministic-catalog";
	readonly sourceScope: string;
	readonly route: null;
	readonly authState: "UNKNOWN";
	readonly source: null;
	readonly propagation: readonly unknown[];
	readonly sink: SeedSink;
	readonly sanitizers: readonly unknown[];
	readonly evidence: readonly SeedEvidence[];
	readonly coverage: { readonly searched: readonly string[]; readonly gaps: readonly string[] };
	readonly status: "PENDING";
}

export interface ScanOptions {
	readonly catalog: SeedCatalog;
	readonly category: string;
	readonly roots: readonly string[];
	readonly scope: string;
}

export interface ScanResult {
	readonly seeds: readonly SeedCandidate[];
	readonly receipt: CoverageReceipt;
}

/** Raised when the scan cannot make a coverage claim at all. */
export class ScanError extends Error {}

/** Directories that are never source: version control, dependencies, and the audit output itself. */
const SKIP_DIRS = new Set([".git", ".hg", ".svn", "node_modules", ".next", "dist", "build", "coverage"]);

/** Canonical JSON: sorted keys, so the same seed set always hashes the same way. */
function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
	const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
	return "{" + entries.map(([key, item]) => JSON.stringify(key) + ":" + canonical(item)).join(",") + "}";
}

/** Digest of the seed set, so a receipt and its seeds cannot be edited independently. */
export function seedDigest(seeds: readonly SeedCandidate[]): string {
	return createHash("sha256").update(canonical(seeds)).digest("hex");
}

export function hashFile(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Every file under the roots whose extension the category claims, sorted for determinism. */
function collectFiles(roots: readonly string[], suffixes: ReadonlySet<string>): readonly string[] {
	const found: string[] = [];
	const walk = (directory: string): void => {
		let entries: string[];
		try { entries = readdirSync(directory).sort(); } catch { return; }
		for (const entry of entries) {
			if (SKIP_DIRS.has(entry)) continue;
			const full = join(directory, entry);
			let stats;
			try { stats = statSync(full); } catch { continue; }
			if (stats.isDirectory()) { walk(full); continue; }
			if (stats.isFile() && suffixes.has(extname(entry).toLowerCase())) found.push(full);
		}
	};
	for (const root of roots) walk(root);
	return [...new Set(found)].sort();
}

/** A stable, readable id. The prefix makes the category traceable from the id alone. */
function seedId(prefix: string, category: string, family: string, path: string, line: number, excerpt: string, ordinal: number): string {
	const digest = createHash("sha256").update([category, family, path, String(line), excerpt].join("|")).digest("hex").slice(0, 8);
	return prefix + "-" + digest + "-" + String(ordinal);
}

/**
 * Scan one category over the given roots.
 *
 * Runs **every** pattern of **every** family: the executed set is recorded in the receipt and compared
 * against the catalog, so a family cannot be silently skipped. Hits are keyed by
 * (family, path, line) so one line yields at most one seed per family.
 */
export function scanCategory(options: ScanOptions): ScanResult {
	const { catalog, category, scope } = options;
	const spec = catalog.categories[category];
	if (spec === undefined) throw new ScanError("catalog does not define category " + category);

	const roots = [...new Set(options.roots.map((root) => resolve(root)))].filter((root) => {
		try { return statSync(root).isDirectory(); } catch { return false; }
	}).sort();
	if (roots.length === 0) throw new ScanError("category " + category + " has no existing source roots");

	const mandatoryFamilies = familyIdsOf(catalog, category);
	const compiled = compileCategory(catalog, category);
	const executedPatterns: ExecutedPattern[] = compiled.map((entry) => ({ family: entry.familyId, pattern: entry.pattern }));
	const familyHits: Record<string, number> = {};
	for (const family of mandatoryFamilies) familyHits[family] = 0;

	const suffixes = new Set(spec.suffixes.map((suffix) => suffix.toLowerCase()));
	const files = collectFiles(roots, suffixes);
	const seeds: SeedCandidate[] = [];
	const scannedFileSha256: Record<string, string> = {};
	const unreadableFiles: UnreadableFile[] = [];
	const seen = new Set<string>();

	for (const path of files) {
		let hash: string;
		let text: string;
		try { hash = hashFile(path); text = readFileSync(path, "utf8"); } catch (error) {
			// Recorded, never folded into a clean result.
			unreadableFiles.push({ path, error: error instanceof Error ? error.message : String(error) });
			continue;
		}
		scannedFileSha256[path] = hash;
		const lines = text.split(/\r?\n/);
		for (const [index, rawLine] of lines.entries()) {
			const line = index + 1;
			for (const entry of compiled) {
				const match = entry.regex.exec(rawLine);
				if (match === null) continue;
				const key = entry.familyId + String.fromCharCode(0) + path.toLowerCase() + String.fromCharCode(0) + line;
				if (seen.has(key)) continue;
				seen.add(key);
				familyHits[entry.familyId] = (familyHits[entry.familyId] ?? 0) + 1;
				const excerpt = rawLine.trim().slice(0, 1000);
				seeds.push({
					candidateId: seedId(spec.prefix, category, entry.familyId, path, line, excerpt, seeds.length + 1),
					category,
					engine: "deterministic-catalog",
					sourceScope: scope,
					route: null,
					authState: "UNKNOWN",
					source: null,
					propagation: [],
					sink: { family: entry.familyId, symbol: match[0], location: path + ":" + line },
					sanitizers: [],
					evidence: [{ path, line, excerpt }],
					coverage: { searched: roots, gaps: [] },
					status: "PENDING",
				});
			}
		}
	}

	seeds.sort((left, right) => left.candidateId.localeCompare(right.candidateId));
	const gaps = unreadableFiles.length > 0 ? [GAP_UNREADABLE] : [];

	const receipt: CoverageReceipt = {
		schemaVersion: RECEIPT_SCHEMA_VERSION,
		catalogVersion: catalog.schemaVersion,
		language: catalog.language,
		category,
		scope,
		sourceRoots: roots,
		scopeLimited: false,
		requestedScopeFiles: [],
		scannedFiles: Object.keys(scannedFileSha256),
		scannedFileSha256,
		scannedFileCount: Object.keys(scannedFileSha256).length,
		mandatoryFamilies,
		executedPatterns,
		hitCount: seeds.length,
		familyHits,
		unreadableFiles,
		gaps,
		seedSha256: seedDigest(seeds),
	};

	const errors = validateReceipt(receipt, category, catalog);
	if (errors.length > 0) throw new ScanError("scan produced an invalid receipt:\n  " + errors.join("\n  "));
	return { seeds, receipt };
}
