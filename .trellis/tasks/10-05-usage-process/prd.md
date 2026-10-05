# 整套使用过程的设计

## Goal

给**整条使用过程**一份被路由与被门禁绑住的设计页 `.trellis/spec/backend/personal-agent-usage.md`：从装上到维护的**阶段 0–6**，每个阶段写清四件事——**用户做什么 · 产品替用户决定什么 · 这一步防的具体失败 · 现状（有读数，还是缺口 + 归属任务）**。产品页 §3 从"唯一一份叙述"改成"记录 + 指向设计"。

**可交付的判定**：新页进 router 与 `backend/index.md`；阶段 0–6 全在，**没有一个阶段的"防的具体失败"是空的**（空的一步不许进页面）；每个缺口点名归属；设计动作全部落在四个可塑形的面之内；三道门禁读数不降。

> 语言：本文件、`design.md` 用中文（需要你审）；**规格页与被测试逐字钉住的标题用英文**（`backend/index.md` 要求英文）。

## Background（已确认的事实，全部实测或引用）

**为什么需要这一页**：`usage model / 怎么用 / 使用方式 / 用户旅程 / day one / day two / 首次接触` 在 spec 与当前 task 里**实测 0 处** —— 使用流程**从来没有被设计过，只被记录过**（产品页 §3 是记录，它自己也标着哪一步尚未被证明）。

**两条硬约束**：

1. **设计只有四个可塑形的面**（产品页 §2 的 D1/D2）：Dove 能决定的只有 ① 加载什么（上下文、目标续接、项目记忆）② 拒绝或询问什么（工作模式的 `permissions.yaml`，在 `tool_call` 边界）③ 报告什么（终止对象、`/status full`、`doctor`）④ 写什么产物（`.dove/state.json`、`.dove/tasks/<id>/`、执行账本）。循环与工具是 Pi 的（18 个 `pi.on(...)`、无 loop 体 —— `personal-agent-use-time-architecture.md:11`）。**超出这四面的动作不在本层可设计。**
2. **每一步必须点出它防的特定失败**（归档研究 `09-26-dove-agent-harness-capabilities/research/community-wave-what-it-changes.md:96-103`）：*"the harness is almost never the independent variable"* ⇒ "这样 agent 更好用"是**没有证据的**；可辩护的说法每条都要点名它防住的失败。**这条同时是这一页的验收标准。**

**预算（实测）**：产品页 **20 196 B / 24 576**，只剩约 4.4 KB ⇒ 整条过程的设计**塞不进产品页**，必须自成一页。

**各阶段的现状（已收入 `readings.md` 与页面的"现状"列）**：

| 阶段 | 现状读数 | 出处 |
|---|---|---|
| 0 装上 | `doctor` 默认给人看的摘要**已修**（一次改动关 P4/P5/P6 + P1 的一半） | 提交 `364c66e` |
| 1 第一次进项目 | 有读数（安装、启动、凭据在 Pi 用户目录） | `README.md:99-113` |
| 2 第一次真实工作 | 文档有路由规则，**整条未在一次运行里走完** | `README.md:199-204`；`.trellis/tasks/10-05-whole-flow-end-to-end/readings.md` |
| 3 被拒绝或被问 | 拒绝理由**已修**为无 UI 也可见（`31f5cae`）；**模式前置条件仍只能靠撞墙发现**；非交互斜杠命令是**宿主侧**限制，守卫已撤回 | 提交 `31f5cae`；`.trellis/tasks/10-03-mode-prerequisites`；`.trellis/tasks/10-03-first-contact-scenario/findings.md` |
| 4 正式任务闭环 | 机制在（`task-convergence.ts`、`agent_task_convergence`）；**本仓没有 `.dove/`，从未完成一个记录回合** | `personal-agent-use-time-architecture.md:85` |
| 5 第二天 | **空的**：continuation 未被读 | `.trellis/tasks/10-03-day-two-walk/prd.md` |
| 6 维护 | 有读数（旧/新 Pi 版本、失败保留旧版本、卸载保留用户与项目数据） | `README.md:294-297`、`README.md:414-430` |

