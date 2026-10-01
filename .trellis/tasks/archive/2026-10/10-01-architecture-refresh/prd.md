# 优化目前项目架构

## Goal

在"**产品与运行时是同一个东西**"这条决定之后，把本仓的架构按**真实耦合与职责**重新规划一次：让**声明与实现一致**、让**运行时四层**（`gate` / `jailer` / `trace` / `plane-b`）有位可放、把**已量出的结构瑕疵**修掉，并给出**可验收的改造顺序**（每步门禁不降）。

用户原话：「那你规划下优化下目前项目架构」。

## Background：量出来的现状（2026-10-01，全部来自树与测试，不是文档转述）

### 各层的体量

| 目录 | 文件 | KB | 目录 | 文件 | KB |
|---|---|---|---|---|---|
| `core/` | 46 | 529 | `capabilities/` | 4 | 30 |
| `pi-adapter/` | 15 | 323 | `adapters/` | 4 | 21 |
| `project-provider/` | 10 | 73 | `jailer/` | 6 | 19 |
| `code-audit/` | 5 | 50 | `windows-runtime/` | 3 | 15 |
| `extensions/` | 4 | 38 | `trellis-adapter/` | 2 | 12 |
| `commands/` | 5 | 33 | `web-access/` | 1 | 10 |

### 五个已量出的结构事实

1. **声明的布局落后于真实树**：`directory-structure.md` 的 `Directory Layout` 列出 **7** 层（`core`、`pi-adapter`、`project-provider`、`trellis-adapter`、`windows-runtime`、`capabilities`、`extensions`）+ `cli.ts`；真实有 **14** 个目录 → **未被声明的 7 个**：`adapters`、`code-audit`、`commands`、`context`、`jailer`、`skills`、`web-access`。（规格是"描述现在就有"的东西，所以这是一处**声明与实现不一致**。**更正**：初稿写的是"8 层、缺 6 个"——那是把 `core` 注释里的单词 `context` 误当成了目录名；判据应是"布局块里的条目"，不是"文档里出现过这个词"。）
2. **唯一一处反向依赖**：`src/core/workspace-policy.ts:4` **值导入**（不是 `import type`）`../project-provider/lock.ts` 的 `withProjectMutationLock`——底层反向依赖上层。规格原文：*"the core must not import Pi or Trellis implementation details"*，而分层的意图是 core 为底。
3. **一处 3602 行 / 227 KB 的宿主装配根**：`src/pi-adapter/extension.ts`——**59 个 import、48 处注册、26 个导出、38 个函数**。它大是因为**注册面大**（工具/命令/钩子/UI 全在这里接线），不是分层错；但**单文件 3602 行**是导航与测试的实打代价。
4. **`core/` 是一个平袋子**：46 文件 / 529 KB，同时住着 loop、闸门/策略、证据/账本、内生仪器、dispatch、模式/上下文、工作区/状态——而 axi 还要**再加四层**（`gate` / `jailer` 已建 / `trace` / `plane-b`）。
5. **"loop" 有四个模块**：`core/loop.ts`（12 个导入者）、`core/loop-runner.ts`（**无人到达**）、`adapters/loop-pi-agent-core.ts`、`adapters/loop-scripted.ts`；连同其它条目，`tests/harness-reachability.test.ts` 里共 **16 条"无人到达"登记**，各带理由——需要一次**明确处置**（接线 / 参照 / 遗留）。

### 参考读数

- **hub**（被多少文件导入）：`core/contracts.ts` **41**、`execution-ledger` 20、`task-convergence` 19、`capability-registry` 15、`effect-ledger` 13、`loop` 12。
- **跨层导入**：111 个源文件里 **26** 个跨层；其中 **22** 个是"向 core 导入"（允许方向），**1** 个是反向（第 2 条），其余在宿主/命令层内部。

### 改动会撞到哪里（这决定改造顺序）

| 钉住 `core/*.ts` 路径的地方 | 数量 |
|---|---|
| `.trellis/harness-surface.yaml`（可编辑面的声明） | **8** 条 `core/*.ts` 路径 |
| 测试文件里出现的 `core/*.ts` 路径 | **46** 条 |
| `tests/harness-reachability.test.ts` 的 allow-list | 按路径登记（16 条） |

**含义**：`core/` 的子层化（文件移动）会同时动**声明、测试、allow-list**——而这三样正是进行中的 axi 程序（S1 接线 `loop-runner`、S3 已建的 jailer、S2 组件面）**同一轮要改**的东西。所以顺序不是风格问题，是**撞车问题**。

## Requirements

