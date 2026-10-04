# pstack 的 Pi 适配层（`plugins/pstack/pi/`）参考审计

审计对象：`.trellis/.runtime/pstack-research/pstack-claude-main/` = `michael-denyer/pstack-claude`（快照 2026-10-04），即 Poteto's pstack 的多 harness 移植版。
审计范围：`docs/pi-equivalence.md`、`plugins/pstack/README.md`、`plugins/pstack/pi/*.ts`（13 个文件，共约 72 KB）。未读 `tests/`、`tools/`，未运行构建或测试。

**锚点约定**：下文 `P:` 开头的锚点 = `.trellis/.runtime/pstack-research/pstack-claude-main/` 下的相对路径；`D:` 开头的锚点 = 本仓库根目录（`C:\Users\Macfy\Desktop\dsh\dove-pi`）下的相对路径。每条 claim 后附 `路径:行号`，并引该行的决定性原文。

---

## 1. 这个 Pi 适配层由什么构成

### 1.1 文件清单与职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `index.ts` | 40 | 扩展入口：建 runner/scheduler、按顺序注册全部表面、挂进程与 session 生命周期 |
| `config.ts` | 163 | `Settings`、pi 自身再调用命令解析、模型别名解析、agent 文件与 override sheet 解析 |
| `path-skills.ts` | 56 | `paths:` frontmatter 的技能在第一次命中文件时给一句提示 |
| `prompt.ts` | 39 | 在每次 agent start 往 system prompt 注入 4 个 section |
| `ask.ts` | 81 | `ask_user_question` 工具（结构化提问） |
| `agents.ts` | 354 | `AgentRunner`：生成子进程、记录、持久化、steer、stop、恢复、孤儿回收 |
| `child.ts` | 218 | `PiChild`：一个 `pi --mode rpc` 进程的 stdin/stdout 单向封装 |
| `one-shot.ts` | 60 | print/json/子 agent 的"一次就退出"模式下的兜底 |
| `agent-tools.ts` | 130 | `agent` / `send_message` / `list_agents` / `stop_agent` 四个工具 + sleep 轮询封锁 |
| `agent-text.ts` | 58 | 记录 → 模型可读文本（纯函数），50 KB 上限与截断指针 |
| `worktree.ts` | 50 | `isolation: "worktree"` 的 git worktree 计划/创建/结算 |
| `schedule.ts` | 165 | `schedule_wakeup` 工具 + `/loop` 命令 |
| `sleep-wait.ts` | 76 | 判断一行 bash 是否在前台 `sleep`（无 import 的纯函数） |

### 1.2 宿主 API 的接触面（精确 import specifier）

整层只依赖**两个包**：`@earendil-works/pi-coding-agent` 和 `typebox`，其余全是 `node:*` 标准库。

- `P:plugins/pstack/pi/index.ts:1` — `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";`
- `P:plugins/pstack/pi/agents.ts:5` — `import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";`
- `P:plugins/pstack/pi/child.ts:4` — `import type { RpcCommand } from "@earendil-works/pi-coding-agent";`
- `P:plugins/pstack/pi/ask.ts:1` — `import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";`
- `P:plugins/pstack/pi/agent-text.ts:3` — `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";`（唯一用途是签名推导：`P:plugins/pstack/pi/agent-text.ts:51` — `export function noticeOf(record: EndedRecord): Parameters<ExtensionAPI["sendMessage"]>[0] {`）
- 参数 schema：`P:plugins/pstack/pi/config.ts:5` — `import { type Static, Type } from "typebox";`，`P:plugins/pstack/pi/config.ts:6` — `import { Value } from "typebox/value";`
- 文件系统/进程：`node:fs`（`P:plugins/pstack/pi/config.ts:1` — `import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";`）、`node:child_process`（`P:plugins/pstack/pi/child.ts:1` — `import { type ChildProcessByStdio, spawn } from "node:child_process";`、`P:plugins/pstack/pi/agents.ts:1` — `import { spawnSync } from "node:child_process";`）、`node:string_decoder`、`node:crypto`、`node:os`、`node:url`、`node:path`（`P:plugins/pstack/pi/path-skills.ts:2` — `import { isAbsolute, join, matchesGlob, relative, resolve } from "node:path";`，用到 Node 22 的 `matchesGlob`）。

两个文件完全不 import 宿主：`P:plugins/pstack/pi/worktree.ts:1`（只有 `node:child_process`/`node:fs`/`node:path`/`typebox`）与 `P:plugins/pstack/pi/sleep-wait.ts`（**零 import**，`P:plugins/pstack/pi/sleep-wait.ts:1` 起就是注释）。

关键结构性事实：**12/13 个文件对宿主 API 的依赖是纯类型**；真实的运行时接触面只有 4 类调用——`register*`、`pi.on(event)`、`appendEntry`、`sendMessage`/`sendUserMessage`，加上读取 `getFlag`/`getThinkingLevel`/`ctx.model`/`ctx.ui`/`ctx.sessionManager`。

### 1.3 如何接入宿主

入口是默认导出的工厂（Pi 把该文件当扩展模块加载）：

- `P:plugins/pstack/pi/index.ts:37` — `export default function pstack(pi: ExtensionAPI): void {`
- `P:plugins/pstack/pi/index.ts:38` — `pi.registerFlag(DEPTH_FLAG, { type: "string", description: "Layers below the main session; pstack sets it on the agents it starts." });`
- `P:plugins/pstack/pi/index.ts:39` — `install(pi, defaultSettings(() => Number(pi.getFlag(DEPTH_FLAG)) || 0));`

`install()` 是唯一的装配点，顺序有语义（`P:plugins/pstack/pi/index.ts:12-20`）：

```ts
export function install(pi: ExtensionAPI, settings: Settings): void {
  const runner = new AgentRunner(pi, settings);
  const scheduler = new Scheduler(pi);
  const oneShot = registerOneShot(pi, settings, runner);
  registerAgentTools(pi, runner);
  registerAsk(pi, oneShot);
  registerSchedule(pi, scheduler, oneShot);
  registerPromptSections(pi, settings);
  registerPathSkills(pi, settings);
```

