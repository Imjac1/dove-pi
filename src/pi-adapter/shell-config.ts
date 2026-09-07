import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getShellConfig } from "@earendil-works/pi-coding-agent";

export type ShellConfigScope = "project" | "global";

export interface ShellConfigSnapshot {
	readonly scope: ShellConfigScope;
	readonly path: string;
	readonly configuredPath?: string;
	readonly effectivePath?: string;
	readonly source: "project" | "global" | "auto";
	readonly autoResolutionError?: string;
}

interface SettingsObject { [key: string]: unknown }

export function shellSettingsPath(scope: ShellConfigScope, cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
	if (scope === "project") return join(resolve(cwd), ".pi", "settings.json");
	const agentDir = env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
	return join(resolve(agentDir), "settings.json");
}

function readSettings(path: string): SettingsObject {
	if (!existsSync(path)) return {};
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(`Pi settings must be a JSON object: ${path}`);
	return parsed as SettingsObject;
}

function writeSettings(path: string, settings: SettingsObject): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
	renameSync(temporary, path);
}

function configuredPath(path: string): string | undefined {
	const value = readSettings(path).shellPath;
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function inspectShellConfig(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ShellConfigSnapshot {
	const projectPath = shellSettingsPath("project", cwd, env);
	const globalPath = shellSettingsPath("global", cwd, env);
	const projectConfigured = configuredPath(projectPath);
	const globalConfigured = configuredPath(globalPath);
	const selected = projectConfigured ?? globalConfigured;
	const source = projectConfigured ? "project" : globalConfigured ? "global" : "auto";
	const path = source === "project" ? projectPath : globalPath;
	try {
		const effectivePath = getShellConfig(selected).shell;
		return { scope: source === "project" ? "project" : "global", path, ...(selected ? { configuredPath: selected } : {}), effectivePath, source };
	} catch (error) {
		return { scope: source === "project" ? "project" : "global", path, ...(selected ? { configuredPath: selected } : {}), source, autoResolutionError: error instanceof Error ? error.message : String(error) };
	}
}

export function setShellPath(value: string, scope: ShellConfigScope, cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ShellConfigSnapshot {
	const normalized = value.trim();
	if (!normalized) throw new Error("Shell path cannot be empty. Use 'auto' to restore system detection.");
	const path = shellSettingsPath(scope, cwd, env);
	const settings = readSettings(path);
	if (normalized.toLowerCase() === "auto") delete settings.shellPath;
	else {
		const expanded = normalized === "~"
			? homedir()
			: normalized.startsWith("~/") || normalized.startsWith("~\\")
				? join(homedir(), normalized.slice(2))
				: normalized;
		if (!existsSync(expanded)) throw new Error(`Configured shell path does not exist: ${expanded}`);
		if (!statSync(expanded).isFile()) throw new Error(`Configured shell path is not a file: ${expanded}`);
		settings.shellPath = expanded;
	}
	writeSettings(path, settings);
	return inspectShellConfig(cwd, env);
}
