import { createHash } from "node:crypto";

/**
 * SARIF output for code-audit modes (design section 6), and the finding-identity contract.
 *
 * The audit vertical's control is **finding identity**, not a pre-action gate - findings are
 * reversible, so what matters is that two runs can be diffed. The SARIF schema makes that concrete:
 * fingerprints, partialFingerprints, correlationGuid, baselineState, occurrenceCount, and rank, all
 * field descriptions verified verbatim from sarif-schema.json.
 *
 * The rule that matters most, and the reason this is a module rather than an inline object:
 *
 * > **The fingerprint must exclude model prose.**
 *
 * A fingerprint derived from the message varies between runs - a model restates the same defect two
 * ways - which makes baselineState meaningless and turns every re-run into a wall of spurious new
 * findings.
 *
 * ## Two hashes, not one
 *
 * A single hash over path | category | code cannot tell a move from an edit, because the path is in
 * it. Semgrep's code_hash docstring states the reason it keeps a content-only hash as well:
 *
 * > By sending the hash of **ONLY the code contents**, we can determine whether a finding **has
 * > moved files (path changed)**, or **moved down a file (index changed)** and handle that logic in
 * > the app.
 *
 * So this module emits both:
 *
 * - contentHashOf - sha256(category | normalizedCode), **path-free**, which is what makes a move
 *   observable as a move. github/codeql-action/src/fingerprints.ts hashes content only for the same
 *   reason: no path, no rule id, no message.
 * - fingerprintOf - the same content plus an occurrence index. Without the index, two findings of
 *   one category on identical matched code **in one file** collapse into one and a real defect is
 *   lost. GitHub emits hash:occurrenceIndex; Semgrep puts index inside syntactic_id; SARIF itself
 *   defines occurrenceCount.
 *
 * ## Versioned keys
 *
 * Both keys are versioned. The derivation changed from v1 to v2 - v1 put the path in the
 * fingerprint, so a moved finding read as a new one - and the version change is how that becomes
 * visible instead of silently producing a wall of new findings on every re-run.
 */

/** The stable parts of a finding. The message is deliberately not part of the identity. */
export interface Finding {
	/** Repository-relative artifact path. */
	readonly path: string;
	/** Rule or category identity, e.g. sql-injection. */
	readonly category: string;
	/** The matched source text. Stable across runs; the message is not. */
	readonly existingCode: string;
	/** Human-readable description. Carried for the report, excluded from the fingerprint. */
	readonly message: string;
	readonly severity: "error" | "warning" | "note";
	readonly startLine?: number;
	readonly endLine?: number;
	/**
	 * Provenance the finding carries onto its result, alongside the framework's own keys.
	 *
	 * SARIF's level has three values and an audit has four severities, so a producer that maps onto it
	 * necessarily collapses one distinction. This is where the collapse is undone: the result keeps the
	 * producer's own vocabulary as a property rather than losing it. `dove/movedFrom` already uses the same
	 * mechanism for the same reason.
	 */
	readonly properties?: Readonly<Record<string, unknown>>;
}

export const FINGERPRINT_KEY = "doveFinding/v2";
export const CONTENT_HASH_KEY = "doveContent/v2";

/**
 * Collapse whitespace runs and trim, so reindentation does not read as an edit.
 *
 * Line numbers are deliberately not part of the identity: a finding that moved down a file because
 * code was inserted above it is the same finding. That is the same choice the SARIF SDK makes - its
 * contextRegionHash is a hash of the snippet text with no position in it.
 */
function normalizeCode(code: string): string {
	return code.replace(/\s+/g, " ").trim();
}

/** The separator between identity components. NUL cannot appear in a path or in matched source. */
const SEP = String.fromCharCode(0);

/**
 * Path-free content hash. Two findings with the same category and matched code agree **wherever they
 * live**, which is exactly what lets the baseline match in toSarifLog recognise a move.
 */
export function contentHashOf(finding: Pick<Finding, "category" | "existingCode">): string {
	return createHash("sha256").update([finding.category, normalizeCode(finding.existingCode)].join("|")).digest("hex");
}

