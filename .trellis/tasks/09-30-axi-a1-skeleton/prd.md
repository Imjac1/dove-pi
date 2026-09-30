# A1：axi 最小骨架——自有 loop 接口 + 七组件挂载点

## Goal

让 axi 有一套**自己的**最小可运行骨架：一个 `AgentLoop` 接口与至少一个适配器、七个组件的固定文件挂载点、以及"一次逻辑改动 = 一次提交、可 `git revert`"的数据形态。

本阶段**不含任何智能**：不改进、不判决、不评测。它的价值是把"axi 的程序是一棵文件树"这件事变成结构，好让 A2/A3 的强制有地方可接。

来源：`plan.md` §4.2 A1、§2.5。

## Background

- 09-25 实测：**dove-pi 对 Pi 各包的 import 只出现在 4 个文件、全在 `src/pi-adapter/`；其余 69 个源文件零 import** → 这些模块基座无关，可直接搬。
- 09-26 裁决：框架拥有自己的最小 loop 接口；`pi-agent-core` 的 thin `Agent` 是**适配器，永远不是地基**（反悔成本 = 一个适配器）。
- 语料里"薄 loop + 真闸门"这个组合**不存在**——这是 axi 要填的位置。

## Requirements

- **R0 建仓与门禁基线（新仓库）**：用户已决定 axi 放**新仓库**。因此在写入任何新代码**之前**，要在新仓建立与 dove-pi 等价的门禁与测试基线（`npm run typecheck`、`npm test` 816/814/0/2、`npm run test:installer` 141），并**记录原始读数**。迁移 69 个基座无关模块的方式（subtree / submodule / 复制 + 重设基线）写进本任务的 `design.md` 并说明理由。
- **R1** **把既有的 loop 接口与适配器提升为 axi 的生产 loop**——A0.4 已查明它**不必从零定义**：`src/core/loop.ts` 已有 `AgentLoop` / `ActionGate` / `GateDecision` / `LoopOutcome` / `normalizeGateDecision`，`src/adapters/loop-pi-agent-core.ts` 与 `loop-scripted.ts` 已有两个实现，而 `tests/harness-reachability.test.ts:88-89` 把它们登记为 `wiredBy: null`（刻意不接入生产）。本任务做的是**提升**，不是重写。读数见 A0 任务的 `readings.md`。
- **R2** 七个组件的**固定挂载点**（文件级），且必须**可被程序化修改**——语料对该类基座的硬要求是 *"General extensibility alone is insufficient."*
- **R3** `.trellis` 式的文件树作为 axi 的"程序"；一次逻辑改动 = 一次提交。
- **R4** 回退路径：`git revert` 能回退一次改动。
- **R5** 按 §2.5 接入复用清单：`src/core/`、`src/capabilities/`、`src/project-provider/`、`src/commands/`、`src/windows-runtime/`、`src/code-audit/`、`src/skills/`、`src/context/`、`src/trellis-adapter/`。

## Acceptance Criteria

- **AC-1** 能跑通一个回合（结构完整即可，不要求回路智能）。
- **AC-2** 一个改动能被 keep；同一个改动能被 `git revert` 撤销，两者都有记录。
- **AC-3** **迁移可验证**（`plan.md` §2.5⑤）：复用清单里每个模块在 axi 下**至少有一条自己的测试通过**；重写清单里每一项**有一条新测试**。
- **AC-4** 门禁：**新仓**门禁与 dove-pi 基线**等价**（`typecheck` / `test` 816-814-0-2 / `test:installer` 141），有原始读数；且**旧仓门禁不下降**。

## Out of Scope

- 闸门与安全策略（A2）；trace 通道（A3）；评测（A5）。
- 不 fork 完整 harness；不引入第三方沙箱。

## Key Decisions / 依赖

- 依赖 **A0**：若 A0.1 失败（越界写静默生效），loop 的强制挂载点设计要改。
- 目录 / 仓库归属见父任务的 Open Question。

## Dependencies / Resolved

- **已定（用户 2026-09-30）：axi 放新仓库。** 本任务的 R0 就是这件事。
- 本仓（dove-pi）**不因 axi 而改动产品代码**；它继续是 dove-pi 自身与规划留痕处。

## Open Questions

（无。）