**宿主侧的两个已知缺口**（设计必须点名，不假装可设计）：`hashlineEditTools=absent`（那条运行的 agent 改不了文件，属宿主）、`-p` 下斜杠命令在宿主侧被处理（`.trellis/tasks/10-05-missing-hashline-edit-tool`、`findings.md` 的"C 斜杠命令"条）。

**门禁会绑住新页**（已读源码）：`tests/spec-context-budget.test.ts` 的 `routedSpecNames`（顺序 = router 里的顺序）与 `expectedHeadingsBySpec`（`##` 逐字 `deepEqual`）；router 只能有 3 个 `##` 标题、不得含围栏代码块，≤ 8 KiB；每页 ≤ 24 KiB；`tests/document-drift.test.ts` 要求 index 与目录双向相等、backend 里点名的路径存在。

## Requirements

- **R1 落点** = `.trellis/spec/backend/personal-agent-usage.md`（用户已选"自成一页"），进 router、`backend/index.md` 与 `routedSpecNames`。**不新建 spec 目录**。
- **R2 覆盖整条过程**：阶段 0 装上 · 1 第一次进项目 · 2 第一次真实工作 · 3 被拒绝或被问 · 4 正式任务闭环 · 5 第二天 · 6 维护（用户已定"整套使用过程"）。
- **R3 每阶段四列齐全**：用户做什么 / 产品替用户决定什么 / **防的具体失败** / 现状（读数或缺口 + 归属）。**"防的具体失败"为空 ⇒ 该阶段不许进页面**；写不出来就如实写"这一步防什么尚未说清"，而这本身就是缺口。
- **R4 设计只落在四个可塑形的面上**；越界的动作写"不在本层可设计"并点名真正的归属（Pi 或宿主）。
- **R5 每个缺口点名归属**：现有任务目录名，或"无归属 ⇒ 需要新开"。
- **R6 产品页 §3 改为指向设计页**，其"已证 / 未证"标记**保留**；两侧不重复叙述（记录在 §3，设计在新页）。
- **R7 不写"更好用"类主张**：不声称任何未被证明的能力；沿用产品页的 `[demonstrated] / [not yet demonstrated] / [unverified]` 标记制。
- **R8 门禁不下降**：`npm run typecheck` 0、`npm test` 0 fail、`npm run test:installer` OK；新页 ≤ 24 KiB、router ≤ 8 KiB；读数原样记录（含既有那条与本轮无关的 fail）。

## Acceptance Criteria

- [x] **AC-1** 新页存在、被 router 指向、被 `backend/index.md` 列出；`spec-context-budget` 与 `document-drift` 全绿。
- [x] **AC-2** 新页 `##` 标题与 `expectedHeadingsBySpec` **逐字一致**（英文、编号、顺序）。
- [x] **AC-3** 阶段 0–6 齐备，每阶段四列齐全，**"防的具体失败"无一为空**（写不出来者按 R3 如实标注为缺口）。
- [x] **AC-4** 每个缺口点名归属（现有任务目录名或"需新开"）。
- [x] **AC-5** 每个设计动作可归入四个面之一；越界者写明"不在本层"并点名归属。
- [x] **AC-6** 产品页 §3 指向设计页并保留标记；产品页仍 ≤ 24 KiB。
- [x] **AC-7** 新页点名的每个路径真实存在（backend 被 `specPathProblems` 覆盖）。
- [x] **AC-8** 三条门禁读数写进 `readings.md`，含既有 fail 的归因。

## Out of Scope

- **不改产品代码**：本轮只产出设计 + 缺口归属，不顺手动实现（那三个已知缺口各有归属）。
- 不设计 Pi 的循环或工具（D1 明令），也不设计宿主侧行为。
- 不重写 `README.md`，不做用户手册。
- 不把 `10-03` / `10-05` 里那些独立缺陷挪进本轮（只点名归属）。

## Open Questions

无阻塞项。用户已裁决两件：**目标 = 整套使用过程**（非仅第一天）；**落点 = 自成一页的设计，产品页 §3 指向它**。其余取舍（标题清单、§3 的收缩方式、缺口的归属表述）由 `design.md` 给出，供你审。
