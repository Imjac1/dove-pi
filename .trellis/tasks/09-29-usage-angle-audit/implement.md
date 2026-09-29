# Implement — 使用视角的可观测性补全

## 前置事实（改动前必读，都是量过的）

| 事实 | 值 | 为什么重要 |
|---|---|---|
| `personal-agent-capability-runtime.md` 规范化字节 | 22315b / 上限 24576b | **余量 2261b**。改动必须小于它，否则 `spec-context-budget.test.ts` 红 |
| `personal-agent-extension-runtime.md` 规范化字节 | 15293b / 上限 24576b | 余量 9283b |
| `personal-agent-runtime.md`（router） | 4039b / 上限 8192b | 本任务**不改 router** |
| `tests/spec-context-budget.test.ts` 还断言每个 spec 的 `## ` 标题**精确相等** | — | 两份 spec 里**不得新增/删除 `## ` 标题**，只能改正文 |
| `tests/pi-adapter.test.ts:225` 命令列表 `deepEqual` | — | 本任务**不加命令**，该断言不动 |
| `/status full` 已在 `extension.ts:1159` `await ledger.read()` | — | 新的诊断行**复用这次读，零额外 I/O** |

## 执行清单（按依赖顺序）

### 1. 投影加一个可选字段（`src/core/execution-ledger.ts`）

- 在 `ExecutionDiagnosticsFilter` / `ExecutionDiagnosticsProjection` 附近新增
  `export interface ExecutionRefusalDiagnostic { timestamp; requestId?; tool; action; gate; reason }`。
- 给 `ExecutionDiagnosticsProjection` 加 `readonly lastRefusals?: readonly ExecutionRefusalDiagnostic[]`。
  **`schemaVersion` 保持 `1`**（可选字段 additive）。
- 在 `projectExecutionDiagnostics`（`:130-148`）里：从 `records.filter(kind === "gate.refused")` 取**最后 N 条**，
  N 用**一个具名常量**（例如 `MAX_LAST_REFUSALS`）。**没有拒绝时省略键**，不要写 `[]`——
  与 `lastTerminal` 的既有约定一致（`personal-agent-extension-runtime.md:60`）。
- `reason` 要**有界**（截断到固定长度），并在字段名/注释里说明；**不要带 `remediation`**（见 design D2）。
- 复用既有的 `matchesDiagnosticsFilter`（`:179-185`），不要新写一套过滤。

**验证**：`node --import tsx --test tests/execution-diagnostics.test.ts`

### 2. 测试：投影的新字段（`tests/execution-diagnostics.test.ts`）

必须有的用例（每条都对应 design 里的一条决策）：

- 空 ledger → 投影**没有** `lastRefusals` 键（沿用 `:16` 的既有形态）。
- 有 `gate.refused` → 取最后 N 条、顺序为最近在后、数量被 N 截断。
- `sessionId` 过滤生效；`requestId` 过滤生效。
- `reason` 被截断到界内（放一条超长 reason）。
- `schemaVersion` 仍为 `1`。

**验证**：同上命令。

### 3. `/status`（非 full）：work mode + 拒绝标记（`src/pi-adapter/extension.ts:1147-1186`）

- 追加 `workMode=<activeWorkMode.id>|none`。
  数据源：**闭包内** `activeWorkMode` —— 命令 handler 与它同域，**不要**为它新增 ledger 记录。
- 当 `modeRefusal !== undefined` 时追加 `modeRefused` 标记 + 原因首行。
  注意：`/status` 的输出是**一行** `ctx.ui.notify`；`modeRefusal` 的文案很长，只放可辨识前缀，
  完整文案已经在会话启动时由 `:2247` 通知过，且 `/status full` 会给全文（第 4 步）。
- **不要写任何计数**（`quality-guidelines.md`："A count of something the code declares"）。

### 4. `/status full`：诊断行（同一 handler 的 `full` 分支）

- **复用** `:1159` 已有的 `await ledger.read()`：把 `projectExecutionDiagnostics(records, sessionId ? { sessionId } : {})`
  的结果存到局部变量（`goalEfficiency` 那次读已经是同一个 `ledger.read()`，确认只读一次）。
- 追加三组输出：
  - `lastPlan=<intent>/<lane>@<requestId>`，来自 `diagnostics.strategy`（`strategy-snapshot.ts` 已有 `intent`/`lane`/`logicalRequestId`）。
  - `lastTerminal=<code>: <summary> → <nextAction>`，来自 `diagnostics.lastTerminal.terminal`；
    该键缺席时打印 `lastTerminal=none`（**显式说没有**，不要静默省略）。
  - `refused=<action>/<gate>/<reason>; …`，来自 `diagnostics.lastRefusals`；缺席时打印 `refused=none` 并注明原因
    （"no refusal recorded for this session"），让"没有"和"没记录"不混同。
