import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const cwd = resolve(valueFor("--cwd", process.cwd()));
const outputPath = resolve(valueFor("--output", resolve(cwd, ".dove", "blackbox-run.jsonl")));
const sessionDir = resolve(valueFor("--session-dir", resolve(dirname(outputPath), "pi-session")));
const stateDir = resolve(dirname(outputPath), "dove-state");
const caseId = valueFor("--case-id", "single");
const timeoutMs = Number(valueFor("--timeout-ms", "600000"));
const launcher = valueFor("--launcher", "dove-pi");
const providerMode = valueFor("--provider", "real");
const parsedContextWindow = Number(valueFor("--context-window", "128000"));
const prompt = valueFor(
  "--prompt",
  "请检查当前项目中未完成的任务，找出一个最小、明确、可以真实完成的优化目标。先只做审计，不修改文件。说明你选择的任务、验收标准、计划执行的测试，以及可能的阻塞点。"
);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(sessionDir, { recursive: true });
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let providerExtension;
const providerCapturePath = `${outputPath}.provider.jsonl`;
if (providerMode === "faux") {
  providerExtension = resolve(dirname(outputPath), "blackbox-faux-provider.mjs");
  const managedExtension = pathToFileURL(resolve(repoRoot, "src/pi-adapter/extension.ts")).href;
  const fauxModule = pathToFileURL(resolve(repoRoot, "node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/providers/faux.js")).href;
  const window = Number.isFinite(parsedContextWindow) && parsedContextWindow > 0 ? Math.floor(parsedContextWindow) : 128000;
  writeFileSync(providerExtension, `import { appendFileSync } from "node:fs";
import managed from ${JSON.stringify(managedExtension)};
import { fauxAssistantMessage, fauxProvider } from ${JSON.stringify(fauxModule)};

export default function blackboxProvider(pi) {
  managed(pi);
  const faux = fauxProvider({
    provider: "dove-blackbox",
    models: [{ id: "blackbox", name: "Dove Black-box", reasoning: false, contextWindow: ${window}, maxTokens: 4096 }],
  });
  faux.setResponses([fauxAssistantMessage("Deterministic black-box provider response.")]);
  pi.registerProvider("dove-blackbox", {
    api: faux.api,
    apiKey: "blackbox-test-key",
    models: faux.models,
    streamSimple(model, context, options) {
      const messages = Array.isArray(context.messages) ? context.messages : [];
      const messageChars = messages.reduce((total, message) => total + JSON.stringify(message).length, 0);
      appendFileSync(${JSON.stringify(providerCapturePath)}, JSON.stringify({
        model: model.id,
        systemPromptChars: typeof context.systemPrompt === "string" ? context.systemPrompt.length : 0,
        messageCount: messages.length,
        messageChars,
        toolCount: Array.isArray(context.tools) ? context.tools.length : 0,
      }) + "\\n", "utf8");
      return faux.provider.streamSimple(model, context, options);
    },
  });
}
`, "utf8");
}
const log = createWriteStream(outputPath, { flags: "w", encoding: "utf8" });
const launcherCommand = launcher === "source" ? "python" : "dove-pi";
const launcherArgs = launcher === "source"
	? [resolve(repoRoot, "dove_pi.py"), "--offline", "--mode", "rpc", "--session-dir", sessionDir]
	: ["--offline", "--mode", "rpc", "--session-dir", sessionDir];
