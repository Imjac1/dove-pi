import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { SHELL_TOOLS, TECHNIQUE_WITNESSES } from "./argument-syntax.ts";
import { MAX_COUNTABLE_RATE, type AuthorityDocument, type AuthorityRequest } from "./authority.ts";
import { createCapabilityScope } from "./capability-scope.ts";
import { createConformanceGate } from "./gate-conformance.ts";
import { createLimitGate, readArgumentPath, type LimitSpec } from "./gate-limit.ts";
import type { GateDecision, GateInvocation } from "./loop.ts";
import { evaluatePermission, FENCE_TARGETS, matchesPermission, normalizeFencePath, type WorkMode } from "./work-mode.ts";
import { declaredNetworkToolNames } from "./invocation-disposition.ts";
import { resolveDoveStateDir } from "./state-dir.ts";
import type { GateLabel } from "./task-convergence.ts";

/**
 * The host tools that can reach outside the machine, **derived from the one place that classifies host tools**.
 *
 * **This was a hand-maintained set of eight names here**, while `invocation-disposition.ts` declared four of the same
 * tools with the same fact spelled differently and `tests/fixtures/representative-tool-catalog.ts` carried a third set.
 * Three lists, no reconciliation, and a `sandbox.network: none` boundary whose reach depended on which one a reader
 * happened to open - the defect the audit recorded against this axis (`.trellis/tasks/10-05-pstack-reference-audit`
 * findings, level B item 8). A boundary list is the last place to keep a copy of a declaration.
 */
const NETWORK_TOOL_NAMES = new Set(declaredNetworkToolNames());
export const FILESYSTEM_MUTATORS = new Set(["write", "edit", "bash", "powershell", "replace", "insert", "notebook_edit"]);

/**
 * Every tool name this repository knows can change the workspace - **except the shell**, which a fence cannot
 * classify (the host's classifier reads command names, never paths) and the mode's `fence.shell` stance governs.
 *
 * **The union is maintained here rather than imported, and that is deliberate.** `pi-adapter`'s own mutation set
 * cannot be reached from `core` - core takes no Pi imports - so the coupling is asserted by a test that may import
 * both, and it fails when either list gains a name this one lacks. Without that test this constant is how a third
 * list would quietly appear beside the two that already disagree.
 *
 * A fenced run refuses these tools unless the fence can read their target. That is the fail-closed direction: of
 * the 57 tool names installed in this project's host, this repository can read three schemas, so "the rest write
 * somewhere harmless" is a claim we cannot back.
 */
export const FENCE_MUTATION_TOOLS = new Set([
	"write", "edit", "replace", "insert", "notebook_edit",
	"delete", "mkdir", "agent_workspace_patch", "agent_workspace_restore",
]);

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
	/** The labels this policy can produce. Checked against `GATE_LABELS` by a test, because the entries come from gate
	 * objects whose ids are wider - the coupling that matters is on `labelled`, which is where a refusal is labelled. */
	readonly gates: readonly string[];
	/** The name-only check. Safe to run before the arguments are final. */
	denyDecision(action: string): GateDecision;
	/**
	 * Record that an action has actually run, so the next invocation's intensity check sees it.
	 *
	 * Called by the host **after** the action is dispatched, not when the policy allows it: an allowed action that
	 * never runs, and a blocked one, must not spend the phase's budget. A phase the mode sets no ceiling for is not
	 * counted, because there is nothing to spend.
	 *
	 * **The same call also spends the declared ceilings** (`limits[].max` is a ceiling per call *and* per session),
	 * spent by the tools each limit names and by no others.
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

function labelled(decision: GateDecision, gate: GateLabel): GateDecision {
	if (decision.outcome === "allow") return decision;
	return { outcome: decision.outcome, reason: `[` + gate + `] ` + decision.reason, remediation: decision.remediation };
}

/**
 * A target as a fence compares it: workspace-relative, forward-slashed, lowercased.
 *
 * `undefined` means the path is **not inside the workspace**, which is not a fence question - a fence protects
 * workspace paths, and a target outside the root matches none of them.
 *
 * Lowercasing is a Windows-first choice and it fails closed: on a case-insensitive filesystem a differently-cased
 * spelling addresses the same file, so a case-sensitive comparison would let `MODES/x.yaml` through the fence.
 */
