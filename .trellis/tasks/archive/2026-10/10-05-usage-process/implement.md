# 执行计划：整套使用过程的设计页

> 顺序不可交换：**量基线 → 标题定稿 → 三处同步 → 写阶段 → 缺口归属 → 产品页指针 → 门禁 → 提交**。每步有独立验证与回退点。

## P0 · 先量基线（不许跳过）

```powershell
git status --porcelain
npm run typecheck
npm test
npm run test:installer
```

四条读数（含时间）**原样**写进 `readings.md`。已知本仓此刻有一条与本轮无关的 fail（`tests/pi-adapter.test.ts:253`，`agent_project_context` 索引长度 21 032 > 20 000）——基线里如实记下；**也记下 `test:installer` 是否真的跑了**（上一个 task 在这里漏测过一次）。

**回退点**：无（只读）。

## P1 · 标题定稿

按 `design.md` §2 的 12 个字符串先写骨架（`# ` + 12 个 `## ` + 每节一句占位）。

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-usage.md -Pattern '^## '
```

输出必须与清单**逐字、同序**一致（含末尾不带编号的 `How to check this page`）。

**回退点**：骨架可整段重写，不牵动其它文件。

## P2 · 三处同步（顺序敏感）

1. `tests/spec-context-budget.test.ts`：`routedSpecNames` 加 `"personal-agent-usage.md"`，**位置 = 它在 router 里的位置**；`expectedHeadingsBySpec` 加对应 key 与标题数组
2. `.trellis/spec/backend/personal-agent-runtime.md`：路由表 +1 行、选择规则 +1 条（**不新增 `##`、不加围栏代码块**）
3. `.trellis/spec/backend/index.md`：Guidelines Index +1 行

```powershell
node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts
```

**回退点**：三处各自独立；`deepEqual` 失败时**只改 router 或只改数组之一**。

## P3 · 写阶段 3–9（每阶段四列）

按 `design.md` 契约 1 的四列写；**"防的失败"必须能锚**（`design.md` 契约 4；来源限定在：`findings.md`、各 `readings.md`、`README.md`、`AGENTS.md`、spec 页）。

写不出来时按 R3 **如实写成缺口**，不填"提升体验"。

**回退点**：按阶段回退，互不影响。

## P4 · §2 四个面 + §10 缺口归属

- §2 把四个可塑形的面与两条"不可设计"（Pi 的循环与工具、宿主侧行为）写成表（`design.md` 契约 2）
- §10 每个缺口二选一：**现有任务目录名** 或 **needs a task**（`design.md` 契约 3）

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-usage.md -Pattern 'needs a task|10-0[0-9]-'
```

**回退点**：§10 独立。

## P5 · 产品页 §3 加指针（DD2）

在 §3 表格上方加一行指向 `.trellis/spec/backend/personal-agent-usage.md`，**不删那 10 行记录**。

```powershell
node --import tsx --test tests/document-drift.test.ts   # 两页的路径都必须存在
```

**回退点**：单行回退。

## P6 · 门禁

```powershell
npm run typecheck
npm test
npm run test:installer
```

与 P0 基线逐条对比：**只允许"文档两侧变化"这一种差异**；出现别的变化就回去查，不许把新红算成"既有失败"。两条预算读数一并记（新页 ≤ 24 KiB，目标 ≤ 16 KiB；router ≤ 8 KiB）。

## P7 · 提交（Phase 3.4 的批处理流程）

按"一次逻辑改动 = 一次提交"分组（预计：① 设计页 + 三处同步 ② 产品页指针 ③ 本 task 记录）；工作提交在前，归档与 journal 留给 `/finish-work`；**不 amend、不 push**。

## 刻意不做（写给评审）

- **不给"防的失败非空"写机械检查**：它是散文列，写解析器等于给一个没有读者的仪器；页面自己在 `How to check this page` 里写明"这条没有仪器"，并把 review 留给 check 子代理（`design.md` §4、§6）。
- **不改产品代码**：三个已知缺口各有归属（`10-03-mode-prerequisites`、`10-05-whole-flow-end-to-end`、`10-05-missing-hashline-edit-tool`）。
- **不碰 `README.md` 与 `plan-v8.md`**：不属于本轮。
