import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { readTrellisSnapshot, readTrellisText } from "../trellis-adapter/index.ts";
import { withProjectMutationLock } from "./lock.ts";
import {
	PROJECT_PROVIDER_CONTRACT,
	type ProjectContextSnapshot,
	type ProjectDocument,
	type ProjectProvider,
	type ProjectTask,
	type ProviderCapabilities,
	type ProviderHealth,
	toProjectTask,
	type TrellisTaskOperation,
} from "./contracts.ts";

const execFileAsync = promisify(execFile);

function trellisCapabilities(projectRoot: string): ProviderCapabilities {
	const taskScriptAvailable = existsSync(join(projectRoot, ".trellis", "scripts", "task.py"));
	return { readContext: true, readTasks: true, readMemory: true, taskLifecycle: taskScriptAvailable, mutations: taskScriptAvailable, atomicMutations: false };
}

export class TrellisProvider implements ProjectProvider {
	public readonly kind = "trellis" as const;
	public readonly projectRoot: string;
	private contextCache?: { context: ProjectContextSnapshot; expiresAt: number };

	public constructor(projectRoot: string) {
		this.projectRoot = resolve(projectRoot);
	}

	public getHealth(): ProviderHealth {
		const trellisRoot = join(this.projectRoot, ".trellis");
		if (!isDirectory(trellisRoot)) {
			return {
				provider: this.kind,
				status: "degraded",
				projectRoot: this.projectRoot,
				trellisCompatibility: "unknown",
				adapterContract: PROJECT_PROVIDER_CONTRACT,
				capabilities: trellisCapabilities(this.projectRoot),
				issues: ["Trellis project directory is missing."],
			};
		}
		const version = readTrellisVersion(trellisRoot);
		const issues: string[] = [];
		const compatibility = classifyTrellisVersion(version);
		if (!version) issues.push("Trellis project version is missing.");
		if (compatibility === "unknown" && version) issues.push(`Trellis project version is malformed: ${version}`);
		if (compatibility === "unsupported") issues.push(`Trellis major version is unsupported by adapter contract ${PROJECT_PROVIDER_CONTRACT}: ${version}`);
		const status = issues.length === 0 ? "healthy" : "degraded";
		return {
			provider: this.kind,
			status,
			projectRoot: this.projectRoot,
			...(version ? { trellisVersion: version } : {}),
			trellisCompatibility: compatibility,
			adapterContract: PROJECT_PROVIDER_CONTRACT,
			capabilities: trellisCapabilities(this.projectRoot),
			issues,
		};
	}

	public getContext(): ProjectContextSnapshot {
		// before_agent_start commonly asks for the same projection twice (tool
		// intent hint + context compilation). A very short request-local cache
		// removes duplicate recursive filesystem scans without hiding edits across
		// turns; mutations recreate the provider and therefore invalidate it.
		const now = Date.now();
		if (this.contextCache && this.contextCache.expiresAt > now) return this.contextCache.context;
		const discovered = readTrellisSnapshot(this.projectRoot);
		const tasks = discovered.tasks.map((task) => toProjectTask(task));
		const publicCurrentTaskPath = readPublicTrellisCurrentTaskPath(this.projectRoot);
		const currentTask = tasks.find((task) => task.path === publicCurrentTaskPath);
		const snapshot = currentTask ? { ...discovered, activeTaskPath: currentTask.path } : discovered;
		const documents: ProjectDocument[] = [];
		for (const task of snapshot.tasks) for (const path of task.files) addDocument(documents, path, "task");
		for (const path of snapshot.specFiles) addDocument(documents, path, "spec");
		for (const path of snapshot.workflowFiles) addDocument(documents, path, "workflow");
		for (const memory of snapshot.memories) addDocument(documents, memory.path, memory.kind === "journal" ? "journal" : "memory");
		const revision = contextRevision(this.projectRoot, snapshot);
		const context = { provider: this.kind, projectRoot: this.projectRoot, revision, tasks, ...(currentTask ? { currentTask } : {}), documents, raw: snapshot };
		this.contextCache = { context, expiresAt: now + 250 };
		return context;
	}

	public getCurrentTask(): ProjectTask | undefined {
		return this.getContext().currentTask;
	}

	public readMemory(query?: string): readonly ProjectDocument[] {
		const docs = this.getContext().documents.filter((document) => document.kind === "memory" || document.kind === "journal");
		if (!query?.trim()) return docs;
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		return docs.filter((document) => terms.every((term) => document.content.toLowerCase().includes(term)));
	}

	public async runTaskOperation(operation: TrellisTaskOperation, args: readonly string[]): Promise<string> {
		const health = this.getHealth();
		if (health.status !== "healthy") throw new Error(`Trellis Provider is ${health.status}; mutations are blocked until the project is repaired${health.issues.length ? `: ${health.issues.join("; ")}` : "."}`);
		const script = join(this.projectRoot, ".trellis", "scripts", "task.py");
		if (!existsSync(script)) throw new Error("Trellis task script is missing; run trellis update or repair the project");
		return withProjectMutationLock(this.projectRoot, async () => {
			try {
				const result = await execFileAsync("python", [script, operation, ...args], { cwd: this.projectRoot, windowsHide: true, maxBuffer: 1024 * 1024 });
				return result.stdout.trim() || result.stderr.trim() || `Trellis task ${operation} completed.`;
			} catch (error) {
				const details = error as { stdout?: string; stderr?: string; message?: string };
				throw new Error(details.stderr?.trim() || details.stdout?.trim() || details.message || `Trellis task ${operation} failed`);
			}
		});
	}