if (providerMode === "faux") launcherArgs.push("--provider", "dove-blackbox", "--model", "blackbox");
const child = spawn(launcherCommand, launcherArgs, {
  cwd,
  env: {
    ...process.env,
    PI_SKIP_VERSION_CHECK: "1",
    PI_CODING_AGENT_DIR: sessionDir,
    DOVE_PI_STATE_DIR: stateDir,
    ...(providerExtension ? { DOVE_PI_FAUX_CAPTURE: providerCapturePath } : {}),
    ...(providerExtension ? { DOVE_PI_PROJECT_EXTENSION: providerExtension, DOVE_PI_TRUST_PROJECT_EXTENSION: "1" } : {}),
  },
  shell: true,
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
let settled = false;
let sawAgentStart = false;
let sawAgentEnd = false;
let sawSettled = false;
let eventCount = 0;
let stderr = "";
let rpcFailure;
let requestedStateEvidence = false;
let killTimer;
const startedAt = Date.now();

const writeCommand = (command) => child.stdin.write(`${JSON.stringify(command)}\n`);
const record = (event) => {
  eventCount += 1;
  log.write(`${JSON.stringify({ observedAt: new Date().toISOString(), ...event })}\n`);
  if (event.type === "agent_start") sawAgentStart = true;
  if (event.type === "agent_end") sawAgentEnd = true;
  if (event.type === "agent_settled") {
    sawSettled = true;
    settled = true;
    writeCommand({ id: "state-after", type: "get_state" });
    writeCommand({ id: "stats-after", type: "get_session_stats" });
    killTimer = setTimeout(() => child.kill(), 500);
  }
  if (event.type === "response" && event.command === "prompt" && event.success === false) {
    settled = true;
    const message = typeof event.error === "string" ? event.error : "RPC prompt failed before agent settlement.";
    rpcFailure = { message: redact(message), terminal: classifyRpcFailure(message) };
    record({ type: "rpc_failure", command: "prompt", terminal: rpcFailure.terminal });
    requestStateEvidence();
    // A provider/auth preflight failure can happen before Pi emits
    // before_agent_start. Keep the host alive long enough to flush state and
    // ledger evidence; killing immediately turns a specific error into a
    // misleading generic startup-failed terminal.
    killTimer = setTimeout(() => child.kill(), 500);
  }
  if (event.type === "extension_ui_request" && ["select", "input", "editor"].includes(event.method)) {
    writeCommand({ type: "extension_ui_response", id: event.id, cancelled: true });
  } else if (event.type === "extension_ui_request" && event.method === "confirm") {
    writeCommand({ type: "extension_ui_response", id: event.id, confirmed: false });
  }
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
    try {
      record(JSON.parse(line));
    } catch {
      record({ type: "non_json_stdout", line });
    }
  }
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
  log.write(`${JSON.stringify({ observedAt: new Date().toISOString(), type: "stderr", text: chunk })}\n`);
});

const timeout = setTimeout(() => {
  record({ type: "harness_timeout", timeoutMs });
  child.kill();
}, timeoutMs);

