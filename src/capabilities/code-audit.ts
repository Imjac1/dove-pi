import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { FINGERPRINT_KEY, baselineOf, toSarifLog, type Finding, type ResultShape, type SarifLog } from "../core/evidence-sarif.ts";
import { describeDispositionFailure, reconcileDispositions, type DispositionReport } from "../code-audit/claim-schema.ts";
import { parseCatalog } from "../code-audit/catalog.ts";
import { deriveFindings } from "../code-audit/derive-findings.ts";
import type { CoverageReceipt } from "../code-audit/receipt.ts";
import type { SeedCandidate } from "../code-audit/seed-scanner.ts";
import { scanCategory, type ScanResult } from "../code-audit/seed-scanner.ts";
import type { CapabilityRegistry } from "../core/capability-registry.ts";
import type { CapabilityDefinition } from "../core/contracts.ts";

/**
 * The code-audit vertical capabilities.
 *
 * Two properties are the reason this is a capability rather than a shell command:
 *
 * - **No shell.** The scanner is in-process, so the mode rule `never_allow: [bash, powershell]` stays
 *   intact - and it is a rule the host enforces, because those are the tool names a shell call resolves
 *   to. Wrapping a CLI engine would have required relaxing it, and the engine research showed that
 *   would have bought rules and a SARIF container and nothing else - no engine surveyed supplies
 *   finding identity, and none documents deterministic output.
 * - **`read_only` for the scan.** It reads text and hashes files. It never executes the audited
 *   repository, which is what makes it safe to point at code nobody has vetted.
 */

/**
 * A path relative to the root the scan searched, with forward slashes.
 *
 * SARIF's artifactLocation.uri is a URI and this framework documents Finding.path as repository-relative;
 * an absolute drive path is neither. And it makes a baseline non-portable: the same-(category, path) tier
 * could never fire across two roots, so an edit under a new root would read as one new finding plus one
 * absent one.
 *
 * **Known limit:** the result depends on the root *list*, not only on the tree. The same bytes scanned as
 * `[repo/src]` give `db/query.ts` and as `[repo, repo/src]` give `src/db/query.ts`, so listing an ancestor
 * root changes every uri and the same-(category, path) tier cannot fire between the two runs. Stated rather
 * than fixed: choosing a canonical root is a policy the mode should own, not one to guess at here.
 *
 * The seed itself keeps its absolute path. Relativizing the seed would change every digest.
 *
 * **A path under no recorded root is refused rather than returned as-is.** A seed records the roots it was
 * scanned against, so a miss means the invariant is already broken, and returning an absolute path would
 * put a leak into the artifact while looking like a successful write. The first version of this fell back
 * to the absolute path; "it should be impossible" is a sentence this task has produced three times and been
 * wrong about three times, so the fallback is gone.
 */
function relativeToRoot(path: string, roots: readonly string[]): string {
	for (const root of roots) {
		const candidate = relative(root, path);
		if (candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate)) return candidate.split(sep).join("/");
	}
	throw new Error("no recorded scan root contains " + path + ", so it cannot be expressed as a repository-relative location");
}

const DEFAULT_CATALOG = join("modes", "code-audit", "catalog", "typescript.json");

export interface SeedArgs {
	readonly category: string;
	readonly roots: readonly string[];
	readonly catalogPath?: string;
	readonly scope?: string;
}

export interface DiffArgs {
	/** The SARIF log produced by a previous run. Its identities become the baseline. */
	readonly baselinePath: string;
	/** Where to write the diffed SARIF log. */
	readonly outputPath: string;
	/**
	 * Every candidate id the scan produced, and one claim per candidate.
	 *
	 * These are **required**, and that is the point. This capability is the one that writes the report, so
	 * it is where the vertical's closure rule is enforced: an artifact cannot exist while a seed has no
	 * disposition. The check was first built as its own capability, which made it documented and callable
	 * but not enforced - nothing obliged anyone to call it before the report was written. A review pointed
	 * out that this is the same shape as the defect it was meant to fix, one level up, and that the vertical
	 * already contained the right pattern: scanCategory validates its own receipt and refuses to return one
	 * that does not hold. Enforcing at artifact production rather than at the model's diligence is the fix.
	 */
	readonly seeds: readonly SeedCandidate[];
	readonly receipt: CoverageReceipt;
	readonly claims: readonly unknown[];
	/** The catalog the scan used. Defaults to the shipped one; the re-scan must use the same. */
	readonly catalogPath?: string;
	readonly toolVersion?: string;
}

