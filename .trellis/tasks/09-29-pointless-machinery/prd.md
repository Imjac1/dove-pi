# Pointless machinery: what Dove re-implements, and what Pi already does

## Goal

拿**量过的 Pi 能力**与**别人怎么做**当基准，把这个仓库里"为了绕过一个已经提供的东西、或者已经不再回本"的机制点名
—— 每条带出处、带代价，并明确区分**该删的**、**该留的**、**该重做的**。

用户价值：这个仓库机制密度很高（3652 行的 `extension.ts`、10 份 routed spec、两份 26 KB README、
一套自带 fail-closed 的重试策略）。密度本身不是问题，**不划算的密度**是。这份审查给判断依据，
而不是"我觉得太复杂"。

## Background

### A. Pi 到底提供了什么（读 vendored 包装得到，`node_modules/@earendil-works/`）

| # | 事实 | 证据 |
|---|---|---|
| P1 | 内置工具：`bash`、`PowerShell`、`read`、`write`、`edit`、`grep`、`find`、`ls`。**shell 各只有一个通用工具，没有只读变体** | 包内 `name: "bash"` / `name: "PowerShell"` 等定义 |
| P2 | 扩展事件共 **30 个**：`tool_call`、`tool_execution_start/update/end`、`tool_result`、`turn_start/end`、`agent_start/end/settled`、`before_agent_start`、`before_provider_request`、`before_provider_headers`、`after_provider_response`、`message_*`、`session_*`、`context`、`input`、`model_select`、`thinking_level_select`、`resources_discover`、`user_bash` | 包内 `on(event: "...", handler: ExtensionHandler<...>)` |
| P3 | **没有 permission / approval 事件。** Pi 只给一条 `tool_call` 钩子，可返回 `{block:true, terminate:true}` | P2 清单里无任何 `permission`/`approve`/`authorize` |
| P4 | **没有任何 read-only / idempotent / sideEffect 的工具元数据** | 包内未找到此类字段 |
| P5 | 有一个 **`user_bash`** 事件（用户在 `!` shell 模式里自己打的命令）—— 与 Dove 的只读判定是**另一条路径** | P2 |
| P6 | Pi 的 agent-turn 自动重试默认**开**：`maxRetries=3`、`baseDelayMs=2000`（指数退避）。判定只看设置 + 最后一条 assistant 消息的 `errorMessage`，**从不看工具是否执行过** | `pi-coding-agent/dist/core/settings-manager.js:581-597`、`agent-session.js:761-785`、`2173-2178`、`2211-2256` |
| P7 | **Pi 的重试不重跑工具**：它实现为 `agent.continue()` —— 先把失败的那条 assistant 消息从 transcript 里切掉，再带着**已含 `toolResult` 的** transcript 重发 provider 请求。**不是**重发 prompt | `agent-session.js:2231-2234`、`:747-760`；`pi-agent-core/dist/agent.d.ts:110-111` |
| P8 | Pi 的 `pi-agent-core` 里**已经设计**了这件事：`HarnessTool.replay?: "never" \| "safe"`、逐次调用持久化的 `ToolStartedRecord`（含 `toolCallId`/`effectiveArgs`/`replay`）、以及**已实现的**记录日志 reducer（能识别 `duplicate_tool_invocation`、`tool_call_mismatch`）—— **但 `AgentHarness` 是 stub**，每个方法都抛 `HarnessNotImplemented`，`agent-harness.js` 里根本没有 `replay` 的引用 | `pi-agent-core/dist/harness/agent-harness.d.ts:312-314`、`session/types.d.ts:121-133`、`reducer.d.ts:11/36-47`；`agent-harness.js` 全文 |
| P9 | Pi 自己有一个**只读工具集**工厂：`createReadOnlyTools` → `[read, grep, find, ls]` —— **与 Dove 白名单的前四项逐字相同**。它在 Pi 内部**从未被调用**，是给消费者用的辅助 | `pi-coding-agent/dist/core/tools/index.js:81-88`、`:109-116` |
| P10 | Pi **没有**把操作者配置复制进隔离目录的辅助函数；官方机制是重定向（`PI_CODING_AGENT_DIR` / `createAgentSession({agentDir})`） | `config.js:420-461`、`sdk.js:70-71` |

