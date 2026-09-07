import {
	createProjectProvider,
	initializeNativeProject,
	summarizeProjectContinuation,
	updateProjectManifest,
} from "./project-provider/index.ts";
import { inspectWindowsEnvironment } from "./windows-runtime/doctor.ts";
import {
	EXTENSION_CATALOG,
	getProfilePackages,
	type ExtensionProfile,
} from "./extensions/catalog.ts";
import {
	inspectExtensionProfile,
	parseExtensionProfile,
} from "./extensions/doctor.ts";
import {
	inspectWebAccessReadiness,
	writeWebSearchConfig,
} from "./web-access/config.ts";
import { installExtensionProfile } from "./extensions/install.ts";
import { getPiVersion } from "./pi-adapter/host-version.ts";
import { discoverSkills } from "./skills/discovery.ts";
import { inspectProjectStatus } from "./project-status.ts";
import { runTokenAudit, formatTokenAudit } from "./commands/token-audit.ts";
import { runCacheAudit, formatCacheAudit } from "./commands/cache-audit.ts";
import { inspectManagedInstall } from "./managed-install-status.ts";
import { join } from "node:path";
import { LocalCapabilityAdapter, runLocalRpcStdio } from "./adapters/local-rpc.ts";
import { CAPABILITY_PROTOCOL_VERSION } from "./core/capability-protocol.ts";
import { runDoveMcpStdio } from "./adapters/mcp.ts";
import { readInteroperableContextProjection } from "./context/interoperable.ts";
import { resolveDoveStateDir } from "./core/state-dir.ts";
import { parseNonNegativeHours } from "./commands/cli-options.ts";
import { runTaskCommand } from "./commands/task.ts";
import { runSessionCommand } from "./commands/session.ts";
import { ExecutionLedger, projectExecutionDiagnostics } from "./core/execution-ledger.ts";
import { createConfiguredPiSubagentProvider, resolvePiChildCommand } from "./pi-adapter/subagent-provider.ts";
import { normalizeWorkspaceMode, readWorkspacePolicy, resolveWorkspaceRoot, writeWorkspacePolicy } from "./core/workspace-policy.ts";
import { inspectShellConfig, setShellPath, type ShellConfigScope } from "./pi-adapter/shell-config.ts";

const args = process.argv.slice(2);
let cliFailureEmitted = false;

function emitCliFailure(reason: unknown): void {
	if (cliFailureEmitted) return;
	cliFailureEmitted = true;
	const message = reason instanceof Error ? reason.message : String(reason);
	const payload = JSON.stringify({ ok: false, error: { code: "CLI_ERROR", message } });
	// JSON-RPC and MCP own stdout as a protocol stream. Never contaminate it
	// with a human/JSON wrapper error when their startup fails.
	const command = args.find((arg) => !arg.startsWith("-"));
	if (command !== "rpc" && command !== "mcp") console.log(payload);
	console.error(message);
	process.exitCode = 1;
}

process.on("uncaughtException", (error) => emitCliFailure(error));
process.on("unhandledRejection", (reason) => emitCliFailure(reason));

