# The hang, measured end to end

## What was measured, and where

From one field run on a real library (`cachecontrol`), scenario `immutable-directive-work`, on `2026-10-05`. Two
records of the same window, and they agree.

### The sequence, from the runner's own event stream and the session transcript

| time | record | what it says |
|---|---|---|
| 19:07:59.629 | transcript | `bash` call: `python -m pytest tests/test_immutable.py -q 2>&1 \| head -40` |
| 19:08:00.607 | transcript | tool result, in one second: the test still fails |
| 19:08:37.112 | transcript | the assistant thinks: *"Still failing. Let me debug - is the response being cached at all? `cache.get(target)` is not None, so it's stored. Is the second request reaching cached…"* |
| 19:08:37.113 | event stream | `tool_execution_start`, `toolName: bash` - **and the transcript ends here** |
| 19:08:37.113 | event stream | `tool_execution_update`, `toolName: bash` - the last thing written |
| *six minutes thirty-three seconds, nothing in either record* | | |
| 19:15:10.744 | event stream | `harness_timeout` |

`durationMs 900022` · `harnessTimedOut true` · `sawAgentStart true` · **`sawAgentEnd false`** · `settled false` ·
`reason "cancelled"` · `eventCount 1994` · **`stderr` length 0** · the agent's own work took 8m26s.

So: a tool call began, never returned, and nothing outside it said anything at all. The only thing that ended the
run was the outer nine-hundred-second watchdog.

## Why the two-hundred-forty-second timeout did not help

`src/pi-adapter/extension.ts`, `applyAdaptiveShellTimeout`, read verbatim:

- `:222` - only `bash` and `powershell` are considered.
- `:223` - an explicit timeout wins and nothing is applied.
- `:228` - **and the command must match a whitelist regex**: `go test`, `npm test`, `pnpm test`, `yarn test`,
  `pytest`, `cargo test`, `dotnet test`, `make test`, `make check`. Anything else returns `{ applied: false }`.
- `:230` - the configured value, default 240.
- `:239` - the applied case sets `input.timeout`.

Its own comment states the premise: *"Pi's bash tool intentionally has no default timeout; on Windows a
package-wide test command can therefore sit behind a Git-Bash pipe until the host cancels the whole request and
reports only 'This operation was aborted'. This is an escape hatch, not a global tool limit: ordinary commands are
untouched."*

The run recorded four of the harness's notices - *"Dove 为聚合验证命令设置 240s 超时；可用
DOVE_PI_SHELL_TIMEOUT_SECONDS 调整，但仍受 Pi 宿主外层 watchdog 约束"* - at 19:05:06, 19:07:52 and 19:07:59, all
before the hang. Those are the `pytest` calls, which are on the list. **The call that hung is not on the list, so
no timeout was applied to it**, and the run sat until the outer watchdog.

## What is not known, and is not written as known

**Which command hung.** Neither record holds its arguments: the event stream carries `messageDigest`
(`310071df1f9df18c3ab3cbbe`) rather than a payload, and the transcript's last readable call is the `pytest` at
19:07:59. The context suggests a caching question being debugged, which would mean a command that starts a server
or reaches the network - but that is an inference and is labelled as one.

**Whether the hang is reproducible at all**, and whether it is Git-Bash's stdio handling on this platform rather
than anything the command did.

## The design question this task holds

Three routes, and the choice is not made here:

1. **Widen the list** - cheap, and it leaves the next unlisted command unprotected exactly as this one was.
2. **Make a timeout the default** and let the list only shorten it - protects everything, and changes the
   behaviour of every ordinary command, which the comment explicitly chose not to do.
3. **Record the absence** - leave the behaviour and make the reading say a call is still running, so a hang can be
   told from slowness rather than inferred from a watchdog message.

The third is the only one that is a reading rather than a behaviour, and this round's whole subject is that a
reading which omits the fact is what let two earlier readings be wrong.

---

