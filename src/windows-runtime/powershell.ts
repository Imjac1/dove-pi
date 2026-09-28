import { spawn } from "node:child_process";

export interface PowerShellResult {
	readonly executable: string;
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly durationMs: number;
	readonly interrupted: boolean;
}

export interface PowerShellOptions {
	readonly cwd?: string;
	readonly timeoutMs?: number;
	readonly signal?: AbortSignal;
}

function executableCandidates(): string[] {
	return process.platform === "win32" ? ["pwsh.exe", "powershell.exe"] : ["pwsh", "powershell"];
}

export async function runPowerShell(script: string, options: PowerShellOptions = {}): Promise<PowerShellResult> {
	const candidates = executableCandidates();
	const started = Date.now();
	for (const executable of candidates) {
		try {
			return await runWithExecutable(executable, script, options, started);
		} catch (error) {
			if (!isMissingExecutable(error) || executable === candidates.at(-1)) throw error;
		}
	}
	throw new Error("No PowerShell executable was available");
}

function runWithExecutable(executable: string, script: string, options: PowerShellOptions, started: number): Promise<PowerShellResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
			cwd: options.cwd,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let interrupted = false;
		let timer: NodeJS.Timeout | undefined;
		const abort = () => {
			interrupted = true;
			// **A killed child may already be gone, or may never have started.** A pre-aborted signal reaches here immediately
			// after `spawn`, and killing a process that has not started raises `EINVAL` on Windows - asynchronously, so it
			// escapes as an unhandled error rather than reaching the caller as a rejection. The interruption is already
			// recorded above, which is what the caller reads, so a failure to signal is not worth throwing.
			try {
				child.kill();
			} catch {
				// The child never started or has already exited; `interrupted` already says what happened.
			}
		};
		if (options.signal) {
			if (options.signal.aborted) abort();
			else options.signal.addEventListener("abort", abort, { once: true });
		}
		if (options.timeoutMs && options.timeoutMs > 0) timer = setTimeout(abort, options.timeoutMs);
		child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
		child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
		child.on("error", reject);
		child.on("close", (exitCode) => {
			if (timer) clearTimeout(timer);
			options.signal?.removeEventListener("abort", abort);
			resolve({ executable, exitCode, stdout, stderr, durationMs: Date.now() - started, interrupted });
		});
	});
}

function isMissingExecutable(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