if (args[0] === "doctor") {
	const provider = createProjectProvider(process.cwd());
	const health = provider.getHealth();
	const context = provider.getContext();
	const powershell = await inspectWindowsEnvironment(process.cwd());
	const managedInstall = inspectManagedInstall();
	const managedInstallDiagnostics = managedInstall.sourceDrift === "drifted"
		? ["Managed Dove release differs from the current source checkout. Run 'dove-pi update' for a release update or 'python dove_pi.py install' to refresh from this checkout."]
		: [];
	const extensions = await inspectExtensionProfile("max", { cwd: process.cwd(), piVersion: getPiVersion(), checkExecutables: false });
	const interoperableContext = readInteroperableContextProjection(provider);
	const diagnostics = projectExecutionDiagnostics(await new ExecutionLedger(localLedgerPath()).read());
	const subagentConfiguration = resolvePiChildCommand();
	const configuredSubagent = createConfiguredPiSubagentProvider();
	const subagentHealth = configuredSubagent
		? await configuredSubagent.inspect()
		: { available: false, provider: "pi-child", reason: subagentConfiguration ? "invalid child configuration" : "DOVE_PI_SUBAGENT_EXECUTABLE is not configured" };
	console.log(
		JSON.stringify(
			{
				node: process.version,
				platform: process.platform,
				shell: inspectShellConfig(process.cwd()),
				workspace: (() => { const policy = readWorkspacePolicy(process.cwd()); return { root: policy.workspaceRoot, mode: policy.policy.mode, source: policy.source, malformed: policy.malformed, lensEnabledOnNextSession: policy.policy.mode === "development" }; })(),
				powershell,
				managedInstall,
				diagnostics: managedInstallDiagnostics,
				adapters: {
					protocolVersion: CAPABILITY_PROTOCOL_VERSION,
					pi: { status: "available", version: getPiVersion() },
					cliRpc: { status: "available", transport: "local-jsonl-stdio" },
					mcp: { status: "available", transport: "stdio", sdk: "@modelcontextprotocol/sdk" },
				},
				hostCapabilities: extensions.capabilities,
				contextAuthorities: { authorities: interoperableContext.authorities, conflicts: interoperableContext.conflicts },
				requestDiagnostics: diagnostics,
				subagent: {
					provider: subagentHealth.provider,
					configured: Boolean(subagentConfiguration),
					available: subagentHealth.available,
					reason: subagentHealth.reason,
					activeRuns: 0,
					lastTerminal: undefined,
				},
				project: {
					...health,
					currentTask: context.currentTask,
					continuation: summarizeProjectContinuation(context),
					taskCount: context.tasks.length,
					revision: context.revision,
				},
			},
			null,
			2,
		),
	);
} else if (args[0] === "project") {
	const provider = createProjectProvider(process.cwd());
	if (args[1] === "bind") {
		const requestedProvider = args[2];
		if (requestedProvider !== "native") throw new Error("Usage: dove-pi project bind native");
		await updateProjectManifest(provider.projectRoot, "native");
		const rebound = createProjectProvider(provider.projectRoot);
		console.log(
			JSON.stringify(
				{
					provider: requestedProvider,
					projectRoot: provider.projectRoot,
					restartRequired: false,
					project: inspectProjectStatus(rebound),
				},
				null,
				2,
			),
		);
	} else if (args[1] === "init") {
		await initializeNativeProject(provider.projectRoot);
		await updateProjectManifest(provider.projectRoot, "native");
		const refreshed = createProjectProvider(provider.projectRoot);
		console.log(
			JSON.stringify(
				{ initialized: true, project: inspectProjectStatus(refreshed, true) },
				null,
				2,
			),
		);
	} else if (args[1] === "update") {
		console.log(
			JSON.stringify(
				{ updated: false, reason: "Dove Native Workflow has no project template update step.", project: inspectProjectStatus(provider) },
				null,
				2,
			),
		);
	} else if (args[1] === "doctor") {
		console.log(JSON.stringify(inspectProjectStatus(provider), null, 2));
	} else {
		throw new Error("Usage: dove-pi project init|doctor|bind native|update");
	}
} else if (args[0] === "task") {
	await runTaskCommand(args.slice(1));
} else if (args[0] === "session") {
	await runSessionCommand(args.slice(1));
} else if (args[0] === "extensions") {
	await runExtensionsCommand(args.slice(1));
} else if (args[0] === "workspace") {
	await runWorkspaceCommand(args.slice(1));
} else if (args[0] === "shell") {
	await runShellCommand(args.slice(1));
} else if (args[0] === "capability") {
	await runCapabilityCommand(args.slice(1));
} else if (args[0] === "rpc") {
	await runLocalRpcStdio(createLocalAdapter(false), process.stdin, process.stdout);
} else if (args[0] === "mcp") {
	await runDoveMcpStdio({ cwd: process.cwd(), ledgerPath: localLedgerPath(), ownerPid: process.pid });
} else if (args[0] === "skills") {
	const query = args.slice(1).join(" ").trim().toLowerCase();
	const skills = discoverSkills(process.cwd()).filter(
		(skill) => !query || skill.name.toLowerCase().includes(query),
	);
	console.log(JSON.stringify({ projectRoot: process.cwd(), skills }, null, 2));
} else if (args[0] === "web") {
	const command = args[1] ?? "status";
	if (command === "status") {
		console.log(JSON.stringify(inspectWebAccessReadiness(), null, 2));
	} else if (command === "auth") {
		const tokens = args.slice(2);
		const profileIndex = tokens.findIndex((token) =>
			token.startsWith("profile="),
		);
		const profile =
			profileIndex >= 0
				? tokens.splice(profileIndex, 1)[0].slice("profile=".length)
				: undefined;
		const hosts = tokens.filter(Boolean);
		if (hosts.length === 0)
			throw new Error("Usage: dove-pi web auth <hosts...> [profile=name]");
		const readiness = writeWebSearchConfig({
			allowBrowserCookies: true,
			profile: { name: profile?.trim() || "default", hosts },
		});
		console.log(JSON.stringify(readiness, null, 2));
	} else {
		throw new Error(
			"Usage: dove-pi web status | dove-pi web auth <hosts...> [profile=name]",
		);
	}
} else if (args[0] === "token") {
	const command = args[1] ?? "audit";
	if (command !== "audit")
		throw new Error("Usage: dove-pi token audit [--since=Nh] [--filter=substr]");
	const sinceHours = parseNonNegativeHours(args);
	const filterIndex = args.findIndex(
		(a) => a === "--filter" || a.startsWith("--filter="),
	);
	const filter =
		filterIndex >= 0
			? args[filterIndex].startsWith("--filter=")
				? args[filterIndex].slice(9)
				: args[filterIndex + 1]
			: undefined;
	const result = await runTokenAudit({
		sinceHours,
		filter,
	});
	console.log(formatTokenAudit(result));
} else if (args[0] === "cache") {
	const sub = args[1] ?? "audit";
	if (sub !== "audit")
		throw new Error(
			"Usage: dove-pi cache audit [--min-requests=N] [--filter=substr] [--below=0.8]",
		);
	const minIndex = args.findIndex(
		(a) => a === "--min-requests" || a.startsWith("--min-requests="),
	);
	const minRequests =
		minIndex >= 0
			? Number(
					args[minIndex].startsWith("--min-requests=")
						? args[minIndex].slice(15)
						: args[minIndex + 1],
				)
			: undefined;
	const filterIndex = args.findIndex(
		(a) => a === "--filter" || a.startsWith("--filter="),
	);
	const filter =
		filterIndex >= 0
			? args[filterIndex].startsWith("--filter=")
				? args[filterIndex].slice(9)
				: args[filterIndex + 1]
			: undefined;
	const belowIndex = args.findIndex(
		(a) => a === "--below" || a.startsWith("--below="),
	);
	const below =
		belowIndex >= 0
			? Number(
					args[belowIndex].startsWith("--below=")
						? args[belowIndex].slice(8)
						: args[belowIndex + 1],
				)
			: undefined;
	const audit = await runCacheAudit({
		minRequests:
			Number.isFinite(minRequests) && minRequests! > 0 ? minRequests : undefined,
		filter,
		onlyBelow: Number.isFinite(below) ? below : undefined,
	});
	console.log(formatCacheAudit(audit));
} else {
	throw new Error(
		"Usage: dove-pi doctor | dove-pi project [init|doctor|bind native] | dove-pi task list|current|status|continue|verify|convergence|create|start|finish|archive | dove-pi session list|record | dove-pi workspace status|set development|pentest | dove-pi shell status|set <path|auto> [--scope project|global] | dove-pi capability list|run | dove-pi rpc | dove-pi mcp | dove-pi skills [query] | dove-pi web [status|auth] | dove-pi token audit | dove-pi cache audit | dove-pi extensions list|show|doctor|install",
	);
}

