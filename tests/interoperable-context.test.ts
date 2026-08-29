import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProjectProvider } from "../src/project-provider/index.ts";
import { buildInteroperableProjectContext, readInteroperableContextProjection } from "../src/context/interoperable.ts";

describe("interoperable project context", () => {
	it("keeps Trellis, AGENTS.md, CLAUDE.md, skills, and MCP resources as labeled authorities", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-context-interop-"));
		try {
			await mkdir(join(root, ".trellis"), { recursive: true });
			await writeFile(join(root, ".trellis", ".version"), "0.6.16", "utf8");
			await writeFile(join(root, "AGENTS.md"), "# Agent rules\nUse TypeScript.", "utf8");
			await writeFile(join(root, "CLAUDE.md"), "# Claude rules\nUse structured results.", "utf8");
			await mkdir(join(root, ".agents", "skills", "demo"), { recursive: true });
			await writeFile(join(root, ".agents", "skills", "demo", "SKILL.md"), "---\ndescription: Demo skill\n---\n# Demo", "utf8");
			const provider = createProjectProvider(root);
			const projection = readInteroperableContextProjection(provider, [{ uri: "mcp://demo/context", title: "Demo resource", text: "MCP context" }]);
			assert.ok(projection.authorities.some((entry) => entry.kind === "project-provider"));
			assert.ok(projection.documents.some((entry) => entry.kind === "instruction"));
			assert.ok(projection.documents.some((entry) => entry.kind === "skill"));
			assert.ok(projection.documents.some((entry) => entry.kind === "resource"));
			assert.match(projection.conflicts.join("\n"), /Multiple project instruction authorities/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("uses index-first disclosure and loads full external text only for targeted queries", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-context-disclosure-"));
		try {
			await writeFile(join(root, "AGENTS.md"), "UNIQUE_AGENT_RULE", "utf8");
			await mkdir(join(root, ".agents", "skills", "demo"), { recursive: true });
			await writeFile(join(root, ".agents", "skills", "demo", "SKILL.md"), "UNIQUE_SKILL_RULE", "utf8");
			const provider = createProjectProvider(root);
			const ordinary = buildInteroperableProjectContext(provider, "hi", "standard");
			assert.doesNotMatch(ordinary.context.text, /UNIQUE_(AGENT|SKILL)_RULE/);
			assert.ok(ordinary.projection.index.length >= 2);
			const instructions = buildInteroperableProjectContext(provider, "show AGENTS.md project instruction", "standard");
			assert.match(instructions.context.text, /UNIQUE_AGENT_RULE/);
			assert.doesNotMatch(instructions.context.text, /UNIQUE_SKILL_RULE/);
			const skill = buildInteroperableProjectContext(provider, "show demo skill", "standard");
			assert.match(skill.context.text, /UNIQUE_SKILL_RULE/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
