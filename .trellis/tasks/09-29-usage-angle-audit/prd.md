# Dove Pi 使用视角审计：卡死路径与可观测性

## Goal

让一个真实使用者在自己被 fail-closed 关卡挡住时，能从那两个他本来就会敲的命令里看出来：**当前处于哪条 lane、
work mode 是否加载失败、上一次请求被哪个 gate 拒绝、上一次请求为什么终止**。

本阶段只加读者，不加写入点，不改任何 fail-closed 行为。

## Background

### 前提：运行时归属

Pi 的 agent loop 是唯一真正运行的 loop（`@earendil-works/pi-coding-agent@0.84.3`）。`src/core/loop.ts` 的 `AgentLoop`
及其两个实现都在 `tests/harness-reachability.test.ts` 的 ALLOW_LIST 上，即**没有任何入口可达**；Dove 在部署中是挂在
Pi 上的中间件，关卡职责由 `src/pi-adapter/extension.ts` 的 `tool_call` hook 承担。四个入口：
`src/cli.ts`、`src/pi-adapter/extension.ts`（Pi 唯一加载的）、`src/adapters/local-rpc.ts`、`src/adapters/mcp.ts`。

### 前提：本清单全部来自静态阅读

本工作区没有 `.dove/`，也没有 `~/.pi/agent/dove/workspaces/<hash>/`：**Dove Pi 从未在这个仓库真实运行过**。
所有结论来自代码、测试与文档阅读。这条限制决定了下面的"待验证"项的写法，也决定了置信度上限。

### 决策：只补可观测性（A）

被否的替代方案：
- **直接修 U1 的 block+abort**。要先设计"块住但不 abort"的形态；而没有本任务提供的度量，改完无法验证痛点是否解除。
- **两者合成一个任务**。行为变更与观测变更混在一个 commit，回归时不好定位。

### 已核实的现状基线（设计前提，不是待办）

**投影归属，spec 是诚实的**：`personal-agent-capability-runtime.md:110-118` 与
`personal-agent-extension-runtime.md:60` 只把执行诊断投影挂在 `agent_doctor` / CLI `doctor`（`requestDiagnostics`）/
RPC `diagnostics/status` 上，**从未声称 `/status full` 有它**。消费者：`src/adapters/local-rpc.ts:47-48`、
`src/cli.ts:72`、`src/pi-adapter/extension.ts:1858`。

**产出投影的函数**：`src/core/execution-ledger.ts:130-148`。`strategy` 取自**最后一条带 `details.strategy` 的
`request.planned`**（`:137`）并合并最后一条 `task.convergence.observed` 的资源字段（`:139-141`）；
`lastTerminal` 是完整 envelope（`:16-25`、`:187+`）；按 `sessionId`/`requestId` 过滤已支持（`:179-185`）。

**`/status` 的现状**：`src/pi-adapter/extension.ts:1147-1186` 输出
`workspace / lens / mode / thinking policy / toolProfile / hashline / operation / progress / Cache`；
`full` 分支额外 `await ledger.read()` → `inspectGoalEfficiency`（`:1159`）与 `formatStrategySnapshot(strategy)`。
`formatStrategySnapshot`（`src/core/strategy-snapshot.ts`）印 `strategy=<intent>/<lane>|idle` 与 `terminal=<code>|none`。

**"请求结束后 lane 读成 idle"的根因**：`currentStrategySnapshot` 从闭包内 `currentRequestPlan` 取 `intent/lane`（`:973`），
而 `currentRequestPlan` 在 `agent_settled` 被清空（`:2478-2490`）；同一个函数里 `terminal` 走
`requestLifecycle.terminalHistory()` 且带"无活跃请求就取最后一条"的兜底（`:1005`）。**同一个函数，一条有兜底一条没有。**

**work mode 状态的位置**：`activeWorkMode` / `modeRefusal` / `activeActionPolicy` / `activeEffectBoundary` 是
`personalAgentExtension` 的闭包局部变量（`:742-748`、`:2236-2252`）；命令 handler 与它们同域 → **零新 producer**。
`modeRefusal` 非空时 `tool_call` 最前就 block（`:2564-2566`）。

**约束**：`tests/pi-adapter.test.ts:225` 对命令列表做精确 `deepEqual`（本任务**不加命令**）；
`tests/spec-context-budget.test.ts` 要求每个 routed spec ≤ 24576b 规范化字节且 `## ` 标题集合精确相等
（`personal-agent-capability-runtime.md` 现值 22315b，**余量 2261b**；`personal-agent-extension-runtime.md` 15293b）；
`tests/document-drift.test.ts:32-34` 自陈它"只检查名字能解析，不检查句子仍为真"，`:373` 检查两份 README 形态一致；
`quality-guidelines.md` 禁止写"代码所声明的数量"。

