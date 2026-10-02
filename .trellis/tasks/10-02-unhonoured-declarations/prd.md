# 声明了却兑现不了：本任务覆盖范围之外的四处，与一个门缺口

> 由上一任务（`10-02-enforceable-declarations`）的**全范围检查回合**发现 ✓。它与那个任务**同一缺陷类** ✓（"被接受、看起来像控制、运行时没有读者" ✗），但不在它的三条要求之内 ✓，故另立任务 ✓。**本文件是证据与候选处置，规划尚未完成** ✓。

## Goal

把这一类清干净：**声明声称阻止某件事，而运行时拦不住** ✗ —— 要么就地兑现 ✓，要么在加载时点名拒绝 ✓，损失如实记 ✓。

## Background：四处证据

| # | 声明 | 在哪 | 证据 |
|---|---|---|---|
| **R1** | `scope.exclusions` | `modes/pentest/governance.yaml:7`（`exclusions: [t-payments]`）· `modes/trading/governance.yaml:7`（`exclusions: [production-venue]`） | **`src/` 里没有读者** ✗，而仓里留着自己写的指令：`tests/host-work-mode.test.ts:883-896` 是一条 `[KNOWN GAP]` 用例 ✓，注释写着 *"**Invert this test when exclusions are enforced; do not delete it.**"* ✓ —— 与 `expires` 那条同形 ✓。**这一处最该先修** ✓（两个已发布模式在声称它们不碰某些东西 ✓） |
| **R2** | `authority.grant_graph` | `modes/pentest/governance.yaml:12` | 全仓只有两处 ✓（`src/core/work-mode.ts` 的 `AUTHORITY_FIELDS` 允许键集合 ✓ + 上面那个声明 ✓）→ 读起来像"本模式受这些 grant 约束" ✓，而真正的绑定是文档里的 `targets[].requires_grants` ✓ —— 与 `expires` 完全同一个"重复声明"论证 ✓ |
| **R3** | `session` / `evidence` / `coordination` / `stop`（以及 `scope` 的内部字段） | `modes/pentest/governance.yaml:49-73` | 加载器只在 `GOVERNANCE_FIELDS` 里**接受**它们 ✓、内部**完全不校验** ✓、且 `WorkMode.governance` **没有任何运行时读者** ✓。其中 `session.budget.turns: 60` ✓ 与 `stop.on: [budget-exhausted]` ✓ **读起来是有界的** ✓ → 按上一任务的判据（"它是否声称阻止某件事"）它们是**控制** ✓，不是记录 ✓ |
| **R4** | 两个解析不到的 grant 名 | `modes/code-audit/governance.yaml:10`（`local-review`）· `modes/trading/governance.yaml:10`（`local-paper-trading`） | 两个名字**在仓里无处可解析** ✗（`engagements/` 只有 `example-engagement` ✓），而两个模式都能加载 ✓ —— 因为 `src/core/work-mode.ts` 对 `limit`/`none` 语义**提前返回、不去解析** ✓。加载器自己的拒绝语只对这种情形说"声明了自己被闸门约束、却没有东西约束它" ✓，且**只对 conformance** ✓ |

## Background：一个门缺口（机制问题，不是字段问题）

`scripts/mode-behaviour-map.mts` 里的 `file:line` 引用**早已烂掉** ✗（原文 `588`/`727` ✗；上一任务落地时**实测**应为 `704`/`847` ✗ —— 检查回合报的 708 是错的 ✓，可测的数字不要采信 ✓），而**没有任何门看得见这个文件** ✓：

- `tests/document-drift.test.ts` **按名字豁免**它 ✓、且只走 `src`/`tests` ✓；
- `tests/spec-anchors.test.ts` 只走 `.trellis/spec` ✓。

**这是两道门的共同盲区** ✓，与上一任务里"规格页的行号"是同一类 ✓。另外同文件里那套探针**没有 `authority` 那一行** ✓ —— `expires` 与 `grant_graph` 就是因此活下来的 ✓。

## 处置（2026-10-02 已定，逐处取证后各走最近的路）

