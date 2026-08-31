import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseNonNegativeHours } from "../src/commands/cli-options.ts";

const execFileAsync = promisify(execFile);

function makeSession(timestamps: readonly number[]): string {
	return timestamps.map((timestamp) => JSON.stringify({
		type: "message",
		message: {
			role: "assistant",
			usage: { input: 100, cacheRead: 900, output: 10 },
			timestamp,
		},
	})).join("\n") + "\n";
}

describe("CLI option parsing", () => {
	it("accepts equals and separated forms of --since", () => {
		assert.equal(parseNonNegativeHours(["--since=24h"]), 24);
		assert.equal(parseNonNegativeHours(["--since", "24h"]), 24);
		assert.equal(parseNonNegativeHours(["--since=1.5"]), 1.5);
		assert.equal(parseNonNegativeHours([]), undefined);
	});

	it("rejects missing, negative, and malformed values", () => {
		for (const args of [["--since"], ["--since", "--filter=Desktop"], ["--since=-1h"], ["--since=abc"]]) {
			assert.throws(() => parseNonNegativeHours(args), /--since/);
		}
	});

	it("returns a non-zero CLI result for an invalid --since value", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cli-options-"));
		try {
			const env = { ...process.env, PI_CODING_AGENT_DIR: root };
			await assert.rejects(
				execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "token", "audit", "--since=abc"], { cwd: process.cwd(), env }),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				const result = error as Error & { readonly code?: number | string; readonly stderr?: string };
				assert.notEqual(result.code, 0);
				assert.match(result.stderr ?? result.message, /--since/);
				return true;
			},
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("produces identical audit output for both documented CLI forms", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cli-options-"));
		try {
			const projectDir = join(root, "sessions", "--C--Users--rebot--Desktop--code--");
			await mkdir(projectDir, { recursive: true });
			await writeFile(join(projectDir, "session.jsonl"), makeSession([
				Date.now() - 48 * 3_600_000,
				Date.now(),
			]));
			const env = { ...process.env, PI_CODING_AGENT_DIR: root };
			const run = async (args: string[]) => (await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "token", "audit", ...args], { cwd: process.cwd(), env })).stdout;
			const equals = await run(["--since=24h", "--filter=Desktop"]);
			const separated = await run(["--since", "24h", "--filter", "Desktop"]);
			assert.equal(equals, separated);
			assert.match(equals, /\| 1 \| 1 \| 100 \|/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
