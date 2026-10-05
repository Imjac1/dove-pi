# 主线②：改进回合（操作者视角）

## Goal

把产品面的**第二条主线**写进 spec：新页 `.trellis/spec/backend/personal-agent-improvement-run.md`——**一次改进回合，从操作者的座位看**：谁供给什么、谁读什么、谁决定什么，以及这一切现在站在哪里。同时让**第一条原始需求**（"用文件承载纪律、文件即 API"）在两页里各被引一次——它今天只活在 task 文档里。

**可交付的判定**：新页进 router / `backend/index.md` / `routedSpecNames`；**不重述** `personal-agent-harness-loop.md` §4 已经写下的七步（只指向）；每个缺口点名归属；三条门禁读数不降。

> 语言：本文件与 `design.md` 用中文；**规格页与被测试逐字钉住的标题用英文**。

## Background（已确认的事实，全部逐字或实测）

**原始需求（`09-30-axi-program/plan.md` §0.1 那张"请先核对"表，逐字）**：

| # | 你要的 | 当时的理解 |
|---|---|---|
| 1 | Trellis 在前 Harness 时代对"如何更好驾驭 AI"的思考 | **用文件承载纪律**：任务/规格/会话/证据落盘，状态与契约是可直接读的工件（*"The 'API' is the filesystem, the terminal, and git."*） |
| 2 | 技术前沿的集大成者 | 不是堆原语，而是**选对在哪一层拥有什么**；落在一份对**十一个生产 harness 的源码级解剖**之上 |
| 3 | Agent 递归自我改进（RSI）的设计 | 让系统改进自己的 harness；可交付的是**第 2 级"有界自我改进"** |

**目的（`plan.md:49` 原文）**：做出"能在自己改不到的边界内、只凭自身证据改进自己"的 harness，**并把它做成可长期研究的对象**。
**定位（`plan.md:52-81`）**：axi = **substrate + persistent self-improvement loop**；七个组件**必须能被程序化修改**；只有改"产生改进的机制"时才进第三档，**而那不作交付目标**。
**机会点（`plan.md:99`）**：六个子系统都有从最小到最大的完整光谱，**唯一没有现成实现的是"受治的自我改造"**。

**我漏掉的四件**：①"文件即 API"在我写的两页里 **0 次**；②"集大成者 / 选对在哪一层拥有什么"没有出处，读起来像我的发明；③"可长期研究的对象"没有；④四个操作性术语与"本项目在哪一档"没有。

**spec 覆盖实测**（决定本页的增量，也决定哪些部分**只能指向**）：

| 概念 | spec 里 |
|---|---|
| 七步回合 + 脚本 + `operation=change/applied/decided` + `git revert` | **已有**：`personal-agent-harness-loop.md:188-207` |
| 仪器与错误矩阵 | **已有**：同页 §3 / §5 |
| `Experiment 0` | **0 处** |
| `Plane C` / `substrate` / `persistent self-improvement` / `self-refinement` | **各 0 处** |
| `Plane A` | 只在 `personal-agent-framework-core.md` |
| `held-out` / `Plane B` | 只在 `personal-agent-use-time-architecture.md` |

⇒ **三平面图与那条不变量（改进者的权力 = Plane A − Plane B）不在 spec 里**；四个术语与 axi 所处档位不在；Experiment 0 不在。

**两个结构性事实**：`harness-loop.md` 只剩 **5 字节**余量（24 571 / 24 576），"把回路的东西都塞进它"这条路已经关掉；用户已裁决产品面**两面并列**（① 人用它干活，② 它改自己），本页就是 ②。

**门禁会绑住新页**：`tests/spec-context-budget.test.ts` 的 `routedSpecNames`（顺序 = router 里的顺序）与 `expectedHeadingsBySpec`（`##` 逐字 `deepEqual`）；router 只允许 3 个 `##`、不得含围栏块、≤ 8 KiB；每页 ≤ 24 KiB；`tests/document-drift.test.ts` 要求 index 与目录双向相等、backend 里点名的路径存在。