async function runWorkspaceCommand(commandArgs: string[]): Promise<void> {
	const command = commandArgs[0] ?? "status";
	const current = readWorkspacePolicy(process.cwd());
	if (command === "status") {
		console.log(JSON.stringify({ workspaceRoot: current.workspaceRoot, path: current.path, mode: current.policy.mode, source: current.source, malformed: current.malformed, lens: { enabledOnNextSession: current.policy.mode === "development" }, restartRequired: false }, null, 2));
		return;
	}
	if (command !== "set") throw new Error("Usage: dove-pi workspace status|set development|pentest");
	const mode = normalizeWorkspaceMode(commandArgs[1]);
	if (!mode || commandArgs.length !== 2) throw new Error("Usage: dove-pi workspace status|set development|pentest");
	const workspaceRoot = resolveWorkspaceRoot(process.cwd());
	const path = await writeWorkspacePolicy(workspaceRoot, mode);
	console.log(JSON.stringify({ workspaceRoot, path, mode, lens: { enabledOnNextSession: mode === "development" }, restartRequired: false }, null, 2));
}

async function runShellCommand(commandArgs: string[]): Promise<void> {
	const command = commandArgs[0] ?? "status";
	if (command === "status") {
		console.log(JSON.stringify(inspectShellConfig(process.cwd()), null, 2));
		return;
	}
	if (command !== "set" && command !== "reset") throw new Error("Usage: dove-pi shell status|set <path|auto> [--scope project|global]|reset [--scope project|global]");
	const scope = parseShellScope(commandArgs);
	const value = command === "reset" ? "auto" : commandArgs[1];
	if (!value || value.startsWith("--")) throw new Error("Usage: dove-pi shell set <path|auto> [--scope project|global]");
	console.log(JSON.stringify(setShellPath(value, scope, process.cwd()), null, 2));
}