## Requirements

每条挂一个使用视角的严重度与触发它的证据。R1–R5 是本任务的交付；其余是同源发现，出范围但保留在此。

**R1（对应 U2，P0）— `/status full` 在无活跃请求时仍能显示上一次请求的 intent/lane。**
根因与证据见上（`extension.ts:973` vs `:1005`；清除点在 `:2478-2490`）。做法：新增 `lastPlan=<intent>/<lane>@<requestId>`，
数据取 `projectExecutionDiagnostics(...).strategy`；**保留** live `strategy=` 不动。

**R2（对应 U1 与 U2 的"被哪个关卡拒绝"，P0）— 上一次请求被拒的 gate 必须能被用户看到。**
触发路径：`extension.ts:2600-2635`，formal lane 下 `write/edit/...` 在 convergence 为 `missing` 时写
`task.convergence.decision(product_mutation.blocked)`、返回 `{block:true, terminate:true}` 并调 `ctx.abort()`（`:2633-2635`）；
`terminate` 只是提示，宿主契约见
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:809-812`，真正结束请求的是 `abort()`（同文件 `:237-238`）。
成因低门槛：lane 由正则判（`src/core/request-plan.ts:228`、`:70`），而 `projectAvailable` 在
`extension.ts:3085` 硬编码 `true` → **任何目录**都能进 formal lane。
**现状**：`gate.refused`（`src/core/execution-ledger.ts:533-534`，带 `tool/action/gate/reason/remediation` 与 `requestId`）
**四个消费者一个都不显示**。做法：给 `ExecutionDiagnosticsProjection` 加**一个可选** `lastRefusals`，
使 RPC / `doctor` / `agent_doctor` / `/status full` 同时获得，避免制造新的 headless↔interactive 分叉。

**R3（对应 U7，P2）— work mode 加载失败必须让用户在 `/status` 里看见。**
当 `modeRefusal` 非空时**每一次**工具调用都被拒（`extension.ts:2564-2566`），而告知只有 `:2247` 的一条一次性 error notify。
做法：`/status` 增 `workMode=<id>|none`；`modeRefusal` 非空时加 `modeRefused` 标记 + 原因首行；`/status full` 给全文。

**R4 — `/status full` 显示上一次终止的完整 envelope，而不是只有一个 code。**
`lastTerminal=<code>: <summary> → <nextAction>`，取 `diagnostics.lastTerminal.terminal`；该键缺席时**显式**打印
`lastTerminal=none`。**保留** live `terminal=<code>`，两者不一致本身是信息（刚 abort、尚未 settle）。

**R5 — "没有"与"没记录"不得混同。** 无拒绝时打印 `refused=none` 并注明原因，而不是静默省略。
这是本仓库反复出现的缺陷类别（"an unstated gap is the defect this project keeps finding"）。

**同源但出范围**（见 Out of Scope）：U3（P1，绕过 formal 闸门的唯一开关 `/dove-mode chat` 会同时丢掉全部项目上下文，
`extension.ts:1107-1123`、`:3121`）、U4（P1，`.dove/` 落在用户仓库且 Dove 自己不写忽略规则，写入点见
`src/project-provider/manifest.ts:7`、`native-state.ts:63`、`native-artifacts.ts:34`、`native-sessions.ts:37`、`lock.ts:9`、
`extension.ts:2244`；本仓库 `.gitignore` 的 `.dove/` 是作者手写）、U5（P1，intent/lane 由 12 条双语正则决定，
`explicitIntent` 存在但无用户侧入口，`src/core/request-plan.ts:216`）、U6（P2，`extension.ts:3085` 与 `:3011` 对
"项目是否可用"两套判断）、U8（P2，预算关口 abort，`extension.ts:3018-3040`）、U9（P2，progress guard 终止，
`extension.ts:2755-2775`）。

## Acceptance Criteria

- [ ] **AC-1** 请求已结束（无 active lease 且 `currentRequestPlan` 未定义）后运行 `/status full`，输出含上一次请求的
      `intent/lane`；仅当 ledger 里没有任何 `request.planned` 时该字段表示"无"。
- [ ] **AC-2** `/status full` 输出上一次请求被拒的 gate 行（`action` / `gate` / `reason`）；无拒绝时打印 `refused=none`。
- [ ] **AC-3** `/status` 恒含 `workMode=<id>|none`；`modeRefusal` 非空时含可辨识的拒绝标记与原因首行。
- [ ] **AC-4** `/status full` 在上一次 `request.terminal` 存在时打印其 `code` + `summary` + `nextAction`；缺席时打印 `lastTerminal=none`。
- [ ] **AC-5** 只读：`/status` 与 `/status full` 调用前后 ledger 行数相等；不新增任何 `ExecutionRecordKind`、不新增 writer。
- [ ] **AC-6** `projectExecutionDiagnostics([])` 仍返回 `schemaVersion: 1` 且**不含** `lastRefusals` 键（`tests/execution-diagnostics.test.ts:16` 保持绿）。
- [ ] **AC-7** `tests/pi-adapter.test.ts:225` 的命令列表断言一字未改（= 没有新增命令）。
- [ ] **AC-8** `npm run typecheck`、`npm test`、`npm run test:installer` 全绿；
      `tests/spec-context-budget.test.ts`、`tests/document-drift.test.ts`、`tests/harness-reachability.test.ts` 全绿。

## Technical Notes

- 数据只有两个来源：**闭包局部状态**（`activeWorkMode` / `modeRefusal` / `progressGuard.snapshot()` / `currentRequestPlan`）
  与**ledger 投影**（`projectExecutionDiagnostics`）。R1/R2/R4 全部由后者供给，R3 由前者供给。
- R1/R4/R2 复用 `/status full` 在 `:1159` 已有的那一次 `await ledger.read()` → **零额外 I/O**。
- `ExecutionDiagnosticsProjection.schemaVersion` **保持 1**：新字段可选、additive，旧读者忽略未知键（ledger 记录类型的既有规则）。
  代价：新读者无法区分"旧生产者"与"没有拒绝"，由 AC-2 的显式 `refused=none` 补偿。
- `remediation` **不进投影**：投影的既定规则是 bounded 且不回显任意 ledger 细节
  （`personal-agent-capability-runtime.md:113-114`），`remediation` 是长文案；用户靠 `reason` + README 表查下一步。
- `agent_doctor` **不新加** work mode 字段：模型已经在**每一次**被拒的 tool result 里拿到 `[Dove mode] <modeRefusal>`（`:2565`），
  缺这条信息的是**用户**，不是模型。它只通过 R2 顺带获得 `lastRefusals`（`:1858` 已在调用同一投影）。
- 文档面：两份 README 同步（`document-drift.test.ts:373` 查形态一致），并在 "Terminal causes and recovery" 表补
  `convergence-*` 行；另加一句说明 **work mode 拒绝不是 terminal**（它不产生 `request.terminal`）。两份 routed spec 同步，
  且**不得新增/删除 `## ` 标题**、capability-runtime 增量 **< 2261 字节**。
