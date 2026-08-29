import { spawn } from "node:child_process";
import { access, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exactInstallSpec, getProfilePackages, matchesConfiguredPackage, matchesExactConfiguredPackage, type ExtensionProfile } from "./catalog.ts";

export interface ExtensionInstallResult {
	readonly profile: ExtensionProfile;
	readonly updated: boolean;
	readonly updateStatus: ExtensionUpdateStatus;
	readonly updateError?: string;
	readonly installed: readonly string[];
	readonly skipped: readonly string[];
	readonly failed: readonly ExtensionInstallFailure[];
}

export type ExtensionUpdateStatus = "updated" | "unchanged" | "skipped-empty" | "skipped-disabled" | "failed";

export interface ExtensionInstallFailure {
	readonly id: string;
	readonly installSpec: string;
	readonly error: string;
}

export interface ExtensionInstallOptions {
	readonly cwd?: string;
	readonly piEntry?: string;
	readonly configuredPackages?: readonly unknown[];
	/** Emit one line per package; the default is concise for the installer/UI. */
	readonly verbose?: boolean;
	/** Continue with the remaining optional profile entries after an install error. */
	readonly continueOnError?: boolean;
	/** Run Pi's official extension updater before reconciling the profile. */
	readonly updateConfigured?: boolean;
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
	const updateConfigured = options.updateConfigured ?? true;
	const repairNativeDependency = options.repairNativeDependency ?? repairAstGrepNativeDependency;
	const installed: string[] = [];
	const skipped: string[] = [];
	const failed: ExtensionInstallFailure[] = [];
	const configuredPackages = options.configuredPackages ?? await readConfiguredPackages();
	let updated = false;
	let updateStatus: ExtensionUpdateStatus;
	let updateError: string | undefined;

	// Dove owns only the catalog entries in the selected profile. Reconcile
	// those identities through Pi's official exact-spec install path; never run
	// a broad update that would also change packages installed by the user.
	if (!updateConfigured) {
		updateStatus = "skipped-disabled";
		// Keep stdout reserved for the structured result emitted by the CLI.
		console.error("Pi extension updates skipped (--no-update).");
	} else if (configuredPackages.length === 0) {
		updateStatus = "skipped-empty";
		// Keep stdout reserved for the structured result emitted by the CLI.
		console.error("No configured Pi extensions; update skipped for this first install.");
	} else {
		updateStatus = "unchanged";
	}

	for (const entry of getProfilePackages(profile)) {
		const existing = configuredPackages.find((value) => matchesConfiguredPackage(value, entry));
		if (existing !== undefined && (!updateConfigured || matchesExactConfiguredPackage(existing, entry))) {
			if (verbose) console.log(`Skipping ${entry.id}; already configured in Pi.`);
			skipped.push(entry.id);
			continue;
		}
		const desiredSpec = exactInstallSpec(entry);
		if (verbose) console.log(`${existing === undefined ? "Installing" : "Reconciling"} ${entry.id} (${desiredSpec})...`);
		try {
			await run(piEntry, ["install", desiredSpec], cwd);
			installed.push(entry.id);
			if (existing !== undefined) {
				updated = true;
				updateStatus = "updated";
			}
		} catch (error) {
			let finalError = error;
			if (entry.id === "lens" && await repairNativeDependency(entry.id, cwd)) {
				try {
					await run(piEntry, ["install", desiredSpec], cwd);
					installed.push(entry.id);
					continue;
				} catch (retryError) {
					finalError = retryError;
				}
			}
			const failure = {
				id: entry.id,
				installSpec: desiredSpec,
				error: describeInstallFailure(entry.id, finalError),
			};
			failed.push(failure);
			console.warn(
				`Warning: optional Pi extension ${entry.id} could not be installed. `
				+ `Command: pi install ${desiredSpec}. ${failure.error} `
				+ "Next step: fix the reported dependency/environment issue and rerun the install.",
			);
			if (!continueOnError) throw error;
		}
	}

