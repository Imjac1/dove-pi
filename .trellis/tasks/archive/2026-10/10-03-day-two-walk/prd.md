# A real user's second day: continuation, and what the capabilities cannot tell you

## Goal

Simulated a user returning to the same project the next day. Read what survived, ran a real second task, and fixed findings on the spot. Readings: an unchanged mode declaration stops every tool but explains itself exactly; yesterday's work was finished and never committed; the agent caught that the change contradicts the project's declared engine floor, and the model's claim that upstream did the same is false; agent_task_convergence refused until a formal task existed, and agent_project_task then wrote a PRD whose acceptance criteria are a placeholder. Continuation itself is still unread.

## 规划：这一轮只剩**一个读数**

读它在 `.trellis/tasks/10-03-day-two-walk/readings.md` 自己的四条发现，三条已处置完毕，**只有第 4 条没读**：

| 发现 | 现状 |
|---|---|
| 昨天那件活做完了却没提交 | **当场解决**（agent 干净地提交了它） |
| 项目自己声明的约束（`engines`）没被当作判分的一部分 | **当场解决**（写进 `code-development` 第 1 条方法） |
| 能力的前置条件与后续步骤只能靠撞 | **已开任务** → `10-03-capability-preconditions`；该 task 于 **2026-10-05 并入台账** `.trellis/spec/guides/defect-ledger.md` §3（它的 Requirements/AC 从未写出来） |
| **延续到底成不成** | **未读** —— 上一轮那个 `--continue` 回合跑了 21 分钟无输出，被中止；读数自己写着"下一次用一个更小的提示词重问 → 一句话就能定" |

所以本任务**不是重跑走查**，而是把**最后那一个读数**拿到，并让产品页的那一行有结论。

## Requirements

- **R1 只读"延续"这一件事**：同一会话 + `--continue`，提示词**小到能在一分钟内定**（上一轮 21 分钟无输出的那条路不走）。
- **R2 判据沿用第二轮的方法**（不许放宽）：会话开头问"上一次我们做到哪了"→ 回答**要么说中**（报出真实做过的事、含真实提交号）**要么明说不知道**；**猜**——包括编造提交号——记为**失败**。
- **R3 原始输出优先**：把回答**逐字**记下，连同耗时与退出码；长静默若再现，**记它，不猜原因**（上一轮就是这么处理的）。
- **R4 结论必须落到页上**：`.trellis/spec/backend/personal-agent-usage.md` 第 8 阶段与 §10 的行按结果改写——成 ⇒ 写明判据与这一次的读数；不成 ⇒ 该行改为指向台账并写明"未成立 + 原因"。
- **R5 不发明场景**：用**同一个草稿克隆**里第二件真事留下的会话，不新造一个项目。
  **实测偏离（2026-10-05，如实记）**：那个草稿克隆**已经不存在**（`D:\aixi` 整个没了，实测 `Test-Path` 为假）⇒ 改用**本仓自己的仪器**（黑盒 `scripts/real-dove-blackbox.mjs --launcher source --provider real` ＋ 宿主直跑）与一个**新建的最小被探项目**（一个 `sum` 函数 + 一条用例 + 一次初始提交）。**偏离的是"项目从哪来"，不是问题与判据**：问的还是同一句话，判据还是"说中 / 明说不知道 / 猜=失败"。
- **R6 两处引文回填**：`readings.md` 里那条"已开任务 `10-03-capability-preconditions`"补一句现状（已并入台账 §3）；本 prd 的 Goal 原文**保持逐字不动**（它是当时读数的一部分）。

## Acceptance Criteria

- [x] **AC-1（R1）** 一次续跑回合，提示词写明在 `readings.md` 里；**耗时与退出码**被记下（宿主直跑：**15 s / exit 0**；另两种情形 138 s / 65 s / 236 s，各 exit 0）。
- [x] **AC-2（R2）** 回答被**逐字**记下并判成三者之一：**说中** —— 函数 `max`、用例两边分支、`npm test` 两条通过、提交号 **`5f2370b`**（与第一跑自己的交代逐项一致）；另两种情形都是**明说不知道**（不是猜）。
- [x] **AC-3（R4）** 使用过程页第 8 阶段与该页 §10 已按结果改写：阶段行 `[not yet demonstrated]` → `[demonstrated]`（含三种情形与"承载它的是宿主的会话，不是 `.dove/` 记录"），§10 那一行换成**产品自己的设计缺口**（"第二天的设计仍是宿主的，不是 Dove 的"）。
- [x] **AC-4（R6）** 两处引文已回填（`readings.md` 里 `10-03-capability-preconditions` 那条补了现状）；**Goal 原文逐字未改**。
- [x] **AC-5** 三道文档门 **21/21**；本轮只加读数与页面文字，产品代码未动。

## Out of Scope

- **不重跑**第二天的整套走查（它的四条发现里三条已处置）。
- **不修**那三条已处置的发现（各有归属：两条当场解决，第三条在台账）。
- **不动** `10-03-capability-preconditions` 的内容（它已归档；要复活它就从台账里**取出来**，那是台账的规则）。
