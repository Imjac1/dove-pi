import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createProjectProvider, summarizeProjectContinuation, type ProjectProvider, type ProjectTask, type ProjectTaskConvergenceOperation, type ProjectTaskConvergenceProgress, type ProjectTaskOperation } from "../project-provider/index.ts";
import type { FindingKind } from "../core/task-convergence.ts";
import { NATIVE_FORMAL_ARTIFACTS, nativeTaskArtifactPath, nativeTaskDirectory } from "../project-provider/native-artifacts.ts";

export async function runTaskCommand(commandArgs: readonly string[]): Promise<void> {
	const provider = createProjectProvider(process.cwd());
	const command = commandArgs[0] ?? "list";
	const args = commandArgs.slice(1);
	validateTaskArguments(command, args);
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
		const task = resolveTarget(provider, args[0], args[0] !== undefined);
		print({ projectRoot: provider.projectRoot, provider: provider.kind, health: provider.getHealth(), task, readiness: task ? verifyTask(provider, task) : undefined, convergence: task?.convergence, continuation: summarizeProjectContinuation(context, args[0]) });
		return;
	}
	if (command === "continue") {
		const context = provider.getContext();
		const selected = args[0] ? provider.resolveTask(args[0]) : undefined;
		if (args[0] && !selected) throw new Error(`Task could not be resolved uniquely: ${args[0]}`);
		print({ projectRoot: provider.projectRoot, continuation: summarizeProjectContinuation(context, selected?.stableId ?? args[0]) });
		return;
	}
	if (command === "verify") {
		const task = resolveTarget(provider, args[0], true);
		if (!task) throw new Error("No current task.");
		print({ projectRoot: provider.projectRoot, task, verification: verifyTask(provider, task) });
		return;
	}
	if (command === "convergence") {
		await runConvergenceCommand(provider, args);
		return;
	}
	if (["create", "start", "finish", "archive"].includes(command)) {
		const operation = command as ProjectTaskOperation;
		const result = await mutateTask(provider, operation, args);
		print(result);
		return;
	}
	throw new Error("Usage: dove-pi task list|current|status [task] | continue [task] | verify [task] | convergence <status|freeze|progress|finding|resolve-finding|decide|checkpoint|resume> [flags] | create <title> [--description <text>] | start <task> | finish | archive <task>");
}

async function runConvergenceCommand(provider: ProjectProvider, args: readonly string[]): Promise<void> {
	const action = args[0] ?? "status";
	const task = resolveTarget(provider, readFlag(args, "--task"), true);
	if (!task) throw new Error("No current task.");
	if (!provider.readTaskConvergence || !provider.mutateTaskConvergence) throw new Error("The project provider does not support task convergence.");
	if (action === "status") {
		print({ projectRoot: provider.projectRoot, task, convergence: provider.readTaskConvergence(task.stableId) });
		return;
	}
	let operation: ProjectTaskConvergenceOperation;
	if (action === "freeze") {
		const criteria = readFlags(args, "--criterion").map(parseCriterion);
		if (criteria.length === 0) throw new Error("convergence freeze requires at least one --criterion AC-ID=text value.");
		operation = { action: "freeze", criteria, ...optionalFlag(args, "--acceptance", "acceptanceId") };
	} else if (action === "progress") {
		const acceptanceId = requireFlag(args, "--acceptance");
		const status = requireFlag(args, "--status");
		const evidenceRefs = readFlags(args, "--evidence");
		let progress: ProjectTaskConvergenceProgress;
		if (status === "started" || status === "verification_started") progress = { kind: status };
		else if (status === "evidence") progress = { kind: "evidence", evidenceRef: requireFlag(args, "--evidence") };
		else if (status === "passed" || status === "failed") progress = { kind: status, ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}) };
		else if (status === "waived") progress = { kind: "waived", evidenceRef: requireFlag(args, "--evidence") };
		else if (status === "step_completed") progress = { kind: "step_completed", stepId: requireFlag(args, "--step") };
		else throw new Error("convergence progress --status must be started, evidence, passed, failed, waived, step_completed, or verification_started.");
		operation = { action: "progress", acceptanceId, progress };
	} else if (action === "finding") {
		const kind = requireFlag(args, "--kind");
		if (!isFindingKind(kind)) throw new Error("convergence finding --kind is invalid.");
		operation = {
			action: "finding",
			acceptanceId: requireFlag(args, "--acceptance"),
			finding: { id: requireFlag(args, "--finding-id"), kind, summary: requireFlag(args, "--summary"), evidenceRefs: readFlags(args, "--evidence") },
			...optionalFlag(args, "--next-action", "nextAction"),
		};
	} else if (action === "resolve-finding") {
		operation = { action: "resolve_finding", acceptanceId: requireFlag(args, "--acceptance"), findingId: requireFlag(args, "--finding-id"), ...(readFlags(args, "--evidence").length > 0 ? { evidenceRefs: readFlags(args, "--evidence") } : {}) };
	} else if (action === "decide") {
		operation = { action: "decide", acceptanceId: requireFlag(args, "--acceptance"), nextAction: requireFlag(args, "--next-action") };
	} else if (action === "checkpoint") {
		operation = { action: "checkpoint", acceptanceId: requireFlag(args, "--acceptance"), nextAction: requireFlag(args, "--next-action"), ...optionalFlag(args, "--unblock-condition", "unblockCondition") };
	} else if (action === "resume") {
		operation = { action: "resume", acceptanceId: requireFlag(args, "--acceptance"), acceptanceRevision: requireFlag(args, "--revision") };
	} else {
		throw new Error("Unknown convergence action. Use status, freeze, progress, finding, resolve-finding, decide, checkpoint, or resume.");
	}
	const snapshot = await provider.mutateTaskConvergence(task.stableId, operation);
	print({ projectRoot: provider.projectRoot, task: createProjectProvider(provider.projectRoot).resolveTask(task.stableId), convergence: snapshot });
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
	const resolved = after.tasks.find((task) => task.stableId === target!.stableId)
		?? after.tasks.find((task) => task.provider === "native" && task.title === target!.title);
	return { operation, task: resolved, projectRoot: provider.projectRoot };
}

