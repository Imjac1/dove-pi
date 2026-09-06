/** Host-neutral contract for isolated child work. Core must not import a Pi host. */
export type SubagentCapability = "read" | "grep" | "find" | "ls";
export type SubagentRunState = "launching" | "running" | "succeeded" | "failed" | "cancelled";

export interface SubagentRequest {
	readonly dispatchId: string;
	readonly name: string;
	readonly prompt: string;
	readonly cwd: string;
	readonly capabilities: readonly SubagentCapability[];
	readonly provider?: { readonly name?: string; readonly model?: string; readonly effort?: string };
}

export interface SubagentLaunch {
	readonly runId: string;
	readonly provider: string;
	readonly state: "launching" | "running";
	readonly acceptedAt: string;
}

export interface SubagentTerminal<TResult> {
	readonly runId: string;
	readonly dispatchId: string;
	readonly state: "succeeded" | "failed" | "cancelled";
	readonly value?: TResult;
	readonly error?: { readonly code: string; readonly summary: string; readonly retryable: boolean };
	readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number; readonly wallTimeMs?: number };
}

export interface SubagentProvider<TResult> {
	inspect(): Promise<{ readonly available: boolean; readonly provider: string; readonly reason?: string }>;
	launch(request: SubagentRequest): Promise<SubagentLaunch>;
	collect(runId: string, signal?: AbortSignal): Promise<SubagentTerminal<TResult>>;
	cancel(runId: string): Promise<SubagentTerminal<TResult>>;
}

export function subagentError(terminal: SubagentTerminal<unknown>): Error {
	const code = terminal.error?.code ?? `subagent_${terminal.state}`;
	const summary = terminal.error?.summary ?? `Subagent ended in ${terminal.state} state.`;
	return new Error(`[${code}] ${summary}`);
}
