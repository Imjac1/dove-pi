/**
 * The finding claim schema: what a finding must assert before it may be called confirmed.
 *
 * A scanner produces candidates; a candidate is not a finding. The gap between them is a set of
 * **named obligations**, and this module is where they are named. The reference implementation states
 * the reason better than a fresh argument could: a dangerous function name, a component version, a
 * comment, or a whitelist entry cannot confirm a vulnerability, because none of them is evidence that
 * the preconditions of that defect class actually hold.
 *
 * So a claim that says CONFIRMED for SQL_INJECTION must assert that SQL is executed, that the syntax
 * is influenced, that the source is controlled, and that parameterization is absent - four separate
 * statements, each of which can be wrong, and each of which a validator can check for presence.
 *
 * Two design rules carry over from the rest of the framework:
 *
 * - **Unknown fields are rejected.** A field nobody validates is a field a model can use to smuggle
 *   an assertion past the schema.
 * - **A placeholder is rejected.** The nine rule checks ask for explanations, and "done" is not one.
 */

import type { CoverageReceipt } from "./receipt.ts";
import { seedDigest, type SeedCandidate } from "./seed-scanner.ts";
/** The nine questions every verified candidate must answer, in order, each with a real explanation. */
export const RULE_CHECKS = [
	"sink_semantics",
	"entry_reachability",
	"source_controllability",
	"data_flow",
	"parameter_usage",
	"defense_effectiveness",
	"auth_boundary",
	"combination_chains",
	"category_requirements",
] as const;
export type RuleCheck = (typeof RULE_CHECKS)[number];

