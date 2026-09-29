# Design — Dove Pi 使用视角的可观测性补全

## 1. 问题的一句话

请求被 fail-closed 关卡中止或拒绝后，用户能看到的只有一条会滚走的 notify；他习惯性敲的 `/status` 不显示
work mode，`/status full` 在请求结束后把 `intent/lane` 读成 `idle`，而被哪个 gate 拒绝**四个消费者里一个都不显示**。

## 2. 事实基线（已核实，作为设计前提）

**投影的现状与归属**（spec 是诚实的，不要按"spec 漂移"来设计）：

- `personal-agent-capability-runtime.md:110-118`：`diagnostics/status` 返回 `schemaVersion: 1` + 可选 `lastTerminal` /
  `lastResourceObservation`；**Pi 的 `agent_doctor` 与 CLI `doctor`（`requestDiagnostics`）使用同一投影**。
- `personal-agent-extension-runtime.md:60`：措辞是 **`agent_doctor`**，不是 `/status full`。
- 消费者：`src/adapters/local-rpc.ts:47-48`、`src/cli.ts:72`、`src/pi-adapter/extension.ts:1858`（agent_doctor）。
  **`/status` 不在其中，也没有任何文档声称它在其中。**

**产出投影的函数**：`src/core/execution-ledger.ts:130-148`。
- `strategy` 取自**最后一条带 `details.strategy` 的 `request.planned`**（`:137`），再合并最后一条
  `task.convergence.observed` 的资源字段（`:139-141`）。按 `sessionId` 过滤已支持（`matchesDiagnosticsFilter`, `:179-185`）。
- `lastTerminal` 是完整 envelope：`reason / detail / policyAbort / terminal{origin,code,summary,retryable,nextAction}`（`:16-25`、`:187+`）。

**`/status` 与 `/status full` 的现状**（`src/pi-adapter/extension.ts:1147-1186`）：

- `/status`：`workspace / lens / mode / thinking policy / toolProfile / hashline / operation / progress / Cache`。逐项读的是
  `workspacePolicy`、`mode`、`thinkingPolicy`、`toolProfile`、`operation`、`progressGuard.snapshot()`、`inspectCacheDiagnostics`。
- `/status full` 额外：`await ledger.read()` 后 `inspectGoalEfficiency`（`:1159`）、`Strategy roles: …`、
  `formatStrategySnapshot(strategy)`、`Snapshot=<JSON>`。
- `formatStrategySnapshot`（`src/core/strategy-snapshot.ts`）印
  `strategy=<intent>/<lane>|idle mode=…(<source>) thinking=…(<source>) tools=…(<source>) activeTools=N providerRounds=u/l readOnly=u/h terminal=<code>|none`。
  **它不印 context 字段**；context 只出现在 `Snapshot=<JSON>` 里。
- `currentStrategySnapshot`（`extension.ts:963-1007`）从**闭包内的 `currentRequestPlan`** 取 `intent/lane`（`:973`），
  而 `terminal` 走 `requestLifecycle.terminalHistory()` 且带"无活跃请求就取最后一条"的兜底（`:1005`）。
  `currentRequestPlan` 在 `agent_settled` 被清空（`:2478-2490`）。
  → **这就是 `strategy=idle` 与 `terminal=<code>` 不对称的根因：同一个函数，一条有兜底一条没有。**

**work mode 的状态位置**：`activeWorkMode` / `modeRefusal` / `activeActionPolicy` / `activeEffectBoundary` 都是
`personalAgentExtension` 的**闭包局部变量**（`:742-748`、`:2236-2252`）。命令 handler 与它们同域 → **零新 producer**。
`modeRefusal` 非空时 `tool_call` 最前就 block（`:2564-2566`），告知只有 `:2247` 的一条 error notify。

**README 的真实状态**（`README.en.md:336-339`）：
"intent/lane, policy sources, active tool count, provider/read-only budgets, context and cache observations, and the latest terminal cause"
—— 除 `intent/lane`（请求结束后读 `idle`）外**全部为真**。所以这不是"文档漂移"，是**一个真实的读取缺陷**。

