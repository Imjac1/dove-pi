import type { CapabilityDefinition } from "../core/contracts.ts";
import type { CapabilityRegistry } from "../core/capability-registry.ts";
import { runVerificationLadder } from "../core/verification-ladder.ts";
import { runPowerShell, type PowerShellResult } from "../windows-runtime/powershell.ts";

/**
 * What a command's own output claims, where that can be read.
 *
 * Deliberately narrow: a claim is extracted only from a summary line stating a failure count, so a command with no
 * such line is left un-cross-checked rather than assumed to have passed. `npm test` prints one; `git status` does
 * not, and inventing a claim for it would be putting words in its output.
 */
function claimedOutcome(result: PowerShellResult): "pass" | "fail" | undefined {
	const match = /^[^a-z]*fail(?:ed|ures?)?\s*[:=]?\s*(\d+)\s*$/im.exec(result.stdout);
	if (match === null) return undefined;
	return Number(match[1]) === 0 ? "pass" : "fail";
}

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
	hintCommands: [definition.command],
	// Carried through rather than dropped by this factory, and declared rather than left to the attempt:
	// `dove-pi capability list` prints preconditions, so a reader meets a dependency before running the command
	// instead of inferring it from a failure. Nothing enforces them - the same stance `windows.host_info` takes with
	// its PowerShell precondition - which is why each one names what the command needs, not what this runtime checked.
	...(definition.preconditions ? { preconditions: definition.preconditions } : {}),
	async execute(_args, context): Promise<DevelopmentCommandResult> {
		const result = await runPowerShell(definition.command, { cwd: context.cwd, signal: context.signal, timeoutMs: definition.timeoutMs });
		// The verdict goes through the ladder rather than being read off the exit status alone: the status and the
		// output can disagree, and where they do it is the output that says what happened. The rung's name travels in
		// the failure so a reader can see *which* check decided it.
		const claimed = claimedOutcome(result);
		const verdict = await runVerificationLadder([
			{
				name: `${definition.name}:exit-status`,
				cost: 1,
				async run() {
					return {
						...(result.interrupted ? {} : { exitStatus: result.exitCode }),
						...(claimed === undefined ? {} : { claimedOutcome: claimed }),
						detail: result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`,
					};
				},
			},
		]);
		if (verdict.outcome !== "pass") {
			throw new Error(`${definition.name} failed (${verdict.decidedBy ?? "unscored"}): ${verdict.attempted[verdict.attempted.length - 1]?.detail ?? "no rung could decide it"}`);
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
		preconditions: [{ id: "git", description: "A git executable is on PATH, and the directory is inside a working tree.", required: true }],
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
		preconditions: [{ id: "node", description: "A Node.js runtime is on PATH.", required: true }],
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
		preconditions: [{ id: "python", description: "A Python runtime is on PATH under the name this command uses.", required: true }],
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
		preconditions: [
			{ id: "package_json", description: "The project declares a test script in package.json.", required: true },
			{ id: "npm", description: "npm is on PATH.", required: true },
		],
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
		preconditions: [
			{ id: "package_json", description: "The project has a package.json to install from.", required: true },
			{ id: "npm", description: "npm is on PATH.", required: true },
		],
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
		preconditions: [
			{ id: "package_json", description: "The project declares a build script in package.json.", required: true },
			{ id: "npm", description: "npm is on PATH.", required: true },
		],
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
		preconditions: [
			{ id: "package_json", description: "The project declares a typecheck script in package.json.", required: true },
			{ id: "npm", description: "npm is on PATH.", required: true },
		],
	}),
];

export function registerDevelopmentCapabilities(registry: CapabilityRegistry): void {
	for (const capability of developmentCapabilities) registry.register(capability);
}
