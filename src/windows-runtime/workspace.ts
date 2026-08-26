import { constants } from "node:fs";
import { access, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { lstatSync } from "node:fs";

export interface WorkspaceInspection {
	readonly path: string;
	readonly exists: boolean;
	readonly kind: "file" | "directory" | "missing";
	readonly size?: number;
}

export interface WorkspaceSnapshotEntry {
	readonly path: string;
	readonly kind: "file" | "directory";
	readonly size?: number;
	readonly sha256?: string;
}

export interface WorkspaceSnapshot {
	readonly id: string;
	readonly root: string;
	readonly createdAt: string;
	readonly roots: readonly string[];
	readonly entries: readonly WorkspaceSnapshotEntry[];
}

export interface WorkspaceVerification {
	readonly snapshotId: string;
	readonly ok: boolean;
	readonly missing: readonly string[];
	readonly changed: readonly string[];
	readonly extra: readonly string[];
}

export type WorkspacePatchOperation =
	| { readonly kind: "write"; readonly path: string; readonly content: string | Uint8Array }
	| { readonly kind: "delete"; readonly path: string }
	| { readonly kind: "mkdir"; readonly path: string };

export interface WorkspacePatchResult {
	readonly snapshotId: string;
	readonly appliedOperations: number;
}

const snapshotDirectory = (cwd: string): string => join(cwd, ".agent-data", "workspace-snapshots");

export async function inspectWorkspacePath(cwd: string, inputPath: string): Promise<WorkspaceInspection> {
	const path = resolveSafePath(cwd, inputPath);
	try {
		await access(path, constants.F_OK);
		const metadata = await lstat(path);
		return { path, exists: true, kind: metadata.isDirectory() ? "directory" : "file", size: metadata.size };
	} catch {
		return { path, exists: false, kind: "missing" };
	}
}

export async function readWorkspaceText(cwd: string, inputPath: string): Promise<string> {
	return await readFile(resolveSafePath(cwd, inputPath), "utf8");
}

export async function createWorkspaceSnapshot(cwd: string, inputPaths: readonly string[] = ["."]): Promise<WorkspaceSnapshot> {
	const root = resolve(cwd);
	const roots = unique(inputPaths.map((inputPath) => toManifestPath(root, resolveSafePath(root, inputPath))));
	const id = `${Date.now()}-${randomUUID()}`;
	const directory = join(snapshotDirectory(root), id);
	const entries: WorkspaceSnapshotEntry[] = [];
	for (const manifestRoot of roots) {
		const target = fromManifestPath(root, manifestRoot);
		try {
			await collectSnapshotEntries(root, target, entries);
		} catch (error) {
			if (!isMissingError(error)) throw error;
		}
	}
	const snapshot: WorkspaceSnapshot = { id, root, createdAt: new Date().toISOString(), roots, entries };
	await mkdir(join(directory, "payload"), { recursive: true });
	for (const entry of entries) {
		if (entry.kind !== "file") continue;
		const source = fromManifestPath(root, entry.path);
		const destination = join(directory, "payload", ...entry.path.split("/"));
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, await readFile(source));
	}
	await writeFile(join(directory, "manifest.json"), JSON.stringify(snapshot, null, 2), "utf8");
	return snapshot;
}

export async function verifyWorkspaceSnapshot(cwd: string, snapshotId: string): Promise<WorkspaceVerification> {
	const snapshot = await loadSnapshot(cwd, snapshotId);
	const expected = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
	const current = await collectCurrentEntries(snapshot.root, snapshot.roots);
	const missing: string[] = [];
	const changed: string[] = [];
	const extra: string[] = [];
	for (const [path, entry] of expected) {
		const actual = current.get(path);
		if (!actual) missing.push(path);
		else if (entry.kind !== actual.kind || entry.sha256 !== actual.sha256 || entry.size !== actual.size) changed.push(path);
	}
	for (const path of current.keys()) if (!expected.has(path)) extra.push(path);
	return { snapshotId, ok: missing.length === 0 && changed.length === 0 && extra.length === 0, missing, changed, extra };
}

export async function restoreWorkspaceSnapshot(cwd: string, snapshotId: string): Promise<WorkspaceVerification> {
	const snapshot = await loadSnapshot(cwd, snapshotId);
	const expected = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
	const current = await collectCurrentEntries(snapshot.root, snapshot.roots);
	for (const path of current.keys()) {
		if (expected.has(path)) continue;
		await rm(fromManifestPath(snapshot.root, path), { recursive: true, force: true });
	}
	const directory = join(snapshotDirectory(snapshot.root), snapshot.id, "payload");
	for (const entry of snapshot.entries) {
		const target = fromManifestPath(snapshot.root, entry.path);
		if (entry.kind === "directory") await mkdir(target, { recursive: true });
		else {
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, await readFile(join(directory, ...entry.path.split("/"))));
		}
	}
	return await verifyWorkspaceSnapshot(snapshot.root, snapshot.id);
}

