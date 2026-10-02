/**
 * The authority grant graph (design section 3.5).
 *
 * No standard defines a machine-readable form of this - NIST SP 800-115, PTES and the SEC material
 * all describe authority as *documents*. The shape below is derived from those field lists plus the
 * two working implementations found in the wild, and it exists to answer exactly one question:
 *
 *   **may this action run against this target, right now, under this grant?**
 *
 * The resolution rule is deliberately all-or-nothing. A target is in scope only when *every* grant it
 * requires resolves, its ownership evidence verifies, and nothing about the request falls outside the
 * grant's constraints. Anything that cannot be evaluated is a **block** - the failure mode this exists
 * to prevent is a scope checker that treats an empty or unresolvable scope as "unrestricted".
 */

import { parse as parseYaml } from "yaml";

export interface Principal {
	readonly id: string;
	readonly kind: "grantor" | "operator" | "third-party";
}

export interface EvidenceRef {
	readonly kind: string;
	readonly ref: string;
	/** Expected digest of the evidence document. A mismatch is a block. */
	readonly sha256: string;
	readonly signed_by?: string;
}

export interface ExternalState {
	readonly kind: string;
	readonly ref: string;
	readonly state: "approved" | "pending" | "expired";
	readonly checked_at: string;
}

export interface GrantConstraints {
	/** Per-phase intensity ceiling, e.g. `{ discovery: 2, exploitation: 1 }`. A vector, not a scalar. */
	readonly intensity?: Readonly<Record<string, number>>;
	readonly excluded_techniques?: readonly string[];
	readonly max_requests_per_second?: number;
}

export interface Grant {
	readonly id: string;
	/** The granting principal. Must not be the operator: an agent may not grant itself authority. */
	readonly from: string;
	readonly to: string;
	/** Scope is *actions and expected outcomes*, per NIST SP 800-115 Appendix B 1.2. */
	readonly authorizes: { readonly actions: readonly string[]; readonly outcomes?: readonly string[] };
	readonly targets: readonly string[];
	readonly window?: { readonly from: string; readonly to: string };
	readonly evidence?: readonly EvidenceRef[];
	readonly constraints?: GrantConstraints;
	readonly external_state?: ExternalState;
	/**
	 * Risks the granting party has accepted, with their mitigations (NIST SP 800-115 Appendix B 1.4
	 * requires these to be identified and mitigated before testing). Carried on the grant so the
	 * acceptance is attributable to whoever issued it.
	 */
	readonly risk_acceptance?: readonly { readonly risk: string; readonly mitigation: string; readonly accepted_by: string }[];
}

export interface AuthorityTarget {
	readonly id: string;
	readonly address: string;
	readonly owner: string;
	/** PTES: validate that the target actually belongs to the granting party before acting on it. */
	readonly ownership_evidence: EvidenceRef;
	/** Every one of these must resolve, or the target is out of scope. */
	readonly requires_grants: readonly string[];
}

export interface AuthorityDocument {
	readonly version: number;
	readonly engagement: string;
	readonly principals: readonly Principal[];
	readonly grants: readonly Grant[];
	readonly targets: readonly AuthorityTarget[];
}

export interface AuthorityRequest {
	/** The action class, e.g. `scan`, `exploit`, `order.submit`. */
	readonly action: string;
	/** The target id or address as the caller resolved it. */
	readonly target: string;
	readonly at: string;
	readonly technique?: string;
	readonly phase?: string;
	readonly intensity?: number;
	/**
	 * How many actions this session has already run in the second ending at `at`.
	 *
	 * **Counted by the caller, judged here**, which is the arrangement `intensity` already uses: only the caller holds
	 * session state, and only this function decides whether a grant's constraints resolve. The cap it is compared
	 * against - `constraints.max_requests_per_second` - sat in the schema with no reader at all, so a document could
	 * advertise a rate limit that nothing limited.
	 */
	readonly requestsInLastSecond?: number;
	/**
	 * Actual digests for the evidence references the document names, keyed by `ref`. The framework does
	 * not read files here; a reference with no supplied digest cannot be verified and is therefore a
	 * block, not a pass.
	 */
	readonly evidenceDigests?: Readonly<Record<string, string>>;
}

