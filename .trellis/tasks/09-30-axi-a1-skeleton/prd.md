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

- **R1** 定义 `AgentLoop` 接口（自有），并提供至少一个适配器（`pi-agent-core` 的 `Agent`）。
- **R2** 七个组件的**固定挂载点**（文件级），且必须**可被程序化修改**——语料对该类基座的硬要求是 *"General extensibility alone is insufficient."*
- **R3** `.trellis` 式的文件树作为 axi 的"程序"；一次逻辑改动 = 一次提交。
- **R4** 回退路径：`git revert` 能回退一次改动。
- **R5** 按 §2.5 接入复用清单：`src/core/`、`src/capabilities/`、`src/project-provider/`、`src/commands/`、`src/windows-runtime/`、`src/code-audit/`、`src/skills/`、`src/context/`、`src/trellis-adapter/`。

## Acceptance Criteria

- **AC-1** 能跑通一个回合（结构完整即可，不要求回路智能）。
- **AC-2** 一个改动能被 keep；同一个改动能被 `git revert` 撤销，两者都有记录。
- **AC-3** **迁移可验证**（`plan.md` §2.5⑤）：复用清单里每个模块在 axi 下**至少有一条自己的测试通过**；重写清单里每一项**有一条新测试**。
- **AC-4** 门禁不下降：`npm run typecheck`、`npm test`、`npm run test:installer`。

## Out of Scope

- 闸门与安全策略（A2）；trace 通道（A3）；评测（A5）。
- 不 fork 完整 harness；不引入第三方沙箱。

## Key Decisions / 依赖

- 依赖 **A0**：若 A0.1 失败（越界写静默生效），loop 的强制挂载点设计要改。
- 目录 / 仓库归属见父任务的 Open Question。

## Open Questions

（无——除父任务那条"axi 的代码放在哪里"。）
