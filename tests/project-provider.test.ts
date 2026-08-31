import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createProjectProvider, discoverProject, parseTrellisCurrentTaskPath, readProjectManifest, summarizeProjectContinuation, updateProjectManifest, withProjectMutationLock, writeProjectManifest, TrellisProvider, type ProjectContextSnapshot, type ProjectTask } from "../src/project-provider/index.ts";
import { formatProjectStatus, inspectProjectStatus } from "../src/project-status.ts";

describe("project provider firewall", () => {
	it("accepts only bounded, non-stale public current-task command output", () => {
		const root = resolve("project-root");
		assert.equal(
			parseTrellisCurrentTaskPath(root, JSON.stringify({ current_task: { dir: ".trellis/tasks/demo" }, stale: false })),
			resolve(root, ".trellis", "tasks", "demo"),
		);
		assert.equal(parseTrellisCurrentTaskPath(root, JSON.stringify({ current_task: { dir: ".trellis/tasks/demo" }, stale: true })), undefined);
		assert.equal(parseTrellisCurrentTaskPath(root, JSON.stringify({ current_task: { dir: ".trellis/tasks/demo" } })), undefined);
		assert.equal(parseTrellisCurrentTaskPath(root, JSON.stringify({ current_task: { dir: ".trellis/tasks/demo" }, stale: "false" })), undefined);
		assert.equal(parseTrellisCurrentTaskPath(root, JSON.stringify({ current_task: { dir: "../outside" }, stale: false })), undefined);
		assert.equal(parseTrellisCurrentTaskPath(root, "not-json"), undefined);
	});

	it("projects deterministic provider-neutral continuation state", () => {
		const task = (id: string, status: string): ProjectTask => ({ stableId: `trellis:${id}`, provider: "trellis", providerTaskId: id, path: `C:/project/.trellis/tasks/${id}`, title: id, status, files: [] });
		const context = (tasks: readonly ProjectTask[], currentTask?: ProjectTask): ProjectContextSnapshot => ({ provider: "trellis", projectRoot: "C:/project", revision: "opaque:revision:value", tasks, ...(currentTask ? { currentTask } : {}), documents: [] });
		const current = task("current", "in_progress");
		assert.equal(summarizeProjectContinuation(context([current], current)).kind, "current");
		const single = summarizeProjectContinuation(context([task("done", "completed"), task("only", "in_progress")]));
		assert.equal(single.kind, "single_candidate");
		if (single.kind === "single_candidate") assert.equal(single.task.stableId, "trellis:only");
		const ambiguous = summarizeProjectContinuation(context([task("z", "active"), task("a", "started")]));
		assert.equal(ambiguous.kind, "ambiguous");
		if (ambiguous.kind === "ambiguous") assert.deepEqual(ambiguous.candidates.map((candidate) => candidate.stableId), ["trellis:a", "trellis:z"]);
		assert.equal(summarizeProjectContinuation(context([task("done", "completed")])).kind, "none");
	});

	it("reconciles Trellis task mutations from observed state without replay", async () => {
		const cases = [
			{ operation: "start" as const, status: "in_progress", expected: "observed" as const },
			{ operation: "finish" as const, status: "completed", expected: "observed" as const },
			{ operation: "archive" as const, status: "archived", expected: "observed" as const },
		];
		for (const testCase of cases) {
			const root = await mkdtemp(join(tmpdir(), `dove-reconcile-${testCase.operation}-`));
			const taskDir = join(root, ".trellis", "tasks", "demo");
			await mkdir(taskDir, { recursive: true });
			await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", "utf8");
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: "pending" }), "utf8");
			const beforeProvider = new TrellisProvider(root);
			const beforeRevision = beforeProvider.getContext().revision;
			await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: testCase.status }), "utf8");
			const afterProvider = new TrellisProvider(root);
			assert.equal(await afterProvider.reconcileTaskOperation(testCase.operation, ["demo"], beforeRevision), testCase.expected);
			await rm(root, { recursive: true, force: true });
		}
	});

	it("returns unknown when a Trellis mutation cannot be confirmed", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-reconcile-unknown-"));
		const taskDir = join(root, ".trellis", "tasks", "demo");
		await mkdir(taskDir, { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", "utf8");
		await writeFile(join(taskDir, "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: "pending" }), "utf8");
		const provider = new TrellisProvider(root);
		const revision = provider.getContext().revision;
		assert.equal(await provider.reconcileTaskOperation("finish", ["demo"], revision), "unknown");
		assert.equal(await provider.reconcileTaskOperation("finish", ["missing"], revision), "unknown");
		await rm(root, { recursive: true, force: true });
	});

	it("does not infer create success from a revision-only change", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-reconcile-create-"));
		await mkdir(join(root, ".trellis", "tasks", "demo"), { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", "utf8");
		await writeFile(join(root, ".trellis", "tasks", "demo", "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: "pending" }), "utf8");
		const beforeProvider = new TrellisProvider(root);
		const before = beforeProvider.getContext();
		await writeFile(join(root, ".trellis", "workflow.md"), "changed\n", "utf8");
		const afterProvider = new TrellisProvider(root);
		assert.equal(await afterProvider.reconcileTaskOperation("create", ["New task"], before.revision, before.tasks.map((task) => task.stableId)), "unknown");
		await rm(root, { recursive: true, force: true });
	});

	it("reconciles create only when a new exact-title task identity appears", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-reconcile-create-exact-"));
		await mkdir(join(root, ".trellis", "tasks", "demo"), { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", "utf8");
		await writeFile(join(root, ".trellis", "tasks", "demo", "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: "pending" }), "utf8");
		const beforeProvider = new TrellisProvider(root);
		const before = beforeProvider.getContext();
		await new Promise((resolve) => setTimeout(resolve, 10));
		await mkdir(join(root, ".trellis", "tasks", "new-task"), { recursive: true });
		await writeFile(join(root, ".trellis", "tasks", "new-task", "task.json"), JSON.stringify({ id: "new-task", title: "New task", status: "planning" }), "utf8");
		const afterProvider = new TrellisProvider(root);
		assert.equal(await afterProvider.reconcileTaskOperation("create", ["New task", "--description", "scope"], before.revision, before.tasks.map((task) => task.stableId)), "observed");
		await rm(root, { recursive: true, force: true });
	});

	it("discovers the nearest Trellis root and maps stable task identities", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-provider-"));
		await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", { encoding: "utf8" }).catch(async () => {
			await mkdir(join(root, ".trellis", "tasks", "demo"), { recursive: true });
			await writeFile(join(root, ".trellis", ".version"), "0.6.15\n", "utf8");
		});
		await mkdir(join(root, ".trellis", "tasks", "demo"), { recursive: true });
		await writeFile(join(root, ".trellis", "tasks", "demo", "task.json"), JSON.stringify({ id: "demo", title: "Demo", status: "in_progress" }), "utf8");
		await writeFile(join(root, ".trellis", "tasks", "demo", "prd.md"), "# Demo", "utf8");
		const nested = join(root, "packages", "app");
		await mkdir(nested, { recursive: true });
		assert.equal(discoverProject(nested).projectRoot, root);
		const provider = createProjectProvider(nested);
		assert.equal(provider.kind, "trellis");
		assert.equal(provider.getHealth().status, "healthy");
		assert.equal(provider.getCurrentTask(), undefined);
		assert.equal(provider.getContext().tasks[0]?.stableId, "trellis:demo");
		await rm(root, { recursive: true, force: true });
	});

	it("persists a stable manifest and lets it override provider discovery", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-manifest-"));
		await mkdir(join(root, ".trellis"), { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "0.6.15", "utf8");
		await updateProjectManifest(root, "lightweight");
		const manifest = readProjectManifest(root);
		assert.equal(manifest?.provider, "lightweight");
		assert.equal(createProjectProvider(root).kind, "lightweight");
		assert.match(await readFile(join(root, ".dove", "project.json"), "utf8"), /"adapterContract"/);
		await rm(root, { recursive: true, force: true });
	});

	it("falls back to visible lightweight status without a Trellis directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-lightweight-"));
		const provider = createProjectProvider(root);
		assert.equal(provider.kind, "lightweight");
		assert.equal(provider.projectRoot, root);
		assert.equal(provider.getHealth().status, "lightweight");
		assert.equal(provider.getContext().tasks.length, 0);
		await rm(root, { recursive: true, force: true });
	});

	it("reports project readiness and reload state as a single status projection", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-project-status-"));
		await mkdir(join(root, ".trellis", "scripts"), { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "0.6.15", "utf8");
		await writeFile(join(root, ".trellis", "scripts", "task.py"), "# test fixture\n", "utf8");
		const provider = createProjectProvider(root);
		assert.equal(inspectProjectStatus(provider).ready, true);
		assert.match(inspectProjectStatus(provider).issues.join("\n"), /No Trellis skills/);
		await mkdir(join(root, ".agents", "skills", "trellis-start"), { recursive: true });
		await writeFile(join(root, ".agents", "skills", "trellis-start", "SKILL.md"), "---\ndescription: Start\n---\n", "utf8");
		const report = inspectProjectStatus(createProjectProvider(root), true);
		assert.equal(report.ready, true);
		assert.equal(report.skillsReloadRequired, true);
		assert.match(formatProjectStatus(report), /Skills: 1 discovered \/ reload required/);
		await rm(root, { recursive: true, force: true });
	});

	it("does not cross a malformed explicit manifest into a parent Trellis project", async () => {
		const parent = await mkdtemp(join(tmpdir(), "dove-manifest-boundary-"));
		await mkdir(join(parent, ".trellis"), { recursive: true });
		await writeFile(join(parent, ".trellis", ".version"), "0.6.15", "utf8");
		const child = join(parent, "packages", "app");
		await mkdir(join(child, ".dove"), { recursive: true });
		await writeFile(join(child, ".dove", "project.json"), "{not-json", "utf8");
		const discovery = discoverProject(child);
		assert.equal(discovery.projectRoot, child);
		assert.equal(createProjectProvider(child).kind, "lightweight");
		await rm(parent, { recursive: true, force: true });
	});

	it("reports degraded Trellis status when its version marker is missing", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-degraded-"));
		await mkdir(join(root, ".trellis"), { recursive: true });
		const provider = createProjectProvider(root);
		assert.equal(provider.kind, "trellis");
		assert.equal(provider.getHealth().status, "degraded");
		assert.equal(provider.getHealth().trellisCompatibility, "unknown");
		assert.ok(provider.getHealth().issues.length > 0);
		await assert.rejects(() => provider.runTaskOperation("finish", []), /mutations are blocked/);
		await rm(root, { recursive: true, force: true });
	});

	it("blocks mutations for unsupported Trellis major versions", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-unsupported-trellis-"));
		await mkdir(join(root, ".trellis", "scripts"), { recursive: true });
		await writeFile(join(root, ".trellis", ".version"), "1.0.0\n", "utf8");
		const provider = createProjectProvider(root);
		assert.equal(provider.getHealth().trellisCompatibility, "unsupported");
		assert.equal(provider.getHealth().status, "degraded");
		await assert.rejects(() => provider.runTaskOperation("list" as never, []), /mutations are blocked/);
		await rm(root, { recursive: true, force: true });
	});

	it("serializes concurrent provider mutations with a project lock", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-lock-"));
		const events: string[] = [];
		const first = withProjectMutationLock(root, async () => {
			events.push("first-start");
			await new Promise((resolve) => setTimeout(resolve, 50));
			events.push("first-end");
		});
		await new Promise((resolve) => setTimeout(resolve, 5));
		const second = withProjectMutationLock(root, async () => { events.push("second"); });
		await Promise.all([first, second]);
		assert.deepEqual(events, ["first-start", "first-end", "second"]);
		await rm(root, { recursive: true, force: true });
	});

	it("does not allow a project manifest to redirect outside its directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-manifest-boundary-"));
		const outside = await mkdtemp(join(tmpdir(), "dove-manifest-outside-"));
		await mkdir(join(root, ".dove"), { recursive: true });
		await writeFile(join(root, ".dove", "project.json"), JSON.stringify({ provider: "lightweight", projectRoot: outside, adapterContract: "1.0" }), "utf8");
		const provider = createProjectProvider(root);
		assert.equal(provider.projectRoot, root);
		assert.equal(provider.kind, "lightweight");
		await rm(root, { recursive: true, force: true });
		await rm(outside, { recursive: true, force: true });
	});
});
