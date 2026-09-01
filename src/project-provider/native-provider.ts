import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { readTrellisSnapshot, readTrellisText } from "../trellis-adapter/index.ts";
import { withProjectMutationLock } from "./lock.ts";
import { MAX_NATIVE_GOALS, nativeProjectStatePath, readNativeProjectState, writeNativeProjectState, type NativeGoal, type NativeProjectState } from "./native-state.ts";
import { PROJECT_PROVIDER_CONTRACT, resolveProjectTask, toProjectTask, type ProjectContextSnapshot, type ProjectDocument, type ProjectProvider, type ProjectTask, type ProjectTaskOperation, type ProviderHealth } from "./contracts.ts";

const ACTIVE_STATUSES = new Set(["active", "in_progress", "in-progress", "started", "working"]);
const MAX_LEGACY_TASKS = 100;
const MAX_LEGACY_DOCUMENTS = 100;
const MAX_LEGACY_CONTEXT_CHARS = 256_000;

export class NativeProvider implements ProjectProvider {
	public readonly kind = "native" as const;
	public readonly projectRoot: string;

	public constructor(projectRoot: string) {
		this.projectRoot = resolve(projectRoot);
	}

	public getHealth(): ProviderHealth {
		const native = readNativeProjectState(this.projectRoot);
		return {
			provider: this.kind,
			status: native.kind === "invalid" ? "degraded" : "healthy",
			projectRoot: this.projectRoot,
			trellisCompatibility: existsSync(resolve(this.projectRoot, ".trellis")) ? "supported" : "unknown",
			adapterContract: PROJECT_PROVIDER_CONTRACT,
			capabilities: { readContext: true, readTasks: true, readMemory: true, taskLifecycle: true, mutations: true, atomicMutations: true },
			issues: native.kind === "invalid" ? [native.issue] : [],
		};
	}

	public getContext(): ProjectContextSnapshot {
		const native = readNativeProjectState(this.projectRoot);
		const state = native.state;
		const nativeTasks = state.goals.filter((goal) => goal.status !== "archived").map((goal) => nativeGoalTask(this.projectRoot, goal));
		const legacy = readLegacyProjection(this.projectRoot);
		const tasks = [...nativeTasks, ...legacy.tasks];
		const nativeCurrent = nativeTasks.find((task) => task.providerTaskId === state.currentGoalId);
		const legacyCurrent = nativeCurrent ? undefined : onlyContinuable(legacy.tasks);
		const statePath = nativeProjectStatePath(this.projectRoot);
		const documents: ProjectDocument[] = [...legacy.documents];
		if (native.kind === "valid") documents.unshift({ path: statePath, kind: "task", content: compactNativeState(state), sourceRef: statePath });
		return {
			provider: this.kind,
			projectRoot: this.projectRoot,
			revision: native.kind === "valid" ? `native:${state.revision}` : `native:${state.revision}:legacy:${legacy.revision}`,
			tasks,
			...(nativeCurrent ?? legacyCurrent ? { currentTask: nativeCurrent ?? legacyCurrent } : {}),
			documents,
		};
	}

	public getCurrentTask(): ProjectTask | undefined { return this.getContext().currentTask; }
	public resolveTask(selector: string): ProjectTask | undefined { return resolveProjectTask(this.getContext(), selector); }
	public readMemory(query?: string): readonly ProjectDocument[] {
		const documents = readLegacyProjection(this.projectRoot).documents.filter((document) => document.kind === "memory" || document.kind === "journal");
		const terms = query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
		return terms.length === 0 ? documents : documents.filter((document) => terms.every((term) => document.content.toLowerCase().includes(term)));
	}

	public async ensureCurrentGoal(title: string, description?: string): Promise<ProjectTask> {
		const existing = this.getContext().currentTask;
		if (existing?.provider === "native") return existing;
		if (existing) await this.runTaskOperation("start", [existing.stableId]);
		else await this.runTaskOperation("create", [title, ...(description ? ["--description", description] : [])]);
		const current = this.getContext().currentTask;
		if (!current) throw new Error("Dove created native goal state but could not resolve the current goal.");
		return current;
	}

	public async runTaskOperation(operation: ProjectTaskOperation, args: readonly string[]): Promise<string> {
		return withProjectMutationLock(this.projectRoot, async () => {
			const read = readNativeProjectState(this.projectRoot);
			if (read.kind === "invalid") throw new Error(read.issue);
			const now = new Date().toISOString();
			let state = read.state;
			switch (operation) {
				case "create": {
					const title = args[0]?.trim();
					if (!title) throw new Error("create requires a goal title.");
					const descriptionIndex = args.indexOf("--description");
					const description = descriptionIndex >= 0 ? args[descriptionIndex + 1]?.trim() : undefined;
					const goal: NativeGoal = { id: `goal-${randomUUID()}`, title: title.slice(0, 240), ...(description ? { description: description.slice(0, 2_000) } : {}), status: "active", createdAt: now, updatedAt: now, decisions: [], verification: [] };
					state = nextState(state, [...state.goals, goal], goal.id);
					break;
				}
				case "start": {
					const task = this.resolveTask(args[0] ?? "");
					if (!task) throw new Error("start target could not be resolved uniquely.");
					const nativeGoal = state.goals.find((goal) => `native:${goal.id}` === task.stableId);
					if (nativeGoal) {
						state = nextState(state, state.goals.map((goal) => goal.id === nativeGoal.id ? { ...goal, status: "active", updatedAt: now } : goal), nativeGoal.id);
					} else {
						const imported: NativeGoal = { id: `goal-${randomUUID()}`, title: task.title, description: `Imported read-only legacy task ${task.stableId}.`, status: "active", createdAt: now, updatedAt: now, decisions: [], verification: [] };
						state = nextState(state, [...state.goals, imported], imported.id);
					}
					break;
				}
				case "finish": {
					if (!state.currentGoalId) throw new Error("finish requires a current native goal.");
					state = nextState(state, state.goals.map((goal) => goal.id === state.currentGoalId ? { ...goal, status: "completed", updatedAt: now } : goal), undefined);
					break;
				}
				case "archive": {
					const task = this.resolveTask(args[0] ?? "");
					if (!task || task.provider !== "native") throw new Error("archive requires a native goal target.");
					state = nextState(state, state.goals.map((goal) => `native:${goal.id}` === task.stableId ? { ...goal, status: "archived", updatedAt: now } : goal), state.currentGoalId === task.providerTaskId ? undefined : state.currentGoalId);
					break;
				}
			}
			await writeNativeProjectState(this.projectRoot, state);
			return `Dove goal ${operation} completed.`;
		});
	}

