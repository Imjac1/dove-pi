# 设计：操作者那条主线

## Scenario: The operator's thread, written next to the user's

### 1. Scope / Trigger

触发条件：**新增一份被路由的规格页**，并轻触两页现有规格——属于跨层文档契约变化（router、index、测试数组、三页内容必须同时动）。按契约深度写：标题清单逐字、**不重述契约**、验证矩阵、测试点、Wrong/Correct 各一对。

### 2. Signatures

**新文件**：`.trellis/spec/backend/personal-agent-improvement-run.md`（硬上限 24 576 B；目标 ≤ 14 KiB）

**`##` 标题清单（逐字，被 `expectedHeadingsBySpec` 钉住，顺序敏感）**：

```
1. What this page is, and what it is not
2. What was asked for: three requirements, and the object this is meant to become
3. Where this sits among the terms: what may move, and what must not
4. The three planes, and the one relationship that bounds them
5. What the operator supplies, reads, and decides
6. The instruments that exist, and the three that do not
7. Experiment 0, and what it decides
8. The cost, stated before anyone builds it
9. What would falsify this
10. Where this stands, and who owns each gap
How to check this page
```

**同步改动三处**：

| # | 文件 | 改什么 |
|---|---|---|
| 1 | `tests/spec-context-budget.test.ts` | `routedSpecNames` 加 `"personal-agent-improvement-run.md"`（位置 = router 里的位置）；`expectedHeadingsBySpec` 加同名 key 与上面这份数组 |
| 2 | `.trellis/spec/backend/personal-agent-runtime.md` | 路由表 +1 行、选择规则 +1 条；**不得新增 `##`、不得出现围栏块** |
| 3 | `.trellis/spec/backend/index.md` | Guidelines Index +1 行 |

**轻触两页（R10，各一处，不重述流程）**：

| # | 文件 | 改什么 |
|---|---|---|
| 4 | `.trellis/spec/backend/personal-agent-product.md` | 加一句"文件即 API"的引，并指向本页（主线②） |
| 5 | `.trellis/spec/backend/personal-agent-usage.md` | 同上，写在 §2 四个面之后（同一条纪律，两处各引一次） |

### 3. Contracts

**契约 1 · 这一页不重述七步（最重要的约束）。**
`personal-agent-harness-loop.md:188-207` 已经写下七步、脚本名与三个 `operation`，而那一页**只剩 5 字节**（24 571 / 24 576）。因此：

- 本页提到回合时**只能链接**（``[`personal-agent-harness-loop.md`](./personal-agent-harness-loop.md)``），**不得复述**任一步的内容；
- 本页的增量被限定为七件：原始需求与目的 · 四个术语与档位 · 三平面与不变量 · 操作者的供给/读/决定 · **缺的三件仪器** · Experiment 0 · 成本与证伪条件 · 现状与归属。
- 违反的样子：本页出现第二条"第一步是…"的叙述——那就是两个真值来源。

**契约 2 · 四个术语逐字引自 `plan.md`，档位是**有证据的声明**。** 术语表（`plan.md:71-76`）与"本项目在第 2 级、第 3 级不作交付目标"（`plan.md:81`）必须连引用一起出现；不许写"我们要做 RSI"。

**契约 3 · Experiment 0 必须连失败后果一起写。** 三条判据（`framework.md:170-178`）+ 判据失败时"框架退化成：人是那个固定点、边界是纪律"。**只写判据不写后果，等于把前置条件写成形式**。

**契约 4 · 成本单独成节并排在证伪之前**（`framework.md:188-190` 说它"应该在任何人为它动手之前被说出来"）：AHE 89 任务 × 9 轮；一个任务的一次运行不是 benchmark。

**契约 5 · 缺口归属只允许两种写法**：一个现有任务目录名，或 `needs a task`。

**契约 6 · 标记制沿用**：`[demonstrated] / [not yet demonstrated] / [unverified]`，每句带锚点。

### 4. Validation & Error Matrix

| 条件 | 期望 | 由谁报 |
|---|---|---|
| 新页加了、router 或数组没同步 | `deepEqual` 失败 | `spec-context-budget` |
| 标题差一字 | `unexpected contract inventory in personal-agent-improvement-run.md` | `spec-context-budget` |
| router 多一个 `##` 或代码块 | `keeps only routing structure in the router` | `spec-context-budget` |
| 新页 > 24 KiB 或 router > 8 KiB | 预算断言 | `spec-context-budget` |
| index 少一行 | `a specification index and its directory disagree` | `document-drift:288` |
| 新页点名不存在的路径 | `backend/personal-agent-improvement-run.md: <path>` | `document-drift:406` |
| **本页复述了七步** | 门禁**不会**报 | 人 / check 子代理（见 §6 的"没有仪器的那条"） |
| 两页里"文件即 API"写成流程的第二遍 | 门禁不报 | 同上 |