**约束**：
- `tests/pi-adapter.test.ts:225` 对命令列表做 `deepEqual` **精确断言** → 加命令要改它。本设计**不加命令**。
- `tests/document-drift.test.ts:32-34` 自陈边界："a check holds that a name resolves, never that the sentence around it is still true"。
  `:373` 检查 `README.md` 与 `README.en.md` 的**形态一致**（不是含义一致）→ 两份都要改。
- `quality-guidelines.md` 禁止 "A count of something the code declares" → 新增输出里**不要写"三类原因"这类计数**。
- `/status full` 已经在 `:1159` `await ledger.read()` → 复用这次读，**零额外 I/O**。

## 3. 设计决策

### D1 — 不改 `formatStrategySnapshot` 的输入，另加一条 `lastPlan=` 子句

**选**：`/status full` 保留现有 live `strategy=`，并新增 `lastPlan=<intent>/<lane>@<requestId>`，
数据来自 `projectExecutionDiagnostics(...).strategy`（即 ledger 里最后一次 `request.planned`）。

**否**：让 `currentStrategySnapshot` 在无活跃 plan 时回落到 ledger。
代价：`currentStrategySnapshot` 是**同步函数**，而 ledger 读是异步；改它要把 `extension.ts:963`、`:1165`、`:1863`、`:3268`
四处签名一起改成 async，并且让一个"当前策略"读取器承载"最后一次请求"的语义。

**理由**：live 与 last 是两个不同的事实，用两个字段各自命名比让一个字段两种含义更诚实 —— 这与本仓库
"state the consequence rather than discover it" 的写法一致。同时它修掉了不对称：请求结束后不再是 `strategy=idle` 而无解释。
若两者同时存在且不一致（例如刚 abort、尚未 settle），两个字段并列本身就是信息。

### D2 — 给 `ExecutionDiagnosticsProjection` 加**一个可选** `lastRefusals` 字段

**选**：新字段，形如 `readonly lastRefusals?: readonly ExecutionRefusalDiagnostic[]`，
元素带 `timestamp / requestId? / tool / action / gate / reason`；`remediation` **不进投影**（投影的既定规则是
"bounds terminal strings and never echoes arbitrary ledger details"，`capability-runtime.md:113-114`；
`remediation` 是长文案，且用户面已有 `reason` + README 表可查下一步）。

- 上限：按最近的 N 条（N 定为一个常量并在实现里命名，不写成散文里的计数）；没有则**省略键**，与
  `lastTerminal` 的既有约定一致（`extension-runtime.md:60`："the projection omits the key rather than setting it to `undefined`"）。
- `schemaVersion` **保持 1**：可选字段是 additive，旧读者忽略未知键 —— 这是 ledger 记录类型的既有 additive 规则。
  代价：新读者无法区分"旧生产者"与"没有拒绝"；这一条在 `/status full` 的输出里用显式 "none" 表达，见 D3。
- 一次改动同时让 RPC / `doctor` / `agent_doctor` / `/status full` 四者都拿到它，避免制造**新的** headless↔interactive 分叉
  （那正是本任务要修的缺陷类别）。

**否**：
- (a) 只在 `/status full` 里就地扫 ledger 行。最小 diff，但 headless（`doctor` / RPC）拿不到 → 制造新分叉。
- (b) 接上 `src/core/failure-reading.ts`（`readFailures`）。**明确不选**：它在 `tests/harness-reachability.test.ts` 的
  ALLOW_LIST 上，理由是"a reading, consumed by scripts/harness-failures.mts and its test; deliberately not reached by the
  harness ... a reading the harness acted on would be a control"。那是**故意**的不可达，接线会与一条有理由的既定决策冲突。
  人读的报告不需要它——D2 的投影足以。

### D3 — `/status`（非 full）加两个短字段，`/status full` 加一条诊断行

- `/status` 增：`workMode=<id>|none` 与 `modeRefused`（仅当 `modeRefusal` 非空时出现，并带原因首行）。
  理由：`modeRefusal` 非空时**每一次**工具调用都被拒（`:2564-2566`），而用户习惯敲的第一个命令就是 `/status`；
  这是"用户能否看出自己卡住"的核心。
- `/status full` 增一条：`lastPlan=<intent>/<lane>@<id>`、`lastTerminal=<code>: <summary> → <nextAction>`、
  `refused=<n>: action/gate/reason; …`（无拒绝时显式打印 `refused=none`）。
