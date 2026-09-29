# How to test for real-usage problems, and what the process hid

## Goal

让"真实使用才会暴露的问题"能被**有意识地、按需地**找到，而不是等它偶然发生一次；并把这个缺口
**为什么一直看不见**的原因点名，且把其中便宜、高杠杆的部分修掉。

用户价值：本仓库的确定性测试很强（811 用例 / 132 套件），但它对**只有真实模型 + 真实会话才走得到**的
那一类缺陷是盲的。这个盲区已被证明有产出 —— 一次真实运行找出 4 条缺陷 + 1 个测量，且明写
"none reachable by reading" —— 却**只被走过一次**。本任务把这个偶发变成做法。

## Background

### 已核实的事实（每条都有出处）

| # | 事实 | 出处 |
|---|---|---|
| F1 | 在本次会话之前，**历史上只跑过一次真实 provider 会话**（session 227） | `journal-5.md:534-563` |
| F2 | 本次会话我跑了**第二次**（同一场景），两次都终止于 `retry-refused-after-effect` | `09-29-real-run-findings/implement.md` |
| F3 | session 227 之前 harness **结构上跑不了真实 provider**：`PI_CODING_AGENT_DIR` 指向隔离目录，把操作者配的 provider 一起隔离了。"模式可达但不可用，这就是此前从未有过真实运行的原因" | `journal-5.md:543`、`:547` |
| F4 | 一次真实运行找出 **4 条缺陷 + 1 个测量**，明确写着"**none reachable by reading**" | `journal-5.md:550-551` |
| F5 | `/status full` 证据路径缺陷、`providerRounds` 低报、`toolNames` 恒空，**全部只在真实运行里出现** | `09-29-real-run-findings/prd.md:7-8` |
| F6 | `~/.pi/agent/sessions` **不存在** → `token audit` 遥测聚合器在**本机零数据** | 实测 |
| F7 | 本机 `~/.pi/agent/dove/workspaces/` 只有 6 份 ledger，全是 **2026-09-28 一天**且只含 `capability.*` —— **测试产物，不是用户会话** | 实测 |
| F8 | 已提交 8 个场景，**只有 `read-only-audit` 一个**被真实 provider 跑过 | `tests/fixtures/scenarios/`、F2 |
| F9 | README 的 **"Full workflow and a real-user smoke check"（`README.en.md:258`）是纯 CLI 的**：`--version` / `doctor` / `task create` / `capability list`，**全程没有模型参与** | `README.en.md:271-287` |
| F10 | **README 全文没有 `--provider real`**（只有 `--provider faux` 的 replay 路径） | `README.en.md:403` |
| F11 | 两份真实读数都**不可复现**：session 227 的端点/模型**今天在上游已不存在**，我这次换了端点与模型名 | 实测、`09-29-real-run-findings/implement.md` |
| F12 | **没有任何 spec 提到真实 provider 运行**（`provider real` / `real provider` / `live run` / `field test` / `真实运行` 全部零命中） | 实测 |
| F13 | `tests/real-dove-blackbox.test.ts`（harness 套件）**不在 `harness-surface.yaml` 的任何 `verifiedBy` 里** —— 它不验证任何已声明组件 | `harness-surface.yaml` |
| F14 | 上个任务的 `implement.md` 要求记录 `providerEvidence`，但该捕获**只存在于 faux provider**（`DOVE_PI_FAUX_CAPTURE`）→ 真实 provider 下**按构造无法满足** | 实测、`real-dove-blackbox.mjs:119`、`.test.ts:67-70` |
| F15 | `isPiToolInvocationIdempotent` 对 `bash` **无条件回落 `false`**，与命令内容无关 → 只读探索用 shell 也被当作非幂等 | 实测、`src/pi-adapter/extension.ts` |
| F16 | 真实运行需要**人配凭据**；session 227 所在任务迟迟不归档，就是因为"blocked on a person" | `journal-5.md:530` |
| F17 | 本项目**没有 goal**（`get_goal` 返回 null） | 实测 |
| F18 | `check_release_readiness.py` 是**打包一致性**的 fail-closed 检查（zip/manifest/版本号），**从不跑模型** → 不是真实运行能挂的钩子 | `check_release_readiness.py:1-2`、`:47-60` |
| F19 | **8 个场景里只有 `read-only-audit` 声明 `requires: a real provider`**；其余 7 个依赖确定性机制，且 `correction` / `compact` 明写 **"nothing beyond the default faux responses"** —— 它们的断言是对**脚本化事件**写的 | `tests/fixtures/scenarios/*.json` 的 `requires` |
| F20 | `spec-context-budget.test.ts` 把 **spec 清单与每份 spec 的 `## ` 标题清单硬编码**并要求 `deepEqual`；每份 routed spec **≤ 24 KiB**（归一化后），router ≤ 8 KiB | `tests/spec-context-budget.test.ts:78-107` |
| F21 | **预算实测**：`personal-agent-harness-loop.md` 只剩 **270 B**、`personal-agent-request-runtime.md` 只剩 **37 B**；router 剩 4,153 B | 实测 |
| F22 | 加一份 routed spec 需要**四处同步**：spec 正文、router 链接（顺序也参与 `deepEqual`）、`routedSpecNames` + `expectedHeadingsBySpec`、`index.md` 行 | F20、`document-drift.test.ts:161` |

### 已决定

