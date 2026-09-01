import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { readTrellisSnapshot, readTrellisText } from "../trellis-adapter/index.ts";
import { withProjectMutationLock } from "./lock.ts";
import { appendNativeTaskEvidence, ensureNativeFormalArtifacts, nativeTaskFiles, nativeTaskArtifactPaths, readNativeFormalDocuments, updateNativeAcceptanceProjection, writeNativeTaskManifest, type NativeFormalArtifact } from "./native-artifacts.ts";
import { MAX_NATIVE_GOALS, nativeProjectStatePath, readNativeProjectState, writeNativeProjectState, type NativeGoal, type NativeProjectState } from "./native-state.ts";
import { PROJECT_PROVIDER_CONTRACT, resolveProjectTask, toProjectTask, type ProjectContextSnapshot, type ProjectDocument, type ProjectProvider, type ProjectTask, type ProjectTaskOperation, type ProjectTaskProgress, type ProviderHealth } from "./contracts.ts";

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
		if (native.kind === "valid") documents.unshift({ path: statePath, kind: "task", content: compactNativeState(this.projectRoot, state), sourceRef: statePath });
		const currentGoal = state.currentGoalId ? state.goals.find((goal) => goal.id === state.currentGoalId) : undefined;
		const nativeFormalDocuments = currentGoal?.formal ? readNativeFormalDocuments(this.projectRoot, currentGoal) : [];
		if (currentGoal?.formal) {
			for (const document of nativeFormalDocuments) documents.unshift({ path: document.path, kind: "task", content: document.content, sourceRef: document.sourceRef });
		}
		const formalRevision = nativeFormalDocuments.length > 0 ? createHash("sha256").update(nativeFormalDocuments.map((document) => `${document.path}\0${document.content}`).join("\0")).digest("hex").slice(0, 16) : "none";
		return {
			provider: this.kind,
			projectRoot: this.projectRoot,
			revision: native.kind === "valid" ? `native:${state.revision}:formal:${formalRevision}` : `native:${state.revision}:legacy:${legacy.revision}`,
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

	public async ensureFormalTask(title: string, description?: string): Promise<ProjectTask> {
		const existing = this.getContext().currentTask;
		if (existing?.provider === "native") {
			const read = readNativeProjectState(this.projectRoot);
			const goal = read.kind === "valid" ? read.state.goals.find((candidate) => candidate.id === existing.providerTaskId) : undefined;
			if (goal && !goal.formal) {
				await withProjectMutationLock(this.projectRoot, async () => {
					const current = readNativeProjectState(this.projectRoot);
					if (current.kind === "invalid") throw new Error(current.issue);
					const nativeGoal = current.state.goals.find((candidate) => candidate.id === existing.providerTaskId);
					if (!nativeGoal) return;
					const upgraded: NativeGoal = { ...nativeGoal, formal: true, phase: nativeGoal.phase ?? "intake", updatedAt: new Date().toISOString() };
					await ensureNativeFormalArtifacts(this.projectRoot, upgraded);
					await writeNativeProjectState(this.projectRoot, nextState(current.state, current.state.goals.map((candidate) => candidate.id === upgraded.id ? upgraded : candidate), upgraded.id));
				});
				return this.getContext().currentTask!;
			}
			if (goal) {
				await ensureNativeFormalArtifacts(this.projectRoot, goal);
				return this.getContext().currentTask!;
			}
		}
		return this.ensureCurrentGoal(title, description);
	}

	public async recordTaskProgress(taskId: string, progress: ProjectTaskProgress): Promise<void> {
		if (!taskId.startsWith("native:")) return;
		await withProjectMutationLock(this.projectRoot, async () => {
			const read = readNativeProjectState(this.projectRoot);
			if (read.kind === "invalid") throw new Error(read.issue);
			const goalId = taskId.slice("native:".length);
			const goal = read.state.goals.find((candidate) => candidate.id === goalId);
			if (!goal || !goal.formal) return;
			const now = new Date().toISOString();
			const updated: NativeGoal = {
				...goal,
				phase: progress.phase,
				updatedAt: now,
				...(progress.nextStep === undefined ? {} : { nextStep: progress.nextStep.slice(0, 1_000) }),
				decisions: progress.decision ? [...goal.decisions, progress.decision.slice(0, 1_000)].slice(-20) : goal.decisions,
				verification: progress.verification ? [...goal.verification, progress.verification.slice(0, 1_000)].slice(-20) : goal.verification,
			};
			await writeNativeProjectState(this.projectRoot, nextState(read.state, read.state.goals.map((candidate) => candidate.id === goal.id ? updated : candidate), read.state.currentGoalId));
			await writeNativeTaskManifest(this.projectRoot, updated);
			if (progress.evidence) {
				const evidence = { ...progress.evidence, phase: progress.phase, ...(progress.verification ? { verification: progress.verification } : {}), ...(progress.nextStep ? { nextStep: progress.nextStep } : {}) };
				await appendNativeTaskEvidence(this.projectRoot, goal.id, evidence);
				await updateNativeAcceptanceProjection(this.projectRoot, updated, evidence);
			}
		});
	}

	public async runTaskOperation(operation: ProjectTaskOperation, args: readonly string[]): Promise<string> {
		return withProjectMutationLock(this.projectRoot, async () => {
			const read = readNativeProjectState(this.projectRoot);
			if (read.kind === "invalid") throw new Error(read.issue);
			const now = new Date().toISOString();
			let state = read.state;
			let manifestGoal: NativeGoal | undefined;
			switch (operation) {
				case "create": {
					const title = args[0]?.trim();
					if (!title) throw new Error("create requires a goal title.");
					const descriptionIndex = args.indexOf("--description");
					const description = descriptionIndex >= 0 ? args[descriptionIndex + 1]?.trim() : undefined;
					const goal: NativeGoal = { id: `goal-${randomUUID()}`, title: title.slice(0, 240), ...(description ? { description: description.slice(0, 2_000) } : {}), status: "active", createdAt: now, updatedAt: now, decisions: [], verification: [], formal: true, phase: "intake" };
					await ensureNativeFormalArtifacts(this.projectRoot, goal);
					state = nextState(state, [...state.goals, goal], goal.id);
					break;
				}
				case "start": {
					const task = this.resolveTask(args[0] ?? "");
					if (!task) throw new Error("start target could not be resolved uniquely.");
					const nativeGoal = state.goals.find((goal) => `native:${goal.id}` === task.stableId);
					if (nativeGoal) {
						const startedGoal: NativeGoal = { ...nativeGoal, status: "active", phase: nativeGoal.phase === "completed" || nativeGoal.phase === "archived" ? "implementing" : nativeGoal.phase, updatedAt: now };
						state = nextState(state, state.goals.map((goal) => goal.id === nativeGoal.id ? startedGoal : goal), nativeGoal.id);
						manifestGoal = startedGoal;
						if (startedGoal.formal) await ensureNativeFormalArtifacts(this.projectRoot, startedGoal);
					} else {
						const imported: NativeGoal = { id: `goal-${randomUUID()}`, title: task.title, description: `Imported read-only legacy task ${task.stableId}.`, status: "active", createdAt: now, updatedAt: now, decisions: [], verification: [], formal: true, phase: "intake", source: "legacy-trellis", sourceRef: task.stableId };
						await ensureNativeFormalArtifacts(this.projectRoot, imported, readLegacyFormalArtifacts(task));
						manifestGoal = imported;
						state = nextState(state, [...state.goals, imported], imported.id);
					}
					break;
				}
				case "finish": {
					if (!state.currentGoalId) throw new Error("finish requires a current native goal.");
					const finishedGoal = state.goals.find((goal) => goal.id === state.currentGoalId);
					const completedGoal = finishedGoal ? { ...finishedGoal, status: "completed" as const, phase: "completed" as const, updatedAt: now } : undefined;
					state = nextState(state, state.goals.map((goal) => goal.id === state.currentGoalId ? completedGoal! : goal), undefined);
					manifestGoal = completedGoal;
					break;
				}
				case "archive": {
					const task = this.resolveTask(args[0] ?? "");
					if (!task || task.provider !== "native") throw new Error("archive requires a native goal target.");
					const archivedGoal = state.goals.find((goal) => `native:${goal.id}` === task.stableId);
					const archived: NativeGoal | undefined = archivedGoal ? { ...archivedGoal, status: "archived" as const, phase: "archived" as const, updatedAt: now } : undefined;
					state = nextState(state, state.goals.map((goal) => `native:${goal.id}` === task.stableId ? archived! : goal), state.currentGoalId === task.providerTaskId ? undefined : state.currentGoalId);
					manifestGoal = archived;
					break;
				}
			}
			await writeNativeProjectState(this.projectRoot, state);
			if (manifestGoal?.formal) await writeNativeTaskManifest(this.projectRoot, manifestGoal);
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
	return { stableId: `native:${goal.id}`, provider: "native", providerTaskId: goal.id, path, title: goal.title, status: goal.status, files: [path, ...(goal.formal ? nativeTaskFiles(projectRoot, goal) : [])], ...(goal.formal ? { formal: true } : {}), ...(goal.phase ? { phase: goal.phase } : {}) };
}

function compactNativeState(projectRoot: string, state: NativeProjectState): string {
	const current = state.goals.find((goal) => goal.id === state.currentGoalId);
	return JSON.stringify({ schemaVersion: state.schemaVersion, revision: state.revision, currentGoal: current ? { id: current.id, title: current.title, status: current.status, formal: current.formal === true, phase: current.phase, nextStep: current.nextStep, decisions: current.decisions, verification: current.verification, artifacts: current.formal ? nativeTaskArtifactPaths(projectRoot, current.id).map((path) => path.replace(/^.*[\\/].dove[\\/]tasks[\\/]/, "")) : [] } : undefined });
}

function onlyContinuable(tasks: readonly ProjectTask[]): ProjectTask | undefined {
	const candidates = tasks.filter((task) => ACTIVE_STATUSES.has(task.status.toLowerCase()));
	return candidates.length === 1 ? candidates[0] : undefined;
}

function readLegacyFormalArtifacts(task: ProjectTask): Partial<Record<NativeFormalArtifact, string>> {
	const artifacts: Partial<Record<NativeFormalArtifact, string>> = {};
	for (const path of task.files) {
		const artifact = path.split(/[\\/]/).at(-1)?.toLowerCase() as NativeFormalArtifact | undefined;
		if (!artifact || !["prd.md", "design.md", "implement.md", "acceptance.md"].includes(artifact)) continue;
		try { artifacts[artifact] = readTrellisText(path); } catch { /* skip unreadable compatibility files */ }
	}
	return artifacts;
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
