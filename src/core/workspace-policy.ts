import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { withProjectMutationLock } from "../project-provider/lock.ts";

export type WorkspaceMode = "development" | "pentest";

export interface WorkspacePolicy {
	readonly schemaVersion: 1;
	readonly mode: WorkspaceMode;
}

export interface WorkspacePolicyRead {
	readonly workspaceRoot: string;
	readonly path: string;
	readonly policy: WorkspacePolicy;
	readonly source: "default" | "workspace" | "override";
	readonly malformed: boolean;
}

export function workspacePolicyPath(workspaceRoot: string): string {
	return join(resolve(workspaceRoot), ".dove", "workspace.json");
}

export function resolveWorkspaceRoot(startPath = process.cwd()): string {
	let current = resolve(startPath);
	while (true) {
		if (existsSync(join(current, ".dove", "workspace.json")) || existsSync(join(current, ".dove", "project.json")) || existsSync(join(current, ".trellis"))) return current;
		const parent = dirname(current);
		if (parent === current) return resolve(startPath);
		current = parent;
	}
}

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode | undefined {
	return value === "development" || value === "pentest" ? value : undefined;
}

export function readWorkspacePolicy(startPath = process.cwd(), override?: unknown): WorkspacePolicyRead {
	const workspaceRoot = resolveWorkspaceRoot(startPath);
	const path = workspacePolicyPath(workspaceRoot);
	const requested = normalizeWorkspaceMode(override);
	if (override !== undefined) {
		return { workspaceRoot, path, policy: { schemaVersion: 1, mode: requested ?? "development" }, source: "override", malformed: requested === undefined };
	}
	if (!existsSync(path)) return { workspaceRoot, path, policy: { schemaVersion: 1, mode: "development" }, source: "default", malformed: false };
	try {
		const value = JSON.parse(readFileSync(path, "utf8")) as { schemaVersion?: unknown; mode?: unknown };
		const mode = normalizeWorkspaceMode(value.mode);
		if (value.schemaVersion !== 1 || !mode) return { workspaceRoot, path, policy: { schemaVersion: 1, mode: "development" }, source: "default", malformed: true };
		return { workspaceRoot, path, policy: { schemaVersion: 1, mode }, source: "workspace", malformed: false };
	} catch {
		return { workspaceRoot, path, policy: { schemaVersion: 1, mode: "development" }, source: "default", malformed: true };
	}
}

export async function writeWorkspacePolicy(workspaceRoot: string, mode: WorkspaceMode): Promise<string> {
	const path = workspacePolicyPath(workspaceRoot);
	return withProjectMutationLock(workspaceRoot, async () => {
		await mkdir(dirname(path), { recursive: true });
		const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
		try {
			await writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, mode }, null, 2)}\n`, "utf8");
			await rename(temporary, path);
		} finally {
			await rm(temporary, { force: true });
		}
		return path;
	});
}

export function lensEnabledForWorkspaceMode(mode: WorkspaceMode): boolean {
	return mode === "development";
}
