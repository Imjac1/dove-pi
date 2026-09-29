# 模拟用户真实使用 agent 的情况

> **目标修正声明。** 本任务创建时的 title/description 写的是"把既有的使用流程方案对今天的代码量一遍"。
> 那是我对请求的第一次解读，**已被用户纠正**：要做的是**模拟用户真实使用 agent 的情况**（选定档位 B）。
> `task.py` 无法改顶层 title（实测 `set-meta` 只写入 `task.json.meta`），所以 `task.json.title` 与目录 slug 仍是旧措辞。
> 这里显式记下这处错配而不是让它静默漂着。第一次解读并非白做——它产出的"仓库已覆盖什么"的地图是设计本任务的基线。

## Goal

让这个仓库能够**重复地、可评审地**重现"一个人真实使用 Dove Pi agent"的情形，并从一次真实模型的会话里取出可读的证据。

档位 **B**（已选）：先建可复用的场景库并用确定性 provider 跑通（可进 CI），再对一个代表性场景做一次**真模型的手动记录运行**。
A 是 B 的对照组：没有基线的那次真模型运行读不出结论。

## Background

### 夹具已经具备的（不需要重建）

`scripts/real-dove-blackbox.mjs`（455 行）已经能：经**公开 launcher** 启动
（`python dove_pi.py --offline --mode rpc --session-dir <dir>`，`:74-76`）；三重隔离并按 nonce 分桶
（`workspaceRoot` / `DOVE_PI_STATE_DIR` / `PI_CODING_AGENT_DIR`，`:36-46`）；按步骤序列驱动
（`{kind}` ∈ `prompt | follow_up | steer | state | stats`，`:299`，支持 `queueDuringTools`，`:134`）；
产出运行 JSONL + `.summary.json` + `.provider.jsonl`。

**RPC 是 Pi 自己定义的 headless 自动化面**（`node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`：
"enables headless operation of the coding agent via a JSON protocol … useful for embedding the agent in other applications"），
命令面已覆盖本任务需要的全部动作：`abort`(`:124`)、`compact`(`:374`)、`prompt` 的 `steer`/`followUp`(`:80`,`:102`)、
扩展对话框 `extension_ui_request`/`extension_ui_response`(`:1163-1350`)。

### 三个已核实的缺口

**G1 — 模型是罐头文本。** `scripts/real-dove-blackbox.mjs:320` 的默认响应是
`Array.from({ length: 64 }, () => fauxAssistantMessage("Deterministic black-box provider response."))`：
不调工具、不规划、不编辑。专项模式（`--progress-case`、`--subagent-case`）才发脚本化调用。
它跑的是**管道与策略**，不是"用户在用 agent 干活"。

**G2 — 对话框被写死成拒绝。** `:141-142` 对所有 `confirm` 回 `confirmed: false`、对所有 `select/input/editor` 回 `cancelled: true`；
13 个 CLI flag（`:9-25`）**没有一个**能控制它，测试文件里也没有任何对话框处理。
Dove 侧会弹对话框的地方恰是 work mode 的 `ask_before`（`src/pi-adapter/extension.ts:2742-2743`）与
`ask_user_question`（`:2685`）。**后果：用户最重要的一次交互——说"可以，去做"——从未被模拟过。**

**G3 — work mode 在用户路径上加载不了。** 两个独立原因：
1. 没有任何场景声明 mode（`tests/real-dove-blackbox.test.ts` 与 harness 都不提 `.dove/mode.json`）。
2. `dove_pi.py` 的 help（`:972-975`）**声称** "The launcher sets these … and overwrites whatever is there: …
   DOVE_PI_FRAMEWORK_VERSION …"，但该变量在整个文件里**只出现在那一行 help 文本**（`:974`），从未被赋值；
   只有 `bin/dove-pi.cjs:147` 设它。而 `src/pi-adapter/extension.ts` 在 mode 声明了 framework range 且该变量缺失时**拒绝加载**。

**G3.2 是用户可见的产品缺陷，不只是夹具问题**：同一个声明了 mode 的项目，用 `python dove_pi.py`（README 记录的自源码安装入口）
启动会看到 mode 加载失败、此后**每一次工具调用都被拒**；用 `dove-pi` 启动则正常。两个都被文档化的入口行为不同。
`--mode rpc` 走的正是 `launch()`（`dove_pi.py:1037` 兜底），所以这也是 harness 那条路。

