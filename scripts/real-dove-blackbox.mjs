import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const cwd = resolve(valueFor("--cwd", process.cwd()));
const outputPath = resolve(valueFor("--output", resolve(cwd, ".dove", "blackbox-run.jsonl")));
const sessionDir = resolve(valueFor("--session-dir", resolve(dirname(outputPath), "pi-session")));
const timeoutMs = Number(valueFor("--timeout-ms", "600000"));
const launcher = valueFor("--launcher", "dove-pi");
const prompt = valueFor(
  "--prompt",
  "请检查当前项目中未完成的任务，找出一个最小、明确、可以真实完成的优化目标。先只做审计，不修改文件。说明你选择的任务、验收标准、计划执行的测试，以及可能的阻塞点。"
);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(sessionDir, { recursive: true });
const log = createWriteStream(outputPath, { flags: "w", encoding: "utf8" });
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launcherCommand = launcher === "source" ? "python" : "dove-pi";
const launcherArgs = launcher === "source"
	? [resolve(repoRoot, "dove_pi.py"), "--offline", "--mode", "rpc", "--session-dir", sessionDir]
	: ["--offline", "--mode", "rpc", "--session-dir", sessionDir];
const child = spawn(launcherCommand, launcherArgs, {
  cwd,
  env: {
    ...process.env,
    PI_SKIP_VERSION_CHECK: "1",
    PI_CODING_AGENT_DIR: sessionDir,
    DOVE_PI_STATE_DIR: resolve(dirname(outputPath), "dove-state"),
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
    setTimeout(() => child.kill(), 500);
  }
  if (event.type === "response" && event.command === "prompt" && event.success === false) {
    settled = true;
    setTimeout(() => child.kill(), 100);
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
  if (buffer.trim()) {
    try { record(JSON.parse(buffer.trim())); } catch { record({ type: "non_json_stdout", line: buffer.trim() }); }
  }
  const summary = {
    cwd,
    outputPath,
    sessionDir,
    launcher,
    prompt,
    durationMs: Date.now() - startedAt,
    exitCode: code,
    signal,
    settled,
    sawAgentStart,
    sawAgentEnd,
    sawSettled,
    eventCount,
    stderr,
  };
  log.write(`${JSON.stringify({ type: "harness_summary", ...summary })}\n`);
  log.end(() => {
    writeFileSync(`${outputPath}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  });
});