function parseShellScope(args: readonly string[]): ShellConfigScope {
	const index = args.findIndex((value) => value === "--scope" || value.startsWith("--scope="));
	const value = index < 0 ? "project" : args[index].startsWith("--scope=") ? args[index].slice("--scope=".length) : args[index + 1];
	if (value !== "project" && value !== "global") throw new Error("--scope must be project or global");
	return value;
}

async function runExtensionsCommand(commandArgs: string[]): Promise<void> {
	const command = commandArgs[0] ?? "list";
	if (command === "list") {
		console.log(
			JSON.stringify(
				{
					profiles: ["minimal", "dev", "research", "security", "max"],
					catalog: EXTENSION_CATALOG,
				},
				null,
				2,
			),
		);
		return;
	}
	if (command === "doctor") {
		const profileValue = commandArgs[1];
		const profile = parseExtensionProfile(profileValue) as ExtensionProfile;
		const report = await inspectExtensionProfile(profile, {
			cwd: process.cwd(),
			piVersion: getPiVersion(),
		});
		console.log(JSON.stringify(report, null, 2));
		if (!report.ok) process.exitCode = 1;
		return;
	}
	if (command === "show") {
		const profile = parseExtensionProfile(commandArgs[1]);
		console.log(
			JSON.stringify({ profile, packages: getProfilePackages(profile) }, null, 2),
		);
		return;
	}
	if (command === "install") {
		const profile = parseExtensionProfile(commandArgs[1] ?? "max");
		const result = await installExtensionProfile(profile, {
			updateConfigured: !commandArgs.includes("--no-update"),
		});
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	throw new Error(
		`Unknown extensions command '${command}'. Use list, show, doctor, or install.`,
	);
}

async function runCapabilityCommand(commandArgs: string[]): Promise<void> {
	const command = commandArgs[0] ?? "list";
	const adapter = createLocalAdapter(commandArgs.includes("--approve"));
	if (command === "list") {
		console.log(JSON.stringify({ protocolVersion: CAPABILITY_PROTOCOL_VERSION, capabilities: adapter.discover() }, null, 2));
		return;
	}
	if (command !== "run" || !commandArgs[1]) throw new Error("Usage: dove-pi capability run <name> [--args=<json>] [--approve]");
	const name = commandArgs[1];
	const argumentsValue = readJsonFlag(commandArgs, "--args") ?? {};
	if (typeof argumentsValue !== "object" || argumentsValue === null || Array.isArray(argumentsValue)) throw new Error("--args must be a JSON object.");
	const sideEffects = adapter.sideEffects(name);
	const requiresApproval = sideEffects.some((effect) => effect !== "read_only");
	const approved = commandArgs.includes("--approve");
	const requestId = `cli-${Date.now()}`;
	const result = await adapter.invoke({
		protocolVersion: CAPABILITY_PROTOCOL_VERSION,
		capability: { name },
		arguments: argumentsValue as Record<string, unknown>,
		context: { cwd: process.cwd(), mode: "standard", taskId: "cli-session", stepId: requestId },
		correlation: { requestId, hostSessionId: `pid:${process.pid}` },
		approval: requiresApproval ? (approved ? "granted" : "unavailable") : "not_required",
	});
	console.log(JSON.stringify(result, null, 2));
	if (result.status !== "success") process.exitCode = 1;
}

function createLocalAdapter(trustedCliApproval = false): LocalCapabilityAdapter {
	return new LocalCapabilityAdapter(localLedgerPath(), {
		ownerPid: process.pid,
		...(trustedCliApproval ? { authorize: () => true } : {}),
	});
}

function localLedgerPath(): string {
	return join(resolveDoveStateDir(process.cwd()), "execution.jsonl");
}

function readJsonFlag(commandArgs: readonly string[], name: string): unknown {
	const exact = commandArgs.find((value) => value.startsWith(`${name}=`));
	const raw = exact?.slice(name.length + 1) ?? (commandArgs.includes(name) ? commandArgs[commandArgs.indexOf(name) + 1] : undefined);
	if (raw === undefined) return undefined;
	if (Buffer.byteLength(raw, "utf8") > 64 * 1024) throw new Error(`${name} exceeds 65536 bytes.`);
	return JSON.parse(raw);
}