export type AuthorityDecision =
	| { readonly outcome: "allow"; readonly grantIds: readonly string[] }
	| { readonly outcome: "block"; readonly reason: string; readonly remediation: string };

export interface AuthorityOptions {
	/** How stale an `external_state.checked_at` may be before the grant stops resolving. Default 24h. */
	readonly externalStateMaxAgeMs?: number;
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function block(reason: string, remediation: string): AuthorityDecision {
	return { outcome: "block", reason, remediation };
}

function evidenceProblem(
	label: string,
	refs: readonly EvidenceRef[],
	digests: Readonly<Record<string, string>> | undefined,
): string | undefined {
	for (const evidence of refs) {
		const actual = digests?.[evidence.ref];
		if (actual === undefined) return `${label} names evidence '${evidence.ref}' but no digest was supplied, so it cannot be verified.`;
		if (actual.toLowerCase() !== evidence.sha256.toLowerCase()) {
			return `${label} evidence '${evidence.ref}' digest mismatch: document expects ${evidence.sha256}, actual is ${actual}.`;
		}
	}
	return undefined;
}

/**
 * Pre-flight the whole document before a run starts.
 *
 * "A run is blocked until the grant artifact exists and is valid" cannot be expressed by checking
 * actions one at a time: the first action would have to be attempted before the absence of a signed
 * grant is discovered. This checks every grant that any target requires, so an engagement with a
 * missing or stale authorization **does not start** rather than failing on its first action.
 *
 * It is deliberately generic - it applies to any conformance-gated mode, not to one vertical.
 */
const DOCUMENT_FIELDS = new Set(["version", "engagement", "principals", "grants", "targets"]);
const GRANT_FIELDS = new Set(["id", "from", "to", "authorizes", "targets", "window", "evidence", "constraints", "external_state", "risk_acceptance"]);
const AUTHORIZES_FIELDS = new Set(["actions", "outcomes"]);
const TARGET_FIELDS = ["id", "address", "owner", "ownership_evidence", "requires_grants"] as const;

/**
 * Reject a malformed authority document before anything is evaluated.
 *
 * This exists because of a mistake made while writing the first pentest fixture: a grant listed its
 * targets under `authorizes`, where no such field exists. The document parsed, the target list was
 * silently ignored, and the failure only surfaced later as an unrelated `undefined`. A silently
 * ignored key in a document whose entire purpose is to constrain an agent is exactly the failure mode
 * this framework refuses everywhere else, so the authority document is checked the same way.
 */
export function validateAuthorityDocument(document: AuthorityDocument): string | undefined {
	const unknown = (where: string, value: object, allowed: Set<string>): string | undefined => {
		const offender = Object.keys(value).find((key) => !allowed.has(key));
		return offender === undefined ? undefined : `${where} declares unknown field '${offender}' (known: ${[...allowed].join(", ")})`;
	};
	const top = unknown("authority document", document, DOCUMENT_FIELDS);
	if (top !== undefined) return top;
	for (const grant of document.grants) {
		const grantProblem = unknown(`grant '${grant.id}'`, grant, GRANT_FIELDS);
		if (grantProblem !== undefined) return grantProblem;
		const authorizesProblem = unknown(`grant '${grant.id}'.authorizes`, grant.authorizes, AUTHORIZES_FIELDS);
		if (authorizesProblem !== undefined) return authorizesProblem;
	}
	return undefined;
}

/** Raised when an authority document cannot be read as one. */
export class AuthorityDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthorityDocumentError";
	}
}

/**
 * Parse an authority document from its YAML source.
 *
 * **Structural checks run here as well as the unknown-field check, because they prevent the same failure from
 * two sides.** An unknown key is a constraint silently absent; a *missing* key is a constraint that cannot be
 * evaluated - `grant.targets` as `undefined` is not an error the evaluator raises, it is a comparison that
 * quietly fails, and a document exists precisely to make that impossible. Both are named, with the file they
 * came from.
 */
