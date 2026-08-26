import type { CapabilityDefinition } from "../core/contracts.ts";
import type { CapabilityRegistry } from "../core/capability-registry.ts";
import { runPowerShell, type PowerShellResult } from "../windows-runtime/powershell.ts";

export interface DevelopmentCommandResult extends PowerShellResult {
	readonly command: string;
}

const commandCapability = (definition: Omit<CapabilityDefinition, "execute"> & { readonly command: string; readonly timeoutMs: number }): CapabilityDefinition => ({
	name: definition.name,
	version: definition.version,
	description: definition.description,
	platforms: definition.platforms,
	sideEffects: definition.sideEffects,
	idempotent: definition.idempotent,
	status: definition.status,
	async execute(_args, context): Promise<DevelopmentCommandResult> {
		const result = await runPowerShell(definition.command, { cwd: context.cwd, signal: context.signal, timeoutMs: definition.timeoutMs });
		if (result.exitCode !== 0 || result.interrupted) {
			const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
			throw new Error(`${definition.name} failed: ${detail}`);
		}
		return { command: definition.command, ...result };
	},
});

export const developmentCapabilities: readonly CapabilityDefinition[] = [
	commandCapability({
		name: "dev.git_status",
		version: "0.1.0",
		description: "Read the current Git branch and working tree status.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "stable",
		command: "git status --short --branch",
		timeoutMs: 15_000,
	}),
	commandCapability({
		name: "dev.node_version",
		version: "0.1.0",
		description: "Read the active Node.js runtime version.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "stable",
		command: "node --version",
		timeoutMs: 15_000,
	}),
	commandCapability({
		name: "dev.python_version",
		version: "0.1.0",
		description: "Read the active Python runtime version.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "stable",
		command: "python --version",
		timeoutMs: 15_000,
	}),
	commandCapability({
		name: "dev.project_test",
		version: "0.1.0",
		description: "Run the repository's declared npm test script.",
		platforms: ["any"],
		sideEffects: ["workspace_write"],
		idempotent: false,
		status: "stable",
		command: "npm test",
		timeoutMs: 10 * 60 * 1_000,
	}),
	commandCapability({
		name: "dev.npm_install",
		version: "0.1.0",
		description: "Install the repository's declared npm dependencies and update its local dependency tree.",
		platforms: ["any"],
		sideEffects: ["workspace_write"],
		idempotent: true,
		status: "stable",
		command: "npm install",
		timeoutMs: 10 * 60 * 1_000,
	}),
	commandCapability({
		name: "dev.npm_build",
		version: "0.1.0",
		description: "Run the repository's declared npm build script.",
		platforms: ["any"],
		sideEffects: ["workspace_write"],
		idempotent: false,
		status: "stable",
		command: "npm run build",
		timeoutMs: 10 * 60 * 1_000,
	}),
	commandCapability({
		name: "dev.typecheck",
		version: "0.1.0",
		description: "Run the repository's declared npm typecheck script.",
		platforms: ["any"],
		sideEffects: ["read_only"],
		idempotent: true,
		status: "stable",
		command: "npm run typecheck",
		timeoutMs: 10 * 60 * 1_000,
	}),
];

export function registerDevelopmentCapabilities(registry: CapabilityRegistry): void {
	for (const capability of developmentCapabilities) registry.register(capability);
}
