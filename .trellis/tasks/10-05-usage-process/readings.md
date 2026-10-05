# 读数：整套使用过程的设计页（2026-10-05）

## 基线（本 task 的产物已存在、设计页尚未创建）

| 读数 | 值 |
|---|---|
| `npm run typecheck` | **0** |
| `npm test` | **934 pass / 1 fail / 2 skip**（同一条既有 fail；长度读数 **21 781**） |
| `npm run test:installer` | **143 tests OK** |

既有 fail：`tests/pi-adapter.test.ts:253` 的 `project context without a query must remain an index, not a raw project dump`（上限 20 000，实测 21 781）。**改动前即红，与本轮无关。**

## 改动后

| 读数 | 值 | 与基线比 |
|---|---|---|
| `npm run typecheck` | **0** | 不变 |
| `npm test` | **934 pass / 1 fail / 2 skip** | 不变（同一条 fail，长度 **22 041**，+260） |
| `npm run test:installer` | **143 tests OK** | 不变 |
| 两道文档门 | **18 / 18 pass** | 新页进入覆盖 |
| 新页预算（LF 归一化） | **13 541 B / 24 576**（目标 ≤ 16 KiB） | — |
| 产品页 | **20 494 B / 24 576**（+498，含指针段） | — |
| router | **5 885 B / 8 192** | — |

## 落地的改动

| # | 文件 | 改动 |
|---|---|---|
| 1 | `.trellis/spec/backend/personal-agent-usage.md` | **新建**：11 个 `##` 标题（§1 说明 + §2 四个面 + §3–§9 阶段 0–6 + §10 缺口归属 + 怎么检查） |
| 2 | `tests/spec-context-budget.test.ts` | `routedSpecNames` +1、`expectedHeadingsBySpec` +1（11 个标题逐字） |
| 3 | `.trellis/spec/backend/personal-agent-runtime.md` | 路由表 +1 行、选择规则 +1 条（未加标题、未加围栏块） |
| 4 | `.trellis/spec/backend/index.md` | Guidelines Index +1 行 |
| 5 | `.trellis/spec/backend/personal-agent-product.md` §3 | **只加一段指针**（记录 10 行未删，标记保留） |

## AC 自查（逐条，按证据）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 新页被 router 指向、被 index 列出、两道门全绿 | ✅ | `spec-context-budget` 5/5、`document-drift` 12/12、capability 指针 1/1 |
| AC-2 标题逐字一致 | ✅ | `preserves the complete top-level contract inventory...` 通过（11 条） |
| AC-3 阶段 0–6 齐备、四列齐全、**"防的失败"无一为空** | ✅ | §3–§9 每节四行俱全；阶段 5 的"防的失败"由走查自己的话给出（未提交的工作、需要重新解释的交接），**并把"没有设计"如实写在"产品替用户决定什么"那一行** |
| AC-4 每个缺口点名归属 | ✅ | §10 七行：五个现有 task 目录名、一处"the host"、两处 `needs a task` |
| AC-5 设计动作可归入四个面之一；越界显式标注 | ✅ | §2 表列出四个面 + 两条"not designable"（Pi 的循环与工具、宿主侧行为）；阶段 2 与阶段 3 各自点出宿主侧那条 |
| AC-6 §3 指向且保留标记、产品页仍 ≤ 24 KiB | ✅ | 20 494 / 24 576；10 行记录与 `[demonstrated]` 标记未动 |
| AC-7 点名路径存在 | ✅ | `names only paths that exist...` 通过 |
| AC-8 三条门禁读数入本文件 | ✅ | 见上 |

**AC-3 的诚实边界**（页面自己也写了）：这一列**没有机械检查**——它是散文，只有读者顺着锚点核；门禁只管页面的形状与路径。

## 那条既红的索引读数：第四次测量，机制仍未隔离

四次的原始读数（同一台机、同一个测试）：

| # | 树上发生了什么变化 | 长度 |
|---|---|---|
| 1 | 新建产品页（16 008 B） | 21 292（对照：页面移出 21 032，**+260**） |
| 2 | 产品页长到 20 196 B，移出 / 放回 | **21 032 / 21 032（0）** |
| 3 | 新建本 task（产物约 21 KB） | 21 032 → **21 781（+749）** |
| 4 | 新建本页（13 541 B） | 21 781 → **22 041（+260）** |

**可确定的**：这个总数**不是"每份文档固定一行"的线性量**——同一份规格页在第 1 次与第 2 次测量里分别贡献 **+260** 与 **0**；而一个 task 的产物贡献了 **+749**。

**代码里与它一致的东西**：`src/core/context-compiler.ts` 按预算渲染文档，每项的渲染长度 = 内容 + id + sourceRef + **96**（`:85`），超出预算的文档**被省略并压成一行计数**（`:90`、`:103`：`[PROJECT_CONTEXT budget: omitted N lower-ranked document(s)]`）。预算一旦吃紧，"多一份文档"就可能表现为**零增量**，因为增量被"少省略一份"抵消。

**我没有做到的**：把上面这条机制**隔离证明**（要读渲染后的实际文本才能数哪几份被省略）。所以它写成"与代码一致的机制"，不写成"已证实的机制"。

**给修这条的人**：`src/pi-adapter/extension.ts:2049` 附近是响应组装处，`src/context/interoperable.ts:31,80` 是索引行的形状。

**一个自我指涉的读数**：**这份 readings.md 本身**（一个 `kind: "task"` 文档）写下去也会移动那个总数——上面第 4 行的 22 041 是**写本文件之前**的值。这不是错误，正是这条机制在起作用。

## 未做（留在原地，不粉饰）

- 三个已知缺口（`10-03-mode-prerequisites`、`10-05-whole-flow-end-to-end`、`10-05-missing-hashline-edit-tool`）——本页只点名归属。
- `10-05-missing-hashline-edit-tool` 与 `10-05-whole-flow-end-to-end` 仍是 `planning` / `in_progress`。
- 那条 `agent_project_context` 索引长度本身。