### 一处会作废设计的细节（已核实）

session 目录是 `resolve(sessionBase, \`\${scenarioSlug}-\${nonce}\`)`（`:40`），`nonce` 含 pid 与时间（`:28`）——
**同一个 `--session-dir` 传两次也会得到两个不同目录**。这是刻意的：`tests/real-dove-blackbox.test.ts:409`
"keeps concurrent scenarios on disjoint runtime roots" 依赖它。所以"跨运行续接"需要显式 opt-in，且**默认必须保持唯一**。

### 一处我读错后修正的假缺口

**会话中途打 slash 命令已被覆盖**：`tests/real-dove-blackbox.test.ts:216-226` 的 "replays ordered user steps"
用例已经在会话中途发 `/mode fast`、`/dove-thinking off`、`/dove-tools core|auto`。
我最初把它列进缺口，是因为只读了用例名没读用例体。记在这里，避免计划带着一个假缺口。

### 真正未被覆盖的 7 个真人动作

| # | 场景 | 为什么今天不可能 |
|---|---|---|
| 1 | 批准一次 `ask_before` 动作 | G2：对话框写死 `confirmed: false` |
| 2 | 拒绝一次 `ask_before` 动作（且 mode 真的加载了） | G2 + G3：拒绝是写死的，且没有场景声明 mode |
| 3 | 中途取消（`abort`） | harness 只发过 `prompt/steer/follow_up/extension_ui_response/get_state/get_session_stats`，**从未发过 `abort`** |
| 4 | 跨运行续接 | session 目录带 per-run nonce |
| 5 | 纠正（后一条指令推翻前一条） | 现有用例只有"继续"，没有"不是这个，改成 X" |
| 6 | 超过轮次上限的长会话 | `DOVE_PI_MAX_MESSAGES` 从未被设置 |
| 7 | 用户主动 `compact` | **从未发过 `compact`**（`:63` 断言的 `compacted: true` 是窗口不足触发的**自动**压缩，不是这个动作） |

### 真模型那一档的前提（只有你能做）

`~/.pi/agent/` 下**只有 `dove/`**：没有 `settings.json`、没有 `auth.json`。即未配置任何 provider 与凭据 →
`--provider real` 必然以 `provider-authorization-denied` 结束（`:194` 那个用例正是拿这个当夹子）。

## Requirements

**R1（G3.2，用户可见缺陷）** `dove_pi.py` 必须设置 `DOVE_PI_FRAMEWORK_VERSION`，与其 help 文本（`:972-975`）及
`bin/dove-pi.cjs:147` 一致。这是本任务唯一的行为变更，也是场景 1/2 的前提。
**不得**改 help 文本（help 是契约），**不得**让 harness 替产品补环境变量（那会让模拟比产品更宽松）。

**R2（G2，核心）** 对话框答案必须能由场景声明：`loadScenario()`（`:292-302`）为每个 step 接受 `dialogs` 数组，
按顺序消费；未知 `method` 抛错而不是静默丢弃。

**R3（G2）** 答案的**来源必须被区分并计数**：每个对话框记 `{method, answer, source: "scenario" | "default"}`，
summary 增 `dialogs: {approved, declined, cancelled, defaulted}`。
默认保持安全侧（拒绝/取消）但必须被计数——"场景要求的拒绝"与"harness 默认的拒绝"今天是同一个读数。

**R4** harness 新增两种 step kind：`abort`（支持 `duringTools`，复用 `:134` 机制，否则取消落在两次请求之间测不到真正的中断路径）
与 `compact`。两者都要进 `stepRecords`（`:101`）。

**R5** 新增 `--reuse-session`：给了它时 `sessionDir` 原样使用 `--session-dir`；**缺席时行为与今天逐字节相同**
（保护 `:409` 的不变量）。

**R6** 场景库落在 `tests/fixtures/scenarios/`（7 份 JSON，内容见 `implement.md` 的表）。
位置理由：`.trellis/harness-surface.yaml` 的 `tool-implementation: [src, tests]` 使 `tests/` 内的改动被判为 **inside**；
新建顶层目录会落在所有已声明组件之外。场景只描述"做什么"，**断言不写进 JSON**。