| # | 处置 | 关键证据 |
|---|---|---|
| **R1** `scope.exclusions` | **兑现** ✓ | 仓里那条 `[KNOWN GAP]` 用例自带指令"接线后反转" ✓；`scope` 的**键**已被校验 ✓ 而**值被丢掉** ✗（`WorkMode` 上没有这个字段 ✓）→ 先把它带上模式 ✓，再在边界处拦 ✓ |
| **R2** `grant_graph` | **拒绝** ✓ | 真正的绑定是文档里的 `targets[].requires_grants` ✓ → 它是同一控制的第二份副本 ✓（与 `expires` vs grant 的 `window` 同形 ✓） |
| **R3a** `session.budget.turns` | **接线**（不是新增）✓ | 运行时有**真正的回合预算** ✓（`loop-runner.ts:75` 在用 `maxTurns` ✓；Pi 桥也声明了它 ✓）→ 模式里那个数字是第二份副本 ✗ → 把模式的数**喂给已有的界** ✓ |
| **R3b** `stop.on` | **校验** ✓ | 它点名的 `budget-exhausted` / `window-closed` / `emergency-stop` **在 `src/` 里一个都不存在** ✗✓ → 改成"运行时的循环**真的会产生**的停止种类"这一份**唯一**的清单 ✓（不另立第二份 ✗） |
| **R3c** `evidence` / `coordination` / `session.memory_scope` | **拒绝** ✓（损失如实记 ✓） | `retention: 365d` ✓ 与 `isolation: per-engagement` ✓ 是**承诺**不是记录 ✓，兑现意味着真实的保留/删除语义 ✗ —— 本次不做 ✓。**`memory_scope` 是在本任务开始之后才量出来的同类** ✓：三个已发布模式都声明了它（`none` / `project` / `none` ✓）而 `src/` 里没有任何读者 ✗ → 经决定**并入本任务** ✓，走同一条拒绝 ✓（那三个文件本来就在迁移清单上 ✓） |
| **R4** 两个解析不到的 grant 名 | **兑现** ✓ | 早退是**有意**的 ✓（注释自己写着"否则那个值会看起来像实现了、其实没有" ✗）→ 保留"不加载文档"的早退 ✓，但**名字本身必须可解析** ✓ → 两个模式随之要么补上真文档、要么删名 ✓ |
| **门** | **扩展 + 让引用不再会烂** ✓ | `scripts/mode-behaviour-map.mts` 的引用早已烂掉 ✗ 而两道门都看不见它 ✓ → **注释里不再写行号** ✓（只点函数名 ✓ —— 行号注定会烂 ✗），并把引用检查扩到 `scripts/**` ✓ |

## 判据（沿用上一任务）

声明**声称阻止某件事** → 必须可兑现 ✓；声明**只是给人看的记录** → 没人读不是缺陷 ✓。本任务的四处都属前者 ✓。

## Out of Scope

- 上一任务已处置的三处（`expires` ✓、无人见证的技巧名 ✓、速率上限 ✓）。
- `risk_acceptance` ✓（已判定为"记录而非控制" ✓）。
- `evidence.retention` 的**实现** ✓（本次拒绝声明，不做保留/删除语义 ✓）。

## Acceptance Criteria

- [ ] **AC-1（R1）** 一个被模式排除的 target 在边界**被拦住** ✓（红 → 绿各一条读数 ✓；红来自那条自带指令用例的**反转** ✓），而两个模式仍保留并**真的生效** `exclusions` ✓。
- [ ] **AC-2（R2 / R3c）** 声明 `grant_graph`、`evidence` 或 `coordination` 的模式**加载被拒且点名** ✓；`modes/pentest` 删掉它们 ✓ 并在**原位**写明损失 ✓。
- [ ] **AC-3（R3a）** 模式声明的回合预算**在真实运行路径上真的生效** ✓，**或**如实记为限制 ✓ —— **两种都行，假装不行** ✗。
- [ ] **AC-4（R3b）** `stop.on` 的合法值来自 `LoopStopReason` **那一份**清单 ✓；运行时不会产生的种类被拒且点名 ✓。
- [ ] **AC-5（R4）** 在**任何** `gate.semantics` 下，名字不可解析的模式**拒绝加载且点名** ✓；`code-audit` 与 `trading` 各自补文档或删名 ✓，哪条路都记读数 ✓。
- [ ] **AC-6（门）** `scripts/` 里指向不存在路径的引用**当场变红** ✓；且 `mode-behaviour-map.mts` 的注释里**不再出现行号** ✓。
- [ ] **AC-7** 三个门禁不下降 ✓（`typecheck` **0**、`npm test` **0 fail**、installer **OK** ✓；通过数写 `readings.md`，不写在这里 ✓）。

## 已完成规划

处置已定 ✓，`design.md` 与 `implement.md` 已写 ✓。最终评审见本任务最后一条规划摘要 ✓。
