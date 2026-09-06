#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const launcher = path.join(packageRoot, "dove_pi.py");
const piEntry = path.join(
	packageRoot,
	"node_modules",
	"@earendil-works",
	"pi-coding-agent",
	"dist",
	"bundle",
	"cli.js",
);
const extension = path.join(packageRoot, ".pi", "extensions", "personal-agent.ts");
const python = process.platform === "win32" ? "python" : "python3";
const pythonCommands = new Set([
	"doctor",
	"project",
	"task",
	"session",
	"skills",
	"web",
	"cache",
	"token",
	"capability",
	"rpc",
	"mcp",
	"extensions",
	"workspace",
	"install",
	"setup",
	"update",
	"repair",
	"rollback",
	"uninstall",
	"icons",
	"help",
	"-h",
	"--help",
	"version",
	"--version",
]);

function shouldUsePiFastPath(argumentsList) {
	let index = 0;
	while (index < argumentsList.length) {
		if (["--offline", "--skip-version-check"].includes(argumentsList[index])) {
			index += 1;
			continue;
		}
		if (argumentsList[index] === "--workspace-mode") {
			index += 2;
			continue;
		}
		if (argumentsList[index].startsWith("--workspace-mode=")) {
			index += 1;
			continue;
		}
		break;
	}
	return index >= argumentsList.length || !pythonCommands.has(argumentsList[index]);
}

function spawnPi(argumentsList) {
	if (!require("node:fs").existsSync(piEntry)) {
		console.error("Dove Pi dependencies are missing. Run 'python dove_pi.py install' first.");
		process.exitCode = 1;
		return;
	}
	const launchEnv = { ...process.env, PI_SKIP_VERSION_CHECK: "1" };
	const piArguments = [];
	let workspaceOverride;
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		if (argument === "--workspace-mode") {
			workspaceOverride = argumentsList[++index];
			if (workspaceOverride === undefined) {
				console.error("--workspace-mode requires development or pentest");
				process.exitCode = 1;
				return;
			}
			continue;
		}
		if (argument.startsWith("--workspace-mode=")) {
			workspaceOverride = argument.slice("--workspace-mode=".length);
			continue;
		}
		if (argument === "--offline") launchEnv.PI_OFFLINE = "1";
		else if (argument !== "--skip-version-check") piArguments.push(argument);
	}
	if (workspaceOverride !== undefined && !["development", "pentest"].includes(workspaceOverride)) {
		console.error("--workspace-mode must be development or pentest");
		process.exitCode = 1;
		return;
	}
	let workspaceMode = workspaceOverride;
	if (!workspaceMode) {
		try {
			const fs = require("node:fs");
			let current = path.resolve(process.cwd());
			while (true) {
				const policyPath = path.join(current, ".dove", "workspace.json");
				if (fs.existsSync(policyPath)) {
					const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
					if (policy.schemaVersion === 1 && ["development", "pentest"].includes(policy.mode)) workspaceMode = policy.mode;
					break;
				}
				const parent = path.dirname(current);
				if (parent === current) break;
				current = parent;
			}
		} catch { /* malformed optional policy falls back to development */ }
	}
	workspaceMode = workspaceMode || "development";
	if (workspaceMode === "pentest" && !piArguments.includes("--no-lens")) piArguments.push("--no-lens");
	launchEnv.DOVE_PI_WORKSPACE_MODE = workspaceMode;
	if (workspaceOverride) launchEnv.DOVE_PI_WORKSPACE_MODE_OVERRIDE = workspaceOverride;
	const projectOverride = (process.env.DOVE_PI_PROJECT_EXTENSION || "").trim();
	let commandArguments = [piEntry];
	if (projectOverride) {
		if (!["1", "true", "yes", "on"].includes((process.env.DOVE_PI_TRUST_PROJECT_EXTENSION || "").trim().toLowerCase())) {
			console.error("DOVE_PI_PROJECT_EXTENSION requires DOVE_PI_TRUST_PROJECT_EXTENSION=1");
			process.exitCode = 1;
			return;
		}
		commandArguments.push("-e", path.resolve(projectOverride));
		launchEnv.DOVE_PI_EXTENSION_ORIGIN = "explicit";
		launchEnv.DOVE_PI_EXTENSION_TRUST = "trusted";
		launchEnv.DOVE_PI_EXTENSION_ENTRY = path.resolve(projectOverride);
	} else {
		commandArguments.push("-e", extension);
		launchEnv.DOVE_PI_EXTENSION_ORIGIN = "managed";
		launchEnv.DOVE_PI_EXTENSION_TRUST = "managed";
		launchEnv.DOVE_PI_EXTENSION_ENTRY = extension;
	}
	try {
		const packageJson = require(path.join(packageRoot, "package.json"));
		launchEnv.DOVE_PI_EXTENSION_VERSION = packageJson.version || "0.1.0";
	} catch {
		launchEnv.DOVE_PI_EXTENSION_VERSION = "0.1.0";
	}
	launchEnv.DOVE_PI_EXTENSION_GUARD = "1";
	const child = spawn(process.execPath, [...commandArguments, ...piArguments], {
		cwd: process.cwd(),
		env: launchEnv,
		stdio: "inherit",
	});
	child.on("error", (error) => {
		console.error(`Unable to start bundled Pi: ${error.message}`);
		process.exitCode = 1;
	});
	child.on("exit", (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else process.exitCode = code ?? 1;
	});
}

const argumentsList = process.argv.slice(2);
if (shouldUsePiFastPath(argumentsList)) {
	spawnPi(argumentsList);
} else {
	const child = spawn(python, [launcher, ...argumentsList], {
		cwd: process.cwd(),
		stdio: "inherit",
	});

	child.on("error", (error) => {
		console.error(`Unable to start Dove Pi command: ${error.message}`);
		process.exitCode = 1;
	});
	child.on("exit", (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else process.exitCode = code ?? 1;
	});
}
