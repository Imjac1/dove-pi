import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createProjectProvider } from "../src/project-provider/index.ts";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "src", "cli.ts");
const tsxLoader = pathToFileURL(join(process.cwd(), "node_modules", "tsx", "dist", "loader.mjs")).href;

async function runCli(root: string, ...args: string[]): Promise<unknown> {
	const env = { ...process.env };
	const result = await execFileAsync(process.execPath, ["--import", tsxLoader, cliPath, ...args], { cwd: root, env });
	return JSON.parse(result.stdout);
}

describe("Dove task and session CLI", () => {
	it("exposes task lifecycle, continuation, and structural verification", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-task-cli-"));
		try {
			const created = await runCli(root, "task", "create", "CLI task", "--description", "Track the workflow");
			const task = (created as { task: { stableId: string; title: string; formal?: boolean } }).task;
			assert.equal(task.title, "CLI task");
			assert.equal(task.formal, true);
			assert.equal((await runCli(root, "task", "list") as { tasks: unknown[] }).tasks.length, 1);
			assert.equal((await runCli(root, "task", "current") as { currentTask: { stableId: string } }).currentTask.stableId, task.stableId);
			assert.equal((await runCli(root, "task", "continue") as { continuation: { kind: string } }).continuation.kind, "current");
			const verification = (await runCli(root, "task", "verify", task.stableId) as { verification: { ready: boolean; evidenceExists: boolean; note: string } }).verification;
			assert.equal(verification.ready, true);
			assert.equal(verification.evidenceExists, false);
			assert.match(verification.note, /does not run tests/);
			await runCli(root, "task", "finish");
			const status = await runCli(root, "task", "status", task.stableId) as { task: { status: string; phase: string } };
			assert.equal(status.task.status, "completed");
			assert.equal(status.task.phase, "completed");
			await runCli(root, "task", "archive", task.stableId);
			assert.equal((await runCli(root, "task", "list") as { tasks: unknown[] }).tasks.length, 0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("records and lists a session without requiring a Trellis runtime", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-session-cli-"));
		try {
			const result = await runCli(root, "session", "record", "--title", "CLI smoke", "--summary", "Checked commands", "--change", "Added task CLI", "--test", "npm test", "--next-step", "Push changes");
			const session = (result as { session: { title: string; changes: string[]; tests: string[]; nextSteps: string[] } }).session;
			assert.equal(session.title, "CLI smoke");
			assert.deepEqual(session.changes, ["Added task CLI"]);
			assert.deepEqual(session.tests, ["npm test"]);
			assert.deepEqual(session.nextSteps, ["Push changes"]);
			const sessions = (await runCli(root, "session", "list") as { sessions: unknown[] }).sessions;
			assert.equal(sessions.length, 1);
			assert.equal(existsSync(join(root, ".dove", "sessions.jsonl")), true);
			assert.match(await readFile(join(root, ".dove", "sessions.jsonl"), "utf8"), /CLI smoke/);
			assert.equal(createProjectProvider(root).readMemory("Added task CLI").length, 1);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
