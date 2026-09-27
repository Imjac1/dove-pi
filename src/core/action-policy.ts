import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { AuthorityDocument, AuthorityRequest } from "./authority.ts";
import { createCapabilityScope } from "./capability-scope.ts";
import { createConformanceGate } from "./gate-conformance.ts";
import { createLimitGate, readArgumentPath } from "./gate-limit.ts";
import type { GateDecision, GateInvocation } from "./loop.ts";
import { evaluatePermission, matchesPermission, type WorkMode } from "./work-mode.ts";

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
 *
 * **`ask` is consulted last, and the position is the point.** Consent is not a control that refuses an action for
 * a reason of its own; it is the operator's answer about an action that everything else already permitted. Asking
 * about an action that is over its limit, out of scope, or denied would spend the operator's attention on a
 * question whose answer cannot change what happens - and it would teach them that a prompt is noise.
 */
export interface ActionPolicyOptions {
	readonly mode: WorkMode;
	readonly authorityDocument?: AuthorityDocument;
	/** The workspace the engagement's evidence paths are resolved against. */
	readonly workspaceRoot: string;
	/**
	 * The capabilities this runtime actually provides, by name.
	 *
	 * **Required, with no default, because neither default is safe.** A mode may grant authority for a capability the
	 * deployment does not have - `modes/trading` declares `order.submit` and the framework ships no such capability,
	 * which is the mode stating what its *environment* must provide. An empty default would refuse every honest
	 * caller; omitting the check lets the call through to `registry.require`, which throws **after** the operator has
	 * confirmed it and after the effect claim was taken.
	 */
	readonly registeredCapabilities: readonly string[];
}

export interface ActionPolicy {
	readonly modeId: string;
	/** The checks in the order they are consulted, so a reader sees the policy instead of inferring it. */
	readonly gates: readonly string[];
	/** The name-only check. Safe to run before the arguments are final. */
	denyDecision(action: string): GateDecision;
	/**
	 * Record that an action has actually run, so the next invocation's intensity check sees it.
	 *
	 * Called by the host **after** the action is dispatched, not when the policy allows it: an allowed action that
	 * never runs, and a blocked one, must not spend the phase's budget. A phase the mode sets no ceiling for is not
	 * counted, because there is nothing to spend.
	 */
	recordRun(invocation: GateInvocation): void;
	/** The per-phase counts so far, for a caller that builds the next invocation's `accumulatedIntensity`. */
	counts(): Readonly<Record<string, number>>;
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
	if (decision.outcome === "allow") return decision;
	return { outcome: decision.outcome, reason: `[` + gate + `] ` + decision.reason, remediation: decision.remediation };
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
	// The ceiling comes from the mode, which is read before any untrusted content is: a scope assembled later has
	// already been influenced by what was read (design 4.3). One agent today - the mode itself - and `narrow` is there
	// for the day a delegate exists.
	const scope = createCapabilityScope({ sets: [{ agentId: mode.id, capabilities: mode.capabilities.map((id) => ({ id })) }] });
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

	// An action names *how* it runs in its own arguments. `technique`, `phase` and `intensity` are read from there
	// rather than invented here, so a call that does not carry them produces an undefined field - which the authority
	// treats as "not constrained", exactly as it treats an absent target. Inventing defaults would manufacture the
	// facts a rule fires on.
	const techniqueOf = (invocation: GateInvocation): string | undefined => {
		const value = readArgumentPath(invocation.arguments, "technique");
		return typeof value === "string" && value.trim() !== "" ? value : undefined;
	};
	const phaseOf = (invocation: GateInvocation): string | undefined => {
		const value = readArgumentPath(invocation.arguments, "phase");
		return typeof value === "string" && value.trim() !== "" ? value : undefined;
	};
	// The intensity a call claims for itself, distinct from the phase's accumulated count: an action may carry a
	// weight (`intensity: 3` for a heavy operation) and the ceiling is checked against the accumulated count. Both
	// are read, and the authority receives the count while the mode's own ceiling is checked against it.
	const intensityValueOf = (invocation: GateInvocation): number | undefined => {
		const value = readArgumentPath(invocation.arguments, "intensity");
		const number = typeof value === "number" ? value : Number(value);
		return Number.isFinite(number) ? number : undefined;
	};

