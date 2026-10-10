import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectProvider, discoverProject, initializeNativeProject, nativeProjectStatePath, nativeTaskArtifactPath, nativeTaskConvergencePath, readNativeProjectState, readProjectManifest, summarizeProjectContinuation, updateProjectManifest, withProjectMutationLock, type ProjectContextSnapshot, type ProjectTask } from "../src/project-provider/index.ts";
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
			assert.equal(created?.formal, true);
			assert.equal(created?.phase, "intake");
			assert.ok(existsSync(nativeTaskArtifactPath(root, created!.providerTaskId, "prd.md")));
			assert.ok(existsSync(nativeTaskArtifactPath(root, created!.providerTaskId, "design.md")));
			assert.ok(existsSync(nativeTaskArtifactPath(root, created!.providerTaskId, "implement.md")));
			assert.ok(existsSync(nativeTaskArtifactPath(root, created!.providerTaskId, "acceptance.md")));
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

	it("keeps formal documents user-owned and records bounded progress evidence", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-formal-progress-"));
		try {
			const provider = createProjectProvider(root) as import("../src/project-provider/index.ts").NativeProvider;
			const task = await provider.ensureFormalTask!("Formal cache work", "Keep durable engineering artifacts");
			const prdPath = nativeTaskArtifactPath(root, task.providerTaskId, "prd.md");
			await writeFile(prdPath, "# User-owned PRD\n", "utf8");
			await provider.ensureFormalTask!("Formal cache work", "Changed description must not overwrite the PRD");
			assert.equal(await readFile(prdPath, "utf8"), "# User-owned PRD\n");
			await provider.recordTaskProgress!(task.stableId, { phase: "implementing", nextStep: "Run focused tests", decision: "Keep the provider boundary", verification: "Unit test pending", evidence: { kind: "test", command: "npm test", result: "pending" } });
			const refreshed = createProjectProvider(root).getCurrentTask();
			assert.equal(refreshed?.phase, "implementing");
			const state = readNativeProjectState(root);
			assert.equal(state.kind, "valid");
			assert.equal(state.state.goals[0]?.nextStep, "Run focused tests");
			assert.deepEqual(state.state.goals[0]?.decisions, ["Keep the provider boundary"]);
			assert.deepEqual(state.state.goals[0]?.verification, ["Unit test pending"]);
			assert.match(await readFile(join(root, ".dove", "tasks", task.providerTaskId, "evidence.jsonl"), "utf8"), /"command":"npm test"/);
			await provider.recordTaskProgress!(task.stableId, { phase: "blocked", nextStep: "Fix the failing test", verification: "Request failed.", evidence: { kind: "request", outcome: "failed" } });
			assert.equal(createProjectProvider(root).getCurrentTask()?.phase, "blocked");
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
			await writeFile(join(taskDir, "prd.md"), "# Legacy PRD\n\nKeep the useful requirement.", "utf8");
			await writeFile(join(taskDir, "design.md"), "# Legacy design", "utf8");
			await writeFile(join(taskDir, "implement.md"), "# Legacy implementation", "utf8");
			await writeFile(join(taskDir, "acceptance.md"), "# Legacy acceptance", "utf8");
			const legacyBefore = await readFile(join(taskDir, "task.json"), "utf8");
			const provider = createProjectProvider(root);
			await provider.runTaskOperation("start", ["trellis:legacy"]);
			const current = createProjectProvider(root).getCurrentTask();
			assert.equal(current?.provider, "native");
			assert.equal(current?.title, "Legacy goal");
			assert.equal(JSON.parse(await readFile(join(root, ".dove", "tasks", current!.providerTaskId, "task.json"), "utf8")).source, "legacy-trellis");
			assert.equal(await readFile(nativeTaskArtifactPath(root, current!.providerTaskId, "prd.md"), "utf8"), "# Legacy PRD\n\nKeep the useful requirement.");
			assert.equal(await readFile(nativeTaskArtifactPath(root, current!.providerTaskId, "acceptance.md"), "utf8"), "# Legacy acceptance");
			assert.equal(await readFile(join(taskDir, "task.json"), "utf8"), legacyBefore);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("projects observed formal evidence into acceptance without claiming unobserved success", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-acceptance-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Acceptance projection");
			await provider.recordTaskProgress!(task.stableId, { phase: "verifying", verification: "npm test failed: 1 assertion", evidence: { kind: "test", outcome: "failed", command: "npm test" } });
			const acceptance = await readFile(nativeTaskArtifactPath(root, task.providerTaskId, "acceptance.md"), "utf8");
			assert.match(acceptance, /observed outcome: failed/);
			assert.match(acceptance, /npm test failed: 1 assertion/);
			assert.doesNotMatch(acceptance, /passed|success/i);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("bounds long-running evidence while retaining the newest observations", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-evidence-bound-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Evidence bound");
			for (let index = 0; index < 120; index++) await provider.recordTaskProgress!(task.stableId, { phase: "verifying", evidence: { index, payload: "x".repeat(1_000) } });
			const evidence = await readFile(join(root, ".dove", "tasks", task.providerTaskId, "evidence.jsonl"), "utf8");
			assert.ok(evidence.length <= 32_000);
			assert.ok(evidence.includes('"index":119'));
			assert.ok(!evidence.includes('"index":0'));
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("persists typed convergence operations under the native task boundary", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-convergence-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Convergence lifecycle");
			const criteria = [
				{ id: "AC-001", text: "The primary behavior passes." },
				{ id: "AC-002", text: "Verification remains in scope." },
			];
			let snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "freeze", criteria });
			const convergencePath = nativeTaskConvergencePath(root, task.providerTaskId);
			assert.equal(existsSync(convergencePath), true);
			const frozenBytes = await readFile(convergencePath, "utf8");
			await assert.rejects(() => provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-999", progress: { kind: "started" } }), /Unknown acceptance ID/);
			assert.equal(await readFile(convergencePath, "utf8"), frozenBytes);
			await Promise.all([
				provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-001", progress: { kind: "evidence", evidenceRef: "evidence:parallel-a" } }),
				provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-001", progress: { kind: "evidence", evidenceRef: "evidence:parallel-b" } }),
			]);
			const concurrent = provider.readTaskConvergence!(task.stableId);
			assert.equal(concurrent.kind, "valid");
			assert.deepEqual([...(concurrent.kind === "valid" ? concurrent.snapshot.criteria[0]?.evidenceRefs ?? [] : [])].sort(), ["evidence:parallel-a", "evidence:parallel-b"]);

			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-001", progress: { kind: "started" } });
			// **The observation, through the provider that writes every other record.** The kind, its decoder and its
			// reducer branch existed with no producer at all until the request terminal began emitting one; this is
			// the round trip through the layer that owns the record.
			const observed = await provider.mutateTaskConvergence!(task.stableId, { action: "observe", acceptanceId: "AC-001", resources: { toolCalls: 7, providerRounds: 3, elapsedMs: 1234, outputTokens: 99 } });
			assert.equal(observed.observedResources.toolCalls, 7);
			assert.equal(observed.observedResources.providerRounds, 3);
			assert.equal(observed.observedResources.elapsedMs, 1234);
			assert.equal(observed.observedResources.outputTokens, 99);
			assert.equal(observed.revision, snapshot.revision + 1, "an observation advances the revision");
			assert.deepEqual(observed.criteria, snapshot.criteria, "and decides nothing: the criteria are untouched");
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "finding", acceptanceId: "AC-001", finding: { id: "follow-up-1", kind: "follow_up", summary: "Neighboring cleanup is outside this acceptance set.", evidenceRefs: ["evidence:follow-up"] } });
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "decide", acceptanceId: "AC-001", nextAction: "Run the focused AC-001 check." });
			assert.equal(snapshot.consecutiveNoProgress, 0);
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "decide", acceptanceId: "AC-001", nextAction: "Use the existing AC-001 evidence." });
			assert.equal(snapshot.consecutiveNoProgress, 1);
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "checkpoint", acceptanceId: "AC-001", nextAction: "Resume the focused AC-001 check." });
			assert.equal(snapshot.state, "checkpointed");
			const checkpointRevision = snapshot.acceptanceRevision;
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "resume", acceptanceId: "AC-001", acceptanceRevision: checkpointRevision });
			assert.equal(snapshot.state, "working");
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-001", progress: { kind: "passed", evidenceRefs: ["evidence:ac-001"] } });
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-002", progress: { kind: "failed", evidenceRefs: ["evidence:failure"] } });
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "finding", acceptanceId: "AC-002", finding: { id: "blocker-1", kind: "blocking", summary: "The accepted verification still fails.", evidenceRefs: ["evidence:blocker"] } });
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "update_finding", acceptanceId: "AC-002", findingId: "blocker-1", evidenceRefs: ["evidence:blocker-log"], nextAction: "Create a follow-up task." });
			assert.deepEqual(snapshot.findings.find((finding) => finding.id === "blocker-1")?.evidenceRefs, ["evidence:blocker", "evidence:blocker-log"]);
			assert.equal(snapshot.findings.find((finding) => finding.id === "blocker-1")?.open, true);
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-002", progress: { kind: "passed", evidenceRefs: ["evidence:ac-002"] } });
			assert.equal(snapshot.state, "working");
			snapshot = await provider.mutateTaskConvergence!(task.stableId, { action: "resolve_finding", acceptanceId: "AC-002", findingId: "blocker-1", evidenceRefs: ["evidence:blocker-fixed"] });
			assert.equal(snapshot.state, "ready_to_finish");

			const projected = createProjectProvider(root).resolveTask(task.stableId)!;
			assert.equal(projected.convergence?.health, "valid");
			assert.equal(projected.convergence?.health === "valid" ? projected.convergence.state : undefined, "ready_to_finish");
			const state = readNativeProjectState(root);
			assert.equal(state.kind, "valid");
			assert.equal(state.state.goals.find((goal) => goal.id === task.providerTaskId)?.convergence?.snapshotRevision, snapshot.revision);
			assert.match(await readFile(join(root, ".dove", "tasks", task.providerTaskId, "evidence.jsonl"), "utf8"), /"kind":"convergence.decision"/);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("checkpoints instead of silently accepting a changed frozen contract", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-convergence-drift-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Acceptance drift");
			const original = await provider.mutateTaskConvergence!(task.stableId, { action: "freeze", criteria: [{ id: "AC-001", text: "The original accepted outcome." }] });
			const drifted = await provider.mutateTaskConvergence!(task.stableId, { action: "freeze", acceptanceId: "AC-001", criteria: [{ id: "AC-001", text: "The materially changed outcome." }] });
			assert.equal(drifted.acceptanceRevision, original.acceptanceRevision);
			assert.equal(drifted.state, "checkpointed");
			assert.equal(drifted.findings[0]?.kind, "scope_change");
			const projection = createProjectProvider(root).getCurrentTask()?.convergence;
			assert.equal(projection?.health, "valid");
			assert.equal(projection?.health === "valid" ? projection.openFindingIds.length : 0, 1);
			assert.match(projection?.health === "valid" ? projection.stateReason ?? "" : "", /Acceptance revision changed/);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("preserves malformed convergence bytes and degrades only convergence metadata", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-convergence-invalid-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Malformed convergence");
			const path = nativeTaskConvergencePath(root, task.providerTaskId);
			await writeFile(path, "{broken-convergence", "utf8");
			const fresh = createProjectProvider(root);
			assert.equal(fresh.getHealth().status, "degraded");
			assert.equal(fresh.getContext().currentTask?.convergence?.health, "invalid");
			await assert.rejects(() => fresh.mutateTaskConvergence!(task.stableId, { action: "freeze", criteria: [{ id: "AC-001", text: "Must not overwrite malformed bytes." }] }), /could not be read/);
			assert.equal(await readFile(path, "utf8"), "{broken-convergence");
			assert.equal(readNativeProjectState(root).kind, "valid");
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
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals: [{ ...goal, formal: "yes" }] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "invalid");
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals: [{ ...goal, phase: "unknown" }] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "invalid");
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals: [{ ...goal, convergence: { schemaVersion: 1, state: "working" } }] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "invalid");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("keeps legacy schema-1 goal IDs readable while rejecting unsafe formal task paths", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-legacy-goal-id-"));
		try {
			await mkdir(join(root, ".dove"), { recursive: true });
			const legacyGoal = { id: "legacy goal", title: "Legacy goal", status: "active", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", decisions: [], verification: [] };
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: legacyGoal.id, goals: [legacyGoal] }), "utf8");
			assert.equal(readNativeProjectState(root).kind, "valid");
			assert.equal(createProjectProvider(root).getCurrentTask()?.providerTaskId, "legacy goal");
			assert.throws(() => nativeTaskConvergencePath(root, "../outside"), /cannot be used as a task directory/);
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
		assert.equal(summarizeProjectContinuation(context([current, task("other", "active")], current)).kind, "current");
		assert.equal(summarizeProjectContinuation(context([current, task("other", "active")]), "other").kind, "selected");
		assert.equal(summarizeProjectContinuation(context([current, task("done", "completed")]), "done").kind, "none");
		assert.equal(summarizeProjectContinuation(context([current, task("other", "active")]), "missing").kind, "none");
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

	// **The lock's own error handling, which a probe measured rather than a reading.** The acquisition and the action
	// used to share one `try`, so an action whose own error carried `EEXIST` was read as contention: it was handed the
	// lock again and ran a second time (four runs in the measurement), and an error that kept carrying `EEXIST` never
	// returned at all, because the deleted lock directory reads as stale and the stale branch skipped the deadline.
	it("does not read an action's own EEXIST as lock contention", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-lock-eexist-"));
		try {
			let runs = 0;
			await assert.rejects(
				withProjectMutationLock(root, async () => {
					runs++;
					const error = new Error("the action's own path already existed") as Error & { code?: string };
					error.code = "EEXIST";
					throw error;
				}, { timeoutMs: 500, retryMs: 5 }),
				/the action's own path already existed/,
			);
			assert.equal(runs, 1, "the action ran once: its own EEXIST belongs to the caller, not to the lock");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("re-enters this project's lock instead of waiting on itself", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-lock-reentrant-"));
		try {
			const order: string[] = [];
			await withProjectMutationLock(root, async () => {
				order.push("outer");
				await withProjectMutationLock(root, async () => { order.push("inner"); }, { timeoutMs: 1_000, retryMs: 5 });
				order.push("outer-end");
			}, { timeoutMs: 1_000, retryMs: 5 });
			assert.deepEqual(order, ["outer", "inner", "outer-end"], "a nested acquisition passes through rather than deadlocking");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	const storedGoal = (id: string, status = "active", createdAt = "2026-01-01T00:00:00.000Z") => ({ id, title: id, status, createdAt, updatedAt: createdAt, decisions: [], verification: [], formal: true, phase: "intake" });

	// The bound is published, so it stays. What changed is what reaching it costs: the provider used to keep the newest
	// hundred goals and drop the rest in silence, leaving the dropped goal's `.dove/tasks/<id>/` directory on disk with
	// nothing able to resolve, finish or archive it.
	it("refuses a new goal at the bound instead of dropping live work", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-goal-bound-refuse-"));
		try {
			await mkdir(join(root, ".dove"), { recursive: true });
			const goals = Array.from({ length: 100 }, (_, index) => storedGoal(`goal-${String(index).padStart(3, "0")}`));
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals }), "utf8");
			const provider = createProjectProvider(root);
			await assert.rejects(() => provider.runTaskOperation("create", ["One too many"]), /at most 100 goals/);
			const state = readNativeProjectState(root);
			assert.equal(state.kind === "valid" ? state.state.goals.length : -1, 100, "and the refusal wrote nothing");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("retires the oldest archived goal to make room for a new one", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-goal-bound-retire-"));
		try {
			await mkdir(join(root, ".dove"), { recursive: true });
			const goals = [storedGoal("goal-oldest", "archived", "2025-01-01T00:00:00.000Z"), ...Array.from({ length: 99 }, (_, index) => storedGoal(`goal-${String(index).padStart(3, "0")}`))];
			await writeFile(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, goals }), "utf8");
			const provider = createProjectProvider(root);
			await provider.runTaskOperation("create", ["The new one"]);
			const state = readNativeProjectState(root);
			const titles = state.kind === "valid" ? state.state.goals.map((goal) => goal.title) : [];
			assert.equal(titles.length, 100, "the bound still holds");
			assert.ok(!titles.includes("goal-oldest"), "the closed record paid for the new goal");
			assert.ok(titles.includes("The new one"), "and the new goal is there");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("establishes one goal when two callers arrive at once", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-concurrent-goal-"));
		try {
			const first = createProjectProvider(root);
			const second = createProjectProvider(root);
			const [alpha, beta] = await Promise.all([first.ensureCurrentGoal!("Alpha"), second.ensureCurrentGoal!("Beta")]);
			assert.equal(alpha.stableId, beta.stableId, "both callers resolve the same goal");
			const state = readNativeProjectState(root);
			assert.equal(state.kind === "valid" ? state.state.goals.length : -1, 1, "and only one goal was created");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("answers unknown rather than observed when an archive names no target", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-reconcile-archive-"));
		try {
			const provider = createProjectProvider(root);
			await provider.runTaskOperation("create", ["Kept"]);
			const staleRevision = provider.getContext().revision;
			await provider.runTaskOperation("create", ["Second"]);
			assert.equal(await provider.reconcileTaskOperation!("archive", ["nothing"], staleRevision, [], undefined), "unknown", "an operation with no target cannot be confirmed by absence");
			assert.equal(await provider.reconcileTaskOperation!("archive", ["nothing"], staleRevision, [], "native:not-there"), "observed", "a named target that is gone is still observable");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("keeps a user's long acceptance document instead of trimming it to the artifact bound", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-acceptance-length-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Long acceptance");
			const path = nativeTaskArtifactPath(root, task.providerTaskId, "acceptance.md");
			const authored = "# Acceptance\n\n## Criteria\n\n- [ ] **AC-001** something\n\n" + "Z".repeat(20_000) + "\n";
			await writeFile(path, authored, "utf8");
			await provider.recordTaskProgress!(task.stableId, { phase: "verifying", evidence: { kind: "test", outcome: "passed" } });
			const after = await readFile(path, "utf8");
			assert.ok(after.startsWith("# Acceptance"), "the authored text is still the head of the file");
			assert.ok(after.includes("Z".repeat(20_000)), "and none of it was cut to the artifact bound");
			assert.match(after, /observed outcome: passed/, "while the projection this module owns is still appended");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("keeps a user's prose when it carries the heading of the generated section", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-acceptance-heading-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Heading collision");
			const path = nativeTaskArtifactPath(root, task.providerTaskId, "acceptance.md");
			await writeFile(path, "# Acceptance\n\n## Dove Evidence Projection\n\nMy own notes about the projection.\n", "utf8");
			await provider.recordTaskProgress!(task.stableId, { phase: "verifying", evidence: { kind: "test", outcome: "failed" } });
			const after = await readFile(path, "utf8");
			assert.match(after, /My own notes about the projection\./, "a heading a person wrote is not the section this module owns");
			assert.match(after, /observed outcome: failed/);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("leaves no temporary file behind when it records a session", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-session-atomic-"));
		try {
			const { appendNativeSession } = await import("../src/project-provider/native-sessions.ts");
			await appendNativeSession(root, { title: "Atomic", summary: "Written through a temporary file" });
			const entries = await readdir(join(root, ".dove"));
			assert.deepEqual(entries.filter((name) => name.includes(".tmp-")), [], "the write leaves the target and nothing else");
			const { readNativeSessions } = await import("../src/project-provider/native-sessions.ts");
			assert.equal(readNativeSessions(root).length, 1);
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	// Reading every goal's convergence file rebuilt a projection that `state.json` already carries: measured at a median
	// of 98 ms for a hundred goals, 3.2 MB read and parsed on the path that compiles a request's context. The current
	// goal keeps the authoritative read; this case is what that split is worth, in both directions.
	it("projects a non-current task from the record kept beside its goal, and still verifies the current one", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-convergence-projection-"));
		try {
			const provider = createProjectProvider(root);
			const first = await provider.ensureFormalTask!("First");
			await provider.mutateTaskConvergence!(first.stableId, { action: "freeze", criteria: [{ id: "AC-001", text: "The first criterion." }] });
			await provider.runTaskOperation("create", ["Second"]);
			await rm(nativeTaskConvergencePath(root, first.providerTaskId));

			const projected = createProjectProvider(root).getContext().tasks.find((task) => task.stableId === first.stableId);
			assert.equal(projected?.convergence?.health, "valid", "the projection travels in state.json, so the task is still readable without its file");

			const current = createProjectProvider(root).getContext().currentTask;
			assert.ok(current, "the second goal is current");
			await writeFile(nativeTaskConvergencePath(root, current.providerTaskId), "{broken", "utf8");
			assert.equal(createProjectProvider(root).getContext().currentTask?.convergence?.health, "invalid", "and the current goal still reads its own file, so a corrupt record is reported rather than smoothed over");
		} finally { await rm(root, { recursive: true, force: true }); }
	});

	it("keeps one record per acceptance id when the newest window would drop it", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-native-evidence-reserve-"));
		try {
			const provider = createProjectProvider(root);
			const task = await provider.ensureFormalTask!("Evidence reservation");
			await provider.mutateTaskConvergence!(task.stableId, { action: "freeze", criteria: [{ id: "AC-001", text: "The first criterion." }] });
			await provider.mutateTaskConvergence!(task.stableId, { action: "progress", acceptanceId: "AC-001", progress: { kind: "started" } });
			for (let index = 0; index < 120; index++) await provider.recordTaskProgress!(task.stableId, { phase: "verifying", evidence: { index, payload: "x".repeat(500) } });

			const evidence = await readFile(join(root, ".dove", "tasks", task.providerTaskId, "evidence.jsonl"), "utf8");
			const lines = evidence.trim().split(/\r?\n/);
			assert.ok(lines.length <= 100, "the record count still holds");
			assert.ok(evidence.includes('"acceptanceId":"AC-001"'), "and the id the unsupported-criterion check compares on is still named");
			for (const line of lines) assert.doesNotThrow(() => JSON.parse(line), "every surviving line is still whole, because the file is not sliced after selection");
		} finally { await rm(root, { recursive: true, force: true }); }
	});
});