**R7** 逐场景断言写在 `tests/real-dove-blackbox.test.ts`（新增 7 个 `it`，从 `tests/fixtures/scenarios/` 读取，
不再在测试里临时拼场景——那正是"没有可复用场景"这个缺口本身）。`consent-*` 两个用例依赖 R1，
**若 R1 未完成必须失败而不是跳过**（跳过会让缺口重新不可见）。

## Acceptance Criteria

- [ ] **AC-1** `dove_pi.py` 启动时子进程 env 含 `DOVE_PI_FRAMEWORK_VERSION`，值与包版本一致，
      且与 `DOVE_PI_EXTENSION_VERSION` **同时存在**（只测一个会让下次谁删掉另一个而无人发现）。有测试覆盖——
      这是本仓库第一个启动器 env 断言（今天 0 个测试文件提到 `launch_env`）。
- [ ] **AC-2** 场景可由 `dialogs` 声明答案；`{confirm, true}` 能真正走通 `ask_before` 的**批准**路径，
      ledger 出现 `gate.approved` 且动作确实执行（今天不可能）。
- [ ] **AC-3** 拒绝路径同样有场景：`gate.refused` 的 remediation 是"操作者拒绝"那一支，动作未执行。
- [ ] **AC-4** `dialogs` 计数出现在 summary 里，且 `defaulted` 与 `declined` 可分辨。
- [ ] **AC-5** 七个场景各有一个用例与断言：批准、拒绝、取消、续接、纠正、长会话越界、主动 compact。
      `cancel` 断言 `request.terminal` reason=`cancelled`、origin=`user`。
- [ ] **AC-6** 每个场景经公开 launcher 启动、隔离三件套齐全、产出 `.summary.json` 与运行 JSONL，**不依赖网络**。
- [ ] **AC-7** 真模型那次：一条可复制的命令 + 前提（你先配 provider）+ 读数是**写下来的数字**（写进 `implement.md` 与 journal）
      而原始运行**不进 git**；并带**显式"不可复现"声明**（provider/model/日期）。
- [ ] **AC-8** 门禁全绿：`npm run typecheck`、`npm test`、`npm run test:installer`，
      以及 `tests/harness-surface.test.ts`、`tests/document-drift.test.ts`；
      既有的环境性失败（`Path.home()` 无 HOME、`install.ps1` 平台判定、裸 `node --test` 的 PATH）**须与前次基线一致**，不得新增。

## Technical Notes

设计决策见 `design.md`（D0–D7）：D0 修启动器、D1 场景位置、D2 扩展 step 形状而不发明第二套、D3 区分答案来源、
D4 场景是数据断言在测试里、D5 `--reuse-session` 是显式 opt-in、D6 真模型只跑一个场景、D7 保真边界写明。

- 场景 JSON 向后兼容：无 `dialogs` 即旧行为，现有 13 个用例不改一行也能继续绿。
- `npm test` 的 glob 是 `tests/**/*.test.ts`，场景 JSON 不会被误当测试收走。
- 写入 summary 前必须过 `redactSummary`（`:349+`）：对话框答案属于用户输入，按既有规则脱敏。
- 不新增 `ExecutionRecordKind`，不新增持久化格式。

## Out of Scope

- 重新审一遍使用流程：16 个同族归档任务已覆盖每个流程段（安装/首启/turn/恢复/可观测），全部 completed。
- 安装器与 release 流程。
- 驱动 TUI（快捷键、状态栏、自定义组件）：Pi 的 headless 面是 RPC，TUI 无法无人值守驱动，且不是 Dove 的策略所在层。
- 改模型行为让 agent"更会干活"：另一个问题，且本机无凭据时无法验证。
- 让 harness 替产品补 `DOVE_PI_FRAMEWORK_VERSION`（见 R1 的"不得"）。

## Deferred

- **真模型那一档的执行**取决于你先配置 provider 与凭据（`~/.pi/agent/` 目前为空）。场景库与确定性运行不依赖它，可以先落地。
- **保真边界**（`implement.md` 第 8 步）必须写进收尾项：本夹具**不覆盖** TUI 渲染、快捷键、状态栏、自定义组件、
  真实 provider 的网络与限流差异，以及"agent 是否把活干对"。不写这句，后来者会把"夹具跑绿"读成"产品被测过"。
- 真模型下的长会话 / compact / 进度守护行为**没有真实观测**：本任务只用真模型跑一个代表性场景，
  其余交给确定性 provider。要补是后续任务，不是本任务偷工。
