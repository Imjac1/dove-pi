import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { AuthorityDocument, AuthorityRequest } from "./authority.ts";
import { createConformanceGate } from "./gate-conformance.ts";
import { createLimitGate, readArgumentPath } from "./gate-limit.ts";
import type { GateDecision, GateInvocation } from "./loop.ts";
import { evaluatePermission, type WorkMode } from "./work-mode.ts";

/**
 * The one action policy a mode's controls add up to.
 *
 * **Two entry points, because they have different input requirements, and that is the whole reason they are
 * separate.** `denyDecision` reads a tool name and nothing else, so it can run before the host has finished
 * shaping the call. `evaluate` reads the **arguments**, so it must run on the final input - the host
 * re-validates nothing after a mutation (types.d.ts:703-708), and a gate that validated an earlier version of
 * the arguments would have permitted something other than what runs. Splitting them keeps one owner of the
 * ordering rules while letting each run where its inputs exist.
 *
 * Order, and it is a requirement rather than a preference: **a denial is evaluated independently of everything
 * else and wins.** Then thresholds. Then the contract. Anything that cannot be evaluated is a block, never an
 * allow.
 */
export interface ActionPolicyOptions {
	readonly mode: WorkMode;
	readonly authorityDocument?: AuthorityDocument;
	/** The workspace the engagement's evidence paths are resolved against. */
	readonly workspaceRoot: string;
}

export interface ActionPolicy {
	readonly modeId: string;
	/** The checks in the order they are consulted, so a reader sees the policy instead of inferring it. */
	readonly gates: readonly string[];
	/** The name-only check. Safe to run before the arguments are final. */
	denyDecision(action: string): GateDecision;
	/**
	 * The argument-reading checks. Must run on the arguments that will be dispatched.
	 *
	 * `viaCapability` is passed in rather than read off the invocation, because whether an action came from a
	 * capability or from a raw host tool is a fact about the **host's** call path, not about the action: the
	 * authority document authorizes *actions* and names *targets*, and a raw tool call carries neither. Leaking
	 * that field into `GateInvocation` would put a host concept into the loop's own contract.
	 */
	evaluate(invocation: GateInvocation, source: { readonly viaCapability: boolean }): GateDecision;
}

function labelled(decision: GateDecision, gate: string): GateDecision {
	if (decision.outcome !== "block") return decision;
	return { outcome: "block", reason: `[` + gate + `] ` + decision.reason, remediation: decision.remediation };
}

/**
 * The actual digest of every evidence reference a document names, read from the workspace.
 *
 * The document carries the digest it *expects*; supplying the one the file *has* is what makes the check a check. A
 * reference whose file cannot be read is left **unsupplied** rather than given a placeholder, and the authority then
 * blocks it by name - which keeps the authority, not this function, the only decider of whether a grant resolves.
 *
 * Shared by the action policy (per action) and the pre-flight (once, before a run starts) so the two cannot disagree
 * about what a document's evidence is.
 */
export function evidenceDigestsFor(document: AuthorityDocument, workspaceRoot: string): Readonly<Record<string, string>> {
	const cache = new Map<string, string | undefined>();
	const digestOf = (ref: string): string | undefined => {
		if (cache.has(ref)) return cache.get(ref);
		let value: string | undefined;
		if (!isAbsolute(ref)) {
			const path = resolve(workspaceRoot, ref);
			const inside = !relative(workspaceRoot, path).startsWith("..");
			if (inside && existsSync(path)) {
				try {
					value = createHash("sha256").update(readFileSync(path)).digest("hex");
				} catch {
					value = undefined;
				}
			}
		}
		cache.set(ref, value);
		return value;
	};
	const digests: Record<string, string> = {};
	for (const target of document.targets) {
		const value = digestOf(target.ownership_evidence.ref);
		if (value !== undefined) digests[target.ownership_evidence.ref] = value;
	}
	for (const grant of document.grants) {
		for (const evidence of grant.evidence ?? []) {
			const value = digestOf(evidence.ref);
			if (value !== undefined) digests[evidence.ref] = value;
		}
	}
	return digests;
}

