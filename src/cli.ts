import { createProjectProvider, updateProjectManifest } from "./project-provider/index.ts";
import { initializeTrellis, updateTrellis } from "./project-provider/trellis-cli.ts";
import { inspectWindowsEnvironment } from "./windows-runtime/doctor.ts";
import { EXTENSION_CATALOG, getProfilePackages, type ExtensionProfile } from "./extensions/catalog.ts";
import { inspectExtensionProfile, parseExtensionProfile } from "./extensions/doctor.ts";
import { installExtensionProfile } from "./extensions/install.ts";
import { getPiVersion } from "./pi-adapter/host-version.ts";
import { discoverSkills } from "./skills/discovery.ts";
import { inspectProjectStatus } from "./project-status.ts";

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
		const rebound = createProjectProvider(provider.projectRoot);
		console.log(JSON.stringify({ provider: requestedProvider, projectRoot: provider.projectRoot, restartRequired: false, project: inspectProjectStatus(rebound) }, null, 2));
	} else if (args[1] === "init") {
		await initializeTrellis(provider.projectRoot);
		let refreshed = createProjectProvider(provider.projectRoot);
		await updateProjectManifest(provider.projectRoot, "trellis", refreshed.getHealth().trellisVersion);
		refreshed = createProjectProvider(provider.projectRoot);
		console.log(JSON.stringify({ initialized: true, project: inspectProjectStatus(refreshed, true) }, null, 2));
	} else if (args[1] === "update") {
		await updateTrellis(provider.projectRoot);
		let refreshed = createProjectProvider(provider.projectRoot);
		await updateProjectManifest(provider.projectRoot, "trellis", refreshed.getHealth().trellisVersion);
		refreshed = createProjectProvider(provider.projectRoot);
		console.log(JSON.stringify({ updated: true, project: inspectProjectStatus(refreshed, true) }, null, 2));
	} else if (args[1] === "doctor") {
		console.log(JSON.stringify(inspectProjectStatus(provider), null, 2));
	} else {
		console.log(JSON.stringify({ health: provider.getHealth(), context: provider.getContext() }, null, 2));
	}
} else if (args[0] === "extensions") {
	await runExtensionsCommand(args.slice(1));
} else if (args[0] === "skills") {
	const query = args.slice(1).join(" ").trim().toLowerCase();
	const skills = discoverSkills(process.cwd()).filter((skill) => !query || skill.name.toLowerCase().includes(query));
	console.log(JSON.stringify({ projectRoot: process.cwd(), skills }, null, 2));
} else {
	console.error("Usage: dove-pi doctor | dove-pi project [init|update|doctor|bind] | dove-pi skills [query] | dove-pi extensions list | dove-pi extensions show <profile> | dove-pi extensions doctor <profile> | dove-pi extensions install <profile>");
	process.exitCode = 1;
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