- **D-A（= A）**：计划建在 **harness 驱动的真实 provider 运行**上 —— 唯一**已证明**能产出这类缺陷的来源（F4），
  工具已存在，只差"便宜到能常跑"。已知代价：仍是**脚本化场景**，覆盖不到"人真的会怎么用它"的意外用法。
- **D-B（= B）**：做「诊断 + 协议 + 修掉便宜高杠杆的流程缺口」（README / spec / `harness-surface.yaml`）。
  **不含**：把真实运行做成门禁（读数不可复现，F11）。
- **D-C（= A）**：真实运行的覆盖**以现有 `read-only-audit` 为核心**，并把"怎么新增一个真实运行场景"
  写成可复用步骤；**现在不再提交新场景**。
  理由：原始缺陷恰恰是"`read-only-audit` 提交了却从不跑"（F1/F3/F8）——
  在例行做法尚未证明存在之前再提交新场景，就是重演同一个缺陷。

## Requirements

### R1 — 真实使用的问题怎么被有意识地找到

**做法**：给出一条**写下来的、实测跑通过的**真实运行路径，并让它的读数**跨次可对照**。

- 路径以现有 `read-only-audit` 场景为核心（D-C）。
- **不是门禁**：读数是**测量**，不是断言（F11）。做成门禁就是制造假安全感。
- **前置条件必须写明**：需要操作者配好凭据（F16），且 provider/模型会变（F11）。
- **必须写明怎么新增一个真实运行场景**，含 F19 那条判据：断言写给脚本化事件的场景**不能**直接指真模型。

### R2 — 流程哪里出了问题

要求：把"让缺口一直看不见"的机制点名，每条带出处、影响，并标注 **可修 / 不可修**。

| # | 机制 | 出处 | 影响 | 判定 |
|---|---|---|---|---|
| G1 | **静默的能力缺口**：真实会话 replay 是被声称的能力，却结构上不可用，且**没有任何检查会因此变红** —— faux 路径一直绿，绿恰恰掩盖了真实路径从未被走过 | F1/F3/F8 | 一次都没跑过，直到有人偶然发现 | **部分可修**：写下来的协议 + 记"最近一次"（不做自动检测，D-B 已排除） |
| G2 | **文档指的路不是那条路**：名字最像的（README "real-user smoke check"）**没有模型**，真命令**不在 README** | F9/F10 | "照文档做一遍"得到假信心 | **可修，便宜** |
| G3 | **spec 对这条路径零覆盖** | F12 | 没有契约可依，下一个人只能靠读代码 | **可修** |
| G4 | **发现者不被认领**：找出 4 条缺陷的 harness 套件不在任何 `verifiedBy` 里 | F13 | "什么验证什么"的地图上，这个工具是空白 | **可修** |
| G5 | 记录里写了**做不到的读数要求**（`providerEvidence`） | F14 | 后来者按它做会以为自己漏了什么 | **可修**（给该记录加更正） |
| G6 | 真实运行**依赖一个人**与凭据 | F16 | 没有例行做法时必然退回一次性 | **不可修**（不自动化凭据）；协议写明前置 |
| G7 | 读数**不可复现**（端点/模型漂移） | F11 | 既不进门禁、也没被当趋势积累 | **不可修**；靠记录格式让**形态**可对照 |
| G8 | 没有 goal，政策路径没走过 | F17 | —— | **超出本任务**，仅记录 |

## Acceptance Criteria

- [x] **AC-1（R1）** 存在一条**写下来的**真实运行路径（命令、前置条件、跑哪个场景、要记哪些读数），
      且**该命令实测跑通过一次**（本次会话那一次）—— 不是纸上命令。
- [x] **AC-2（R1）** 文档明确写出读数**不可复现**、是**测量而非断言**、以及**为什么不能进 `npm test`**。
- [x] **AC-3（R1）** 存在一份**读数记录格式**，使两次真实运行的**形态**可对照（今天两份因为端点/模型不同而无法对照，F11）。
- [x] **AC-4（R1）** 写清楚**怎么新增一个真实运行场景**，并含 F19 那条判据。
- [x] **AC-5（R2）** G1–G5 每条都被处置：可修的**已修**（G2/G3/G4/G5），部分可修的给出所采用的做法（G1）。
- [x] **AC-6（R2）** G6–G8 标为**不可修 / 超范围**并写明理由，**不假装修了**。
- [x] **AC-7（R2）** 至少一条结论**能被一次命令复现**（F6/F7/F12/F21 那几条），不靠自述。
- [x] **AC-8** 门禁全绿：`npm run typecheck`、`npm test`、`npm run test:installer`；
      且 spec 预算（F20/F21）与 `harness-surface.yaml` 的两向一致性检查**必须继续通过**。
- [x] **AC-9** 不与既有决定冲突：不动 fail-closed 语义、不把真实运行变成门禁、
      **不新增运行时持久化格式**（记在文档里的读数模板不算运行时格式）。

## Out of Scope

- 修 `bash` 非幂等这条策略（F15）—— 候选议题，只记录。
- 提高证据捕获上限、改 fail-closed 重试策略。
- 把真实运行做成门禁或自动调度（F11）。
- 自动检测"这条路径从未被走过"（D-B 排除的机制）。
- 凭据管理（轮换密钥、环境变量注入）—— 独立的安全事务。
- 新增真实运行场景（D-C 排除）。
