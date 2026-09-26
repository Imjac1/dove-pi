import { familyIdsOf, type SeedCatalog } from "./catalog.ts";

/**
 * The coverage receipt: the artifact that makes "this category produced nothing" believable.
 *
 * A finding list cannot prove a negative. The receipt can, because it records what was actually
 * searched - the roots, every file read with its hash, which families ran, how many hits each
 * produced, and which files could not be read at all - and because its validator fails the run when
 * any mandatory family did not execute.
 *
 * `seedSha256` binds the receipt to the exact seed set, so the two cannot be edited independently.
 *
 * Unreadable files are recorded and add a gap. They are **never** folded into a clean result: a file
 * nobody could read is not a file with no findings.
 */

export interface ExecutedPattern {
	readonly family: string;
	readonly pattern: string;
}

export interface UnreadableFile {
	readonly path: string;
	readonly error: string;
}

export interface CoverageReceipt {
	readonly schemaVersion: number;
	readonly catalogVersion: number;
	readonly language: string;
	readonly category: string;
	readonly scope: string;
	readonly sourceRoots: readonly string[];
	readonly scopeLimited: boolean;
	readonly requestedScopeFiles: readonly string[];
	readonly scannedFiles: readonly string[];
	readonly scannedFileSha256: Readonly<Record<string, string>>;
	readonly scannedFileCount: number;
	readonly mandatoryFamilies: readonly string[];
	readonly executedPatterns: readonly ExecutedPattern[];
	readonly hitCount: number;
	readonly familyHits: Readonly<Record<string, number>>;
	readonly unreadableFiles: readonly UnreadableFile[];
	readonly gaps: readonly string[];
	readonly seedSha256: string;
}

export const RECEIPT_SCHEMA_VERSION = 2;

export const GAP_UNREADABLE = "unreadable source files";

function sameSet(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) return false;
	const a = [...left].sort();
	const b = [...right].sort();
	return a.every((value, index) => value === b[index]);
}

/**
 * Validate a receipt against the catalog it claims to describe. Returns every problem, or an empty
 * array when the coverage claim holds.
 *
 * The two checks that matter most are the family-set comparisons. A receipt that omits a family, or
 * that lists a family in `mandatoryFamilies` without a single pattern from it in `executedPatterns`,
 * is claiming coverage it does not have - which is exactly the claim a reader cannot verify by
 * reading a finding list.
 */
export function validateReceipt(receipt: CoverageReceipt, category: string, catalog: SeedCatalog): readonly string[] {
	const errors: string[] = [];
	if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) errors.push("receipt schemaVersion must be " + RECEIPT_SCHEMA_VERSION);
	if (receipt.catalogVersion !== catalog.schemaVersion) errors.push("receipt catalogVersion does not match the catalog schema version");
	if (receipt.category !== category) errors.push("receipt category must be " + category);
	if (receipt.language !== catalog.language) errors.push("receipt language does not match the catalog language");

	const expected = familyIdsOf(catalog, category);
	if (!sameSet(receipt.mandatoryFamilies, expected)) {
		const missing = expected.filter((id) => !receipt.mandatoryFamilies.includes(id));
		const extra = receipt.mandatoryFamilies.filter((id) => !expected.includes(id));
		errors.push("receipt mandatoryFamilies does not match the catalog" + (missing.length > 0 ? "; missing " + missing.join(", ") : "") + (extra.length > 0 ? "; unknown " + extra.join(", ") : ""));
	}
	const executedFamilies = [...new Set(receipt.executedPatterns.map((entry) => entry.family))];
	if (!sameSet(executedFamilies, expected)) {
		const missing = expected.filter((id) => !executedFamilies.includes(id));
		errors.push("receipt did not execute every mandatory family" + (missing.length > 0 ? ": " + missing.join(", ") : ""));
	}

	if (receipt.sourceRoots.length === 0) errors.push("receipt must record at least one source root");
	if (receipt.scannedFileCount !== receipt.scannedFiles.length) errors.push("receipt scannedFileCount does not match scannedFiles");
	for (const path of receipt.scannedFiles) {
		if (receipt.scannedFileSha256[path] === undefined) { errors.push("receipt is missing a hash for " + path); break; }
	}
	for (const family of expected) {
		if (receipt.familyHits[family] === undefined) { errors.push("receipt is missing a hit count for family " + family); break; }
	}
	if (receipt.seedSha256.trim() === "") errors.push("receipt must carry a seed digest");
	if (receipt.unreadableFiles.length > 0 && !receipt.gaps.includes(GAP_UNREADABLE)) errors.push("receipt has unreadable files but does not declare the gap");
	return errors;
}

/**
 * Whether a receipt supports the claim "this category is clean".
 *
 * Deliberately separate from validity: a receipt can be perfectly valid and still not support a clean
 * claim, because a gap is a hole in coverage rather than a defect in the artifact.
 */
export function supportsCleanClaim(receipt: CoverageReceipt): boolean {
	return receipt.gaps.length === 0;
}
