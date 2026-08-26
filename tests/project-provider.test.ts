import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectProvider, discoverProject, readProjectManifest, updateProjectManifest, withProjectMutationLock, writeProjectManifest } from "../src/project-provider/index.ts";
import { formatProjectStatus, inspectProjectStatus } from "../src/project-status.ts";

describe("project provider firewall", () => {
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