	const toRequest = (invocation: GateInvocation): AuthorityRequest | undefined => {
		const declared = mode.targetArgument;
		// No declared target argument, or a call that carries no target, is "the target cannot be established" -
		// which the conformance gate turns into a block rather than into an unscoped allow.
		if (declared === undefined) return undefined;
		const target = readArgumentPath(invocation.arguments, declared);
		if (typeof target !== "string" || target.trim() === "") return undefined;
		const technique = techniqueOf(invocation);
		const phase = phaseOf(invocation);
		// The count the authority sees is **the count including this action**: `used` is what has already run and the
		// request is about the call under review, so a ceiling of 2 admits the first two actions and refuses the third.
		const requested = intensityValueOf(invocation);
		const intensity = intensityOf(invocation);
		return {
			action: invocation.tool,
			target,
			at: invocation.at,
			evidenceDigests: evidenceDigests(),
			...(technique === undefined ? {} : { technique }),
			...(phase === undefined ? {} : { phase }),
			...(intensity === undefined ? {} : { intensity: intensity.used + 1 }),
			// A call may declare its own weight; the accumulated count is what a ceiling is checked against, so the
			// declared value is carried only when it exceeds what the count would say, never to lower it.
			...(requested === undefined || (intensity !== undefined && requested <= intensity.used + 1)
				? {}
				: { intensity: requested }),
		};
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

	// A `Set` because this is a name lookup on every capability invocation, against the runtime's whole surface.
	const registered = new Set(options.registeredCapabilities);

	// The mode's own technique prohibition, checked before anything else can allow the call. `never_allow` names
	// *actions*; this names *how* an action runs, and neither list can express the other.
	const excludedTechniques = mode.excludedTechniques;
	// The per-phase action counts this policy has seen, keyed by phase. **The accumulator lives here** - one policy
	// per loaded mode, so one accumulator per run - and is what `accumulatedIntensity` on an invocation now carries:
	// the count so far, not the count including this action, because whether the ceiling permits it is a decision the
	// check below makes from the ceiling and the mode's answer, not a fact the caller could know.
	const phaseCounts: Record<string, number> = {};
	const intensityOf = (invocation: GateInvocation): { phase: string; used: number } | undefined => {
		const ceilings = mode.intensityCeilings;
		const phase = readArgumentPath(invocation.arguments, "phase");
		if (ceilings === undefined || typeof phase !== "string" || phase.trim() === "") return undefined;
		if (!(phase in ceilings)) return undefined;
		// The caller's accumulator wins if it carries the phase, because it is built from a policy that has already
		// recorded the actions that ran; the internal counter is the fallback for a caller that passes no history.
		const carried = invocation.accumulatedIntensity?.[phase];
		return { phase, used: typeof carried === "number" ? carried : phaseCounts[phase] ?? 0 };
	};

	return {
		modeId: mode.id,
		gates: ["deny", "scope", "registered", ...(limitGate === undefined ? [] : [limitGate.id]), ...(conformanceGate === undefined ? [] : [conformanceGate.id]), "ask"],
		denyDecision,
		evaluate(invocation, source) {
			// The denial is evaluated here as well, so a caller who runs only `evaluate` cannot silently skip it.
			// `denyDecision` exists so the host can run that half *early* - where the arguments are not yet final - not
			// as a second control that must be remembered.
			const denial = denyDecision(invocation.tool);
			if (denial.outcome === "block") return labelled(denial, "deny");
			// **A technique is checked before anything that could allow the call.** `never_allow` names actions; this
			// names how an action runs, and the two are not interchangeable: a probe can be run in many techniques, and
			// forbidding `dos` is a statement about conduct that a permission list over tools cannot make. Checked on
			// raw tools too, because how a command runs is a fact about the call, not about whether it went through the
			// capability tool.
			const technique = techniqueOf(invocation);
			if (technique !== undefined && excludedTechniques !== undefined && excludedTechniques.includes(technique)) {
				return labelled(
					{
						outcome: "block",
						reason: `Technique '${technique}' is excluded by mode '${mode.id}'.`,
						remediation: "Use a technique the mode permits. Excluded techniques are not negotiable at runtime.",
					},
					"technique",
				);
			}
			// **The scope check comes first among the capability checks**, and it is a name lookup while the others are
			// value lookups: a threshold and a contract ask *how* an action may run, and this asks *whether this agent may
			// reach it at all*. It is also the strongest control in the evidence base - an injected effect executes in
			// 33-47 of 75 runs under ambient authority and 3 of 75 under capability scoping.
			if (source.viaCapability) {
				const authorized = scope.authorize({ agentId: mode.id, capability: invocation.tool });
				if (authorized.outcome === "deny") return labelled({ outcome: "block", reason: authorized.reason, remediation: authorized.remediation }, "scope");
				// **The third check, and the position is the point.** `deny` is a policy decision, `scope` asks whether this
				// agent may reach the action, and this asks whether the deployment can run it at all - a fact about the
				// runtime rather than about the action. Ahead of `scope` it would report a deployment problem as a policy
				// decision; after `ask` it would put the question to the operator first, which is what happened until
				// 2026-09-27: the confirmation appeared, and then `registry.require` threw. Reaching here at all means the
				// mode declares it, because `scope` refuses what the mode does not grant.
				if (!registered.has(invocation.tool)) {
					return labelled(
						{
							outcome: "block",
							reason: `Mode '` + mode.id + `' grants authority for '` + invocation.tool + `' and nothing in this runtime registers it.`,
							remediation: "Install or register the capability the mode expects, or correct the mode's authority.capabilities deliberately rather than around them.",
						},
						"registered",
					);
				}
			}
			// **The intensity ceiling is a count over the run, which is why it is checked after the per-call checks but
			// before the threshold gate.** The accumulator counts *completed* actions in this phase; the call under
			// review would be number `used + 1`, and exceeding the ceiling blocks it. Checked after `scope` and
			// `registered` so a call the mode never granted does not spend the budget, and before `limit` so a
			// per-argument threshold cannot be read as the reason the call was refused.
			const intensity = intensityOf(invocation);
			if (intensity !== undefined) {
				const ceiling = mode.intensityCeilings?.[intensity.phase] ?? Number.POSITIVE_INFINITY;
				if (intensity.used + 1 > ceiling) {
					return labelled(
						{
							outcome: "block",
							reason: `Phase '${intensity.phase}' has already run ${intensity.used} action(s) under mode '${mode.id}', which sets an intensity ceiling of ${ceiling}.`,
							remediation: "Run the remaining work in another phase, or raise the ceiling through the mode's gate.intensity deliberately rather than around it.",
						},
						"intensity",
					);
				}
			}
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
			// **Counted here and only here**: every gate above has passed and the action is about to be permitted, so
			// this is the first point at which "ran in this phase" is true. An `ask` returns below without counting,
			// because the operator has not consented yet; a consented re-entry counts then.
			const counted = intensityOf(invocation);
			const permission = evaluatePermission(mode.permissions, invocation.tool);
			// Both causes of "ask" are the mode's own: `ask_before` names an action it wants to be asked about, and
			// `unlisted: ask` says the same for everything it did not name. They differ only in what the reason should
			// say, which is why the distinction is drawn here and not inside the matcher.
			if (permission === "ask") {
				const declared = matchesPermission(mode.permissions.ask_before, invocation.tool);
				return labelled(
					{
						outcome: "ask",
						reason: declared
							? `Mode '` + mode.id + `' lists '` + invocation.tool + `' in ask_before, so it runs only with the operator's confirmation.`
							: `Mode '` + mode.id + `' declares 'unlisted: ask', and '` + invocation.tool + `' is on none of its permission lists, so it runs only with the operator's confirmation.`,
						remediation:
							"Confirm it when the host asks. A host with no dialog refuses it, so if no prompt appears the action has to be moved off ask_before deliberately rather than run unasked.",
					},
					"ask",
				);
			}
			// Reached with `permission === "allow"` from either the mode's stance or its `always_allow` list, and the
			// second one is worth naming: it is the only case where a listed action and an unlisted one differ, and it
			// can only occur under `unlisted: ask` because the loader refuses the other combination.
			return {
				outcome: "allow",
				...(permission === "allow" && matchesPermission(mode.permissions.always_allow, invocation.tool)
					? {
						reason:
							`Mode '` + mode.id + `' lists '` + invocation.tool + `' in always_allow, so it runs without the confirmation the mode's 'unlisted: ask' stance would otherwise require.`,
					}
					: {}),
			};
		},

		/** Record that an action ran in a phase, called by the host once the action has actually been permitted and run. */
		recordRun(invocation: GateInvocation): void {
			const phase = readArgumentPath(invocation.arguments, "phase");
			if (typeof phase !== "string" || phase.trim() === "" || mode.intensityCeilings === undefined || !(phase in mode.intensityCeilings)) return;
			phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
		},

		/** The counts so far, keyed by phase, for a caller that builds the next invocation's `accumulatedIntensity`. */
		counts(): Readonly<Record<string, number>> {
			return { ...phaseCounts };
		},
	};
}