## 补测（2026-10-05 深夜，第四次 field run ✓✓）—— **"哪条命令挂住"不再是未知** ✓✓✓

**上一节把它标成"推断"的那一条，现在被量到了，而且推断被推翻** ✗✓✓。

第四次运行用的场景是 `immutable-directive-work-as-a-task` ✓（同一克隆、同一 provider ✓，上限 45 分钟 ✓）。它的会话记录**保存了那条命令的原文** ✓✓：

```
which dove-pi.cmd; ls -la /c/Users/Macfy/.agents 2>/dev/null; \
  find / -name "dove-pi.cmd" -maxdepth 6 2>/dev/null | head
```

**它不是起服务器、也不是带网络的命令** ✗✓✓ —— **它是一次从 `/` 开始的全盘 `find`** ✓，**并且管道给 `head`** ✓。所以上一节那条推断（*"挂死的很可能是起服务器/带网络的命令"* ✓）**在这一次上是错的** ✓✓：**一个纯文件系统扫描就够了** ✓。

**两处记录仍然一致地沉默** ✓✓（与上一节同形 ✓）：账本第一行 `16:50:37.880` ✓，最后一行 `16:50:59.355` ✓ —— **开工 22 秒后没有任何事件** ✓；45 分钟的上限把它切掉 ✓（`durationMs 2700270` ✓）；账本共 **14 行** ✓、`providerRounds 1` ✓、`tool.observed` **只有 1 条**（先跑的那条 `ls` ✓）**而挂住的那条从未被观测** ✗✓✓。**`sawAgentEnd false`** ✓ 与上一节一字不差 ✓。

**于是"哪些是已知"更新成** ✓✓：

| 项 | 之前 | 现在 |
|---|---|---|
| 挂住的是哪条命令 | **未知**（只有 digest ✗） | **已知** ✓：全盘 `find` + `head` ✓（**不是**服务器/网络命令 ✓） |
| 两处记录沉默 | 已知 ✓ | **再次**量到 ✓（22 秒 → 上限 ✓） |
| 挂死是否可复现 | 未知 ✗ | **至少两次 ✓**（19:08 那次 ✓ / 16:50 这次 ✓），**两次都不是同一类命令** ✓ |
| 超时是否被套用 | **没有**（不在白名单 ✓） | **仍然没有** ✓ —— **两次挂住的命令都在白名单之外** ✓✓ |

**而这给本任务补上一条更硬的判据** ✓✓：**白名单之外的那类命令已经挂住过两次，两次都不是"聚合测试命令"** ✓ —— 所以"扩大名单"（第 1 条路）**要加进去的不是测试命令，而是"任何命令"** ✗✓，**这条路到此为止** ✓。

**顺带一条与本任务同族的** ✓：这次的 agent 是为了**找启动器**才全盘搜索的，而启动器之所以找不到，是因为**安装的 shim 在 git-bash 里不可解析** ✓（已另修 ✓，见 `10-05-whole-flow-end-to-end/readings.md` 第四份 ✓）。**一个可见的失败，把一个 agent 推向了无限期的等待** ✓ —— 这正是"读数缺失会让后面的读数出错"的又一例 ✓。

---

# 落地读数（2026-10-05 ✓）—— 第 ③ 条路真的写进去了 ✓✓

## 落地了什么 ✓

| 处 | 内容 |
|---|---|
| `src/core/contracts.ts` | 闭集加 `"tool.started"` ✓（与既有的 `capability.started` / `capability.timed_out` 同形 ✓） |
| `src/core/execution-ledger.ts` | `appendToolStarted` ✓ + 投影里 `tool.started` 的 case ✓，并给出 **`toolCallsStarted` / `toolCallsObserved` / `unterminatedToolCalls`** ✓（照 `unterminatedRequests` 的形状：有界、按账本顺序、为空则**省键**而非给空数组 ✓） |
| `src/pi-adapter/extension.ts` | **一个写点**：在 `tool_call` 处理器的**最后一个 blocking return 之后** ✓（`toolTimings.set` 的旁边——那一行是内存版，这条是它的持久版 ✓）；**一个读点**：`/status` 行 ✓（只在**非零**时打印 ✓）。`agent_doctor` 因为整块转发投影而自动带上 ✓（`:1996` ✓） |
| `src/core/failure-reading.ts` | "起了但没观测" 作为**更强的事实**排在"这个账本里没有 `tool.observed`"**之前** ✓ |
| `.trellis/spec/backend/error-handling.md` | §Aggregate shell timeout contract 补上"被声明的缺席"那一半 ✓ |