生命周期挂在进程级和 session 级两处：

- `P:plugins/pstack/pi/index.ts:24-25` — `const onExit = () => runner.signalAll();` / `process.on("exit", onExit);`，注释（`P:plugins/pstack/pi/index.ts:21-23`）说明子进程是 detached、独立进程组，"a parent that exits without session_shutdown would leave them running"。
- `P:plugins/pstack/pi/index.ts:28` — `pi.on("session_start", (_event, ctx) => runner.restore(ctx.sessionManager.getEntries()));`，注释（`P:plugins/pstack/pi/index.ts:26-27`）说明恢复读的是全部 entry 而非当前分支。
- `P:plugins/pstack/pi/index.ts:29-34` — `pi.on("session_shutdown", async () => { ... })`，依次 `oneShot.dispose(); scheduler.stopAll(); await runner.stopAll();`。

注册调用全集（可 grep 验证）：`registerFlag`（index.ts:38）、`registerTool`（ask.ts:47、agent-tools.ts:59/86/102/115、schedule.ts:104，共 6 个工具）、`registerCommand`（schedule.ts:133，仅 `/loop`）、`pi.on` 共 7 类事件：`session_start`、`session_shutdown`、`before_agent_start`（prompt.ts:31）、`tool_result`（path-skills.ts:42）、`tool_call`（agent-tools.ts:54）、`agent_before_settle`（one-shot.ts:45）、`agent_settled`（one-shot.ts:51）。

工具全部声明 `exposure: "model-only"`，理由写在注释里：`P:plugins/pstack/pi/agent-tools.ts:49-50` — `// model-only exposure keeps every tool declared to the model even under` / `// codemode.mode "only", which would otherwise reach them only through scripts.`（同款注释见 `P:plugins/pstack/pi/ask.ts:45`、`P:plugins/pstack/pi/schedule.ts:102`）。

---

## 2. 技能如何抵达 Pi 宿主

### 2.1 只有"路径触发器"由扩展实现，正文仍靠模型自己 `read`

`path-skills.ts` 是 Claude Code `paths:` frontmatter 的替代品，它**不加载技能正文**，只注入一句提示：

- 扫描目录：`P:plugins/pstack/pi/path-skills.ts:25` — `const dir = join(pluginRoot, "skills");`，且要求 `<name>/SKILL.md` 存在（`P:plugins/pstack/pi/path-skills.ts:29` — `const file = join(dir, name, "SKILL.md");`）。
- 触发字段：`P:plugins/pstack/pi/path-skills.ts:31` — `const line = frontmatter(readFileSync(file, "utf8")).fields.get("paths");`
- 解析 glob 值：`P:plugins/pstack/pi/path-skills.ts:15-21`，JSON 数组优先，回退逗号分隔并剥引号（`P:plugins/pstack/pi/path-skills.ts:20` — `return value.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);`）。
- 注册的钩子是 `tool_result`：`P:plugins/pstack/pi/path-skills.ts:42` — `pi.on("tool_result", (event, ctx) => {`
- 只对文件工具生效：`P:plugins/pstack/pi/path-skills.ts:7` — `const FILE_TOOLS = new Set(["read", "edit", "write"]);`，且跳过失败结果（`P:plugins/pstack/pi/path-skills.ts:43` — `if (!FILE_TOOLS.has(event.toolName) || event.isError) return;`）。
- 路径归一化（Windows 反斜杠也被转成正斜杠）：`P:plugins/pstack/pi/path-skills.ts:46` — `const rel = relative(ctx.cwd, isAbsolute(raw) ? raw : resolve(ctx.cwd, raw)).split("\\").join("/");`
- 匹配与每 session 只提示一次：`P:plugins/pstack/pi/path-skills.ts:47` — `const skill = skills.find((s) => !noted.has(s.name) && s.globs.some((g) => matchesGlob(rel, g)));`
- 提示文本本身就是"去读它"的指令：`P:plugins/pstack/pi/path-skills.ts:50` — ``const note = `pstack: ${rel} matches the ${skill.name} skill's paths. Load that skill now (read ${skill.file}) and follow it while you work on this file.`;``
- 注入方式是把 note 追加进该 tool result 的内容：`P:plugins/pstack/pi/path-skills.ts:52-53` — `content: [...event.content, { type: "text", text: note }],` / `structuredContent: event.structuredContent,`
- 注释直接写明这是补偿：`P:plugins/pstack/pi/path-skills.ts:37-38` — `// Claude Code loads a skill with `paths:` when a matching file is touched; Pi` / `// has no such hook, so the first matching tool result carries a note instead.`

### 2.2 与"按约定发现技能"的主机的差别

其余技能分发完全交给宿主的约定机制，扩展一行不写：`P:docs/pi-equivalence.md:28` 行 T11 — `| T11 | `Skill` tool and `/command` | Pi lists skills in the system prompt; `/skill:<name>` forces one | native |`。

三处可对照的差异：

1. **没有 `pstack:` 命名空间**：`P:docs/pi-equivalence.md:29` — `| T12 | `pstack:` skill namespace | Skills load under their bare names and run as `/skill:<name>`; agent types keep `pstack:` | difference | Command spelling only.`（而 agent type 由扩展自己拼前缀，`P:plugins/pstack/pi/config.ts:158` — ``const type = `pstack:${basename(file, ".md")}`;``）
2. **`user-invocable: false` 被忽略**：`P:docs/pi-equivalence.md:64` — `| S07a | Frontmatter `user-invocable: false` | Pi ignores it, so the 23 `principle-*` skills appear in `/skill:` completion | difference | Menu visibility only.`
3. **包内路径**：`P:docs/pi-equivalence.md:54` — `| F03 | `~/.claude/plugins/` install path | Skill files load from the Pi package directory that `pi list` shows | mapping |`；`P:plugins/pstack/README.md:12` 也把这一点作为 Pi 的安装约定 — `A Pi extension that supplies the subagent, question, and wake-up tools, `/loop`, and the same routing mandate when the repository is installed as a Pi package.`

