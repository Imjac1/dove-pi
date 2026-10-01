# 架构优化：读数

判据见 `prd.md`，设计见 `design.md`，顺序见 `implement.md`。**失败、未达成、以及偏离都在这里。**

---

## 第 0 步：《使用期架构》一页 —— ✅ 完成（提交 `86c842a`）

**产物**：`.trellis/spec/backend/personal-agent-use-time-architecture.md`，**9,200 字节**（上限 24,576）。

七节：① 谁拥有 loop（Pi 拥有；`core/loop.ts` 只是契约、`loop-runner.ts` 无人到达）② 十八个挂载点（带每个 `pi.on(...)` 的声明行号）③ 闸门的执行点（`extension.ts:2616` 的 `tool_call` 内、`:2624` 的 `denyDecision` → `:2632` 的 `return { block: true, reason }`）④ 进程边界 ⑤ 信任分级 ⑥ 证据落盘与跨会话 ⑦ **两处空白 + axi 未实现的那一格**。每条断言带 `file:line`。

**三处接线**（这是那个测试实际要求的三件事，不是我想接的）：

| 接哪里 | 为什么必须 |
|---|---|
| `personal-agent-runtime.md`（router）加一行 route + 一条 selection rule | `spec-context-budget.test.ts:91` 断言 router 里的链接**顺序逐一等于** `routedSpecNames` |
| `index.md` 加一行 | `document-drift.test.ts:161` 断言 index 列出该目录的**每一个**规格 |
| `tests/spec-context-budget.test.ts` 加进 `routedSpecNames` **且**加 `expectedHeadingsBySpec` 条目 | 该文件 L105 断言每个规格的 `## ` 标题**逐一等于**声明表；L91 断言 route 清单"恰好是现有的" |

**读数**：两处规格检查 **17 / 17 pass**；全量 **822 / 820 pass / 0 fail / 2 skipped**；`typecheck` **0**；installer **Ran 141 / OK**。AC-7 ✅。

---

## 一条**预先存在**的门禁失败：时间炸弹（提交 `5de9969`）

**现象**：第 0 步写完后，全量里 `tests/host-work-mode.test.ts` 红了一条：*"enforces the loaded mode's never_allow against the action…"*，断言原文——

> `Work mode 'pentest' declares 'conformance' and its engagement 'example-engagement' does not pre-flight clean: Grant 'g-client-scope' is not active at 2026-10-01T06:27:44.821Z (window 2026-09-01T00:00:00.000Z to 2026-10-01T00:00:00.000Z)`

**根因**：`modes/pentest/governance.yaml:14` 与 `engagements/example-engagement/authority.yaml:18-19` 是**固定日期对** `2026-09-01 → 2026-10-01T00:00Z`；测试的 `preflightableEngagement()` 会把 `checked_at` 刷成"现在"，**但不刷窗口**。挂钟一过 10-01T00:00Z，示例就"未生效"。（本会话早先那轮全绿，正是因为当时还没过点。）

**先证后改**：把本会话的四处改动 `git stash` 掉、**回到干净状态重跑 → 同一条断言照样红（33 / 32 / 1）**。所以它是**时间炸弹，不是回归**。

**修法（最小）**：只让**副本**的窗口随挂钟移动（与已存在的 `checked_at` 刷新同一处）。**没有改任何断言**，**没有动产品数据**。修后：33 / 33 ✅。

### ⚠️ 留给你的一个**产品**问题（我没有顺手改）

那对窗口是**随包示例的数据**：从 2026-10-01 起，**真人加载 `modes/pentest` 也起不了 engagement**（同样的"not active"拒绝）。测试只是先撞上它。两种收法，属于你的决定：

1. **延长示例窗口**（例如到 2027），让示例可用；
2. **保留过期**当作"`expires` 字段的演示"，但那就该在 `MODE.md` / 示例里**写明它会过期**，免得下一个人把它当 bug 修。

## 偏离记录

- 本次动了**一个测试文件**（`tests/host-work-mode.test.ts`），而 `prd.md` 的 Out of Scope 写着"不动测试断言"。**改的是 fixture 的时钟依赖，不是断言**——断言一个字没动。之所以动它：门禁是红的，而 AC-6 要求"三条门禁读数不降"，红着无法验证后续每一步。这是我的判断，记在这里，你可以否决。

## 第 1 步：层清单对齐真实树 + 四层与方向 —— ✅ 完成（提交 `fb945b5`）

**改了什么**（`.trellis/spec/backend/directory-structure.md`）：

- 布局块从 **7 → 14** 个目录 + 4 个根模块，每行标出它的层；补齐的七个：`adapters`、`code-audit`、`commands`、`context`、`jailer`、`skills`、`web-access`。
- 新增一节 **"Layering and the allowed direction"**：四层（**L0 core / L1 mechanism / L2 authority / L3 host**）、规则（**只能 import 自己这层或更下面**）、以及规则背后的**实测状态**：111 个源文件里 26 个跨层，**22 向下、1 向上**（`src/core/workspace-policy.ts:4` → `src/project-provider/lock.ts`）。
- `plane-b` 写成 **L2 且标注"not built yet"**——规格只描述现在，不描述计划（AC-3 一致性见第 4 步）。

**读数**：两处规格检查 **17/17**；全量 **822 / 820 pass / 0 fail / 2 skipped**；`typecheck` **0**；installer **141 OK**。AC-1 ✅、AC-2 未动（第 2 步）。

## 两条偏离（都记在案）

### 1. 我违反了规格的语言约定（已修）

我先写的那一页是**中文**，而 `spec/backend/index.md:43` 写着 *"All documentation should be written in **English**"*，其余 18 份规格都是英文。**这不该问你**——仓库已回答。已整页改写为英文（同锚点、同断言），测试里那份标题声明同步改；原中文版留在提交 `86c842a` 的历史里。

### 2. 提交消息被 shell 吃掉（已修，且这是**第三次**同类）

`git commit -m "…\"…\""` 里的 `\"` 被 PowerShell 解析掉 → **第一次提交根本没发生**，第二次的正文被当成 pathspec 截断，且它把三个文件一起收了。用**消息文件 + `git commit --amend -F <文件>`** 修正。

**这一类已经三次**：① 脚本里的 `` ` ``被 here-string 变成 `<CR>/<NUL>`；② 我两次把"用默认编码读 UTF-8"当成"文件是乱码"；③ 这次引号。**规则**（写进这里的唯一目的是下次直接照做）：**中文、引号、长文本一律写成文件再让工具读，不走命令行**。

