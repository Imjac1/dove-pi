import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

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
}

export function readTrellisSnapshot(cwd: string): TrellisSnapshot {
	const root = join(cwd, ".trellis");
	if (!isDirectory(root)) return { enabled: false, root, specFiles: [], taskFiles: [], memoryFiles: [], workflowFiles: [], tasks: [], memories: [] };
	const specRoot = join(root, "spec");
	const taskRoot = join(root, "tasks");
	const memoryRoot = join(root, "workspace");
	const specFiles = isDirectory(specRoot) ? collectMarkdown(specRoot) : [];
	// Archived tasks are historical records, not active project context. Keeping
	// them out of the default projection prevents snapshot/revision cost from
	// growing with the lifetime of the repository.
	const taskFiles = isDirectory(taskRoot) ? collectMarkdown(taskRoot, new Set(["archive"])) : [];
	const memoryFiles = isDirectory(memoryRoot) ? collectMarkdown(memoryRoot) : [];
	const tasks = isDirectory(taskRoot) ? collectTasks(taskRoot) : [];
	const memories = isDirectory(memoryRoot) ? collectMemories(memoryRoot) : [];
	const workflowPath = join(root, "workflow.md");
	const workflowFiles = existsSync(workflowPath) && !isSensitiveProjectPath(workflowPath) ? [workflowPath] : [];
	return { enabled: true, root, specFiles, taskFiles, memoryFiles, workflowFiles, tasks, memories };
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

function collectMarkdown(root: string, skippedDirectories: ReadonlySet<string> = new Set()): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (entry.isDirectory() && skippedDirectories.has(entry.name.toLowerCase())) continue;
		const path = join(root, entry.name);
		if (isSensitiveProjectPath(path)) continue;
		if (entry.isDirectory()) results.push(...collectMarkdown(path, skippedDirectories));
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