即：技能本体靠宿主约定发现，扩展补的是**宿主没有的两个钩子**——`paths:` 自动加载（`P:docs/pi-equivalence.md:65`，T13 旁注 S07b：``| S07b | Frontmatter `paths:` auto-load | The extension notes the skill on the first matching file read or edit | extension |`）与 SessionStart 强制注入。

---

## 3. 子 agent 如何被生成与驱动

### 3.1 spawn API：重新调用 pi 自己，用 RPC 而不是 argv 传 prompt

不用任何"宿主内建子 agent API"，而是 `node:child_process.spawn` 起一个新的 pi 进程：

- `P:plugins/pstack/pi/child.ts:72` — `this.proc = spawn(command, args, { cwd: opts.cwd, env: opts.env, detached: true, stdio: ["pipe", "pipe", "pipe"] });`
- 命令解析：`P:plugins/pstack/pi/config.ts:33-40`，优先复用"同一个运行时和 CLI 脚本"——`P:plugins/pstack/pi/config.ts:35` — `if (script && !script.startsWith("/$bunfs/") && existsSync(script)) { return { command: process.execPath, args: [script] }; }`，注释 `P:plugins/pstack/pi/config.ts:31-32` — `// Pi re-runs itself for children when it can: the same runtime and CLI script,` / `// so a child never picks up a different pi from PATH.`
- 子进程参数：`P:plugins/pstack/pi/agents.ts:109` — `const args = ["--mode", "rpc", "--session-id", identity.sessionId, "--session-dir", identity.sessionDir];`，随后 `--model`、`--thinking`、`--append-system-prompt`、`--pstack-depth N`、`--exclude-tools`（`P:plugins/pstack/pi/agents.ts:110-116`）。
- prompt 走 stdin 的 RPC 命令：`P:plugins/pstack/pi/child.ts:120` — `void this.command({ type: "prompt", message: prompt }).then((response) => {`；理由在 `P:plugins/pstack/pi/child.ts:51-56` — `The prompt goes in as a command, so argv never caps it and a leading @ is never a file.`
- 工具裁剪按两层决定：`P:plugins/pstack/pi/agents.ts:114` — `const excluded = [...(identity.readonly ? ["edit", "write"] : []), ...(depth + 1 >= MAX_SPAWN_DEPTH ? ["agent"] : [])];`，嵌套上限 `P:plugins/pstack/pi/agents.ts:18` — `const MAX_SPAWN_DEPTH = 3;`（注释：`P:plugins/pstack/pi/agents.ts:16-17` — `// Claude Code lets agents nest three layers below the main session and withholds` / `// the Agent tool at the third.`）。

### 3.2 子进程的流如何变成结果

`child.ts` 是唯一的读者，逐行 JSON 解析（`StringDecoder` 处理跨 chunk 的 UTF-8 边界）：

- 行缓冲：`P:plugins/pstack/pi/child.ts:75-81` — `const decoder = new StringDecoder("utf8");` … `for (const line of lines) this.onLine(line);`
- 只认 5 种 line shape（`P:plugins/pstack/pi/child.ts:15-31`），`P:plugins/pstack/pi/child.ts:174-200` 分派；`P:plugins/pstack/pi/child.ts:176-180` 起 `try { parsed = JSON.parse(line); } catch { return; }`——**未知行被跳过而不是报错**，注释 `P:plugins/pstack/pi/child.ts:12-14` — `a line that fits none is skipped: one that lacks a field` / `must not end the agent.`
- 最终文本来自 `message_end`/assistant 文本块，且**每次覆盖**（不是累积）：`P:plugins/pstack/pi/child.ts:190-191` — `const text = assistantText(message.content);` / `if (text) this.finalText = text;`
- 纯工具调用轮不产生"无答案"误判：`P:plugins/pstack/pi/child.ts:193` — `else this.errorMessage = text ? "" : `(the last assistant message had no text; stop reason: ${String(message.stopReason)})`;`
- 结束信号是 `agent_settled`，不是退出码：`P:plugins/pstack/pi/child.ts:194-196` — `} else if (Value.Check(settledLine, parsed)) {` / `this.settled = true;` / `this.close();`；`close()` 关 stdin 并设兜底超时（`P:plugins/pstack/pi/child.ts:158-159` — `this.proc.stdin.end();` / `setTimeout(() => this.terminate(this.exitGraceMs), this.exitGraceMs).unref();`）。
- 子进程里的交互弹窗被自动取消，否则会永久阻塞：`P:plugins/pstack/pi/child.ts:197-199` — `} else if (Value.Check(dialogLine, parsed)) {` / `this.proc.stdin.write(`${JSON.stringify({ type: "extension_ui_response", id: parsed.id, cancelled: true })}\n`);`（注释 `P:plugins/pstack/pi/child.ts:26` — `// Dialogs block the child until the client answers; a notify or status needs none.`）
- 结果判定把"是否 settled"放在退出码之前：`P:plugins/pstack/pi/agents.ts:81` — `if (exit.settled && exit.finalText && !exit.errorMessage) return { status: "completed", finalText: exit.finalText };`，其上一行注释 `P:plugins/pstack/pi/agents.ts:76-78` — `A run that settled on a reply completed, whatever the exit code of the shutdown after it. Stderr diagnoses a failure; a stopped child's stderr is not its output`

### 3.3 父 agent 拿到的是摘要而不是原始输出