	public async reconcileTaskOperation(operation: TrellisTaskOperation, args: readonly string[], beforeRevision: string, beforeTaskIds: readonly string[] = []): Promise<"observed" | "unknown"> {
		const context = this.getContext();
		if (operation === "create") {
			if (context.revision === beforeRevision) return "unknown";
			const title = args[0]?.trim();
			if (!title || beforeTaskIds.length === 0) return "unknown";
			const created = context.tasks.find((task) => task.title === title && !beforeTaskIds.includes(task.stableId));
			return created ? "observed" : "unknown";
		}
		const selector = args[0]?.trim();
		const task = context.tasks.find((candidate) => candidate.path === selector || candidate.providerTaskId === selector || candidate.title === selector || candidate.path.endsWith(selector ?? "\u0000"));
		if (!task) return "unknown";
		const status = task.status.toLowerCase();
		if (operation === "start" && (context.currentTask?.stableId === task.stableId || ["active", "in_progress", "started"].includes(status))) return "observed";
		if (operation === "finish" && ["done", "completed", "complete", "finished"].includes(status)) return "observed";
		if (operation === "archive" && ["archived", "closed"].includes(status)) return "observed";
		return "unknown";
	}
}

function classifyTrellisVersion(version: string | undefined): "supported" | "unknown" | "unsupported" {
	if (!version) return "unknown";
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
	if (!match) return "unknown";
	return Number(match[1]) === 0 ? "supported" : "unsupported";
}

function readTrellisVersion(trellisRoot: string): string | undefined {
	const versionPath = join(trellisRoot, ".version");
	if (!existsSync(versionPath)) return undefined;
	try {
		const value = readFileSync(versionPath, "utf8").trim();
		return value || undefined;
	} catch {
		// Treat an unreadable marker like a missing marker so health reporting
		// degrades safely instead of taking down project discovery.
		return undefined;
	}
}

interface TrellisCurrentTaskOutput {
	readonly current_task?: { readonly dir?: unknown } | null;
	readonly stale?: unknown;
}

/** Parse only the documented `task.py current --json` result shape. */
export function parseTrellisCurrentTaskPath(projectRoot: string, output: string): string | undefined {
	try {
		const payload = JSON.parse(output) as TrellisCurrentTaskOutput;
		if (payload.stale !== false || !payload.current_task || typeof payload.current_task.dir !== "string") return undefined;
		const taskRoot = resolve(projectRoot, ".trellis", "tasks");
		const candidate = resolve(projectRoot, payload.current_task.dir);
		const relativeTask = relative(taskRoot, candidate);
		if (!relativeTask || relativeTask.startsWith("..") || isAbsolute(relativeTask)) return undefined;
		return candidate;
	} catch {
		return undefined;
	}
}

function readPublicTrellisCurrentTaskPath(projectRoot: string): string | undefined {
	const script = join(projectRoot, ".trellis", "scripts", "task.py");
	if (!existsSync(script)) return undefined;
	try {
		const output = execFileSync("python", [script, "current", "--json"], {
			cwd: projectRoot,
			encoding: "utf8",
			windowsHide: true,
			timeout: 3_000,
			maxBuffer: 256 * 1024,
		});
		return parseTrellisCurrentTaskPath(projectRoot, output);
	} catch {
		// Public current-task lookup is optional. If Python or the project-owned
		// Trellis command is unavailable, continuation safely falls back to the
		// normalized single/ambiguous/none candidate projection.
		return undefined;
	}
}

function isDirectory(path: string): boolean {
	try { return statSync(path).isDirectory(); } catch { return false; }
}

function contextRevision(projectRoot: string, snapshot: ReturnType<typeof readTrellisSnapshot>): string {
	const version = readTrellisVersion(join(projectRoot, ".trellis")) ?? "unknown";
	const active = snapshot.activeTaskPath ?? "";
	let latest = 0;
	// Task metadata is not part of the Markdown compatibility lists, but it
	// controls identity/status/title and therefore must invalidate a cached
	// projection when it changes.
	const taskMetadataFiles = snapshot.tasks.map((task) => join(task.path, "task.json"));
	// memoryFiles (workspace index + journal-N.md) are EXCLUDED from the revision:
	// journals are appended by session recording and change on nearly every
	// session, so including them would flip the provider prompt-cache prefix
	// (full cacheRead=0 misses) on every journal write. Memory content is still
	// re-read when a real spec/task/workflow change triggers a rebuild.
	for (const path of [...snapshot.specFiles, ...snapshot.taskFiles, ...snapshot.workflowFiles, ...taskMetadataFiles]) {
		try { latest = Math.max(latest, statSync(path).mtimeMs); } catch { /* file removed during refresh */ }
	}
	return `${version}:${latest}:${active ? relative(projectRoot, active) : ""}`;
}

function addDocument(documents: ProjectDocument[], path: string, kind: ProjectDocument["kind"]): void {
	try {
		documents.push({ path, kind, content: readTrellisText(path), sourceRef: path });
	} catch {
		// A file may disappear between discovery and projection; the next refresh
		// will pick it up without taking down the agent session.
	}
}
