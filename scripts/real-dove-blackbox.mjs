import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, createWriteStream, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const cwd = resolve(valueFor("--cwd", process.cwd()));
const defaultOutputPath = resolve(tmpdir(), "dove-pi-blackbox", `blackbox-run-${process.pid}.jsonl`);
const requestedOutputPath = resolve(valueFor("--output", defaultOutputPath));
const caseId = valueFor("--case-id", "single");
const timeoutMs = Number(valueFor("--timeout-ms", "600000"));
const launcher = valueFor("--launcher", "dove-pi");
const providerMode = valueFor("--provider", "real");
const progressCase = valueFor("--progress-case", "");
const subagentCase = valueFor("--subagent-case", "");
const parsedContextWindow = Number(valueFor("--context-window", "128000"));
const scenarioPath = valueFor("--scenario", "");
const legacyPrompt = valueFor("--prompt", "请检查当前项目中未完成的任务，找出一个最小、明确、可以真实完成的优化目标。先只做审计，不修改文件。说明你选择的任务、验收标准、计划执行的测试，以及可能的阻塞点。");
const requestedSessionDir = valueFor("--session-dir", "");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nonce = createHash("sha256").update(`${requestedOutputPath}\0${caseId}\0${process.pid}\0${Date.now()}`).digest("hex").slice(0, 12);
const scenarioSlug = caseId.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 64) || "single";
// An explicit output path may be inside the project being copied. Keep the
// authoritative scenario root outside that tree so cpSync cannot copy into
// its own destination; the requested output remains a compatibility copy.
const scenarioParent = pathWithin(cwd, dirname(requestedOutputPath))
  ? resolve(tmpdir(), "dove-pi-blackbox")
  : dirname(requestedOutputPath);
const scenarioRoot = resolve(scenarioParent, `${basename(requestedOutputPath)}-${scenarioSlug}-${nonce}`);
const workspaceRoot = resolve(scenarioRoot, "project");
const stateDir = resolve(scenarioRoot, "dove-state");
const sessionBase = resolve(requestedSessionDir || resolve(scenarioRoot, "pi-session"));
const sessionDir = requestedSessionDir ? resolve(sessionBase, `${scenarioSlug}-${nonce}`) : sessionBase;
const runLogPath = resolve(scenarioRoot, basename(requestedOutputPath));
const outputPath = requestedOutputPath;
const providerCapturePath = resolve(scenarioRoot, `${basename(requestedOutputPath)}.provider.jsonl`);
const providerIdentityCapturePath = resolve(scenarioRoot, `${basename(requestedOutputPath)}.identity.jsonl`);
const subagentCapturePath = resolve(scenarioRoot, `${basename(requestedOutputPath)}.subagent.jsonl`);
const scenarioSessionKey = `blackbox_${scenarioSlug}_${nonce}`;

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(scenarioRoot, { recursive: true });
mkdirSync(stateDir, { recursive: true });
mkdirSync(sessionDir, { recursive: true });
prepareWorkspace();
if (progressCase === "changing") {
  for (let index = 0; index < 20; index++) writeFileSync(resolve(workspaceRoot, `probe-${index}.txt`), `probe-${index}\n`, "utf8");
} else if (progressCase === "repeated") {
  writeFileSync(resolve(workspaceRoot, "probe-same.txt"), "stable probe\n", "utf8");
} else if (progressCase === "midstream") {
  writeFileSync(resolve(workspaceRoot, "probe-same.txt"), "mid-stream probe\n", "utf8");
}
const steps = loadScenario();
// Keep the legacy top-level digest meaningful for scenario runs by pointing
// it at the first model-bearing user step, not the default prompt fallback.
const primaryPrompt = steps.find((step) =>
  ["prompt", "follow_up", "steer"].includes(step.kind)
  && step.message
  && !/^\s*\//.test(step.message)
)?.message || legacyPrompt;
const providerExtension = providerMode === "faux" ? writeFauxProvider() : undefined;
const providerIdentityExtension = providerMode === "faux" ? writeFauxIdentity() : undefined;
const subagentChild = subagentCase ? writeSubagentChild() : undefined;