**P7 是要紧的一条，而且它反过来质疑 Dove 的一处前提。** Dove 拒绝在非幂等效果之后重放 provider 失败，理由是
"重放整个请求可能把副作用做第二遍"。但如果 Pi 的重试是**带着已有 toolResult 续跑**而不是重发 prompt，
那么**这个"做第二遍"在 Pi 的重试层根本不会发生**。
（**可信度**：P7 是**读代码得出**的，研究方明确标注"未经运行验证，也没有文档或测试明说"。所以它是一条**待证前提**，
不是结论 —— 方案里必须带一个实验去证实或推翻它。）

**从 P3/P4 得出的关键结论：Dove 在 `tool_call` 上做的闸门与幂等判定，不是在重复 Pi —— Pi 没有这个能力。**
这句必须先说清楚，否则整份审查会被读成"删代码清单"。

### B. 别人怎么做（社区与既有产品）

| # | 事实 | 出处 |
|---|---|---|
| C1 | **Claude Code 的答案是操作系统级沙箱，不是字符串分类**："Instead of approving each command, you define which files and network domains commands can touch, and **the operating system enforces that boundary**"（macOS Seatbelt；Linux/WSL2 用 bubblewrap + socat + 可选 seccomp） | <https://code.claude.com/docs/en/sandboxing> |
| C2 | Claude Code 的沙箱**不支持原生 Windows**："Native Windows is not supported. On Windows, run Claude Code inside a WSL2 distribution." | 同上 |
| C3 | Claude Code 仍有分类器，但它决定**何时问**，边界由沙箱兜底；另有 `dangerouslyDisableSandbox` 逃生门，且已有公开的绕过分析 | 同上、<https://www.penligent.ai/hackinglabs/claude-code-sandbox-bypass/> |
| C4 | **Codex 把问题拆成两条正交轴**：`sandbox mode`（技术边界：能写哪里、能否联网）与 `approval policy`（何时必须问）。`--sandbox read-only` 用于纯聊天/规划 | <https://learn.chatgpt.com/docs/agent-approvals-security> |
| C5 | Codex 对非 shell 的副作用调用靠**工具自己声明副作用**（"tool calls that advertise side effects"） | 同上 |
| C6 | "Agent frameworks retry at the LLM layer... **Nothing in this loop tracks whether the tool already executed its side effects. This doesn't work.**" | <https://tianpan.co/blog/2026/04/19/idempotency-agentic-tool-calling-saga-deduplication> |
| C7 | "**state machines are more reliable than intent**... Replace reasoning about past actions with **records of past actions**"；错误响应应带显式 `retryable: true/false`、`retry_after_seconds` | 同上 |
| C8 | 生产做法收敛为 **at-least-once 投递 + 幂等执行** ≈ exactly-once 效果；多步用 saga/补偿，且"a compensation that logs 'manual review required' is better than no compensation at all" | 同上 |
| C9 | 只读字符串白名单可被绕过是**已知**问题类别 | 本会话实测，见 R3 |

**C1/C4 对 Dove 的含义**：业界把"这条 shell 命令安全吗"交给**沙箱**回答；而 C2 说这条路在原生 Windows 上不通，
本仓库恰好是 Windows-first。所以"照抄沙箱"**不是免费的** —— 这一点必须在方案里如实标出。

### C. 查出的可疑机制