/**
 * The disambiguated identity: content plus an occurrence index.
 *
 * occurrenceIndex counts how many earlier findings in this run share the same (category,
 * normalizedCode), in the deterministic order orderFindings imposes. Two identical matches in one
 * file therefore get different identities - and so do identical matches in two different files,
 * because the counter is over the whole run rather than per file.
 *
 * The path is **not** an input. That is the fix: a finding that moves keeps its identity. If a move
 * does shift the index, the content hash still matches it, and the baseline match records the move
 * rather than reporting a new finding.
 */
export function fingerprintOf(finding: Pick<Finding, "category" | "existingCode">, occurrenceIndex = 0): string {
	return createHash("sha256").update([finding.category, normalizeCode(finding.existingCode), String(occurrenceIndex)].join("|")).digest("hex");
}

/**
 * The order occurrence indices are counted in: path, then start line, then end line.
 *
 * Deterministic so two runs over the same tree agree, and stable under an unrelated insertion
 * because the key does not depend on how many findings come before it.
 */
function orderFindings(findings: readonly Finding[]): readonly Finding[] {
	return [...findings].sort(
		(left, right) =>
			left.path.localeCompare(right.path) ||
			(left.startLine ?? 0) - (right.startLine ?? 0) ||
			(left.endLine ?? 0) - (right.endLine ?? 0),
	);
}

/** SARIF rank is -1.0..100.0, higher meaning more important. Derived from severity so it is not hand-set. */
function rankOf(severity: Finding["severity"]): number {
	if (severity === "error") return 80;
	if (severity === "warning") return 50;
	return 20;
}

/** SARIF's baselineState enum, which is exactly these four values. */
export type BaselineState = "new" | "unchanged" | "updated" | "absent";

/** One entry of a previous run, kept whole so an absent result can still be emitted from it. */
export interface BaselineEntry {
	readonly fingerprint: string;
	readonly contentHash: string;
	readonly path: string;
	readonly category: string;
	readonly finding: Finding;
}

export interface SarifBaseline {
	readonly entries: readonly BaselineEntry[];
}

export interface SarifRunOptions {
	readonly toolName?: string;
	readonly toolVersion: string;
	/**
	 * A previous run's identities. Matching is tiered and deterministic - see toSarifLog. A plain
	 * fingerprint set is not enough: recognising a move needs the content hash and the path separately.
	 */
	readonly baseline?: SarifBaseline;
	/**
	 * Run-level properties, carried verbatim onto the SARIF run.
	 *
	 * Used to record the seed universe - how many candidates the scan produced and their digest - so that
	 * "no seed disappeared" is auditable from the artifact a reader keeps, not only true of the process
	 * that produced it. On a first run there is no baseline, so absent-state results cannot carry it.
	 */
	readonly runProperties?: Readonly<Record<string, unknown>>;
}

export interface SarifLog {
	readonly $schema: string;
	readonly version: "2.1.0";
	readonly runs: readonly unknown[];
}

/**
 * The shape this module emits. Exported so a consumer reads the contract from where it is defined
 * rather than re-declaring a staler copy - a second declaration of one contract is how a consumer kept
 * reading `locations[0]` after `locations` became optional for absent rows, and threw after the artifact
 * had already been written.
 */
export interface ResultShape {
	readonly ruleId: string;
	readonly level: Finding["severity"];
	readonly message: { readonly text: string };
	/** **Optional**, because an absent result carries identity and nothing else. A consumer that reads this without checking is a bug. */
	readonly locations?: readonly unknown[];
	readonly partialFingerprints: Record<string, string>;
	readonly baselineState: BaselineState;
	readonly occurrenceCount: number;
	readonly rank: number;
	readonly properties?: Record<string, unknown>;
}