## Requirements

- **R1 落点** = `.trellis/spec/backend/personal-agent-improvement-run.md`，进 router、`backend/index.md`、`routedSpecNames`；不新建 spec 目录。
- **R2** 写出**原始三条需求与目的**，每条带 `plan.md` 锚点；并写明这条主线与主线①**共享同一套工件**（文件即 API 是两者的桥）。
- **R3** 写出**四个操作性术语**与**本项目所处档位**（第 2 级；改"产生改进的机制"才进第三档，且那不作交付目标）。
- **R4** 写出**三平面与那条不变量**（改进者的权力 = Plane A − Plane B；内层 verifier 可上升、**外层评测器不可**），并点明**本仓就是 Plane A**。
- **R5** 写出**操作者供给 / 读 / 决定**：供模式与授权文档、给 privilege-boundary 的批准；读回合打印与账本；决定 keep/revert——并指到 `personal-agent-use-time-architecture.md` §5 的信任阶梯。
- **R6 只指向、不重述**：`personal-agent-harness-loop.md` 的仪器与 §4 的七步一律以链接出现；本页只列**缺的三件**（文件级 harness/verifier 切分、Pareto 不可计算、"sandbox violations" 读的是自己的拒绝）。
- **R7** 写 **Experiment 0** 的三条判据，以及**判据失败时框架退化成什么**（退化成"人是那个固定点，边界是纪律"）。
- **R8** 把**成本写在前面**：AHE 用了 89 个任务 × 9 轮才读出 P/R；一个任务的一次运行**不是 benchmark**。
- **R9** 写**会被什么证伪**（Experiment 0 失败 / 文件级切分做不到 / held-out 在这个尺度上不可测）。
- **R10** 每个缺口点名归属；**两页各加一处"文件即 API"的引与互指**（产品页与使用页各一处）。
- **R11** 门禁不下降：`typecheck` 0、`npm test` 0 fail（既有 1 条如实记）、installer OK；新页 ≤ 24 KiB、router ≤ 8 KiB；读数原样入 `readings.md`。

## Acceptance Criteria

- [x] **AC-1** 新页存在、被 router 指向、被 index 列出；`spec-context-budget` 与 `document-drift` 全绿。
- [x] **AC-2** 新页 `##` 标题与 `expectedHeadingsBySpec` 逐字一致。
- [x] **AC-3** 原始三条需求与目的在页内（带锚点），且"文件即 API"在两页各出现一次并互指。
- [x] **AC-4** 四个术语与"本项目在第 2 级、第 3 级不作交付目标"在页内。
- [x] **AC-5** 三平面 + 那条不变量在页内，且写明"本仓就是 Plane A"。
- [x] **AC-6** 操作者的供给 / 读 / 决定三件事在页内，并指到 use-time §5。
- [x] **AC-7** 七步与仪器**只以链接出现**（页内不重述步骤内容），缺的三件各带仓库自己的引用。
- [x] **AC-8** Experiment 0 三条判据 + 成本 + 证伪条件在页内；每个缺口点名归属。
- [x] **AC-9** 三条门禁读数入 `readings.md`，含既有 fail 的归因。

## Out of Scope

- **不动 `personal-agent-harness-loop.md`**（它只剩 5 字节；本页不重述它）。
- 不把本页写成 runbook 或操作手册；不写"更好用"类主张。
- **不修 spec 树的清理件**（重复块、`readTemplate`、两个 index 的模板句、不适用标题）——用户已定"修可证明的缺陷、不动方向"，但排在本页之后做，否则会与本次页面改动互相覆盖。
- 不改产品代码。

## Open Questions

无阻塞项。用户已裁决：**产品面两面并列**（① 人用它干活 → 现有两页；② 它改自己 → 本页）；并同意开 task。