const launcherCommand = launcher === "source" ? "python" : process.platform === "win32" ? "cmd.exe" : "dove-pi";
const managedLauncherArgs = process.platform === "win32" ? ["/d", "/s", "/c", "dove-pi.cmd"] : [];
const launcherArgs = launcher === "source"
  ? [resolve(repoRoot, "dove_pi.py"), "--offline", "--mode", "rpc", "--session-dir", sessionDir]
  : [...managedLauncherArgs, "--offline", "--mode", "rpc", "--session-dir", sessionDir];
// Keep the Dove extension under test owned by the launcher. The faux provider
// is a project-owned extension passed through Pi's public explicit-extension
// flag, so provider registration happens before CLI model resolution.
if (providerExtension) launcherArgs.push("--extension", providerExtension);
if (providerIdentityExtension) launcherArgs.push("--extension", providerIdentityExtension);
if (providerMode === "faux") launcherArgs.push("--provider", "dove-blackbox", "--model", "blackbox");
const child = spawn(launcherCommand, launcherArgs, {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    PI_SKIP_VERSION_CHECK: "1",
    PI_CODING_AGENT_DIR: sessionDir,
    DOVE_PI_STATE_DIR: stateDir,
    DOVE_PI_BLACKBOX_SESSION_ID: scenarioSessionKey,
    TRELLIS_CONTEXT_ID: scenarioSessionKey,
    ...(providerExtension ? { DOVE_PI_FAUX_CAPTURE: providerCapturePath } : {}),
    ...(subagentCase === "delegated" && subagentChild ? { DOVE_PI_SUBAGENT_EXECUTABLE: process.execPath, DOVE_PI_SUBAGENT_PREFIX_ARGS: JSON.stringify([subagentChild]) } : {}),
    ...(subagentCase === "unavailable" ? { DOVE_PI_SUBAGENT_EXECUTABLE: resolve(scenarioRoot, "missing-pi-child.exe") } : {}),
  },
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
});

const log = createWriteStream(runLogPath, { flags: "w", encoding: "utf8" });
const stepRecords = steps.map((step, index) => ({ index, kind: step.kind, sessionKey: scenarioSessionKey, promptDigest: step.message ? digest(step.message) : undefined, events: [], response: undefined, settled: false }));
let buffer = "";
let stderr = "";
let eventCount = 0;
let currentStep = -1;
let activeCommand;
let activeState;
let finalEvidencePending = [];
let finalEvidenceStarted = false;
let scenarioFinished = false;
let scenarioFailed = false;
let harnessTimedOut = false;
let closeStartedAt;
const startedAt = Date.now();

const writeCommand = (command) => {
  if (!child.stdin.destroyed && child.stdin.writable) child.stdin.write(`${JSON.stringify(command)}\n`);
};

