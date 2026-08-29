import type { CapabilityDefinition } from "../core/contracts.ts";
import type { CapabilityRegistry } from "../core/capability-registry.ts";
import { runPowerShell } from "../windows-runtime/powershell.ts";
import { inspectWorkspacePath } from "../windows-runtime/workspace.ts";

export const hostInfoCapability: CapabilityDefinition = {
	name: "windows.host_info",
	version: "0.1.0",
	description: "Read basic Windows and PowerShell environment information.",
	platforms: ["windows"],
	sideEffects: ["read_only"],
	idempotent: true,
	status: "stable",
	parameterSchema: { type: "object", additionalProperties: false },
	preconditions: [{ id: "powershell", description: "A supported PowerShell executable is available.", required: true }],
	evidence: [{ kind: "summary", description: "Structured PowerShell host information.", required: false }],
	async execute(_args, context) {
		const result = await runPowerShell("$PSVersionTable | ConvertTo-Json -Compress", { cwd: context.cwd, signal: context.signal, timeoutMs: 15_000 });
		if (result.exitCode !== 0) throw new Error(result.stderr || `PowerShell exited with ${result.exitCode}`);
		return { shell: result.executable, powershell: JSON.parse(result.stdout), durationMs: result.durationMs };
	},
};

export const workspaceInspectCapability: CapabilityDefinition = {
	name: "workspace.inspect",
	version: "0.1.0",
	description: "Inspect a workspace path without modifying it.",
	platforms: ["any"],
	sideEffects: ["read_only"],
	idempotent: true,
	status: "stable",
	requiredArgs: ["path"],
	parameterSchema: {
		type: "object",
		properties: { path: { type: "string", minLength: 1, maxLength: 32_768 } },
		required: ["path"],
		additionalProperties: false,
	},
	preconditions: [{ id: "bounded_path", description: "The requested path resolves inside the workspace.", required: true }],
	evidence: [{ kind: "summary", description: "Structured file or directory metadata.", required: false }],
	async execute(args, context) {
		return await inspectWorkspacePath(context.cwd, String((args as { path: unknown }).path));
	},
};

export function registerRuntimeCapabilities(registry: CapabilityRegistry): void {
	registry.register(hostInfoCapability);
	registry.register(workspaceInspectCapability);
}