/** The location clause of a result, or an empty object when a finding carries no line. */
function locationOf(path: string, startLine: number | undefined, endLine: number | undefined): readonly unknown[] {
	return [
		{
			physicalLocation: {
				artifactLocation: { uri: path },
				...(startLine === undefined ? {} : { region: { startLine, ...(endLine === undefined ? {} : { endLine }) } }),
			},
		},
	];
}
/** One decision per identity, so the two passes cannot disagree about a finding. */
interface Match {
	readonly state: BaselineState;
	readonly properties?: Record<string, unknown>;
}
/**
 * Build one SARIF 2.1.0 log from a run's findings.
 *
 * Findings that share a fingerprint are collapsed into one result with an occurrenceCount, which is
 * what the schema means by "the number of times this logically unique result was observed in this
 * run". Because fingerprintOf already carries the occurrence index, two genuinely distinct findings
 * never share a fingerprint; occurrenceCount counts literal repeats.
 *
 * ## Tiered baseline matching
 *
 * Each tier is a cheap deterministic rule; **no model call decides identity**. Matching runs in two
 * passes, and pass one completes for the whole run before pass two begins.
 *
 * Pass one, every same-path case:
 *
 * 1. a baseline entry with the same content hash at the **same** path is this finding, whatever its
 *    occurrence index -> unchanged
 * 2. the same (category, path) with different content -> updated: the code changed where it was
 *
 * Pass two, for what is left, which is no longer where it was:
 *
 * 3. exact fingerprint anywhere in the baseline -> unchanged, and a differing path records the move
 * 4. the same content hash at a different path -> unchanged, with the move recorded in properties
 *
 * Then:
 *
 * 5. a baseline entry matched by no tier -> absent, emitted so a consumer sees the resolution
 * 6. a finding matched by no baseline entry -> new
 *
 * ## A limit this deliberately accepts
 *
 * A finding that moves **and** is edited in the same run reads as one new plus one absent, not as an
 * update at a new location. A content-only identity cannot tell "changed and went elsewhere" from
 * "deleted, and something else appeared", and from two runs alone those are the same observation.
 * Resolving it would need a similarity match, which trades a false new for a false match - and a false
 * match can suppress a real finding, which is the worse error in an audit. The limit is the price of
 * move detection and is asserted in the tests so it cannot be mistaken for a defect later.
 *
 * The split is not a performance choice. A content-derived identity cannot tell two identical matches
 * apart, so a tier that matches across paths will take an entry belonging to a finding still sitting
 * where it was. A newly added copy then reads as a move while the original reads as new; and an
 * in-place edit whose new code happens to exist in another file is narrated as a move from that file,
 * which also leaves the finding that was truly deleted with no result of its own. Locality is the
 * evidence that settles it, so same-path cases are decided first.
 *
 * Every tier resolves ties by the same deterministic order (orderFindings), so two runs agree.
 */
