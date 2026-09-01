import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectProvider, discoverProject, initializeNativeProject, nativeProjectStatePath, readNativeProjectState, readProjectManifest, summarizeProjectContinuation, updateProjectManifest, withProjectMutationLock, type ProjectContextSnapshot, type ProjectTask } from "../src/project-provider/index.ts";
import { formatProjectStatus, inspectProjectStatus } from "../src/project-status.ts";

describe("Dove native project provider", () => {
	it("is immediately healthy in a clean project without creating metadata", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-clean-"));
		try {
			const provider = createProjectProvider(root);
			assert.equal(provider.kind, "native");
			assert.equal(provider.getHealth().status, "healthy");
			assert.equal(provider.getHealth().capabilities.atomicMutations, true);
			assert.equal(provider.getContext().tasks.length, 0);
			assert.equal(existsSync(nativeProjectStatePath(root)), false);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("creates, finishes, restarts, and archives compact native goals", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-lifecycle-"));
		try {
			let provider = createProjectProvider(root);
			await provider.runTaskOperation("create", ["Fix cache flow", "--description", "Reduce uncached input"]);
			provider = createProjectProvider(root);
			const created = provider.getCurrentTask();
			assert.equal(created?.provider, "native");
			assert.equal(created?.title, "Fix cache flow");
			assert.equal(readNativeProjectState(root).kind, "valid");

			await provider.runTaskOperation("finish", []);
			provider = createProjectProvider(root);
			assert.equal(provider.getCurrentTask(), undefined);
			assert.equal(provider.getContext().tasks[0]?.status, "completed");

			await provider.runTaskOperation("start", [created!.stableId]);
			provider = createProjectProvider(root);
			assert.equal(provider.getCurrentTask()?.stableId, created?.stableId);
			await provider.runTaskOperation("archive", [created!.stableId]);
			assert.equal(createProjectProvider(root).getContext().tasks.length, 0);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("silently establishes one current goal for ordinary execution", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-auto-"));
		try {
			const provider = createProjectProvider(root);
			assert.ok(provider.ensureCurrentGoal);
			const first = await provider.ensureCurrentGoal!("Repair login tests");
			const second = await provider.ensureCurrentGoal!("A later turn");
			assert.equal(first.stableId, second.stableId);
			assert.equal(createProjectProvider(root).getContext().tasks.length, 1);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("serializes initialization with goal creation without losing state", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-init-race-"));
		try {
			const provider = createProjectProvider(root);
			await Promise.all([
				initializeNativeProject(root),
				provider.runTaskOperation("create", ["Survives initialization"]),
			]);
			assert.equal(createProjectProvider(root).getCurrentTask()?.title, "Survives initialization");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("uses stable goal identities when several native goals share one state file", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-identities-"));
		try {
			const provider = createProjectProvider(root);
			await provider.runTaskOperation("create", ["First"]);
			const first = provider.getCurrentTask()!;
			await provider.runTaskOperation("create", ["Second"]);
			const second = provider.getCurrentTask()!;
			assert.equal(first.path, second.path);
			await provider.runTaskOperation("start", [first.stableId]);
			assert.equal(provider.getCurrentTask()?.stableId, first.stableId);
			await provider.runTaskOperation("archive", [second.stableId]);
			assert.equal(provider.getContext().tasks.some((task) => task.stableId === second.stableId), false);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("reads legacy Trellis data without executing or modifying project scripts", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-legacy-"));
		const taskDir = join(root, ".trellis", "tasks", "legacy");
		const script = join(root, ".trellis", "scripts", "task.py");
		try {
			await mkdir(taskDir, { recursive: true });
			await mkdir(join(root, ".trellis", "scripts"), { recursive: true });
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "legacy", title: "Legacy goal", status: "in_progress" }), "utf8");
			await writeFile(join(taskDir, "prd.md"), "# Legacy goal", "utf8");
			await writeFile(script, "from pathlib import Path\nPath('SCRIPT-RAN').write_text('bad')\n", "utf8");
			const beforeScript = await readFile(script, "utf8");
			const provider = createProjectProvider(root);
			assert.equal(provider.kind, "native");
			assert.equal(provider.getContext().tasks[0]?.stableId, "trellis:legacy");
			assert.equal(provider.getCurrentTask()?.stableId, "trellis:legacy");
			assert.equal(existsSync(join(root, "SCRIPT-RAN")), false);
			assert.equal(await readFile(script, "utf8"), beforeScript);
			assert.equal(existsSync(nativeProjectStatePath(root)), false);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("imports a selected legacy goal only into native state", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-import-"));
		const taskDir = join(root, ".trellis", "tasks", "legacy");
		try {
			await mkdir(taskDir, { recursive: true });
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "legacy", title: "Legacy goal", status: "in_progress" }), "utf8");
			const legacyBefore = await readFile(join(taskDir, "task.json"), "utf8");
			const provider = createProjectProvider(root);
			await provider.runTaskOperation("start", ["trellis:legacy"]);
			const current = createProjectProvider(root).getCurrentTask();
			assert.equal(current?.provider, "native");
			assert.equal(current?.title, "Legacy goal");
			assert.equal(await readFile(join(taskDir, "task.json"), "utf8"), legacyBefore);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("imports the sole legacy continuation instead of creating a duplicate prompt goal", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-auto-import-"));
		const taskDir = join(root, ".trellis", "tasks", "legacy");
		try {
			await mkdir(taskDir, { recursive: true });
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "legacy", title: "Existing work", status: "in_progress" }), "utf8");
			const current = await createProjectProvider(root).ensureCurrentGoal!("继续");
			assert.equal(current.provider, "native");
			assert.equal(current.title, "Existing work");
			assert.equal(createProjectProvider(root).getContext().tasks.filter((task) => task.provider === "native").length, 1);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("reports malformed native state but does not overwrite it", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-invalid-"));
		try {
			await mkdir(join(root, ".dove"), { recursive: true });
			await writeFile(nativeProjectStatePath(root), "{broken", "utf8");
			const provider = createProjectProvider(root);
			assert.equal(provider.getHealth().status, "degraded");
			await assert.rejects(() => provider.runTaskOperation("create", ["Do not overwrite"]), /could not be read/);
			assert.equal(await readFile(nativeProjectStatePath(root), "utf8"), "{broken");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("rejects dangling current identities and post-normalization ID collisions", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-invalid-shape-"));
		try {
			await mkdir(join(root, ".dove"), { recursive: true });
			const goal = { id: "goal-a", title: "A", status: "active", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", decisions: [], verification: [] };
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: "missing", goals: [goal] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "invalid");
			const longPrefix = "x".repeat(160);
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals: [{ ...goal, id: `${longPrefix}a` }, { ...goal, id: `${longPrefix}b` }] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "invalid");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("reconciles create, legacy import, finish, and archive from exact identities", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-reconcile-"));
		const taskDir = join(root, ".trellis", "tasks", "legacy");
		try {
			await mkdir(taskDir, { recursive: true });
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "legacy", title: "Legacy", status: "in_progress" }), "utf8");
			const provider = createProjectProvider(root);
			let before = provider.getContext();
			await provider.runTaskOperation("create", ["Created"]);
			assert.equal(await provider.reconcileTaskOperation!("create", ["Created"], before.revision, before.tasks.map((task) => task.stableId)), "observed");
			const created = provider.getCurrentTask()!;
			before = provider.getContext();
			await provider.runTaskOperation("finish", []);
			assert.equal(await provider.reconcileTaskOperation!("finish", [], before.revision, before.tasks.map((task) => task.stableId), created.stableId, created.status, created.stableId), "observed");
			before = provider.getContext();
			await provider.runTaskOperation("start", ["trellis:legacy"]);
			assert.equal(await provider.reconcileTaskOperation!("start", ["trellis:legacy"], before.revision, before.tasks.map((task) => task.stableId), "trellis:legacy"), "observed");
			await provider.runTaskOperation("archive", [created.stableId]);
			assert.equal(await provider.reconcileTaskOperation!("archive", [created.stableId], "native:2", [], created.stableId), "observed");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("bounds legacy compatibility projection and keeps native revision cache-stable", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-legacy-bounds-"));
		try {
			for (let index = 0; index < 120; index++) {
				const taskDir = join(root, ".trellis", "tasks", `task-${String(index).padStart(3, "0")}`);
				await mkdir(taskDir, { recursive: true });
				await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: `task-${index}`, status: "active" }), "utf8");
				await writeFile(join(taskDir, "prd.md"), "x".repeat(4_000), "utf8");
			}
			const provider = createProjectProvider(root);
			const legacy = provider.getContext();
			assert.equal(legacy.tasks.length, 100);
			assert.ok(legacy.documents.length <= 100);
			assert.ok(legacy.documents.reduce((total, document) => total + document.content.length, 0) <= 256_000);
			await provider.runTaskOperation("create", ["Native goal"]);
			const nativeRevision = provider.getContext().revision;
			await writeFile(join(root, ".trellis", "tasks", "task-000", "prd.md"), "changed", "utf8");
			assert.equal(provider.getContext().revision, nativeRevision);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("projects deterministic provider-neutral continuation state", () => {
		const task = (id: string, status: string): ProjectTask => ({ stableId: `native:${id}`, provider: "native", providerTaskId: id, path: "C:/project/.dove/state.json", title: id, status, files: [] });
		const context = (tasks: readonly ProjectTask[], currentTask?: ProjectTask): ProjectContextSnapshot => ({ provider: "native", projectRoot: "C:/project", revision: "1", tasks, ...(currentTask ? { currentTask } : {}), documents: [] });
		const current = task("current", "active");
		assert.equal(summarizeProjectContinuation(context([current], current)).kind, "current");
		assert.equal(summarizeProjectContinuation(context([task("done", "completed"), task("only", "active")])).kind, "single_candidate");
		assert.equal(summarizeProjectContinuation(context([task("a", "active"), task("b", "active")])).kind, "ambiguous");
	});

	it("uses a native manifest and preserves malformed-manifest boundaries", async () => {
		const parent = await mkdtemp(join(tmpdir(), "dove-native-manifest-"));
		const child = join(parent, "packages", "app");
		try {
			await mkdir(join(parent, ".trellis"), { recursive: true });
			await mkdir(join(child, ".dove"), { recursive: true });
			await writeFile(join(child, ".dove", "project.json"), "{bad", "utf8");
			assert.equal(discoverProject(child).projectRoot, child);
			assert.equal(createProjectProvider(child).projectRoot, child);
			await rm(join(child, ".dove", "project.json"));
			await initializeNativeProject(child);
			await updateProjectManifest(child, "native");
			assert.equal(readProjectManifest(child)?.provider, "native");
		} finally { await rm(parent, { recursive: true, force: true }); }
	});

	it("reports native project readiness without requiring skills", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-status-"));
		try {
			const report = inspectProjectStatus(createProjectProvider(root));
			assert.equal(report.ready, true);
			assert.equal(report.projectSkills, 0);
			assert.match(formatProjectStatus(report), /Provider: native/);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("serializes concurrent native mutations", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-lock-"));
		try {
			const events: string[] = [];
			const first = withProjectMutationLock(root, async () => { events.push("first-start"); await new Promise((resolve) => setTimeout(resolve, 50)); events.push("first-end"); });
			await new Promise((resolve) => setTimeout(resolve, 5));
			const second = withProjectMutationLock(root, async () => { events.push("second"); });
			await Promise.all([first, second]);
			assert.deepEqual(events, ["first-start", "first-end", "second"]);
		} finally { await rm(root, { recursive: true, force: true }); }
	});
});
