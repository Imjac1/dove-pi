import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeExecutionRecords } from "../src/core/execution-ledger.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the archived scenario, replayed in
 * isolation: the four coupled defects the 20260830 audit proved, driven through the public launcher with the
 * faux provider, and then counted from the ledger the run wrote - one logical prompt must not be persisted
 * twice, and no tool call identifier may be executed twice.
 *
 * **It does not hold duplicate registration**, which the audit also proved: an extension registration is not a
 * ledger kind, so the ledger cannot show it. **Saying so here is the point** - a case that claimed to hold it
 * would be reading a summary field that does not exist.
 *
 * **Isolation**: every path is under a fresh temporary root, and the run uses `--provider faux`, so no real
 * Pi state, no network and no checkout mutation are touched.
 */

function runHarness(project: string, output: string, extraArgs: readonly string[], timeoutMs: number, caseId: string) {
	return new Promise<{ code: number | null }>((resolve, reject) => {
		// **The flags are read from the existing suite rather than guessed**: the driver takes `--output`,
		// `--case-id` and `--timeout-ms`, and `--launcher source` selects the checkout launcher rather than a
		// path. Passing a path produced "dove-pi.cmd is not recognized" and the run never started.
		const child = spawn(process.execPath, ["scripts/real-dove-blackbox.mjs", "--launcher", "source", "--cwd", project, "--output", output, "--case-id", caseId, "--timeout-ms", String(timeoutMs), ...extraArgs], {
			cwd: process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => { stderr += chunk; });
		child.once("error", reject);
		child.once("close", (code) => {
			if (code !== 0) reject(new Error(`black-box harness failed (${code}) for ${caseId}: ${stderr}`));
			// **The process code is not the run outcome.** The driver reports a failed scenario inside its
			// summary and still exits zero, so a caller checking only this code would call a failed run a pass.
			else resolve({ code });
		});
	});
}

describe("the archived scenario, replayed in isolation", () => {
	it("persists one logical request per prompt and runs no tool call twice", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-archived-replay-"));
		try {
			const project = join(root, "project");
			const output = join(root, "replay.jsonl");
			const scenario = join(root, "scenario.json");
			await mkdir(project, { recursive: true });
			// Three ordered steps, which is the shape the archived transcript had: one prompt, a follow-up, and a
			// mode change - the sequence that produced six persisted requests for one logical prompt.
			await writeFile(scenario, JSON.stringify({ steps: [
				{ kind: "prompt", message: "Read the project and summarize it." },
				{ kind: "follow_up", message: "Continue with one acceptance criterion." },
				{ kind: "prompt", message: "/mode fast" },
				{ kind: "state" },
			] }), "utf8");
			const result = await runHarness(project, output, ["--provider", "faux", "--scenario", scenario], 30_000, "archived-replay");
			assert.equal(result.code, 0, "the driver process finished");
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { scenarioRoot?: string; steps?: readonly unknown[]; exitCode?: number | null; stderr?: string; scenarioFailed?: boolean };
			// **The run outcome lives in the summary, not in the process code.** Asserted first, because every
			// assertion after it is about a ledger that only exists if the scenario actually ran.
			assert.equal(summary.exitCode, 0, `the scenario ran: ${summary.stderr ?? ""}`);
			assert.equal(summary.scenarioFailed, false, "and it did not fail");
			// The ledger path comes from the summary own scenarioRoot, because the root carries a nonce and cannot be
			// constructed from the output path. Read, not guessed.
			assert.ok(summary.scenarioRoot, "the summary names the root the run used");
			const ledgerPath = join(summary.scenarioRoot, "dove-state", "execution.jsonl");
			assert.ok(existsSync(ledgerPath), `the run wrote a ledger at ${ledgerPath}`);
			const audit = summarizeExecutionRecords(await readFile(ledgerPath, "utf8"));
			// **The two defects the ledger can show.**
			assert.equal(audit.tools.duplicateToolCalls, 0, "no tool call identifier ran twice");
			assert.equal(audit.lifecycle.coalescedRedeliveries, 0, "no redelivery had to be coalesced");
			// One terminal per prompt-step that reached the provider, so the count is bounded by the steps rather
			// than six times one of them - which is the shape the audit found.
			const promptSteps = (summary.steps ?? []).filter((step) => (step as { kind?: string }).kind === "prompt").length;
			assert.ok(audit.lifecycle.received <= promptSteps, `${audit.lifecycle.received} requests for ${promptSteps} prompts`);
			assert.ok(audit.records > 0, `the ledger held ${audit.records} records, so the assertions above are about something`);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});