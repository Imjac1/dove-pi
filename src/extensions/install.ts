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
	readonly failed: readonly ExtensionInstallFailure[];
}

export interface ExtensionInstallFailure {
	readonly id: string;
	readonly installSpec: string;
	readonly error: string;
}

export interface ExtensionInstallOptions {
	readonly cwd?: string;
	readonly piEntry?: string;
	readonly configuredPackages?: readonly string[];
	/** Emit one line per package; the default is concise for the installer/UI. */
	readonly verbose?: boolean;
	/** Continue with the remaining optional profile entries after an install error. */
	readonly continueOnError?: boolean;
	/** Repair a platform-native helper before retrying a known extension install. */
	readonly repairNativeDependency?: (extensionId: string, cwd: string) => Promise<boolean>;
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
	const verbose = options.verbose ?? false;
	const continueOnError = options.continueOnError ?? true;
	const repairNativeDependency = options.repairNativeDependency ?? repairAstGrepNativeDependency;
	const installed: string[] = [];
	const skipped: string[] = [];
	const failed: ExtensionInstallFailure[] = [];
	const configuredPackages = options.configuredPackages ?? await readConfiguredPackages();

	for (const entry of getProfilePackages(profile)) {
		if (configuredPackages.some((value) => matchesConfiguredPackage(value, entry))) {
			if (verbose) console.log(`Skipping ${entry.id}; already configured in Pi.`);
			skipped.push(entry.id);
			continue;
		}
		if (verbose) console.log(`Installing ${entry.id} (${entry.installSpec})...`);
		try {
			await run(piEntry, ["install", entry.installSpec], cwd);
			installed.push(entry.id);
		} catch (error) {
			let finalError = error;
			if (entry.id === "lens" && await repairNativeDependency(entry.id, cwd)) {
				try {
					await run(piEntry, ["install", entry.installSpec], cwd);
					installed.push(entry.id);
					continue;
				} catch (retryError) {
					finalError = retryError;
				}
			}
			const failure = {
				id: entry.id,
				installSpec: entry.installSpec,
				error: describeInstallFailure(entry.id, finalError),
			};
			failed.push(failure);
			console.warn(`Warning: optional Pi extension ${entry.id} could not be installed. ${failure.error}`);
			if (!continueOnError) throw error;
		}
	}

	return { profile, installed, skipped, failed };
}

async function repairAstGrepNativeDependency(extensionId: string, _cwd: string): Promise<boolean> {
	if (extensionId !== "lens" || process.platform !== "win32") return false;
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	const installRoot = join(agentDir, "npm");
	const nativePackage = process.arch === "x64"
		? "@ast-grep/cli-win32-x64-msvc"
		: process.arch === "arm64"
			? "@ast-grep/cli-win32-arm64-msvc"
			: process.arch === "ia32"
				? "@ast-grep/cli-win32-ia32-msvc"
				: undefined;
	if (!nativePackage) return false;
	console.warn(`Repairing ${nativePackage} for pi-lens...`);
	return new Promise((resolve) => {
		const npm = process.platform === "win32" ? "npm.cmd" : "npm";
		const child = spawn(npm, ["install", nativePackage, "--prefix", installRoot, "--legacy-peer-deps", "--include=optional", "--force", "--no-audit", "--no-fund"], {
			stdio: "inherit",
			windowsHide: true,
			env: {
				...process.env,
				npm_config_include: "optional",
				npm_config_optional: "true",
			},
		});
		child.once("error", () => resolve(false));
		child.once("exit", (code, signal) => resolve(code === 0 && !signal));
	});
}

function describeInstallFailure(id: string, error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (id === "lens" && /ast-grep.*native binary/i.test(message)) {
		return `${message} Windows could not resolve the optional @ast-grep native package; retry after updating npm or use the dev profile to omit pi-lens.`;
	}
	return message;
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
		const child = spawn(process.execPath, [command, ...args], {
			cwd,
			stdio: "inherit",
			windowsHide: true,
			env: {
				...process.env,
				// @ast-grep/cli ships the Windows executable as an optional
				// dependency. Keep it enabled even when the user's npm config omits
				// optional packages by default.
				npm_config_include: "optional",
				npm_config_optional: "true",
			},
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) reject(new Error(`Pi extension install terminated by ${signal}.`));
			else if (code !== 0) reject(new Error(`Pi extension install exited with code ${code ?? 1}.`));
			else resolve();
		});
	});
}
