# 改动前的缺陷测量（2026-10-05）

改动前三件都量过；**改完后要用同样的命令复测**，所以命令与读数一起留在这里。

## 1 · 跨层指南的重复二级标题

```powershell
Select-String -Path .trellis\spec\guides\cross-layer-thinking-guide.md -Pattern '^## ' |
  Group-Object Line | Where-Object Count -gt 1
```

**读数（改动前）**：15 个 `##`，**12 唯一**，三组各出现 **2** 次：

| 标题 | 第一份行号 | 第二份行号 | 第一份字符 | 第二份字符 |
|---|---|---|---|---|
| `Cross-Platform Template Consistency` | 126 | 283 | 3002 | 758 |
| `Generated Runtime Template Upgrade Consistency` | 185 | 298 | 1817 | 1392 |
| `Mode-Detection Probe Checklist` | 257 | 327 | 2326 | 2324 |

**三对内容并不相同** ⇒ "删一份"需要判据，判据是它讲的是谁（下表）。文件共 423 行。

## 2 · 判据：这些段落讲的是本仓，还是另一个代码库

```powershell
Test-Path bin\dove-pi.cjs, install.ps1, src\templates, src\templates\trellis\index.ts, src\commands\update.ts, packages
Select-String -Path src\**\*.ts -Pattern 'getAllScripts' -List
```

| 被测对象 | 结果 |
|---|---|
| `bin/dove-pi.cjs` | **True** |
| `install.ps1` | **True** |
| `src/templates` | **False** |
| `src/templates/trellis/index.ts` | **False** |
| `src/commands/update.ts` | **False** |
| `packages` | **False** |
| `getAllScripts` 在源码 | **0 处** |

⇒ Cross-Platform **第一份**（讲 Windows launcher 与原生包边界）**属于本仓**；Cross-Platform **第二份**、Generated Runtime **两份**、Mode-Detection **两份**都在讲 **Trellis 工具本身**。

## 3 · 教一个不存在的机制

```powershell
Select-String -Path .trellis\spec\**\*.md -Pattern 'readTemplate'          # 1 处
Select-String -Path src\**\*.ts -Pattern 'readTemplate' -List              # 0 处
```

**读数**：spec 里 **1 处**（`code-reuse-thinking-guide.md:199`），源码 **0 处**。该文件第 193 行是 `## Template File Registration (Trellis-specific)`，其两个 `###` 在 208 / 215，文件共 **223** 行 ⇒ 这一节一直写到**文件尾**。

第 199 行原文：``1. Add `export const xxxScript = readTemplate("scripts/path/file.py");` ``

## 4 · 两个 index 的模板句

```powershell
(Get-Content .trellis\spec\backend\index.md -Encoding UTF8)[2]
(Get-Content .trellis\spec\frontend\index.md -Encoding UTF8)[2]
```

**读数（两处，各第 3 行）**：

```
> Best practices for backend development in this project.
> Best practices for frontend development in this project.
```

## 5 · 不适用标题

```powershell
Select-String -Path .trellis\spec\backend\database-guidelines.md -Pattern '^## (Query Patterns|Migrations)'      # 2 处
Select-String -Path .trellis\spec\frontend\state-management.md -Pattern '^## (When to Use Global State|Server State)'  # 2 处
```

**读数**：各 **2 处**。两页的正文都是为本仓写过的（`database-guidelines.md:5` 自己写着没有 DB/ORM），**不适用的是标题**。

## 改完后的复测命令（同一套）

```powershell
# 重复标题必须为 0
Select-String -Path .trellis\spec\guides\cross-layer-thinking-guide.md -Pattern '^## ' | Group-Object Line | Where-Object Count -gt 1
# 不存在的机制必须为 0
Select-String -Path .trellis\spec\**\*.md -Pattern 'readTemplate|src/templates|getAllScripts'
# 模板句必须为 0
Select-String -Path .trellis\spec\backend\index.md,.trellis\spec\frontend\index.md -Pattern 'Best practices for (backend|frontend) development'
# 四道文档门与三条门禁
node --import tsx --test tests/spec-anchors.test.ts tests/document-drift.test.ts tests/spec-context-budget.test.ts
npm run typecheck ; npm test ; npm run test:installer
```