**判据** ✓✓：`npm run typecheck` **0** ✓；`npm test` **949 / 949 pass / 0 fail** ✓（比开工前 +2 = 新增的两条用例 ✓）。**新增两条**：`tests/pi-adapter.test.ts` 里"起了的调用与它拿没拿到超时都写下" ✓（并顺带断言**被拒绝的调用不留痕** ✓，用的是那个已有真实拒绝的用例 ✓）；`tests/execution-diagnostics.test.ts` 里"未返回 / 已返回 / 根本没起过"三种读法 ✓。

**参数没落盘** ✓✓：记录只带 `tool`、`toolCallId`、`commandDigest`（sha256 前 16 位 ✓）与 `commandLength` ✓，用例里断言**那条命令的名字不出现在写下的任何内容里** ✓。

## 两件计划没料到的 ✓✗✓（都记下来 ✓）

**① `harness-reachability` 那道门** **没有**抓到"闭集里有种类但没有写者" ✗✓✓。计划第 1 步要求"先看它红"，实测是：把写入者的 `kind:` 暂时改成另一个既有种类（于是**没有任何东西产出** `tool.started`），那道门**仍然是绿的** ✓ —— 因为 `record.kind === "tool.started"` 这种**比较点**也算"够得着" ✓。**AGENTS.md 那一行说的是"has a writer"，比它实际守住的要强** ✗✓。**本任务不改那道门** ✗（改它会动到别的行，属于另一个决定 ✓），**但这条读数得留着** ✓。

**② 那条白名单比它读起来更窄** ✗✓✓（**实测**，不是推断 ✓）：拿 `applyAdaptiveShellTimeout` 的正则逐个跑 ✓：

| 命令 | 结果 |
|---|---|
| `pytest -q` | **不匹配** ✗✓✓ |
| `python -m pytest -q` | **不匹配** ✗✓✓ |
| `pytest` / `pytest tests/…` / `python -m pytest tests/… -q` | 匹配 ✓ |
| `npm test` / `npm test -- --watch` / `npm run test` / `make test` / `make check` / `go test` / `cargo test` / `dotnet test` / `yarn test` | 匹配 ✓ |

→ 原因是 `pytest(?:\s|$)` **自己吃掉了那个空格** ✓，**紧跟着的 `\b` 就不成立了** ✓ —— 所以 **`pytest` 后面跟一个 flag 就不受保护** ✗✓✓，而跟一个路径就受保护 ✓。**这条不改** ✗（第 ① 条路已被否掉 ✓），**而它现在有读数兜着** ✓：调用会写下 `timeoutApplied: false` ✓，**不必再从正则去猜** ✓。

## 一条诚实的边界 ✓（不粉饰 ✓）

**`/status` 在挂死*当中*是读不到的** ✗ —— 宿主正被那条调用占着 ✓，命令根本没有机会跑 ✓。所以真正会用到这条读数的场合是**事后**：`doctor --json` ✓ 与 `agent_doctor` ✓ 读的是落盘的账本 ✓ —— **而那正是两次 field run 事后缺的东西** ✓✓（当时的读数只有"超时"两个字，看不到"卡在哪条调用上" ✓）。**"挂死可读"因此是事后可读** ✓，**它不让等待变短** ✓（`design.md` 里那句代价说的是同一件事 ✓）。
