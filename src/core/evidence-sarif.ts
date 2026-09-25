import { createHash } from "node:crypto";

/**
 * SARIF output for code-audit modes (design section 6).
 *
 * The audit vertical's control is **finding identity**, not a pre-action gate - findings are
 * reversible, so what matters is that two runs can be diffed. The SARIF schema makes that concrete:
 * `fingerprints`, `partialFingerprints`, `correlationGuid`, `baselineState`, `occurrenceCount`,
 * `rank` (all field descriptions verified verbatim from `sarif-schema.json`).
 *
 * The one rule that matters most, and the reason this is a module rather than an inline object:
 *
 * > **The fingerprint must exclude model prose.**
 *
 * A fingerprint derived from the finding's message varies between runs - an LLM restates the same
 * defect two ways - which makes `baselineState` meaningless and turns every re-run into a wall of
 * spurious "new" findings. The identity is therefore derived from the *stable* parts of a finding:
 * the artifact path, the category, and the matched code. This is the lesson recorded from the one
 * surveyed project that got it right, whose fingerprint is `sha256(Path|Category|ExistingCode)` with
 * the explicit comment *"not message.text, which is LLM prose that varies across runs"*.
 *
 * The key is **versioned** (`doveFinding/v1`). If the identity derivation ever changes, the version
 * changes with it, so an old baseline is not silently compared against new identities.
 */

/** The stable parts of a finding. The message is deliberately not part of the identity. */
export interface Finding {
	/** Repository-relative artifact path. */
	readonly path: string;
	/** Rule or category identity, e.g. `sql-injection`. */
	readonly category: string;
	/** The matched source text. Stable across runs; the message is not. */
	readonly existingCode: string;
	/** Human-readable description. Carried for the report, excluded from the fingerprint. */
	readonly message: string;
	readonly severity: "error" | "warning" | "note";
	readonly startLine?: number;
	readonly endLine?: number;
}

export const FINGERPRINT_KEY = "doveFinding/v1";

/** Identity from the stable parts only. Two runs that find the same defect agree; a reworded message does not change it. */
export function fingerprintOf(finding: Pick<Finding, "path" | "category" | "existingCode">): string {
	const material = [finding.path, finding.category, finding.existingCode].join("|");
	return createHash("sha256").update(material).digest("hex");
}

/** SARIF `rank` is -1.0..100.0, higher meaning more important. Derived from severity so it is not hand-set. */
function rankOf(severity: Finding["severity"]): number {
	if (severity === "error") return 80;
	if (severity === "warning") return 50;
	return 20;
}

export interface SarifRunOptions {
	readonly toolName?: string;
	readonly toolVersion: string;
	/** Fingerprints from a previous run. A finding present in it is `unchanged`, otherwise `new`. */
	readonly baseline?: ReadonlySet<string>;
}

export interface SarifLog {
	readonly $schema: string;
	readonly version: "2.1.0";
	readonly runs: readonly unknown[];
}

/**
 * Build one SARIF 2.1.0 log from a run's findings.
 *
 * Findings that share a fingerprint are collapsed into one result with an `occurrenceCount`, which is
 * what the schema means by "the number of times this logically unique result was observed in this
 * run".
 */
export function toSarifLog(findings: readonly Finding[], options: SarifRunOptions): SarifLog {
	const grouped = new Map<string, { readonly finding: Finding; count: number }>();
	for (const finding of findings) {
		const key = fingerprintOf(finding);
		const existing = grouped.get(key);
		if (existing === undefined) grouped.set(key, { finding, count: 1 });
		else grouped.set(key, { finding: existing.finding, count: existing.count + 1 });
	}

	const rules = new Map<string, string>();
	const results = [...grouped.entries()].map(([fingerprint, entry]) => {
		const { finding, count } = entry;
		rules.set(finding.category, finding.category);
		return {
			ruleId: finding.category,
			level: finding.severity,
			message: { text: finding.message },
			locations: [
				{
					physicalLocation: {
						artifactLocation: { uri: finding.path },
						...(finding.startLine === undefined
							? {}
							: { region: { startLine: finding.startLine, ...(finding.endLine === undefined ? {} : { endLine: finding.endLine }) } }),
					},
				},
			],
			partialFingerprints: { [FINGERPRINT_KEY]: fingerprint },
			// "The state of a result relative to a baseline of a previous run."
			baselineState: options.baseline === undefined ? "new" : options.baseline.has(fingerprint) ? "unchanged" : "new",
			occurrenceCount: count,
			rank: rankOf(finding.severity),
		};
	});

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
				results,
			},
		],
	};
}

/** The fingerprints in a log, for use as the next run's baseline. */
export function fingerprintsOf(log: SarifLog): ReadonlySet<string> {
	const results = (log.runs[0] as { results?: readonly { partialFingerprints?: Record<string, string> }[] } | undefined)?.results ?? [];
	const keys = results.map((result) => result.partialFingerprints?.[FINGERPRINT_KEY]).filter((key): key is string => typeof key === "string");
	return new Set(keys);
}