| # | 机制 | 为什么可疑 | 出处 |
|---|---|---|---|
| **R0** | **Dove 的 fail-closed 重试拒绝，可能是在防一件不会发生的事。** 拒绝的前提是"重放会把副作用做第二遍"；而 P7 说 Pi 的重试是带着已有 `toolResult` 续跑，**不重跑工具**。若这条成立，那么"拒绝重试"换来的是**可用性损失**（一次 503 打死只读会话，本会话实测两次）而**不是**安全收益 —— 而且 Dove 还得在 `message_end` 里把 `stopReason` 改成 `aborted` 去**打断 Pi 本来无害的重试** | 两次真实会话都以 `retry-refused-after-effect` 结束；Dove 侧 `request-lifecycle.ts:260`；Pi 侧 P6/P7 | 
| **R1** | `/status full` 里的 `Snapshot=${JSON.stringify(strategy)}` | 它打印的**正是刚从 ledger 读出来的同一份数据**（`request.planned.details.strategy`），却塞进一条**有 2048 字符上限**的通知 —— 撑爆界、挤掉只存在于这条消息里的三个字段。**D1 当初修的是症状（挪顺序），病因是它本来就不该出现在那儿** | `extension.ts:1277` 拼接；`execution-ledger.ts:508` 写入、`:159` 读回 |
| **R2** | provider-round "budget" | 一张预算表 + 一条 chat→lookup 升级规则 + **两个**计数器 + 一个 warning 标志，全部产出一条**明说"这不是硬限制、会继续"**的通知，外加 `/status` 一行 `used/limit`。它不中止任何东西；真正会终止循环的是语义重复守卫 —— **两个守卫盯同一个现象** | `extension.ts:3078`、`:3087-3091`、`:3533`；注释自述 "provider rounds are never a transport or stop limit" |
| **R3** | **同一问题两套默认，而且相反**：冻结闸门用 `isReadOnlyShellCommand`（**看命令文本**）加 `FORMAL_PRODUCT_MUTATION_TOOLS`（看名字）；重试安全用 `isPiToolInvocationIdempotent`（**只看名字**）；而**最可靠的那份**（effect store 的 claim + outcome，正是 C7 说的 "records of past actions"）**只有加载 work mode 才存在** | 见下方"R3 实测"：`isReadOnlyShellCommand` 把三个会改东西的命令判成只读；更要紧的是**未知工具在两边拿到相反的默认** | `extension.ts:257`、`:252`、`:3015`；`effect-store-file.ts` |
| **R4** | `listUnresolvedClaims` | 本会话新增，**零测试**，且只在"加载了 work mode **且** 重试被拒"这一条路上可达 —— 我当初只测了 no-work-mode 那一支。**一份为 C7 式记录写的读取器，没有任何测试证明它读得对** | `effect-store-file.ts:69`、`extension.ts:857`；`tests/` 里 0 命中 |
| **R5** | 两份 26 KB README 靠手工同步 | `frontDoorDrift` **只比对计数**（标题数 / 围栏次数 / 表格行数），**含义漂移完全放过**。重流程 + 弱保证：维护两份的成本是真的，保证是假的 | `document-drift.test.ts:362-371` |

### D. 查过但**不是**问题（同样重要）

| 项 | 结论 |
|---|---|
| Dove 的 `tool_call` 闸门 | **不是**重复 Pi —— Pi 没有 permission 模型（P3/P4） |
| `carriedConfig` 把 3 个配置文件带进隔离目录 | **必要** —— 没有它，真实 provider 运行结构上不可行 |
| `currentRequestProviderRounds` 的两处递增（`:2990`、`:3083`） | **互斥**：一处是 `onPayload` 预检（常规 provider），一处是直接实现 `streamSimple` 的自定义 provider 兜底，以 `!currentProviderCall` 分开。**必要的复杂度** |
| `models-store.json`（2 字节 `{}`） | **是 Pi 自己的文件**（包内有 `models-store.js`），不是死配置 |
| fail-closed 的重试拒绝本身 | **与社区一致**（C6/C8 的 at-most-once 选择）。弱的是它的**输入**（静态名字白名单），不是这个决定 |

### E. R3 实测：两边对同一个未知工具给出相反的默认

把两个判定的条件并排跑（`FORMAL_PRODUCT_MUTATION_TOOLS.has(name) || (shell && !isReadOnlyShellCommand(...))`
对 `isPiToolInvocationIdempotent(...)`）：

```text
tool                     freeze gate          replay-safe?
read                     not a mutation       yes
write                    MUTATION             NO (refuses replay)
bash (git status)        not a mutation       NO (refuses replay)   <- 有意的不对称（命令文本 vs 工具名）
bash (rm -rf build)      MUTATION             NO (refuses replay)
agent_workspace_patch    MUTATION             NO (refuses replay)
third_party_unknown      not a mutation       NO (refuses replay)   <- 相反的默认
mcp_some_server_write    not a mutation       NO (refuses replay)   <- 相反的默认
```