const record = (event) => {
  eventCount += 1;
  const safeEvent = redactEvent(event);
  log.write(`${JSON.stringify({ observedAt: new Date().toISOString(), stepIndex: currentStep >= 0 ? currentStep : undefined, ...safeEvent })}\n`);
  if (currentStep >= 0) stepRecords[currentStep].events.push(safeEvent);
  if (event.type === "agent_start" && activeState) activeState.sawStart = true;
  if (event.type === "agent_end" && activeState) activeState.sawEnd = true;
  if (event.type === "agent_settled" && activeState) {
    activeState.sawSettled = true;
    if (["prompt", "follow_up", "steer"].includes(activeState.kind)) {
      const providerWarning = stepRecords[currentStep]?.events.some((observed) => observed.type === "extension_ui_request" && observed.notifyType === "warning" && typeof observed.message === "string" && observed.message.startsWith("[Dove provider-"));
      completeActiveStep(providerWarning);
    }
  }
  if (event.type === "tool_execution_start" && activeState?.queueDuringTools && !activeState.queueInjected) {
    activeState.queueInjected = true;
    const suffix = currentStep + 1;
    activeState.queueCommandIds = [`step-${suffix}-steer`, `step-${suffix}-follow-up`];
    writeCommand({ id: activeState.queueCommandIds[0], type: "steer", message: "Prioritize the active tool result and report it." });
    writeCommand({ id: activeState.queueCommandIds[1], type: "follow_up", message: "After that, state one remaining risk." });
  }
  if (event.type === "extension_ui_request" && ["select", "input", "editor"].includes(event.method)) writeCommand({ type: "extension_ui_response", id: event.id, cancelled: true });
  else if (event.type === "extension_ui_request" && event.method === "confirm") writeCommand({ type: "extension_ui_response", id: event.id, confirmed: false });
  if (event.type !== "response") return;

  if (finalEvidencePending.includes(event.id)) {
    finalEvidencePending = finalEvidencePending.filter((id) => id !== event.id);
    if (finalEvidencePending.length === 0 && !scenarioFinished) {
      scenarioFinished = true;
      closeStartedAt = Date.now();
      child.stdin.end();
    }
    return;
  }
  if (!activeCommand || event.id !== activeCommand.id || currentStep < 0) return;
  stepRecords[currentStep].response = redactResponse(event);
  activeCommand.responseSeen = true;
  if (!event.success && activeCommand.type === "prompt") {
    record({ type: "rpc_failure", command: "prompt", terminal: classifyRpcFailure(event.error || "RPC prompt failed before agent settlement.") });
    completeActiveStep(true);
  } else if (["get_state", "get_session_stats"].includes(activeCommand.type)) {
    activeCommand.responseData = event.data;
    completeActiveStep();
  } else if (activeCommand.type === "prompt" && /^\s*\//.test(activeCommand.message || "")) {
    completeActiveStep();
  } else if (activeState?.sawSettled) completeActiveStep();
};

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    const newline = buffer.indexOf("\n");
    if (newline < 0) break;
    let line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line.trim()) continue;
    try { record(JSON.parse(line)); } catch { record({ type: "non_json_stdout", line: redact(line) }); }
  }
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
  log.write(`${JSON.stringify({ observedAt: new Date().toISOString(), type: "stderr", text: redact(chunk) })}\n`);
});
const timeout = setTimeout(() => {
  harnessTimedOut = true;
  record({ type: "harness_timeout", timeoutMs });
  child.kill();
}, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 600000);

