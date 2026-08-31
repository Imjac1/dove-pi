import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	runTokenAudit,
	formatTokenAudit,
	sessionBaseDir,
} from "../src/commands/token-audit.ts";

function makeSession(lineObjs: unknown[]): string {
	return lineObjs.map((o) => JSON.stringify(o)).join("\n") + "\n";
}

describe("dove-pi token audit", () => {
	it("resolves the session base directory from PI_CODING_AGENT_DIR", async () => {
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = "C:/fake-agent-dir";
		try {
			assert.equal(sessionBaseDir(), join("C:/fake-agent-dir", "sessions"));
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
		}
	});

	it("aggregates per-project usage from real session files", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-token-audit-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = root;
		try {
			const projectDir = join(root, "sessions", "--C--fake--project--");
			await mkdir(projectDir, { recursive: true });
			const session = makeSession([
				{ type: "session", id: "s1" },
				{
					type: "message",
					message: { role: "user", content: [{ type: "text", text: "hi" }] },
				},
				{
					type: "message",
					message: {
						role: "assistant",
						content: [],
						usage: { input: 1000, cacheRead: 2000, cacheWrite: 0, output: 50 },
						timestamp: Date.now(),
					},
				},
				{
					type: "message",
					message: {
						role: "assistant",
						content: [],
						usage: { input: 500, cacheRead: 2500, cacheWrite: 0, output: 30 },
						timestamp: Date.now(),
					},
				},
			]);
			await writeFile(join(projectDir, "sess.jsonl"), session);

			const result = await runTokenAudit({});
			assert.equal(result.projects.length, 1);
			const project = result.projects[0];
			assert.ok(project.project.includes("project"));
			assert.equal(project.inputTokens, 1500);
			assert.equal(project.cacheReadTokens, 4500);
			assert.equal(project.outputTokens, 80);
			assert.equal(result.totalReasoning, 0);
			assert.equal(project.messageCount, 2);
			assert.equal(result.totalInput, 1500);
			assert.equal(result.totalPrompt, 6000);

			const table = formatTokenAudit(result);
			assert.ok(table.includes("1,500"));
			assert.ok(table.includes("4,500"));
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(root, { recursive: true, force: true });
		}
	});

	it("respects the since-hours window", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-token-audit-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = root;
		try {
			const projectDir = join(root, "sessions", "--X--");
			await mkdir(projectDir, { recursive: true });
			const stale = Date.now() - 10 * 3_600_000; // 10h ago
			const session = makeSession([
				{
					type: "message",
					message: {
						role: "assistant",
						content: [],
						usage: { input: 999, cacheRead: 0, output: 5 },
						timestamp: stale,
					},
				},
			]);
			await writeFile(join(projectDir, "sess.jsonl"), session);

			const fresh = await runTokenAudit({});
			assert.equal(fresh.totalInput, 999, "no since filter includes all");
			const windowed = await runTokenAudit({ sinceHours: 24 });
			assert.equal(windowed.totalInput, 999, "within 24h window included");
			const tight = await runTokenAudit({ sinceHours: 2 });
			assert.equal(tight.totalInput, 0, "older than 2h excluded");
			assert.equal(tight.totalOutput, 0, "older output is excluded by the same window");
			assert.equal(tight.projects[0]?.sessionCount, 0, "sessions with no included usage are not counted");

			const mixed = makeSession([
				{ type: "message", message: { role: "assistant", usage: { input: 100, output: 100, reasoning: 50 }, timestamp: stale } },
				{ type: "message", message: { role: "assistant", usage: { input: 7, output: 7, reasoning: 3 }, timestamp: Date.now() } },
				{ type: "message", message: { role: "assistant", usage: { output: 500 } } },
			]);
			await writeFile(join(projectDir, "mixed.jsonl"), mixed);
			const mixedResult = await runTokenAudit({ sinceHours: 2 });
			assert.equal(mixedResult.totalOutput, 7);
			assert.equal(mixedResult.totalReasoning, 3);
			assert.match(formatTokenAudit(mixedResult), /reasoning 3 \(42\.9% of output\)/);

			const isoProjectDir = join(root, "sessions", "--ISO--");
			await mkdir(isoProjectDir, { recursive: true });
			await writeFile(join(isoProjectDir, "iso.jsonl"), makeSession([
				{ type: "message", message: { role: "assistant", usage: { input: 10, output: 100 }, timestamp: new Date(stale).toISOString() } },
				{ type: "message", message: { role: "assistant", usage: { input: 7, output: 7 }, timestamp: new Date().toISOString() } },
			]));
			const isoResult = await runTokenAudit({ sinceHours: 2 });
			assert.equal(isoResult.projects.find((project) => project.project.includes("ISO"))?.outputTokens, 7, "ISO timestamps use the same output window");
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(root, { recursive: true, force: true });
		}
	});
});
