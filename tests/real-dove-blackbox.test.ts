import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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

	it("allows productive reads past the historical count and terminates unchanged reads semantically", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-progress-"));
		try {
			const project = join(root, "project");
			const changingOutput = join(root, "changing.jsonl");
			const repeatedOutput = join(root, "repeated.jsonl");
			await mkdir(project, { recursive: true });
			// Keep the faux replay productive: each changing read must resolve to
			// a successful, distinct observation rather than a missing-file error.
			await Promise.all(Array.from({ length: 20 }, (_, index) => writeFile(join(project, `probe-${index}.txt`), `probe-${index}\n`, "utf8")));
			await writeFile(join(project, "probe-same.txt"), "stable probe\n", "utf8");
			const [changing, repeated] = await Promise.all([
				runHarness(project, changingOutput, ["--provider", "faux", "--progress-case", "changing", "--prompt", "Inspect changing probes."], 60_000, "progress-changing"),
				runHarness(project, repeatedOutput, ["--provider", "faux", "--progress-case", "repeated", "--prompt", "Inspect repeated probe."], 60_000, "progress-repeated"),
			]);
			assert.equal(changing.code, 0);
			assert.equal(repeated.code, 0);
			const changingSummary = JSON.parse(await readFile(`${changingOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; steps?: Array<{ events?: Array<{ type?: string; isError?: boolean }> }>; providerEvidence?: unknown[]; ledgerTerminal?: { terminal?: { code?: string } } };
			const repeatedSummary = JSON.parse(await readFile(`${repeatedOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; steps?: Array<{ events?: Array<{ type?: string; isError?: boolean }> }>; providerEvidence?: unknown[]; ledgerTerminal?: { terminal?: { origin?: string; code?: string; nextAction?: string } } };
			assert.equal(changingSummary.exitCode, 0);
			assert.equal(changingSummary.signal, null);
			assert.equal(changingSummary.sawSettled, true);
			assert.equal(changingSummary.ledgerTerminal?.terminal?.code, "completed");
			assert.equal(changingSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_start").length, 20);
			const changingToolResults = changingSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_end") ?? [];
			assert.equal(changingToolResults.length, 20);
			assert.ok(changingToolResults.every((event) => event.isError === false), "all productive reads must return successful tool results");
			assert.ok((changingSummary.providerEvidence?.length ?? 0) >= 21, "the final provider summary must follow the 20 successful reads");
			assert.equal(repeatedSummary.exitCode, 0);
			assert.equal(repeatedSummary.signal, null);
			assert.equal(repeatedSummary.sawSettled, true);
			assert.equal(repeatedSummary.ledgerTerminal?.terminal?.origin, "progress-guard");
			assert.equal(repeatedSummary.ledgerTerminal?.terminal?.code, "progress-guarded");
			assert.match(repeatedSummary.ledgerTerminal?.terminal?.nextAction ?? "", /Change strategy/);
			const repeatedToolResults = repeatedSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_end") ?? [];
			assert.deepEqual(repeatedToolResults.map((event) => event.isError), [false, false, false, true]);
			assert.equal(repeatedSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_start").length, 4);
			assert.equal(repeatedSummary.providerEvidence?.length, 4, "the provider's scripted final summary must not be reached");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("stops after a failed step while preserving final evidence", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-failed-step-"));
		try {
			const project = join(root, "project");
			const output = join(root, "run.jsonl");
			const scenario = join(root, "scenario.json");
			await mkdir(project, { recursive: true });
			await writeFile(scenario, JSON.stringify({ steps: [
				{ kind: "prompt", message: "This provider preflight should fail." },
				{ kind: "prompt", message: "This step must not run." },
				{ kind: "stats" },
			] }), "utf8");
			const result = await runHarness(project, output, ["--scenario", scenario], 30_000, "failed-step");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				scenarioFailed?: boolean;
				steps?: Array<{ kind?: string; failed?: boolean; settled?: boolean }>;
			};
			assert.equal(summary.scenarioFailed, true);
			assert.equal(summary.steps?.[0]?.failed, true);
			assert.equal(summary.steps?.[1]?.settled, false);
			assert.equal(summary.steps?.[2]?.settled, false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("replays ordered user steps and closes the RPC host through EOF", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-multiturn-"));
		try {
			const project = join(root, "project");
			const output = join(root, "multi.jsonl");
			const scenario = join(root, "scenario.json");
			await mkdir(project, { recursive: true });
			await writeFile(scenario, JSON.stringify({ steps: [
				{ kind: "prompt", message: "Read the project and summarize it." },
				{ kind: "follow_up", message: "Continue with one acceptance criterion." },
				{ kind: "prompt", message: "/mode fast" },
				{ kind: "prompt", message: "/dove-thinking off" },
				{ kind: "prompt", message: "/dove-tools core" },
				{ kind: "follow_up", message: "Continue with the audit and report acceptance criteria." },
				{ kind: "prompt", message: "/dove-tools auto" },
				{ kind: "follow_up", message: "Continue once more and report remaining risks." },
				{ kind: "state" },
			] }), "utf8");
			const result = await runHarness(project, output, ["--provider", "faux", "--scenario", scenario], 30_000, "multi-turn");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				exitCode?: number | null;
				signal?: string | null;
				harnessTimedOut?: boolean;
				promptDigest?: string;
				scenarioSessionKey?: string;
				scenarioRoot?: string;
				steps?: Array<{ kind?: string; sessionKey?: string; settled?: boolean; promptDigest?: string; events?: Array<{ type?: string; message?: string }>; strategy?: { logicalRequestId?: string; executionModeSource?: string; toolProfile?: string; toolProfileSource?: string; thinkingPolicySource?: string; activeToolCount?: number } }>;
			};
			assert.equal(summary.exitCode, 0);
			assert.equal(summary.signal, null);
			assert.equal(summary.harnessTimedOut, false);
			assert.equal(summary.promptDigest, digest("Read the project and summarize it."));
			assert.match(summary.scenarioSessionKey ?? "", /^blackbox_multi-turn_/);
			assert.deepEqual(summary.steps?.map((step) => step.kind), ["prompt", "follow_up", "prompt", "prompt", "prompt", "follow_up", "prompt", "follow_up", "state"]);
			assert.ok(summary.steps?.every((step) => step.settled));
			assert.equal(summary.steps?.[1]?.events?.some((event) => event.type === "response"), true);
			assert.ok(summary.steps?.every((step) => step.sessionKey === summary.scenarioSessionKey));
			const modelSteps = summary.steps?.filter((step) => step.strategy?.logicalRequestId) ?? [];
			assert.equal(modelSteps.length, 4);
			assert.equal(modelSteps[2]?.strategy?.executionModeSource, "user");
			assert.equal(modelSteps[2]?.strategy?.toolProfile, "core");
			assert.equal(modelSteps[2]?.strategy?.toolProfileSource, "user");
			// `off` is a user-selected manual policy; Pi controls the actual
			// level only after Dove stops asserting one.
			assert.equal(modelSteps[2]?.strategy?.thinkingPolicySource, "user");
			assert.equal(modelSteps[2]?.strategy?.activeToolCount, 9);
			assert.equal(modelSteps[3]?.strategy?.toolProfile, "auto");
			// Auto restores Pi's session-start tool authority; it is not a
			// second Dove-owned profile.
			assert.equal(modelSteps[3]?.strategy?.toolProfileSource, "pi");
			assert.equal(new Set(modelSteps.map((step) => step.strategy?.logicalRequestId)).size, modelSteps.length);
			assert.equal(JSON.stringify(summary).includes("Read the project and summarize it."), false);
			const evidence = await readFile(output, "utf8");
			assert.equal(evidence.includes(summary.scenarioSessionKey ?? ""), true);
			assert.equal(evidence.includes(summary.scenarioRoot ?? ""), false);
			assert.equal(evidence.includes("scenario-project"), true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("keeps an output path inside the source project from breaking workspace copy", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-nested-output-"));
		try {
			const project = join(root, "project");
			const output = join(project, ".dove", "run.jsonl");
			await mkdir(project, { recursive: true });
			const result = await runHarness(project, output, ["--provider", "faux", "--prompt", "Read the project."], 30_000, "nested-output");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; scenarioRoot?: string; cwd?: string };
			assert.equal(summary.exitCode, 0);
			assert.equal(summary.signal, null);
			assert.ok(summary.scenarioRoot && !summary.scenarioRoot.startsWith(project));
			assert.ok(summary.cwd && !summary.cwd.startsWith(project));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("proves fast and formal artifact boundaries through the public launcher", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-artifacts-"));
		try {
			const fastProject = join(root, "fast-project");
			const formalProject = join(root, "formal-project");
			const fastOutput = join(root, "fast.jsonl");
			const formalOutput = join(root, "formal.jsonl");
			const fastScenario = join(root, "fast.json");
			const formalScenario = join(root, "formal.json");
			await mkdir(fastProject, { recursive: true });
			await mkdir(formalProject, { recursive: true });
			await writeFile(fastScenario, JSON.stringify({ steps: [{ kind: "prompt", message: "Read-only inventory of the project. Do not modify files." }] }), "utf8");
			await writeFile(formalScenario, JSON.stringify({ steps: [{ kind: "prompt", message: "Plan and implement a formal multi-file refactor with PRD, design, implementation plan, and acceptance criteria. Do not modify product files yet." }] }), "utf8");
			const [fastResult, formalResult] = await Promise.all([
				runHarness(fastProject, fastOutput, ["--provider", "faux", "--scenario", fastScenario], 30_000, "artifact-fast"),
				runHarness(formalProject, formalOutput, ["--provider", "faux", "--scenario", formalScenario], 30_000, "artifact-formal"),
			]);
			assert.equal(fastResult.code, 0);
			assert.equal(formalResult.code, 0);
			const fastSummary = JSON.parse(await readFile(`${fastOutput}.summary.json`, "utf8")) as { artifactEvidence?: { formalTaskCount?: number; formalArtifactCount?: number; convergenceFileCount?: number } };
			const formalSummary = JSON.parse(await readFile(`${formalOutput}.summary.json`, "utf8")) as { artifactEvidence?: { formalTaskCount?: number; formalArtifactCount?: number; convergenceFileCount?: number } };
			assert.equal(fastSummary.artifactEvidence?.formalTaskCount, 0);
			assert.equal(fastSummary.artifactEvidence?.formalArtifactCount, 0);
			assert.equal(fastSummary.artifactEvidence?.convergenceFileCount, 0);
			assert.equal(formalSummary.artifactEvidence?.formalTaskCount, 1);
			assert.ok((formalSummary.artifactEvidence?.formalArtifactCount ?? 0) >= 5);
			assert.equal(formalSummary.artifactEvidence?.convergenceFileCount, 0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("keeps concurrent scenarios on disjoint runtime roots", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-isolation-"));
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const outputs = [join(root, "a.jsonl"), join(root, "b.jsonl")];
			await Promise.all(outputs.map((output, index) => runHarness(project, output, ["--provider", "faux", "--prompt", `scenario-${index}`], 30_000, `parallel-${index}`)));
			const summaries = await Promise.all(outputs.map(async (output) => JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { scenarioRoot: string; stateDir: string; sessionDir: string; exitCode: number | null; signal: string | null }));
			assert.notEqual(summaries[0]?.scenarioRoot, summaries[1]?.scenarioRoot);
			assert.notEqual(summaries[0]?.stateDir, summaries[1]?.stateDir);
			assert.notEqual(summaries[0]?.sessionDir, summaries[1]?.sessionDir);
			assert.ok(summaries.every((summary) => summary.exitCode === 0 && summary.signal === null));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

function digest(value: string): string {
	return createHash("sha256").update(value.normalize("NFC")).digest("hex").slice(0, 24);
}

function runHarness(project: string, output: string, extraArgs: readonly string[] = [], timeoutMs = 10_000, caseId = "provider-auth"): Promise<{ code: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["scripts/real-dove-blackbox.mjs", "--launcher", "source", "--cwd", project, "--output", output, "--case-id", caseId, "--timeout-ms", String(timeoutMs), ...extraArgs], {
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
