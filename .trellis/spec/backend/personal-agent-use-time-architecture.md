# Personal Agent Use-Time Architecture

**这一页回答一个问题**：一个人真的在用这个 harness 时，**谁在什么时候被调用**。它是"用户视角"的入口——源码怎么分层见 [`directory-structure.md`](./directory-structure.md)，所有权契约见 [`personal-agent-framework-core.md`](./personal-agent-framework-core.md)，一回合怎么做见 [`../guides/harness-loop-turn.md`](../guides/harness-loop-turn.md)。

**纪律**：下面每一条都是**现在就有**的行为，各带 `file:line`。axi 会改的那一格在 §7 **标为未实现**——本页不声明做不到的能力。

## 1. 谁拥有 loop

| 角色 | 谁 | 证据 |
|---|---|---|
| **loop 的拥有者** | **Pi 宿主**：它跑"调模型 → 跑工具 → 重复"，并拥有会话、TUI 与 provider 通道 | 扩展里只有 **18 个 `pi.on(...)`**、没有循环本体（`src/pi-adapter/extension.ts:2111`–`:3388`） |
| loop 的**契约** | `src/core/loop.ts`（263 行，**全是 `interface` / `type`**：`ActionGate`、`GateInvocation`、`GateDecision`、`AgentLoop`） | `src/core/loop.ts:167`、`:173`、`:261`、`:262` |
| loop 的**参照实现**（今天没人到达它） | `src/core/loop-runner.ts` | `tests/harness-reachability.test.ts` 的登记写着 *"nothing reaches this module"* |

**为什么这一节在最前面**：一个自我改进的 harness 的安全叙事，全押在"**每个动作都过闸门**"这句话上。**今天这句话由宿主调用我们的 hook 保证**（§3），不是由我们自己的派发路径保证。

## 2. 十八个挂载点

分五组：装配 · 请求边界 · 工具边界 · 证据 · 会话边界。

| 事件 | 行 | 它在那时候做什么 |
|---|---|---|
| `session_start` | `:2148` | **装配一次会话**：武装心跳定时器（`SessionKeepaliveTimer`，`:29`）、开账本（`:898` `new ExecutionLedger(join(stateDir, "execution.jsonl"))`）、解析模式与授权（`loadWorkModeFromDirectory`、`preflightAuthority`，`:66–67`）、**组成动作策略** `createActionPolicy`（`:2265`；会话边界处 `:2262` 清空） |
| `input` | `:2111` | 用户输入先进请求生命周期（`requestLifecycle.acceptSubmission`），再决定是否受理 |
| `before_agent_start` | `:3151` | 开一次请求租约（`requestLifecycle.beginRequest`），定下这一轮的请求计划 |
| `agent_start` | `:2325` | 起一次**尝试**（`startAttempt`，带触发原因：首次 / 重试 / 压缩后重试） |
| `turn_start` | `:2612` | 开一次工具批次（`progressGuard.beginToolBatch()`） |
| `tool_call` | `:2616` | **闸门**——见 §3 |
| `tool_result` | `:2864` | 把"这个效果真的发生了"记下来（`pendingEffects` → 效果边界） |
| `message_end` | `:2949` | 只处理 assistant 消息：停止原因与用量 |
| `before_provider_headers` | `:3028` | 会话亲和（`DOVE_PI_DISABLE_SESSION_AFFINITY=1` 可关） |
| `before_provider_request` | `:3040` | 心跳观察（每次 provider 调用都计数）、按模型窗口做预算（`model-gateway`）、必要时造请求计划 |
| `after_provider_response` | `:3142` | 记 HTTP 状态；≥400 归类失败（`classifyProviderFailure`） |
| `thinking_level_select` | `:3009` | **只在策略为 `off`（全手动）时**把用户选定的档写回默认基线 |
| `context` | `:3388` | 每次 provider 请求前变换上下文：清掉遗留条目与过期指引，保留真快照与顺序 |
| `session_before_compact` | `:2546` | **唯一仍被拒绝的重放路径**：压缩把周围上下文换成摘要，模型"这个工具已经跑过"的记录因此变弱 |
| `session_compact` | `:2560` | 压缩后若会重试，标记触发原因 `compaction-retry` |
| `agent_end` | `:2344` | 收进度守护（`progressGuard.end()`）、把中断投影进请求状态、取最后一条 assistant 消息 |
| `agent_settled` | `:2511` | **只用状态快照、不读回调 ctx**——因为 `agent_end` 可能 abort 并重载会话，读 ctx 会触发 Pi 的 "stale ctx" 并掩盖真正的终态记录 |
| `session_shutdown` | `:2564` | 拆掉心跳定时器（**一条调用方义务**：活得比会话久的定时器会报进下一个会话，比冷缓存更糟） |

## 3. 闸门的执行点（今天）

**位置**：`pi.on("tool_call")`（`src/pi-adapter/extension.ts:2616`）的体内。

