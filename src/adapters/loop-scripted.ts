import type { LoopProvider, ProviderEvent, ProviderRequest } from "../core/loop.ts";

/**
 * A deterministic, offline {@link LoopProvider}.
 *
 * Design section 5.1 makes this a first-class citizen rather than a test hack: the paired gate test
 * runs the *same* scripted provider with the gate on and off, so the only variable is the gate. It
 * also lets every later milestone be verified with no network access.
 *
 * The script is consumed one step per provider call. A step either produces assistant text (ending the
 * turn) or a set of tool calls (continuing it).
 */
export type ScriptedStep =
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "tools"; readonly calls: readonly { readonly name: string; readonly arguments: unknown }[] };

export interface ScriptedProviderOptions {
	readonly id?: string;
	readonly steps: readonly ScriptedStep[];
	/** Emitted once the script is exhausted, so a runaway loop is visible rather than silent. */
	readonly onExhausted?: "complete" | "error";
}

export function createScriptedProvider(options: ScriptedProviderOptions): LoopProvider & { readonly callCount: number } {
	const steps = options.steps;
	let index = 0;
	let calls = 0;
	return {
		id: options.id ?? "scripted",
		get callCount(): number {
			return calls;
		},
		async *stream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
			void request;
			calls += 1;
			const step = steps[index];
			index += 1;
			if (step === undefined) {
				yield options.onExhausted === "error"
					? { type: "done", stopReason: "error", error: "scripted provider exhausted" }
					: { type: "done", stopReason: "completed" };
				return;
			}
			if (step.kind === "text") {
				yield { type: "text", text: step.text };
				yield { type: "done", stopReason: "completed" };
				return;
			}
			for (const [position, call] of step.calls.entries()) {
				yield { type: "toolCall", callId: `call-${index}-${position}`, name: call.name, arguments: call.arguments };
			}
			yield { type: "done", stopReason: "toolCalls" };
		},
	};
}
