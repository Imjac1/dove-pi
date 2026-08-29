import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { EXTENSION_CATALOG, getExtension, getProfilePackages, isExtensionProfile, matchesConfiguredPackage, type ExtensionProfile, type ExtensionPackageDefinition } from "./catalog.ts";
import { projectExtensionCapabilities, type HostCapabilityProjection } from "./capabilities.ts";

export type ExtensionIssueLevel = "error" | "warning" | "info";

export interface ExtensionDoctorIssue {
	readonly level: ExtensionIssueLevel;
	readonly code: string;
	readonly message: string;
	readonly packageId?: string;
}

export interface ExtensionPackageCheck {
	readonly id: string;
	readonly packageName: string;
	readonly installSpec: string;
	readonly configured: boolean;
	readonly localPackageJson?: string;
	readonly platform: string;
	readonly minPi?: string;
	readonly currentVersion: string;
	readonly issues: readonly ExtensionDoctorIssue[];
}

export interface ExtensionDoctorReport {
	readonly profile: ExtensionProfile;
	readonly ok: boolean;
	readonly cwd: string;
	readonly piVersion: string;
	readonly nodeVersion: string;
	readonly platform: NodeJS.Platform;
	readonly settingsPath: string;
	readonly settingsReadable: boolean;
	readonly configuredPackages: readonly string[];
	readonly packages: readonly ExtensionPackageCheck[];
	readonly issues: readonly ExtensionDoctorIssue[];
	readonly capabilities: readonly HostCapabilityProjection[];
}

interface DoctorOptions {
	readonly cwd?: string;
	readonly piVersion?: string;
	readonly nodeVersion?: string;
	readonly platform?: NodeJS.Platform;
	readonly settingsPath?: string;
	readonly checkExecutables?: boolean;
}

export async function inspectExtensionProfile(profile: ExtensionProfile, options: DoctorOptions = {}): Promise<ExtensionDoctorReport> {
	const cwd = options.cwd ?? process.cwd();
	const piVersion = options.piVersion ?? "unknown";
	const nodeVersion = options.nodeVersion ?? process.versions.node;
	const platform = options.platform ?? process.platform;
	const settingsPath = options.settingsPath ?? defaultSettingsPath();
	const settings = await readPiSettings(settingsPath);
	const profilePackages = getProfilePackages(profile);
	const issues: ExtensionDoctorIssue[] = [...settings.issues];
	const packages: ExtensionPackageCheck[] = [];

	for (const entry of profilePackages) {
		const packageIssues: ExtensionDoctorIssue[] = [];
		const configured = settings.packages.some((value) => matchesConfiguredPackage(value, entry));
		const localPackageJson = await findLocalPackageJson(entry.packageName, cwd);

		if (!configured) {
			packageIssues.push({ level: "warning", code: "not-configured", packageId: entry.id, message: `${entry.installSpec} is not present in Pi settings packages.` });
		}
		if (entry.minPi && compareVersions(piVersion, entry.minPi) < 0) {
			packageIssues.push({ level: "error", code: "pi-too-old", packageId: entry.id, message: `${entry.id} requires Pi >= ${entry.minPi}; detected ${piVersion}.` });
		}
		if (entry.minNode && compareVersions(nodeVersion, entry.minNode) < 0) {
			packageIssues.push({ level: "error", code: "node-too-old", packageId: entry.id, message: `${entry.id} requires Node >= ${entry.minNode}; detected ${nodeVersion}.` });
		}
		if (entry.platform === "windows" && platform !== "win32") {
			packageIssues.push({ level: "warning", code: "platform-conditional", packageId: entry.id, message: `${entry.id} is primarily documented for Windows; current platform is ${platform}.` });
		}
		if (options.checkExecutables !== false && entry.requiredExecutables) {
			for (const executable of entry.requiredExecutables) {
				if (!(await hasExecutable(executable))) {
					packageIssues.push({ level: "warning", code: "missing-executable", packageId: entry.id, message: `${entry.id} expects '${executable}' to be available in PATH.` });
				}
			}
		}

		packages.push({
			id: entry.id,
			packageName: entry.packageName,
			installSpec: entry.installSpec,
			configured,
			...(localPackageJson ? { localPackageJson } : {}),
			platform: entry.platform,
			...(entry.minPi ? { minPi: entry.minPi } : {}),
			currentVersion: entry.currentVersion,
			issues: packageIssues,
		});
		issues.push(...packageIssues);
	}

	issues.push(...checkProfileConflicts(profilePackages));
	const configuredEntries = EXTENSION_CATALOG.filter((entry) => settings.packages.some((value) => matchesConfiguredPackage(value, entry)));
	issues.push(...checkConfiguredConflicts(configuredEntries));
	issues.push(...checkDoveAuthorityOverlap(configuredEntries));
	issues.push(...checkLoadOrder(profilePackages, settings.packages));
	return {
		profile,
		ok: !issues.some((issue) => issue.level === "error"),
		cwd,
		piVersion,
		nodeVersion,
		platform,
		settingsPath,
		settingsReadable: settings.readable,
		configuredPackages: settings.packages,
		packages,
		issues,
		capabilities: projectExtensionCapabilities(settings.packages),
	};
}