- **R1 声明与实现一致**：`directory-structure.md` 必须列出真实存在的层，并说清每层**职责**与**允许的依赖方向**。
- **R2 层位先定**：`gate` / `jailer` / `trace` / `plane-b` 的归属与依赖方向要写明（core 为底；运行时层可依赖 core；宿主层依赖运行时层），且**规格与 `plan-v8 §5` 只能有一种说法**。
- **R3 修那处反向依赖**：`core/workspace-policy.ts:4`；修法要说明**为什么这样修**（而不是顺手把 lock 移上移下）。
- **R4 16 条"无人到达"各给一次处置**（接线 / 参照 / 遗留，各带理由），并与 axi 程序的 S1 对齐（`loop-runner` 是 S1 要用的参照 loop）。
- **R5 每步门禁不降**且有原始读数（`typecheck` 0 · `test` 822/820/0/2 · installer 141）。
- **R6 顺序可执行**：与在飞程序会撞车的改动**排在其后**，并写明**前置条件**（可核对，不是"以后再说"）。

## Acceptance Criteria

- **AC-1** `directory-structure.md` 与真实树一致（层、职责、依赖方向），且既有检查（`document-drift`、`spec-context-budget`）不红。
- **AC-2** `src/core/workspace-policy.ts` 不再依赖 `project-provider`（或改成注入式），且三条门禁不降。
- **AC-3** 运行时四层的层位与依赖方向在**规格**与 **`plan-v8 §5`** 里一致（不是两处各说一套）。
- **AC-4** 16 条 allow-list 条目**各有处置与理由**；不留"没理由的条目"。
- **AC-5** 两项结构改造（`extension.ts` 3602 行拆分、`core/` 子层化）写成**有前置条件的项**，前置条件可核对（surface map 与 allow-list 稳定 = 接线完成）。
- **AC-6** 门禁：`typecheck` 0 · `test` 822/820/0/2 · `test:installer` 141。
- **AC-7**（**新增**）《使用期架构》一页存在、**被 router route、被 index 列出**，且 `tests/spec-context-budget.test.ts` 与 `tests/document-drift.test.ts` 全绿；页内每一条运行期断言都带 **`file:line` 锚点**；**两处空白如实写明**——不许写成"跑通了"。

## Out of Scope

- 不改产品行为、不动测试断言、不做重写。
- 不动 `pi-adapter` 的注册面（48 处注册是产品面，不是垃圾）。
- 不在本任务里写 axi 的运行时代码（那是 A1–A5）。
- 不做 git 历史操作。

## 已裁决的范围（2026-10-01）

**用户选择：声明与依赖方向先对齐，两项结构改造排到 S1 之后。** 因此本任务交付四件（每件可核对，见 `implement.md`）：

1. **声明对齐真实树**：`directory-structure.md` 补齐**未声明的 7 层**（真实 14 个目录，布局块只列 7 个 + `cli.ts`：缺 `adapters`、`code-audit`、`commands`、`context`、`jailer`、`skills`、`web-access`），并写入 **§1 的四层与"箭头只能向下"**。
2. **修唯一那处反向依赖**：`core/workspace-policy.ts:4` → 把 `project-provider/lock.ts`（**50 行、只依赖 node 内建**）**下移**到 `core/`；判据是"`core` 不再有任何指向上层的 import"，且要留扫描读数。
3. **16 条"无人到达"各给处置**（接线 / 参照 / 保留 / S2 决定），并与 S1 对齐（`loop-runner` 是 S1 的参照 loop）。
4. **`plan-v8 §5` 与规格对齐**（它原是给另一个仓写的开发设计），顺带解掉 **81,319 字节 > 注入上限 32,768** 的截断缺陷。
5. **交付一页《使用期架构》**（你连着问的那件事）：`.trellis/spec/backend/personal-agent-use-time-architecture.md`——**谁拥有 loop**（Pi 拥有；`core/loop.ts` 只是契约、`loop-runner.ts` 无人到达）、**18 个宿主挂载点各在什么时候被调用**、**闸门的执行点**（`extension.ts:2616` 的 `tool_call` 内、`L2624` 的 `denyDecision` → `return { block: true, reason }`）、**进程边界**（工具与子代理是真子进程）、**信任分级**（模型 < agent 脚本 < 工具层半可信 < 人 < Plane B）、**证据落盘与跨会话**（`execution.jsonl`、checkpoint、`.dove/tasks/<id>/convergence.json`），以及**两处空白**。
   - 它必须过**三处既有检查**：新页**被 router route** 且 **router ≤ 8 KiB**、新页 **≤ 24 KiB**、**`index.md` 列出该目录的每个规格**（`tests/spec-context-budget.test.ts` 与 `tests/document-drift.test.ts` 看着这三条）。

**两项大改造不在本任务完成，但前置条件要写清**：

- **D2 拆 `pi-adapter/extension.ts`**（3602 行 / 59 import / 48 处注册）：前置条件 = **接缝分析**先交付（把注册聚成 3–5 组）；**不需要等 S1**——因为它只动 `pi-adapter/**`，不碰 surface map 与 allow-list。**所以它可以先于 D1。**
- **D1 `core/` 子层化**：前置条件 = **S1 接线完成 + `harness-surface.yaml` 与 allow-list 稳定**（可核对）——核心拆分要同步改 **8 条 surface 路径 + 46 条测试路径 + allow-list 登记**，而那正是 S1/S2 同一轮要改的**同一批**。
