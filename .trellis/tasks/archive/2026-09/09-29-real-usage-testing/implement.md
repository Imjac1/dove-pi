# Implement — 真实运行的做法，与它被遮住的原因

## 改动前必读（都是量过的）

| 事实 | 值 | 为什么重要 |
|---|---|---|
| `personal-agent-harness-loop.md` 归一化字节 | **24,306**（上限 24,576） | 只剩 **270 B** —— D1 的决定性依据：折不进去 |
| `personal-agent-request-runtime.md` | **24,539** | 只剩 37 B，同样排除 |
| router 归一化字节 | **4,039**（上限 8,192） | 加一行链接是安全的 |
| router 的形状断言 | 恰好 3 个 `## `；**无 `###`**；**无代码围栏** | 只能在表格与列表里追加，不能加小节 |
| `routedSpecNames` 与 router 链接 | 用 `deepEqual` 比对，**顺序敏感** | 两边都**追加到末尾** |
| `harness-surface.test.ts:36-37` | 加载**真实** yaml 并断言每个条目能解析 | D3 自验证：路径写错即红 |
| spec 里的代码跨度路径 | 只有 `src/` `tests/` `scripts/` `AGENTS.md` `package.json` `tsconfig.json` 开头的会被解析，且**必须存在** | 新 spec 引路径必须真实 |
| 文档语言 | `index.md`：**All documentation should be written in English** | 新 spec 与 README 改动一律英文 |

## 执行清单（按依赖顺序）

### 1. D1 — 新增 spec `.trellis/spec/backend/personal-agent-field-run.md`

- 恰好**一个** `## ` 标题：`## Scenario: Real-Provider Field Run`。
- `###` 结构沿用本仓库惯例（1. Scope / Trigger … 7. Wrong vs Correct）。
- 内容必须覆盖 **D6 四项**：不是门禁、新鲜度无人校验、保真边界、**怎么新增一个真实运行场景**（含 F19 判据）。
- 含 **D2 的读数格式模板**，并把本次那次真实运行作为**样例读数**。
- 代码跨度里只写**已存在**的路径：`scripts/real-dove-blackbox.mjs`、
  `tests/fixtures/scenarios/read-only-audit.json`、`tests/real-dove-blackbox.test.ts`。
- 保持 ≤ 24 KiB（归一化）。

### 2. D1 — router 同步 `.trellis/spec/backend/personal-agent-runtime.md`

- 在表格**末尾**（现 `:18` 之后）追加一行，链接文本必须是 `[Field run](./personal-agent-field-run.md)` 形式
  —— 测试的正则是 `\]\(\.\/(personal-agent-[^)]+\.md)\)`。
- 在 "Selection rules" 列表**末尾**（现 `:30` 之后）追加一条 "Use field run for …"。
- **不要**加 `###`，**不要**加代码围栏（router 形状断言）。

### 3. D1 — 测试清单同步 `tests/spec-context-budget.test.ts`

- `routedSpecNames` **末尾**追加 `"personal-agent-field-run.md"`。
- `expectedHeadingsBySpec` 追加 `"personal-agent-field-run.md": ["Scenario: Real-Provider Field Run"]`。
- 两处的顺序必须与 router 里链接的出现顺序**一致**（`deepEqual`）。

### 4. D1 — 索引同步 `.trellis/spec/backend/index.md`

- 在 Guidelines Index 表格里加一行（否则 `document-drift` 报"目录里有 spec 而索引没列"）。
- **不要**动 "Pre-Development Checklist" / "Quality Check" 两个必需小节。

### 5. D3 — `verifiedBy` 登记 `.trellis/harness-surface.yaml`

- `verifiedBy.tool-implementation` 追加 `tests/real-dove-blackbox.test.ts`。
- 纯数据改动（已核实测试用的是合成 surface，无期望清单要同步）。

### 6. D4 — README 纠正并补路径 `README.en.md`

- `:258` 的 "Full workflow and a real-user smoke check" **不是**真实用户检查（`:271-287` 全程无模型）
  —— 就地纠正措辞，不要把它删掉（那段 CLI 冒烟本身有价值）。
- 补上 `--provider real` 的真实运行路径，与既有 `--provider faux` 的 replay 段（`:403`）**并存**。
- 英文。

### 7. 非改动项：G5 已修，只核对

- `09-29-real-run-findings/implement.md` 在 `c818315` 里已写明 `providerEvidence` 是 faux-only、
  且上一条记录把它列为读数要求按构造无法满足。**核对存在即可，不要重写。**

### 8. 全量门禁

```powershell
npm run typecheck
node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts tests/harness-surface.test.ts
npm test
npm run test:installer
```

**验收点**：`npm test` 的通过数**不得下降**（当前 811 tests / 809 pass / 0 fail / 2 skipped）；
`test:installer` 的失败数**不得增加**（当前 0）。

## 可选的端到端确认（会花钱，不是门禁）

本次会话那条命令**已经跑过一次**（等于 AC-1 的"实测跑通过"）。除非步骤 1 的 spec 改动了命令本身，
**不需要**再花一次钱。若要重跑：

```powershell
node scripts/real-dove-blackbox.mjs --launcher source --provider real `
  --cwd <项目> --scenario tests/fixtures/scenarios/read-only-audit.json `
  --output <仓库外>\run.jsonl --timeout-ms 900000
```

