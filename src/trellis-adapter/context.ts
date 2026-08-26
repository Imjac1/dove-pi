import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { AgentMode } from "../core/contracts.ts";
import { ContextCompiler, type CompiledContext } from "../core/context-compiler.ts";
import { createProjectProvider } from "../project-provider/index.ts";
import { readTrellisSnapshot } from "./index.ts";

export function buildTrellisContext(cwd: string, query: string, mode: AgentMode): CompiledContext {
	const compiler = new ContextCompiler();
	const provider = createProjectProvider(cwd);
	if (provider.kind !== "trellis") return compiler.compile(query, mode);
	const projectRoot = provider.projectRoot;
	const snapshot = readTrellisSnapshot(projectRoot);

	for (const task of snapshot.tasks) {
		const isActive = snapshot.activeTaskPath !== undefined && task.path === snapshot.activeTaskPath;
		for (const path of task.files) {
			if (mode === "fast" && (!isActive || !path.endsWith("prd.md"))) continue;
			const priority = isActive ? 100 : task.priority === "P1" ? 40 : 20;
			addFile(compiler, projectRoot, path, "task", priority, isActive && path.endsWith("prd.md"));
		}
	}
	for (const path of snapshot.specFiles) {
		const isRuntimeSpec = path.endsWith("personal-agent-runtime.md");
		if (mode === "fast" && !isRuntimeSpec) continue;
		addFile(compiler, projectRoot, path, "spec", isRuntimeSpec ? 90 : 10, isRuntimeSpec);
	}
	for (const path of snapshot.workflowFiles) {
		if (mode === "fast") continue;
		addFile(compiler, projectRoot, path, "workflow", 70, false);
	}
	for (const memory of snapshot.memories) {
		if (mode !== "ultra" && !query.toLowerCase().includes("memory")) continue;
		addFile(compiler, projectRoot, memory.path, "memory", memory.kind === "journal" ? 30 : 10, false);
	}
	return compiler.compile(query, mode);
}

function addFile(compiler: ContextCompiler, cwd: string, path: string, kind: "task" | "spec" | "memory" | "workflow", priority: number, required: boolean): void {
	try {
		compiler.add({ id: relative(cwd, path), kind, content: readFileSync(path, "utf8"), priority, required, sourceRef: path });
	} catch {
		// Project files can change while a session is compiling context. The next
		// refresh will pick up a file that was temporarily unavailable.
	}
}