/**
 * The decorations Win32 accepts on a path that names the same location, removed before anything compares two.
 *
 * The filesystem strips trailing dots and spaces from a segment, takes either separator, ignores case, and
 * accepts the extended-length and device prefixes (`\\?\`, `\\.\`) as ornaments on the same place. A boundary
 * that compares *the string the caller chose* against a declared path therefore refuses one spelling and
 * lets the rest through - which is the measured evasion (`2609.30217`: 98% of attempts, 88% succeeding) in its
 * cheapest form, and it needs no adversarial intent at all.
 */
export function normalizeTargetSpelling(target: string): string {
	return target.replace(/^\\\\[?.]\\/u, "");
}

function trimTrailingDotsAndSpaces(segment: string): string {
	// `..` is a segment whose dots mean something, and trimming it to nothing would read as the workspace root
	// - a normalization that turns a refusal into an allowance.
	if (segment === "" || /^\.+$/u.test(segment)) return segment;
	return segment.replace(/[. ]+$/u, "");
}

/**
 * The path the filesystem would actually open, as far as it exists on disk.
 *
 * **Why a fence cannot be purely lexical.** A junction inside the workspace names a fenced file by another
 * spelling - `link\harness-surface.yaml` - and `mklink /J` needs no administrator (measured). The comparison
 * below reads strings, so the alias reads as somewhere else while the filesystem opens the fenced file: the same
 * defect as a trailing dot or an extended-length prefix, one step further out.
 *
 * **Why the deepest existing ancestor, not the whole path.** A write names a file that may not exist yet, and
 * `realpathSync` refuses what it cannot open. Resolving the part that is there and re-appending the rest is what
 * makes "the same file" true for both the file that exists and the one about to.
 *
 * **What stays open, stated rather than implied.** A junction created *after* this check is a time-of-check
 * window this function cannot close: the fence reads the workspace as it is when the call arrives.
 */
export function canonicalTarget(path: string): string {
	let head = path;
	const tail: string[] = [];
	for (;;) {
		try {
			const real = realpathSync(head);
			return tail.length === 0 ? real : join(real, ...tail.reverse());
		} catch {
			const parent = dirname(head);
			// Nothing on this path exists, so there is nothing to canonicalize: keep the spelling we were given.
			if (parent === head) return path;
			tail.push(basename(head));
			head = parent;
		}
	}
}

export function workspaceRelativeTarget(workspaceRoot: string, target: string): string | undefined {
	const requested = normalizeTargetSpelling(target);
	const resolved = isAbsolute(requested) ? resolve(requested) : resolve(workspaceRoot, requested);
	const inside = relative(workspaceRoot, resolved);
	if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return undefined;
	return inside
		.replace(/\\/gu, "/")
		.split("/")
		.map(trimTrailingDotsAndSpaces)
		.join("/")
		.toLowerCase();
}

/** The protected prefix a target falls under, or `undefined`. A prefix matches a file exactly and a subtree. */
export function declaredPrefixHit(prefixes: readonly string[], target: string | undefined): string | undefined {
	if (target === undefined) return undefined;
	return prefixes.find((prefix) => {
		const normalized = normalizeFencePath(prefix).toLowerCase();
		return normalized !== "" && (target === normalized || target.startsWith(normalized + "/"));
	});
}