- 上限常量：`P:plugins/pstack/pi/agent-text.ts:8` — `export const OUTPUT_CAP_BYTES = 50 * 1024;`
- 按 **UTF-8 字节**截断且不切开多字节字符：`P:plugins/pstack/pi/agent-text.ts:12-15` — `if (buf.length <= cap) return text;` / `let end = cap;` / `while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;`
- 超出时写全量到文件并留指针：`P:plugins/pstack/pi/agents.ts:91-94` — ``const outputFile = join(identity.sessionDir, `${identity.id}.out.md`);`` / `try { writeFileSync(outputFile, text);` / `return { finalText: capped, outputFile };`
- 给模型的文本是"头部元信息 + 正文（或指针）"：`P:plugins/pstack/pi/agent-text.ts:33-35` — `return `${header(record)}\n\n${report(record)}`;`；头部含 `agentId`、`description`、`status`、`exit code`、可选 worktree（`P:plugins/pstack/pi/agent-text.ts:18-25`）；截断说明 `P:plugins/pstack/pi/agent-text.ts:30` — ``return `${record.finalText}\n\n[Output truncated at ${OUTPUT_CAP_BYTES / 1024} KB. Full output: ${record.outputFile}]`;``
- 后台 agent 的完成是通过"消息"回到父上下文，而不是工具返回值：`P:plugins/pstack/pi/agent-text.ts:51` — `export function noticeOf(record: EndedRecord): Parameters<ExtensionAPI["sendMessage"]>[0] {`，投递语义在 `P:plugins/pstack/pi/agents.ts:235-237` — `if (run.background && run.ending !== "teardown") {` / `this.pi.sendMessage(noticeOf(record), status !== "stopped" ? { triggerTurn: true, deliverAs: "steer" } : { triggerTurn: false });`；注释 `P:plugins/pstack/pi/agents.ts:233-234` — `// The model that called stop_agent already has the result, so a stop's` / `// notice joins the context without starting another turn.`
- 前台结果则整条作为工具返回值，且失败置 `isError`：`P:plugins/pstack/pi/agent-tools.ts:79-81` — `content: [{ type: "text", text: resultText(record) }],` … `isError: record.status !== "completed",`

### 3.4 子 agent 的 model / effort 怎么选

- 传入的是 agent 文件里的 `model` 或调用参数：`P:plugins/pstack/pi/agents.ts:160` — `const model = resolveModel(params.model ?? def.model, this.settings, readSheet(this.settings.agentDir), parentModel);`，父模型取自 `P:plugins/pstack/pi/agents.ts:159` — `const parentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;`
- 别名语义：`P:plugins/pstack/pi/config.ts:104` — `if (!requested || PARENT_MODEL_ALIASES.includes(requested)) return parentModel;`（`PARENT_MODEL_ALIASES = ["inherit-parent", "auto"]`，`P:plugins/pstack/pi/config.ts:10`）；`provider/id` 直通（`P:plugins/pstack/pi/config.ts:105` — `if (requested.includes("/")) return requested;`）。
- 家族名先校验再查表：`P:plugins/pstack/pi/config.ts:107-110` — `if (!models.available.includes(requested)) {` … `throw new Error(`Unknown model "${requested}". Valid values: ${valid.join(", ")}.`);`
- 表按**父会话所在 provider** 选，回退到 fallback 表：`P:plugins/pstack/pi/config.ts:113-114` — `const provider = parentModel?.split("/")[0] ?? "";` / `const table = models.pi.models[Object.hasOwn(models.pi.models, provider) ? provider : models.pi.fallback];`，理由 `P:plugins/pstack/pi/config.ts:111-112` — `// Family names follow the provider the session is signed in to, so a ChatGPT` / `// subscription gets OpenAI models without any configuration.`
- override sheet 优先级最高：`P:plugins/pstack/pi/config.ts:115` — `const id = sheet?.piModels.get(requested) ?? table[requested];`；缺映射时报错并给出修法：`P:plugins/pstack/pi/config.ts:117` — `throw new Error(`No Pi model mapped for "${requested}": add a "pi models: ${requested}=<provider>/<id>" line to the override sheet.`);`
- effort 走 `--thinking`，缺省继承父会话：`P:plugins/pstack/pi/agents.ts:179` — `thinking: def.effort ?? this.pi.getThinkingLevel(),`；合法值 `P:plugins/pstack/pi/config.ts:8` — `const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;`
- agent 文件本体作为子进程的追加 system prompt（保持 Pi 的技能列表仍可见）：`P:plugins/pstack/pi/agents.ts:170` — `writeFileSync(systemPromptFile, def.body, { mode: 0o600 });` + `P:plugins/pstack/pi/agents.ts:112` — `if (identity.systemPromptFile) args.push("--append-system-prompt", identity.systemPromptFile);`（证据行：`P:docs/pi-equivalence.md:44` — `| A06 | Agent file body as the child's system prompt | Appended with `--append-system-prompt`, keeping Pi's skill list visible to the child | extension |`）

### 3.5 运行中驱动、停止、持久化

- **steer（同一轮内插话）**：`P:plugins/pstack/pi/child.ts:140-144` — `steer(message: string)` … `taken: response?.success === true && !this.settled`；注释解释了为什么必须看 `!settled`：`P:plugins/pstack/pi/child.ts:135-139` — `Pi answers a steer it reads after settling with "queued" and never runs` / `it, since it exits on EOF.`
- **发消息的状态机**：运行中 → steer；已结束 → 用同一 identity 重新 launch（`P:plugins/pstack/pi/agents.ts:288-295`，结尾 `return { record: this.launch(this.find(id).agent, message, true), running: false };`）
- **停止**：`P:plugins/pstack/pi/agents.ts:302-305` — `void run.child.command({ type: "abort" });` / `run.child.close();` / `run.child.terminate(this.settings.killGraceMs);`，先 SIGTERM 再 SIGKILL（`P:plugins/pstack/pi/child.ts:163-166`）。
- **持久化用 session entry**：`P:plugins/pstack/pi/agents.ts:327` — `this.pi.appendEntry(ENTRY_TYPE, record);`（`ENTRY_TYPE = "pstack-agents"`，`P:plugins/pstack/pi/agents.ts:15`）。
- **恢复与孤儿回收**：`P:plugins/pstack/pi/agents.ts:333-353`，重放条件 `P:plugins/pstack/pi/agents.ts:335` — `if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE || !Value.Check(recordSchema, entry.data)) continue;`，回收前用 `ps` 校验 pid 身份：`P:plugins/pstack/pi/agents.ts:122` — `const r = spawnSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf8" });`，命中判定 `P:plugins/pstack/pi/agents.ts:125` — `return args.some((arg, i) => arg === "--session-id" && args[i + 1] === sessionId);`
- **信号按进程组**（Windows 不存在）：`P:plugins/pstack/pi/child.ts:214-217` — `export function signalGroup(pid: number, signal: NodeJS.Signals): void {` / `try { process.kill(-pid, signal);` / `} catch {}`

