# 声明了却兑现不了：本任务覆盖范围之外的四处，与一个门缺口

> 由上一任务（`10-02-enforceable-declarations`）的**全范围检查回合**发现 ✓。它与那个任务**同一缺陷类** ✓（"被接受、看起来像控制、运行时没有读者" ✗），但不在它的三条要求之内 ✓，故另立任务 ✓。**本文件是证据与候选处置，规划尚未完成** ✓。

## Goal

把这一类清干净：**声明声称阻止某件事，而运行时拦不住** ✗ —— 要么就地兑现 ✓，要么在加载时点名拒绝 ✓，损失如实记 ✓。

## Background：四处证据

| # | 声明 | 在哪 | 证据 |
|---|---|---|---|
| **R1** | `scope.exclusions` | `modes/pentest/governance.yaml:7`（`exclusions: [t-payments]`）· `modes/trading/governance.yaml:7`（`exclusions: [production-venue]`） | **`src/` 里没有读者** ✗，而仓里留着自己写的指令：`tests/host-work-mode.test.ts:883-896` 是一条 `[KNOWN GAP]` 用例 ✓，注释写着 *"**Invert this test when exclusions are enforced; do not delete it.**"* ✓ —— 与 `expires` 那条同形 ✓。**这一处最该先修** ✓（两个已发布模式在声称它们不碰某些东西 ✓） |
| **R2** | `authority.grant_graph` | `modes/pentest/governance.yaml:12` | 全仓只有两处 ✓（`src/core/work-mode.ts:176` 的允许键集合 ✓ + 上面那个声明 ✓）→ 读起来像"本模式受这些 grant 约束" ✓，而真正的绑定是文档里的 `targets[].requires_grants` ✓ —— 与 `expires` 完全同一个"重复声明"论证 ✓ |
| **R3** | `session` / `evidence` / `coordination` / `stop`（以及 `scope` 的内部字段） | `modes/pentest/governance.yaml:49-73` | 加载器只在 `GOVERNANCE_FIELDS` 里**接受**它们 ✓、内部**完全不校验** ✓、且 `WorkMode.governance` **没有任何运行时读者** ✓。其中 `session.budget.turns: 60` ✓ 与 `stop.on: [budget-exhausted]` ✓ **读起来是有界的** ✓ → 按上一任务的判据（"它是否声称阻止某件事"）它们是**控制** ✓，不是记录 ✓ |
| **R4** | 两个解析不到的 grant 名 | `modes/code-audit/governance.yaml:10`（`local-review`）· `modes/trading/governance.yaml:10`（`local-paper-trading`） | 两个名字**在仓里无处可解析** ✗（`engagements/` 只有 `example-engagement` ✓），而两个模式都能加载 ✓ —— 因为 `src/core/work-mode.ts` 对 `limit`/`none` 语义**提前返回、不去解析** ✓。加载器自己的拒绝语只对这种情形说"声明了自己被闸门约束、却没有东西约束它" ✓，且**只对 conformance** ✓ |

## Background：一个门缺口（机制问题，不是字段问题）

`scripts/mode-behaviour-map.mts` 里的 `file:line` 引用**早已烂掉** ✗（原文 `588`/`727` ✗；上一任务落地时**实测**应为 `704`/`847` ✗ —— 检查回合报的 708 是错的 ✓，可测的数字不要采信 ✓），而**没有任何门看得见这个文件** ✓：

- `tests/document-drift.test.ts` **按名字豁免**它 ✓、且只走 `src`/`tests` ✓；
- `tests/spec-anchors.test.ts` 只走 `.trellis/spec` ✓。

**这是两道门的共同盲区** ✓，与上一任务里"规格页的行号"是同一类 ✓。另外同文件里那套探针**没有 `authority` 那一行** ✓ —— `expires` 与 `grant_graph` 就是因此活下来的 ✓。

## 候选处置（**待定，属产品取舍** ✓）

每一处都要在两条路里选 ✓；理由与上一任务一致（仓里已有 `windows` 先例 ✓：不可兑现的控制**点名拒绝** ✓）：

- **R1 `scope.exclusions`**：**兑现**（在范围闸门里真的排除这些目标 ✓ —— 仓里那条用例正等着这个 ✓）**或**拒绝（两个模式删掉该行 ✓；损失：它们不再声明自己不碰什么 ✗）。
- **R2 `grant_graph`**：**拒绝**（与 `expires` 同一条论证 ✓）**或**改判为记录（若它只是描述 ✓ 则写明"这是描述，不是绑定" ✓）。
- **R3 `session`/`stop`/…**：最大的一处 ✓ —— **兑现**（turns/budget 成为真的界 ✓）**或**拒绝（模式删掉这些块 ✓）**或**逐块判定"控制 / 记录" ✓。
- **R4**：**兑现**（对任何语义都解析 grant 名 ✓）**或**拒绝（模式删掉解析不到的名字 ✓）。
- **门缺口**：把 `scripts/**` 纳入某道门的引用检查 ✓ **或**明说它不在任何门的范围内 ✓。

## Out of Scope

- 上一任务已处置的三处（`expires` ✓、无人见证的技巧名 ✓、速率上限 ✓）。
- `risk_acceptance` ✓（已判定为"记录而非控制" ✓）。

## Open Questions（阻塞规划）

- 四处各自的处置（兑现 / 拒绝 / 判为记录）—— **取舍要先定** ✓。
- R3 的边界：哪些字段是"控制"、哪些是"记录" ✓ —— 整个任务里最花判断的一处 ✓。
