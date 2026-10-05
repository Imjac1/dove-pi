# spec 树里可证明的缺陷

## Goal

清掉四处**可证明**的缺陷：**同一标题出现两次**（跨层指南）、**教一个本仓不存在的机制**（`readTemplate` 与 Trellis 模板注册那一节）、**两个 index 的模板句**、**对着不存在的数据库与 server 的标题**。**不动方向、不改层名、不重写 guides。**

## Background（全部实测；命令与原始读数在 `research/defects.md`）

1. **跨层指南的重复标题**：15 个 `##` 只有 12 唯一——`Cross-Platform Template Consistency`（126 与 283）· `Generated Runtime Template Upgrade Consistency`（185 与 298）· `Mode-Detection Probe Checklist`（257 与 327）各出现两次。
   **三对副本内容并不相同**（3,002 vs 758 · 1,817 vs 1,392 · 2,326 vs 2,324 字符）⇒ "删一份"必须有判据，判据是**它讲的是谁**：
   - Cross-Platform **第一份**讲 **Windows launcher 与原生包边界** → 本仓存在（`bin/dove-pi.cjs`、`install.ps1` 均 True），**属于本仓，但标题与正文不符**；
   - Cross-Platform **第二份**讲 **Trellis 的命令模板**（`src/templates/*/commands/trellis/`，实测**不存在**）→ 讲另一个代码库；
   - Generated Runtime **两份**都以 "In Trellis" 开头，讲 `get_context.py` / `workflow_phase.py` / `trellis update` → 讲**工具本身**；
   - Mode-Detection **两份**几乎相同（差 2 字符），讲"CLI 靠探测远端资源决定 marketplace vs direct download" → 讲**工具本身**。
2. **`code-reuse-thinking-guide.md` 教一个不存在的机制**：`## Template File Registration (Trellis-specific)`（193）与其两个 `###`（208 / 215）一直写到文件尾（223）。它点名的 `src/templates/trellis/index.ts`、`src/commands/update.ts` **不存在**，`getAllScripts` 在源码里 **0 处**，`packages` 也不存在；`readTemplate` 在 spec 里 1 处（`:199`）、源码 0 处。
3. **两个 index 第 3 行都是模板句**：`> Best practices for backend development in this project.` 与同款 frontend 句（各 1 处）。
4. **不适用标题**：`database-guidelines.md` 有 `## Query Patterns` / `## Migrations`（该页第一句自己就写着没有 DB/ORM）；`frontend/state-management.md` 有 `## When to Use Global State` / `## Server State`（没有 server）。两处各 **2** 个标题。

## Requirements

- **R1 三对重复标题各只留一份，判据是"它讲的是谁"**（用户 2026-10-05 追加裁决：连残留一起清）：
  - Cross-Platform：留**第一份**（本仓内容）、删第二份；
  - Generated Runtime：**两份都删**（两份都以 "In Trellis" 开头，讲的是工具本身）；
  - Mode-Detection：**两份都删**（两份都讲"CLI 靠探测远端资源决定 marketplace vs direct download"）。
- **R2** Cross-Platform 第一份的**标题改成与正文相符**（它讲的是 launcher 与原生包边界，不是"模板一致性"）。
- **R3** 删掉 `code-reuse-thinking-guide.md` 里从 `## Template File Registration (Trellis-specific)` **到文件尾**的那一节（含两个 `###`）。
- **R4** 两个 index 的模板句改成**事实句**（不再写 "Best practices for ... in this project"）。
- **R5** `database-guidelines.md` 的 `Query Patterns` / `Migrations`、`state-management.md` 的 `When to Use Global State` / `Server State` **改成与内容相符的标题，正文不动**。
- **R6** 每一处删除或改名，都在 `readings.md` 里写明**证明它的那一句测量**（路径不存在 / 0 处命中 / 标题与正文不符）。
- **R7** 门禁不下降；`document-drift` 的 index↔目录双向检查保持绿。

## Acceptance Criteria

- [x] **AC-1** 跨层指南的重复二级标题 **0** 处（`Group-Object Line | Where Count -gt 1` 输出为空）。
- [x] **AC-2**（**按实测收窄，2026-10-05**）本轮删除的部分里 `readTemplate` / `src/templates` 归零：`code-reuse` 指南内两者均为 **0**。**残留（按 Out of Scope 只报不改）**：`src/templates` 仍在 **1** 处、`getAllScripts` 仍在 **2** 处——分别位于 `cross-layer` 的 `### Checklist: After Modifying Any Command Template`（未点名的子节）与 `code-reuse` 的 real-example 段（未点名章节的正文）。
- [x] **AC-3** 两个 index 里模板句 **0** 处。
- [x] **AC-4** 那四个不适用标题各改成实际标题，且**正文未动**（改动只有标题行）。
- [x] **AC-5** 每处删除 / 改名在 `readings.md` 有测量依据。
- [x] **AC-6** 三条门禁与文档门的读数不降（含既有那条 fail 的如实记录）。

## Out of Scope

- **同一条判据在指南其余章节上的结果只报不改**：本轮按裁决清掉三对副本（含残留的两份）；若**其余章节**也命中"点名的路径在本仓 0 处"，**本轮只测量并报告，不动它们**——把范围一次扩到整份指南是另一件事。
- 不改 `frontend` 这个层名（改名牵动 index 与全部引用）。
- 不重写 guides、不动 `harness-loop.md`（剩 5 字节）、不修既有 fail、不碰改进页 §10 的六个缺口。

## Resolved

- **2026-10-05 用户裁决**：残留的两份"讲工具"段落**一起清掉**（R1 已按此改写）。

