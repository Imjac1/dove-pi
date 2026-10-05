# 设计：一个不会烂的产品面

## Scenario: A product face held by the doors that already exist

### 1. Scope / Trigger

触发条件（本仓自己的强制规则）：这次改动**新增一份被路由的规格页**，属于跨层契约变化——router、index、`routedSpecNames` 与页面本体必须同时动，否则门禁直接红。所以它按 infra/跨层契约的深度写：签名（精确标题字符串）、契约（三种标记）、验证矩阵、测试点、Wrong/Correct 各一对。

### 2. Signatures

**新文件**：`.trellis/spec/backend/personal-agent-product.md`（≤ 24 576 B 硬上限；目标 ≤ 16 KiB）

**`##` 标题清单（逐字，被 `expectedHeadingsBySpec` 钉住，顺序敏感）**：

```
1. The product and the person it is for
2. The user-visible loop
3. The surfaces a person can reach
4. The axes, and which one owns what
5. What the product promises, and what enforces it
6. What the product has not yet demonstrated
7. axi, as an internal program
8. The non-goals
How to check this page
```

（最后一个不带编号，与 `personal-agent-use-time-architecture.md` 的现状一致。）

**同步改动四处**：

| # | 文件 | 改什么 |
|---|---|---|
| 1 | `tests/spec-context-budget.test.ts` | `routedSpecNames` 加 `"personal-agent-product.md"`（**位置 = router 里的位置**）；`expectedHeadingsBySpec` 加同名 key + 上面那份标题数组 |
| 2 | `.trellis/spec/backend/personal-agent-runtime.md` | 路由表加一行；**不得新增 `##` 标题、不得出现围栏代码块** |
| 3 | `.trellis/spec/backend/index.md` | Guidelines Index 加一行（index 与目录双向相等） |
| 4 | `README.md` | 加一条指向产品页的交叉引用（唯一的产品面反向指针） |

**修正向的两处编辑**：

| # | 文件 | 改什么 |
|---|---|---|
| 5 | `.trellis/tasks/09-30-axi-program/prd.md:72` | 节号引用 §5.2"新仓目录树" → 实测 §5.1；**把"原引用错在哪、何时作废"写在原地** |
| 6 | `.trellis/tasks/09-30-axi-program/plan-v8.md` §5.1/§5.4 附近 | 标注同仓决定已作废其"新仓/迁移"形状（**最小改动**：一句就地标注，不重写该节） |

### 3. Contracts

**契约 1 · 每句三选一标记。** 页面里每条关于产品的陈述必须带锚点，并落在三种标记之一：

| 标记 | 含义 | 例子 |
|---|---|---|
| **[demonstrated]** | 有读数/测试指向它 | 工具权限来自 `modes/<id>/permissions.yaml`（`README.md:249`） |
| **[not yet demonstrated]** | **有读数证明它尚未被证明** | 整条用户流程在同一次运行里走完（`10-05-whole-flow-end-to-end/readings.md:29`） |
| **[unverified]** | 没有仪器 | 只写"未检查"，不许写"应该没问题" |

没有锚点的句子**直接删除**，不降级成散文。

**契约 2 · 锚点的形状。** 允许：`file:line`、`file:line-line`、`README.md:NN`、`<task>/readings.md`、测试名。**不允许**：记忆、印象、"我认为"、无行号的路径（无行号者仅当它是被测钉住的路径，如 `tests/spec-context-budget.test.ts`）。

**契约 3 · axi 一节的边界。** §7 只允许三样东西：axi 是**实现方式**这一句、它的**阶段计划是 task 工件**这一句、以及**按名字**的引用。**禁止**：任何产品承诺、任何指向 `.trellis/tasks/...` 的具体路径（见决策 D5）。

**契约 4 · 非目标清单。** §8 的每一行必须带锚点（`README.md:NN` / spec 页），并在节首声明**它不完备**——"这份清单的完备性本身没有仪器"。

### 4. Validation & Error Matrix

| 条件 | 期望 | 由谁报 |
|---|---|---|
| 页面加了、router 没加 | `deepEqual` 失败：`targets` 与 `routedSpecNames` 不一致 | `spec-context-budget` |
| router 加了、数组没加（或顺序不同） | 同上 | `spec-context-budget` |
| 标题清单与页面不一致 | `unexpected contract inventory in personal-agent-product.md` | `spec-context-budget` |
| 页面 > 24 KiB | `personal-agent-product.md exceeds 24 KiB` | `spec-context-budget` |
| router 新增 `##` 标题或围栏代码块 | `keeps only routing structure in the router` 失败 | `spec-context-budget` |
| index 少一行 / 多一行 | `a specification index and its directory disagree` | `document-drift:288` |
| 页面点名了不存在的路径 | `backend/personal-agent-product.md: <path>` | `document-drift:406` |
| 页面 > 24 KiB 且 router > 8 KiB | 两条都报 | `spec-context-budget` |

### 5. Good / Base / Bad Cases

- **Good**：页面 9 个 `##` 标题逐字命中；每句带锚点与三选一标记；router 加一行、无新标题；index +1 行；README +1 条指针；`npm test` 里两个文档测试全绿。
- **Base**：内容只覆盖 §1–§5 与 §8，§6/§7 写成占位——**不允许**：宁可页面短，也不许有节无内容（空节会让"产品面"读起来比实际完备）。
- **Bad**：页面写成路线图（"我们将支持 X"）、或把 `hashlineEditTools=absent` 描述成"模型不够好"、或 axi 一节带产品承诺、或页面里写 `.trellis/tasks/09-30-axi-program/plan-v8.md` 这类会随归档失效的路径。

