import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("real Dove Pi black-box harness", () => {
	it("preserves provider preflight evidence without exposing the prompt", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-test-"));
		try {
			const project = join(root, "project");
			const output = join(root, "run.jsonl");
			await mkdir(project, { recursive: true });
			const result = await runHarness(project, output, ["--no-operator-config"]);
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
				providerIdentity?: Array<{ entryKind?: string; doveExtensionOrigin?: string; doveExtensionTrust?: string }>;
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
			assert.equal(summary.providerIdentity?.[0]?.entryKind, "source-or-explicit");
			assert.equal(summary.providerIdentity?.[0]?.doveExtensionOrigin, "managed");
			assert.equal(summary.providerIdentity?.[0]?.doveExtensionTrust, "managed");
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

	it("runs an explicitly configured read-only child and reports unavailable configuration without aborting", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-subagent-"));
		try {
			const project = join(root, "project");
			const delegatedOutput = join(root, "delegated.jsonl");
			const unavailableOutput = join(root, "unavailable.jsonl");
			await mkdir(project, { recursive: true });
			const [delegated, unavailable] = await Promise.all([
				runHarness(project, delegatedOutput, ["--provider", "faux", "--subagent-case", "delegated", "--prompt", "Delegate a read-only inventory."], 30_000, "subagent-delegated"),
				runHarness(project, unavailableOutput, ["--provider", "faux", "--subagent-case", "unavailable", "--prompt", "Try a read-only inventory."], 30_000, "subagent-unavailable"),
			]);
			assert.equal(delegated.code, 0);
			assert.equal(unavailable.code, 0);
			const delegatedSummary = JSON.parse(await readFile(`${delegatedOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; steps?: Array<{ events?: Array<{ type?: string; toolName?: string; isError?: boolean }> }>; subagentEvidence?: Array<{ argv?: string[] }> };
			const unavailableSummary = JSON.parse(await readFile(`${unavailableOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; subagentEvidence?: unknown[]; steps?: Array<{ events?: Array<{ type?: string; toolName?: string; isError?: boolean }> }> };
			assert.equal(delegatedSummary.exitCode, 0);
			assert.equal(delegatedSummary.signal, null);
			assert.equal(delegatedSummary.sawSettled, true);
			assert.deepEqual(delegatedSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_end").map((event) => event.isError), [false]);
			assert.deepEqual(delegatedSummary.subagentEvidence?.[0]?.argv?.slice(-9), ["--mode", "text", "--print", "--no-session", "--no-extensions", "--tools", "read,grep,find,ls", "--", "Read the project and return a short inventory."]);
			assert.equal(unavailableSummary.exitCode, 0);
			assert.equal(unavailableSummary.signal, null);
			assert.equal(unavailableSummary.sawSettled, true);
			// Provider unavailability is an expected, structured tool response. It
			// must not be promoted to an RPC failure or host abort.
			assert.deepEqual(unavailableSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_end").map((event) => event.isError), [false]);
			assert.equal(unavailableSummary.subagentEvidence?.length, 0);
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
			const changingSummary = JSON.parse(await readFile(`${changingOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; steps?: Array<{ events?: Array<{ type?: string; isError?: boolean }>; toolNames?: string[] }>; providerEvidence?: unknown[]; ledgerTerminal?: { terminal?: { code?: string } }; resourceObservation?: { toolCalls?: number; providerRounds?: number; elapsedMs?: number }; strategy?: { resources?: { toolCalls?: number; providerRounds?: number; elapsedMs?: number } } };
			const repeatedSummary = JSON.parse(await readFile(`${repeatedOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; steps?: Array<{ events?: Array<{ type?: string; isError?: boolean }> }>; providerEvidence?: unknown[]; ledgerTerminal?: { terminal?: { origin?: string; code?: string; nextAction?: string } } };
			assert.equal(changingSummary.exitCode, 0);
			assert.equal(changingSummary.signal, null);
			assert.equal(changingSummary.sawSettled, true);
			assert.equal(changingSummary.ledgerTerminal?.terminal?.code, "completed");
			assert.equal(changingSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_start").length, 20);
			// **What the model reached for, which nothing could read before.** `extractToolNames` looked for `tool_start`;
			// Pi emits `tool_execution_start`, so this field was empty for every run - and with it the only way to ask
			// whether a real model ever invokes a registered capability. Deduplicated on purpose: twenty reads are one
			// name, not twenty.
			assert.deepEqual(changingSummary.steps?.[0]?.toolNames, ["read"]);
			const changingToolResults = changingSummary.steps?.[0]?.events?.filter((event) => event.type === "tool_execution_end") ?? [];
			assert.equal(changingToolResults.length, 20);
			assert.ok(changingToolResults.every((event) => event.isError === false), "all productive reads must return successful tool results");
			assert.ok((changingSummary.providerEvidence?.length ?? 0) >= 21, "the final provider summary must follow the 20 successful reads");
			assert.equal(changingSummary.resourceObservation?.toolCalls, 20);
			assert.ok((changingSummary.resourceObservation?.providerRounds ?? 0) >= 21);
			assert.ok((changingSummary.resourceObservation?.elapsedMs ?? 0) > 0);
			assert.equal(changingSummary.strategy?.resources?.toolCalls, 20);
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
			const result = await runHarness(project, output, ["--no-operator-config", "--scenario", scenario], 30_000, "failed-step");
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

	it("injects steer and follow-up through RPC while a tool is running", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-queue-"));
		try {
			const project = join(root, "project");
			const output = join(root, "queue.jsonl");
			const scenario = join(root, "scenario.json");
			await mkdir(project, { recursive: true });
			await writeFile(scenario, JSON.stringify({ steps: [{ kind: "prompt", message: "Inspect the project while accepting live guidance.", queueDuringTools: true }] }), "utf8");
			const result = await runHarness(project, output, ["--provider", "faux", "--progress-case", "midstream", "--scenario", scenario], 30_000, "midstream-queue");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				steps?: Array<{ settled?: boolean; events?: Array<{ type?: string; command?: string; success?: boolean }> }>;
			};
			const events = summary.steps?.[0]?.events ?? [];
			const queueResponses = events.filter((event) => event.type === "response" && (event.command === "steer" || event.command === "follow_up"));
			assert.equal(summary.steps?.[0]?.settled, true);
			assert.ok(events.filter((event) => event.type === "queue_update").length >= 2);
			assert.deepEqual(queueResponses.map((event) => event.command), ["steer", "follow_up"]);
			assert.ok(queueResponses.every((event) => event.success === true));
			const toolStart = events.findIndex((event) => event.type === "tool_execution_start");
			const firstQueueResponse = events.findIndex((event) => event.type === "response" && event.command === "steer");
			assert.ok(toolStart >= 0 && firstQueueResponse > toolStart);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("proves managed launcher uses the installed Dove release extension", async (t) => {
		const probe = spawnSync(process.platform === "win32" ? "where.exe" : "which", ["dove-pi"], { stdio: "ignore" });
		if (probe.status !== 0) {
			t.skip("managed dove-pi launcher is not installed in this environment");
			return;
		}
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-managed-"));
		try {
			const project = join(root, "project");
			const output = join(root, "managed.jsonl");
			await mkdir(project, { recursive: true });
			const result = await runHarness(project, output, ["--provider", "faux", "--prompt", "Read the project."], 30_000, "managed-release", "managed");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				exitCode?: number | null;
				signal?: string | null;
				providerIdentity?: Array<{ entryKind?: string; doveExtensionOrigin?: string; doveExtensionTrust?: string }>;
			};
			assert.equal(summary.exitCode, 0);
			assert.equal(summary.signal, null);
			assert.equal(summary.providerIdentity?.[0]?.entryKind, "managed-release");
			assert.equal(summary.providerIdentity?.[0]?.doveExtensionOrigin, "managed");
			assert.equal(summary.providerIdentity?.[0]?.doveExtensionTrust, "managed");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("proves the managed launcher delegates read-only work and handles unavailable child providers", async (t) => {
		const probe = spawnSync(process.platform === "win32" ? "where.exe" : "which", ["dove-pi"], { stdio: "ignore" });
		if (probe.status !== 0) {
			t.skip("managed dove-pi launcher is not installed in this environment");
			return;
		}
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-managed-subagent-"));
		try {
			const project = join(root, "project");
			const delegatedOutput = join(root, "delegated.jsonl");
			const unavailableOutput = join(root, "unavailable.jsonl");
			await mkdir(project, { recursive: true });
			const [delegated, unavailable] = await Promise.all([
				runHarness(project, delegatedOutput, ["--provider", "faux", "--subagent-case", "delegated", "--prompt", "Delegate a read-only inventory."], 30_000, "managed-subagent-delegated", "managed"),
				runHarness(project, unavailableOutput, ["--provider", "faux", "--subagent-case", "unavailable", "--prompt", "Try a read-only inventory."], 30_000, "managed-subagent-unavailable", "managed"),
			]);
			assert.equal(delegated.code, 0);
			assert.equal(unavailable.code, 0);
			const delegatedSummary = JSON.parse(await readFile(`${delegatedOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; subagentEvidence?: Array<{ argv?: string[] }> };
			const unavailableSummary = JSON.parse(await readFile(`${unavailableOutput}.summary.json`, "utf8")) as { exitCode?: number | null; signal?: string | null; sawSettled?: boolean; subagentEvidence?: unknown[] };
			assert.equal(delegatedSummary.exitCode, 0);
			assert.equal(delegatedSummary.signal, null);
			assert.equal(delegatedSummary.sawSettled, true);
			assert.deepEqual(delegatedSummary.subagentEvidence?.[0]?.argv?.slice(-9), ["--mode", "text", "--print", "--no-session", "--no-extensions", "--tools", "read,grep,find,ls", "--", "Read the project and return a short inventory."]);
			assert.equal(unavailableSummary.exitCode, 0);
			assert.equal(unavailableSummary.signal, null);
			assert.equal(unavailableSummary.sawSettled, true);
			assert.equal(unavailableSummary.subagentEvidence?.length, 0);
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

describe("the real-user scenarios", () => {
	/**
	 * **What these hold that the cases above cannot.** Every other case in this file runs the deterministic provider, whose
	 * default responses call no tool - so nothing a work mode gates ever runs, every dialog is a hardcoded refusal, and the
	 * two most ordinary things a person does (approve an action, interrupt one) had no representation at all. These seven
	 * drive scenarios committed under `tests/fixtures/scenarios/`, so "a real user session" is an artifact someone can run,
	 * extend and review rather than a literal assembled inside a test.
	 *
	 * **What they do not hold.** The model is still scripted: these say the *situation* is reproduced, not that an agent did
	 * useful work. A real provider is a manual, recorded run and not a gate - `~/.pi/agent/` carries no credentials here.
	 * TUI rendering, shortcuts and custom components are outside the harness entirely, because Pi's headless surface is RPC.
	 * And only the `confirm` dialog is reachable: `ask_user_question` is not a Pi built-in (it appears nowhere in the Pi
	 * distribution), so the `select`/`input`/`editor` answers the harness can send have no committed scenario behind them.
	 */
	const scenarioPath = (name: string): string => join(process.cwd(), "tests", "fixtures", "scenarios", `${name}.json`);

	/** A project whose mode gates `write`, so the consent dialog is a real gate rather than a decoration. */
	async function consentProject(root: string): Promise<string> {
		const project = join(root, "project");
		const mode = join(project, "modes", "consent");
		await mkdir(mode, { recursive: true });
		await mkdir(join(project, ".dove"), { recursive: true });
		await writeFile(join(project, ".dove", "mode.json"), JSON.stringify({ schemaVersion: 1, mode: "consent" }), "utf8");
		await writeFile(join(mode, "MODE.md"), ["---", "name: consent", "description: A fixture mode whose ask_before gates one action.", "license: MIT", "---", "", "Exercise the consent boundary.", ""].join("\n"), "utf8");
		await writeFile(join(mode, "governance.yaml"), [
			"version: 1.0.0", 'framework: ">=0.2.0 <0.3.0"', "scope:", "  targets: [workspace]", "  environment: non-production", "  exclusions: []",
			"authority:", "  capabilities: [workspace.inspect]",
			"gate:", "  semantics: none", "",
		].join("\n"), "utf8");
		await writeFile(join(mode, "permissions.yaml"), ["unlisted: allow", "always_allow: []", "ask_before: [write]", "never_allow: []", ""].join("\n"), "utf8");
		return project;
	}

	async function ledgerOf(stateDir: string): Promise<Array<{ kind?: string; correlation?: { requestId?: string }; details?: Record<string, unknown> }>> {
		const raw = await readFile(join(stateDir, "execution.jsonl"), "utf8");
		return raw.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
	}

	it("approves an action the work mode gates, and the ledger is what says so", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-consent-yes-"));
		try {
			const project = await consentProject(root);
			const output = join(root, "yes.jsonl");
			const result = await runHarness(project, output, ["--provider", "faux", "--dialog-case", "write", "--scenario", scenarioPath("consent-approved")], 30_000, "consent-approved");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				dialogs?: { approved?: number; declined?: number; defaulted?: number; unused?: number };
				harnessTimedOut?: boolean;
			};
			assert.equal(summary.harnessTimedOut, false);
			assert.equal(summary.dialogs?.approved, 1, "the scenario declared the consent and the harness put it");
			assert.equal(summary.dialogs?.defaulted, 0, "an answer the scenario did not declare must not be what produced this");
			assert.equal(summary.dialogs?.unused, 0, "every declared answer was consumed");
			const records = await ledgerOf((JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { stateDir: string }).stateDir);
			assert.ok(records.some((record) => record.kind === "gate.approved"), "consent is recorded, not merely performed");
			assert.ok(records.some((record) => record.kind === "tool.observed" && record.details?.tool === "write"), "and the action it authorized actually ran");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("declines the same action, and the refusal names the operator rather than the host", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-consent-no-"));
		try {
			const project = await consentProject(root);
			const output = join(root, "no.jsonl");
			const result = await runHarness(project, output, ["--provider", "faux", "--dialog-case", "write", "--scenario", scenarioPath("consent-declined")], 30_000, "consent-declined");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { stateDir: string; dialogs?: { declined?: number; defaulted?: number } };
			assert.equal(summary.dialogs?.declined, 1);
			assert.equal(summary.dialogs?.defaulted, 0, "this refusal was asked for, not the harness default");
			const records = await ledgerOf(summary.stateDir);
			const refusal = records.find((record) => record.kind === "gate.refused");
			assert.ok(refusal !== undefined, "a declined action is refused and recorded");
			assert.match(String(refusal?.details?.remediation ?? ""), /declined/i, "and the refusal distinguishes a person saying no from a host that cannot ask");
			assert.equal(records.some((record) => record.kind === "tool.observed" && record.details?.tool === "write"), false, "the action it refused did not run");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("cancels a request while its tool is running", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-cancel-"));
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const output = join(root, "cancel.jsonl");
			const result = await runHarness(project, output, ["--provider", "faux", "--progress-case", "changing", "--scenario", scenarioPath("cancel-mid-flight")], 60_000, "cancel-mid-flight");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { stateDir: string; harnessTimedOut?: boolean };
			assert.equal(summary.harnessTimedOut, false, "an abort that leaves the host hanging is not a cancellation");
			const records = await ledgerOf(summary.stateDir);
			const terminal = records.filter((record) => record.kind === "request.terminal").at(-1);
			assert.equal(terminal?.details?.reason, "cancelled", "the user's interruption is classified as one");
			assert.equal((terminal?.details?.terminal as { origin?: string } | undefined)?.origin, "user");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("resumes a session in a second run that shares its directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-resume-"));
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const shared = join(root, "shared-session");
			const first = join(root, "first.jsonl");
			const second = join(root, "second.jsonl");
			const sharedArgs = ["--provider", "faux", "--reuse-session", "--session-dir", shared, "--scenario", scenarioPath("resume-across-runs")];
			await runHarness(project, first, sharedArgs, 30_000, "resume-first");
			await runHarness(project, second, sharedArgs, 30_000, "resume-second");
			const summaries = await Promise.all([first, second].map(async (output) => JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { stateDir: string; sessionDir: string; exitCode: number | null; harnessTimedOut?: boolean }));
			assert.equal(summaries[0]?.sessionDir, summaries[1]?.sessionDir, "the flag is what makes the second run continue the first");
			assert.notEqual(summaries[0]?.sessionDir, undefined);
			assert.ok(summaries.every((summary) => summary.exitCode === 0 && summary.harnessTimedOut === false));
			const secondRecords = await ledgerOf(summaries[1]!.stateDir);
			assert.ok(secondRecords.some((record) => record.kind === "request.received"), "the second run submitted a request of its own");
			assert.equal(secondRecords.some((record) => record.kind === "request.redelivery.coalesced"), false, "and it was not mistaken for a redelivery of the first");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("treats a correction as a new logical request rather than a continuation", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-correction-"));
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const output = join(root, "correction.jsonl");
			const result = await runHarness(project, output, ["--provider", "faux", "--scenario", scenarioPath("correction")], 30_000, "correction");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { stateDir: string; steps?: Array<{ kind?: string; settled?: boolean }> };
			assert.ok((summary.steps ?? []).filter((step) => step.kind === "prompt").every((step) => step.settled === true), "both instructions were answered");
			const records = await ledgerOf(summary.stateDir);
			const planned = records.filter((record) => record.kind === "request.planned");
			assert.equal(planned.length, 2, "a correction is planned as its own request, not folded into the one it overturns");
			assert.equal(new Set(planned.map((record) => record.correlation?.requestId)).size, 2, "and the two requests have distinct identities");
			assert.equal(records.some((record) => record.kind === "request.redelivery.coalesced"), false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("keeps a session that runs past the turn cap bounded instead of hanging", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-long-"));
		const previousCap = process.env.DOVE_PI_MAX_MESSAGES;
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const output = join(root, "long.jsonl");
			process.env.DOVE_PI_MAX_MESSAGES = "3";
			const result = await runHarness(project, output, ["--provider", "faux", "--scenario", scenarioPath("long-session-past-cap")], 60_000, "long-session");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as { harnessTimedOut?: boolean; steps?: Array<{ settled?: boolean; failed?: boolean }> };
			assert.equal(summary.harnessTimedOut, false, "crossing the cap must advise, not stall the session");
			assert.ok((summary.steps ?? []).every((step) => step.settled === true || step.failed === undefined), "every step reached an end");
		} finally {
			if (previousCap === undefined) delete process.env.DOVE_PI_MAX_MESSAGES;
			else process.env.DOVE_PI_MAX_MESSAGES = previousCap;
			await rm(root, { recursive: true, force: true });
		}
	});

	it("compacts on request and keeps working afterwards", async () => {
		const root = await mkdtemp(join(tmpdir(), "dove-blackbox-compact-"));
		try {
			const project = join(root, "project");
			await mkdir(project, { recursive: true });
			const output = join(root, "compact.jsonl");
			const result = await runHarness(project, output, ["--provider", "faux", "--scenario", scenarioPath("compact")], 30_000, "compact");
			assert.equal(result.code, 0);
			const summary = JSON.parse(await readFile(`${output}.summary.json`, "utf8")) as {
				harnessTimedOut?: boolean;
				steps?: Array<{ kind?: string; settled?: boolean; events?: Array<{ type?: string }> }>;
			};
			assert.equal(summary.harnessTimedOut, false);
			const compactStep = (summary.steps ?? []).find((step) => step.kind === "compact") as
				| { settled?: boolean; response?: { command?: string; success?: boolean }; events?: Array<{ type?: string }> }
				| undefined;
			assert.ok(compactStep !== undefined, "the compact step is in the record");
			assert.equal(compactStep?.settled, true, "it completed on its response rather than waiting for an agent that never runs");
			// **The answer is recorded either way, and a refusal is one of the answers.** A session with too little to
			// compact is refused with its reason ("Nothing to compact (session too small)"), which is the host behaving
			// correctly - so this pins that the command is answered rather than asserting which way.
			assert.equal(compactStep?.response?.command, "compact", "the host answered the command the user sent");
			const types = (compactStep?.events ?? []).map((event) => event.type);
			assert.ok(types.includes("compaction_start"), "the host reported the compaction it was asked for");
			assert.ok(types.includes("compaction_end"), "and its end");
			const lastPrompt = (summary.steps ?? []).filter((step) => step.kind === "prompt").at(-1);
			assert.equal(lastPrompt?.settled, true, "a session that compacts is still usable afterwards");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

function digest(value: string): string {
	return createHash("sha256").update(value.normalize("NFC")).digest("hex").slice(0, 24);
}

function runHarness(project: string, output: string, extraArgs: readonly string[] = [], timeoutMs = 10_000, caseId = "provider-auth", launcher = "source"): Promise<{ code: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["scripts/real-dove-blackbox.mjs", "--launcher", launcher, "--cwd", project, "--output", output, "--case-id", caseId, "--timeout-ms", String(timeoutMs), ...extraArgs], {
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