export interface DispositionArgs {
	/**
	 * The scan's output: the seeds themselves, not a list of ids.
	 *
	 * The ids are derived from these and bound to the receipt, so a caller cannot hand in a shorter list
	 * than the scan found. An id list would make the check's ground truth something the checked party
	 * supplies, and a scan that produced four seeds passed it by reporting none.
	 */
	readonly seeds: readonly SeedCandidate[];
	readonly receipt: CoverageReceipt;
	/** One claim per candidate, as produced by the verification stage. */
	readonly claims: readonly unknown[];
}

export interface DiffSummary {
	readonly new: readonly string[];
	readonly unchanged: readonly string[];
	readonly updated: readonly string[];
	/** Absent rows carry identity rather than a location, so this reports identity. */
	readonly absent: readonly { readonly category: string; readonly fingerprint: string }[];
	readonly moved: readonly { readonly from: string; readonly to: string }[];
}

/**
 * Summarise a diff the way a reader scans it: what is new, what went away, and what moved.
 *
 * **The location is optional and this checks.** An absent result carries identity and nothing else, so it
 * has no location to report; the first version of this read `result.locations[0]` guarded only after the
 * index, which threw for every run that reported a deletion - and threw *after* the artifact had been
 * renamed into place, so an operator saw a capability failure with a valid deliverable sitting on disk.
 * It compiled because the contract was re-declared locally with `locations` required, a staler copy of the
 * one in evidence-sarif.ts; that copy is gone and this reads the exported type.
 */
function summarise(log: SarifLog): DiffSummary {
	const results = (log.runs[0] as { results?: readonly ResultShape[] } | undefined)?.results ?? [];
	const where = (result: ResultShape): string =>
		(result.locations?.[0] as { physicalLocation?: { artifactLocation?: { uri?: string } } } | undefined)?.physicalLocation?.artifactLocation?.uri ?? "";
	const at = (state: string): string[] => results.filter((result) => result.baselineState === state).map(where);
	const moved: { from: string; to: string }[] = [];
	for (const result of results) {
		const from = result.properties?.["dove/movedFrom"];
		if (typeof from !== "string") continue;
		moved.push({ from, to: where(result) });
	}
	// An absent row is a statement about the baseline, so it is reported as the identity it carries rather
	// than as a location it does not have.
	const absent = results
		.filter((result) => result.baselineState === "absent")
		.map((result) => ({ category: result.ruleId, fingerprint: result.partialFingerprints[FINGERPRINT_KEY] ?? "" }));
	return { new: at("new"), unchanged: at("unchanged"), updated: at("updated"), absent, moved };
}