export const AUDIT_CATEGORIES = [
	"SQL_INJECTION", "COMMAND_EXEC", "CODE_EXEC", "FILE_INCLUSION", "FILE_UPLOAD", "FILE_READ",
	"SSRF", "XXE", "DESERIALIZATION", "TEMPLATE_INJECTION", "ZIP_EXTRACT",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/**
 * The proof obligations per category, required when a claim is CONFIRMED.
 *
 * These are the preconditions of the defect class itself, not a checklist about the code. A claim
 * that cannot fill all of them for its category is a HYPOTHESIS with named missing evidence, which is
 * a useful artifact, rather than a CONFIRMED finding that is not one.
 */
export const PROOF_FIELDS_BY_CATEGORY: Readonly<Record<AuditCategory, readonly string[]>> = {
	SQL_INJECTION: ["sql_executed", "syntax_influenced", "source_controlled", "parameterization_absent"],
	COMMAND_EXEC: ["process_started", "execution_semantics_controlled", "source_controlled", "defense_absent"],
	CODE_EXEC: ["execution_sink_reached", "executable_semantics_controlled", "dangerous_target_reachable", "defense_absent"],
	FILE_INCLUSION: ["consumer_reached", "path_controlled", "boundary_crossed", "defense_absent"],
	FILE_UPLOAD: ["content_controlled", "persisted", "extension_controlled", "script_extension_allowed", "web_accessible", "script_execution_mapped", "post_upload_url_known"],
	FILE_READ: ["read_sink_reached", "selection_controlled", "boundary_crossed", "content_disclosed"],
	SSRF: ["effective_url_fully_controlled", "scheme_controlled", "host_controlled", "port_controlled", "server_request_issued", "destination_defense_absent"],
	XXE: ["xml_controlled", "parser_reached", "external_resolution_enabled", "external_effect_possible"],
	DESERIALIZATION: ["payload_controlled", "deserializer_reached", "object_graph_or_type_controlled", "integrity_defense_absent"],
	TEMPLATE_INJECTION: ["template_source_controlled", "engine_reached", "expression_execution_possible", "sandbox_absent"],
	ZIP_EXTRACT: ["archive_controlled", "extraction_reached", "entry_path_controlled", "destination_boundary_crossed"],
};

export const CLAIM_STATUSES = ["CONFIRMED", "HYPOTHESIS", "FILTERED", "NOT_REACHABLE"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const POC_FORMATS = ["raw_http", "curl", "structured_request"] as const;

/**
 * A static record may only carry NOT_TESTED as its runtime status.
 *
 * The two state machines are separate, and the separation is the point: a runtime failure must never
 * delete or downgrade a statically well-evidenced conclusion, and a static record must never claim a
 * runtime result it did not get. Making this a type with one member is how that becomes unrepresentable
 * rather than merely discouraged.
 */
export type RuntimeStatus = "NOT_TESTED";

export interface CallChainNode {
	/** ROUTE at the entry, SINK at the end, PROPAGATION in between. */
	readonly kind: "ROUTE" | "PROPAGATION" | "DEFENSE" | "SINK";
	readonly location: string;
	readonly note: string;
}

export interface ProofOfConcept {
	readonly format: (typeof POC_FORMATS)[number];
	readonly request: string;
	readonly successIndicator: string;
}

export interface FindingClaim {
	readonly candidateId: string;
	readonly category: AuditCategory;
	readonly severity: Severity;
	readonly status: ClaimStatus;
	readonly ruleChecks: Readonly<Record<RuleCheck, string>>;
	readonly runtimeStatus: RuntimeStatus;
	readonly categoryProof?: Readonly<Record<string, string>>;
	readonly missingEvidence?: readonly string[];
	readonly rejectionReason?: string;
	readonly title?: string;
	readonly callChain?: readonly CallChainNode[];
	readonly impact?: string;
	readonly poc?: ProofOfConcept;
	readonly remediation?: string;
}

const CLAIM_FIELDS = new Set([
	"candidateId", "category", "severity", "status", "ruleChecks", "runtimeStatus",
	"categoryProof", "missingEvidence", "rejectionReason", "title", "callChain", "impact", "poc", "remediation",
]);

const MAX_LENGTH = 4000;

/**
 * Text that answers a question without answering it.
 *
 * The rule checks ask for an explanation of what was examined and what was found. These strings are how
 * a checklist gets ticked without the work being done, and the reference forbids exactly this: filling
 * in true, done, template sentences, or copying another candidate's conclusion is not allowed.
 */
const PLACEHOLDERS = new Set(["true", "false", "done", "n/a", "na", "none", "null", "nil", "ok", "yes", "no", "tbd", "todo", "-", "--", "?", "unknown", "see above", "as above", "same as above", "lgtm", "pass"]);

/** Short enough to be a tick rather than an explanation. Stated as a floor so it is testable. */
const MIN_EXPLANATION = 12;

function isBlank(value: unknown): boolean {
	return typeof value !== "string" || value.trim() === "";
}

function plainTextProblem(where: string, value: unknown): string | undefined {
	if (isBlank(value)) return where + " must be a non-empty string";
	const text = (value as string).trim();
	if (PLACEHOLDERS.has(text.toLowerCase())) return where + " is a placeholder ('" + text + "'), not an explanation";
	if (text.length < MIN_EXPLANATION) return where + " is too short to be an explanation (" + text.length + " characters, minimum " + MIN_EXPLANATION + ")";
	if (text.length > MAX_LENGTH) return where + " is longer than " + MAX_LENGTH + " characters";
	return undefined;
}

function unknownField(where: string, value: object, allowed: ReadonlySet<string>): string | undefined {
	const offender = Object.keys(value).find((key) => !allowed.has(key));
	return offender === undefined ? undefined : where + " declares unknown field '" + offender + "'";
}

/**
 * Validate one claim. Returns every problem found, so a broken claim is fixed once rather than
 * one error at a time.
 *
 * `knownCandidateIds` links a claim back to a seed. A claim about a candidate nobody produced is
 * either a mis-typed id or an invented finding, and both should stop the run.
 */
export function validateClaim(value: unknown, knownCandidateIds: ReadonlySet<string>): readonly string[] {
	const errors: string[] = [];
	if (typeof value !== "object" || value === null || Array.isArray(value)) return ["claim must be an object"];
	const claim = value as Record<string, unknown>;

	const unknown = unknownField("claim", claim, CLAIM_FIELDS);
	if (unknown !== undefined) errors.push(unknown);

	const candidateId = claim["candidateId"];
	if (isBlank(candidateId)) errors.push("claim candidateId must be a non-empty string");
	else if (!knownCandidateIds.has(candidateId as string)) errors.push("claim candidateId '" + String(candidateId) + "' does not correspond to any seed");

	const category = claim["category"];
	if (typeof category !== "string" || !(AUDIT_CATEGORIES as readonly string[]).includes(category)) errors.push("claim category is not a supported category: " + String(category));

	if (typeof claim["severity"] !== "string" || !(SEVERITIES as readonly string[]).includes(claim["severity"] as string)) errors.push("claim severity must be one of " + SEVERITIES.join(", "));

	const status = claim["status"];
	if (typeof status !== "string" || !(CLAIM_STATUSES as readonly string[]).includes(status)) errors.push("claim status must be one of " + CLAIM_STATUSES.join(", "));

	if (claim["runtimeStatus"] !== "NOT_TESTED") errors.push("a static claim must carry runtimeStatus NOT_TESTED; runtime results belong to a separate state machine");

	// The nine checks are a closed set: all nine present, none extra, each a real explanation.
	const checks = claim["ruleChecks"];
	if (typeof checks !== "object" || checks === null || Array.isArray(checks)) {
		errors.push("claim ruleChecks must be an object with all " + RULE_CHECKS.length + " checks");
	} else {
		const record = checks as Record<string, unknown>;
		const missing = RULE_CHECKS.filter((check) => !(check in record));
		const extra = Object.keys(record).filter((key) => !(RULE_CHECKS as readonly string[]).includes(key));
		if (missing.length > 0) errors.push("claim ruleChecks is missing: " + missing.join(", "));
		if (extra.length > 0) errors.push("claim ruleChecks has unknown checks: " + extra.join(", "));
		for (const check of RULE_CHECKS) {
			if (!(check in record)) continue;
			const problem = plainTextProblem("claim ruleChecks." + check, record[check]);
			if (problem !== undefined) errors.push(problem);
		}
	}

	// Status-specific obligations.
	if (status === "CONFIRMED") {
		const supported = typeof category === "string" ? (PROOF_FIELDS_BY_CATEGORY as Record<string, readonly string[]>)[category] : undefined;
		if (supported === undefined) {
			errors.push("CONFIRMED category is not supported by the category_proof contract: " + String(category));
		} else {
			const proof = claim["categoryProof"];
			if (typeof proof !== "object" || proof === null || Array.isArray(proof)) {
				errors.push("a CONFIRMED claim must carry a categoryProof object; without it the claim asserts a category rather than its preconditions");
			} else {
				const proofRecord = proof as Record<string, unknown>;
				for (const field of supported) {
					if (!(field in proofRecord)) { errors.push("categoryProof for " + String(category) + " is missing '" + field + "'"); continue; }
					const problem = plainTextProblem("categoryProof." + field, proofRecord[field]);
					if (problem !== undefined) errors.push(problem);
				}
				const extraProof = Object.keys(proofRecord).filter((key) => !supported.includes(key));
				if (extraProof.length > 0) errors.push("categoryProof declares fields that are not obligations for " + String(category) + ": " + extraProof.join(", "));
			}
		}
		if (isBlank(claim["title"])) errors.push("a CONFIRMED claim must carry a title");
		if (isBlank(claim["impact"])) errors.push("a CONFIRMED claim must carry an impact");
		if (isBlank(claim["remediation"])) errors.push("a CONFIRMED claim must carry a remediation");
		errors.push(...validateCallChain(claim["callChain"]));
		errors.push(...validatePoc(claim["poc"]));
	}

	if (status === "HYPOTHESIS") {
		const missing = claim["missingEvidence"];
		if (!Array.isArray(missing) || missing.length === 0) errors.push("a HYPOTHESIS must name the missing evidence; that list is the whole value of the record");
		else for (const [index, item] of missing.entries()) {
			const problem = plainTextProblem("missingEvidence[" + index + "]", item);
			if (problem !== undefined) errors.push(problem);
		}
	}

	if (status === "FILTERED" || status === "NOT_REACHABLE") {
		const problem = plainTextProblem("rejectionReason", claim["rejectionReason"]);
		if (problem !== undefined) errors.push("a " + status + " claim must explain why: " + problem);
	}

	return errors;
}

/**
 * A CONFIRMED call chain runs from a route to a sink.
 *
 * Both ends are required because each is a way the claim can be wrong: a sink with no reachable entry
 * is NOT_REACHABLE, and an entry that never reaches a dangerous operation is not a vulnerability. A
 * chain with a missing edge is a HYPOTHESIS, which is what the requirement is there to force.
 */
function validateCallChain(value: unknown): readonly string[] {
	if (!Array.isArray(value) || value.length < 2) return ["a CONFIRMED claim must carry a call chain with at least an entry and a sink"];
	const nodes = value as Record<string, unknown>[];
	const errors: string[] = [];
	for (const [index, node] of nodes.entries()) {
		if (typeof node !== "object" || node === null) { errors.push("callChain[" + index + "] must be an object"); continue; }
		if (typeof node["kind"] !== "string" || !["ROUTE", "PROPAGATION", "DEFENSE", "SINK"].includes(node["kind"] as string)) errors.push("callChain[" + index + "].kind must be ROUTE, PROPAGATION, DEFENSE or SINK");
		if (isBlank(node["location"])) errors.push("callChain[" + index + "] must name a real location");
		const note = plainTextProblem("callChain[" + index + "].note", node["note"]);
		if (note !== undefined) errors.push(note);
	}
	const first = nodes[0]?.["kind"];
	const last = nodes[nodes.length - 1]?.["kind"];
	if (first !== "ROUTE") errors.push("a call chain must start at a ROUTE, not at " + String(first));
	if (last !== "SINK") errors.push("a call chain must end at a SINK, not at " + String(last));
	return errors;
}

/**
 * A proof of concept has to be something a reader could run, and it has to say what success looks
 * like. A request with no success indicator cannot distinguish a vulnerability from a 404.
 */
function validatePoc(value: unknown): readonly string[] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return ["a CONFIRMED claim must carry a proof of concept"];
	const poc = value as Record<string, unknown>;
	const errors: string[] = [];
	if (typeof poc["format"] !== "string" || !(POC_FORMATS as readonly string[]).includes(poc["format"] as string)) errors.push("poc.format must be one of " + POC_FORMATS.join(", "));
	const request = plainTextProblem("poc.request", poc["request"]);
	if (request !== undefined) errors.push(request);
	const indicator = plainTextProblem("poc.successIndicator", poc["successIndicator"]);
	if (indicator !== undefined) errors.push(indicator);
	return errors;
}

/**
 * Values repeated verbatim across candidates for the same check.
 *
 * One explanation cannot be true of two different sinks, so a repeated value means the field was
 * filled in rather than answered. Reported rather than fatal, because two candidates in one file can
 * legitimately share a short answer, and a reader should decide.
 */
export function findRepeatedExplanations(claims: readonly FindingClaim[]): readonly string[] {
	const seen = new Map<string, string>();
	const repeated: string[] = [];
	for (const claim of claims) {
		// A checker must not crash on the malformed input it exists to report. This assumed ruleChecks was
		// present, and the reconciliation passes on any claim whose id is readable - so an incomplete claim
		// threw here while the validator was describing what was wrong with it. A test caught it.
		const checks = (claim as { ruleChecks?: unknown } | null | undefined)?.ruleChecks;
		if (typeof checks !== "object" || checks === null || Array.isArray(checks)) continue;
		for (const check of RULE_CHECKS) {
			const value = (checks as Record<string, unknown>)[check];
			if (typeof value !== "string") continue;
			const key = check + String.fromCharCode(0) + value.trim().toLowerCase();
			const owner = seen.get(key);
			if (owner === undefined) { seen.set(key, claim.candidateId); continue; }
			repeated.push("candidate " + claim.candidateId + " repeats " + owner + "'s " + check + " explanation verbatim");
		}
	}
	return repeated;
}

/**
 * Seeds that no claim mentions.
 *
 * Non-deletability is only real if something checks it. A seed with no claim is a candidate that
 * vanished between the scan and the report, which is the false negative this whole arrangement exists
 * to prevent: the cost of a candidate is one verification pass, while the cost of a missed sink is a
 * missed vulnerability.
 *
 * A seed may be dispositioned as CONFIRMED, HYPOTHESIS, FILTERED or NOT_REACHABLE. What it may not do
 * is go unmentioned - which is why this returns the ids rather than a boolean, so a reader can see
 * exactly what was dropped.
 *
 * It takes the claimed ids rather than whole claims so it can be used before the claims have been
 * validated, and against partially-formed ones: a seed that is missing from a malformed claim set is
 * still missing, and reporting that is more useful than refusing to look.
 */
export function findUndispositionedSeeds(seedCandidateIds: readonly string[], claimedCandidateIds: readonly string[]): readonly string[] {
	const claimed = new Set(claimedCandidateIds);
	return seedCandidateIds.filter((id) => !claimed.has(id)).sort();
}

export interface DispositionReport {
	readonly ok: boolean;
	readonly seedCount: number;
	readonly claimCount: number;
	/** Whether the seeds matched the receipt the scan produced. **/
	readonly seedDigestVerified: boolean;
	/**
	 * The seeds did not match the receipt.
	 *
	 * Its own field rather than another claim error: reporting a seed-set mismatch as a claim problem
	 * tells a reader the wrong thing is broken, and it produced a line per claim for one mismatch.
	 */
	readonly seedDigestMismatch: string | undefined;
	readonly claimErrors: readonly string[];
	readonly undispositioned: readonly string[];
	readonly repeatedExplanations: readonly string[];
	/**
	 * How many claims carried each status. Counted here rather than in the writer, because this is the one
	 * traversal that knows which claims are well formed and which ids they bind to; a second count in the
	 * writer walked the raw caller input independently, which is two places deciding what a claim set holds.
	 */
	readonly claimsByStatus: Readonly<Record<string, number>>;
}

/**
 * Reconcile the seeds a scan produced with the claims a verification stage wrote.
 *
 * This is the vertical's closure rule, in one place so every caller enforces the same thing: a seed
 * with no disposition is a candidate that vanished, and losing a candidate is the false negative the
 * non-deletability rule exists to prevent. A seed may be CONFIRMED, HYPOTHESIS, FILTERED or
 * NOT_REACHABLE; what it may not do is go unmentioned.
 *
 * ## Why the ids are not an argument
 *
 * The first version took a list of seed ids from the caller. That made the check's ground truth
 * something the checked party supplies, and a scan that produced four seeds passed it by reporting
 * none: dropping seeds - the exact act the rule exists to prevent - was satisfiable. A review found
 * it by doing precisely that.
 *
 * So the ids are **derived here** from the seeds, and the seeds are bound to the receipt the scan
 * produced by comparing {@link seedDigest} with `receipt.seedSha256`. A caller can no longer hand in a
 * shorter list than the scan found, because the digest would not match and the report fails. That is a
 * structural property rather than a hopeful one.
 *
 * What it does not prove: that the receipt came from a real scan of the tree in question. That is the
 * receipt's own claim and it is checked where the receipt is checked - coverage, families, file hashes.
 * This function's job is narrower and it is the one that was missing: the seeds and the receipt agree,
 * and every seed they describe is dispositioned.
 *
 * It returns the report rather than throwing, because a caller decides what an incomplete disposition
 * means. The artifact-writing capability treats it as fatal; the named check capability exposes it.
 */
export function reconcileDispositions(
	seeds: readonly SeedCandidate[],
	receipt: CoverageReceipt,
	claims: readonly unknown[],
): DispositionReport {
	// Not a warning and not a repaired value: a seed set that does not match its receipt is not the set
	// the scan produced, and treating its ids as authoritative is the defect this replaced.
	const seedDigestVerified = seedDigest(seeds) === receipt.seedSha256;
	const seedIds = seedDigestVerified ? seeds.map((seed) => seed.candidateId) : [];
	const known = new Set(seedIds);
	const claimErrors: string[] = [];
	const claimedIds: string[] = [];
	const wellFormed: FindingClaim[] = [];
	const claimsByStatus: Record<string, number> = {};
	const seen = new Map<string, number>();
	for (const [index, claim] of claims.entries()) {
		// Only when the seed set is trustworthy. With a failed digest `known` is empty, so every claim would
		// be reported as referencing a seed that does not exist - one line per claim, for one mismatch, and a
		// consumer keying off claimErrors would read them as claim problems. The mismatch is the finding.
		if (seedDigestVerified) for (const problem of validateClaim(claim, known)) claimErrors.push("claims[" + index + "]: " + problem);
		const entry = claim as { candidateId?: unknown; status?: unknown } | null | undefined;
		if (typeof entry?.status === "string") claimsByStatus[entry.status] = (claimsByStatus[entry.status] ?? 0) + 1;
		const id = entry?.candidateId;
		if (typeof id !== "string") continue;
		// **One claim per candidate.** `findUndispositionedSeeds` only checks the superset direction, so a
		// duplicate was accepted: four seeds with one candidate claimed twice produced six claims, six results
		// and a breakdown that could not distinguish four dispositions from two done twice. A count is not a
		// closure claim unless the multiplicity is one, and the refusal belongs in the same walk as the count.
		const previous = seen.get(id);
		if (previous !== undefined) {
			claimErrors.push("candidate " + id + " is claimed twice, at claims[" + previous + "] and claims[" + index + "]");
			continue;
		}
		seen.set(id, index);
		claimedIds.push(id);
		wellFormed.push(claim as FindingClaim);
	}
	const undispositioned = seedDigestVerified ? findUndispositionedSeeds(seedIds, claimedIds) : [];
	return {
		ok: seedDigestVerified && claimErrors.length === 0 && undispositioned.length === 0,
		seedCount: seeds.length,
		claimCount: claims.length,
		seedDigestVerified,
		seedDigestMismatch: seedDigestVerified ? undefined : "the seeds do not match the receipt the scan produced",
		claimErrors,
		undispositioned,
		repeatedExplanations: findRepeatedExplanations(wellFormed),
		claimsByStatus,
	};
}

/** The failure message both callers raise, so an incomplete disposition reads the same everywhere. */
export function describeDispositionFailure(report: DispositionReport): string {
	const parts: string[] = [];
	// The seed-set mismatch leads, because a reader told that the seeds are wrong should not first be told
	// that the claims are.
	if (report.seedDigestMismatch !== undefined) parts.push(report.seedDigestMismatch);
	if (report.undispositioned.length > 0) {
		const named = report.undispositioned.slice(0, 5).join(", ");
		const more = report.undispositioned.length > 5 ? ", ..." : "";
		parts.push(report.undispositioned.length + " seed(s) with no disposition: " + named + more);
	}
	if (report.claimErrors.length > 0) parts.push(report.claimErrors.length + " claim error(s): " + report.claimErrors.slice(0, 3).join("; "));
	return "disposition incomplete: " + parts.join("; ");
}
