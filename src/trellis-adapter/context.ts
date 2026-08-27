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
	const intent = classifyContextIntent(normalizedQuery);

	for (const document of context.documents) {
		const task = document.kind === "task" ? taskByFile.get(normalizePath(document.path)) : undefined;
		const isActiveTask = task !== undefined && activeTask !== undefined && task.stableId === activeTask.stableId;

		if (document.kind === "task") {
			const isPrd = document.path.toLowerCase().endsWith("prd.md");
			if (mode === "fast" && (!isActiveTask || !isPrd)) continue;
			if (mode !== "fast" && !isActiveTask && !intent.task) continue;
			if (mode !== "fast" && isActiveTask && !isPrd && !intent.task) continue;
			const priority = isActiveTask ? 100 : task?.priority === "P1" ? 40 : 20;
			addDocument(compiler, context, document, priority, isActiveTask && isPrd);
			continue;
		}

		if (document.kind === "spec") {
			const isRuntimeSpec = document.path.toLowerCase().endsWith("personal-agent-runtime.md");
			if (mode === "fast" && !isRuntimeSpec) continue;
			if (mode !== "fast" && !isRuntimeSpec && !intent.spec) continue;
			if (mode !== "fast" && isRuntimeSpec && !intent.runtime) continue;
			// Fast is the explicit low-latency contract: it always gets the
			// runtime contract. Standard/Ultra retrieve it only when the query
			// actually points at runtime/policy work, instead of paying for it on
			// every conversational turn.
			addDocument(compiler, context, document, isRuntimeSpec ? 90 : 10, mode === "fast" && isRuntimeSpec);
			continue;
		}

		if (document.kind === "workflow") {
			if (mode === "fast" || !intent.workflow) continue;
			addDocument(compiler, context, document, 70, false);
			continue;
		}

		if (document.kind === "memory" || document.kind === "journal") {
			if (!intent.memory || (mode !== "ultra" && !normalizedQuery.includes("memory"))) continue;
			addDocument(compiler, context, document, document.kind === "journal" ? 30 : 10, false);
		}
	}

	return compiler.compile(query, mode);
}

interface ContextIntent {
	readonly runtime: boolean;
	readonly spec: boolean;
	readonly workflow: boolean;
	readonly memory: boolean;
	readonly task: boolean;
}

function classifyContextIntent(query: string): ContextIntent {
	return {
		runtime: /runtime|powershell|policy|capabilit(?:y|ies)|execution|dispatcher|windows|provider|运行时|策略|能力|执行器|窗口/.test(query),
		spec: /spec|guideline|convention|contract|规范|指南|约定|契约|规则/.test(query),
		workflow: /workflow|phase|trellis|task lifecycle|工作流|阶段|任务生命周期/.test(query),
		memory: /memory|journal|history|previous|last time|decision|记忆|日志|历史|上次|之前|决定|讨论/.test(query),
		task: /prd|design|implement(?:ation)? plan|acceptance criteria|任务需求|任务设计|验收标准/.test(query),
	};
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