export const codeAuditCapabilities: readonly CapabilityDefinition[] = [
	{
		name: "code-audit.seed",
		version: "0.1.0",
		description: "Scan a source tree with a deterministic sink catalog and return PENDING candidates plus a coverage receipt.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "tested",
		requiredArgs: ["category", "roots"],
		parameterSchema: {
			type: "object",
			required: ["category", "roots"],
			properties: {
				category: { type: "string", description: "A category the catalog defines." },
				roots: { type: "array", items: { type: "string" }, description: "Source roots to scan. At least one must exist." },
				catalogPath: { type: "string", description: "Defaults to the shipped TypeScript catalog." },
				scope: { type: "string", description: "A label recorded in the receipt and on every seed." },
			},
		},
		evidence: [{ kind: "artifact", description: "The coverage receipt, which records which families ran over which files.", required: true }],
		validateArgs: (args) => {
			const value = args as unknown as SeedArgs;
			if (typeof value.category !== "string" || value.category.trim() === "") return "category must be a non-empty string";
			if (!Array.isArray(value.roots) || value.roots.length === 0) return "roots must be a non-empty array";
			return undefined;
		},
		async execute(args, context): Promise<ScanResult> {
			const value = args as unknown as SeedArgs;
			const catalogPath = resolve(context.cwd, value.catalogPath ?? DEFAULT_CATALOG);
			const catalog = parseCatalog(readFileSync(catalogPath, "utf8"));
			return scanCategory({
				catalog,
				category: value.category,
				roots: value.roots.map((root) => resolve(context.cwd, root)),
				scope: value.scope ?? "workspace",
			});
		},
	},
	{
		name: "code-audit.disposition",
		// 0.2.0: the required argument set changed from {seedIds, claims} to {seeds, receipt, claims}. The
		// same rule that bumped code-audit.diff applies here; applying it inconsistently is how a host ends up
		// with a schema failure instead of a version mismatch.
		version: "0.2.0",
		description: "Check that every seed a scan produced carries a disposition, and that each claim is well formed.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "tested",
		requiredArgs: ["seeds", "receipt", "claims"],
		parameterSchema: {
			type: "object",
			required: ["seeds", "receipt", "claims"],
			properties: {
				seeds: { type: "array", description: "The scan output: the seeds themselves, not an id list." },
				receipt: { type: "object", description: "The scan receipt the seeds are bound to." },
				claims: { type: "array", description: "One claim per candidate." },
			},
		},
		evidence: [{ kind: "summary", description: "The disposition report: how many seeds, how many claims, whether the seeds matched the scan receipt, every seed left unmentioned, and any explanation reused verbatim.", required: true }],
		validateArgs: (args) => {
			const value = args as unknown as DispositionArgs;
			if (!Array.isArray(value.seeds)) return "seeds must be an array";
			if (value.receipt === null || typeof value.receipt !== "object") return "receipt must be an object";
			if (!Array.isArray(value.claims)) return "claims must be an array";
			return undefined;
		},
		async execute(args): Promise<DispositionReport> {
			const value = args as unknown as DispositionArgs;
			// The rule lives in one place so that this capability and the artifact writer cannot disagree
			// about it. Here it is exposed; there it is enforced.
			const report = reconcileDispositions(value.seeds, value.receipt, value.claims);
			if (!report.ok) throw new Error(describeDispositionFailure(report));
			return report;
		},
	},
	{
		name: "code-audit.diff",
		// 0.3.0: findingsPath was removed, so the required argument set is five and the capability derives the
		// findings rather than reading them. The version is how a host detects a contract change; leaving it
		// behind gives a pinned host an argument-schema failure instead of a version mismatch. The previous
		// note here said the set grew from three to six while it held five - a comment describing code that is
		// not there, which this file names as having produced three defects. This was the fourth.
		version: "0.3.0",
		description: "Diff the findings of this run against a previous SARIF log, reporting new, unchanged, updated, absent, and moved.",
		platforms: ["any"],
		sideEffects: ["workspace_write"],
		idempotent: true,
		status: "tested",
		requiredArgs: ["baselinePath", "outputPath", "seeds", "receipt", "claims"],
		parameterSchema: {
			type: "object",
			required: ["baselinePath", "outputPath", "seeds", "receipt", "claims"],
			properties: {
				baselinePath: { type: "string", description: "The SARIF log of a previous run." },
				outputPath: { type: "string", description: "Where to write the diffed SARIF log." },
				seeds: { type: "array", description: "The scan output: the seeds themselves, not an id list." },
				receipt: { type: "object", description: "The scan receipt the seeds are bound to." },
				claims: { type: "array", description: "One claim per candidate. A seed with no claim refuses the write." },
				toolVersion: { type: "string" },
			},
		},
		evidence: [{ kind: "artifact", description: "The diffed SARIF log, whose baselineState is the change report.", required: true }],
		validateArgs: (args) => {
			const value = args as unknown as DiffArgs;
			for (const field of ["baselinePath", "outputPath"] as const) {
				if (typeof value[field] !== "string" || value[field].trim() === "") return field + " must be a non-empty string";
			}
			if (!Array.isArray(value.seeds)) return "seeds must be an array";
			if (value.receipt === null || typeof value.receipt !== "object") return "receipt must be an object";
			if (!Array.isArray(value.claims)) return "claims must be an array";
			return undefined;
		},
		async execute(args, context): Promise<DiffSummary> {
			const value = args as unknown as DiffArgs;
			// Before anything is written. An artifact that lists findings while a seed it was supposed to
			// disposition has vanished is the false negative this vertical exists to prevent, so the write
			// does not happen rather than happening with a hole in it.
			const disposition = reconcileDispositions(value.seeds, value.receipt, value.claims);
			if (!disposition.ok) throw new Error(describeDispositionFailure(disposition));

			// And the receipt has to describe **this tree**. Binding the seeds to the receipt stopped a caller
			// shortening the list, but both were still inputs: a rewritten receipt made this capability write an
			// artifact asserting verification for a tree that produced a different seed set. So the scan is
			// re-derived from the receipt's own roots and must reproduce it. A reader trusting
			// dove/seedDigestVerified is then trusting the tree rather than a declaration about it.
			const catalog = parseCatalog(readFileSync(resolve(context.cwd, value.catalogPath ?? DEFAULT_CATALOG), "utf8"));
			const fresh = scanCategory({ catalog, category: value.receipt.category, roots: value.receipt.sourceRoots, scope: value.receipt.scope });
			// And the **rulebook** has to be the same one. The re-scan reads its catalog from a path resolved
			// against the caller's working directory, so the receipt and the fresh scan could disagree about what
			// was looked for while agreeing about what was found: a narrowed catalog over the same tree produced
			// one seed where the shipped one produces four, with `dove/seedDigestVerified: true`, and both receipts
			// reporting the same catalogVersion and language. The rulebook was named nowhere in the receipt or the
			// artifact, so the claim was unverifiable one level up from the seeds. Comparing the executed patterns
			// is what closes it; a catalog that changed between the scan and the write is caught the same way.
			const patterns = (receipt: CoverageReceipt): string => receipt.executedPatterns.map((entry) => entry.family + ":" + entry.pattern).sort().join("\n");
			if (patterns(fresh.receipt) !== patterns(value.receipt)) {
				throw new Error("the receipt was produced by a different catalog: the families or patterns this scan executed are not the ones it recorded");
			}

			if (fresh.receipt.seedSha256 !== value.receipt.seedSha256) {
				throw new Error("the receipt does not describe this tree: a fresh scan produced a different seed set");
			}
			const before = Object.keys(value.receipt.scannedFileSha256).sort();
			const after = Object.keys(fresh.receipt.scannedFileSha256).sort();
			if (before.join("\n") !== after.join("\n") || before.some((file) => fresh.receipt.scannedFileSha256[file] !== value.receipt.scannedFileSha256[file])) {
				throw new Error("the receipt does not describe this tree: the files it names are not the files this scan read");
			}
			const baselineText = readFileSync(resolve(context.cwd, value.baselinePath), "utf8");
			const baselineDigest = createHash("sha256").update(baselineText, "utf8").digest("hex");
			const baselineLog = JSON.parse(baselineText) as SarifLog;
			// The findings are **derived**, not read from a file.
			//
			// A supplied findings file was the last unbound link: the seeds were verified against the tree and the
			// claims against the seeds, but the results that reached the artifact came from a plain JSON file this
			// capability believed. A probe wrote an artifact carrying a correct seed digest and a finding for a file
			// that does not exist. The chain is tree -> seeds -> claims -> findings, and the fix is to close the last
			// link by construction rather than by a fourth check.
			//
			// Derived rather than read, and from the **re-derived** scan rather than the supplied seeds - they
			// have just been shown to agree, so this the provenance of every finding is the tree. The derivation
			// carries its own refusals; see src/code-audit/derive-findings.ts.
			const derived = deriveFindings(fresh.seeds, value.claims);
			const log = toSarifLog(derived.findings, {
				baseline: baselineOf(baselineLog),
				toolVersion: value.toolVersion ?? "0.3.0",
				// The seed universe travels with the artifact, so the closure claim can be checked by whoever
				// reads the report rather than only by whoever watched the run.
				runProperties: {
					"dove/seedCount": disposition.seedCount,
					"dove/seedSha256": value.receipt.seedSha256,
					"dove/seedDigestVerified": disposition.seedDigestVerified,
					"dove/claimCount": disposition.claimCount,
					// Counts alone cannot say whether the seeds missing from the results were filtered with a reason or
					// dropped. The breakdown comes from the reconciliation, which is the one traversal that knows what
					// a claim set holds.
					"dove/claimsByStatus": disposition.claimsByStatus,
					// Which baseline this was diffed against. It names the artifact so a reader can consult it, and
					// so a later swap of the baseline file is detectable. It cannot make the baseline true: the digest
					// is of whatever bytes were handed over, including a forged file. Naming is what it buys.
					"dove/baselineSha256": baselineDigest,
					// The rulebook this was scanned with, so a narrowed catalog is visible in the deliverable rather
					// than only in the receipt it was compared against.
					"dove/catalogSha256": createHash("sha256").update(patterns(value.receipt), "utf8").digest("hex"),
					// What tree the seeds cover. Without roots and a category, a reader cannot recompute seedSha256
					// or tell which tree the closure claim is about.
					"dove/sourceRoots": value.receipt.sourceRoots,
					"dove/category": value.receipt.category,
				},
			});
			// Written to a temporary file and renamed, rather than truncated in place: an interrupted write
			// would otherwise leave a half-written deliverable where a report used to be. The repository
			// already does this for its own settings file (src/pi-adapter/shell-config.ts).
			const target = resolve(context.cwd, value.outputPath);
			const temporary = target + ".partial";
			writeFileSync(temporary, JSON.stringify(log, null, 2) + "\n", "utf8");
			renameSync(temporary, target);
			return summarise(log);
		},
	},
];

export function registerCodeAuditCapabilities(registry: CapabilityRegistry): void {
	for (const capability of codeAuditCapabilities) registry.register(capability);
}
