/**
 * The one place that talks to `src/windows-runtime/jailer-host.ps1`.
 *
 * **Why a helper process at all.** Creating a restricted token and launching a process under it is Win32
 * (CreateRestrictedToken / CreateProcessAsUser). Node has no built-in FFI, and a boundary must not live
 * behind a third-party native binding. So the mechanism is a script whose source is in this repository, and
 * every decision about *which* boundary to enforce stays in TypeScript.
 *
 * **Why files instead of stdout.** Under the sandbox this repository is developed in, one process cannot
 * capture another's output through pipes (EPERM on named pipes). The helper therefore takes a request file
 * and writes a result file, and this module reads the file. A *missing* result file is itself a reading: the
 * helper did not run, so nothing about the token may be concluded.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BoundarySpec } from "./types.ts";

/** `pwsh` is not on this machine's PATH (measured); the Windows PowerShell that ships with the OS is. */
export function powershellPath(): string {
	const root = process.env.SystemRoot ?? "C:\\Windows";
	return join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

export interface HostReply {
	readonly ok: boolean;
	/** The parsed result file, when there was one. */
	readonly payload?: Record<string, unknown>;
	/** Set when the helper could not report at all. The caller must then conclude nothing. */
	readonly failure?: string;
	readonly status: number | null;
}

/**
 * Invoke the helper with `request` and read back its result file.
 *
 * `stdio: "ignore"` is deliberate: a piped capture is EPERM under the sandbox, and the helper writes
 * everything to the result file anyway. `status` still arrives, so a helper that died before writing is
 * visible as a missing result *and* a non-zero status.
 */
export function callHost(spec: BoundarySpec, request: Record<string, unknown>, tag: string): HostReply {
	mkdirSync(spec.scratchDir, { recursive: true });
	const requestPath = join(spec.scratchDir, `request-${tag}.json`);
	const resultPath = join(spec.scratchDir, `result-${tag}.json`);
	rmSync(resultPath, { force: true });
	writeFileSync(requestPath, `${JSON.stringify(request)}\n`, "utf8");

	const run = spawnSync(
		powershellPath(),
		["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", spec.hostScript, "-Request", requestPath, "-Result", resultPath],
		{ stdio: "ignore", windowsHide: true, timeout: 300_000 },
	);

	if (!existsSync(resultPath)) {
		return {
			ok: false,
			status: run.status,
			failure: `the helper wrote no result file (status ${String(run.status)}, error ${run.error?.message ?? "none"})`,
		};
	}
	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, unknown>;
	} catch (error) {
		return { ok: false, status: run.status, failure: `the result file could not be read: ${(error as Error).message}` };
	}
	return { ok: payload.ok === true, payload, status: run.status };
}

/** Run a command through `cmd.exe` and return its exit status. Used for `icacls`, whose code is the reading. */
export function runCommandLine(commandLine: string, cwd?: string): number | null {
	const comspec = process.env.ComSpec ?? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe");
	// `windowsVerbatimArguments` is required, not cosmetic: without it Node escapes the inner double quotes it
	// sees in the command line (as `\"`), `cmd.exe` passes them through literally, and `icacls` answers
	// ERROR_INVALID_PARAMETER (measured: exit 87) on a command that works when a person types it.
	const run = spawnSync(comspec, ["/c", commandLine], {
		stdio: "ignore",
		windowsHide: true,
		windowsVerbatimArguments: true,
		cwd,
		timeout: 120_000,
	});
	return run.status;
}
