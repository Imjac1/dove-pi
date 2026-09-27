/**
 * The framework's own agent-loop contract.
 *
 * Ownership boundary (design section 5.1): this framework owns the loop, and the model transport is
 * supplied by the caller. Nothing here selects a provider or knows one exists - a loop implementation
 * is one adapter behind {@link LoopProvider}, which is what makes the adapter choice reversible.
 *
 * The single enforcement point (design section 4) is {@link ActionGate}: a pre-execution,
 * parameter-level check at the tool-dispatch boundary. Every verified blocking gate in the surveyed
 * ecosystem is caller-supplied, so the gate is a first-class option here rather than a callback the
 * provider might or might not honour.
 */

import type { EffectLedger, EffectRecord } from "./effect-ledger.ts";

/** A message as the loop carries it. Provider-specific shapes are produced by {@link LoopProvider}. */
export type LoopMessage =
	| { readonly role: "user"; readonly content: string }
	| { readonly role: "assistant"; readonly content: string; readonly toolCalls?: readonly ToolCall[] }
	| { readonly role: "toolResult"; readonly callId: string; readonly name: string; readonly content: string; readonly isError: boolean };

/** A tool as advertised to the model. Arguments are validated before the gate ever sees them. */
export interface LoopToolSpec {
	readonly name: string;
	readonly description: string;
	/** JSON Schema advertised to the model. Runtime validation remains authoritative. */
	readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface ToolCall {
	readonly callId: string;
	readonly name: string;
	readonly arguments: unknown;
}

export interface ToolResult {
	readonly content: string;
	readonly isError?: boolean;
}

export interface ProviderRequest {
	readonly systemPrompt: string;
	readonly messages: readonly LoopMessage[];
	readonly tools: readonly LoopToolSpec[];
	readonly model: string;
}

export type ProviderEvent =
	| { readonly type: "text"; readonly text: string }
	| { readonly type: "toolCall"; readonly callId: string; readonly name: string; readonly arguments: unknown }
	| { readonly type: "done"; readonly stopReason: "completed" | "toolCalls" | "aborted" | "error"; readonly error?: string };

/**
 * The model transport. Supplied by the caller, never chosen by the loop.
 *
 * A deterministic offline implementation is a first-class citizen here, not a test hack: the paired
 * gate test (design section 4) depends on being able to run the same scripted provider with the gate
 * on and off.
 */
export interface LoopProvider {
	readonly id: string;
	stream(request: ProviderRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent>;
}

// ---------------------------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------------------------

/**
 * What the gate is allowed to decide on.
 *
 * Design section 4.2: a gate that only sees a tool name cannot implement either semantics. It needs
 * the validated arguments, the resolved authority chain for the target, the elapsed window, and the
 * accumulated intensity.
 *
 * Design section 4.2 also requires canonicalisation: `target` and `displayTarget` are the SAME
 * resource expressed twice - once for the decision, once for anything a human sees - and a loop must
 * fail closed when they disagree. GhostApproval is exactly that failure: the model reasoned about the
 * real target while the confirmation prompt displayed a benign name.
 */
export interface GateInvocation {
	readonly tool: string;
	readonly arguments: unknown;
	/** The resource this action resolves to, canonicalised: symlinks, `..`, pseudo-paths resolved. */
	readonly target?: string;
	/** The same resource as it would be shown to a human. Must equal `target` or the gate fails closed. */
	readonly displayTarget?: string;
	/** Work-mode identity, so the evidence record can answer "what was allowed when this ran". */
	readonly mode: { readonly id: string; readonly version: string; readonly governanceVersion: string };
	/** Resolved authority for this target, or undefined when none resolves - which is a block, not a pass. */
	readonly authority?: AuthorityView;
	readonly at: string;
	readonly elapsedMs: number;
	readonly accumulatedIntensity: Readonly<Record<string, number>>;
}

export interface AuthorityView {
	/** Identifiers of the grants that resolved for this target, in resolution order. */
	readonly grantIds: readonly string[];
	/** Typed capabilities held by the issuing agent. Stored outside the model's context. */
	readonly capabilities: readonly string[];
	readonly expiresAt?: string;
}

/**
 * A decision. Every arm is explicit so that "no decision" cannot be confused with "allow".
 *
 * A block carries `remediation`, not only a refusal: the survey found that a bare refusal causes the
 * model to retry the identical action.
 *
 * **`ask` is the arm that says the policy cannot decide alone.** A mode may declare an action as one that
 * runs only with the operator's consent (`permissions.yaml`'s `ask_before`). Whether consent exists is a fact
 * about the *host* - it owns the dialog - so the policy states the requirement and the host resolves it. A
 * consumer with no way to ask must **refuse**: a requirement that cannot be met is not a requirement that is
 * waived, and an `ask` silently treated as an allow is the defect this arm exists to make unrepresentable.
 */
export type GateDecision =
	| { readonly outcome: "allow"; readonly reason?: string }
	| { readonly outcome: "ask"; readonly reason: string; readonly remediation: string }
	| { readonly outcome: "block"; readonly reason: string; readonly remediation: string };

/**
 * The contract's own guard, applied by every loop that consumes a {@link GateDecision}.
 *
 * Two rules, in one place because more than one loop applies them and a second copy is a second thing to get
 * wrong:
 *
 * 1. **An unrecognised shape is a block.** A gate is caller-supplied, so what it returns is not trusted.
 * 2. **`ask` is refused.** The arm means the operator's consent is required, and a loop owns no dialog, so it
 *    cannot put the question. The requirement is not waived by the loop's inability to ask - and this is the
 *    only place that decides so, which is what stops `ask` decaying into an allow in one loop and not another.
 *
 * A host that *can* ask does not call this: it resolves the `ask` itself and then has an allow or a block.
 */
export function normalizeGateDecision(decision: unknown, gateId: string): GateDecision {
	if (decision === null || typeof decision !== "object") {
		return { outcome: "block", reason: `Gate '${gateId}' returned an unrecognised decision.`, remediation: "Fix the gate so it returns {outcome:'allow'}, {outcome:'ask', reason, remediation} or {outcome:'block', reason, remediation}." };
	}
	const candidate = decision as { outcome?: unknown; reason?: unknown; remediation?: unknown };
	if (candidate.outcome === "allow") return { outcome: "allow", ...(typeof candidate.reason === "string" ? { reason: candidate.reason } : {}) };
	// The outcome is checked before the fields, because an unrecognised arm is a different fault from a recognised
	// one that is missing its reason - and the message has to say which, or the reader looks in the wrong place.
	if (candidate.outcome !== "ask" && candidate.outcome !== "block") {
		return { outcome: "block", reason: `Gate '${gateId}' returned an unrecognised decision.`, remediation: "Fix the gate so it returns {outcome:'allow'}, {outcome:'ask', reason, remediation} or {outcome:'block', reason, remediation}." };
	}
	if (typeof candidate.reason !== "string" || typeof candidate.remediation !== "string") {
		return { outcome: "block", reason: `Gate '${gateId}' returned a '${candidate.outcome}' decision with no reason or no remediation.`, remediation: "Fix the gate so every refusal and every request for consent carries both." };
	}
	if (candidate.outcome === "block") return { outcome: "block", reason: candidate.reason, remediation: candidate.remediation };
	return {
		outcome: "block",
		reason: `Gate '${gateId}' requires the operator's confirmation and this loop cannot ask for it: ${candidate.reason}`,
		remediation: "Run the action under a host that can ask the operator, or move the action off the mode's ask_before list deliberately rather than around it.",
	};
}

/**
 * The pre-execution gate.
 *
 * {@link ActionGate.evaluate} is invoked for **every** proposed action, including ones that will be
 * allowed. That is deliberate: the most common failure found in real systems is a gate that exists but
 * is off the path, and an allow-side invocation record is the only way to detect it.
 *
 * Implementations must fail closed. An implementation that cannot evaluate an action returns a block;
 * it must never return allow because it could not decide.
 */
export interface ActionGate {
	// **A gate id is not a refusal label, and typing it as one was wrong.** The loop gate is a general abstraction - the
	// loop gate suite drives it with test doubles whose ids are `test-gate`, `throwing`, `broken` - while the *policy* gates
	// are the ones whose ids reach the ledger. The coupling belongs on the label a refusal carries, which is where it now
	// is (`labelled`), and on the policy gate list, which a test checks at runtime.
	readonly id: string;
	evaluate(invocation: GateInvocation): GateDecision | Promise<GateDecision>;
}

/**
 * A gate that decides synchronously. The loop awaits either shape, but a synchronous gate can be
 * called directly, which is what a pure policy check (limits, authority resolution) actually is.
 * Declaring it separately keeps callers from having to narrow a union they know cannot be a promise.
 */
export interface SynchronousActionGate extends ActionGate {
	evaluate(invocation: GateInvocation): GateDecision;
}

// ---------------------------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------------------------

export interface LoopOptions {
	/**
	 * The at-most-once boundary (design section 5.1). When supplied, every action is claimed at the dispatch
	 * line before it runs and its outcome recorded after; a refused claim does not run and is reported.
	 *
	 * It belongs here, at the only place a tool runs, and **never at an approval boundary** - an approval gate
	 * re-executes whatever sits before it, which is how a gate duplicates an effect.
	 */
	readonly effects?: {
		readonly ledger: EffectLedger;
		/**
		 * The effect a call represents, or `undefined` for a call whose effect is not worth claiming. The caller
		 * owns the identity because it owns the mode, the engagement and the arguments digest; the loop must not
	 * invent an effect key from a tool name.
		 */
		readonly recordOf: (call: ToolCall) => Omit<EffectRecord, "startedAt"> | undefined;
	};
	readonly provider: LoopProvider;
	readonly model: string;
	/** Work-mode identity, stamped on every gate invocation and evidence record (design section 3.4). */
	readonly mode: { readonly id: string; readonly version: string; readonly governanceVersion: string };
	readonly systemPrompt: string;
	readonly tools: readonly LoopToolSpec[];
	/** The single pre-execution boundary. Omitted means every action runs - never omit in production. */
	readonly gate?: ActionGate;
	/** Per-request context rewrite. Runs before every provider call (design section 5.1). */
	readonly transformContext?: (messages: readonly LoopMessage[]) => readonly LoopMessage[];
	/** Post-execution hook: redact or truncate a result before it re-enters the transcript. */
	readonly afterToolCall?: (call: ToolCall, result: ToolResult) => ToolResult;
	readonly executeTool: (call: ToolCall, signal?: AbortSignal) => Promise<ToolResult>;
	/**
	 * Resolve a tool call to the resource it acts on, twice: once canonicalised for the decision and
	 * once as it would be shown to a human. The loop blocks the action when the two disagree
	 * (design section 4.2 - the GhostApproval failure). Omit only when a tool touches no resource.
	 */
	readonly resolveTarget?: (call: ToolCall) => { readonly target: string; readonly displayTarget: string } | undefined;
	/** Turn-stop predicate, evaluated after each turn's tool results are appended. */
	readonly shouldStop?: (state: LoopState) => boolean;
	readonly maxTurns: number;
	/** Invocation log. Called for allowed actions as well as blocked ones. */
	readonly onGateInvoked?: (invocation: GateInvocation, decision: GateDecision) => void;
}

export interface LoopState {
	readonly messages: readonly LoopMessage[];
	readonly turn: number;
	readonly mode: { readonly id: string; readonly version: string; readonly governanceVersion: string };
}

export type LoopStopReason =
	| { readonly kind: "completed" }
	| { readonly kind: "maxTurns" }
	| { readonly kind: "stopped" }
	| { readonly kind: "providerError"; readonly error: string };

export interface LoopOutcome {
	readonly stopReason: LoopStopReason;
	readonly messages: readonly LoopMessage[];
	/** Count of actions that actually reached `executeTool`. The paired gate test asserts on this. */
	readonly executedActions: number;
	readonly blockedActions: readonly { readonly tool: string; readonly reason: string }[];
	/**
	 * Actions the effect boundary refused: already claimed, or claimed with a record that cannot be read.
	 *
	 * Kept apart from `blockedActions` on purpose - a gate refusal and an effect refusal are different
	 * findings, and folding them together would make "the gate stopped this" and "this already ran"
	 * indistinguishable in the evidence.
	 */
	readonly refusedEffects: readonly { readonly tool: string; readonly reason: string }[];
}

/** The loop contract. Implementations live behind this and are replaceable (design section 10.1). */
export interface AgentLoop {
	run(input: string, signal?: AbortSignal): Promise<LoopOutcome>;
}
