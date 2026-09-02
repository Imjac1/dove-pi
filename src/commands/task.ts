import { existsSync } from "node:fs";
import { join } from "node:path";
import { createProjectProvider, summarizeProjectContinuation, type ProjectProvider, type ProjectTask, type ProjectTaskOperation } from "../project-provider/index.ts";
import { NATIVE_FORMAL_ARTIFACTS, nativeTaskArtifactPath, nativeTaskDirectory } from "../project-provider/native-artifacts.ts";

export async function runTaskCommand(commandArgs: readonly string[]): Promise<void> {
	const provider = createProjectProvider(process.cwd());
	const command = commandArgs[0] ?? "list";
	const args = commandArgs.slice(1);
	if (command === "list") {
		const context = provider.getContext();
		print({ projectRoot: provider.projectRoot, provider: provider.kind, tasks: context.tasks, continuation: summarizeProjectContinuation(context) });
		return;
	}
	if (command === "current") {
		const context = provider.getContext();
		print({ projectRoot: provider.projectRoot, currentTask: context.currentTask, continuation: summarizeProjectContinuation(context) });
		return;
	}
	if (command === "status") {
		const context = provider.getContext();
		const task = resolveTarget(provider, args[0], false);
		print({ projectRoot: provider.projectRoot, provider: provider.kind, health: provider.getHealth(), task, continuation: summarizeProjectContinuation(context, args[0]) });
		return;
	}
	if (command === "continue") {
		const context = provider.getContext();
		print({ projectRoot: provider.projectRoot, continuation: summarizeProjectContinuation(context, args[0]) });
		return;
	}
	if (command === "verify") {
		const task = resolveTarget(provider, args[0], true);
		if (!task) throw new Error("No current task.");
		print({ projectRoot: provider.projectRoot, task, verification: verifyTask(provider, task) });
		return;
	}
	if (["create", "start", "finish", "archive"].includes(command)) {
		const operation = command as ProjectTaskOperation;
		const result = await mutateTask(provider, operation, args);
		print(result);
		return;
	}
	throw new Error("Usage: dove-pi task list|current|status [task] | continue [task] | verify [task] | create <title> [--description <text>] | start <task> | finish | archive <task>");
}

async function mutateTask(provider: ProjectProvider, operation: ProjectTaskOperation, args: readonly string[]): Promise<Record<string, unknown>> {
	const before = provider.getContext();
	let target: ProjectTask | undefined;
	if (operation === "create") {
		const title = args[0]?.startsWith("--") ? undefined : args[0];
		if (!title) throw new Error("task create requires a title.");
		const description = readFlag(args, "--description");
		await provider.runTaskOperation(operation, [title, ...(description ? ["--description", description] : [])]);
		const after = provider.getContext();
		target = after.tasks.find((task) => !before.tasks.some((previous) => previous.stableId === task.stableId) && task.title === title);
		return { operation, task: target, projectRoot: provider.projectRoot };
	}
	if (operation === "finish") target = before.currentTask;
	else target = resolveTarget(provider, args[0], true);
	if (!target) throw new Error(`${operation} requires a resolvable task.`);
	await provider.runTaskOperation(operation, operation === "finish" ? [] : [target.stableId]);
	const after = createProjectProvider(provider.projectRoot).getContext();
	return { operation, task: after.tasks.find((task) => task.stableId === target!.stableId), projectRoot: provider.projectRoot };
}

function resolveTarget(provider: ProjectProvider, selector: string | undefined, required: boolean): ProjectTask | undefined {
	const task = selector ? provider.resolveTask(selector) : provider.getCurrentTask();
	if (!task && required) throw new Error(selector ? `Task could not be resolved uniquely: ${selector}` : "No current task.");
	return task;
}

function verifyTask(provider: ProjectProvider, task: ProjectTask): Record<string, unknown> {
	const expected = task.provider === "native" && task.formal
		? NATIVE_FORMAL_ARTIFACTS.map((artifact) => nativeTaskArtifactPath(provider.projectRoot, task.providerTaskId, artifact))
		: task.files;
	const files = expected.map((path) => ({ path, exists: existsSync(path) }));
	const missing = files.filter((file) => !file.exists).map((file) => file.path);
	const evidencePath = task.provider === "native" && task.formal ? join(nativeTaskDirectory(provider.projectRoot, task.providerTaskId), "evidence.jsonl") : undefined;
	return { ready: missing.length === 0, taskStatus: task.status, phase: task.phase, files, missing, ...(evidencePath ? { evidencePath, evidenceExists: existsSync(evidencePath) } : {}), note: "Structural check only; it does not run tests or claim acceptance." };
}

function readFlag(args: readonly string[], name: string): string | undefined {
	const inline = args.find((value) => value.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = args.indexOf(name);
	const value = index >= 0 ? args[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : undefined;
}

function print(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}
