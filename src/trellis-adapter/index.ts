import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, resolve } from "node:path";

export interface TrellisTaskRecord {
	readonly path: string;
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly priority?: string;
	readonly files: readonly string[];
}

export interface TrellisMemoryRecord {
	readonly path: string;
	readonly kind: "journal" | "index" | "document";
	readonly developer?: string;
}

export interface TrellisSnapshot {
	readonly enabled: boolean;
	readonly root: string;
	readonly specFiles: readonly string[];
	readonly taskFiles: readonly string[];
	readonly memoryFiles: readonly string[];
	readonly workflowFiles: readonly string[];
	readonly tasks: readonly TrellisTaskRecord[];
	readonly memories: readonly TrellisMemoryRecord[];
	readonly activeTaskPath?: string;
}

export function readTrellisSnapshot(cwd: string): TrellisSnapshot {
	const root = join(cwd, ".trellis");
	if (!isDirectory(root)) return { enabled: false, root, specFiles: [], taskFiles: [], memoryFiles: [], workflowFiles: [], tasks: [], memories: [] };
	const specRoot = join(root, "spec");
	const taskRoot = join(root, "tasks");
	const memoryRoot = join(root, "workspace");
	const specFiles = isDirectory(specRoot) ? collectMarkdown(specRoot) : [];
	const taskFiles = isDirectory(taskRoot) ? collectMarkdown(taskRoot) : [];
	const memoryFiles = isDirectory(memoryRoot) ? collectMarkdown(memoryRoot) : [];
	const tasks = isDirectory(taskRoot) ? collectTasks(taskRoot) : [];
	const memories = isDirectory(memoryRoot) ? collectMemories(memoryRoot) : [];
	const workflowPath = join(root, "workflow.md");
	const workflowFiles = existsSync(workflowPath) && !isSensitiveProjectPath(workflowPath) ? [workflowPath] : [];
	return { enabled: true, root, specFiles, taskFiles, memoryFiles, workflowFiles, tasks, memories, activeTaskPath: readActiveTaskPath(cwd) };
}

export function readTrellisText(path: string): string {
	if (isSensitiveProjectPath(path)) throw new Error(`Sensitive project path is not eligible for Agent context: ${path}`);
	return readFileSync(path, "utf8");
}

/** Default deny-list for credentials and secret-bearing project content. */
export function isSensitiveProjectPath(path: string): boolean {
	const segments = normalize(path).split(/[\\/]/).map((segment) => segment.toLowerCase());
	const name = segments.at(-1) ?? "";
	if (segments.some((segment) => [".git", "node_modules", ".agent-data", "secrets", "credentials"].includes(segment))) return true;
	if (name === ".npmrc" || name === ".pypirc" || name === "id_rsa" || name === "id_ed25519") return true;
	if (name === ".env" || name.startsWith(".env.") || name.endsWith(".pem") || name.endsWith(".key") || name.endsWith(".p12") || name.endsWith(".pfx")) return true;
	return /(secret|credential|token|password|passwd|private[-_]?key)/i.test(name);
}

function collectMarkdown(root: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (isSensitiveProjectPath(path)) continue;
		if (entry.isDirectory()) results.push(...collectMarkdown(path));
		else if (entry.isFile() && entry.name.endsWith(".md")) results.push(path);
	}
	return results;
}

function isDirectory(path: string): boolean {
	try { return statSync(path).isDirectory(); } catch { return false; }
}

function collectTasks(root: string): TrellisTaskRecord[] {
	const records: TrellisTaskRecord[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const taskPath = join(root, entry.name);
		const metadataPath = join(taskPath, "task.json");
		const files = collectMarkdown(taskPath);
		let metadata: { id?: string; name?: string; title?: string; status?: string; priority?: string } = {};
		if (existsSync(metadataPath)) {
			try {
				metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as typeof metadata;
			} catch {
				// Keep file discovery useful when task metadata is stale or partial.
			}
		}
		records.push({
			path: taskPath,
			id: metadata.id ?? metadata.name ?? entry.name,
			title: metadata.title ?? metadata.name ?? entry.name,
			status: metadata.status ?? "unknown",
			priority: metadata.priority,
			files,
		});
	}
	return records;
}

function collectMemories(root: string): TrellisMemoryRecord[] {
	return collectMarkdown(root).map((path) => {
		const normalized = normalize(path);
		const segments = normalized.split("\\");
		const workspaceIndex = segments.indexOf("workspace");
		const candidate = workspaceIndex >= 0 ? segments[workspaceIndex + 1] : undefined;
		const developer = candidate && candidate !== "index.md" ? candidate : undefined;
		const name = segments.at(-1) ?? "";
		return { path, kind: name === "index.md" ? "index" : /^journal-\d+\.md$/i.test(name) ? "journal" : "document", developer };
	});
}

function readActiveTaskPath(cwd: string): string | undefined {
	const sessionsRoot = join(cwd, ".trellis", ".runtime", "sessions");
	if (!isDirectory(sessionsRoot)) return undefined;
	const entries = readdirSync(sessionsRoot).filter((entry) => entry.endsWith(".json"));
	const contextId = process.env.TRELLIS_CONTEXT_ID?.trim();
	const preferred = contextId && /^[A-Za-z0-9_.-]+$/.test(contextId) ? `${contextId}.json` : undefined;
	const ordered = preferred
		// An explicit session identity must never fall back to another window's
		// task pointer when its file is missing or stale.
		? (entries.includes(preferred) ? [preferred] : [])
		: entries
			.slice()
			.sort((left, right) => safeMtime(join(sessionsRoot, right)) - safeMtime(join(sessionsRoot, left)));
	for (const entry of ordered) {
		try {
			const session = JSON.parse(readFileSync(join(sessionsRoot, entry), "utf8")) as { current_task?: string };
			if (session.current_task) return resolve(cwd, isAbsolute(session.current_task) ? session.current_task : session.current_task);
		} catch {
			// Ignore stale or partially-written session state.
		}
	}
	return undefined;
}

function safeMtime(path: string): number {
	try { return statSync(path).mtimeMs; } catch { return 0; }
}
