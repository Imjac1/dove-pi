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

## 那条既红的索引读数：先报 +260 B，被同一测法当场推翻（**更正**）

**先报的**：`agent_project_context` 索引长度 `21 032 → 21 292（+260 B）`，A/B 归因"全部来自新规格页的一行索引"。

**2026-10-05 第二次实测**（同一台机、同一测法、同一个测试）：

| 条件 | 第一次实测 | 第二次实测（本轮） |
|---|---|---|
| 页面**移出**目录 | 21 032 | **21 032** |
| 页面**放回**（第一次 16 008 B，第二次 20 196 B） | 21 292 | **21 032** |

**结论：那条 +260 B 的归因不再复现**（本轮页面在场时连跑三次都是 **21 032**，移出后也是 21 032）。所以"这 260 B 全是新页那一行"**只能算当时的单次读数，不能算机制**——它是**被同一测法推翻的**。

**能确定的**：索引的行是 `{id, kind, sourceRef, estimatedChars}`（`src/context/interoperable.ts:31`、`:80`），一行约 260 B，**与第一次那个差值量级一致**；`estimatedChars` 是数字，所以同页从 16 008 B 长到 20 196 B 不会改变行宽。

**不确定的**：为什么同一棵树上"多一行 / 少一行"这次不再改变总数。**我没有测出机制，就不写机制**——留给修这条索引长度的人，起点是 `src/context/interoperable.ts` 与 `src/pi-adapter/extension.ts:2049`。

**门禁状态**：不受影响。改动前后都是 **934 pass / 1 fail / 2 skip**，同一条 fail（`tests/pi-adapter.test.ts:253` 的长度断言），本轮读数 **21 032**。

## 第二轮：R9（用户要求"再写具体一点"）

| 读数 | 值 |
|---|---|
| 新产品页预算（LF 归一化） | **20 196 B / 24 576**（新增 §2 约 4.2 KB） |
| 标题清单 | **10 个**（新增 `2. The design direction, as rules that can fail`，原 2–8 顺延为 3–9） |
| 页内按编号互指的引用 | **4 处**同步改（`§6`→`§7`、`§2/§5`→`§3/§6`、`§5`→`§6`、`§6/§5`→`§7/§6`） |
| 两道文档门 | **18 / 18 pass** |
| `npm run typecheck` | **0** |
| `npm test` | **934 pass / 1 fail / 2 skip**（同一条 fail，长度 21 032） |
| `npm run test:installer` | **143 OK** |

**新增的具体数字**（都从源码/文件里数出来，不是估计）：只读预算是 mode × intent 的 3×3 表 —— `fast` 4/6/12、`standard` 6/10/20、`ultra` 12/16/32，任务清单 1，chat 无（`src/pi-adapter/extension.ts:3500-3521`）；四个已发布模式的权限面：`code-development` 0 ask / 1 deny、`pentest` 1 ask / 3 deny、`trading` 1 ask / 2 deny、`code-audit` 2 ask / 3 deny，四者都写着 `unlisted: allow`（`modes/*/permissions.yaml`）。

## 落地的改动

| # | 文件 | 改动 |
|---|---|---|
| 1 | `.trellis/spec/backend/personal-agent-product.md` | 新建（初版 9 个 `##` 标题；第二轮增至 **10 个**，每条断言带锚点 + 三选一标记） |
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
