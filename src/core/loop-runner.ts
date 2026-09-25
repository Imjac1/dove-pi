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
 *    authority produces a block with a reason. It never produces an allow (design section 4.3.1).
 * 3. **Canonicalisation mismatch is a block.** When an invocation carries both a decision target and a
 *    human-visible target and they differ, the action is blocked before the gate is consulted. This is
 *    the GhostApproval failure, and it must not depend on the gate remembering to check (design 4.2).
 */
export function createAgentLoop(options: LoopOptions): AgentLoop {
	const messages: LoopMessage[] = [];
	const blockedActions: { tool: string; reason: string }[] = [];
	let executedActions = 0;

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
			const decision = await options.gate.evaluate(invocation);
			// Rule 2: an unknown shape is not an allow.
			if (decision === null || typeof decision !== "object" || (decision.outcome !== "allow" && decision.outcome !== "block")) {
				return {
					outcome: "block",
					reason: `Gate '${options.gate.id}' returned an unrecognised decision.`,
					remediation: "Fix the gate so it returns either {outcome:'allow'} or {outcome:'block', reason, remediation}.",
				};
			}
			return decision;
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
					accumulatedIntensity: {},
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

				executedActions += 1;
				const raw = await options.executeTool(call, signal);
				const result = options.afterToolCall ? options.afterToolCall(call, raw) : raw;
				messages.push({ role: "toolResult", callId: call.callId, name: call.name, content: result.content, isError: result.isError === true });
			}

			if (options.shouldStop?.({ messages: [...messages], turn, mode: options.mode }) === true) {
				stopReason = { kind: "stopped" };
				break;
			}
		}

		return { stopReason, messages: [...messages], executedActions, blockedActions: [...blockedActions] };
	};

	return { run };
}
