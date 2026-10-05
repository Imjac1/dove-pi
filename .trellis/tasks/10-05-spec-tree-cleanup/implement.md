# 执行计划：spec 树清理件

> 小活，但每一步都要**用改动前那套命令复测**（命令与原读数都在 `research/defects.md`）。顺序：量基线 → 四处修 → 复测四个计数 → 门禁 → 提交。

## P0 · 量基线

```powershell
git status --porcelain
npm run typecheck
npm test
npm run test:installer
```

四条读数写进 `readings.md`（含既有那条 `pi-adapter` fail 的长度值，它随 task 产物的进出移动，已有七次观测）。**顺手删掉 `task.py create` 生成的 `check.jsonl` 里的 `_example` 行**——不，本次是空清单，按 P4 填真条目。

## P1 · 跨层指南：重复标题

1. 删第二份块：`283-350`（Cross-Platform 283-297 · Generated Runtime 298-326 · Mode-Detection 327-350），删除前先确认 351 行是 `## When to Create Flow Documentation`（边界锚）。
2. Cross-Platform 第一份的标题 `## Cross-Platform Template Consistency` → **改成与正文相符**（它讲 launcher 与原生包边界）。

```powershell
Select-String -Path .trellis\spec\guides\cross-layer-thinking-guide.md -Pattern '^## ' | Group-Object Line | Where-Object Count -gt 1   # 期望空
```

**回退点**：`git checkout -- <file>` 一处即可。

## P2 · code-reuse 指南：删掉教不存在机制的那一节

从 `## Template File Registration (Trellis-specific)`（193）删到文件尾（含 `### Quick Checklist for New Scripts`、`### Template Sync Convention`）。

```powershell
Select-String -Path .trellis\spec\guides\code-reuse-thinking-guide.md -Pattern 'readTemplate|src/templates|getAllScripts'   # 期望空
```

## P3 · 两个 index 的模板句

第 3 行改成**事实句**：backend 写"这个目录的规格索引，以及每一条指向哪一层"，frontend 同义。**不改标题、不改表格**（`document-drift` 的 index↔目录双向检查必须仍绿）。

## P4 · 四个不适用标题改成实际标题（正文不动）

- `database-guidelines.md`：`## Query Patterns` → 讲"状态怎么读"的标题；`## Migrations` → 讲"版本与原子替换"的标题。
- `frontend/state-management.md`：`## When to Use Global State` → 讲"共享状态什么时候引入"；`## Server State` → 讲"没有远端状态缓存"。

```powershell
git diff --stat .trellis/spec/backend/database-guidelines.md .trellis/spec/frontend/state-management.md   # 只应有标题行的增删
```

## P5 · 填两个上下文清单

`implement.jsonl` / `check.jsonl` 各填真条目（本轮的真值是 `research/defects.md` 与两个 index 页），然后：

```powershell
python ./.trellis/scripts/task.py validate 10-05-spec-tree-cleanup
```

## P6 · 复测与门禁

```powershell
node --import tsx --test tests/spec-anchors.test.ts tests/document-drift.test.ts tests/spec-context-budget.test.ts
npm run typecheck ; npm test ; npm run test:installer
```

四个计数按 `research/defects.md` 的同一套命令复测，**逐条写进 `readings.md`**（改动前值 → 改动后值）。只允许"文档侧变化"这一种差异。

## P7 · 提交

两个提交：① 四处缺陷的修（跨层指南 + code-reuse + 两个 index + 四个标题）② 本 task 记录。工作提交在前，归档与 journal 留给 `/finish-work`；不 amend、不 push。

## 刻意不做

- **不删残留的外来段落**（Generated Runtime 与 Mode-Detection 各剩一份）——那是方向问题，见 prd 的 Open Questions。
- 不改层名 `frontend`；不重写 guides；不碰 `harness-loop.md`；不修既有 fail。