child.on("spawn", () => startNextStep());
child.on("close", (code, signal) => {
  clearTimeout(timeout);
  if (buffer.trim()) {
    try { record(JSON.parse(buffer.trim())); } catch { record({ type: "non_json_stdout", line: redact(buffer.trim()) }); }
  }
  const ledger = readLedgerEvidence(stateDir);
  const terminals = ledger.filter((entry) => entry?.kind === "request.terminal");
  const plans = ledger.filter((entry) => entry?.kind === "request.planned");
  const resourceRecords = ledger.filter((entry) => entry?.kind === "task.convergence.observed" && entry?.details?.observationOnly === true);
  const rpcFailure = stepRecords.flatMap((step) => step.events).find((event) => event.type === "rpc_failure");
  const lastTerminal = terminals.at(-1);
  const lastPlan = plans.at(-1);
  const lastResourceObservation = resourceRecords.at(-1);
  const ledgerCode = lastTerminal?.details?.terminal?.code;
  const rpcCode = rpcFailure?.terminal?.code;
  const allEvents = stepRecords.flatMap((step) => step.events);
  // Ledger request records only exist for model turns. Diagnostics-only and
  // slash-command steps still occupy scenario positions, so correlate by the
  // observed agent lifecycle rather than by raw step/ledger array indexes.
  const requestStepIndexes = stepRecords
    .filter((step) => step.events.some((event) => event.type === "agent_start") || step.failed)
    .map((step) => step.index);
  const terminalByStep = new Map(requestStepIndexes.map((index, position) => [index, terminals[position]]));
  const planByStep = new Map(requestStepIndexes.map((index, position) => [index, plans[position]]));
  const summary = {
    caseId, scenarioSessionKey, cwd: workspaceRoot, outputPath, runLogPath, scenarioRoot, sessionDir, stateDir,
    launcher, providerMode,
    contextWindow: providerMode === "faux" && Number.isFinite(parsedContextWindow) && parsedContextWindow > 0 ? Math.floor(parsedContextWindow) : undefined,
    promptDigest: digest(primaryPrompt), durationMs: Date.now() - startedAt,
    exitCode: code, signal, harnessTimedOut, scenarioFailed, settled: stepRecords.some((step) => step.settled),
    sawAgentStart: allEvents.some((event) => event.type === "agent_start"),
    sawAgentEnd: allEvents.some((event) => event.type === "agent_end"),
    sawSettled: allEvents.some((event) => event.type === "agent_settled"), eventCount,
    stderr: redact(stderr),
    steps: stepRecords.map((step) => {
      const terminal = terminalByStep.get(step.index);
      const plan = planByStep.get(step.index);
      return { ...step, terminal: terminal ? redactLedgerTerminal(terminal) : undefined, strategy: plan?.details?.strategy ? redactStrategy(plan.details.strategy) : undefined, toolNames: extractToolNames(step.events) };
    }),
    ledgerTerminal: lastTerminal ? redactLedgerTerminal(lastTerminal) : undefined,
    strategy: lastPlan?.details?.strategy ? redactStrategy(lastPlan.details.strategy, lastResourceObservation) : undefined,
    resourceObservation: lastResourceObservation ? redactResourceObservation(lastResourceObservation) : undefined,
    rpcFailure: rpcFailure ? { message: undefined, terminal: rpcFailure.terminal } : undefined,
    diagnosticGap: rpcFailure && rpcCode !== ledgerCode ? "rpc-error-not-preserved-in-ledger" : undefined,
    ledgerTerminals: terminals.map(redactLedgerTerminal), providerEvidence: readProviderEvidence(providerCapturePath), providerIdentity: readProviderIdentity(providerIdentityCapturePath), subagentEvidence: readSubagentEvidence(subagentCapturePath),
    artifactEvidence: readArtifactEvidence(workspaceRoot),
    terminalConsistency: harnessTimedOut ? "harness-timeout" : rpcFailure && rpcCode !== ledgerCode ? "mismatch" : lastTerminal ? "completed-ledger-only" : "none",
    closeWaitMs: closeStartedAt ? Date.now() - closeStartedAt : undefined,
  };
  // The JSONL run log is the redacted, user-facing evidence stream. Keep
  // filesystem paths only in the local summary sidecar.
  log.write(`${JSON.stringify({ type: "harness_summary", ...redactSummary(summary) })}\n`);
  log.end(() => {
    // Keep the requested path as a compatibility copy while the authoritative
    // run log remains inside the scenario's isolated root.
    if (runLogPath !== outputPath) writeFileSync(outputPath, readFileSync(runLogPath));
    writeFileSync(`${outputPath}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(redactSummary(summary))}\n`);
  });
});

function startNextStep() {
  if (scenarioFinished) return;
  currentStep += 1;
  if (currentStep >= steps.length) return requestFinalEvidence();
  const step = steps[currentStep];
  activeState = { kind: step.kind, sawStart: false, sawEnd: false, sawSettled: false, queueDuringTools: step.queueDuringTools === true, queueInjected: false };
  // Pi's follow_up/steer RPC forms queue input for an agent that is currently
  // running. Our replay deliberately sends one step after the previous one
  // settles, so continuation is a fresh prompt in the same session, matching
  // what an interactive user submits after the response is complete.
  const type = step.kind === "state" ? "get_state" : step.kind === "stats" ? "get_session_stats" : ["follow_up", "steer"].includes(step.kind) ? "prompt" : step.kind;
  activeCommand = { id: `step-${currentStep + 1}`, type, message: step.message || "" };
  writeCommand(activeCommand);
}

function completeActiveStep(failed = false) {
  if (!activeCommand || currentStep < 0 || stepRecords[currentStep].settled) return;
  stepRecords[currentStep].settled = !failed;
  stepRecords[currentStep].failed = failed || undefined;
  activeCommand = undefined;
  activeState = undefined;
  if (failed) {
    scenarioFailed = true;
    setTimeout(requestFinalEvidence, 0);
  } else {
    setTimeout(startNextStep, 0);
  }
}

function requestFinalEvidence() {
  if (finalEvidenceStarted) return;
  finalEvidenceStarted = true;
  currentStep = -1;
  finalEvidencePending = ["final-state", "final-stats"];
  writeCommand({ id: "final-state", type: "get_state" });
  setTimeout(() => writeCommand({ id: "final-stats", type: "get_session_stats" }), 25);
}