export function parseAuthorityDocument(source: string, origin: string): AuthorityDocument {
	let parsed: unknown;
	try {
		parsed = parseYaml(source);
	} catch (error) {
		throw new AuthorityDocumentError(`${origin} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new AuthorityDocumentError(`${origin} must be a mapping.`);
	}
	const record = parsed as Record<string, unknown>;
	for (const field of ["version", "engagement", "principals", "grants", "targets"] as const) {
		if (record[field] === undefined) {
			throw new AuthorityDocumentError(`${origin} is missing '${field}': a document whose purpose is to bound an agent cannot omit the thing that bounds it.`);
		}
	}
	if (typeof record.version !== "number") throw new AuthorityDocumentError(`${origin}.version must be a number.`);
	if (typeof record.engagement !== "string" || record.engagement.trim() === "") {
		throw new AuthorityDocumentError(`${origin}.engagement must be a non-empty string.`);
	}
	for (const field of ["principals", "grants", "targets"] as const) {
		if (!Array.isArray(record[field])) throw new AuthorityDocumentError(`${origin}.${field} must be a list.`);
	}

	const document = record as unknown as AuthorityDocument;
	const problem = validateAuthorityDocument(document);
	if (problem !== undefined) throw new AuthorityDocumentError(`${origin}: ${problem}.`);

	for (const grant of document.grants) {
		const label = `grant '${grant === null || typeof grant !== "object" ? "?" : (grant as { id?: unknown }).id ?? "?"}'`;
		if (grant === null || typeof grant !== "object") throw new AuthorityDocumentError(`${origin}: a grant entry is not a mapping.`);
		for (const field of ["id", "from", "to", "targets"] as const) {
			if (grant[field] === undefined) throw new AuthorityDocumentError(`${origin}: ${label} is missing '${field}'.`);
		}
		if (grant.authorizes === undefined || !Array.isArray(grant.authorizes.actions)) {
			throw new AuthorityDocumentError(`${origin}: ${label} must declare 'authorizes.actions' - an authority with no actions authorizes nothing.`);
		}
	}
	for (const target of document.targets) {
		if (target === null || typeof target !== "object") throw new AuthorityDocumentError(`${origin}: a target entry is not a mapping.`);
		for (const field of TARGET_FIELDS) {
			if ((target as unknown as Record<string, unknown>)[field] === undefined) {
				throw new AuthorityDocumentError(`${origin}: target '${target.id ?? "?"}' is missing '${field}'.`);
			}
		}
	}
	return document;
}

export function preflightAuthority(
	document: AuthorityDocument,
	at: string,
	options: AuthorityOptions & { readonly evidenceDigests?: Readonly<Record<string, string>> } = {},
): AuthorityDecision {
	const malformed = validateAuthorityDocument(document);
	if (malformed !== undefined) {
		return block(`${malformed}. The engagement cannot start.`, "Correct the authority document. A key that is silently ignored is a constraint that is silently absent.");
	}
	const now = Date.parse(at);
	if (!Number.isFinite(now)) {
		return block("Run start time is not a valid instant, so no window or freshness can be evaluated.", "Supply a valid ISO timestamp.");
	}
	const maxAge = options.externalStateMaxAgeMs ?? DEFAULT_MAX_AGE_MS;
	const required = new Set(document.targets.flatMap((target) => target.requires_grants));

	for (const grantId of required) {
		const grant = document.grants.find((g) => g.id === grantId);
		if (grant === undefined) {
			return block(
				`Engagement '${document.engagement}' requires grant '${grantId}', which the document does not contain.`,
				"Supply the grant before starting. An engagement without its authorization does not begin.",
			);
		}
		// A grant is evidenced by a signed document, or by an external approval that resolved. A third
		// party's approval form *is* the evidence for that grant, so requiring both would be wrong; but a
		// grant with neither is an unauthorized grant, and an engagement with one does not start.
		const hasDocumentaryEvidence = grant.evidence !== undefined && grant.evidence.length > 0;
		const hasExternalApproval = grant.external_state !== undefined && grant.external_state.state === "approved";
		if (!hasDocumentaryEvidence && !hasExternalApproval) {
			return block(
				`Grant '${grant.id}' has neither signed evidence nor an approved external authorization, so there is nothing showing it was granted. The engagement cannot start.`,
				"Attach the signed authorization to this grant, or record the external approval that authorizes it.",
			);
		}
		if (hasDocumentaryEvidence) {
			const problem = evidenceProblem(`Grant '${grant.id}'`, grant.evidence!, options.evidenceDigests);
			if (problem !== undefined) {
				return block(`${problem} The engagement cannot start.`, "Supply the signed authorization this grant depends on.");
			}
		}
		if (grant.external_state !== undefined) {
			const state = grant.external_state;
			if (state.state !== "approved") {
				return block(`Grant '${grant.id}' depends on external approval '${state.ref}', which is '${state.state}'. The engagement cannot start.`, "Wait for the approval, or remove this grant and its targets from scope.");
			}
			const checkedAt = Date.parse(state.checked_at);
			if (!Number.isFinite(checkedAt) || now - checkedAt > maxAge) {
				return block(`Grant '${grant.id}' external approval '${state.ref}' is stale. The engagement cannot start.`, "Re-check the approval and record a fresh checked_at.");
			}
		}
		if (grant.window !== undefined) {
			const from = Date.parse(grant.window.from);
			const to = Date.parse(grant.window.to);
			if (!Number.isFinite(from) || !Number.isFinite(to) || now < from || now > to) {
				return block(`Grant '${grant.id}' is not active at ${at} (window ${grant.window.from} to ${grant.window.to}). The engagement cannot start.`, "Reschedule the engagement inside the window, or extend it.");
			}
		}
	}
	for (const target of document.targets) {
		const problem = evidenceProblem(`Target '${target.id}' ownership`, [target.ownership_evidence], options.evidenceDigests);
		if (problem !== undefined) return block(`${problem} The engagement cannot start.`, "Supply verifiable ownership evidence for every in-scope target.");
	}
	return { outcome: "allow", grantIds: [...required] };
}

export function evaluateAuthority(
	document: AuthorityDocument,
	request: AuthorityRequest,
	options: AuthorityOptions = {},
): AuthorityDecision {
	const maxAge = options.externalStateMaxAgeMs ?? DEFAULT_MAX_AGE_MS;
	const now = Date.parse(request.at);
	if (!Number.isFinite(now)) {
		return block("Request timestamp is not a valid instant, so no window or freshness can be evaluated.", "Supply a valid ISO timestamp.");
	}

	// Rule 1: the target must resolve to exactly one entry.
	const matches = document.targets.filter((t) => t.id === request.target || t.address === request.target);
	if (matches.length === 0) {
		return block(
			`Target '${request.target}' is not present in authority document '${document.engagement}'.`,
			"Add the target to the authority document, or choose a target that is already in scope. An unknown target is never in scope.",
		);
	}
	if (matches.length > 1) {
		return block(
			`Target '${request.target}' is ambiguous: it matches ${matches.length} entries (${matches.map((t) => t.id).join(", ")}).`,
			"Use the target id rather than the address so exactly one entry resolves.",
		);
	}
	const target = matches[0]!;

	// Rule 2: ownership must be evidenced, not assumed.
	const ownershipProblem = evidenceProblem(`Target '${target.id}' ownership`, [target.ownership_evidence], request.evidenceDigests);
	if (ownershipProblem !== undefined) {
		return block(
			ownershipProblem,
			"Supply verifiable ownership evidence for this target before acting on it. Attacking a host that belongs to someone else is the failure this prevents.",
		);
	}

	// Rule 3/4/5/6: every required grant must resolve completely.
	const resolved: string[] = [];
	for (const grantId of target.requires_grants) {
		const grant = document.grants.find((g) => g.id === grantId);
		if (grant === undefined) {
			return block(
				`Target '${target.id}' requires grant '${grantId}', which is not present in the document.`,
				`Add grant '${grantId}' to the authority document, or remove it from the target's requires_grants.`,
			);
		}
		const granter = document.principals.find((p) => p.id === grant.from);
		if (granter === undefined) {
			return block(`Grant '${grant.id}' is issued by unknown principal '${grant.from}'.`, "Declare the principal, or correct the grant.");
		}
		if (granter.kind === "operator") {
			return block(
				`Grant '${grant.id}' is issued by the operator itself.`,
				"Authority must come from a grantor or a third party. An agent may not grant itself authority.",
			);
		}
		if (!grant.authorizes.actions.includes(request.action)) {
			return block(
				`Grant '${grant.id}' does not authorize action '${request.action}' (it authorizes: ${grant.authorizes.actions.join(", ")}).`,
				`Request a grant covering '${request.action}', or use an action this grant covers.`,
			);
		}
		if (!grant.targets.includes(target.id)) {
			return block(
				`Grant '${grant.id}' does not cover target '${target.id}'.`,
				`Request a grant covering '${target.id}', or act on a target this grant covers.`,
			);
		}
		if (grant.window !== undefined) {
			const from = Date.parse(grant.window.from);
			const to = Date.parse(grant.window.to);
			if (!Number.isFinite(from) || !Number.isFinite(to)) {
				return block(`Grant '${grant.id}' declares an unparseable window.`, "Correct the window, or remove it.");
			}
			if (now < from || now > to) {
				return block(
					`Grant '${grant.id}' is outside its window: the request is at ${request.at}, the window is ${grant.window.from} to ${grant.window.to}.`,
					"Reschedule the action inside the window, or extend the window through the authority document.",
				);
			}
		}
		if (grant.evidence !== undefined) {
			const problem = evidenceProblem(`Grant '${grant.id}'`, grant.evidence, request.evidenceDigests);
			if (problem !== undefined) return block(problem, "Supply the verifiable evidence this grant depends on.");
		}
		if (grant.external_state !== undefined) {
			const state = grant.external_state;
			if (state.state !== "approved") {
				return block(
					`Grant '${grant.id}' depends on external approval '${state.ref}' which is '${state.state}'.`,
					"Wait for the external approval, or act on a target that does not need it.",
				);
			}
			const checkedAt = Date.parse(state.checked_at);
			if (!Number.isFinite(checkedAt) || now - checkedAt > maxAge) {
				return block(
					`Grant '${grant.id}' external approval '${state.ref}' was last checked at ${state.checked_at}, which is stale.`,
					"Re-check the external approval and record a fresh checked_at.",
				);
			}
		}
		if (grant.constraints?.excluded_techniques !== undefined && request.technique !== undefined) {
			if (grant.constraints.excluded_techniques.includes(request.technique)) {
				return block(
					`Technique '${request.technique}' is excluded by grant '${grant.id}'.`,
					"Use a technique the grant permits. Excluded techniques are not negotiable at runtime.",
				);
			}
		}
		if (grant.constraints?.intensity !== undefined && request.phase !== undefined && request.intensity !== undefined) {
			const ceiling = grant.constraints.intensity[request.phase];
			if (ceiling === undefined) {
				return block(
					`Grant '${grant.id}' sets no intensity ceiling for phase '${request.phase}'.`,
					"Declare a ceiling for this phase, or run in a phase the grant covers.",
				);
			}
			if (request.intensity > ceiling) {
				return block(
					`Phase '${request.phase}' intensity ${request.intensity} exceeds the ceiling ${ceiling} set by grant '${grant.id}'.`,
					"Lower the intensity, or raise the ceiling through the authority document.",
				);
			}
		}
		if (grant.constraints?.max_requests_per_second !== undefined && request.requestsInLastSecond !== undefined) {
			// This call is the next one, the way the intensity ceiling counts `used + 1`: a cap of five is five.
			const cap = grant.constraints.max_requests_per_second;
			if (request.requestsInLastSecond + 1 > cap) {
				return block(
					`Grant '${grant.id}' caps the rate at ${cap} request(s) per second, and this would be number ${request.requestsInLastSecond + 1} in this second.`,
					"Wait for the second to pass, or raise the cap through the authority document deliberately rather than pacing the work around it.",
				);
			}
		}
		resolved.push(grant.id);
	}

	return { outcome: "allow", grantIds: resolved };
}
