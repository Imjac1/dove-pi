# 执行计划：操作者那条主线

> 顺序：**量基线 → 标题定稿 → 三处同步 → 写 §2–§10 → 两页各加一句引 → 门禁 → 提交**。

## P0 · 先量基线

```powershell
git status --porcelain
npm run typecheck
npm test
npm run test:installer
```

四条读数（含时间）原样写进 `readings.md`。已知本仓有一条与本轮无关的 fail（`tests/pi-adapter.test.ts:253`，`agent_project_context` 索引长度；上一次量到 22 041）——基线里如实记，**并记这个数字当时的树状态**（它会随 task 产物变动而移动，这本身已有四次测量）。

**回退点**：无（只读）。

## P1 · 标题定稿

按 `design.md` §2 的 11 个字符串先写骨架。

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-improvement-run.md -Pattern '^## '
```

输出必须与清单逐字、同序一致（含末尾不带编号的 `How to check this page`）。

## P2 · 三处同步

1. `tests/spec-context-budget.test.ts`：数组 +1（**位置 = router 里的位置**）、`expectedHeadingsBySpec` +1
2. `personal-agent-runtime.md`：路由表 +1 行、选择规则 +1 条（不新增 `##`、不加围栏块）
3. `backend/index.md`：+1 行

```powershell
node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts
```

## P3 · 写 §2–§4（原始需求 / 术语与档位 / 三平面）

**锚点来源，按需手读**：`09-30-axi-program/plan.md` §0.1–§0.3（**不注入**：实测 63.3 KB，超过 `context_injection.max_file_bytes`=32 768，注入只会拿到被截断的半份）与 `09-30-substrate-choice/framework.md` §3（三平面图，22 KB，可注入）。

规则：**每条都要能指到行**；找不到原话的，写"这一条找不到原话"并标 `[unverified]`，**不许替它编出处**。

## P4 · 写 §5–§10（操作者 / 仪器与缺口 / Experiment 0 / 成本 / 证伪 / 现状与归属）

- §6 **只列缺的三件**，七步与已有仪器**只以链接出现**（`design.md` 契约 1）
- §7 判据 + **失败后果**同节（契约 3）
- §8 成本单独成节、排在 §9 证伪之前（契约 4）
- §10 归属只允许"现有任务目录名"或 `needs a task`（契约 5）

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-improvement-run.md -Pattern 'First we mine|step 1|第一步'   # 期望无输出（未复述七步）
```

## P5 · 两页各加一句"文件即 API"的引（R10）

产品页加一处（指向本页）、使用页 §2 加一处；**只说纪律，不复述流程**。

```powershell
node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts
```

## P6 · 门禁

```powershell
npm run typecheck
npm test
npm run test:installer
```

与基线逐条对比；只允许"文档侧变化"这一种差异。三条预算一并记（新页 ≤ 24 KiB、目标 ≤ 14 KiB；router ≤ 8 KiB；产品页 20 494 → 检查仍在 24 KiB 内）。

## P7 · 提交

按"一次逻辑改动 = 一次提交"：① 新页 + 三处同步 ② 两页的引 ③ 本 task 记录。工作提交在前，归档与 journal 留给 `/finish-work`；不 amend、不 push。

## 刻意不做

- **不动 `personal-agent-harness-loop.md`**（剩 5 字节）。
- **不修清理件**（重复块、`readTemplate`、index tagline、不适用标题）——排在本页之后，单独一个 task。
- 不改产品代码。