	public async reconcileTaskOperation(operation: ProjectTaskOperation, _args: readonly string[], beforeRevision: string, beforeTaskIds: readonly string[] = [], targetTaskId?: string, _beforeTargetStatus?: string, beforeCurrentTaskId?: string): Promise<"observed" | "unknown"> {
		const context = this.getContext();
		if (context.revision === beforeRevision) return "unknown";
		if (operation === "create") return context.tasks.some((task) => task.provider === "native" && !beforeTaskIds.includes(task.stableId)) ? "observed" : "unknown";
		if (operation === "finish") {
			const finished = beforeCurrentTaskId ? context.tasks.find((task) => task.stableId === beforeCurrentTaskId) : undefined;
			return finished?.provider === "native" && finished.status === "completed" && context.currentTask?.stableId !== beforeCurrentTaskId ? "observed" : "unknown";
		}
		if (operation === "start") {
			if (targetTaskId?.startsWith("native:")) return context.currentTask?.stableId === targetTaskId ? "observed" : "unknown";
			return context.currentTask?.provider === "native" && !beforeTaskIds.includes(context.currentTask.stableId) ? "observed" : "unknown";
		}
		if (operation === "archive") return !context.tasks.some((task) => task.stableId === targetTaskId) ? "observed" : "unknown";
		return "unknown";
	}
}

function nextState(previous: NativeProjectState, goals: readonly NativeGoal[], currentGoalId: string | undefined): NativeProjectState {
	return { schemaVersion: 1, revision: previous.revision + 1, ...(currentGoalId ? { currentGoalId } : {}), goals: goals.slice(-MAX_NATIVE_GOALS) };
}

function nativeGoalTask(projectRoot: string, goal: NativeGoal): ProjectTask {
	const path = nativeProjectStatePath(projectRoot);
	return { stableId: `native:${goal.id}`, provider: "native", providerTaskId: goal.id, path, title: goal.title, status: goal.status, files: [path] };
}

function compactNativeState(state: NativeProjectState): string {
	const current = state.goals.find((goal) => goal.id === state.currentGoalId);
	return JSON.stringify({ schemaVersion: state.schemaVersion, revision: state.revision, currentGoal: current ? { id: current.id, title: current.title, status: current.status, nextStep: current.nextStep, decisions: current.decisions, verification: current.verification } : undefined });
}

function onlyContinuable(tasks: readonly ProjectTask[]): ProjectTask | undefined {
	const candidates = tasks.filter((task) => ACTIVE_STATUSES.has(task.status.toLowerCase()));
	return candidates.length === 1 ? candidates[0] : undefined;
}

function readLegacyProjection(projectRoot: string): { tasks: ProjectTask[]; documents: ProjectDocument[]; revision: string } {
	if (!existsSync(resolve(projectRoot, ".trellis"))) return { tasks: [], documents: [], revision: "none" };
	const snapshot = readTrellisSnapshot(projectRoot);
	const tasks = snapshot.tasks.slice(0, MAX_LEGACY_TASKS).map((task) => toProjectTask(task, "trellis"));
	const documents: ProjectDocument[] = [];
	let remainingChars = MAX_LEGACY_CONTEXT_CHARS;
	const add = (path: string, kind: ProjectDocument["kind"]): void => {
		if (documents.length >= MAX_LEGACY_DOCUMENTS || remainingChars <= 0) return;
		remainingChars -= addLegacyDocument(documents, projectRoot, path, kind, remainingChars);
	};
	for (const task of snapshot.tasks.slice(0, MAX_LEGACY_TASKS)) for (const path of task.files) add(path, "task");
	for (const path of snapshot.specFiles) add(path, "spec");
	for (const path of snapshot.workflowFiles) add(path, "workflow");
	for (const memory of snapshot.memories) add(memory.path, memory.kind === "journal" ? "journal" : "memory");
	let latest = 0;
	const revisionPaths = [...documents.map((document) => document.path), ...snapshot.tasks.slice(0, MAX_LEGACY_TASKS).map((task) => resolve(task.path, "task.json"))];
	for (const path of revisionPaths) try { latest = Math.max(latest, statSync(path).mtimeMs); } catch { /* legacy file changed during read */ }
	return { tasks, documents, revision: String(latest) };
}

function addLegacyDocument(documents: ProjectDocument[], projectRoot: string, path: string, kind: ProjectDocument["kind"], maxChars: number): number {
	try {
		const content = readTrellisText(path).slice(0, maxChars);
		documents.push({ path, kind, content, sourceRef: `legacy-trellis:${relative(projectRoot, path)}` });
		return content.length;
	} catch { return 0; }
}
