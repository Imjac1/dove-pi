import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCacheAudit, formatCacheAudit, sessionBaseDir } from "../src/commands/cache-audit.ts";

function makeSession(lineObjs: unknown[]): string {
	return lineObjs.map((o) => JSON.stringify(o)).join("\n") + "\n";
}

function usage(inp: number, cr: number, ts: number): unknown {
	return { type: "message", message: { role: "assistant", content: [], usage: { input: inp, cacheRead: cr, cacheWrite: 0, output: 10 }, timestamp: ts } };
}

describe("dove-pi cache audit", () => {
	it("resolves the session base directory from PI_CODING_AGENT_DIR", () => {
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = "C:/fake-agent-dir";
		try {
			assert.equal(sessionBaseDir(), join("C:/fake-agent-dir", "sessions"));
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
		}
	});

	it("reports session hit rates and miss reasons from real session files", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cache-audit-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = root;
		try {
			const projectDir = join(root, "sessions", "--P--");
			await mkdir(projectDir, { recursive: true });
			const now = Date.now();
			// 4 requests: warmup miss (input, no cache), then 3 hits
			const session = makeSession([
				usage(1000, 0, now - 60_000),
				usage(500, 4000, now - 30_000),
				usage(300, 5000, now - 20_000),
				usage(200, 6000, now - 10_000),
			]);
			await writeFile(join(projectDir, "s1.jsonl"), session);

			const audit = await runCacheAudit({});
			assert.equal(audit.length, 1);
			const row = audit[0];
			assert.equal(row.requests, 4);
			assert.equal(row.warmups, 1);
			// session hit rate: cacheRead/(input+cacheRead) = 15000/(2000+15000) = 88.235%
			assert.ok(row.sessionHitRate !== undefined && Math.abs(row.sessionHitRate - 88.235) < 0.5, `expected ~88.2%, got ${row.sessionHitRate}`);
			// last request was a hit → lastHitRate high, no prefix-change classification (gap < idle)
			assert.ok((row.lastHitRate ?? 0) > 95);

			const text = formatCacheAudit(audit);
			assert.ok(text.includes("88.2%"));
			assert.ok(text.includes("warmup"));
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(root, { recursive: true, force: true });
		}
	});

	it("filters single-request warmup sessions by default and honors --below", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cache-audit-"));
		const previous = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = root;
		try {
			const projectDir = join(root, "sessions", "--P--");
			await mkdir(projectDir, { recursive: true });
			const now = Date.now();
			// single-request session: pure warmup, should be excluded by minRequests=2
			await writeFile(join(projectDir, "warm.jsonl"), makeSession([usage(2000, 0, now)]));
			// low-hit session: 3 requests all uncached → 0% session hit
			await writeFile(join(projectDir, "bad.jsonl"), makeSession([usage(1000, 0, now - 3000), usage(1000, 0, now - 2000), usage(1000, 0, now - 1000)]));

			const all = await runCacheAudit({});
			assert.equal(all.length, 1, "warmup single-request session excluded by minRequests=2 default");

			const below = await runCacheAudit({ onlyBelow: 0.5 });
			assert.equal(below.length, 1);
			assert.equal((below[0].sessionHitRate ?? 100), 0);

			const text = formatCacheAudit(below);
			assert.ok(text.includes("0.0%"));
		} finally {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
			await rm(root, { recursive: true, force: true });
		}
	});
});