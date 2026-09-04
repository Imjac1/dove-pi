import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("real Dove Pi black-box harness", () => {
	it("preserves provider preflight evidence without exposing the prompt", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-test-"));
		try {
			const project = join(root, "project");
			const output = join(root, "run.jsonl");
			await mkdir(project, { recursive: true });
			const result = await runHarness(project, output);
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				rpcFailure?: { terminal?: { origin?: string; code?: string } };
				ledgerTerminal?: { terminal?: { origin?: string; code?: string } };
				terminalConsistency?: string;
				providerEvidence?: Array<{ model?: string; systemPromptChars?: number; messageCount?: number; messageChars?: number; toolCount?: number }>;
				diagnosticGap?: string;
				prompt?: string;
				promptDigest?: string;
			};
			assert.equal(summary.rpcFailure?.terminal?.origin, "provider");
			assert.equal(summary.rpcFailure?.terminal?.code, "provider-authorization-denied");
			assert.equal(summary.ledgerTerminal?.terminal?.code, "host-shutdown-preflight");
			assert.equal(summary.terminalConsistency, "mismatch");
			assert.equal(summary.diagnosticGap, "rpc-error-not-preserved-in-ledger");
			assert.equal(summary.prompt, undefined);
			assert.match(summary.promptDigest ?? "", /^[a-f0-9]{24}$/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("runs a deterministic provider through the public launcher and records context evidence", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-faux-"));
		try {
			const project = join(root, "project");
			const output = join(root, "run.jsonl");
			await mkdir(project, { recursive: true });
			await writeFile(join(project, "AGENTS.md"), `# Project instruction\n${"Keep provider context observable. ".repeat(2_000)}`, "utf8");
			const result = await runHarness(project, output, ["--provider", "faux", "--context-window", "200000", "--prompt", "Read the project instruction and summarize it."], 30_000);
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				providerMode?: string;
				contextWindow?: number;
				strategy?: { budgetSource?: string; contextWindow?: number; omitted?: boolean; compacted?: boolean };
				sawAgentStart?: boolean;
				sawSettled?: boolean;
				terminalConsistency?: string;
				providerEvidence?: Array<{ model?: string; systemPromptChars?: number; messageCount?: number; messageChars?: number; toolCount?: number }>;
			};
			assert.equal(summary.providerMode, "faux");
			assert.equal(summary.contextWindow, 200_000);
			assert.equal(summary.strategy?.contextWindow, 200_000);
			assert.equal(summary.strategy?.budgetSource, "provider-window");
			assert.equal(summary.strategy?.omitted, false);
			assert.equal(summary.strategy?.compacted, true);
			assert.equal(summary.sawAgentStart, true);
			assert.equal(summary.sawSettled, true);
			assert.equal(summary.terminalConsistency, "completed-ledger-only");
			assert.equal(summary.providerEvidence?.length, 1);
			assert.equal(summary.providerEvidence?.[0]?.model, "blackbox");
			assert.ok((summary.providerEvidence?.[0]?.messageChars ?? 0) > 0);
			assert.ok((summary.providerEvidence?.[0]?.systemPromptChars ?? 0) > 0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("marks context omission only for an actually insufficient provider window", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-small-window-"));
		try {
			const project = join(root, "project");
			const output = join(root, "run.jsonl");
			await mkdir(project, { recursive: true });
			await writeFile(join(project, "AGENTS.md"), `# Large project instruction\n${"Retain the complete project contract. ".repeat(6_000)}`, "utf8");
			const result = await runHarness(project, output, ["--provider", "faux", "--context-window", "12000", "--prompt", "Read the project instruction and summarize it."], 30_000);
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				strategy?: { budgetSource?: string; contextWindow?: number; omitted?: boolean };
				sawAgentStart?: boolean;
				sawSettled?: boolean;
			};
			assert.equal(summary.strategy?.contextWindow, 12_000);
			assert.equal(summary.strategy?.budgetSource, "provider-window");
			assert.equal(summary.strategy?.omitted, true);
			assert.equal(summary.sawAgentStart, true);
			assert.equal(summary.sawSettled, true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

function runHarness(project: string, output: string, extraArgs: readonly string[] = [], timeoutMs = 10_000): Promise<{ code: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["scripts/real-dove-blackbox.mjs", "--launcher", "source", "--cwd", project, "--output", output, "--case-id", "provider-auth", "--timeout-ms", String(timeoutMs), ...extraArgs], {
			cwd: process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.once("error", reject);
		child.once("close", (code) => {
			if (code !== 0) reject(new Error(`black-box harness failed (${code}): ${stderr}`));
			else resolve({ code });
		});
	});
}
