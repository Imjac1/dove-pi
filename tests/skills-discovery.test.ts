import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../src/skills/discovery.ts";

describe("skill discovery", () => {
	it("finds nested project skills and extracts frontmatter descriptions", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-skills-"));
		await mkdir(join(root, ".agents", "skills", "trellis-start"), { recursive: true });
		await mkdir(join(root, ".agents", "skills", "nested", "custom"), { recursive: true });
		await writeFile(join(root, ".agents", "skills", "trellis-start", "SKILL.md"), "---\ndescription: Start a session\n---\n");
		await writeFile(join(root, ".agents", "skills", "nested", "custom", "SKILL.md"), "# Custom\n");
		const skills = discoverSkills(root);
		assert.deepEqual(skills.map((skill) => skill.name), ["nested:custom", "trellis-start"]);
		assert.equal(skills.find((skill) => skill.name === "trellis-start")?.description, "Start a session");
	});

	it("returns child skills before inherited parent skills and keeps the child override", async () => {
		const parent = await mkdtemp(join(tmpdir(), "dove-skills-parent-"));
		const child = join(parent, "project");
		await mkdir(join(parent, ".agents", "skills", "shared"), { recursive: true });
		await mkdir(join(child, ".agents", "skills", "shared"), { recursive: true });
		await writeFile(join(parent, ".agents", "skills", "shared", "SKILL.md"), "---\ndescription: Parent\n---\n");
		await writeFile(join(child, ".agents", "skills", "shared", "SKILL.md"), "---\ndescription: Child\n---\n");
		const skills = discoverSkills(child);
		assert.equal(skills.filter((skill) => skill.name === "shared").length, 1);
		assert.equal(skills.find((skill) => skill.name === "shared")?.description, "Child");
	});
});
