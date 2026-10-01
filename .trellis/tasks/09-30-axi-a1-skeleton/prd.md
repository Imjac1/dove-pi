# A1：axi 最小骨架——自有 loop 接口 + 一条最窄的端到端回合

## Goal

让 axi **在本仓里**跑通**一条最窄的端到端回合**：一个自有 `AgentLoop`、一个 scripted provider、一个只读工具、**闸门在派发路径上**、账本落盘，并且**把这次回合打印出来**。不含智能：不改进、不判决、不评测。

**来源**：`plan-v8.md` §5.3 的 **S1** 行（`loop-runner` + scripted provider + 一个只读工具 + 名字层闸门 + ledger 落盘 + 打印回合）；判据：**配对闸门测试（`executedActions 1 → 0`）**、**一次 keep 与一次 revert 被记录**。

## Background（重基：形状决定改变了什么）

- **2026-10-01 形状决定**：产品与运行时**是同一个东西、同一个仓**。因此本任务原稿的 R0（建新仓）、R5（迁移清单）、AC-3（迁移可验证）、AC-4（跨仓门禁等价）**全部作废**；施工仓已合回并退役（`5f14588`、`e70b8e2`）。
- **模块已经存在，本任务做的是"提升"而不是"重写"**（A0.4 已查明）：
  - `src/core/loop.ts`（263 行，契约：`ActionGate` / `GateInvocation` / `GateDecision` / `AgentLoop` / `LoopOutcome`）
  - `src/core/loop-runner.ts:32` — **`createAgentLoop(options): AgentLoop`**（196 行）
  - `src/adapters/loop-scripted.ts:24` — **`createScriptedProvider(...)`**（55 行，返回 `LoopProvider & { callCount }`）
  - `src/core/action-policy.ts:216` — `createActionPolicy(...)`（名字层闸门）
  - `src/core/execution-ledger.ts` — `ExecutionLedger`
  这五件在 `tests/harness-reachability.test.ts` 里登记为"无人到达"或被挡在生产之外——**本任务就是让它们到达**。
- 今天的 loop 归 Pi 拥有（`spec/backend/personal-agent-use-time-architecture.md` §1），所以本任务**不替换宿主的 loop**，先在**产品自带的诊断入口**上把自有 loop 跑起来。

## Requirements

- **R1 一个可跑的回合入口**：`src/cli.ts` 涨一个诊断子命令，组合 `createAgentLoop` + `createScriptedProvider` + 一个只读工具 + 名字层闸门 + `ExecutionLedger`，并**打印一次回合**（提议的动作、闸门判定、账本条目、`LoopOutcome`）。
  **为什么是 CLI**：它是**产品入口**（`bin/` 指向它），可达性走查会跟着它——这是 allow-list 条目"接线完成即删"的前提；只走测试专用路径不会（四个 `harness-*.mts` 就是先例）。
- **R2 闸门在派发路径上**：每个提议的动作都过 `ActionGate.evaluate`，判定**写进账本**；名字层拒绝要带**确定性补救**（沿用 `action-policy` 的既有形态：名字先判、参数后判）。
- **R3 配对判据**：同一个调用，规则允许时 `LoopOutcome.executedActions === 1`；名字层拒绝时 `=== 0`——两条断言在**同一个测试**里成对出现。
- **R4 keep / revert 被记录**：在**临时 git 仓**里做一次真实改动 → 一次提交（keep，记 hash）→ `git revert`（记 hash）；两处都进账本与读数，**不把测试提交写进本仓**。
- **R5 到期即删 allow-list**：本任务完成后，`tests/harness-reachability.test.ts` 里 **`loop-runner` / `loop-scripted` / `checkpoint`** 三条删掉（**接线完成 = 删条目**）。
  **纠正**：`src/jailer/*` 那六条**不在此删**——它们等到 S6（Plane B 真正经 jailer 起受限进程）才可达。先前那张清单写的"当 loop 的派发路径 import `launchJailed` 时删"是错的。
- **R6 门禁不下降**：`typecheck` 0 · `test` **822/820/0/2** · installer **141 OK**，附原始读数。

## Acceptance Criteria

- **AC-1** 能打印一个回合（含提议动作、判定、账本条数、`LoopOutcome`）。
- **AC-2** 配对闸门测试：`executedActions 1 → 0`（成对断言）。
- **AC-3** 一次 keep 与一次 revert 有记录（提交 hash + 账本条目），且**本仓历史里没有测试提交**。
- **AC-4** 三条到期 allow-list 条目已删，`harness-reachability` 不红。
- **AC-5** 门禁三条不降（附读数）。
- **AC-6** 不站到语料里唯一不存在的位置：声明的能力都有消费者与测试（不再声明任何"跨仓等价"）。

## Out of Scope

- 闸门的三种规避手法与故障注入（A2 / S4）；trace 三性质（A3 / S5）；Plane B 与 held-out（A4 / S6）；评测（A5 / S7）。
- **替换宿主（Pi）的 loop**——那是 loop 拥有权那一格，排在后面。
- **不做重写**：`loop-runner` 等按原样提升。

## Open Questions

（无。）