export function toSarifLog(findings: readonly Finding[], options: SarifRunOptions): SarifLog {
	const ordered = orderFindings(findings);
	const counts = new Map<string, number>();
	const current: { readonly finding: Finding; readonly fingerprint: string; readonly contentHash: string }[] = [];
	for (const finding of ordered) {
		const groupKey = finding.category + SEP + normalizeCode(finding.existingCode);
		const occurrenceIndex = counts.get(groupKey) ?? 0;
		counts.set(groupKey, occurrenceIndex + 1);
		current.push({ finding, fingerprint: fingerprintOf(finding, occurrenceIndex), contentHash: contentHashOf(finding) });
	}

	// Group literal repeats of one identity into a single result.
	const grouped = new Map<string, { readonly entry: (typeof current)[number]; count: number }>();
	for (const entry of current) {
		const existing = grouped.get(entry.fingerprint);
		if (existing === undefined) grouped.set(entry.fingerprint, { entry, count: 1 });
		else grouped.set(entry.fingerprint, { entry: existing.entry, count: existing.count + 1 });
	}

	const baseline = options.baseline?.entries ?? [];
	const consumed = new Set<number>();
	const byFingerprint = new Map<string, number>();
	const byContent = new Map<string, number[]>();
	// The content and category tiers keep **all** the baseline indices they could match, not just the
	// first: a file with several baseline findings would otherwise have only one of them reachable, and
	// the rest would fall through to absent while their current counterparts were reported new. The
	// fingerprint tier below is first-only, which is safe rather than an oversight - a baseline derived by
	// baselineOf cannot hold two entries with the same fingerprint, because toSarifLog groups by
	// fingerprint before emitting. That is stated because this comment used to claim the property of all
	// of them, and a comment asserting what the code does not do is how this task produced three defects.
	const byCategoryPath = new Map<string, number[]>();
	/** The same content at the same path: the strongest evidence that this is that baseline entry. */
	const byPathContent = new Map<string, number[]>();
	const add = (map: Map<string, number[]>, key: string, index: number): void => {
		const found = map.get(key) ?? [];
		found.push(index);
		map.set(key, found);
	};
	baseline.forEach((entry, index) => {
		if (!byFingerprint.has(entry.fingerprint)) byFingerprint.set(entry.fingerprint, index);
		add(byContent, entry.contentHash, index);
		add(byCategoryPath, entry.category + SEP + entry.path, index);
		add(byPathContent, entry.path + SEP + entry.contentHash, index);
	});
	/** Lowest unconsumed index in a candidate list, so two runs always pick the same one. */
	const takeLowest = (candidates: readonly number[] | undefined): number | undefined => {
		if (candidates === undefined) return undefined;
		for (const index of [...candidates].sort((a, b) => a - b)) if (!consumed.has(index)) return index;
		return undefined;
	};

	const matched = new Map<string, Match>();
	if (options.baseline !== undefined) {
		// Pass one resolves **every same-path decision** before any cross-path tier runs. It has to finish
		// for the whole run first, for two reasons that pull the same way. A finding still where it was,
		// with the same matched code, is that baseline entry even when its occurrence index moved. And a
		// finding whose code changed where it already was is an edit, not a move: deciding that after the
		// cross-path tiers lets a coincidental content match elsewhere narrate an in-place edit as a move
		// from another file, and leaves the finding that was actually deleted with no result of its own.
		for (const [fingerprint, group] of grouped) {
			const { finding, contentHash } = group.entry;
			const local = takeLowest(byPathContent.get(finding.path + SEP + contentHash));
			if (local === undefined) continue;
			consumed.add(local);
			matched.set(fingerprint, { state: "unchanged" });
		}
		// Same category, same path, different code: the code changed here. This tier belongs to pass one
		// for the reason above - without it a cross-path content match can claim the entry first.
		for (const [fingerprint, group] of grouped) {
			if (matched.has(fingerprint)) continue;
			const { finding } = group.entry;
			const edited = takeLowest(byCategoryPath.get(finding.category + SEP + finding.path));
			if (edited === undefined) continue;
			consumed.add(edited);
			matched.set(fingerprint, { state: "updated" });
		}
		// Pass two: what is left is no longer where it was, so a differing path means it moved, and the
		// move is recorded rather than left for a reader to infer by comparing two runs.
		for (const [fingerprint, group] of grouped) {
			if (matched.has(fingerprint)) continue;
			const { finding, contentHash } = group.entry;
			const exact = byFingerprint.get(fingerprint);
			if (exact !== undefined && !consumed.has(exact)) {
				consumed.add(exact);
				matched.set(fingerprint, moved("unchanged", baseline[exact]?.path, finding.path));
				continue;
			}
			const sameContent = takeLowest(byContent.get(contentHash));
			if (sameContent !== undefined) {
				consumed.add(sameContent);
				matched.set(fingerprint, moved("unchanged", baseline[sameContent]?.path, finding.path));
			}
		}
	}

	const rules = new Map<string, string>();
	const results: ResultShape[] = [];
	for (const [fingerprint, group] of grouped) {
		const { finding, contentHash } = group.entry;
		rules.set(finding.category, finding.category);
		const match = matched.get(fingerprint);
		results.push({
			ruleId: finding.category,
			level: finding.severity,
			message: { text: finding.message },
			locations: locationOf(finding.path, finding.startLine, finding.endLine),
			partialFingerprints: { [FINGERPRINT_KEY]: fingerprint, [CONTENT_HASH_KEY]: contentHash },
			baselineState: match?.state ?? "new",
			occurrenceCount: group.count,
			rank: rankOf(finding.severity),
			// The finding's own provenance and the match's, merged. Neither may silently win: a finding that
			// carries a severity and also moved needs both on the result.
			...(finding.properties === undefined && match?.properties === undefined
				? {}
				: { properties: { ...(finding.properties ?? {}), ...(match?.properties ?? {}) } }),
		});
	}

	// A baseline entry no tier matched is absent: present last run, gone this run. Emitting it is what
	// stops a deletion from reading as silence, and it is one of the four values the schema defines.
	//
	// **Emitted from identity alone.** The first version copied the baseline entry's location, level and
	// message into the result, which put caller-supplied content into the deliverable: a hand-written
	// baseline carrying a result that matched nothing produced an absent row naming a file the scan never
	// read, with the caller's prose in it - the same signature as a findings file being believed. An absent
	// row is a statement about the baseline, so it repeats the baseline's identity and nothing else. Every
	// location in this log therefore comes from the scan, and a reader who wants the baseline's own claims
	// for that identity has the baseline artifact, which run properties name by digest.
	for (const [index, entry] of baseline.entries()) {
		if (consumed.has(index)) continue;
		rules.set(entry.category, entry.category);
		results.push({
			ruleId: entry.category,
			level: "note",
			message: { text: "Absent: identity " + entry.fingerprint.slice(0, 12) + " was in the baseline for this category and is not in this run." },
			partialFingerprints: { [FINGERPRINT_KEY]: entry.fingerprint, [CONTENT_HASH_KEY]: entry.contentHash },
			baselineState: "absent",
			occurrenceCount: 1,
			rank: rankOf("note"),
		});
	}

	return {

		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: options.toolName ?? "dove-pi",
						version: options.toolVersion,
						rules: [...rules.values()].map((id) => ({ id })),
					},
				},
				...(options.runProperties === undefined ? {} : { properties: options.runProperties }),
				results,
			},
		],
	};
}

