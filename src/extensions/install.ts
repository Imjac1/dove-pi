import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProfilePackages, matchesConfiguredPackage, type ExtensionProfile } from "./catalog.ts";

export interface ExtensionInstallResult {
	readonly profile: ExtensionProfile;
	readonly installed: readonly string[];
	readonly skipped: readonly string[];
}

export interface ExtensionInstallOptions {
	readonly cwd?: string;
	readonly piEntry?: string;
	readonly configuredPackages?: readonly string[];
	readonly run?: (command: string, args: readonly string[], cwd: string) => Promise<void>;
}

/** Install a catalog profile through Pi's official package command.
 *
 * The catalog remains the single source of truth. This deliberately delegates
 * settings writes and package resolution to Pi instead of reimplementing them.
 */
export async function installExtensionProfile(profile: ExtensionProfile, options: ExtensionInstallOptions = {}): Promise<ExtensionInstallResult> {
	const cwd = options.cwd ?? process.cwd();
	const piEntry = options.piEntry ?? defaultPiEntry();
	const run = options.run ?? runPiInstall;
	const installed: string[] = [];
	const skipped: string[] = [];
	const configuredPackages = options.configuredPackages ?? await readConfiguredPackages();

	for (const entry of getProfilePackages(profile)) {
		if (configuredPackages.some((value) => matchesConfiguredPackage(value, entry))) {
			console.log(`Skipping ${entry.id}; already configured in Pi.`);
			skipped.push(entry.id);
			continue;
		}
		console.log(`Installing ${entry.id} (${entry.installSpec})...`);
		await run(piEntry, ["install", entry.installSpec], cwd);
		installed.push(entry.id);
	}

	return { profile, installed, skipped };
}

async function readConfiguredPackages(): Promise<string[]> {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	try {
		const parsed = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8")) as { packages?: unknown };
		return Array.isArray(parsed.packages) ? parsed.packages.filter((value): value is string => typeof value === "string") : [];
	} catch {
		return [];
	}
}

function defaultPiEntry(): string {
	const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
	return join(projectRoot, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
}

function runPiInstall(command: string, args: readonly string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [command, ...args], { cwd, stdio: "inherit", windowsHide: true });
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) reject(new Error(`Pi extension install terminated by ${signal}.`));
			else if (code !== 0) reject(new Error(`Pi extension install exited with code ${code ?? 1}.`));
			else resolve();
		});
	});
}
