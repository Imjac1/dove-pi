import { relative } from "node:path";
import type { AgentMode } from "../core/contracts.ts";
import { ContextCompiler, type CompiledContext } from "../core/context-compiler.ts";
import { createProjectProvider, type ProjectContextSnapshot, type ProjectProvider, type ProjectTask } from "../project-provider/index.ts";

/**
 * Compile context from the provider's normalized projection.
 *
 * The provider is the only layer allowed to know how project files are
 * discovered or decoded. This keeps explicit provider bindings (including
 * the lightweight fallback) authoritative and prevents a stale Trellis read
 * from leaking into the model prompt.
 */
export function buildProjectContext(provider: ProjectProvider, query: string, mode: AgentMode): CompiledContext {
	const compiler = new ContextCompiler();
	const context = provider.getContext();
	const activeTask = context.currentTask;
	const taskByFile = indexTaskFiles(context.tasks);
	const normalizedQuery = query.toLowerCase();

	for (const document of context.documents) {
		const task = document.kind === "task" ? taskByFile.get(normalizePath(document.path)) : undefined;
		const isActiveTask = task !== undefined && activeTask !== undefined && task.stableId === activeTask.stableId;

		if (document.kind === "task") {
			const isPrd = document.path.toLowerCase().endsWith("prd.md");
			if (mode === "fast" && (!isActiveTask || !isPrd)) continue;
			const priority = isActiveTask ? 100 : task?.priority === "P1" ? 40 : 20;
			addDocument(compiler, context, document, priority, isActiveTask && isPrd);
			continue;
		}

		if (document.kind === "spec") {
			const isRuntimeSpec = document.path.toLowerCase().endsWith("personal-agent-runtime.md");
			if (mode === "fast" && !isRuntimeSpec) continue;
			addDocument(compiler, context, document, isRuntimeSpec ? 90 : 10, isRuntimeSpec);
			continue;
		}

		if (document.kind === "workflow") {
			if (mode === "fast") continue;
			addDocument(compiler, context, document, 70, false);
			continue;
		}

		if (document.kind === "memory" || document.kind === "journal") {
			if (mode !== "ultra" && !normalizedQuery.includes("memory")) continue;
			addDocument(compiler, context, document, document.kind === "journal" ? 30 : 10, false);
		}
	}

	return compiler.compile(query, mode);
}

/** Backward-compatible convenience wrapper for callers that only have cwd. */
export function buildTrellisContext(cwd: string, query: string, mode: AgentMode): CompiledContext {
	return buildProjectContext(createProjectProvider(cwd), query, mode);
}

function indexTaskFiles(tasks: readonly ProjectTask[]): Map<string, ProjectTask> {
	const result = new Map<string, ProjectTask>();
	for (const task of tasks) for (const path of task.files) result.set(normalizePath(path), task);
	return result;
}

function addDocument(compiler: ContextCompiler, context: ProjectContextSnapshot, document: ProjectContextSnapshot["documents"][number], priority: number, required: boolean): void {
	const id = relative(context.projectRoot, document.path) || document.path;
	compiler.add({ id, kind: document.kind, content: document.content, priority, required, sourceRef: document.sourceRef });
}

function normalizePath(path: string): string {
	return path.replace(/[\\/]+/g, "/").toLowerCase();
}