function loadScenario() {
  let value;
  if (scenarioPath) value = JSON.parse(readFileSync(resolve(scenarioPath), "utf8"));
  const rawSteps = Array.isArray(value) ? value : value?.steps;
  return (rawSteps || [{ kind: "prompt", message: legacyPrompt }]).map((step) => {
    if (typeof step === "string") return { kind: "prompt", message: step };
    const kind = step?.kind || "prompt";
    if (!["prompt", "follow_up", "steer", "state", "stats"].includes(kind)) throw new Error(`Unsupported black-box step kind: ${kind}`);
    return { kind, message: typeof step?.message === "string" ? step.message : "", queueDuringTools: step?.queueDuringTools === true };
  });
}

function prepareWorkspace() {
  mkdirSync(workspaceRoot, { recursive: true });
  cpSync(cwd, workspaceRoot, { recursive: true, force: false, errorOnExist: false, filter: (source) => {
    const normalized = source.replaceAll("\\", "/");
    const scenario = scenarioRoot.replaceAll("\\", "/");
    return !normalized.startsWith(scenario) && !normalized.includes("/node_modules/") && !normalized.includes("/.git/") && !normalized.includes("/.trellis/.runtime/");
  } });
}

function writeFauxProvider() {
  const path = resolve(workspaceRoot, ".pi", "extensions", "blackbox-faux-provider.mjs");
  const fauxModule = pathToFileURL(resolve(repoRoot, "node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/providers/faux.js")).href;
  const window = Number.isFinite(parsedContextWindow) && parsedContextWindow > 0 ? Math.floor(parsedContextWindow) : 128000;
  const mode = JSON.stringify(progressCase === "midstream" ? "repeated" : progressCase);
  const subagent = JSON.stringify(subagentCase);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `import { appendFileSync } from "node:fs";\nimport { fauxAssistantMessage, fauxProvider, fauxToolCall } from ${JSON.stringify(fauxModule)};\nexport default function blackboxProvider(pi) {\n  const faux = fauxProvider({ provider: "dove-blackbox", models: [{ id: "blackbox", name: "Dove Black-box", reasoning: false, contextWindow: ${window}, maxTokens: 4096 }] });\n  const mode = ${mode};\n  const subagent = ${subagent};\n  const responses = mode === "changing"\n    ? Array.from({ length: 20 }, (_, index) => fauxAssistantMessage([fauxToolCall("read", { path: "probe-" + index + ".txt" }, { id: "progress-read-" + index })], { stopReason: "toolUse" })).concat(fauxAssistantMessage("Completed all changing reads."))\n    : mode === "repeated"\n      ? Array.from({ length: 4 }, (_, index) => fauxAssistantMessage([fauxToolCall("read", { path: "probe-same.txt" }, { id: "progress-repeat-" + index })], { stopReason: "toolUse" })).concat(fauxAssistantMessage("This response must not be reached."))\n      : subagent === "delegated" || subagent === "unavailable"\n        ? [fauxAssistantMessage([fauxToolCall("agent_subagent", { name: "blackbox-investigation", prompt: "Read the project and return a short inventory." }, { id: "subagent-call-1" })], { stopReason: "toolUse" }), fauxAssistantMessage("Subagent investigation completed.")]\n        : Array.from({ length: 64 }, () => fauxAssistantMessage("Deterministic black-box provider response."));\n  faux.setResponses(responses);\n  pi.registerProvider("dove-blackbox", { api: faux.api, apiKey: "blackbox-test-key", models: faux.models, streamSimple(model, context, options) {\n    const messages = Array.isArray(context.messages) ? context.messages : [];\n    appendFileSync(${JSON.stringify(providerCapturePath)}, JSON.stringify({ model: model.id, systemPromptChars: typeof context.systemPrompt === "string" ? context.systemPrompt.length : 0, messageCount: messages.length, messageChars: messages.reduce((total, message) => total + JSON.stringify(message).length, 0), toolCount: Array.isArray(context.tools) ? context.tools.length : 0 }) + "\\n", "utf8");\n    return faux.provider.streamSimple(model, context, options);\n  } });\n}\n`, "utf8");
  return path;
}