export function parseExtensionProfile(value: string | undefined): ExtensionProfile {
	const profile = value ?? "minimal";
	if (!isExtensionProfile(profile)) throw new Error(`Unknown extension profile '${profile}'. Use minimal, dev, research, security, or max.`);
	return profile;
}

async function readPiSettings(settingsPath: string): Promise<{ readable: boolean; packages: string[]; issues: ExtensionDoctorIssue[] }> {
	try {
		const text = await readFile(settingsPath, "utf8");
		const parsed = JSON.parse(text) as { packages?: unknown };
		const packages = Array.isArray(parsed.packages) ? parsed.packages.filter((value): value is string => typeof value === "string") : [];
		return { readable: true, packages, issues: [] };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { readable: false, packages: [], issues: [{ level: "warning", code: "settings-unreadable", message: `Pi settings could not be read at ${settingsPath}: ${message}` }] };
	}
}

function defaultSettingsPath(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	return join(agentDir, "settings.json");
}

function checkLoadOrder(packages: readonly ExtensionPackageDefinition[], configured: readonly string[]): ExtensionDoctorIssue[] {
	const issues: ExtensionDoctorIssue[] = [];
	for (const entry of packages) {
		for (const dependency of entry.loadAfter ?? []) {
			const beforeIndex = configured.findIndex((value) => matchesConfiguredPackage(value, getExtension(dependency)));
			const currentIndex = configured.findIndex((value) => matchesConfiguredPackage(value, entry));
			if (beforeIndex >= 0 && currentIndex >= 0 && currentIndex < beforeIndex) {
				issues.push({ level: "error", code: "load-order", packageId: entry.id, message: `${entry.id} must load after ${dependency} in Pi settings.` });
			}
		}
	}
	return issues;
}

export function checkProfileConflicts(packages: readonly ExtensionPackageDefinition[]): ExtensionDoctorIssue[] {
	const ids = new Set(packages.map((entry) => entry.id));
	const issues: ExtensionDoctorIssue[] = [];
	for (const entry of packages) {
		for (const conflict of entry.conflicts ?? []) {
			if (ids.has(conflict)) issues.push({ level: "error", code: "profile-conflict", packageId: entry.id, message: `${entry.id} conflicts with ${conflict}; keep one authority for this capability.` });
		}
	}
	return issues;
}

function checkConfiguredConflicts(packages: readonly ExtensionPackageDefinition[]): ExtensionDoctorIssue[] {
	return checkProfileConflicts(packages).map((issue) => ({
		...issue,
		message: `${issue.message} Both packages are configured in Pi settings.`,
	}));
}

function checkDoveAuthorityOverlap(packages: readonly ExtensionPackageDefinition[]): ExtensionDoctorIssue[] {
	if (!packages.some((entry) => entry.id === "hashline-edit")) return [];
	return [{
		level: "warning",
		code: "dove-authority-overlap",
		packageId: "hashline-edit",
		message: "hashline-edit replaces Pi built-in read/edit/grep; Dove will suppress built-in edit at runtime. Verify only hashline replace/insert are used for mutations.",
	}];
}

async function findLocalPackageJson(packageName: string, cwd: string): Promise<string | undefined> {
	let current = cwd;
	for (;;) {
		const candidate = join(current, "node_modules", ...packageName.split("/"), "package.json");
		try {
			await access(candidate, constants.F_OK);
			return candidate;
		} catch {
			const parent = dirname(current);
			if (parent === current) return undefined;
			current = parent;
		}
	}
}

async function hasExecutable(name: string): Promise<boolean> {
	const command = process.platform === "win32" ? "where.exe" : "which";
	return await new Promise((resolve) => {
		const child = spawn(command, [name], { stdio: "ignore", windowsHide: true });
		child.once("error", () => resolve(false));
		child.once("exit", (code) => resolve(code === 0));
	});
}

function compareVersions(left: string, right: string): number {
	const parse = (value: string) => value.replace(/^v/, "").split(".").slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
	const a = parse(left);
	const b = parse(right);
	if (left === "unknown") return 0;
	for (let index = 0; index < 3; index += 1) {
		if (a[index] !== b[index]) return a[index] - b[index];
	}
	return 0;
}
