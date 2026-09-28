import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * **Which class of defect this holds, and which it does not.** It holds the Local CLI row of the authorisation table: the process parses
 * `--approve` and injects the authorizer, and omitting it denies side effects. It does *not* hold what the capability does once it runs -
 * the capability fails here because a temporary project has no test script, and that failure is the evidence the gate opened.
 */
describe("the CLI approval flag", () => {
	it("denies a writing capability without --approve and runs it with", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-cli-approval-"));
		try {
			const run = async (extra: readonly string[]) => {
				try {
					const { stdout } = await execFileAsync(
						process.execPath,
						["--import", "tsx", "src/cli.ts", "capability", "run", "dev.project_test", ...extra],
						{ cwd: process.cwd(), env: { ...process.env, PI_CODING_AGENT_DIR: root }, maxBuffer: 8 * 1024 * 1024 },
					);
					return stdout;
				} catch (error) {
					const failed = error as { stdout?: string };
					return failed.stdout ?? "";
				}
			};

			const denied = await run([]);
			assert.match(denied, /approval_denied|approval was not granted/i, "omitting the flag denies side effects");

			const approved = await run(["--approve"]);
			assert.doesNotMatch(approved, /approval_denied/i, "with the flag the gate opens");
			assert.match(approved, /project_test|npm|test/i, "and the capability is the thing that failed, not the permission");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