function writeFauxIdentity() {
  const path = resolve(workspaceRoot, ".pi", "extensions", "blackbox-identity.mjs");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `import { appendFileSync } from "node:fs";
const entry = process.env.DOVE_PI_EXTENSION_ENTRY || "";
appendFileSync(${JSON.stringify(providerIdentityCapturePath)}, JSON.stringify({ doveExtensionOrigin: process.env.DOVE_PI_EXTENSION_ORIGIN, doveExtensionTrust: process.env.DOVE_PI_EXTENSION_TRUST, entryKind: /app.*versions/i.test(entry) ? "managed-release" : "source-or-explicit" }) + "\\n", "utf8");
export default function blackboxIdentity() {}
`, "utf8");
  return path;
}

function writeSubagentChild() {
  const path = resolve(workspaceRoot, ".pi", "subagent-child.mjs");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `import { appendFileSync } from "node:fs";
const capture = ${JSON.stringify(subagentCapturePath)};
appendFileSync(capture, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }) + "\\n", "utf8");
process.stdout.write("Read-only delegated investigation result.");
`, "utf8");
  return path;
}

function digest(value) { return createHash("sha256").update(String(value || "").normalize("NFC")).digest("hex").slice(0, 24); }
function redact(value) { return String(value || "").replace(/[A-Za-z]:\\[^\n\r\t ]+/g, "<path>").replace(/\/[^\n\r\t ]{2,}/g, "<path>").slice(0, 2048); }
function redactEvent(event) {
  const safe = { type: event.type };
  for (const key of ["id", "command", "success", "method", "toolName", "stopReason", "notifyType", "statusKey"]) {
    if (event[key] !== undefined) safe[key] = typeof event[key] === "string" ? redact(event[key]) : event[key];
  }
  if (event.type === "message_start" || event.type === "message_end") {
    safe.role = event.message?.role;
    safe.messageDigest = digest(JSON.stringify(event.message?.content || event.message));
  } else if (event.type === "message_update") {
    safe.updateType = event.assistantMessageEvent?.type;
  } else if (event.type === "tool_start" || event.type === "tool_end" || event.type === "tool_execution_start" || event.type === "tool_execution_end") {
    safe.toolName = typeof event.toolName === "string" ? event.toolName : undefined;
    if (typeof event.isError === "boolean") safe.isError = event.isError;
  } else if (event.type === "extension_ui_request") {
    safe.message = event.message ? redact(event.message) : undefined;
  } else if (event.type === "rpc_failure") {
    safe.terminal = event.terminal;
  } else if (event.type === "response") {
    safe.response = redactResponse(event);
  }
  return safe;
}
function redactResponse(event) { return { command: event.command, success: event.success, error: event.success ? undefined : redact(event.error) }; }
function redactSummary(summary) {
  return { ...summary, cwd: "<scenario-project>", outputPath: "<requested-output>", runLogPath: "<scenario-log>", scenarioRoot: "<scenario-root>", sessionDir: "<scenario-session>", stateDir: "<scenario-state>" };
}
function classifyRpcFailure(message) { const normalized = String(message).toLowerCase(); if (/api key|authentication|authorization|\b401\b|\b403\b/.test(normalized)) return { origin: "provider", code: "provider-authorization-denied", retryable: false }; if (/\b429\b|rate limit|too many requests/.test(normalized)) return { origin: "provider", code: "provider-rate-limited", retryable: true }; if (/\b5(?:00|02|03|04)\b|service unavailable|timeout|network/.test(normalized)) return { origin: "provider", code: "provider-transient-failure", retryable: true }; if (/context|token|budget|too large|maximum/.test(normalized)) return { origin: "model-budget", code: "provider-payload-rejected", retryable: true }; return { origin: "session", code: "rpc-prompt-failed", retryable: false }; }
function readLedgerEvidence(directory) { try { return readFileSync(resolve(directory, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }); } catch { return []; } }
function readArtifactEvidence(projectRoot) {
  const files = [];
  const walk = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(relative(projectRoot, path).replaceAll("\\", "/"));
    }
  };
  walk(projectRoot);
  const doveFiles = files.filter((path) => path === ".dove/state.json" || path.startsWith(".dove/tasks/"));
  const formalArtifacts = doveFiles.filter((path) => /\/(?:task\.json|prd\.md|design\.md|implement\.md|acceptance\.md|convergence\.json|evidence\.jsonl)$/.test(`/${path}`));
  const convergenceFiles = doveFiles.filter((path) => path.endsWith("/convergence.json"));
  const formalTaskDirs = [...new Set(formalArtifacts.filter((path) => path.startsWith(".dove/tasks/")).map((path) => path.split("/").slice(0, 3).join("/")))];
  return {
    doveState: files.includes(".dove/state.json"),
    doveFileCount: doveFiles.length,
    formalTaskCount: formalTaskDirs.length,
    formalArtifactCount: formalArtifacts.length,
    convergenceFileCount: convergenceFiles.length,
    formalArtifacts,
  };
}
function redactLedgerTerminal(record) { const details = record?.details || {}; return { reason: details.reason, detail: details.detail ? redact(details.detail) : undefined, terminal: details.terminal && { origin: details.terminal.origin, code: details.terminal.code, retryable: details.terminal.retryable, nextAction: details.terminal.nextAction } }; }
function redactStrategy(strategy, resourceRecord) {
  const context = strategy?.context || {};
  const resources = resourceRecord ? redactResourceObservation(resourceRecord) : strategy?.resources;
  return {
    schemaVersion: strategy?.schemaVersion,
    logicalRequestId: strategy?.logicalRequestId,
    intent: strategy?.intent,
    lane: strategy?.lane,
    interactionMode: strategy?.interactionMode,
    workflowAction: strategy?.workflowAction,
    executionMode: strategy?.executionMode,
    executionModeSource: strategy?.executionModeSource,
    thinkingPolicy: strategy?.thinkingPolicy,
    thinkingPolicySource: strategy?.thinkingPolicySource,
    thinkingLevel: strategy?.thinkingLevel,
    toolProfile: strategy?.toolProfile,
    toolProfileSource: strategy?.toolProfileSource,
    activeToolCount: strategy?.activeToolCount,
    providerRound: strategy?.providerRound,
    readOnlyBudget: strategy?.readOnlyBudget,
    budgetSource: context.budgetSource,
    contextWindow: context.contextWindow,
    observedTokens: context.observedTokens,
    doveBudgetChars: context.doveBudgetChars,
    omitted: context.omitted,
    compacted: context.compacted,
    resources,
  };
}
function redactResourceObservation(record) {
  const details = record?.details || {};
  return {
    toolCalls: details.toolCalls,
    providerRounds: details.providerRounds,
    elapsedMs: details.elapsedMs,
    toolDurationMs: details.toolDurationMs,
    inputTokens: details.inputTokens,
    cacheReadTokens: details.cacheReadTokens,
    cacheWriteTokens: details.cacheWriteTokens,
    outputTokens: details.outputTokens,
    reasoningTokens: details.reasoningTokens,
    stopReasons: Array.isArray(details.stopReasons) ? details.stopReasons : undefined,
  };
}
function pathWithin(parent, candidate) {
  const child = relative(resolve(parent), resolve(candidate));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}
function extractToolNames(events) { const names = new Set(); for (const event of events) if (event.type === "tool_start" && typeof event.toolName === "string") names.add(event.toolName); return [...names].sort(); }
function readProviderEvidence(path) { try { return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => { try { const value = JSON.parse(line); return [{ model: value.model, systemPromptChars: value.systemPromptChars, messageCount: value.messageCount, messageChars: value.messageChars, toolCount: value.toolCount }]; } catch { return []; } }); } catch { return []; } }
function readProviderIdentity(path) { try { return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }); } catch { return []; } }
function readSubagentEvidence(path) { try { return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => { try { const value = JSON.parse(line); return [{ argv: Array.isArray(value.argv) ? value.argv : [], cwd: value.cwd ? "<subagent-cwd>" : undefined }]; } catch { return []; } }); } catch { return []; } }