---

## 4. prompt / question / config 三个表面

### 4.1 `prompt.ts`：把宿主缺的两种注入折成 system prompt section

- 在每个 agent start 修改 system prompt sections：`P:plugins/pstack/pi/prompt.ts:31` — `pi.on("before_agent_start", (event) => {`，`P:plugins/pstack/pi/prompt.ts:33` — `const sections = event.systemPromptOptions.sections;`
- 四个 section 名：`P:plugins/pstack/pi/prompt.ts:7-10`（`pstack-session-start` / `pstack-models` / `pstack-parallel-calls` / `pstack-pi-tools`）。
- 每次启动都重设，理由是被压缩也不能丢：`P:plugins/pstack/pi/prompt.ts:24-26` — `// Claude Code runs the session hook and loads the sheet through a CLAUDE.md` / `// include; Pi has neither, so both ride as system prompt sections, set again` / `// on every agent start so compaction cannot drop them.`
- 强制的路由指令只给顶层：`P:plugins/pstack/pi/prompt.ts:36` — `if (settings.depth === 0 && !sheet?.hookOff) sections[MANDATE_SECTION] = readFileSync(mandateFile, "utf8");`，注释 `P:plugins/pstack/pi/prompt.ts:27-28` — `// A child gets the sheet, as a Claude Code subagent sees CLAUDE.md, but not` / `// the mandate: SessionStart does not run for subagents.`
- 并行调用那句话是逐字照抄宿主 system prompt：`P:plugins/pstack/pi/prompt.ts:19-22` — `// Claude Code's system prompt, word for word but for its function_calls block.` / `// pstack skills that say "one message, N Agent calls" rely on it.`
- 技能文档里写的是 Claude Code 工具名，所以每 session 给一句映射指引：`P:plugins/pstack/pi/prompt.ts:17` — ``return `pstack skills are written for Claude Code. When one names a Claude Code tool (Agent, Skill, AskUserQuestion, Bash), a bundled skill, or a Claude model, read ${file} for the Pi equivalent before following it.`;``

### 4.2 `ask.ts`：结构化提问，且明确写出"宿主无 UI 时怎么办"

- 工具声明：`P:plugins/pstack/pi/ask.ts:47-54`，其中 `executionMode: "sequential"`（`P:plugins/pstack/pi/ask.ts:54`）。
- 参数形状与 Claude Code 对齐：1–4 个问题、每题 2–4 个选项（`P:plugins/pstack/pi/ask.ts:13` — `options: Type.Array(Type.Object({ label: Type.String(), description: Type.Optional(Type.String()) }), { minItems: 2, maxItems: 4 }),`）。
- **降级路径**是可复制的地方：`P:plugins/pstack/pi/ask.ts:58-62` — `if (!ctx.hasUI || oneShot.exits(ctx)) {` / `throw new Error(` / `"ask_user_question needs an interactive UI, and this session has none. Ask the user in plain text instead and wait for the reply.",`；其注释 `P:plugins/pstack/pi/ask.ts:56-57` — `// An rpc child reports a UI, but its parent cancels every dialog, so asking` / `// could only report a dismissal.`
- 多选被降为"一次一个"的循环，用哨兵值收尾：`P:plugins/pstack/pi/ask.ts:6-7` — `export const OTHER = "Other (type an answer)";` / `export const DONE = "Done";`，循环 `P:plugins/pstack/pi/ask.ts:34-42`。
- 取消不是异常而是结果：`P:plugins/pstack/pi/ask.ts:67-70` — `return {` / `content: [{ type: "text", text: "The user dismissed the question without answering." }],` / `details: { answers, dismissed: true },`；成功文本同样固定：`P:plugins/pstack/pi/ask.ts:76` — `content: [{ type: "text", text: `User has answered your questions: ${text}. You can now continue with the user's answers in mind.` }],`

### 4.3 `config.ts`：四个配置来源

1. **flag 传深度**（跨进程传参，不经环境变量）：`P:plugins/pstack/pi/config.ts:13` — `export const DEPTH_FLAG = "pstack-depth";`，读取是每次调用时现取（`P:plugins/pstack/pi/config.ts:51-53` — `get depth() { return readDepth(); }`），原因 `P:plugins/pstack/pi/config.ts:42-43` — `// readDepth is called on each use: pi parses extension flags after it loads` / `// the extension.`
2. **agentDir**：`P:plugins/pstack/pi/config.ts:49` — `agentDir: env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"),`（对应 `P:docs/pi-equivalence.md:47` — `| H03 | `~/.claude` config directory | `$PI_CODING_AGENT_DIR` or `~/.pi/agent` | mapping |`）
3. **两个文件**：
   - `models.json`，用 typebox 校验（`P:plugins/pstack/pi/config.ts:90-94`，`P:plugins/pstack/pi/config.ts:92` — `if (!Value.Check(modelsConfig, raw)) throw new Error(`${modelsFile} is not a pstack models file: it needs available[] and pi.{fallback, models}.`);`）
   - override sheet `pstack-models.md`：`P:plugins/pstack/pi/config.ts:80` — `const file = join(agentDir, "pstack-models.md");`；两个语法点——`session hook: off`（`P:plugins/pstack/pi/config.ts:76` — `return { text, hookOff: lines.some((l) => l === "session hook: off"), piModels };`）和 `pi models: alias=id`（`P:plugins/pstack/pi/config.ts:69` — `const m = /^pi models:\s*(.*)$/.exec(line.trim());`）。
4. **agent 定义在运行时从目录读**（无 manifest）：`P:plugins/pstack/pi/config.ts:154` — `for (const dir of ["agents", "effort-agents"]) {`，frontmatter 是手写解析器而非 YAML 库（`P:plugins/pstack/pi/config.ts:131` — `const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);`），非法 effort 直接报错并列出合法值（`P:plugins/pstack/pi/config.ts:145` — `throw new Error(`${type}: effort "${named}" is not one of ${EFFORT_LEVELS.join(", ")}`);`）。

