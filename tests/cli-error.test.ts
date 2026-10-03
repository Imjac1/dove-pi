import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "src", "cli.ts");
const tsxLoader = pathToFileURL(join(process.cwd(), "node_modules", "tsx", "dist", "loader.mjs")).href;

describe("CLI error boundary", () => {
	for (const args of [["project", "bogus"], ["unknown"]]) it(`rejects ${args.join(" ")} without a runtime stack trace`, async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cli-error-"));
		try {
			await assert.rejects(
				execFileAsync(process.execPath, ["--import", tsxLoader, cliPath, ...args], { cwd: root }),
			(error: { stdout?: string; stderr?: string; code?: number }) => {
				assert.equal(error.code, 1);
				const payload = JSON.parse(error.stdout ?? "") as { ok: boolean; error: { code: string; message: string } };
				assert.equal(payload.ok, false);
				assert.equal(payload.error.code, "CLI_ERROR");
				assert.match(payload.error.message, /Usage: dove-pi/);
				assert.doesNotMatch(error.stdout ?? "", /at .*src[\\/]cli\.ts/);
				assert.doesNotMatch(error.stderr ?? "", /Unhandled|Error:/);
				return true;
			},
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("projects the latest request diagnostics through doctor without mutating the ledger", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cli-doctor-diagnostics-"));
		const stateDir = join(root, "state");
		try {
			await mkdir(stateDir, { recursive: true });
			const ledgerPath = join(stateDir, "execution.jsonl");
			await writeFile(ledgerPath, `${JSON.stringify({
				taskId: "cli:test",
				stepId: "request:req-cli",
				kind: "request.terminal",
				timestamp: "2026-09-04T00:00:00.000Z",
				mode: "standard",
				correlation: { requestId: "req-cli", sessionId: "cli-session", taskId: "cli:test" },
				details: {
					logicalRequestId: "req-cli",
					reason: "failed",
					detail: "provider-authorization-denied",
					policyAbort: true,
					terminal: { origin: "provider", code: "provider-authorization-denied", summary: "The provider rejected authentication or authorization.", retryable: false, nextAction: "Check provider credentials and retry." },
				},
			})}\n`, "utf8");
			const beforeLedger = await readFile(ledgerPath, "utf8");
			const result = await execFileAsync(process.execPath, ["--import", tsxLoader, cliPath, "doctor", "--json"], {
				cwd: root,
				env: { ...process.env, DOVE_PI_STATE_DIR: stateDir },
			});
			const payload = JSON.parse(result.stdout) as { requestDiagnostics?: { lastTerminal?: { terminal?: { code?: string } } } };
			assert.equal(payload.requestDiagnostics?.lastTerminal?.terminal?.code, "provider-authorization-denied");
			assert.equal(await readFile(ledgerPath, "utf8"), beforeLedger);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("answers a person by default, and keeps the machine form behind a flag", async () => {
		// Measured first contact: doctor printed a wall of JSON, and said nothing human about a managed install it was
		// reporting as absent while help promised update, repair and rollback. The default is now the summary; --json is
		// the same payload it always was, which is why the case above only gained a flag.
		const root = await mkdtemp(join(tmpdir(), "dove-cli-doctor-human-"));
		try {
			const result = await execFileAsync(process.execPath, ["--import", tsxLoader, cliPath, "doctor"], {
				cwd: root,
				env: { ...process.env, DOVE_PI_STATE_DIR: join(root, "state") },
			});
			assert.ok(!result.stdout.trimStart().startsWith("{"), "the default output is not JSON");
			assert.match(result.stdout, /managed install/u, "and it says what a person needs to know about one");
			assert.match(result.stdout, /--json/u, "and how to ask for the machine form");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