	if (failed.length > 0) {
		updateStatus = "failed";
		updateError = failed.map((entry) => `${entry.id}: ${entry.error}`).join("; ");
	}
	return { profile, updated, updateStatus, ...(updateError ? { updateError } : {}), installed, skipped, failed };
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
	const brokenCliDir = join(installRoot, "node_modules", "@ast-grep", "cli");
	const nativePackageDir = join(installRoot, "node_modules", ...nativePackage.split("/"));
	try {
		// A failed postinstall can leave ast-grep.exe/sg.exe in place, while npm
		// still considers both packages current. Remove only these managed
		// package directories before reifying them; never touch the user's
		// project or the whole Pi npm root.
		await rm(brokenCliDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
		await rm(nativePackageDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
		if (!await isMissing(brokenCliDir) || !await isMissing(nativePackageDir)) {
			throw new Error("stale @ast-grep package directories remain");
		}
	} catch {
		console.warn("Warning: could not remove the stale pi-lens @ast-grep installation; it may be locked by antivirus or another Node process.");
		return false;
	}
	console.warn(`Repairing ${nativePackage} for pi-lens...`);
	const npmArgs = ["--prefix", installRoot, "--legacy-peer-deps", "--include=optional", "--force", "--no-audit", "--no-fund", "--package-lock=false"];
	// Reify the native package first, then reify the JS wrapper separately.
	// This avoids the postinstall script seeing a half-created destination when
	// npm reuses a partially extracted package after a previous failure.
	if (!await runNpmInstall(["install", nativePackage, ...npmArgs], installRoot)) return false;
	await rm(brokenCliDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
	const nativeVersion = await readPackageVersion(join(nativePackageDir, "package.json"));
	const cliPackage = nativeVersion ? `@ast-grep/cli@${nativeVersion}` : "@ast-grep/cli";
	return runNpmInstall(["install", cliPackage, ...npmArgs], installRoot);
}

async function isMissing(path: string): Promise<boolean> {
	try {
		await access(path);
		return false;
	} catch {
		return true;
	}
}

async function readPackageVersion(path: string): Promise<string | undefined> {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8")) as { version?: unknown };
		return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version : undefined;
	} catch {
		return undefined;
	}
}

function runNpmInstall(args: readonly string[], cwd: string): Promise<boolean> {
	return new Promise((resolve) => {
		const windows = process.platform === "win32";
		const executable = windows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
		// Invoking npm.cmd through Node's `shell: true` emits DEP0190 on Node 22+
		// and can fail with EINVAL on some Windows installations. cmd.exe is the
		// supported native shim host; keep shell mode disabled and pass arguments
		// as a normal argv list.
		const childArgs = windows ? ["/d", "/s", "/c", "npm.cmd", ...args] : [...args];
		const child = spawn(executable, childArgs, {
			cwd,
			stdio: "inherit",
			windowsHide: true,
			env: npmEnvironment(),
		});
		child.once("error", (error) => {
			console.warn(`Warning: npm repair process could not start (${error instanceof Error ? error.message : String(error)}).`);
			resolve(false);
		});
		child.once("exit", (code, signal) => resolve(code === 0 && !signal));
	});
}

function describeInstallFailure(id: string, error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (id === "lens" && /ast-grep.*(?:native binary|binaries into place)/i.test(message)) {
		return `${message} Windows could not reify the optional @ast-grep native package; close other Node processes and retry, or use the dev profile to omit pi-lens.`;
	}
	return message;
}

async function readConfiguredPackages(): Promise<unknown[]> {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	try {
		const parsed = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8")) as { packages?: unknown };
		return Array.isArray(parsed.packages) ? parsed.packages : [];
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
			env: npmEnvironment(),
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) reject(new Error(`Pi extension install terminated by ${signal}.`));
			else if (code !== 0) reject(new Error(`Pi extension install exited with code ${code ?? 1}.`));
			else resolve();
		});
	});
}

function npmEnvironment(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	// @ast-grep/cli ships the Windows executable as an optional dependency.
	// Force inclusion without carrying npm's deprecated `optional` alias into
	// the child process (which makes current npm print a warning per package).
	delete env.npm_config_optional;
	env.npm_config_include = "optional";
	return env;
}