### 4.4 附：`one-shot.ts` 与 `schedule.ts` 的能力缺失处理

- "这个进程跑完就退"这一事实被抽成一个谓词：`P:plugins/pstack/pi/one-shot.ts:35` — `const exits = (ctx: Pick<ExtensionContext, "mode">) => ctx.mode === "print" || ctx.mode === "json" || settings.depth > 0;`
- 由此必须扣住 settle，否则后台通知必丢：`P:plugins/pstack/pi/one-shot.ts:45-50` — `pi.on("agent_before_settle", async (_event, ctx) => {` … `await Promise.race([runner.nextExit(), pendingMessage(ctx, signal)]);`
- 无 UI/无交互可用的工具直接拒绝并给出下一步：`P:plugins/pstack/pi/schedule.ts:119-121` — `if (oneShot.exits(ctx)) {` / `throw new Error(`schedule_wakeup cannot fire in a ${ctx.mode} run: pi exits when this run ends. Finish the work in this run instead.`);`

---

## 5. 作者记录的 Pi 能力缺口（逐行引用）

下表取 `P:docs/pi-equivalence.md` 表格中**作者明确写出"缺失 / 不同 / 有损"**的行：状态列为 `difference`，或 "On Pi" 列写的是 "no ..." / "not present" / 某个 fallback，"Evidence" 列说明为何"无技能依赖它得到一个正确结果"。README 里没有缺口表，只有一处 Pi 专属描述（`P:plugins/pstack/README.md:12`）。

| 行号 | 原文（节选） | 缺口性质 | 作者选择的绕行 |
| --- | --- | --- | --- |
| `P:docs/pi-equivalence.md:63` | `| S06 | `superpowers`, `code-review`, `simplify`, `security-review` | Not present on Pi | difference | Mentions only. The hook text defers to other mandates, and no workflow requires these skills. | n/a |` | 依赖的配套技能在 Pi 上根本不存在 | 判定"只是提及"，hook 文本让位给其他 mandate |
| `P:docs/pi-equivalence.md:64` | `| S07a | Frontmatter `user-invocable: false` | Pi ignores it, so the 23 `principle-*` skills appear in `/skill:` completion | difference | Menu visibility only. The model still loads each principle skill by name, as on Claude Code. | n/a |` | frontmatter 字段被忽略 | 接受（仅影响补全菜单） |
| `P:docs/pi-equivalence.md:65` | `| S07b | Frontmatter `paths:` auto-load | The extension notes the skill on the first matching file read or edit | extension | `the first matching file gets a one-line note naming the skill, once per session` | n/a |` | **Pi 没有按路径自动加载技能的钩子** | 扩展在 `tool_result` 上补一句提示（`path-skills.ts`） |
| `P:docs/pi-equivalence.md:33` | `| T16 | `WebFetch`/`WebSearch` | `curl` through `bash`; web search through an MCP server | difference | No skill names either tool. Fetching works through `bash`. | n/a |` | 没有内建抓取/搜索工具 | 走 `bash` 的 `curl`；搜索靠 MCP |
| `P:docs/pi-equivalence.md:31` | `| T14 | `TaskCreate`/`TaskUpdate`/`TodoWrite` | poteto-mode's own `todo.md` fallback | mapping | poteto-mode Platform Adaptation; pi-tools.md Tool actions | n/a |` | 没有 todo 工具 | 技能自带 `todo.md` 退路（`P:docs/pi-equivalence.md:50` — `| H06 | ... | Pi has no todo tools; the `todo.md` fallback applies | n/a |`） |
| `P:docs/pi-equivalence.md:78` | `| X05 | Session scratchpad | Pi has none; the skills only warn against keeping durable state there | difference | The one reference (orchestrate) tells the agent not to use a scratchpad. | n/a |` | 没有 session scratchpad | 技能改为劝阻使用 |
| `P:docs/pi-equivalence.md:37` | `| T20 | Image-generation tool | None, as on Claude Code; draw with Mermaid or text | difference | Claude Code has no such tool either, so `teach` already falls back. | n/a |` | 两侧都没有 | 用 Mermaid/文本 |
| `P:docs/pi-equivalence.md:29` | `| T12 | `pstack:` skill namespace | Skills load under their bare names and run as `/skill:<name>`; agent types keep `pstack:` | difference | Command spelling only. Skills name each other by bare name in prose, and agent types resolve with the prefix. | n/a |` | 技能命名空间丢失（lossy） | 只保留 agent type 的前缀 |
| `P:docs/pi-equivalence.md:27` | `| T10 | Deferred tool loading (`ToolSearch`) | Every pstack tool registers at startup with `model-only` exposure, so Pi declares it to the model from the first turn, in every `codemode.mode`, and `tool_search` never has to load it | extension |` | 没有延迟工具加载 | 全部工具启动即注册 + `model-only`；代价是首轮 system prompt 变大 |
| `P:docs/pi-equivalence.md:47` | `| H03 | `~/.claude` config directory | `$PI_CODING_AGENT_DIR` 或 `~/.pi/agent` | mapping |` | 配置目录不同 | 环境变量优先 |
| `P:docs/pi-equivalence.md:53-54` | `| F02 | `.claude/skills/` project and user skills | `.pi/skills/` or `.agents/skills/` | mapping |` / `| F03 | `~/.claude/plugins/` install path | Skill files load from the Pi package directory that `pi list` shows | mapping |` | 技能目录与安装路径不同 | 走 Pi 包目录 |

反方向的"Pi 原生就有"（**不是**缺口，注意别抄错）：`P:docs/pi-equivalence.md:28`（T11 skills in system prompt、`/skill:<name>`）、`P:docs/pi-equivalence.md:32`（T15 `read`/`edit`/`write`/`bash`，`grep`/`find`/`ls` 需显式启用）、`P:docs/pi-equivalence.md:49`（H05 载入 `AGENTS.md` 或 `CLAUDE.md`）、`P:docs/pi-equivalence.md:66`（S07c `disable-model-invocation` 被 Pi 遵守）。

