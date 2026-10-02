# 兑现或拒绝：运行时无法执行的声明

## Goal

把三处**声称要拦什么、而运行时拦不了**的声明按仓里已有的先例处理：**要么就地兑现，要么在加载时点名拒绝**——不留"看起来像控制、其实不是"的东西。

## Background

### 判据（这一类问题的分界线）

一个声明**声称阻止某件事** → 它必须可兑现，否则就是在多说自己做了什么（本仓的 D4）。
一个声明**是给人看的记录**（如 `risk_acceptance`：把已接受的风险与缓解写下来）→ 没人读**不是缺陷**，因为它不声称拦任何东西。
本任务只处理**前者**。

### 已复验的三处

| # | 声明 | 在哪 | 现状 |
|---|---|---|---|
| 1 | 模式级 `authority.expires` | `modes/code-audit`（2027-01-01）、`modes/pentest`（**2026-10-01，已过期**）、`modes/trading`（2026-12-31）的 `governance.yaml` | **`src/` 里没有任何地方读它** ✗：`work-mode.ts:175` 只把它列为**允许的键**。`pentest` 那行因此是最糟的组合：像控制 ✗、不是 ✗、还"过期"了 ✗ |
| 2 | 授权约束 `max_requests_per_second` | `engagements/example-engagement/authority.yaml:35`（值 5） | `src/` 里**只有它自己的类型声明**（`authority.ts:42`）✗，没有任何地方读 ✗ |
| 3 | `excluded_techniques` 里**无人见证**的名字 | `modes/pentest/governance.yaml:29` 与 `authority.yaml:34` 的 `social-engineering` | 技巧表只见证 `dos` ✗ → 那个名字**至今惰性** ✗（A2 的读数里已记为未决） |

### 仓里已有的先例（它决定了推荐）

`work-mode.ts:175` 上方原文：

> *"`windows` is deliberately absent: a mode that declares one is refused with an explanation rather than an unknown-field error, **because the reason it is refused is the design point** (see parseMode)."*

即：**"模式级的日历声明"这件事，这个仓早就决定了——它属于 grant，不属于模式**（`modes/pentest/governance.yaml:30` 自己的注释也这么写）。
**`expires` 是同一个日历概念，当时漏掉了** ✗ → 它应得到与 `windows` **相同**的处置，而不是一个新决定。

### 为什么三处要一起做

它们是同一个机制的三次应用（"加载器拒绝一个它无法兑现的控制，并在消息里点名"）。而修 `1` 与 `3` 会让**已发布的模式拒绝加载**——这是**产品改动**，损失必须如实记下，所以它们必须在同一个决定里被看见。

## Requirements

- **R1 `expires`**：按 `windows` 先例——从"允许的键"移出；声明它的模式**被拒绝并收到解释**；三个已发布模式随之删掉该行（**损失：无**，它从未生效过）。
- **R2 `max_requests_per_second`**：**就地兑现**——一个真正的速率上限（用户于 2026-10-02 选定；理由：它是真控制，而它在 grant 里、状态载体已在）。
- **R3 无人见证的技巧名**：加载时**点名拒绝**（用户同次选定；理由：`social-engineering` 没有可检的语法签名，兑现它无从谈起）→ `modes/pentest` 与 example 从清单去掉它（**损失：真实**——该模式的 conduct 声明变弱，已记入 `readings.md` 的义务）。
- **R4 这一类不得复发**：一条**会大声腐烂的用例**——已发布的模式与 example 不得声明运行时无法兑现的控制（照刚建的 `pentest-mode.test.ts` 那条窗口用例的形状）。

## Acceptance Criteria

- [ ] **AC-1** 三处声明要么被兑现、要么其文件不再声明它；**没有第四种状态**（声明着、没人读）。
- [ ] **AC-2** 每一个"拒绝"都有**点名该字段的解释**，且用户能照它改（照 `windows` 那条的形状）。
- [ ] **AC-3** 每一处**损失**都在 `readings.md` 里如实写下（R1 的损失是"无"，也要写"无"）。
- [ ] **AC-4** R4 的用例存在，且在被修的声明上**先红后绿**（红、绿读数各一条）。
- [ ] **AC-5** 三个门禁不下降：`typecheck` **0**、`npm test` **0 fail**、installer **OK**（通过数写在 `readings.md`，不写在这里）。

## Out of Scope

- **`risk_acceptance`**：给人看的记录（见判据），不改。
- **模式级 `windows`**：已按先例拒绝过，改它没有新信息。
- 一个通用的"字段是否被读"的静态检查：本任务只覆盖**已发布的模式与 example**里的**控制类**声明。

## Key Decisions

- **判据**：区分"控制"与"记录"的线（`risk_acceptance` 出局，其余三处入选）。
- 首选处置是**拒绝**而非**兑现**——仓里已有先例（`windows`），而兑现 `expires` 意味着模式会按日期拒绝加载，**并且会再次腐烂**。

## Open Questions

**（无。）** R2 与 R3 的处置已于 2026-10-02 定下（R2 兑现、R3 拒绝），`expires` 由 `windows` 先例定死。最终评审见本任务最后一轮的规划摘要。
