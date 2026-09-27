import type {
	ActionGate,
	AgentLoop,
	GateDecision,
	GateInvocation,
	LoopMessage,
	LoopOptions,
	LoopOutcome,
	LoopStopReason,
	ToolCall,
	ToolResult,
} from "./loop.ts";
import { normalizeGateDecision } from "./loop.ts";

/**
 * The reference loop. It owns the model-to-tool cycle and enforces the single pre-execution boundary.
 *
 * Three rules are enforced here rather than delegated to a gate implementation, because a gate author
 * can forget them and the failure is silent:
 *
 * 1. **The gate is invoked for every action, including allowed ones.** The invocation record is the
 *    only defence against a gate that exists but sits off the path - the most common failure found in
 *    real systems (design section 4.3).
 * 2. **Anything unevaluable is a block.** A gate that throws, returns an unknown shape, or resolves no
 *    authority produces a block with a reason. It never produces an allow (design section 4.3.1). A
 *    requirement this loop cannot meet is refused for the same reason: `ask` means the operator must
 *    consent, this loop has no dialog to ask through, and a requirement that cannot be met is not waived.
 * 3. **Canonicalisation mismatch is a block.** When an invocation carries both a decision target and a
 *    human-visible target and they differ, the action is blocked before the gate is consulted. This is
 *    the GhostApproval failure, and it must not depend on the gate remembering to check (design 4.2).
 */
