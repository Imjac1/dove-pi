import { appendNativeSession, readNativeSessions } from "../project-provider/native-sessions.ts";
import { createProjectProvider } from "../project-provider/index.ts";

export async function runSessionCommand(commandArgs: readonly string[]): Promise<void> {
	const provider = createProjectProvider(process.cwd());
	const command = commandArgs[0] ?? "list";
	if (command === "list") {
		console.log(JSON.stringify({ projectRoot: provider.projectRoot, sessions: readNativeSessions(provider.projectRoot) }, null, 2));
		return;
	}
	if (command !== "record") throw new Error("Usage: dove-pi session list | record --title <title> [--summary <text>] [--change <text>] [--test <text>] [--next-step <text>] [--task <task>]");
	const title = readRequiredFlag(commandArgs.slice(1), "--title");
	const args = commandArgs.slice(1);
	const taskSelector = readFlag(args, "--task");
	const task = taskSelector ? provider.resolveTask(taskSelector) : provider.getCurrentTask();
	if (taskSelector && !task) throw new Error(`Task could not be resolved uniquely: ${taskSelector}`);
	const record = await appendNativeSession(provider.projectRoot, {
		title,
		summary: readFlag(args, "--summary"),
		changes: readRepeatedFlags(args, "--change"),
		tests: readRepeatedFlags(args, "--test"),
		nextSteps: readRepeatedFlags(args, "--next-step"),
		taskId: task?.stableId,
	});
	console.log(JSON.stringify({ projectRoot: provider.projectRoot, session: record }, null, 2));
}

function readRequiredFlag(args: readonly string[], name: string): string {
	const value = readFlag(args, name)?.trim();
	if (!value) throw new Error(`session record requires ${name} <value>.`);
	return value;
}

function readFlag(args: readonly string[], name: string): string | undefined {
	const inline = args.find((value) => value.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = args.indexOf(name);
	const value = index >= 0 ? args[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : undefined;
}

function readRepeatedFlags(args: readonly string[], name: string): readonly string[] {
	const values: string[] = [];
	for (let index = 0; index < args.length; index++) {
		if (args[index].startsWith(`${name}=`)) values.push(args[index].slice(name.length + 1));
		else if (args[index] === name && args[index + 1] !== undefined) values.push(args[++index]);
	}
	return values;
}