/**
 * Every target a tool names, or `undefined` when this repository cannot read **any** of them.
 *
 * `undefined` is the fail-closed answer and the caller must not read it as "no target": an unreadable target on a
 * covered tool, or a covered tool called with no target at all, is the case a fence exists for. A list-valued tool
 * (`agent_workspace_patch`) yields `undefined` if **any** of its entries is unreadable, because one unreadable
 * operation in the batch is one write the fence would not have seen.
 *
 * A mode's `fence.targets` entry wins over the built-in map for the same tool: the map is what this repository
 * verified, and the mode is the operator's declaration read before any untrusted content.
 */
type FenceTargets =
	/** The fence has no way to read this tool's target at all. */
	| { readonly kind: "uncovered" }
	/** The tool is covered, and this call does not carry a target the fence can read. */
	| { readonly kind: "unreadable" }
	| { readonly kind: "targets"; readonly targets: readonly string[] };

function fenceTargetsOf(mode: WorkMode, invocation: GateInvocation): FenceTargets {
	const declared = mode.fence?.targets?.[invocation.tool];
	const spec = declared === undefined ? FENCE_TARGETS[invocation.tool] : { at: declared };
	if (spec === undefined) return { kind: "uncovered" };
	const raw = readArgumentPath(invocation.arguments, spec.at);
	if (spec.each === undefined) {
		return typeof raw === "string" && raw.trim() !== "" ? { kind: "targets", targets: [raw] } : { kind: "unreadable" };
	}
	if (!Array.isArray(raw)) return { kind: "unreadable" };
	const targets: string[] = [];
	for (const entry of raw) {
		const value = readArgumentPath(entry, spec.each);
		// One unreadable operation in the batch is one write the fence would not have seen, so the whole call is
		// unreadable rather than partially classified.
		if (typeof value !== "string" || value.trim() === "") return { kind: "unreadable" };
		targets.push(value);
	}
	return { kind: "targets", targets };
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
	const { mode, workspaceRoot } = options;
	// Canonicalized once: the fence is the only consumer, and paying a realpath of the root on every call for an
	// answer that cannot change while the policy lives would be a cost with no reading behind it.
	const canonicalWorkspaceRoot = canonicalTarget(workspaceRoot);
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

	/**
	 * Whether adding this call crosses a ceiling the session has already spent against.
	 *
	 * Returns `undefined` when nothing is crossed, and when the value cannot be read: the per-call gate reports
	 * an absent or non-numeric argument, and reporting it twice would name two reasons for one defect.
	 */
	const cumulativeLimitBreach = (invocation: GateInvocation): GateDecision | undefined => {
		for (const limit of declaredLimits) {
			if (limit.max === undefined) continue;
			if (!limitApplies(limit, invocation.tool)) continue;
			const value = Number(readArgumentPath(invocation.arguments, limit.argument));
			if (!Number.isFinite(value)) continue;
			const already = limitSums[limit.id] ?? 0;
			if (already + value > limit.max) {
				return {
					outcome: "block",
					reason: `Limit '${limit.id}' under mode '${mode.id}' is a ceiling per call and per session: ${already} has already run in this session, and this call's ${value} would take the total to ${already + value}, above ${limit.max}.`,
					remediation: `Do it in one call inside the ceiling, or raise the ceiling through the authority document deliberately rather than in steps the boundary cannot read as one action.`,
				};
			}
		}
		return undefined;
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
			// How many calls this session has already made in the second ending at this invocation's instant. The window
			// uses the invocation's own `at` rather than the wall clock, which is what makes the cap reproducible and
			// testable - the same reason the intensity count is carried rather than looked up somewhere.
			requestsInLastSecond: runInstants.filter((instant) => {
				const delta = Date.parse(invocation.at) - Date.parse(instant);
				return Number.isFinite(delta) && delta >= 0 && delta <= RATE_WINDOW_MS;
			}).length,
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

	/**
	 * A target the mode excludes, refused before anything else can allow it.
	 *
	 * The target is resolved the way the conformance request resolves it - `target_argument`, the one declaration of
	 * what an action acts *on* - and matched as written. A mode that names no exclusions, or a call whose target cannot
	 * be established, is left to the checks that own those questions; this one answers only "is this target on the
	 * list the mode gave", and a list entry that matches nothing refuses nothing, which is what it did before.
	 */
	const excludedTargetDecision = (invocation: GateInvocation): GateDecision => {
		const exclusions = mode.scopeExclusions;
		const declared = mode.targetArgument;
		if (exclusions === undefined || exclusions.length === 0 || declared === undefined) return { outcome: "allow" };
		// **The names belong to the document, not only to the call.** A mode excludes a target *id*; a call may name the
		// same target by id or by address, and the engagement document is where those two are one thing. Comparing the
		// strings literally was the first version, and it let `exclusions: [local]` refuse `local` while passing the
		// identical target under its id - a match that only held when the caller happened to spell it the same way.
		const resolved = invocation.target;
		const named = readArgumentPath(invocation.arguments, declared);
		const candidates = [resolved, named].filter((value): value is string => typeof value === "string" && value.trim() !== "").map((value) => value.trim());
		const targets = options.authorityDocument?.targets ?? [];
		const target = candidates.find(
			(candidate) =>
				exclusions.includes(candidate) ||
				targets.some((entry) => (entry.id === candidate || entry.address === candidate) && (exclusions.includes(entry.id) || exclusions.includes(entry.address))),
		);
		if (target === undefined) return { outcome: "allow" };
		return {
			outcome: "block",
			reason: `Target '${target}' is on mode '${mode.id}'s exclusions list.`,
			remediation: "Choose a target the mode does not exclude, or change the mode's scope deliberately rather than around it.",
		};
	};

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
	// **The second accumulator: what each declared ceiling has already had spent against it this session.**
	// A ceiling is per call *and* per session - a sequence of calls each inside the ceiling is exactly what the
	// measured evasion looks like from the outside - and the window is the session because that is where this
	// state lives, apart from the message history that a retry can outlive.
	const declaredLimits = mode.limits ?? [];
	const limitSums: Record<string, number> = {};
	// **The third accumulator: when each permitted action ran.** A rate is a count over a *window*, so it needs the
	// instants rather than a total - which is why this is not another number. Kept short on purpose: a window is one
	// second, and a buffer that grew with the session would be a leak with no reading behind it.
	const runInstants: string[] = [];
	const RATE_WINDOW_MS = 1_000;
	// **Sized from the largest cap the document declares, not from a constant.** A rate can only be counted exactly up
	// to what the ring holds, and refused calls are never recorded - so a window can never hold more than the cap
	// itself, which makes a ring of that size exact. A fixed 64 was not: every cap at or above it read low in a burst
	// and passed, which is the defect this very control exists to remove, one line inside it.
	const RATE_BUFFER = Math.max(
		64,
		...((options.authorityDocument?.grants ?? []).map((grant) => grant.constraints?.max_requests_per_second ?? 0)),
	);
	const limitScopes = new Map(declaredLimits.map((limit) => [limit.id, limit.tools === undefined ? undefined : new Set(limit.tools)]));
	/**
	 * Whether a declared limit governs this tool. One predicate, because the check and the recording have to agree
	 * about who spends a ceiling: a limit recorded against every tool and checked against one would refuse the very
	 * call it had just judged to be inside its limit.
	 */
	const limitApplies = (limit: LimitSpec, tool: string): boolean => {
		const tools = limitScopes.get(limit.id);
		return tools === undefined || tools.has(tool);
	};
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
			// Checked here rather than earlier: `deny` is the first decision a mode makes about an action, so an action
			// its permissions deny is reported as denied, not as an excluded target.
			const exclusion = excludedTargetDecision(invocation);
			if (exclusion.outcome === "block") return labelled(exclusion, "scope");
			// **The fence, and it is checked before every control whose configuration this run could have
			// influenced.** Its subject is the harness itself - the policy, the verifier and the ledger are what it
			// protects - so it cannot run after something that this run may have softened. It is also the only
			// control here whose absence is safe by construction: a mode with no `fence` block makes no claim, and
			// this whole branch disappears with it.
			//
			// Three ways to be refused, named by the tags `fenceTargetsOf` returns so the comment cannot drift from
			// the code: a target that falls inside a protected prefix, a covered tool whose target cannot be read
			// (`unreadable`), and a tool that mutates by a route the fence has no map for (`uncovered`). Refusing the third rather than allowing it
			// is the whole design: this repository can read three tool schemas out of the 57 names its host has
			// installed, so "the rest write somewhere harmless" is a claim it cannot back.
			const fence = mode.fence;
			if (fence !== undefined) {
				const shellTool = invocation.tool === "bash" || invocation.tool === "powershell";
				if (fence.shell === "denied" && shellTool) {
					return labelled(
						{
							outcome: "block",
							reason: `Mode '${mode.id}' declares 'fence.shell: denied' and '${invocation.tool}' can write anywhere in the workspace, including the paths the fence protects.`,
							remediation: "Run the command's work through a tool that names its target, or change the mode's fence.shell to 'uncovered' deliberately rather than around it.",
						},
						"fence",
					);
				}
				if (!shellTool) {
					const resolved = fenceTargetsOf(mode, invocation);
					if (resolved.kind === "uncovered") {
						// A tool that mutates by a route this repository cannot read is refused rather than assumed
						// harmless: it can read three of the 57 tool schemas its host has installed.
						if (FENCE_MUTATION_TOOLS.has(invocation.tool)) {
							return labelled(
								{
									outcome: "block",
									reason: `Mode '${mode.id}' declares a 'fence' and '${invocation.tool}' changes the workspace by a route the fence cannot read, so it would write into the protected paths unseen.`,
									remediation: `Declare 'fence.targets.${invocation.tool}' naming the argument that carries its target, or remove the 'fence' block if this mode protects nothing.`,
								},
								"fence",
							);
						}
					} else if (resolved.kind === "unreadable") {
						return labelled(
							{
								outcome: "block",
								reason: `Mode '${mode.id}' declares a 'fence' and this '${invocation.tool}' call names no target the runtime can read, so the write cannot be classified against it.`,
								remediation: "Call the tool with the argument that names its target, or remove the 'fence' block if this mode protects nothing.",
							},
							"fence",
						);
					} else {
						for (const target of resolved.targets) {
							// **The fence asks the filesystem, not only the string.** Both sides are canonicalized so
							// that two spellings of one location - a junction inside the workspace, or a workspace root
							// that is itself reached through one - are compared as the location they name.
							const spelled = isAbsolute(target) ? target : resolve(workspaceRoot, target);
							const canonicalSpelled = canonicalTarget(spelled);
							const relativeTarget = workspaceRelativeTarget(canonicalWorkspaceRoot, canonicalSpelled);
							// **A target outside the workspace has no workspace-relative form, and that used to be the end
							// of the comparison** - the fence saw `undefined` and let the write through, which is how the
							// trace channel's own directory stayed writable under three of the four shipped modes. The
							// runtime's state root is not in the workspace, so a fence that can only be spelled relative to
							// one cannot protect it. An absolute entry survives normalisation unchanged, so the two sides
							// are compared as the locations they name: canonical, slash-separated, lowercased, exactly the
							// shape `workspaceRelativeTarget` produces for the inside case.
							//
							// Inside the workspace nothing changes: `relativeTarget` is defined and wins, so a fence entry
							// that happens to be absolute cannot widen or narrow what the relative entries already match.
							const compared = relativeTarget ?? canonicalSpelled.replace(/\\/gu, "/").toLowerCase();
							const hit = declaredPrefixHit(fence.paths, compared);
							if (hit === undefined) continue;
							return labelled(
								{
									outcome: "block",
									reason: `Mode '${mode.id}' declares a 'fence' over '${hit}' and this write lands inside it (${relativeTarget ?? target}), so it would change the harness's own control surface.`,
									remediation: "Write the change somewhere the fence does not protect, or change the mode's fence.paths deliberately rather than around it.",
								},
								"fence",
							);
						}
					}
				}
			}
			// **The runtime's own evidence surface, held by the runtime rather than by a mode's declaration.** A
			// `fence` protects what a mode names, so a mode that names nothing - or the next one somebody adds and
			// forgets - leaves this writable. It is not a mode's to protect: it is where the runtime records what ran,
			// and a mode is one of the things being recorded. No new syntax for a mode author to get wrong, nothing to
			// forget, and no mode can widen it. The prefix is the state directory's parent, so no workspace's records
			// are reachable from another's either.
			//
			// **The tools whose target this repository can read, and only those.** A shell command can write the same
			// path and nothing here can see which path it names; the only control that covers that is a mode giving up
			// the shell, which is the mode's decision and not this one's. That gap is stated in the trace task's
			// limitation rather than asserted closed here.
			const stateRoot = dirname(resolveDoveStateDir(workspaceRoot)).replace(/\\/gu, "/").toLowerCase();
			if (FILESYSTEM_MUTATORS.has(invocation.tool) && !SHELL_TOOLS.has(invocation.tool)) {
				const resolved = fenceTargetsOf(mode, invocation);
				for (const target of resolved.kind === "targets" ? resolved.targets : []) {
					const spelled = isAbsolute(target) ? target : resolve(workspaceRoot, target);
					const canonicalSpelled = canonicalTarget(spelled);
					const compared = workspaceRelativeTarget(canonicalWorkspaceRoot, canonicalSpelled) ?? canonicalSpelled.replace(/\\/gu, "/").toLowerCase();
					if (declaredPrefixHit([stateRoot], compared) === undefined) continue;
					return labelled(
						{
							outcome: "block",
							reason: `'${invocation.tool}' would write inside the runtime's own state root (${compared}), where this run's records live.`,
							remediation: "Write somewhere else. The evidence surface is not the mode's to widen, and no mode can.",
						},
						"fence",
					);
				}
			}
			// **A technique is checked before anything that could allow the call.** `never_allow` names actions; this
			// names how an action runs, and the two are not interchangeable: a probe can be run in many techniques, and
			// forbidding `dos` is a statement about conduct that a permission list over tools cannot make. Checked on
			// raw tools too, because how a command runs is a fact about the call, not about whether it went through the
			// capability tool.
			// **The enforceable half of the sandbox block, at the tool boundary.** A mode that declares
			// `network: none` or `filesystem: read-only-source` is making a claim the policy can keep, and this is
			// where it is kept. The host has already refused the claims it cannot honour (`container`, `worktree`,
			// `allowlist`) at load, so whatever reaches here is a claim the policy can hold.
			const sandbox = mode.sandbox;
			if (sandbox !== undefined) {
				if (sandbox.network === "none" && NETWORK_TOOL_NAMES.has(invocation.tool)) {
					return labelled(
						{
							outcome: "block",
							reason: `Mode '${mode.id}' declares 'sandbox.network: none' and '${invocation.tool}' performs network access.`,
							remediation: "Use a tool that does not leave the machine, or change the mode's sandbox.network deliberately rather than around it.",
						},
						"sandbox",
					);
				}
				if (sandbox.filesystem === "read-only-source" && FILESYSTEM_MUTATORS.has(invocation.tool)) {
					return labelled(
						{
							outcome: "block",
							reason: `Mode '${mode.id}' declares 'sandbox.filesystem: read-only-source' and '${invocation.tool}' mutates the filesystem.`,
							remediation: "Write to the paths the mode's evidence artifacts name instead, or change sandbox.filesystem deliberately rather than around it.",
						},
						"sandbox",
					);
				}
			}
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
			// **The declared field is the caller's account of itself, and a caller who wants to run a forbidden
			// technique can simply not fill it in.** So the same prohibition is also read off the arguments, by shape:
			// `dos` is a *conduct*, and conduct shows in the command line rather than in a field named `technique`.
			// This is the corpus's measured evasion (98% of attempts, 88% succeeding) in its cheapest form, and the
			// answer it names is to decide by syntax rather than by a name match.
			//
			// Scoped to the shell, because that is where a command line is: a document that quotes `while true` is
			// text, and refusing it would be a boundary people turn off.
			if (excludedTechniques !== undefined && SHELL_TOOLS.has(invocation.tool)) {
				const command = readArgumentPath(invocation.arguments, "command");
				if (typeof command === "string" && command !== "") {
					for (const name of excludedTechniques) {
						const witness = TECHNIQUE_WITNESSES[name]?.(command);
						if (witness === undefined) continue;
						return labelled(
							{
								outcome: "block",
								reason: `Technique '${name}' is excluded by mode '${mode.id}', and this command witnesses it: ${witness.witness}.`,
								remediation: witness.remedy,
							},
							"technique",
						);
					}
				}
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
				if (decision.outcome === "block") // The literal, not `limitGate.id`: the call site knows which gate it is evaluating, and the label it writes is the
				// one the vocabulary checks. The behaviour is identical - the factory names that gate `limit`.
				return labelled(decision, "limit");
				// **The per-call gate decides first, so a sequence is only judged once each call in it is
				// legitimate on its own.** That ordering is what keeps the cumulative check from becoming the
				// reason for a defect the threshold gate already names.
				const cumulative = cumulativeLimitBreach(invocation);
				if (cumulative !== undefined) return labelled(cumulative, "limit");
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
				if (decision.outcome === "block") return labelled(decision, "conformance");
			}
			// **Counted here and only here**: every gate above has passed and the action is about to be permitted, so
			// this is the first point at which "ran in this phase" is true. An `ask` returns below without counting,
			// because the operator has not consented yet; a consented re-entry counts then.
			// `intensityOf(invocation)` used to be called here and its result never read: dead in the same sense as the
			// fields this task went after, though nothing was claimed by it.
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
			// The sums are recorded before the phase check, and whether or not the call names a phase: a ceiling
			// on an argument does not depend on the phase machinery, and returning early for a call without one
			// would leave the sequence invisible to the cumulative check. A limit is spent by the tools it names,
			// which is the same predicate the check above applies.
			for (const limit of declaredLimits) {
				if (!limitApplies(limit, invocation.tool)) continue;
				const value = Number(readArgumentPath(invocation.arguments, limit.argument));
				if (!Number.isFinite(value)) continue;
				limitSums[limit.id] = (limitSums[limit.id] ?? 0) + value;
			}
			// **Before the phase check.** A rate cap has nothing to do with phases, and the check below returns early
			// for a call that names no phase, or one the mode does not meter - so a rate recorded after it would miss
			// exactly the calls that make a rate.
			runInstants.push(invocation.at);
			if (runInstants.length > RATE_BUFFER) runInstants.splice(0, runInstants.length - RATE_BUFFER);
			const phase = readArgumentPath(invocation.arguments, "phase");
			if (typeof phase !== "string" || phase.trim() === "" || mode.intensityCeilings === undefined || !(phase in mode.intensityCeilings)) return;
			// Recorded before the phase check, like the limit sums: a rate cap has nothing to do with phases, and a
			// call without one would otherwise be invisible to it.
			phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
		},

		/** The counts so far, keyed by phase, for a caller that builds the next invocation's `accumulatedIntensity`. */
		counts(): Readonly<Record<string, number>> {
			return { ...phaseCounts };
		},
	};
}