## 风险文件与回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| 新增 spec | 纯新增；风险是**引用不存在的路径**被 `document-drift` 抓到 | 删文件 + 撤销另三处同步 |
| `personal-agent-runtime.md` | router 形状断言（无 `###`、无围栏、恰好 3 个 `## `）与 8 KiB 上限 | 删追加的两行 |
| `tests/spec-context-budget.test.ts` | 两个清单**顺序敏感**；写错顺序会红 | 撤销两处追加 |
| `README.en.md` | 长文件，容易误删相邻内容 | 还原段落 |
| `harness-surface.yaml` | 自验证；写错路径即红 | 删那一行 |
| `.trellis/spec/backend/index.md` | `document-drift` 要求索引列出目录里每份 spec | 删那一行 |

无新的**运行时**持久化写入点，**回滚不需要清理状态**。

## `task.py start` 之前的自检

- [x] `design.md` 的 D1–D6 每条都能在实现里指到具体文件。
- [x] 新 spec 恰好**一个** `## ` 标题，且与 `expectedHeadingsBySpec` 的值**逐字符相同**。
- [x] router 里链接的**出现顺序**与 `routedSpecNames` 顺序一致（两边都追加到末尾）。
- [x] 新 spec 内所有代码跨度里的 `src/` `tests/` `scripts/` 路径**都存在**。
- [x] 新 spec 是**英文**；`README.en.md` 英文、`README.md` 中文 —— 见下方"一处计划外的必要改动"。
- [x] router **没有**新增 `###` 或代码围栏。
- [x] D6 四项（非门禁 / 新鲜度无人校验 / 保真边界 / 怎么新增场景）都在新 spec 里。
- [x] G5 只核对、未重写。
- [x] 门禁数与基线一致（811/809/0/2；installer 141 OK / 0 失败）。

---

## 完成记录

### 落地的改动

| 步 | 内容 | 位置 |
|---|---|---|
| 1 | 新增 spec `personal-agent-field-run.md`（8,619 B / 24,576，**15,957 B 余量**；恰好 1 个 `## `） | `.trellis/spec/backend/personal-agent-field-run.md` |
| 2 | router 加一行链接 + 一条 selection rule（4,419 B / 8,192） | `.trellis/spec/backend/personal-agent-runtime.md` |
| 3 | 两个硬编码清单各追加一项（顺序与 router 一致） | `tests/spec-context-budget.test.ts` |
| 4 | 索引加一行 | `.trellis/spec/backend/index.md` |
| 5 | `verifiedBy.tool-implementation` 登记 harness 套件 | `.trellis/harness-surface.yaml` |
| 6 | 纠正误名段落 + 补 `--provider real` 路径 | `README.en.md`、`README.md` |
| 7 | G5 已由 `c818315` 处置，本次只核对（命中 2 处） | `09-29-real-run-findings/implement.md` |

### 一处计划外的必要改动（不是我扩范围，是既有检查要求）

计划只写了 `README.en.md`。但 `tests/document-drift.test.ts:383` 用 `frontDoorDrift` 断言
**两份 README 的形态必须一致** —— 它比对 `^#{2,3} ` 标题数、``` 出现次数、表格行数三者**计数**。
所以任何"只改英文"的做法都会让该检查变红。因此：

- 两份 README **各加 1 个 `###` 标题、各加 2 个 ``` 围栏**（一个 powershell 块 = 开+闭），计数保持相等。
- 两份的 `##` 标题文本各自改写为诚实的说法（文本不参与计数）。
- `README.md` 还受 `frontDoorProblems` 的路径检查（`document-drift.test.ts:313-328`），
  所以其中代码跨度里引的三个路径（`scripts/real-dove-blackbox.mjs`、
  `tests/fixtures/scenarios/read-only-audit.json`、`.trellis/spec/backend/personal-agent-field-run.md`）都必须是真实存在的 —— 已核对。

### 门禁结果

```text
npm run typecheck                  PASS
node --import tsx --test spec-context-budget / document-drift / harness-surface
                                   30 tests, 30 pass, 0 fail   (与基线一致)
npm test                           811 tests, 809 pass, 0 fail, 2 skipped   (与基线一致)
npm run test:installer             141 tests, OK, 0 failures                (与基线一致)
```

### 诊断结论的复现命令（AC-7）

```powershell
# F6/F7：本机没有真实会话遥测，只有一天的能力测试产物
Test-Path "$env:USERPROFILE\.pi\agent\sessions"                       # -> False
Get-ChildItem "$env:USERPROFILE\.pi\agent\dove\workspaces" -Directory |
  ForEach-Object { Get-ChildItem $_.FullName -Filter execution.jsonl }

# F12：没有任何 spec 提到真实 provider 运行
Get-ChildItem .trellis\spec -Recurse -Filter *.md |
  Select-String -Pattern "provider real|real provider|真实运行"

# F9/F10：README 的 smoke check 不碰模型，且全文没有 --provider real
Select-String -Path README.en.md, README.md -Pattern "--provider"

# F19：8 个场景里哪个是给真实 provider 写的
Get-ChildItem tests\fixtures\scenarios\*.json |
  ForEach-Object { (Get-Content $_ -Raw | ConvertFrom-Json).requires }

# F21：spec 预算（新 spec 加进来后仍然通过）
node --import tsx --test tests/spec-context-budget.test.ts
```

### 未做（按计划）

- 未改 `bash` 非幂等策略（F15）—— 候选议题。
- 未把真实运行做成门禁或调度。
- 未新增真实运行场景（D-C）。
- 未重跑真实会话：本任务没有改动命令本身（AC-1 的"实测跑通过"由本次会话早先那次满足）。
