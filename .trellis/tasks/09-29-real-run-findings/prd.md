# The defects a real session exposed, and the retry refusal it ended on

## Goal

修掉第一次真实 provider 会话暴露的缺陷，并让那次会话终止的方式对使用者可执行。

**为什么以前没被发现**：四条全都只在真实运行里出现 —— 一次 415 秒、13 次工具调用、7 个 provider 回合的真实会话，
外加一条 fail-closed 的重试策略被真正触发。测试与阅读都到不了这些位置。

## Background

证据在 `.trellis/tasks/archive/2026-09/09-29-real-user-session-replay/implement.md` 的"第 7 步"：
provider `ant` / 模型 `atria-dawn-preview` / 2026-09-29 / 415.6s / exit 0 / 503 事件 /
13 次工具调用（`read`×9、`bash`×4）/ 输入 85231 token / 终止码 `retry-refused-after-effect`。
**那份读数不可复现**，原始运行未进 git。

## Requirements

### R1（F1）— `/status full` 的三个字段必须排在证据截断之前

- 现象：真实会话捕获的 `/status full` 正好 2048 字符，在 `LastPlan:` / `LastTerminal:` / `Refused:` **之前**被截断。
- 锚点：`src/pi-adapter/extension.ts:1217` 的 `…${cacheText}${strategyText}${ledgerDetail}${workModeDetail}`；
  `ledgerDetail` 定义在 `:1188`；`strategyText` 含 `Snapshot=${JSON.stringify(strategy)}`。
- 影响：TUI 里看得到，**证据路径看不到** —— 上一个任务的 AC-1/AC-2/AC-4 因此无法从真实运行的证据核对。
- 做法：`ledgerDetail` 移到 `strategyText` 之前。**不动** 2048 这个界（依据：`Snapshot` 的内容在 summary 与 ledger 里
  另有一份，而 `ledgerDetail` 的三个字段只存在于这条消息）。

### R2（F2）— `steps[].toolNames` 必须反映实际发生的工具调用

- 现象：13 次工具调用，每个 step 的 `toolNames` 都是 `[]`。
- 锚点：`scripts/real-dove-blackbox.mjs:533` 的 `extractToolNames` 找 `tool_start`；该次运行里 `tool_execution_start` ×13、`tool_start` ×0。
- 影响：192M token 那份计划最想问的"模型到底会不会调用 `agent_run_capability`"无法测量。
- 做法：同时接受两种事件名。

### R3（F3）— 同一份输出里的两个 provider 轮数不该被读成互相矛盾，而要各自说明自己量的是什么

- 现象：`strategy` 说 `providerRounds=1`，同一份输出的 goals 行说 `Provider 8`。
- **修正后的判定**：这不是低报。观测是**按尝试**写的（`agent_end` 每次尝试各写一条），而真实会话在第一个
  provider error 之后就被 `retry-refused-after-effect` 终止 —— 所以那个请求确实只完成了 1 轮 provider 请求，`1` 是对的。
  goals 行的 `Provider 8` 是**跨多个请求/goal** 的累计。两个数各自正确，只是同一份输出里没有说明它们量的不同。
- 已核实的另一个真实差异：`extension.ts:3012` 的 trigger 守卫让**重试的尝试不递增**计数器 ——
  在带重试的请求里这会真的少算（实测：3 次尝试只记 1）。这个是要修的。
- 做法：拆成两个具名计数器 —— 观测用的`currentRequestProviderRounds`（无条件递增，量本逻辑请求内真实请求数）与
  阈值告警用的`currentRoundSinceProgress`（保留今天"重试不算新一轮"的语义，**一字不改**）；
  并在两处写明各自量的是什么，让下一个读的人不再把两者当成同一件事。

### R4（F4，已决定 (b)）— 拒绝的策略不动，终止信息要可执行

- 已核实：拒绝**按尝试**作用（`retryDecision` 在 `request-lifecycle.ts:260` 读 lease 的 `nonIdempotentEffectStarted`），
  而 `acceptSubmission` 对每次新提交建立**新的逻辑请求**。所以"用户显式选择重试"**已经成立** —— 缺的是告知，不是入口。