- 回滚不需要清理状态：没有新的持久化写入点。

## Out of Scope

- 修改任何 fail-closed 行为：U1 的 block/abort、U7 的 modeRefusal、U8 的预算 abort、U9 的 progress guard。
- U3（`/dove-mode chat` 的二元选择）、U4（`.dove/` 忽略规则）、U5（用户覆盖 intent）、U6（`projectAvailable` 不一致）。
- 接线 `src/core/failure-reading.ts`：它在 `tests/harness-reachability.test.ts` 的 ALLOW_LIST 上，理由已写明是**故意**
  不可达（"a reading the harness acted on would be a control"）；接线会与一条有理由的既定决策冲突，
  且人读的报告由 R2 的投影即可满足。
- 把 `src/core/loop.ts` 的 reference loop 接线；处理 `dispatcher.ts` / `dispatch-policy.ts` / `checkpoint.ts` 等不可达模块。
- `extensions/` 安装器与 release 流程。

## Deferred — 明确的后续项

- **U1 的待验证项**：被 abort 的那一轮，block reason 是否进入会话历史。若不进入，用户重试时模型没有这份记忆、
  会再次写、再次被杀——那才是"看起来坏了"的形态，也是 U1 的真实严重度。
  可在仓库内用现有 mock-Pi 宿主测试形态（`tests/host-work-mode.test.ts`）验证，不需要真跑。
  **不属于本任务**：本任务只保证这条拒绝可被用户与后续读者看见。
- **U1 端到端无测试**：全仓 grep `"Freeze stable acceptance criteria"` 只命中源码一行；`tests/pi-adapter.test.ts:65`
  只测该路径用到的纯函数 `isReadOnlyShellCommand`。补这条覆盖属于修 U1 的那个任务。
