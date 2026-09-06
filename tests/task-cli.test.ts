import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createProjectProvider } from "../src/project-provider/index.ts";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "src", "cli.ts");
const tsxLoader = pathToFileURL(join(process.cwd(), "node_modules", "tsx", "dist", "loader.mjs")).href;
const trellisTaskScript = join(process.cwd(), ".trellis", "scripts", "task.py");

async function runCli(root: string, ...args: string[]): Promise<unknown> {
	const env = { ...process.env };
	const result = await execFileAsync(process.execPath, ["--import", tsxLoader, cliPath, ...args], { cwd: root, env });
	return JSON.parse(result.stdout);
}

describe("Dove task and session CLI", () => {
	it("replays the project-local Trellis helper against the shared traces", async () => {
		const result = await execFileAsync("python", [trellisTaskScript, "convergence", "replay", "--trace", "september-3-installer-expansion-stops-at-finish"], { cwd: process.cwd(), env: { ...process.env } });
		const replay = JSON.parse(result.stdout) as { ok: boolean; traces: string[] };
		assert.equal(replay.ok, true);
		assert.deepEqual(replay.traces, ["september-3-installer-expansion-stops-at-finish"]);
	});

	it("persists a reducer-validated Trellis snapshot without hand-editing state", async () => {
		const fixture = JSON.parse(await readFile(join(process.cwd(), "tests", "fixtures", "task-convergence-traces.json"), "utf8")) as { traces: Array<{ steps: Array<{ event: unknown }> }> };
		const relativeSnapshot = join(".trellis", "tasks", `helper-test-${process.pid}`, "convergence.json");
		try {
			const event = JSON.stringify(fixture.traces[0]!.steps[0]!.event);
			const applied = await execFileAsync("python", [trellisTaskScript, "convergence", "apply", "--snapshot", relativeSnapshot, "--event", event], { cwd: process.cwd(), env: { ...process.env } });
			assert.equal((JSON.parse(applied.stdout) as { state: string }).state, "working");
			const status = await execFileAsync("python", [trellisTaskScript, "convergence", "status", "--snapshot", relativeSnapshot], { cwd: process.cwd(), env: { ...process.env } });
			assert.equal((JSON.parse(status.stdout) as { state: string }).state, "working");
		} finally {
			await rm(join(process.cwd(), ".trellis", "tasks", `helper-test-${process.pid}`), { recursive: true, force: true });
		}
	});

	it("rejects a malformed Trellis convergence snapshot without overwriting it", async () => {
		const directory = join(process.cwd(), ".trellis", "tasks", `helper-invalid-${process.pid}`);
		const relativeSnapshot = join(".trellis", "tasks", `helper-invalid-${process.pid}`, "convergence.json");
		const snapshot = join(directory, "convergence.json");
		try {
			await mkdir(directory, { recursive: true });
			await writeFile(snapshot, "{ malformed", "utf8");
			await assert.rejects(
				() => execFileAsync("python", [trellisTaskScript, "convergence", "status", "--snapshot", relativeSnapshot], { cwd: process.cwd(), env: { ...process.env } }),
				/JSON|Unexpected token|Expected property name/i,
			);
			assert.equal(await readFile(snapshot, "utf8"), "{ malformed");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("serializes concurrent Trellis convergence updates", async () => {
		const fixture = JSON.parse(await readFile(join(process.cwd(), "tests", "fixtures", "task-convergence-traces.json"), "utf8")) as { traces: Array<{ steps: Array<{ event: unknown }> }> };
		const directory = join(process.cwd(), ".trellis", "tasks", `helper-concurrent-${process.pid}`);
		const relativeSnapshot = join(".trellis", "tasks", `helper-concurrent-${process.pid}`, "convergence.json");
		try {
			const freeze = JSON.stringify(fixture.traces[0]!.steps[0]!.event);
			await execFileAsync("python", [trellisTaskScript, "convergence", "apply", "--snapshot", relativeSnapshot, "--event", freeze], { cwd: process.cwd(), env: { ...process.env } });
			const events = ["evidence:parallel-a", "evidence:parallel-b"].map((evidenceRef) => JSON.stringify({ schemaVersion: 1, kind: "acceptance.evidence_attached", acceptanceId: "AC-001", evidenceRef }));
			await Promise.all(events.map((event) => execFileAsync("python", [trellisTaskScript, "convergence", "apply", "--snapshot", relativeSnapshot, "--event", event], { cwd: process.cwd(), env: { ...process.env } })));
			const status = await execFileAsync("python", [trellisTaskScript, "convergence", "status", "--snapshot", relativeSnapshot], { cwd: process.cwd(), env: { ...process.env } });
			const snapshot = JSON.parse(status.stdout) as { revision: number; criteria: Array<{ id: string; evidenceRefs: string[] }> };
			assert.equal(snapshot.revision, 3);
			assert.deepEqual(snapshot.criteria.find((criterion) => criterion.id === "AC-001")?.evidenceRefs.sort(), ["evidence:parallel-a", "evidence:parallel-b"]);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
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
			const verification = (await runCli(root, "task", "verify", task.stableId) as { verification: { ready: boolean; structuralReady: boolean; planningReady: boolean; planningIssues: string[]; convergence: { health: string }; evidenceExists: boolean; note: string } }).verification;
			assert.equal(verification.ready, false);
			assert.equal(verification.structuralReady, true);
			assert.equal(verification.planningReady, false);
			assert.match(verification.planningIssues.join(" "), /acceptance|TBD/i);
			assert.equal(verification.convergence.health, "missing");
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

	it("freezes and reports native convergence separately from structural verification", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-task-cli-convergence-"));
		try {
			const created = await runCli(root, "task", "create", "CLI convergence");
			const task = (created as { task: { stableId: string } }).task;
			const frozen = await runCli(root, "task", "convergence", "freeze", "--criterion", "AC-001=The CLI contract is observable.") as { convergence: { acceptanceRevision: string; state: string } };
			assert.match(frozen.convergence.acceptanceRevision, /^[a-f0-9]{64}$/);
			assert.equal(frozen.convergence.state, "working");
			await runCli(root, "task", "convergence", "progress", "--acceptance", "AC-001", "--status", "passed", "--evidence", "evidence:cli-pass");
			const status = await runCli(root, "task", "status", task.stableId) as { convergence: { health: string; state: string } };
			assert.equal(status.convergence.health, "valid");
			assert.equal(status.convergence.state, "ready_to_finish");
			const convergenceStatus = await runCli(root, "task", "convergence", "status") as { convergence: { kind: string; snapshot: { state: string } } };
			assert.equal(convergenceStatus.convergence.kind, "valid");
			assert.equal(convergenceStatus.convergence.snapshot.state, "ready_to_finish");
			const verification = await runCli(root, "task", "verify", task.stableId) as { verification: { structuralReady: boolean; convergence: { health: string; state: string }; note: string } };
			assert.equal(verification.verification.structuralReady, true);
			assert.equal(verification.verification.convergence.health, "valid");
			assert.equal(verification.verification.convergence.state, "ready_to_finish");
			assert.match(verification.verification.note, /does not run tests or claim acceptance/);
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

	it("promotes the only remaining active goal after finishing the current goal", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-task-cli-current-fallback-"));
		try {
			const first = await runCli(root, "task", "create", "First");
			const firstId = (first as { task: { stableId: string } }).task.stableId;
			await runCli(root, "task", "create", "Second");
			await runCli(root, "task", "finish");
			const current = await runCli(root, "task", "current") as { currentTask: { stableId: string } };
			assert.equal(current.currentTask.stableId, firstId);
			const verification = await runCli(root, "task", "verify") as { verification: { taskStatus: string } };
			assert.equal(verification.verification.taskStatus, "active");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("fails clearly for unknown task selectors and options", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-task-cli-errors-"));
		try {
			await assert.rejects(() => runCli(root, "task", "status", "missing"), /Task could not be resolved uniquely/);
			await assert.rejects(() => runCli(root, "task", "continue", "missing"), /Task could not be resolved uniquely/);
			await assert.rejects(() => runCli(root, "task", "create", "Valid", "--unexpected", "value"), /Unknown task option/);
			await assert.rejects(() => runCli(root, "session", "record", "--title", "Valid", "--unexpected", "value"), /Unknown session option/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
