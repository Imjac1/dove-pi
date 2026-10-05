# 设计：整套使用过程

## Scenario: The whole usage process, stated so a gap is visible

### 1. Scope / Trigger

触发条件：**新增一份被路由的规格页**，并改动现有产品页的一节——属于跨层文档契约变化（router、index、测试数组、两页内容必须同时动）。因此按契约深度写：标题清单逐字、四列契约、验证矩阵、测试点、Wrong/Correct 各一对。

### 2. Signatures

**新文件**：`.trellis/spec/backend/personal-agent-usage.md`（硬上限 24 576 B；目标 ≤ 16 KiB）

**`##` 标题清单（逐字，被 `expectedHeadingsBySpec` 钉住，顺序敏感）**：

```
1. What this page is, and what it is not
2. The four surfaces a design may use
3. Stage 0 - Getting it installed
4. Stage 1 - The first time in a project
5. Stage 2 - The first real work
6. Stage 3 - When it refuses or asks
7. Stage 4 - A formal task, closed
8. Stage 5 - The second day
9. Stage 6 - Maintenance
10. The gaps, and who owns each
How to check this page
```

**同步改动三处**（顺序敏感：`routedSpecNames` 的顺序必须等于 router 链接表的顺序）：

| # | 文件 | 改什么 |
|---|---|---|
| 1 | `tests/spec-context-budget.test.ts` | `routedSpecNames` 加 `"personal-agent-usage.md"`；`expectedHeadingsBySpec` 加上面那份标题数组 |
| 2 | `.trellis/spec/backend/personal-agent-runtime.md` | 路由表加一行；选择规则加一条；**不得新增 `##` 标题、不得出现围栏代码块** |
| 3 | `.trellis/spec/backend/index.md` | Guidelines Index 加一行 |

**改动的第四处**：`.trellis/spec/backend/personal-agent-product.md` §3 加一行指向设计页（见 DD2，**不删内容**）。

### 3. Contracts

**契约 1 · 每阶段的四列。** 每个阶段 3–9 必须给全：

| 列 | 含义 | 允许的内容 |
|---|---|---|
| **What the person does** | 用户在那一步的动作 | 命令或一句话，带 `README.md:NN` 之类锚点 |
| **What the product decides for them** | 用户不必知道、产品替他定的 | 只能出自四个可塑形的面（契约 2） |
| **The failure this prevents** | **这一步防住的具体失败** | 必须能锚到 findings / 读数 / README；**空 ⇒ 该阶段不许进页面**（写不出来就如实写成缺口） |
| **Where it stands** | 有读数，还是缺口 | 缺口必须点名归属（契约 3） |

**契约 2 · 四个可塑形的面（设计动作的合法集合）。** 越界即写"not designable at this layer"并点名归属：

| 面 | 具体机制 | 归属 |
|---|---|---|
| **What Dove loads** | 上下文编译、目标续接、项目记忆（`/dove-mode auto\|chat\|work`） | Dove |
| **What Dove refuses or asks** | 工作模式的 `permissions.yaml`，在 `tool_call` 边界；`unlisted` 的立场 | Dove（权限）；模式声明本身 |
| **What Dove reports** | 终止对象、`/status full`、`doctor`、`diagnostics/status` | Dove |
| **What Dove writes** | `.dove/state.json`、`.dove/tasks/<id>/`、执行账本 | Dove |
| — 循环与工具 | 18 个 `pi.on(...)` 挂点，无 loop 体 | **Pi**，不可设计 |
| — 宿主侧行为 | `-p` 下斜杠命令由宿主处理；宿主的编辑工具是否在场 | **宿主**，不可设计 |

**契约 3 · 缺口归属的写法。** 每个缺口二选一：**一个现有任务目录名**（如 `10-03-mode-prerequisites`），或 **"needs a task"**。不许写"以后再说"。

**契约 4 · 标记制沿用产品页**：`[demonstrated]` / `[not yet demonstrated]` / `[unverified]`，每句带锚点。

### 4. Validation & Error Matrix

| 条件 | 期望 | 由谁报 |
|---|---|---|
| 新页加了、router 数组或链接表没同步 | `deepEqual` 失败 | `spec-context-budget` |
| 标题与清单差一个字/一个编号 | `unexpected contract inventory in personal-agent-usage.md` | `spec-context-budget` |
| router 多加一个 `##` 或代码块 | `keeps only routing structure in the router` | `spec-context-budget` |
| 新页 > 24 KiB 或 router > 8 KiB | 预算断言 | `spec-context-budget` |
| index 少一行 | `a specification index and its directory disagree` | `document-drift:288` |
| 新页点名了不存在的路径 | `backend/personal-agent-usage.md: <path>` | `document-drift:406` |
| 某阶段"防的失败"为空 | 门禁**不会**报——靠 review 与 check 读 | 人 / check 子代理（写进 §10 与"怎么检查"） |

