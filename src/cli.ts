import { createProjectProvider, updateProjectManifest } from "./project-provider/index.ts";
import { inspectWindowsEnvironment } from "./windows-runtime/doctor.ts";
import { EXTENSION_CATALOG, getProfilePackages, type ExtensionProfile } from "./extensions/catalog.ts";
import { inspectExtensionProfile, parseExtensionProfile } from "./extensions/doctor.ts";
import { installExtensionProfile } from "./extensions/install.ts";
import { getPiVersion } from "./pi-adapter/host-version.ts";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);

if (args[0] === "doctor") {
	const provider = createProjectProvider(process.cwd());
	const health = provider.getHealth();
	const context = provider.getContext();
	const powershell = await inspectWindowsEnvironment(process.cwd());
	console.log(JSON.stringify({ node: process.version, platform: process.platform, powershell, project: { ...health, currentTask: context.currentTask, taskCount: context.tasks.length, revision: context.revision } }, null, 2));
} else if (args[0] === "project") {
	const provider = createProjectProvider(process.cwd());
	if (args[1] === "bind") {
		const requestedProvider = args[2];
		if (requestedProvider !== "trellis" && requestedProvider !== "lightweight") throw new Error("Usage: dove-pi project bind trellis|lightweight");
		await updateProjectManifest(provider.projectRoot, requestedProvider);
		console.log(JSON.stringify({ provider: requestedProvider, projectRoot: provider.projectRoot, restartRequired: true }, null, 2));
	} else if (args[1] === "init") {
		await initializeTrellis(provider.projectRoot);
	} else if (args[1] === "update") {
		await updateTrellis(provider.projectRoot);
	} else {
		console.log(JSON.stringify({ health: provider.getHealth(), context: provider.getContext() }, null, 2));
	}
} else if (args[0] === "extensions") {
		await runExtensionsCommand(args.slice(1));
} else {
	console.error("Usage: dove-pi doctor | dove-pi project [init|update|bind] | dove-pi extensions list | dove-pi extensions show <profile> | dove-pi extensions doctor <profile> | dove-pi extensions install <profile>");
	process.exitCode = 1;
}

async function initializeTrellis(projectRoot: string): Promise<void> {
	if (existsSync(join(projectRoot, ".trellis")) || providerIsTrellis(projectRoot)) throw new Error(`Trellis is already initialized at ${projectRoot}`);
	await runTrellisCommand(projectRoot, ["init"]);
}

async function updateTrellis(projectRoot: string): Promise<void> {
	if (!existsSync(join(projectRoot, ".trellis"))) throw new Error(`No Trellis project found at ${projectRoot}; run 'dove-pi project init' first`);
	// Updating is explicit and delegated to Trellis' own migration logic. Dove
	// never rewrites generated Trellis files or silently upgrades on startup.
	await runTrellisCommand(projectRoot, ["update"]);
}

async function runTrellisCommand(projectRoot: string, command: readonly string[]): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("trellis", [...command], { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32", windowsHide: false });
		child.on("error", (error) => reject(new Error(`Trellis CLI is unavailable; install/configure it explicitly before running 'trellis ${command.join(" ")}'. ${error.message}`)));
		child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`trellis ${command[0]} exited with ${code ?? "unknown status"}`)));
	});
}

function providerIsTrellis(projectRoot: string): boolean {
	return createProjectProvider(projectRoot).kind === "trellis";
}

async function runExtensionsCommand(commandArgs: string[]): Promise<void> {
	const command = commandArgs[0] ?? "list";
	if (command === "list") {
		console.log(JSON.stringify({
			profiles: ["minimal", "dev", "research", "security", "max"],
			catalog: EXTENSION_CATALOG,
		}, null, 2));
		return;
	}
	if (command === "doctor") {
		const profileValue = commandArgs[1];
		const profile = parseExtensionProfile(profileValue) as ExtensionProfile;
		const report = await inspectExtensionProfile(profile, { cwd: process.cwd(), piVersion: getPiVersion() });
		console.log(JSON.stringify(report, null, 2));
		if (!report.ok) process.exitCode = 1;
		return;
	}
	if (command === "show") {
		const profile = parseExtensionProfile(commandArgs[1]);
		console.log(JSON.stringify({ profile, packages: getProfilePackages(profile) }, null, 2));
		return;
	}
	if (command === "install") {
		const profile = parseExtensionProfile(commandArgs[1] ?? "max");
		const result = await installExtensionProfile(profile);
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	throw new Error(`Unknown extensions command '${command}'. Use list, show, doctor, or install.`);
}