后两行是要紧的：一个**未知工具**（甚至名字里就写着 `write` 的 MCP 工具）被冻结闸门当作**不是产品改动**
（于是在 acceptance 冻结之前可以跑），却被重试策略当作**不可重放**。
**同一件未知的事实，两边取了相反的默认。**

仓库自己的哲学是 fail-closed（`personal-agent-mode-format.md:9`：「Every contract below fails closed:
an unevaluable condition is a refusal at load or a block at the boundary, never a pass」）。
按这条，**冻结闸门对未知工具放行**是那个不一致的默认。
但也要如实记下：`extension.ts:2716-2718` 有一段明确的立场——convergence 闸门「must not become a second Pi tool
permission firewall」。所以这可能是**有意**的：闸门管的是正式任务的工作流，不是安全边界。
**这正是需要用户裁决的那一点**（见 Open Questions）。



## Requirements

### Rq0 — 先回答"拒绝重试到底有没有安全收益"

R0 是这次审查里唯一**可能改变安全语义**的一条，因此它**必须先被实验判定**，不允许靠读代码采信（P7 未经运行验证）。
两个分支的处置见 `design.md` §2。

### Rq1 — 每条可疑机制判成"删 / 留 / 重做"，并给出依据

判据来自 A（Pi 实际提供什么）与 B（别人怎么做），不是"看起来复杂"。每条要有：**代价**（它消耗什么）、
**替代**（删掉/换掉之后靠什么）、**不做的风险**。

### Rq2 — 明确指出哪一条**不能**照抄社区

C1/C4 的沙箱路线在**原生 Windows 上不存在**（C2），而本仓库 Windows-first。
"照别人那样上沙箱"必须标成**不可直接移植**，并给出该约束下的替代方向。

### Rq3 — 不许把"有意的复杂度"报成冗余

D 组每条要在交付物里**显式点名并说明为什么留**。

## Acceptance Criteria

- [ ] **AC-0（Rq0）** R0 的实验**跑了**，产物（命令 + 读数）记进 `implement.md`，分支已判定；
      分支 A 下 retry 契约与代码**同时**改、且新断言在改前会红；分支 B 下**证伪结论**写进契约。
- [ ] **AC-1（Rq1）** R0–R5 每条都有一条**可复现的**证据（命令或 `file:line`），不是叙述。
- [ ] **AC-2（Rq1）** 每条给出**处置**（删 / 留 / 重做）与**代价**，且与 A/B 组证据对得上。
- [ ] **AC-3（Rq2）** 沙箱路线被显式标注为**在原生 Windows 不可用**，并给出替代方向。
- [ ] **AC-4（Rq3）** D 组每条被显式写为"留，因为……"（该组共 5 条）。
- [ ] **AC-5** 至少一条结论**当场可验证**（例如并排跑两个判定，看到未知工具的相反默认；或看到那三个假阳性）。
- [ ] **AC-6（R3）** R3 的行为等价性**有证据**：两张表合并前后逐项对照；`unknown` 的两个不同默认**各有一条断言**。
- [ ] **AC-7** 门禁不下降（`811/809/0/2`；installer 0 失败）；**不新增运行时持久化格式**。

## Out of Scope（初步）

- 引入沙箱（C2：原生 Windows 不支持）。
- 改变 at-most-once 的重试立场（C6/C8 支持它）。
- Pi 自身重试行为的考据（P6 未确证；若结论影响某条判定，再回到本 PRD）。

## 已决定

- **D-A（= C）**：本任务 = 审查（R0–R5 逐条证据与处置）+ 修掉便宜无争议的几条
  （R1 删重复的 `Snapshot=`、R4 随 R0 结果补测或删、R5 把一致性检查从数数升级为比命令）
  + **重做 R3**（把"改动 / 幂等"的判定收到一处）。
  **并且 R0 的实验排在第一位** —— 它决定 R0 是"安全机制"还是"纯成本"。
- **D-B（= B）**：冻结闸门对**未知工具保持放行，但不再静默**：未知工具被点名（记录 + 通知），
  两个默认的差异写在一处并加断言。**不**把工作流闸门变成安全边界（`extension.ts:2716-2718` 的立场）。

## Open Questions

（无。阻塞项已清空。）