export function createAgentLoop(options: LoopOptions): AgentLoop {
	const messages: LoopMessage[] = [];
	const blockedActions: { tool: string; reason: string }[] = [];
	const refusedEffects: { tool: string; reason: string }[] = [];
	let executedActions = 0;
	// Actions run per phase, keyed by the `phase` argument an action carries. This is what an intensity ceiling is
	// checked against: a ceiling counts *what has run*, so it must outlive a single call while staying scoped to the
	// run that owns it.
	const accumulatedIntensity: Record<string, number> = {};

	const decide = async (invocation: GateInvocation): Promise<GateDecision> => {
		// Rule 3: the two representations of the same resource must agree.
		if (invocation.target !== undefined && invocation.displayTarget !== undefined && invocation.target !== invocation.displayTarget) {
			return {
				outcome: "block",
				reason: `Target representation mismatch: decision target '${invocation.target}' but the human-visible target is '${invocation.displayTarget}'.`,
				remediation: "Resolve both representations to the same canonical resource before retrying, or report the discrepancy instead of acting.",
			};
		}
		if (options.gate === undefined) {
			return { outcome: "allow", reason: "no gate configured" };
		}
		try {
			// Rule 2, both halves, from the contract rather than reimplemented here: an untrusted shape is not an
			// allow, and a requirement this loop cannot meet - `ask`, which needs a dialog it does not have - is
			// refused rather than waived. The host that *can* ask resolves the decision before it reaches a loop.
			return normalizeGateDecision(await options.gate.evaluate(invocation), options.gate.id);
		} catch (error) {
			// Rule 2: a throwing gate fails closed and says so.
			return {
				outcome: "block",
				reason: `Gate '${options.gate.id}' threw: ${error instanceof Error ? error.message : String(error)}`,
				remediation: "Fix the gate. An unevaluable action is never allowed.",
			};
		}
	};

	const run = async (input: string, signal?: AbortSignal): Promise<LoopOutcome> => {
		messages.push({ role: "user", content: input });
		const startedAt = Date.now();
		let turn = 0;
		let stopReason: LoopStopReason = { kind: "maxTurns" };

		for (; turn < options.maxTurns; turn += 1) {
			if (signal?.aborted) {
				stopReason = { kind: "stopped" };
				break;
			}
			const contextMessages = options.transformContext ? [...options.transformContext(messages)] : [...messages];
			const calls: ToolCall[] = [];
			let text = "";
			let providerError: string | undefined;
			let stop: "completed" | "toolCalls" | "aborted" | "error" = "completed";

			for await (const event of options.provider.stream(
				{ systemPrompt: options.systemPrompt, messages: contextMessages, tools: options.tools, model: options.model },
				signal,
			)) {
				if (event.type === "text") text += event.text;
				else if (event.type === "toolCall") calls.push({ callId: event.callId, name: event.name, arguments: event.arguments });
				else {
					stop = event.stopReason;
					providerError = event.error;
				}
			}

			if (stop === "error") {
				stopReason = { kind: "providerError", error: providerError ?? "provider error" };
				break;
			}

			if (calls.length === 0) {
				messages.push({ role: "assistant", content: text });
				stopReason = { kind: "completed" };
				break;
			}

			messages.push({ role: "assistant", content: text, toolCalls: calls });

			for (const call of calls) {
				const resolved = options.resolveTarget?.(call);
				const invocation: GateInvocation = {
					tool: call.name,
					arguments: call.arguments,
					...(resolved === undefined ? {} : { target: resolved.target, displayTarget: resolved.displayTarget }),
					mode: options.mode,
					at: new Date().toISOString(),
					elapsedMs: Date.now() - startedAt,
					// The counts this run has accumulated so far, so an intensity ceiling is checked against what has
					// actually happened rather than restarted on every call.
					accumulatedIntensity,
				};
				const decision = await decide(invocation);
				// Rule 1: record the invocation whether it was allowed or blocked.
				options.onGateInvoked?.(invocation, decision);

				if (decision.outcome === "block") {
					blockedActions.push({ tool: call.name, reason: decision.reason });
					const blocked: ToolResult = {
						content: `Action blocked: ${decision.reason}\nDo this instead: ${decision.remediation}`,
						isError: true,
					};
					messages.push({ role: "toolResult", callId: call.callId, name: call.name, content: blocked.content, isError: true });
					continue;
				}

				// The at-most-once claim, at the only line that runs a tool (design section 5.1). It is here and not
				// at the gate: an approval boundary re-executes whatever sits before it, which duplicates the effect.
				const boundary = options.effects;
				const effect = boundary?.recordOf(call);
				if (boundary !== undefined && effect !== undefined) {
					const claim = await boundary.ledger.begin(effect);
					const refusal =
						claim.unreadable === true
							? "an earlier attempt claimed this effect and its record cannot be read, so whether the effect landed is unknown"
							: claim.claimed === false
								? "this effect was already claimed by an earlier attempt"
								: undefined;
					if (refusal !== undefined) {
						// Refused and reported, never silently skipped: the operator must be able to see that the work did
						// not happen, and the model must not be told that it did. Re-running is the one answer that is wrong
						// in both cases, so the instruction is to report rather than retry.
						refusedEffects.push({ tool: call.name, reason: refusal });
						const refused: ToolResult = {
							content: `Effect refused: ${refusal}.\nDo this instead: report the ambiguity to the operator; do not re-run the action.`,
							isError: true,
						};
						messages.push({ role: "toolResult", callId: call.callId, name: call.name, content: refused.content, isError: true });
						continue;
					}
				}

				executedActions += 1;
				// Counted here, where the action has actually been dispatched - not at the gate, where a decision is
				// only a decision. The phase comes from the same argument the ceiling is keyed by.
				const phase = (call.arguments as Record<string, unknown> | undefined)?.phase;
				if (typeof phase === "string" && phase.trim() !== "") accumulatedIntensity[phase] = (accumulatedIntensity[phase] ?? 0) + 1;
				try {
					const raw = await options.executeTool(call, signal);
					const result = options.afterToolCall ? options.afterToolCall(call, raw) : raw;
					if (boundary !== undefined && effect !== undefined) {
						await boundary.ledger.complete(effect.effectKey, { outcome: result.isError === true ? "failed" : "completed" });
					}
					messages.push({ role: "toolResult", callId: call.callId, name: call.name, content: result.content, isError: result.isError === true });
				} catch (error) {
					if (boundary !== undefined && effect !== undefined) {
						// An abort is not a failure report: the process stopped between the effect and its record, so
						// whether it landed is genuinely unknown. `failed` would assert it did not.
						await boundary.ledger.complete(effect.effectKey, { outcome: signal?.aborted === true ? "unknown" : "failed" });
					}
					throw error;
				}
			}

			if (options.shouldStop?.({ messages: [...messages], turn, mode: options.mode }) === true) {
				stopReason = { kind: "stopped" };
				break;
			}
		}

		return { stopReason, messages: [...messages], executedActions, blockedActions: [...blockedActions], refusedEffects: [...refusedEffects] };
	};

	return { run };
}