1. **模式检查在最前**，**在租约检查之前**——模式加载失败必须拦住动作，即使请求记账还没建好（`:2617`–`:2620`）。
2. **先跑"只看名字"的那一半**：`resolveActionIdentity(event.toolName, event.input)` → `activeActionPolicy.denyDecision(identity.action)`（`:2624`–`:2628`）。这里是**故意**的：权限表**基于名字**，所以该判定**不会被处理器后面发生的参数改动作废**。
3. 判为 `block` 时：写 `ledger.appendGateRefused({ taskId, stepId: "gate:<toolCallId>", mode, tool, action, … })`，然后 **`return { block: true, reason: "[Dove mode …] …\nDo this instead: …" }`**（`:2632` 起）——**这是真拦**，而且拒绝时**带确定性补救**。
4. **读参数的那一半**在输入定稿之后才跑（`:2626`–`:2628` 的注释）。

**诚实的边界**：这条路经是**宿主**在每次工具调用时调我们。"每个动作都过闸门"由宿主的调用行为保证；`core/loop.ts:160` 那条契约（`ActionGate.evaluate` 对**每一个**提议的动作都被调用，包括会被挡下的）今天由**测试与宿主**共同支撑。

## 4. 进程边界

| 谁 | 在哪 | 证据 |
|---|---|---|
| Pi 宿主 + 扩展 | **主进程** | 扩展是宿主里的注册 |
| 工具（shell / PowerShell / 文件） | **子进程**，由宿主起 | 宿主边界就是 `tool_call` / `tool_result` 两个事件 |
| 子代理 | **真子进程**（`spawn`） | `src/pi-adapter/subagent-provider.ts:1`（`import { spawn } from "node:child_process"`）、`resolvePiChildCommand`（`:60`） |
| 工作区改动 | 主进程内的**事务**：快照 / 补丁 / 回滚 | `src/windows-runtime/workspace.ts`（`createWorkspaceSnapshot`、`applyWorkspacePatch`、`restoreWorkspaceSnapshot`、`verifyWorkspaceSnapshot`） |
| 跨进程的变更互斥 | **项目变更锁** `withProjectMutationLock` | `src/project-provider/lock.ts`（50 行，只依赖 node 内建）。**注意**：这是本仓唯一一处**反向依赖**（core 反过来 import 它） |

## 5. 信任分级

| 角色 | 可信吗 | 为什么 |
|---|---|---|
| 外部模型 | **不可信** | 提示注入；伪造工具调用是已测的失败模式 |
| agent 的回合脚本、工具参数 | **不可信** | 名字级规避实测 98% 尝试 / 88% 成功——而且是"想把任务做完"的副产品 |
| **工具层强制（今天）** | **半可信** | 策略源在会话内（模式是会话级的，agent 改不了自己 ✓），但**执行点是宿主的 hook**（§3） |
| 人 | **权威** | 给模式、给授权文档、在权限边界类改动上批 |
| **Plane B（axi）** | **权威，且必须在 agent 够不到的地方** | **未实现**——见 §7 |

## 6. 证据落盘与跨会话

| 记什么 | 落在哪 | 锚点 |
|---|---|---|
| 执行账本（append-only） | `<stateDir>/execution.jsonl` | `src/pi-adapter/extension.ts:898`；状态目录经 `resolveDoveStateDir` 解析（`:42`） |
| 效果 / exactly-once | 效果存储 + 未决声明 | `extension.ts:65`（`createFileEffectStore`、`listUnresolvedClaims`） |
| 会话级上下文快照 | 最近一次快照可恢复 | `extension.ts:44`（`restoreLatestContextSnapshot`） |
| 正式任务的收敛记录 | `<projectRoot>/.dove/tasks/<id>/convergence.json` | `src/project-provider/native-artifacts.ts:46` |
| 这些记录的**读者** | `scripts/harness-*.mts` 与它们的测试 | 一回合怎么走见 `../guides/harness-loop-turn.md` |

## 7. 两处空白，与 axi 要改的那一格

1. **本仓不存在 `.dove/`** → **本仓从没跑过一轮正式任务的收敛记录**。"记录只报告、人决定"这条线目前是"**从没跑过**"，不是"跑通了"（`../guides/harness-loop-turn.md:11` 的先决条件表就写着这一条）。
2. **DSH 侧的工具层策略是会话级**（策略源在会话内）——**半可信**，不是权威。

**axi 要改的那一格（未实现，指向 `.trellis/tasks/09-30-axi-program/plan-v8.md`）**：让 **loop 归自己**（闸门落在派发路径上，而不再挂在宿主的 hook 上），并让 **Plane B** 成为 agent 够不到的判分权威——强制形态是 ACL + 受限令牌，**受限子进程由 jailer 起、绝不由 improver 自己起**。今天这一格**没有实现**，所以本页不声明它。

## 怎么核对本页

- 每条运行期断言都带 `file:line`；`§2` 的行号是 `pi.on(...)` 的**声明行**。
- 结构约束由两个既有测试看着：[`spec-context-budget`](../../../tests/spec-context-budget.test.ts)（route 存在、预算、router 只放路由结构）与 [`document-drift`](../../../tests/document-drift.test.ts)（index 列出该目录的每一个规格）。
- 本页只写现状。**当某一格从"未实现"变成"实现"时，改这一页，而不是加一句脚注。**
