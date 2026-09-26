import { Agent, type AgentMessage, type AgentTool, type BeforeToolCallResult, type StreamFn } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ActionGate, AgentLoop, GateDecision, GateInvocation, LoopMessage, LoopOutcome, LoopStopReason } from "../core/loop.ts";
import type { ModeIdentity } from "../core/effect-ledger.ts";

/**
 * The `pi-agent-core` adapter: the framework's {@link AgentLoop} implemented by an external loop.
 *
 * This exists to prove the interface is an interface rather than a class. If `AgentLoop` could only be
 * satisfied by this framework's own runner, it would not be a contract, and the reversibility that
 * design decision 10.1 bought would be imaginary. Pi's thin `Agent` is a genuinely different
 * implementation - it owns retries, streaming, steering queues and its own transcript - so wiring our
 * gate into it is a real test of the boundary.
 *
 * **What is deliberately not bridged.** Pi's `streamFn` returns a Pi-ai `AssistantMessageEventStream`,
 * not this framework's {@link import("../core/loop.ts").LoopProvider}. Translating between them would
 * mean building Pi-ai partial `AssistantMessage` objects, which couples this file to a pre-1.0
 * package's message protocol for no benefit: in production the caller supplies a `streamFn` from
 * Pi-ai's own provider catalog. The provider abstraction therefore differs per loop implementation,
 * which is fine - the interface is `AgentLoop`, not the provider.
 *
 * **The gate is installed where it actually blocks.** Pi's `beforeToolCall` runs after argument
 * validation and returns `{block: true}` to prevent execution, which is the same pre-execution,
 * parameter-level boundary the reference loop enforces. The two framework-level guards the reference
 * loop applies - a target/display mismatch, and treating an unrecognised decision as a block - are
 * applied here too, so **the gate** behaves the same in both loops.
 *
 * That is as far as the equivalence goes, and the sentence used to end one claim further: "so the
 * guarantees do not depend on which loop is running" is broader than its own premise. This adapter has
 * **no dispatch line of its own to take an effect claim at** (see `refusedEffects` below), so at-most-once
 * dispatch belongs to the reference loop and to the host, not to this adapter. Two comments in one file
 * disagreeing about what is guaranteed is the defect this statement was corrected for.
 */
export interface PiAgentLoopOptions {
	/** Caller-supplied model transport. In production this comes from Pi-ai's provider catalog. */
	readonly streamFn: StreamFn;
	readonly model: Model<Api>;
	readonly mode: ModeIdentity;
	readonly systemPrompt: string;
	readonly tools: readonly AgentTool[];
	readonly gate?: ActionGate;
	readonly maxTurns: number;
	readonly resolveTarget?: (call: { readonly name: string; readonly arguments: unknown }) => { readonly target: string; readonly displayTarget: string } | undefined;
	/** Invocation log, called for allowed actions as well as blocked ones. */
	readonly onGateInvoked?: (invocation: GateInvocation, decision: GateDecision) => void;
}

function toLoopMessages(messages: readonly AgentMessage[]): readonly LoopMessage[] {
	const out: LoopMessage[] = [];
	for (const message of messages) {
		if (message.role === "user") {
			const text = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
			out.push({ role: "user", content: text });
		} else if (message.role === "assistant") {
			out.push({ role: "assistant", content: "" });
		} else if (message.role === "toolResult") {
			out.push({ role: "toolResult", callId: message.toolCallId, name: message.toolName, content: "", isError: message.isError === true });
		}
	}
	return out;
}

export function createPiAgentLoop(options: PiAgentLoopOptions): AgentLoop {
	const blockedActions: { tool: string; reason: string }[] = [];
	let executedActions = 0;
	const startedAt = Date.now();

	const decide = async (invocation: GateInvocation): Promise<GateDecision> => {
		if (invocation.target !== undefined && invocation.displayTarget !== undefined && invocation.target !== invocation.displayTarget) {
			return {
				outcome: "block",
				reason: `Target representation mismatch: decision target '${invocation.target}' but the human-visible target is '${invocation.displayTarget}'.`,
				remediation: "Resolve both representations to the same canonical resource before retrying.",
			};
		}
		if (options.gate === undefined) return { outcome: "allow", reason: "no gate configured" };
		try {
			const decision = await options.gate.evaluate(invocation);
			if (decision === null || typeof decision !== "object" || (decision.outcome !== "allow" && decision.outcome !== "block")) {
				return { outcome: "block", reason: `Gate '${options.gate.id}' returned an unrecognised decision.`, remediation: "Fix the gate so it returns allow or block." };
			}
			return decision;
		} catch (error) {
			return { outcome: "block", reason: `Gate '${options.gate.id}' threw: ${error instanceof Error ? error.message : String(error)}`, remediation: "Fix the gate. An unevaluable action is never allowed." };
		}
	};

	const agent = new Agent({
		streamFn: options.streamFn,
		initialState: { systemPrompt: options.systemPrompt, model: options.model, tools: [...options.tools] },
		beforeToolCall: async (context): Promise<BeforeToolCallResult | undefined> => {
			const resolved = options.resolveTarget?.({ name: context.toolCall.name, arguments: context.args });
			const invocation: GateInvocation = {
				tool: context.toolCall.name,
				arguments: context.args,
				...(resolved === undefined ? {} : { target: resolved.target, displayTarget: resolved.displayTarget }),
				mode: options.mode,
				at: new Date().toISOString(),
				elapsedMs: Date.now() - startedAt,
				accumulatedIntensity: {},
			};
			const decision = await decide(invocation);
			options.onGateInvoked?.(invocation, decision);
			if (decision.outcome === "block") {
				blockedActions.push({ tool: context.toolCall.name, reason: decision.reason });
				return { block: true, reason: `${decision.reason} Do this instead: ${decision.remediation}` };
			}
			executedActions += 1;
			return undefined;
		},
	});

	return {
		async run(input: string, signal?: AbortSignal): Promise<LoopOutcome> {
			void signal;
			await agent.prompt(input);
			const state = agent.state;
			const errorMessage = state.errorMessage;
			const stopReason: LoopStopReason = errorMessage === undefined ? { kind: "completed" } : { kind: "providerError", error: errorMessage };
			// This adapter drives the host's agent, which owns its own tool dispatch, so it has no dispatch line of
			// its own to claim at. `refusedEffects` is empty because nothing is claimed here - not because nothing
			// was refused - and this adapter is on the harness task's reachability allow-list for the same reason.
			return { stopReason, messages: toLoopMessages(state.messages), executedActions, blockedActions: [...blockedActions], refusedEffects: [] };
		},
	};
}