- 保留现有 live `strategy=` 与 `terminal=`，**不要**改动 `currentStrategySnapshot` 的签名（见 design D1）。
- `workMode` 的完整描述（`gateSemantics`、`never_allow`/`ask_before` 成员、`fence`、`sandbox`）放这一支；
  **列出成员或声明 `unlisted=allow`，不要给计数**。

### 5. 测试：`/status` 与 `/status full` 的输出（`tests/pi-adapter.test.ts`）

现有形态可参考 `:212`（`registerCommand(name, definition)` 收集到 `commands` Map）与 `:225`（命令列表断言）。

必须有的用例：

- `/status`：无 work mode 时输出含 `workMode=none`；有 `modeRefusal` 时含可辨识标记。
- `/status full`：**在请求已结束（`currentRequestPlan` 未定义）后**，输出里能看到上一次请求的 `intent/lane`
  （这是 U2 的正题：现在读成 `idle`）。
- `/status full`：ledger 里没有拒绝时打印 `refused=none`；有拒绝时打印 action/gate/reason。
- `/status` 与 `/status full` **不新增任何 ledger 行**：调用前后读出 ledger 行数并断言相等（只读保证）。
- **不要动** `:225` 的命令列表断言。

**验证**：`node --import tsx --test tests/pi-adapter.test.ts`

### 6. 文档（两份 README + 两份 spec）

- `README.md` 与 `README.en.md`：更新 `/status` 与 `/status full` 的字段说明；
  在 "Terminal causes and recovery" 表里补 `convergence-*` 行；
  另加一句说明 **work mode 拒绝不是 terminal**（它不产生 `request.terminal`，`:2564-2566` 直接 block）。
  `README.md` 对应小节在 `~:277-330`，`README.en.md` 在 `~:299-362`。两份**形态**必须一致（`document-drift.test.ts:373`）。
- `.trellis/spec/backend/personal-agent-capability-runtime.md`（`:110-118`）：把 `lastRefusals` 加入那句投影清单，
  并说明它 additive/可选。**改正文，不动任何 `## ` 标题**，且**总增量 < 2261 字节**。
- `.trellis/spec/backend/personal-agent-extension-runtime.md`（`:60`）：投影清单同步。余量 9283b，充裕。
- **明确不做**：接线 `src/core/failure-reading.ts`（它在 `tests/harness-reachability.test.ts` 的 ALLOW_LIST 上，
  理由已写明是故意的）。若接线，那个测试会以"reachable and still listed"失败——这是设计上的确认，不是阻碍。

### 7. 全量验证

```powershell
npm run typecheck
npm test
npm run test:installer
node --import tsx --test tests/execution-diagnostics.test.ts tests/pi-adapter.test.ts tests/spec-context-budget.test.ts tests/document-drift.test.ts tests/harness-reachability.test.ts
npm run doctor
```

`npm run doctor` 是端到端确认：`requestDiagnostics` 里现在应能看到 `lastRefusals`（若有拒绝记录）。
注意本工作区**没有** `.dove/` 也**没有** state dir，所以 doctor 输出里 `lastRefusals` 理应缺席——
**缺席即正确**，不要为了让它出现而造数据。

## 风险文件与回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| `src/core/execution-ledger.ts` | 共享：`cli.ts` / `local-rpc.ts` / `extension.ts` / 5 个测试都读它。**只做加法** | 删新接口与 3 行投影逻辑 |
| `src/pi-adapter/extension.ts` | 3530 行；在 `harness-surface.yaml` 里同时归 `tool-description` 与 `middleware`。`/status` 的改动属 middleware 半区，`verifiedBy: [tests/pi-adapter.test.ts]` | 还原 `/status` handler 的两处字符串拼接 |
| `README.md` / `README.en.md` | `document-drift.test.ts:373` 检查两份形态一致 | 连同两份一起还原 |
| `.trellis/spec/backend/personal-agent-capability-runtime.md` | **2261 字节余量** | 删新增子句 |

没有新的持久化写入点，所以**回滚不需要清理状态**——这是 design 选择"只加读者"的直接收益。

## `task.py start` 之前的自检

- [ ] `design.md` 的 D1–D5 每条都能在实现里指到具体行。
- [ ] `implement.jsonl` / `check.jsonl` 各至少一条真实 spec 条目（`.trellis/config.yaml` 的 `codex.dispatch_mode` 默认 auto）。
- [ ] 没有新增命令 → `tests/pi-adapter.test.ts:225` 一句未动。
- [ ] 没有新增 `ExecutionRecordKind`、没有新 writer。
- [ ] 两份 spec 的 `## ` 标题集合未变；capability-runtime 增量 < 2261b。
- [ ] **U1 的待验证项没有混进本任务**：block reason 是否进入会话历史，是**另一个**任务的调查项（见 prd.md）。本任务不裁它。
