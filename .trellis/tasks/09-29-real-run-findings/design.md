# Design — 真实运行暴露的四件事

## 1. 一句话

四条发现里三条是缺陷、一条是决定；缺陷的修法都很小，决定已经由证据解掉。

## 2. 证据基线（已核实，不是推断）

来自 `.trellis/tasks/archive/2026-09/09-29-real-user-session-replay/implement.md` 的第 7 步记录：
provider `ant` / 模型 `atria-dawn-preview` / 2026-09-29 / 415.6s / exit 0 / 503 事件 / 13 次工具调用
（`read`×9、`bash`×4）/ 输入 85231 token / 终止码 `retry-refused-after-effect`。

## 3. 设计决策

### D1 — F1：把 `ledgerDetail` 移到 `strategyText` 之前

**选**：`src/pi-adapter/extension.ts:1217` 的拼接顺序改为 `…${cacheText}${ledgerDetail}${strategyText}${workModeDetail}`。

**理由**：捕获上限 2048（`scripts/real-dove-blackbox.mjs` 的 `redact()`），而 `strategyText` 里含
`Snapshot=${JSON.stringify(strategy)}` —— 一整段 JSON 把后面所有字段推出证据。`ledgerDetail`（定义在 `:1188`）
恰好是上个任务新增、也恰好是真实会话里最该被核对的那三个字段。

**否**：提高捕获上限。那是"让证据更长"而不是"让重要的东西在前面"；而且 2048 是为证据体积定的界，不该为一条消息破例。

**代价**：`Snapshot` 与 `Strategy roles` 在证据里可能被截断 —— 但它们的完整内容**已经在 `strategy` 结构化字段里**
（summary 的 `strategy` 与 ledger 的 `request.planned`），所以挪到后面不丢信息；而 `ledgerDetail` 的三个字段
**只存在于这条消息里**。取舍的依据是"哪一份没有别的副本"。

### D2 — F2：`extractToolNames` 认实际发生的事件名

**选**：`scripts/real-dove-blackbox.mjs:533` 同时接受 `tool_execution_start` 与 `tool_start`。

**理由**：该次运行 503 条事件里 `tool_execution_start` 出现 13 次、`tool_start` 一次都没有；
而计划里"看真实模型用了哪些工具"（包括 `agent_run_capability` 是否被调用）就靠这个字段。

**否**：只认 `tool_execution_start`。两种都接受更稳，且不改变任何现有行为（`tool_start` 从来不会出现，
所以它是纯加法）。

### D3 — F3：两个轮数是两个不同的量，把它们分开命名

**已核实的成因**（不是猜）：`src/pi-adapter/extension.ts:3012` 的
`if (attemptTrigger !== "provider-retry" && attemptTrigger !== "compaction-retry")` 让计数器在**重试时不递增**；
而重置（`:3139`）只在 `requestLease.isNewRequest` 时发生。于是"1 次尝试的首轮"被记成整场的轮数，
而 goals 行的 `Provider 8` 来自 ledger 的 `provider.request.completed` 记录（`src/pi-adapter/cache-diagnostics.ts:333`），
数的是真实请求数。

**选**：拆成两个具名计数器。
- `currentRequestProviderRounds` —— 本**逻辑请求**内真实发生的 provider 请求数，**无条件递增**（删掉 trigger 守卫）。
  资源观测（`:2427`）读它，于是与 goals 行同源、不再矛盾。
- `currentRoundSinceProgress` —— 仅供**观察阈值告警**使用，保留今天"重试不算新一轮"的语义，一字不改。

**理由**：两个量本来就有两种含义，用一个变量承载它们才是矛盾的来源。拆开后阈值的行为**逐字节不变**，
而观测拿到真实轮数。这比"让观测去读 ledger"更小：观测路径不新增一次 ledger 读。

**否**：让观测从 ledger 取真实轮数。可行（`agent_end` 里已经为 change 决策读过 ledger），
但那会让"写观测"依赖一次文件读，而内存里已有的事实不该再读一遍盘。

### D4 — F4：拒绝的**策略**不动，把**终止信息**变成可执行的

**先解掉一个看似需要决定的问题**：用户要的"能显式选择重试"**已经成立**。
`RequestLifecycleController.acceptSubmission` 对每一次新提交建立**新的逻辑请求**（`request-lifecycle.ts`），
而 `retryDecision` 的拒绝只作用于**同一次逻辑请求内的自动重试**（`:260` 读的是 lease 上的
`nonIdempotentEffectStarted`）。所以重新发一条消息本来就是被允许的、也是用户表达"我知道，继续"的方式。
**缺的不是入口，是告知。**

**选**：在拒绝产生终止的那一刻，把 `nextAction` 变成可执行的：
1. **点名本请求里非幂等的动作。** 在 `tool_call` 里已经算出 `idempotent`（`isPiToolInvocationIdempotent`），
   把非幂等的**工具名**累积成一个有界的、去重的列表；终止时列出它。
2. **点名未解决的 effect claim**（当加载了 work mode、因此有 effect store 时）。
   来源：`<workspaceRoot>/.dove/effects/*.json`，即 `EffectRecord`；取 `outcome` 缺失或为 `unknown` 的那些 ——
   它们正是"已 claim 但结果未知"。每条带 `tool` 与 `target`。有界，且**读不出来的文件要如实点名**而不是跳过
   （`effect-store-file.ts` 的 `UnreadableClaimError` 已经把这条规矩写死了）。
3. **明说新请求是允许的**，因为拒绝是按尝试的。

**否**：新增一个 `/dove-retry` 之类的显式重试入口。理由：重新提交已经是那个入口，再加一个命令会多一条
需要维护、且与"自动重试被拒"这条策略容易混淆的路径。

**代价**：`nextAction` 变长。界在实现里定成一个具名常量；termina 信封的 `nextAction` 本来就有截断约定。

**不改的**：`retryDecision` 的判据、`terminalForFailure` 的纯函数性（消息在调用点组装，因为那里才够得着
effect store 与 workspace root）。

## 4. 兼容与回滚

- D1/D2/D4 都是**面向人的文本或新增字段**，不改策略、不改预算、不改 fail-closed 语义。
- D3 拆计数器：阈值告警的输入换名但语义不变；资源观测的数值会**变大**（变成真实轮数）——
  这是修正，不是回归；ledger 的既有记录不受影响（新记录才是新语义）。
- 无迁移、无新持久化格式、无新 `ExecutionRecordKind`。
- 回滚：四处都是局部改动，逐处可还原。

## 5. 已知不做

- 缓存命中率 2.8%（数据，非缺陷）。
- 改 fail-closed 的重试策略本身。
- 提高证据捕获上限。
