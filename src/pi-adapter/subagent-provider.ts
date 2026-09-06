import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import type { SubagentCapability, SubagentLaunch, SubagentProvider, SubagentRequest, SubagentTerminal } from "../core/subagent.ts";

const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"] as const;
const MAX_PROMPT_CHARS = 32_000;
const MAX_OUTPUT_CHARS = 256_000;

export interface PiChildCommand {
	readonly executable: string;
	readonly prefixArgs: readonly string[];
}

interface RunningChild<TResult> {
	readonly dispatchId: string;
	readonly process: ChildProcessWithPipes;
	readonly result: Promise<SubagentTerminal<TResult>>;
	terminal?: SubagentTerminal<TResult>;
}

type ChildProcessWithPipes = ChildProcess & {
	readonly stdout: NonNullable<ChildProcess["stdout"]>;
	readonly stderr: NonNullable<ChildProcess["stderr"]>;
};

export interface PiSubagentProviderOptions {
	readonly command: PiChildCommand;
	readonly spawnChild?: (executable: string, args: readonly string[], options: { readonly cwd: string; readonly windowsHide: boolean; readonly stdio: ["ignore", "pipe", "pipe"] }) => ChildProcessWithPipes;
}

/**
 * Resolve an explicitly configured child executable without searching PATH or
 * inheriting a shell command. The host may opt into isolated dispatch by
 * setting DOVE_PI_SUBAGENT_EXECUTABLE; prefix arguments are a JSON string
 * array so each argv element remains separate and shell-free.
 */
export function resolvePiChildCommand(env: NodeJS.ProcessEnv = process.env): PiChildCommand | undefined {
	const executable = env.DOVE_PI_SUBAGENT_EXECUTABLE?.trim();
	if (!executable) return undefined;
	const rawPrefixArgs = env.DOVE_PI_SUBAGENT_PREFIX_ARGS?.trim();
	if (!rawPrefixArgs) return { executable, prefixArgs: [] };
	try {
		const parsed: unknown = JSON.parse(rawPrefixArgs);
		if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) return undefined;
		return { executable, prefixArgs: parsed };
	} catch {
		return undefined;
	}
}

/**
 * Construct the Pi child provider only for an explicit host configuration.
 * Ordinary Pi sessions remain unchanged when the environment is absent or
 * malformed; callers can expose the undefined result in diagnostics and
 * choose inline execution through the core dispatcher.
 */
export function createConfiguredPiSubagentProvider(env: NodeJS.ProcessEnv = process.env): SubagentProvider<string> | undefined {
	const command = resolvePiChildCommand(env);
	return command ? createPiSubagentProvider({ command }) : undefined;
}

function boundedText(value: string): string {
	return value.length <= MAX_OUTPUT_CHARS ? value : `${value.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`;
}

function validateRequest(request: SubagentRequest): void {
	if (!request.name.trim() || request.name.length > 120) throw new Error("Subagent name must be 1-120 characters.");
	if (!request.prompt.trim() || request.prompt.length > MAX_PROMPT_CHARS) throw new Error(`Subagent prompt must be 1-${MAX_PROMPT_CHARS} characters.`);
	if (!request.cwd.trim()) throw new Error("Subagent cwd is required.");
	const allowed = new Set<SubagentCapability>(READ_ONLY_TOOLS);
	if (request.capabilities.some((capability) => !allowed.has(capability))) throw new Error("Subagent provider only permits read-only capabilities.");
}

export function createPiSubagentProvider(options: PiSubagentProviderOptions): SubagentProvider<string> {
	const spawnChild = options.spawnChild ?? ((executable, args, spawnOptions) => spawn(executable, [...args], spawnOptions) as ChildProcessWithPipes);
	const runs = new Map<string, RunningChild<string>>();

	return {
		async inspect() {
			try {
				await access(options.command.executable);
				return { available: true, provider: "pi-child" };
			} catch {
				return { available: false, provider: "pi-child", reason: "Pi child executable is unavailable." };
			}
		},
		async launch(request) {
			validateRequest(request);
			const runId = `pi-child-${request.dispatchId}`;
			if (runs.has(runId)) throw new Error("Subagent dispatch is already running.");
			const args = [
				...options.command.prefixArgs,
				"--mode", "text",
				"--print",
				"--no-session",
				"--no-extensions",
				"--tools", READ_ONLY_TOOLS.join(","),
			];
			if (request.provider?.name) args.push("--provider", request.provider.name);
			if (request.provider?.model) args.push("--model", request.provider.model);
			if (request.provider?.effort) args.push("--thinking", request.provider.effort);
			args.push("--", request.prompt);
			let child: ChildProcessWithPipes;
			try {
				child = spawnChild(options.command.executable, args, { cwd: request.cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
			} catch (error) {
				throw new Error(`Unable to start Pi child: ${error instanceof Error ? error.message : String(error)}`);
			}
			const result = new Promise<SubagentTerminal<string>>((resolve) => {
				let stdout = "";
				let stderr = "";
				child.stdout.on("data", (chunk: Buffer | string) => { stdout = `${stdout}${chunk}`.slice(0, MAX_OUTPUT_CHARS + 1); });
				child.stderr.on("data", (chunk: Buffer | string) => { stderr = `${stderr}${chunk}`.slice(0, MAX_OUTPUT_CHARS + 1); });
				child.once("error", (error) => resolve({ runId, dispatchId: request.dispatchId, state: "failed", error: { code: "child_spawn", summary: boundedText(error.message), retryable: true } }));
				child.once("close", (code, signal) => {
					if (signal) {
						resolve({ runId, dispatchId: request.dispatchId, state: "cancelled", error: { code: "child_cancelled", summary: `Pi child terminated by ${signal}.`, retryable: true } });
					} else if (code === 0 && stdout.trim()) {
						resolve({ runId, dispatchId: request.dispatchId, state: "succeeded", value: boundedText(stdout.trim()) });
					} else {
						resolve({ runId, dispatchId: request.dispatchId, state: "failed", error: { code: "child_exit", summary: boundedText(stderr.trim() || `Pi child exited with code ${String(code)}.`), retryable: code !== 0 } });
					}
				});
			});
			runs.set(runId, { dispatchId: request.dispatchId, process: child, result });
			return { runId, provider: "pi-child", state: "running", acceptedAt: new Date().toISOString() } satisfies SubagentLaunch;
		},
		async collect(runId, signal) {
			const run = runs.get(runId);
			if (!run) return { runId, dispatchId: "unknown", state: "failed", error: { code: "unknown_run", summary: "Subagent run was not found.", retryable: false } };
			if (run.terminal) return run.terminal;
			if (signal?.aborted) run.process.kill();
			const terminal = await run.result;
			run.terminal = terminal;
			return terminal;
		},
		async cancel(runId) {
			const run = runs.get(runId);
			if (!run) return { runId, dispatchId: "unknown", state: "failed", error: { code: "unknown_run", summary: "Subagent run was not found.", retryable: false } };
			if (!run.terminal) run.process.kill();
			const terminal = await run.result;
			// A cancellation request that races with a successful child must not rewrite
			// the already-published answer.
			run.terminal = terminal;
			return terminal;
		},
	};
}