代码里另有一类"作者写进注释的缺口"，不在这张表上，但同样是对 Pi 的结论：

- 子 agent 会弹窗阻塞 → 自动取消：`P:plugins/pstack/pi/child.ts:26` — `// Dialogs block the child until the client answers; a notify or status needs none.`
- 子进程报 UI 但父进程会取消所有对话框 → 提问工具直接拒绝：`P:plugins/pstack/pi/ask.ts:56-57`。
- print/json 运行会在 settle 时退出 → wakeup 与后台通知都不可用：`P:plugins/pstack/pi/one-shot.ts:33-35` 与 `P:plugins/pstack/pi/schedule.ts:120`。
- steer 在 settle 后被回答 `queued` 但永不执行 → 用 `!this.settled` 判定是否真的被采纳：`P:plugins/pstack/pi/child.ts:135-139`。
- 模型会主动 `sleep` 等后台 agent → 用 `tool_call` 钩子封掉（`P:plugins/pstack/pi/agent-tools.ts:53-58`，注释 `P:plugins/pstack/pi/agent-tools.ts:52-53` — `// Wording alone did not stop models from polling a background agent with` / `// sleep, which spends turns and leads them to cut the agent short.`）。

---

## 6. 判断：哪些值得抄进 dove-pi

对照基线（本仓库现状，均按文件:n:行核实）：

- 子 agent 走 `--mode text --print --no-session --no-extensions --tools read,grep,find,ls -- <prompt>`（`D:src/pi-adapter/subagent-provider.ts:91-102`），结果判定靠退出码 0 + 非空 stdout（`D:src/pi-adapter/subagent-provider.ts:118` — `} else if (code === 0 && stdout.trim()) {`），prompt 上限 32 000 字符（`D:src/pi-adapter/subagent-provider.ts:6` — `const MAX_PROMPT_CHARS = 32_000;`），输出按**字符**截断（`D:src/pi-adapter/subagent-provider.ts:63` — ``return value.length <= MAX_OUTPUT_CHARS ? value : `${value.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`;``）。
- 我们的 13 个工具全是 `agent_*`（`D:src/pi-adapter/extension.ts:1574` — `name: "agent_subagent",` 起至 `:2093`），没有注册 `ask_user_question`；该工具被当成**第三方 Pi 扩展**提供，写在扩展目录里：`D:src/extensions/catalog.ts:212` — `packageName: "@juicesharp/rpiv-ask-user-question",`、`D:src/extensions/catalog.ts:220` — `provides: [{ id: "host.user_question", kind: "tool", authority: "pi-extension", ... toolNames: ["ask_user_question"] }]`。
- 技能只有"按约定发现"，没有路径触发：`D:src/skills/discovery.ts:21` — `export function discoverSkills(startPath = process.cwd()): readonly DiscoveredSkill[] {`，递归只认 `skill.md`（`D:src/skills/discovery.ts:106` — `if (entry.toLowerCase() === "skill.md" && isFile(path)) {`），而 `.agents/skills/**.md` 中**没有任何 `paths:` frontmatter**（`Select-String -Path .agents\skills\*\SKILL.md -Pattern "^paths:"` 无命中）。
- 已有的相近设施：`tool_result` 钩子已被占用做效果账本与进度守护（`D:src/pi-adapter/extension.ts:2871`、`:2885`），`tool_call` 钩子已注册用于请求内工具计数与效果登记（`D:src/pi-adapter/extension.ts:2623`、`:2867`），`before_agent_start` 钩子已注册用于 request plan（`D:src/pi-adapter/extension.ts:3158`）；能力目录（`D:src/extensions/catalog.ts`）、`/skills`、`/subagent`、`/task` 命令（`D:src/pi-adapter/extension.ts:1404`、`:1219`、`:1456`）都已存在。

### 值得抄的（按收益排序）

