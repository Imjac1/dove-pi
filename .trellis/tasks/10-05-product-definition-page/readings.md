# 读数：产品定义页（2026-10-05）

## 基线（改动前，一个文件都没动）

| 读数 | 值 |
|---|---|
| `npm run typecheck` | **0** |
| `npm test` | **937 tests / 153 suites / 934 pass / 1 fail / 2 skipped / 115.9 s** |
| `npm run test:installer` | **未测（漏跑）** |

**唯一那条 fail**：`tests/pi-adapter.test.ts` → `registers modes, shortcuts, capabilities, and doctor` —
`project context without a query must remain an index, not a raw project dump (length 21032)`（`tests/pi-adapter.test.ts:253`，上限 20 000）。

**归因**：改动前即红，与本轮无关；同一条被 10-05 的另一个窗口记过（"一条数 `agent_project_context` 的索引长度"）。

**诚实缺口**：基线**没有跑** `test:installer`（计划 P0 里写了四条，实际只跑了三条）。本轮改动不触及 installer 与 Python 路径，事后读数为 143 OK，但**改动前没有对照**——记为漏测，不记为"没变化"。

## 改动后

| 读数 | 值 | 与基线比 |
|---|---|---|
| `npm run typecheck` | **0** | 不变 |
| `npm test` | **937 / 153 suites / 934 pass / 1 fail / 2 skipped / 108.1 s** | 不变（同一条 fail） |
| `npm run test:installer` | **143 tests OK** | 无对照（见上） |
| 两道文档门 | **18 / 18 pass**（`spec-context-budget` 5 条 + `document-drift` 12 条 + capability 指针 1 条） | 新增覆盖 |
| 新页预算 | **16 008 B / 24 576** | — |
| router 预算 | **5 426 B / 8 192** | — |

## 那条既红的读数被我推大了一点（实测，非估计）

`agent_project_context` 索引长度：**21 032 → 21 292（+260 B）**。

**A/B 实测的归因**（把新页临时移出目录，单跑那条测试）：

| 条件 | 长度 |
|---|---|
| 页面移出（README 的改动仍在） | **21 032** |
| 页面放回 | **21 292** |

⇒ **+260 B 全部来自新规格页的一行索引**（`externalIndex`，`src/pi-adapter/extension.ts:2049`）；README 那条交叉引用对该索引贡献 **0 B**。

**如实说明**：这条门禁**没有变绿变红**（改动前后都是同一条 fail），但**一个本来就超限的数字被我推大了 260 B**。它与 `10-05` 窗口记过的缺陷同源，属本轮 Out of Scope；这条读数留在原地，好让修索引的人知道它又多了一行。

## 落地的改动

| # | 文件 | 改动 |
|---|---|---|
| 1 | `.trellis/spec/backend/personal-agent-product.md` | 新建（9 个 `##` 标题，每条断言带锚点 + 三选一标记） |
| 2 | `.trellis/spec/backend/personal-agent-runtime.md` | 路由表 +1 行、选择规则 +1 条（未加标题、未加代码块） |
| 3 | `.trellis/spec/backend/index.md` | Guidelines Index +1 行 |
| 4 | `tests/spec-context-budget.test.ts` | `routedSpecNames` 首位 + 标题清单 |
| 5 | `README.md` | 开头 +1 条指向产品页的交叉引用与权威归属 |
| 6 | `.trellis/tasks/09-30-axi-program/prd.md:72` | 节号 §5.2 → **§5.1**，错引理由写原地 |
| 7 | `.trellis/tasks/09-30-axi-program/implement.md:19` | 同上改号，并记下"§3.13 与 §5.3 重排仍未做" |
| 8 | `.trellis/tasks/09-30-axi-program/plan-v8.md` §5 开头 | 就地作废标注（不改写原文） |

## 顺手量到的两条

1. **`plan-v8.md` 现在 84 001 B**，而 `09-30-axi-program/implement.md:18` 记的是 **81 319 B** —— 文件又长了，注入上限 32 768 的缺陷**仍未修**，且**被截掉的正是实现者最需要的 §4/§5**。
2. **`document-drift` 的路径检查只认 `.trellis` / `src` / `tests` / `scripts` 开头的代码跨度路径**（`^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+\.[a-z]{2,4}$`）：所以页面里 `README.md:NN` 这类裸引用**不被检查**，而 `.trellis/tasks/**` 的读数路径**被检查**——它们随归档移动时会**当场变红**，这是有意的：断指针要有人报，见页面 §6 的引用块与 `AGENTS.md`。

## 未做（留在原地，不粉饰）

- `10-03` / `10-05` 的独立缺陷（编辑工具缺失、15 分钟超时、bash 挂起 6 分 33 秒）。
- `plan-v8.md` 的按节拆分（`implement.md:18` 的计划）。
- axi 的 §3.13 与 §5.3 重排。
- 上面那条 `agent_project_context` 索引长度。