/** The fingerprints in a log, for a cheap identity comparison. */
export function fingerprintsOf(log: SarifLog): ReadonlySet<string> {
	const results = resultsOf(log);
	const keys = results.map((result) => result.partialFingerprints?.[FINGERPRINT_KEY]).filter((key): key is string => typeof key === "string");
	return new Set(keys);
}

function resultsOf(log: SarifLog): readonly ResultShape[] {
	return (log.runs[0] as { results?: readonly ResultShape[] } | undefined)?.results ?? [];
}

/**
 * The baseline to pass to the next run's toSarifLog.
 *
 * Everything is recovered from the log itself, so a baseline stays a pure derivative of a previous
 * SARIF output and needs no side channel. Absent results are skipped: a finding that was already
 * absent last run must not be carried forward and re-reported as newly absent every run after.
 */
export function baselineOf(log: SarifLog): SarifBaseline {
	const results = resultsOf(log);
	const entries: BaselineEntry[] = [];
	const unrecognised = new Set<string>();
	for (const result of results) {
		if (result.baselineState === "absent") continue;
		// A baseline written by another key version yields no entries, and every finding then reads `new` -
		// the silent wall of new findings the versioned key exists to prevent, arrived at silently. The
		// first version of this `continue`d, so a v1 baseline produced exactly that. A file we cannot read is
		// refused by name rather than treated as empty.
		for (const key of Object.keys(result.partialFingerprints ?? {})) if (key !== FINGERPRINT_KEY && key !== CONTENT_HASH_KEY) unrecognised.add(key);
		const fingerprint = result.partialFingerprints?.[FINGERPRINT_KEY];
		const contentHash = result.partialFingerprints?.[CONTENT_HASH_KEY];
		if (typeof fingerprint !== "string" || typeof contentHash !== "string") continue;
		// An absent result has no location, and it is skipped above anyway - but the type now allows it, so
		// the lookup has to as well.
		const location = (result.locations?.[0] as { physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number; endLine?: number } } } | undefined)?.physicalLocation;
		const path = location?.artifactLocation?.uri;
		if (typeof path !== "string") continue;
		const region = location?.region;
		entries.push({
			fingerprint,
			contentHash,
			path,
			category: result.ruleId,
			finding: {
				path,
				category: result.ruleId,
				existingCode: "",
				message: result.message.text,
				severity: result.level,
				...(region?.startLine === undefined ? {} : { startLine: region.startLine }),
				...(region?.endLine === undefined ? {} : { endLine: region.endLine }),
			},
		});
	}
	// A file we cannot read is refused by name, not treated as empty.
	if (entries.length === 0 && unrecognised.size > 0) {
		throw new Error(
			"the baseline carries no fingerprint this version understands: it uses " +
				[...unrecognised].sort().join(", ") +
				", and this version reads " +
				FINGERPRINT_KEY +
				" and " +
				CONTENT_HASH_KEY +
				". Every finding would read new against it, which is not a diff.",
		);
	}
	return { entries };
}

/** An unchanged match, carrying the previous path when the finding is no longer where it was. */
function moved(state: BaselineState, previousPath: string | undefined, path: string): { readonly state: BaselineState; readonly properties?: Record<string, unknown> } {
	if (previousPath === undefined || previousPath === path) return { state };
	return { state, properties: { "dove/movedFrom": previousPath } };
}