child.on("spawn", () => writeCommand({ id: "prompt-1", type: "prompt", message: prompt }));
child.on("close", (code, signal) => {
  clearTimeout(timeout);
  if (killTimer) clearTimeout(killTimer);
  if (buffer.trim()) {
    try { record(JSON.parse(buffer.trim())); } catch { record({ type: "non_json_stdout", line: buffer.trim() }); }
  }
  const ledger = readLedgerEvidence(stateDir);
  const ledgerTerminal = ledger.filter((record) => record?.kind === "request.terminal").at(-1);
  const planned = ledger.filter((record) => record?.kind === "request.planned").at(-1);
  const providerEvidence = readProviderEvidence(`${outputPath}.provider.jsonl`);
  const ledgerCode = ledgerTerminal?.details?.terminal?.code;
  const rpcCode = rpcFailure?.terminal?.code;
  const summary = {
    caseId,
    cwd,
    outputPath,
    sessionDir,
    launcher,
    providerMode,
    contextWindow: providerMode === "faux" && Number.isFinite(parsedContextWindow) && parsedContextWindow > 0 ? Math.floor(parsedContextWindow) : undefined,
    promptDigest: createHash("sha256").update(prompt.normalize("NFC")).digest("hex").slice(0, 24),
    durationMs: Date.now() - startedAt,
    exitCode: code,
    signal,
    settled,
    sawAgentStart,
    sawAgentEnd,
    sawSettled,
    eventCount,
    stderr,
    rpcFailure,
    ledgerTerminal: ledgerTerminal ? redactLedgerTerminal(ledgerTerminal) : undefined,
    strategy: planned?.details?.strategy ? redactStrategy(planned.details.strategy) : undefined,
    providerEvidence,
    terminalConsistency: rpcFailure ? rpcCode === ledgerCode ? "matched" : "mismatch" : ledgerTerminal ? "completed-ledger-only" : "none",
    diagnosticGap: rpcFailure && rpcCode !== ledgerCode ? "rpc-error-not-preserved-in-ledger" : undefined,
  };
  log.write(`${JSON.stringify({ type: "harness_summary", ...summary })}\n`);
  log.end(() => {
    writeFileSync(`${outputPath}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  });
});

function requestStateEvidence() {
  if (requestedStateEvidence) return;
  requestedStateEvidence = true;
  writeCommand({ id: "state-after-error", type: "get_state" });
  writeCommand({ id: "stats-after-error", type: "get_session_stats" });
}

function classifyRpcFailure(message) {
  const normalized = message.toLowerCase();
  if (/api key|authentication|authorization|\b401\b|\b403\b/.test(normalized)) {
    return { origin: "provider", code: "provider-authorization-denied", retryable: false, nextAction: "Check provider credentials and retry." };
  }
  if (/\b429\b|rate limit|too many requests/.test(normalized)) {
    return { origin: "provider", code: "provider-rate-limited", retryable: true, nextAction: "Wait for the provider window and retry." };
  }
  if (/\b5(?:00|02|03|04)\b|service unavailable|timeout|network/.test(normalized)) {
    return { origin: "provider", code: "provider-transient-failure", retryable: true, nextAction: "Retry after checking provider availability." };
  }
  if (/context|token|budget|too large|maximum/.test(normalized)) {
    return { origin: "model-budget", code: "provider-payload-rejected", retryable: true, nextAction: "Use a smaller context or model, then retry." };
  }
  return { origin: "session", code: "rpc-prompt-failed", retryable: false, nextAction: "Inspect the captured RPC error before retrying." };
}

function redact(value) {
  return String(value)
    .replace(/[A-Za-z]:\\[^\n\r\t ]+/g, "<path>")
    .replace(/\/[^\n\r\t ]{2,}/g, "<path>")
    .slice(0, 2048);
}

function readLedgerEvidence(directory) {
  try {
    const content = readFileSync(resolve(directory, "execution.jsonl"), "utf8");
    return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  } catch { return []; }
}

function redactLedgerTerminal(record) {
  const details = record?.details ?? {};
  return {
    kind: "request.terminal",
    reason: typeof details.reason === "string" ? details.reason : undefined,
    detail: typeof details.detail === "string" ? redact(details.detail) : undefined,
    terminal: details.terminal && typeof details.terminal === "object" ? {
      origin: details.terminal.origin,
      code: details.terminal.code,
      retryable: details.terminal.retryable,
      nextAction: details.terminal.nextAction,
    } : undefined,
  };
}

function redactStrategy(strategy) {
  if (!strategy || typeof strategy !== "object") return undefined;
  const context = strategy.context && typeof strategy.context === "object" ? strategy.context : {};
  return {
    schemaVersion: strategy.schemaVersion,
    intent: strategy.intent,
    lane: strategy.lane,
    executionMode: strategy.executionMode,
    budgetSource: context.budgetSource,
    contextWindow: context.contextWindow,
    doveBudgetChars: context.doveBudgetChars,
    omitted: context.omitted,
    compacted: context.compacted,
  };
}

function readProviderEvidence(path) {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return [{
          model: typeof value.model === "string" ? value.model : undefined,
          systemPromptChars: typeof value.systemPromptChars === "number" ? value.systemPromptChars : undefined,
          messageCount: typeof value.messageCount === "number" ? value.messageCount : undefined,
          messageChars: typeof value.messageChars === "number" ? value.messageChars : undefined,
          toolCount: typeof value.toolCount === "number" ? value.toolCount : undefined,
        }];
      } catch { return []; }
    });
  } catch { return []; }
}
