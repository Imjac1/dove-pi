# 读数：spec 树清理件（2026-10-05）

## 基线（本 task 产物已存在、四处缺陷未修）

| 读数 | 值 |
|---|---|
| `npm run typecheck` | **0** |
| `npm test` | **937 tests / 934 pass / 1 fail / 2 skipped**（同一条既有 fail；长度 **21 306**） |
| `npm run test:installer` | **143 OK** |
| 四处缺陷 | 重复标题 **3** 组 · `readTemplate` spec 内 **1** 处 · index 模板句 **2** 处 · 不适用标题 **4** 个（命令与原始输出见 `research/defects.md`） |

## 改动后（同一套命令复测）

| 读数 | 基线 | 现在 |
|---|---|---|
| 重复二级标题 | 3 组 | **0** |
| index 模板句 | 2 处 | **0** |
| 不适用标题 | 4 个 | **0**（`database-guidelines` 0 / `state-management` 0） |
| `readTemplate` / `src/templates` | 1 / 1 处 | `readTemplate` **0** · `src/templates` **1**（残留，见下） |
| `typecheck` | 0 | **0** |
| `npm test` | 937 / 934 / 1 / 2（21 306） | **937 / 934 / 1 / 2（21 306）** |
| `test:installer` | 143 OK | **143 OK** |
| 三道文档门 | — | **21 / 21**（`spec-anchors` 3 · `document-drift` 13 · `spec-context-budget` 5） |

## 落地的改动

| 文件 | 改动 | 体量 |
|---|---|---|
| `guides/cross-layer-thinking-guide.md` | 删两块重复（原 185–221、257–350）＋把标题改成与正文相符（`Cross-Platform and Cross-Protocol Boundaries`） | **423 → 292 行** |
| `guides/code-reuse-thinking-guide.md` | 删 `## Template File Registration (Trellis-specific)` 到文件尾（含两个 `###`，并去掉它前面那道悬空的 `---`） | **223 → 190 行** |
| `backend/index.md` · `frontend/index.md` | 第 3 行模板句 → 事实句 | 各 1 行 |
| `backend/database-guidelines.md` · `frontend/state-management.md` | 四个不适用标题 → 实际标题 | 各 2 行，**正文零改动**（`git diff -U0` 只输出那 4 行） |

## AC 自查

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 重复标题 0 | ✅ | `Group-Object Line \| Where Count -gt 1` 输出为空 |
| AC-2 `readTemplate`/`src/templates` 在本轮删除范围内归零 | ✅（**收窄后**） | `code-reuse` 内两者 0；残留 1 处 `src/templates` 在未点名的子节里，按 Out of Scope 只报不改 |
| AC-3 index 模板句 0 | ✅ | 实测 0 |
| AC-4 四个标题改成实际标题、正文未动 | ✅ | `git diff --stat` = 4 insertions / 4 deletions，全在标题行 |
| AC-5 每处改动都有测量依据 | ✅ | 本节 + `research/defects.md` |
| AC-6 门禁不降 | ✅ | 上表 |

## 本轮我撞出来的两件事（都记）

**1 · `Set-Content -Encoding utf8NoBOM` 在这个 shell 里不存在。** 这个 shell 是 **Windows PowerShell 5.1**（`$PSVersionTable` 实测 5.1.22621.6133），它的 `-Encoding` 枚举里没有 `utf8NoBOM` —— 第一次删除命令因此**整体失败**。**好在失败是干净的**：写入没发生，文件仍是 423 行、标题未变，没有半写状态。改用 `[System.IO.File]::WriteAllText(path, text, New-Object System.Text.UTF8Encoding($false))`；写之前先测出该文件是 **CRLF、无 BOM**（首三字节 `23 20 43`），写入按同约定，写完复测首三字节与行尾不变。

**这正是 AGENTS.md 记过的 BOM 陷阱那一族**（PS 5.1 的 `-Encoding UTF8` 会写 BOM，曾让一个 `.dove/mode.json` "存在但读不到"）。这条读数值得留着：**在本仓用脚本改文本文件，唯一安全的写法是 .NET + `UTF8Encoding($false)`，并且要先测行尾。**

**2 · AC-2 是我写宽了，按实测收窄。** 我原本写"`readTemplate` / `src/templates` / `getAllScripts` 在 `.trellis/spec/` 里 0 处"。实测：`readTemplate` 归零，但 `src/templates` 还剩 **1** 处、`getAllScripts` 还剩 **2** 处，且都落在**我没有点名的位置**里。**我没有为了让 AC 变绿去删那些位置**——只把 AC 收窄成本轮真正承诺的范围，残留按 Out of Scope 记入下方。

## 只报不改（同一条判据，落在未点名的位置上，带测量）

| 位置 | 命中 |
|---|---|
| `cross-layer` 的 `### Checklist: After Modifying Any Command Template`（现 174–183 行） | `src/templates/*/commands/trellis/`、`/trellis:check-cross-layer`、Claude/iFlow/Kilo/OpenCode/Gemini 的多平台命令副本 → **`src/templates` 1 处** |
| `code-reuse` 的 real-example 段（185 / 189 行） | `trellis update`、`getAllScripts()`、`update.ts`、`v0.4.0-beta.3` → **`getAllScripts` 2 处** |
| `cross-layer` 的 `## Versioned Documentation Boundary`（185–219 行） | `docs-site/zh`、`docs-site/rc/**`、`docs-site/beta/**`、`mindfoldhq/trellis`（做"同判据扫其余章节"时测到；相关的裸 `docs.json` 也在这节里） |

**为什么只报不改**：这三处都在你点名的范围之外，而"把整份指南按这条判据清一遍"是范围扩张，不是本轮裁决。你要的话，同一判据可以再走一轮。

## 第八次索引测量

删掉 131 行 + 33 行内容、改 6 行，那个既有的红**一点没动**：`21 306 → 21 306`。

八次读数连起来看（同一条 fail 的长度）：创建/归档 task **有方向**（+749 / −797 / −809），规格页与指南内容 **无方向**（+260 / 0 / +260 / −261 / **0**）。**结论不变：非单调，机制未隔离**（`context-compiler.ts:85-103` 的预算渲染 + 省略计数与它一致，但那只是"一致"）。这条 fail 本身仍不在本任务范围内。

## 未做

- 上面"只报不改"的三处。
- 层名 `frontend`（它装的是 Pi TUI，改名牵动 index 与全部引用）。
- `harness-loop.md`（剩 5 字节）与改进页 §10 的六个缺口。
- 那条 `agent_project_context` 索引长度本身。