export function createActionPolicy(options: ActionPolicyOptions): ActionPolicy {
	const { mode } = options;
	const limitGate = mode.limits.length > 0 ? createLimitGate(mode.limits) : undefined;
	const wantsConformance = mode.gateSemantics === "conformance" || mode.gateSemantics === "both";

	/**
	 * The actual digest of each evidence reference the document names, read from the workspace.
	 *
	 * The document carries the digest it *expects*; supplying the one the file *has* is what makes the check a
	 * check. A reference whose file cannot be read is left **unsupplied** rather than given a placeholder, and the
	 * authority then blocks it by name - which keeps the authority, not this function, the only decider of whether
	 * a grant resolves.
	 */
	// One implementation of "read the evidence the document names and hash it", shared with the pre-flight: the
	// authority's own verifier decides whether a grant resolves, so both callers must hand it the same digests.
	let computedDigests: Readonly<Record<string, string>> | undefined;
	const evidenceDigests = (): Readonly<Record<string, string>> => {
		const document = options.authorityDocument;
		if (document === undefined) return {};
		return (computedDigests ??= evidenceDigestsFor(document, options.workspaceRoot));
	};

	const toRequest = (invocation: GateInvocation): AuthorityRequest | undefined => {
		const declared = mode.targetArgument;
		// No declared target argument, or a call that carries no target, is "the target cannot be established" -
		// which the conformance gate turns into a block rather than into an unscoped allow.
		if (declared === undefined) return undefined;
		const target = readArgumentPath(invocation.arguments, declared);
		if (typeof target !== "string" || target.trim() === "") return undefined;
		return { action: invocation.tool, target, at: invocation.at, evidenceDigests: evidenceDigests() };
	};

	const conformanceGate =
		wantsConformance && options.authorityDocument !== undefined
			? createConformanceGate({ document: options.authorityDocument, toRequest })
			: undefined;

	const denyDecision = (action: string): GateDecision => {
		if (evaluatePermission(mode.permissions, action) !== "deny") return { outcome: "allow" };
		return {
			outcome: "block",
			reason: `'` + action + `' is on mode '` + mode.id + `'s never_allow list.`,
			remediation: "Choose an action the mode permits, or change the mode's permissions deliberately rather than around them.",
		};
	};

	return {
		modeId: mode.id,
		gates: ["deny", ...(limitGate === undefined ? [] : [limitGate.id]), ...(conformanceGate === undefined ? [] : [conformanceGate.id])],
		denyDecision,
		evaluate(invocation, source) {
			// The denial is evaluated here as well, so a caller who runs only `evaluate` cannot silently skip it.
			// `denyDecision` exists so the host can run that half *early* - where the arguments are not yet final - not
			// as a second control that must be remembered.
			const denial = denyDecision(invocation.tool);
			if (denial.outcome === "block") return labelled(denial, "deny");
			if (limitGate !== undefined) {
				const decision = limitGate.evaluate(invocation);
				if (decision.outcome === "block") return labelled(decision, limitGate.id);
			}
			// **The contract is checked against actions, not against tools, and a raw tool call has no action to check.**
			// A document names actions (`net.scan`) and targets (`t-web`); a `bash` command is neither, so asking the
			// conformance gate about one maps nothing and blocks everything - which is what it did, making an authorized
			// engagement unusable. Raw tools are governed by the permission list and the limits, and a mode that needs
			// containment beyond that must declare how its tools map (a per-tool table, not built yet).
			if (wantsConformance && source.viaCapability) {
				if (conformanceGate === undefined) {
					// Unreachable through the loader, which refuses a conformance mode with no document. Exercised by a
					// hand-built policy in the tests, because an unexercised branch is a claim rather than a control.
					return {
						outcome: "block",
						reason: `Mode '` + mode.id + `' declares '` + mode.gateSemantics + `' and no authority document was loaded, so nothing can be checked.`,
						remediation: "Load the mode through loadWorkModeFromDirectory, which resolves and validates the document, or correct the mode's grant.",
					};
				}
				const decision = conformanceGate.evaluate(invocation);
				if (decision.outcome === "block") return labelled(decision, conformanceGate.id);
			}
			const permission = evaluatePermission(mode.permissions, invocation.tool);
			return {
				outcome: "allow",
				...(permission === "ask"
					? { reason: `Mode '` + mode.id + `' neither allows nor denies '` + invocation.tool + `': it is 'ask', and approval is not consumed yet, so it ran without asking.` }
					: {}),
			};
		},
	};
}