### 5. Good / Base / Bad Cases

- **Good**：11 个标题逐字命中；原始三条需求与目的逐字带锚点；四个术语与档位；三平面 + 不变量 + "本仓就是 Plane A"；操作者三件事指到 use-time §5；缺的三件各带引用；七步**只以链接出现**。
- **Base**：某节引用不到仓库的原话（例如"集大成者"只找到二手转述）——**如实写"这一条我找不到原话"**并标 `[unverified]`，而不是替它编一个出处。
- **Bad**：本页变成操作手册（逐步手册、命令清单）；或把七步抄一遍；或写"这样能让 agent 自己变强"（`framework.md` 与归档研究都已判定这类主张无证据）。

### 6. Tests Required

| 断言点 | 位置 |
|---|---|
| router 链接表与数组双向相等、全部可 `statSync` | `tests/spec-context-budget.test.ts#declares exactly the existing routed runtime specifications` |
| 每页 `##` 清单逐字一致 | `tests/spec-context-budget.test.ts#preserves the complete top-level contract inventory in its owning specifications` |
| router 只有 3 个标题、无围栏块 | `tests/spec-context-budget.test.ts#keeps only routing structure in the router` |
| 预算 | `tests/spec-context-budget.test.ts#keeps the router and every routed specification within the project budgets` |
| index 与目录双向相等 | `tests/document-drift.test.ts#lists every specification in the directory it indexes...` |
| 点名的路径存在 | `tests/document-drift.test.ts#names only paths that exist...` |

**没有仪器的那一条**（页面自己要写出来）：**"本页不得复述七步"没有机械检查**——它靠 review；`document-drift` 只看路径，`spec-context-budget` 只看形状。

### 7. Wrong vs Correct

#### Wrong

```text
## 3. The turn
First we mine the ledger with the failure reading, then we choose a surface, then we write the
prediction down before the edit...            ← 重述 harness-loop §4，两个真值来源
## 4. What this gives us
A harness that gets better every round.        ← 没有证据的通用性能主张
```

#### Correct

```text
## 4. The three planes, and the one relationship that bounds them
| Plane A, writable | this repository, the seven components at fixed mount points; apply = one commit,
  revert = git revert |
| Plane B, held out | the held-out split, the read-only verifier tree, the promotion gate, the human
  keep/revert |
| Plane C | the loop itself |
The relationship that makes it bounded: the improver's power is exactly Plane A minus Plane B.
One round, step by step, is written once in [personal-agent-harness-loop.md](./personal-agent-harness-loop.md) §4.
```

## Design decisions

**DD1 · 本页的增量是"座位"，不是"步骤"。** 七步已经在 spec 且那页只剩 5 字节；把七步抄一遍会制造第二个真值来源。所以本页写的是**操作者坐在这里看到什么、要做什么决定**。

**DD2 · 标题 11 条先定稿再动测试**（同上一次的理由：逐字 `deepEqual`）。

**DD3 · 四个术语必须连档位一起写。** 只列术语是词典；"本项目交付第 2 级、第 3 级不作交付目标"才是**有证据的声明**（三级测试 + `awesome-rsi` 的自认）。

**DD4 · Experiment 0 连失败后果一起写。** 判据 + "退化成纪律"两句必须同节出现，否则前置条件会被读成形式。

**DD5 · 成本单独成节、排在证伪之前。** 理由见契约 4：它要在任何人动手之前被读。

**DD6 · "文件即 API"落在三处但只说一次。** 本页 §2 说它、两页各加一句引并互指；**不复述流程**，因此不制造第三遍叙述。

## Risks & rollback

| 风险 | 观察方式 | 回退点 |
|---|---|---|
| 与 `harness-loop.md` 重复（门禁看不见） | review：页内出现"第一步是…"式叙述即算 | 删该段，改为链接 |
| 标题定稿后被改 | 标题断言 | 数组与页内标题回到同一版 |
| 找不到原话而写成了转述 | 每条都要能指到 `plan.md` / `framework.md` 的行 | 标 `[unverified]` 或删 |
| 产品页预算（现 20 494 / 24 576） | 门禁预算断言 | 只加一句；超限就先删同页的冗余句 |
| 与后续清理件互相覆盖 | 清理件排在本页之后 | 清理件单独一个 task |