1. **RPC 子进程协议**（`P:plugins/pstack/pi/child.ts:120`、`:174-200`、`:197-199`）——**最值**。我们现在把 prompt 放进 argv（`D:src/pi-adapter/subagent-provider.ts:102` — `args.push("--", request.prompt);`），因此被 `MAX_PROMPT_CHARS` 卡死，也没有中途 steer 的通道；`--print` 模式还让"完成"只能从退出码猜。换成 `--mode rpc` + stdin 命令后，prompt 不再受 argv 限制，`agent_settled` 与退出码解耦，并且能自动取消子进程弹窗（否则在 Windows 上无人应答的 UI 会挂到超时）。
2. **完成判定用 settled 而非退出码，并把诊断与正文分开**（`P:plugins/pstack/pi/agents.ts:81-84`）——收益立现：我们现在任何非 0 退出都写成失败、任何空 stdout 都丢信息（`D:src/pi-adapter/subagent-provider.ts:121`），而 pstack 明确区分"settled 过并给了文本"与"stderr 是诊断"。
3. **UTF-8 安全截断 + 全量落盘指针**（`P:plugins/pstack/pi/agent-text.ts:12-15`、`P:plugins/pstack/pi/agents.ts:91-94`、`P:plugins/pstack/pi/agent-text.ts:30`）——我们现在 `slice(0, 256_000)`（`D:src/pi-adapter/subagent-provider.ts:63`）既可能切断代理对，也不告诉模型全量在哪里。这一条独立于 RPC，改动最小、风险最低。
4. **后台 agent + 以消息形式投递完成通知**（`P:plugins/pstack/pi/agent-tools.ts:69-73`、`P:plugins/pstack/pi/agents.ts:235-237`、`P:plugins/pstack/pi/agent-text.ts:51`）——我们完全没有：`agent_subagent` 是同步工具。抄过来等于获得"并行派发 + 通知进上下文（`deliverAs: "steer"` / `triggerTurn`）"，并且后台文案（`P:plugins/pstack/pi/agent-tools.ts:43-44`）已经写好，可直接复用。
5. **用 session entry 持久化 agent 记录 + 启动时恢复与孤儿回收**（`P:plugins/pstack/pi/agents.ts:327`、`:333-353`）——我们的替代品是执行账本，但它记的是 effect/phase，不是"这个 agent 还活着、pid 是谁、谁可以停它"。收益是可跨 `/clear`、重启、压缩后仍在 `agent_subagent` 的列表里看到历史 child。注意：`ps -o args=`（`P:plugins/pstack/pi/agents.ts:122`）与 `process.kill(-pid)`（`P:plugins/pstack/pi/child.ts:216`）在 Windows 上不可用，必须替换成 `Get-CimInstance Win32_Process -Filter "ProcessId=..."` 之类的命令行校验与 `taskkill /T /F` 的整树终止。
6. **`paths:` 路径触发技能**（`P:plugins/pstack/pi/path-skills.ts:42-55`）——我们零覆盖，且改动面小（`tool_result` 钩子已存在，`D:src/pi-adapter/extension.ts:2871`）。对 Trellis 项目尤其合适：可以让"编辑 `src/core/**` 时提示先读某规约技能"由宿主自动完成，而不是靠 AGENTS.md 里叮嘱。注意先确认 `matchesGlob` 在目标 Node 版本可用，或换成自实现匹配。
7. **`before_agent_start` 上幂等重设 system prompt 片段**（`P:plugins/pstack/pi/prompt.ts:31-38`）——我们已有该钩子（`D:src/pi-adapter/extension.ts:3158`），但用途是 request plan。收益不是"加钩子"而是"把每轮必须存在的指令写成可重设的 named section"，压缩后仍生效，并区分顶层/子 agent（`P:plugins/pstack/pi/prompt.ts:36` 的 `settings.depth === 0`）。Trellis 的 workflow 状态块目前靠 hook 脚本注入，这条给出一个与之互补的、扩展内的兜底。
8. **把"宿主缺能力"写成显式的失败+下一步**（`P:plugins/pstack/pi/ask.ts:58-62`、`P:plugins/pstack/pi/schedule.ts:119-121`）——不需要新基础设施。我们现在依赖第三方扩展提供 `ask_user_question`（`D:src/extensions/catalog.ts:212`）；一旦宿主/扩展不在，模型会静默退化成自问自答。抄 `ask.ts` 的两点即可：一是自己实现该工具（去掉 `@juicesharp/rpiv-ask-user-question` 这个 npm 依赖），二是无 UI 时抛错并明确要求"用纯文本问、等回复"。
9. **`oneShot.exits()` 谓词 + 扣住 settle + SIGINT 退 130**（`P:plugins/pstack/pi/one-shot.ts:35`、`:41-50`、`P:plugins/pstack/pi/schedule.ts:120`）——只有在我们先抄了第 4 条（后台 agent）之后才有意义；但 `exits` 这个谓词本身（print/json/depth>0 即一次性）现在就能用上，用来拒绝"在这个运行模式下永远无法触发的功能"，而不是让模型排一个注定不响的 wakeup。
10. **子进程前台的 `sleep` 封锁**（`P:plugins/pstack/pi/agent-tools.ts:54-58` + `P:plugins/pstack/pi/sleep-wait.ts:71-75`）——我们的 `progress-guard.ts` 是**事后**记录（`D:src/pi-adapter/extension.ts:2885` — `progressGuard.recordToolResult(...)`），pstack 是在 `tool_call` 上**事前**阻断。价值中等且 Windows 语义不同：我们的 shell 工具是 `powershell`（`D:src/pi-adapter/extension.ts:2890` 把它和 `bash` 并列），所以必须补 `Start-Sleep` 与 `Start-Job`/`Wait-Job` 的识别，不能照搬 `sleep-wait.ts` 的词法规则。

### 不值得抄的

- **`worktree.ts` 的 `.claude/worktrees` 路径**（`P:plugins/pstack/pi/worktree.ts:21` — ``path: join(repo, ".claude", "worktrees", `agent-${agentId}`),``）——Windows 上路径合法，但语义是 Claude Code 的目录；我们的 workspace 相关设施（`src/windows-runtime/workspace.ts`）已有自己的根目录策略，抄路径会制造第二个约定。
- **模型别名表 + `models.json` + sheet 三层解析**（`P:plugins/pstack/pi/config.ts:98-120`）——收益是"同一个家族名在不同 provider 上都能解析"，代价是又一套映射文件要维护；我们的模型入口是 `src/core/model-gateway.ts`，抄进来会与网关职责重叠。真正值得借的只有一条：**未知模型名报错时列出合法值并给出具体修法**（`P:plugins/pstack/pi/config.ts:109`、`:117`）——这个错误文案模式应统一进我们现有的校验路径。
- **手写 frontmatter 正则**（`P:plugins/pstack/pi/config.ts:131`）——只为 `model`/`effort` 两个字段，且不支持 YAML 列表/嵌套。我们的 spec 与技能 frontmatter 更复杂，抄它等于引入一个更弱的解析器。
- **`/loop` + `schedule_wakeup`**（`P:plugins/pstack/pi/schedule.ts`）——我们已有 `src/core/loop-runner.ts`（`D:src/core/loop-runner.ts:32` — `export function createAgentLoop(options: LoopOptions): AgentLoop {`）。可借的只有"重复触发必须检查 `ctx.isIdle()`，否则慢迭代会堆积"（`P:plugins/pstack/pi/schedule.ts:49-50`）与"延迟 clamp 到 60–3600 s"（`P:plugins/pstack/pi/schedule.ts:68`）这两条边界处理，实现本身不必抄。

### 一句话风险提示

整个适配层是 **POSIX 形状**的：进程组信号（`P:plugins/pstack/pi/child.ts:216`）、`ps -o args=`（`P:plugins/pstack/pi/agents.ts:122`）、`--mode rpc` 下的 detached 进程组、`ps`/`signalGroup` 回收孤儿——这些在 Windows 上要么不存在要么语义不同。**dove-pi 抄任何一条时，第一件事都是把这几处换成 Windows 等价物**，否则第 1、4、5 条会在真实使用中静默失效（子进程停止不彻底、孤儿进程永活）。