- 做法（三部分）：
  1. 在 `tool_call` 里把**非幂等**的工具名累积成一个有界、去重的 per-request 列表（无 work mode 时这是唯一来源）。
  2. 当加载了 work mode（因而有 effect store）时，列出**未解决的 claim**：`<workspaceRoot>/.dove/effects/*.json` 中
     `outcome` 缺失或为 `unknown` 的 `EffectRecord`，每条带 `tool` 与 `target`；**读不出的要如实点名**
     （`effect-store-file.ts` 的 `UnreadableClaimError` 已写死这条规矩）。
  3. 在 `terminalForFailure` 的**调用点**覆盖终端的 `nextAction`：列出上述内容，并**明说新请求是允许的**。
     保持 `terminalForFailure` 是纯函数。
- **不做**：新增显式重试命令（重新提交已经是那个入口，再加一个会与"自动重试被拒"混淆）。

## Acceptance Criteria

- [x] **AC-1（R1）** `/status full` 的消息里 `LastPlan:` 的下标**小于** `Snapshot=` 的下标；有断言
      （比断言长度更稳，且不需要真的触发 2048 截断）。
      **已核**：把拼接顺序还原成 `strategyText` 在前，该套件 0 pass / 1 fail —— 断言在修好前会红。
- [x] **AC-2（R2）** `--progress-case changing` 的用例里 `steps[0].toolNames` 非空且包含 `"read"`；有断言。
      **已核**：`extractToolNames` 还原成只认 `tool_start` 后，该套件 18 个用例失败。
- [x] **AC-3（R3）** 带重试的请求：观测按尝试各写一条，最后一条的 `providerRounds` 等于尝试数（3）
      —— 已由 `[1,2,3]` 的实测证实；**且**阈值告警在重试时不提前触发（两条断言，后者保护被删守卫的原语义）。
      **已核**：观测那条断言在把递增移回守卫内后 0 pass / 1 fail；阈值那条在把 `currentRoundSinceProgress`
      移出守卫后 0 pass / 1 fail。阈值断言所在的 context 原本是 `hasUI: false`，而告警在 `if (ctx.hasUI)` 之后
      —— 不改的话那条断言会"因为没人听而通过"而不是"因为守卫成立而通过"，所以该套件现在声明 UI 并收集通知。
- [x] **AC-4（R4）** 一次非幂等工具调用后触发 provider 失败，终止信封的 `nextAction` **出现该工具名**且含可执行的下一步措辞；
      控制组：只做只读动作的失败，`nextAction` 不列任何动作。
      **已核**：把 `terminalForFailureWithRecovery` 短路成直接返回纯函数的终端后，0 pass / 1 fail。
- [x] **AC-5** 每个修复都有一条**在修好前会红**的断言 —— 四条逐条用"还原修复再跑"核过，见上。
- [x] **AC-6** 门禁全绿：`npm run typecheck`、`npm test`、`npm run test:installer`，
      且 installer 的既有 4 个环境性失败**不得增加**（对照 HEAD 的同一命令）。
      **实测**：`typecheck` 干净；`npm test` **811 tests / 809 pass / 0 fail / 2 skipped**；
      `test:installer` **141 tests / OK —— 0 失败**，即那 4 个环境性失败本次一次都没出现（比"不增加"更强）。

## 记录（本次会话）

- 顺手修掉两处**格式**缺陷：`tests/pi-adapter.test.ts` 与 `tests/real-dove-blackbox.test.ts` 里各有一条
  注释被并进了上一行代码（缺换行）。它们不影响行为，但会让下一个读的人以为那段注释是被注释掉的代码。
- 除上述两条外，**没有再动任何源文件** —— 四处修复的实现与断言在本次会话开始时已经写好，
  本次会话做的是**逐条验证它们真的承载着对应的缺陷**，以及补上 AC-3 缺的那第二条断言。


## Technical Notes

设计决策见 `design.md`（D1–D4，含每条的被否方案与代价）。约束：
不动 fail-closed 语义、不动 2048 捕获界、不新增 `ExecutionRecordKind`、不新增持久化格式；
`terminalForFailure` 保持纯函数。

## Out of Scope

- 缓存命中率 2.8%（`sessionHitRate`）—— 这是 192M token 那份计划最在意的轴的**第一个真实观测值**，
  属于成本 programme 的数据，不是本任务的缺陷；只有一次观测，还不足以推广。
- 改 fail-closed 的重试策略本身（(b) 已定：策略正确）。
- 提高证据捕获上限。
- 新增显式重试命令。