### 5. Good / Base / Bad Cases

- **Good**：12 个 `##` 标题逐字命中；阶段 0–6 四列齐全、各有锚点；§10 把每个缺口派给一个现有任务或"needs a task"；§2 的四个面把越界动作挡住了。
- **Base**：某阶段四列里有"防的失败"写不出——**如实写成缺口**并派归属，页面仍合格；**不许**填一句"提升体验"糊过去。
- **Bad**：写成体验散文（"用户很顺畅地开始工作"）、把 Pi 的行为设计成 Dove 的、给缺口留"以后再说"、在 §3 与设计页里把同一条流程讲两遍。

### 6. Tests Required

| 断言点 | 位置 |
|---|---|
| router 链接表与数组双向相等且都能 `statSync` | `tests/spec-context-budget.test.ts#declares exactly the existing routed runtime specifications` |
| 每页 `##` 清单逐字一致 | `tests/spec-context-budget.test.ts#preserves the complete top-level contract inventory in its owning specifications` |
| router 只有 3 个标题、无围栏块 | `tests/spec-context-budget.test.ts#keeps only routing structure in the router` |
| 预算 | `tests/spec-context-budget.test.ts#keeps the router and every routed specification within the project budgets` |
| index 与目录双向相等 | `tests/document-drift.test.ts#lists every specification in the directory it indexes...` |
| 点名的路径存在 | `tests/document-drift.test.ts#names only paths that exist...` |

**没有仪器的那两条**（页面自己要写出来）：① "防的失败"非空**没有机械检查**；② 各阶段现状的真实性由锚点保证，不由测试保证。

### 7. Wrong vs Correct

#### Wrong

```text
## 5. Stage 2 - The first real work
The person describes what they need and Dove gets to work smoothly, choosing the right
amount of process for the task.                      ← 没有失败对象、没有锚点、没有现状
Gaps: onboarding could be smoother.                  ← 归属为空
```

#### Correct

```text
| The person does | `cd` into their project and describe the need - README.md:136-146 |
| Dove decides for them | small work runs without ceremony; a planning/architecture/cross-module
  request creates a formal task in the background - README.md:199-204 |
| The failure this prevents | ceremony imposed on small work (the person stops using it), and
  large work treated as small (no frozen acceptance, so nobody can say it is done) |
| Where it stands | [not yet demonstrated] the whole loop in one run -
  .trellis/tasks/10-05-whole-flow-end-to-end/readings.md ; gap owned by that task, and by
  .trellis/tasks/10-05-missing-hashline-edit-tool for the missing host edit tools |
```

## Design decisions

**DD1 · 自成一页**（用户已选）：预算（产品页只剩约 4.4 KB）与门禁绑定两个理由，加上"设计"与"记录"是两种东西，混在一节里必然互相污染。

**DD2 · 产品页 §3 只加一行指向，不删内容。** 取舍：删掉那 10 行能腾出空间，但会丢掉 `[demonstrated] / [not yet demonstrated]` 的锚点——那是现在这一页最有价值的东西。一行指针约 200 B，产品页仍在预算内。**新页因此不重述记录**：记录在 §3，设计与"防的失败/缺口归属"在新页。

**DD3 · 标题先定稿再动测试。** `expectedHeadingsBySpec` 是逐字 `deepEqual`，改一次标题要同步改测试；定稿前移可消掉本轮最可能的返工。

**DD4 · "防的失败"必须来自锚点。** 归档研究已判定"harness 让 agent 更好"没有证据（`community-wave-what-it-changes.md:96-103`）；因此这一列是**引用**而不是我的判断，写不出来就走 R3 的如实标注。

**DD5 · 越界动作一律显式标注。** 宿主侧的 `-p` 斜杠命令与缺失的编辑工具都写"not designable at this layer"，并点名归属——本仓的纪律是"声明了却没实现"是最不该出现的位置（`AGENTS.md` 的规则表与 `personal-agent-use-time-architecture.md:83-97`）。

**DD6 · 归属只允许两种写法**（现有任务目录名 / needs a task）：让"没人管"这件事在页面上看得见，而不是消失在措辞里。

## Risks & rollback

| 风险 | 观察方式 | 回退点 |
|---|---|---|
| 标题定稿后被改 | 门禁的标题断言 | 标题数组与页面标题回到同一版 |
| 设计退化成体验散文 | 逐阶段数"防的失败"列是否为空 | 删到只剩带锚点的句子（页面变短可以） |
| 与 §3 重复叙述 | 人读两处 | §3 只留记录 + 指针 |
| 越界设计（设计 Pi 或宿主） | 每个动作能否归入四面上之一 | 改为"not designable at this layer"并点名归属 |
| 预算超限 | 门禁 | 新页目标 ≤ 16 KiB；超标先砍散文不砍锚点 |
