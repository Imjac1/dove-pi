/**
 * The deterministic seed catalog: data that decides what gets looked for, and nothing else.
 *
 * A catalog is per-language because regex sinks are per-language, and it is versioned because the
 * coverage receipt cites the version - a change to what was searched must be visible in the artifact
 * that claims what was searched.
 *
 * The unit is a **family**, not a pattern. A family is a named group of patterns that together cover
 * one way a vulnerability class is reached (for example legacy mysql calls, or PDO calls). Families
 * are what the receipt proves were executed, so a family cannot be silently skipped.
 *
 * Everything here fails closed. An invalid regex is a load error rather than a silently dropped
 * pattern, because a dropped pattern produces a clean result that is not actually clean.
 */

export interface CatalogFamily {
	readonly id: string;
	readonly patterns: readonly string[];
}

export interface CatalogCategory {
	/** Candidate-id prefix, e.g. SQL, so an id is readable and a category is traceable from it. */
	readonly prefix: string;
	/** File extensions the category applies to, case-insensitive. */
	readonly suffixes: readonly string[];
	readonly families: readonly CatalogFamily[];
}

export interface SeedCatalog {
	readonly schemaVersion: number;
	readonly language: string;
	readonly categories: Readonly<Record<string, CatalogCategory>>;
}

export const CATALOG_SCHEMA_VERSION = 1;

const CATEGORY_FIELDS = new Set(["prefix", "suffixes", "families"]);
const FAMILY_FIELDS = new Set(["id", "patterns"]);
const TOP_FIELDS = new Set(["schema_version", "language", "categories"]);

/** Raised when the catalog cannot be trusted. Never a warning: an unusable catalog means no coverage claim. */
export class CatalogError extends Error {}

function unknownField(where: string, value: object, allowed: ReadonlySet<string>): string | undefined {
	const offender = Object.keys(value).find((key) => !allowed.has(key));
	return offender === undefined ? undefined : where + " declares unknown field '" + offender + "'";
}

/**
 * Validate a parsed catalog. Returns every problem rather than the first, so one run reports all of
 * them and a broken catalog does not have to be fixed one error at a time.
 */
export function validateCatalog(value: unknown): readonly string[] {
	const errors: string[] = [];
	if (typeof value !== "object" || value === null || Array.isArray(value)) return ["catalog must be an object"];
	const record = value as Record<string, unknown>;
	const top = unknownField("catalog", record, TOP_FIELDS);
	if (top !== undefined) errors.push(top);
	if (record["schema_version"] !== CATALOG_SCHEMA_VERSION) errors.push("catalog schema_version must be " + CATALOG_SCHEMA_VERSION);
	if (typeof record["language"] !== "string" || (record["language"] as string).trim() === "") errors.push("catalog language must be a non-empty string");
	const categories = record["categories"];
	if (typeof categories !== "object" || categories === null || Array.isArray(categories) || Object.keys(categories as object).length === 0) {
		errors.push("catalog categories must be a non-empty object");
		return errors;
	}
	for (const [name, raw] of Object.entries(categories as Record<string, unknown>)) {
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { errors.push("category " + name + " must be an object"); continue; }
		const spec = raw as Record<string, unknown>;
		const categoryProblem = unknownField("category " + name, spec, CATEGORY_FIELDS);
		if (categoryProblem !== undefined) errors.push(categoryProblem);
		if (typeof spec["prefix"] !== "string" || (spec["prefix"] as string).trim() === "") errors.push("category " + name + " must declare a non-empty prefix");
		const suffixes = spec["suffixes"];
		if (!Array.isArray(suffixes) || suffixes.length === 0 || !suffixes.every((s) => typeof s === "string" && s.trim() !== "")) {
			errors.push("category " + name + " must declare a non-empty suffixes array");
		} else if (!suffixes.every((s) => (s as string).startsWith("."))) {
			errors.push("category " + name + " suffixes must start with a dot");
		}
		const families = spec["families"];
		if (!Array.isArray(families) || families.length === 0) { errors.push("category " + name + " must declare at least one family"); continue; }
		const seen = new Set<string>();
		for (const rawFamily of families) {
			if (typeof rawFamily !== "object" || rawFamily === null || Array.isArray(rawFamily)) { errors.push("category " + name + " has a family that is not an object"); continue; }
			const family = rawFamily as Record<string, unknown>;
			const id = typeof family["id"] === "string" ? (family["id"] as string).trim() : "";
			if (id === "") { errors.push("category " + name + " has a family with no id"); continue; }
			const familyProblem = unknownField("category " + name + " family " + id, family, FAMILY_FIELDS);
			if (familyProblem !== undefined) errors.push(familyProblem);
			if (seen.has(id)) errors.push("category " + name + " declares family " + id + " twice");
			seen.add(id);
			const patterns = family["patterns"];
			if (!Array.isArray(patterns) || patterns.length === 0) { errors.push("category " + name + " family " + id + " must declare at least one pattern"); continue; }
			for (const pattern of patterns) {
				if (typeof pattern !== "string" || pattern === "") { errors.push("category " + name + " family " + id + " has an empty pattern"); continue; }
				try { new RegExp(pattern); } catch (error) {
					// A pattern that does not compile must not be skipped: skipping it yields a clean-looking
					// result for code that was never actually searched.
					errors.push("category " + name + " family " + id + " has a pattern that does not compile: " + (error instanceof Error ? error.message : String(error)));
				}
			}
		}
	}
	return errors;
}

/** Parse and validate, or throw with every problem listed. */
export function parseCatalog(text: string): SeedCatalog {
	let parsed: unknown;
	try { parsed = JSON.parse(text); } catch (error) { throw new CatalogError("catalog is not valid JSON: " + (error instanceof Error ? error.message : String(error))); }
	const errors = validateCatalog(parsed);
	if (errors.length > 0) throw new CatalogError("invalid catalog:\n  " + errors.join("\n  "));
	const record = parsed as { schema_version: number; language: string; categories: Record<string, CatalogCategory> };
	return { schemaVersion: record.schema_version, language: record.language, categories: record.categories };
}

/** The family ids of one category, sorted. The receipt's mandatory set is compared against this. */
export function familyIdsOf(catalog: SeedCatalog, category: string): readonly string[] {
	const spec = catalog.categories[category];
	if (spec === undefined) throw new CatalogError("catalog does not define category " + category);
	return spec.families.map((family) => family.id).sort();
}

/** Compile one category's families, preserving declaration order. Throws rather than dropping a pattern. */
export function compileCategory(catalog: SeedCatalog, category: string): readonly { readonly familyId: string; readonly pattern: string; readonly regex: RegExp }[] {
	const spec = catalog.categories[category];
	if (spec === undefined) throw new CatalogError("catalog does not define category " + category);
	const compiled: { familyId: string; pattern: string; regex: RegExp }[] = [];
	for (const family of spec.families) for (const pattern of family.patterns) compiled.push({ familyId: family.id, pattern, regex: new RegExp(pattern) });
	return compiled;
}