function resolveTarget(provider: ProjectProvider, selector: string | undefined, required: boolean): ProjectTask | undefined {
	const task = selector ? provider.resolveTask(selector) : provider.getCurrentTask();
	if (!task && required) throw new Error(selector ? `Task could not be resolved uniquely: ${selector}` : "No current task.");
	return task;
}

function validateTaskArguments(command: string, args: readonly string[]): void {
	const valueFlags = new Set(["--description", "--task", "--criterion", "--acceptance", "--status", "--evidence", "--kind", "--finding-id", "--summary", "--next-action", "--unblock-condition", "--revision", "--step"]);
	const allowed = command === "create" ? new Set(["--description"]) : command === "convergence" ? valueFlags : new Set<string>();
	const positionalLimit = command === "convergence" ? 1 : command === "create" || command === "start" || command === "archive" || command === "status" || command === "continue" || command === "verify" ? 1 : 0;
	let positional = 0;
	for (let index = 0; index < args.length; index++) {
		const token = args[index]!;
		if (!token.startsWith("--")) {
			positional++;
			if (positional > positionalLimit) throw new Error(`Unexpected task argument: ${token}`);
			continue;
		}
		const separator = token.indexOf("=");
		const flag = separator >= 0 ? token.slice(0, separator) : token;
		if (!allowed.has(flag)) throw new Error(`Unknown task option: ${flag}`);
		if (separator < 0 && valueFlags.has(flag)) {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
			index++;
		}
	}
	if (!["list", "current", "status", "continue", "verify", "convergence", "create", "start", "finish", "archive"].includes(command)) return;
	if (command === "convergence") {
		const action = args[0];
		if (action && action.startsWith("--")) throw new Error("convergence requires an action.");
		if (action && !["status", "freeze", "progress", "finding", "resolve-finding", "decide", "checkpoint", "resume"].includes(action)) throw new Error(`Unknown convergence action: ${action}`);
	}
}

function verifyTask(provider: ProjectProvider, task: ProjectTask): Record<string, unknown> {
	const expected = task.provider === "native" && task.formal
		? NATIVE_FORMAL_ARTIFACTS.map((artifact) => nativeTaskArtifactPath(provider.projectRoot, task.providerTaskId, artifact))
		: task.files;
	const files = expected.map((path) => ({ path, exists: existsSync(path) }));
	const missing = files.filter((file) => !file.exists).map((file) => file.path);
	const planningIssues = task.provider === "native" && task.formal ? inspectPlanningIssues(provider, task) : [];
	const evidencePath = task.provider === "native" && task.formal ? join(nativeTaskDirectory(provider.projectRoot, task.providerTaskId), "evidence.jsonl") : undefined;
	const structuralReady = missing.length === 0;
	return { ready: structuralReady && planningIssues.length === 0, structuralReady, planningReady: planningIssues.length === 0, planningIssues, taskStatus: task.status, phase: task.phase, convergence: task.convergence ?? { health: "missing" }, files, missing, ...(evidencePath ? { evidencePath, evidenceExists: existsSync(evidencePath) } : {}), note: "Structural and planning check only; convergence state is reported separately and this command does not run tests or claim acceptance." };
}

function inspectPlanningIssues(provider: ProjectProvider, task: ProjectTask): string[] {
	const prd = nativeTaskArtifactPath(provider.projectRoot, task.providerTaskId, "prd.md");
	if (!existsSync(prd)) return ["Missing prd.md planning artifact."];
	let content = "";
	try { content = readFileSync(prd, "utf8"); } catch { return ["Unable to read prd.md planning artifact."]; }
	const issues: string[] = [];
	if (/\bTBD\b/i.test(content)) issues.push("prd.md still contains TBD requirements or acceptance criteria.");
	if (/Add observable acceptance criteria|define and verify the acceptance criteria|\[ \]\s*(?:Pending:)?\s*define/i.test(content)) issues.push("prd.md does not define an executable acceptance criterion.");
	return issues;
}

function readFlag(args: readonly string[], name: string): string | undefined {
	const inline = args.find((value) => value.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = args.indexOf(name);
	const value = index >= 0 ? args[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : undefined;
}

function readFlags(args: readonly string[], name: string): string[] {
	const values: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const value = args[index]!;
		if (value.startsWith(`${name}=`)) values.push(value.slice(name.length + 1));
		else if (value === name) {
			const following = args[index + 1];
			if (following && !following.startsWith("--")) values.push(following);
		}
	}
	return values;
}

function requireFlag(args: readonly string[], name: string): string {
	const value = readFlag(args, name);
	if (!value) throw new Error(`Missing required flag: ${name}`);
	return value;
}

function optionalFlag<Key extends string>(args: readonly string[], flag: string, key: Key): Partial<Record<Key, string>> {
	const value = readFlag(args, flag);
	return value ? { [key]: value } as Partial<Record<Key, string>> : {};
}

function parseCriterion(value: string): { readonly id: string; readonly text: string } {
	const separator = value.indexOf("=");
	if (separator <= 0 || separator === value.length - 1) throw new Error("Each --criterion must use AC-ID=text.");
	return { id: value.slice(0, separator), text: value.slice(separator + 1) };
}

function isFindingKind(value: string): value is FindingKind {
	return value === "blocking" || value === "regression" || value === "follow_up" || value === "scope_change" || value === "serious_unexpected_risk";
}

function print(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}