export async function applyWorkspacePatch(cwd: string, operations: readonly WorkspacePatchOperation[]): Promise<WorkspacePatchResult> {
	const root = resolve(cwd);
	const paths = unique(operations.map((operation) => operation.path));
	const snapshot = await createWorkspaceSnapshot(root, paths);
	try {
		for (const operation of operations) {
			const path = resolveSafePath(root, operation.path);
			switch (operation.kind) {
				case "write":
					await mkdir(dirname(path), { recursive: true });
					await writeFile(path, operation.content);
					break;
				case "delete":
					await rm(path, { recursive: true, force: true });
					break;
				case "mkdir":
					await mkdir(path, { recursive: true });
					break;
				default:
					throw new Error(`Unsupported workspace patch operation: ${(operation as { kind: string }).kind}`);
			}
		}
		return { snapshotId: snapshot.id, appliedOperations: operations.length };
	} catch (error) {
		await restoreWorkspaceSnapshot(root, snapshot.id);
		throw error;
	}
}

async function collectSnapshotEntries(root: string, target: string, entries: WorkspaceSnapshotEntry[]): Promise<void> {
	// Never follow a symlink while taking a recursive snapshot. Following one
	// could pull files from outside the workspace into the snapshot payload.
	const metadata = await lstat(target);
	if (metadata.isSymbolicLink()) return;
	const manifestPath = toManifestPath(root, target);
	if (metadata.isDirectory()) {
		entries.push({ path: manifestPath, kind: "directory" });
		for (const entry of await readdir(target, { withFileTypes: true })) {
			if (entry.isSymbolicLink() || shouldIgnore(entry.name, target, root)) continue;
			await collectSnapshotEntries(root, join(target, entry.name), entries);
		}
		return;
	}
	if (!metadata.isFile()) throw new Error(`Unsupported workspace entry: ${target}`);
	entries.push({ path: manifestPath, kind: "file", size: metadata.size, sha256: await hashFile(target) });
}

async function collectCurrentEntries(root: string, roots: readonly string[]): Promise<Map<string, WorkspaceSnapshotEntry>> {
	const entries: WorkspaceSnapshotEntry[] = [];
	for (const manifestRoot of roots) {
		const target = fromManifestPath(root, manifestRoot);
		try { await collectSnapshotEntries(root, target, entries); } catch (error) {
			if (!isMissingError(error)) throw error;
		}
	}
	return new Map(entries.map((entry) => [entry.path, entry]));
}

async function loadSnapshot(cwd: string, snapshotId: string): Promise<WorkspaceSnapshot> {
	if (!/^[0-9]+-[0-9a-f-]+$/i.test(snapshotId)) throw new Error("Invalid workspace snapshot id");
	const root = resolve(cwd);
	const path = join(snapshotDirectory(root), snapshotId, "manifest.json");
	const snapshot = JSON.parse(await readFile(path, "utf8")) as WorkspaceSnapshot;
	if (resolve(snapshot.root) !== root || snapshot.id !== snapshotId) throw new Error("Workspace snapshot root mismatch");
	return snapshot;
}

function resolveSafePath(cwd: string, inputPath: string): string {
	const root = resolve(cwd);
	const target = resolve(root, inputPath);
	const relativePath = relative(root, target);
	if (relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== "..")) {
		const manifestPath = toManifestPath(root, target);
		if (manifestPath === ".agent-data/workspace-snapshots" || manifestPath.startsWith(".agent-data/workspace-snapshots/")) throw new Error("Workspace snapshot storage is reserved");
		assertNoSymlinkAncestors(root, target);
		return target;
	}
	throw new Error(`Workspace path escapes root: ${inputPath}`);
}

/** Keep patch, inspection, and restore operations inside the lexical and
 * physical workspace boundary. Missing final path components are allowed;
 * existing symlink ancestors are not. */
function assertNoSymlinkAncestors(root: string, target: string): void {
	let current = target;
	while (true) {
		try {
			if (lstatSync(current).isSymbolicLink()) throw new Error(`Workspace path traverses a symlink: ${target}`);
		} catch (error) {
			if (error instanceof Error && error.message.startsWith("Workspace path traverses a symlink:")) throw error;
			if (!isMissingError(error)) throw error;
		}
		if (current === root) return;
		const parent = dirname(current);
		if (parent === current) return;
		current = parent;
	}
}

function toManifestPath(root: string, target: string): string {
	const path = relative(root, target).split(sep).join("/");
	return path || ".";
}

function fromManifestPath(root: string, manifestPath: string): string {
	return resolveSafePath(root, manifestPath === "." ? "." : manifestPath.split("/").join(sep));
}

function shouldIgnore(name: string, parent: string, root: string): boolean {
	if (name === ".git" || name === "node_modules" || name === ".agent-data") return true;
	return toManifestPath(root, join(parent, name)).startsWith(".agent-data/workspace-snapshots");
}

async function hashFile(path: string): Promise<string> {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function isMissingError(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
