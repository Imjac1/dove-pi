# 缺陷台账：把"实测过、从未规划"的缺陷汇成一页，再归档那七个 task

## Goal

把**七个"Goal 有实测、Requirements/AC 仍是 TBD"的 task** 汇成一页台账 `.trellis/spec/guides/defect-ledger.md`，然后归档那七个 task 目录——让未归档区只留**真在做的事**，而测量与 `file:line` 锚点**一个字不丢**。台账被引用门走（`spec-anchors` 解析每一条 `path:line`），所以它的锚点不能静默腐烂。

## Background（分诊判据与实测）

- 用户要求：**"其他东西有必要留下吗，没必要留下就全归档了，有必要的就做"** → 逐桶分诊，能证伪的退役、真缺陷留。
- 判据一：**这个缺陷还在不在**（可静态查的查代码）。据此退役两个：`10-03-dead-enforceable-constant`（已被一张表取代）、`10-03-host-tool-surface-sources`（第三份硬编码清单没了，只剩一处声明 + 测试 + AGENTS.md 规则行）。
- 判据二：**从未规划** = prd 里还有 `TBD`。实测 **10 个**，其中 `10-03-day-two-walk` 与 `10-03-mode-prerequisites` **被 spec 页点名**（归档会让页面说谎）⇒ 台账收 **7** 个：
  `09-29-report-blocker` · `10-03-bare-line-anchors` · `10-03-capability-preconditions` · `10-03-unlocated-engine-crash` · `10-03-unproducible-action-names` · `10-04-empty-effect-classes-pentest-trading` · `10-05-divergent-records-unreconciled`
- 台账每条的四个字段：**题名 · 逐字的实测 · 出处（归档路径）· 拿什么才算结**；页首写明"**这里的东西没人在做**"，并写明取用规则（变成 task 时**同时从本页删掉**）。

## Requirements

- **R1** 台账落 `.trellis/spec/guides/defect-ledger.md`，并在 `guides/index.md` 里列出（index↔目录双向由 `document-drift` 检查）。
- **R2** 七条各带：题名 · **逐字实测**（含原有 `file:line`）· 出处 · **拿什么才算结**。
- **R3** 出处指向**归档后**的路径，因此**先归档、后跑门**（顺序是判据，不是偏好）。
- **R4** 页首声明"没人在做"，并写明取用规则；`10-03-unlocated-engine-crash` 一条如实标成**记录而非任务**（无可指认的修法）。
- **R5** 顺手修 `guides/index.md` 里那处**断掉的表行**（Cross-Layer 那行被截断，尾巴跑到了下一行）。
- **R6** 门禁不下降；归档税如实记录。

## Acceptance Criteria

- [x] **AC-1** 台账存在、被 `guides/index.md` 列出；`spec-anchors` 与 `document-drift` 全绿（**21/21**）。
- [x] **AC-2** 七条齐备，每条四字段齐全；`bare-line-anchors` 与 `unproducible-action-names` 带上 2026-10-05 的**复查读数**。
- [x] **AC-3** 七个 task 已归档 → `.trellis/tasks/archive/2026-10/<name>/`，且台账的出处路径**全部可解析**。
- [x] **AC-4** 未归档 task 从 **28 降到 20**（本次 7 个 + 判据一退役的 1 个）；两个"被引用但仍 TBD"的 task 保留，并在报告里点出"页面引用的 owner 只是个未规划的壳"。
- [x] **AC-5** 归档税 **0**（七份清单没有一个指向自己目录）；坏指针仍是 **3**（与 AGENTS.md 记的一致）。
- [x] **AC-6** `guides/index.md` 的断行已修。

## Out of Scope

- 不给台账里的缺陷写 Requirements/AC（那才是"规划"，是另一件事）。
- 不动 `10-03-day-two-walk` 与 `10-03-mode-prerequisites`（被页面引用）——只在报告里点出它们也是 TBD。
- 不动既有的 3 条不可修复坏指针、那条索引长度 fail、`harness-loop.md` 的 5 字节。