- `workMode` 的完整描述（`gateSemantics`、权限列表项数、`fence`、`sandbox`）放 `/status full`。
  **不写成计数**（`quality-guidelines.md` 禁止），改为列出 `never_allow`/`ask_before` 的成员或直接说 `unlisted=allow`。

### D4 — `agent_doctor` 不新加 work mode 字段

模型侧已经在**每一次**被拒的 tool result 里拿到 `[Dove mode] <modeRefusal>`（`:2565`），它不缺这条信息；
缺的是**用户**。为一个已经有该信息的消费者扩大 schema 是无谓的 diff。
`agent_doctor` 只通过 D2 **顺带**获得 `lastRefusals`（它已经调用同一个投影，`:1858`）。

### D5 — 文档面

- `README.md` + `README.en.md`：补 `/status` 与 `/status full` 的实际字段；在 "Terminal causes and recovery" 表里补两行 ——
  `convergence-*`（U1 的成因；现有表有 6 类，不含它）与 work-mode 拒绝（`modeRefusal` 不产生 `request.terminal`，
  要用文字说明它**不是** terminal）。两份必须形态一致（`document-drift.test.ts:373`）。
- `.trellis/spec/backend/personal-agent-capability-runtime.md`：`diagnostics/status` 那句里 `lastTerminal` /
  `lastResourceObservation` 之外**加上** `lastRefusals`，并说明它是 additiv 的可选字段。
- `.trellis/spec/backend/personal-agent-extension-runtime.md`：`:60` 的投影清单同步。

## 4. 数据流（改动后）

```
tool_call 拒绝 ──► ledger: gate.refused(action, gate, reason, remediation)   [已存在，不改]
                        │
agent_settled ──► ledger: request.terminal(terminal envelope)                [已存在，不改]
                        │
/status full ──► await ledger.read()  ──► projectExecutionDiagnostics(records, {sessionId})
   (复用 :1159 已有的那次读)                    │
                                               ├─ strategy         ──► lastPlan=<intent>/<lane>
                                               ├─ lastTerminal     ──► lastTerminal=<code>: summary → nextAction
                                               └─ lastRefusals ?   ──► refused=… | refused=none
   live: strategy=<…> / terminal=<code>  来自闭包内 currentRequestPlan + terminalHistory()（不改）
   workMode / modeRefused                来自闭包内 activeWorkMode / modeRefusal（不改）
```

**没有任何新的写入点。** 这是本设计的硬约束：只加读者，不加生产者。

## 5. 兼容与迁移

- `ExecutionDiagnosticsProjection.schemaVersion` 保持 `1`；新字段可选。`tests/execution-diagnostics.test.ts:16` 的空 ledger
  断言（`projectExecutionDiagnostics([])`）必须保持绿：空 ledger 下 `lastRefusals` 键**不出现**。
- `/status` 输出变长是**行为变更**（面向人的文本），但**不是策略变更**：不加权限、不改预算、不改 fail-closed 语义。
- 命令列表不变 → `tests/pi-adapter.test.ts:225` 不动。
- 无迁移：不读也不写新的持久化格式。

## 6. 权衡与回滚

- **权衡 A**：`lastPlan` 与 live `strategy` 并存会让人问"哪个是真的"。答案写在字段名里（`last` 前缀），
  并在 README 里明说：`strategy=` 是当前活跃请求，`lastPlan=` 是 ledger 里最后一次。不用一个字段两种含义换取简洁。
- **权衡 B**：`remediation` 不进投影，用户看到 `reason` 但没有那一步操作建议。代价是用户要多读 README 表一格；
  收益是投影保持"不回显任意 ledger 细节"的既定规则。
- **回滚**：单文件级别的加法。回滚 = 撤销 `lastRefusals` 投影字段与两处输出拼接；
  没有数据写入，所以**没有需要清理的状态**。这也是选择"只加读者"的一个理由。

## 7. 已知不做

- U1 的 block+abort 行为、U7 的 modeRefusal 行为、U8 的预算 abort、U9 的 progress guard —— 全部留给后续任务。
- U3（`/dove-mode chat` 的二元选择）、U4（`.dove/` 忽略规则）、U5（用户覆盖 intent）、U6（`projectAvailable` 不一致）。
- 接线 `src/core/failure-reading.ts`（见 D2-b）。