### 6. Tests Required

| 断言点 | 位置 |
|---|---|
| router 链接表与数组双向相等、并全部可 `statSync` | `tests/spec-context-budget.test.ts#declares exactly the existing routed runtime specifications` |
| 每页 `##` 标题清单逐字一致 | `tests/spec-context-budget.test.ts#preserves the complete top-level contract inventory in its owning specifications` |
| router 只有 3 个标题、无围栏块 | `tests/spec-context-budget.test.ts#keeps only routing structure in the router` |
| 预算（router ≤ 8 KiB、每页 ≤ 24 KiB） | `tests/spec-context-budget.test.ts#keeps the router and every routed specification within the project budgets` |
| index 与目录双向相等 | `tests/document-drift.test.ts#lists every specification in the directory it indexes, and every row it lists exists` |
| 页面点名的路径存在 | `tests/document-drift.test.ts#names only paths that exist, in the specifications that describe this repository` |

**没有仪器的那部分，页面必须自己说出来**：产品面陈述的**真实性**不由测试保证，只由锚点保证。这句话要写进 §How to check this page。

### 7. Wrong vs Correct

#### Wrong

```text
# personal-agent-product.md
## Roadmap
Dove Pi will support one-command project onboarding, and users will be able to run a whole
task end to end in a single session.   ← 没有锚点、是承诺、且与读数相反
## axi
The self-improving loop is a product feature.  ← 与用户决定（内部程序）冲突
See .trellis/tasks/09-30-axi-program/plan-v8.md for the plan.  ← 归档即断，且会让 document-drift 红
```

（同时 router 与数组没动 ⇒ 页面不被任何东西读，`spec-context-budget` 也发现不了它。）

#### Correct

```text
# Personal Agent Product Definition
...intro: this page is the authority on the product face; README is the user-facing text...

## 2. The user-visible loop
| Step | What the person does | What they see | Status |
| install | `python .\dove_pi.py install` | launcher path printed | [demonstrated] README.md:33-47 |
| run a whole task in one session | describe a task | — | [not yet demonstrated] 10-05-whole-flow-end-to-end/readings.md:29 |
```

（router 一行、数组一项、index 一行、README 一条指针同时落地。）

## Design decisions

**D1 · 落点选"甲"**（用户已定）：`spec/backend/` 里加页，而不是新建 `spec/product/`。理由：产品面就是这套 runtime 契约的一部分，且已被三处钉住；新目录只会让 `document-drift` 的路径检查需要额外扩列才覆盖得到。

**D2 · 页面是产品面的权威，README 是用户面文本**（A-6，待用户确认）。不一致时改 README。理由：README 是给用户读的叙述，页是给实现读的契约；把权威放在被门禁绑住的一侧。

**D3 · 三选一标记是页面的防腐剂。** 没有它，"产品面"会退化成叙述；有了它，`[not yet demonstrated]` 成为一个**可以读的正状态**，而不是丑闻——这正是 `10-05-whole-flow-end-to-end/readings.md:1` 自己的写法。

**D4 · 标题先定稿，再动测试，再写正文。** 顺序理由：`expectedHeadingsBySpec` 是逐字 `deepEqual`，标题改一次要同步改测试；把"定稿"前移可以把这一轮里最可能的返工消掉。

**D5 · §7 不写会随归档失效的路径。** 代价与收益：写路径能让读者一点就到，但 `09-30-axi-program` 一归档（AGENTS.md 记着 5 条/次）页面就会同时**断指针**和**弄红 `document-drift`**。选择：§7 按**名字**引用 axi 计划，把"它在哪个工件里"留给 `plan-v8.md` 自己说。**这不算隐瞒**——产品页对"内部程序"的唯一义务是说明它不构成产品承诺。

**D6 · 不新增 AGENTS.md 规则行。** 页面不是一条"规则"，而是产品面的定义；AGENTS.md 的规则表语法（`test:`/`suite:`/`type:`/`gate:`/`verifiedBy:`）没有对应的执行者，硬塞一行会让 `document-drift` 的语法检查无处可指。

**D7 · 页面不宣称完备。** §8 明确"清单不完备"，§How to check this page 明确"真实性由锚点保证、不由测试保证"。理由是本仓的核心纪律：**不声明任何未被证明的能力**，包括"我们文档很全"这种元级声明。

## Risks & rollback

| 风险 | 观察方式 | 回退点 |
|---|---|---|
| 标题定稿后又被改 | `unexpected contract inventory` | 回退标题数组与页面标题为同一版 |
| 页面被写成路线图 | 人读 §8 与 §5 的每行是否有锚点 | 删到只剩带锚点的句子（页面短可接受） |
| 顺序敏感的 `deepEqual` 失败 | `spec-context-budget` 第一条 | 只改 router 或只改数组之一，不同时动 |
| README 交叉引用写错相对路径 | `document-drift` 路径检查不含 README；靠人读 | 单条回退 README 那一段 |
| 已在红的 2 条测试被误算成本轮 | 基线先量、再实施 | 先记基线读数（`implement.md` P0），不与本轮改动混淆 |
