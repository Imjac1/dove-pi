# Design — 让仓库能重复地重现"一个人真实使用 agent"的情形

## 1. 问题的一句话

仓库有一个能隔离、能取证、能多轮的会话夹具，但它**从来没有被用来模拟一个真人**：
模型是罐头文本、对话框被写死成"一律拒绝"、work mode 在用户路径上根本加载不了。

## 2. 已核实的事实基线

### 夹具已经具备的（不需要重建）

- 通过**公开 launcher** 启动：`python dove_pi.py --offline --mode rpc --session-dir <dir>`（`scripts/real-dove-blackbox.mjs:74-76`）。
- 三重隔离并按 nonce 分桶：`workspaceRoot` / `DOVE_PI_STATE_DIR` / `PI_CODING_AGENT_DIR`（`:36-46`）。
- 场景是步骤序列：`{kind}` ∈ `prompt | follow_up | steer | state | stats`（`:299`），支持 `queueDuringTools`。
- 取证：运行 JSONL + `.summary.json`（`rpcFailure` / `ledgerTerminal` / `terminalConsistency` / `diagnosticGap` / `providerEvidence` / `promptDigest`）+ `.provider.jsonl`（每轮 systemPromptChars / messageCount / messageChars / toolCount）。
- RPC 是 Pi 自己定义的 headless 自动化面（`node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`），命令面已覆盖本设计需要的全部动作：
  `abort`(`:124`)、`compact`(`:374`)、`get_state`、`get_session_stats`、`prompt` 的 `steer`/`followUp`(`:80`,`:102`)，
  以及扩展对话框 `extension_ui_request`/`extension_ui_response`(`:1163-1350`)。

### 三个已核实的缺口

**G1 — 模型是罐头文本。** `scripts/real-dove-blackbox.mjs:320` 的默认响应是
`Array.from({ length: 64 }, () => fauxAssistantMessage("Deterministic black-box provider response."))`：
不调工具、不规划、不编辑。专项模式（`--progress-case`、`--subagent-case`）才发脚本化调用。
这是刻意的（确定性、零成本、可进 CI），但它只跑**管道与策略**。

**G2 — 对话框被写死成拒绝。** `:141-142`：

```js
if (event.type === "extension_ui_request" && ["select","input","editor"].includes(event.method)) writeCommand({ type: "extension_ui_response", id: event.id, cancelled: true });
else if (event.type === "extension_ui_request" && event.method === "confirm") writeCommand({ type: "extension_ui_response", id: event.id, confirmed: false });
```

13 个 CLI flag（`:9-25`）**没有一个**能控制对话框答案；测试文件里也没有任何对话框处理（grep 为空）。
所以这个夹具模拟的是一个**对所有确认一律拒绝、对所有提问一律取消**的用户。
Dove 侧会弹对话框的地方恰好是两处：work mode 的 `ask_before`（`src/pi-adapter/extension.ts:2742-2743`）与
`ask_user_question`（`:2685`）。
**后果：用户最重要的一次交互——说"可以，去做"——从未被模拟过。**

**G3 — work mode 在用户路径上加载不了。** 两个独立原因，都已核实：

1. **没有任何场景声明 mode**：`tests/real-dove-blackbox.test.ts` 与 harness 都不提 `.dove/mode.json`。
2. **源启动器不设 `DOVE_PI_FRAMEWORK_VERSION`**：`dove_pi.py` 的 help（`:972-975`）**声称**
   "The launcher sets these for the extension it starts, and overwrites whatever is there: … DOVE_PI_FRAMEWORK_VERSION …"，
   但该变量在整个文件里**从未被赋值**（全文件 grep 只有 help 那一行）；只有 `bin/dove-pi.cjs:147` 设它。
   而 `src/pi-adapter/extension.ts` 在 mode 声明了 framework range 时，若该变量缺失就**拒绝加载**：
   `"Work mode '<name>' declares a framework range that cannot be checked here: DOVE_PI_FRAMEWORK_VERSION is not set."`

**G3.2 是一条用户可见的产品缺陷，不只是夹具问题**：同一个声明了 mode 的项目，
用 `python dove_pi.py`（README 记录的自源码安装入口）启动会看到 mode 加载失败、此后**每一次工具调用都被拒**；
用 `dove-pi` 启动则正常。两个都被文档化的入口行为不同。

### 另一处会作废设计的细节（已核实）

harness 的 session 目录是 `resolve(sessionBase, \`\${scenarioSlug}-\${nonce}\`)`（`:40`），
而 `nonce` 含 pid 与时间戳（`:28`）——**同一个 `--session-dir` 传两次也会得到两个不同目录**。
这是刻意的：`:409` 的用例 "keeps concurrent scenarios on disjoint runtime roots" 依赖它。
所以"跨运行续接"场景**不能假设夹具已支持**，需要显式改动，且**默认行为必须保持唯一**。

## 3. 设计决策

### D0 — 先修 G3.2：`dove_pi.py` 必须设置 `DOVE_PI_FRAMEWORK_VERSION`

**选**：在 `dove_pi.py` 里 `DOVE_PI_EXTENSION_VERSION` 赋值旁边加一行，值取同一个 `package_versions()[0]`
（失败回落 `"0.1.0"`），与 `bin/dove-pi.cjs:147` 对齐。

**理由**：三条独立证据指向"缺的是代码不是文档"——
(1) 该文件的 help 明确把它列在"The launcher sets these … and overwrites whatever is there"之下；
(2) 托管启动器已经这么做，并且注释解释了为什么这两个变量必须分开；
(3) 扩展在它缺失时**拒绝加载 mode**，即没有它，声明 mode 的项目在源码入口下不可用。

**否**：让 harness 自己设该变量。这样夹具就跑在一个真实用户没有的环境里——**模拟比产品更宽松，恰好背离本任务的目的**。

**代价**：这是本任务里唯一的行为变更。它只影响"声明了 mode 且经源码入口启动"的情形，而那种情形今天是**坏的**。

### D1 — 场景放在 `tests/fixtures/scenarios/*.json`

**选**：`tests/fixtures/scenarios/`。

**理由**：`.trellis/harness-surface.yaml` 把 `tool-implementation` 声明为 `[src, tests]`，
所以落在 `tests/` 下的改动被 `src/core/harness-round.ts` 的 `surfaceFit` 判为 **inside**；
新建顶层目录会落在**所有已声明组件之外**，被同一套工具报为 outside。
且 `tests/fixtures/` 已经是测试数据的既有位置（`representative-tool-catalog.ts`、`sept1-question-loop.ts`）。
另外不需要改 `.trellis/spec/backend/directory-structure.md`。

### D2 — 扩展既有 step 形状，不发明第二套

```json
{
  "name": "consent-approved",
  "steps": [
    { "kind": "prompt", "message": "…", "dialogs": [{ "method": "confirm", "confirmed": true }] },
    { "kind": "state" },
    { "kind": "stats" }
  ]
}
```

`dialogs` 按顺序消费；缺席时保持今天的行为（`confirm → false`、其它 → `cancelled`）。
**向后兼容**：现有 13 个用例的场景不含 `dialogs`，行为不变。

### D3 — 对话框答案的来源必须被区分并计数

harness 为每个对话框记 `{ method, answer, source: "scenario" | "default" }`，
summary 增 `dialogs: { approved, declined, cancelled, defaulted }`。

**理由**："场景要求的拒绝"与"harness 默认的拒绝"今天读起来一模一样，而它们是完全不同的事实——
这正是本仓库反复处理的"没有 vs 没记录"形状，也是上一个任务里刚修过的同一类缺陷。
**默认值保持安全侧（拒绝）**，但它是**被声明的**，不是被静默继承的。

### D4 — 场景是数据，断言留在测试里

harness 只负责运行与取证；每个场景的期望**写在 `tests/real-dove-blackbox.test.ts`**。
**理由**：夹具保持"笨"，断言保持显式；这与既有分工一致（13 个用例都是这么写的）。
**否**：把断言写进场景 JSON——那会把测试逻辑塞进数据文件，且一旦断言失败，报错位置会离开测试文件。

### D5 — 跨运行续接需要一个显式的 opt-in，默认不变

**选**：新增 `--reuse-session`（或等价物）：给了它，`--session-dir` 被**原样使用**，不再追加 `slug-nonce`。

**理由**：`:409` 的并发隔离用例依赖"每次运行目录唯一"这一不变量，所以**默认必须保持唯一**，
共享只能是显式选择。这不是新发明的约束，是既有不变量，本设计只是给它开一个被声明的口子。

### D6 — 真模型那次：一个场景、手动、标注不可复现、原始产物不进 git

**选**：只对**一个**代表性多轮场景跑真模型（`consent-approved` 或 `correction`），
命令与前提写进 `implement.md`；原始 `--output` 落在仓库外（harness 默认就在 `tmpdir`），
**读数**（轮数、终止原因、context 增长、toolCount、是否命中对话框）写进任务的 `implement.md` 与 journal。

**理由**：
- 真模型不能当门禁：不确定、烧钱、需要凭据。7 个场景里多数（长会话、compact、进度守护）是**确定性守卫行为**，
  faux 已经能确定性地覆盖；用真模型重跑它们只增加成本，不增加证据。
- 原始运行不进 git：`quality-guidelines.md` 要求证据投影**不持久化原始 prompt / 绝对路径**，
  且本仓库没有把原始会话塞进版本控制的先例。
- 必须**显式标注不可复现**，否则一份真模型读数会被后来者当成可重跑的基线。

**前提（只有你能做）**：`~/.pi/agent/` 现在只有 `dove/`，没有 `settings.json`、没有 `auth.json`，
所以 `--provider real` 必然以 `provider-authorization-denied` 结束。

### D6b — 场景清单（7 个），以及一处我读错后修正的

**已覆盖、因此不列入**：会话中途打 slash 命令（`/mode fast`、`/dove-thinking off`、`/dove-tools core|auto`）——
`tests/real-dove-blackbox.test.ts:216-226` 的 "replays ordered user steps" 用例已经在做这件事。
我最初把它列进缺口，是因为只读了用例名没有读用例体；这里记下修正，避免计划带着一个假缺口。

**真正未被覆盖的 7 个真人动作**：

| # | 场景 | 为什么今天不可能 |
|---|---|---|
| 1 | 批准一次 `ask_before` 动作 | G2：对话框写死 `confirmed: false` |
| 2 | 拒绝一次 `ask_before` 动作（且 mode 真的加载了） | G2 + G3：拒绝是写死的，且没有场景声明 mode |
| 3 | 中途取消（`abort`） | harness 只发过 prompt/steer/follow_up/get_state/get_session_stats，**从未发过 `abort`** |
| 4 | 跨运行续接 | session 目录带 per-run nonce（`:28`、`:40`），同一个 `--session-dir` 两次也不同目录 |
| 5 | 纠正（后一条指令推翻前一条） | 现有用例只有"继续"，没有"不是这个，改成 X" |
| 6 | 超过轮次上限的长会话 | `DOVE_PI_MAX_MESSAGES` 从未被设置 |
| 7 | 用户主动 `compact` | **从未发过 `compact`**（`:63` 断言的 `compacted: true` 是窗口不足触发的**自动**压缩，不是这个动作） |

### D7 — 保真边界要写在明处

本设计**不覆盖**：TUI 渲染、快捷键、状态栏、自定义组件（Pi 的 headless 面是 RPC，TUI 无法无人值守驱动），
真实 provider 的网络与限流差异，以及"agent 是否把活干对"这一层。
把这条写进 `implement.md` 的收尾项，避免后来者把"夹具跑绿"读成"产品被测过"。

## 4. 数据流

```
tests/fixtures/scenarios/<name>.json          ← 新增：真人会做的 8 个动作，每个一份
        │  --scenario <path>
        ▼
scripts/real-dove-blackbox.mjs                ← 改动：消费 dialogs、记录 source、--reuse-session
        │  spawn: python dove_pi.py --offline --mode rpc --session-dir <dir>
        │         env: DOVE_PI_STATE_DIR / PI_CODING_AGENT_DIR / (D0 后) DOVE_PI_FRAMEWORK_VERSION
        ▼
Pi RPC ── events ──► 运行 JSONL + .summary.json（含新的 dialogs 计数）
        │
        ▼
tests/real-dove-blackbox.test.ts              ← 逐场景断言（gate.approved / gate.refused / terminal / 计数）
```

## 5. 兼容与迁移

- **场景 JSON 向后兼容**：无 `dialogs` 即旧行为。现有 13 个用例不改一行也能继续绿。
- **`--reuse-session` 是加法**：默认唯一，`:409` 的并发用例不受影响。
- **D0 是行为变更**：只把源码入口对齐它自己 help 里已声明的行为，且只影响声明了 mode 的项目。
- **无数据迁移**：不新增持久化格式；不新增 `ExecutionRecordKind`。

## 6. 权衡与回滚

- **权衡 A**：8 个场景放一个任务里，而不是拆父子。它们共用同一个机制（step + dialogs），
  拆开会复制夹具知识而不减少风险。若实现中某个场景暴露独立问题，再按 workflow 的父子规则拆。
- **权衡 B**：真模型只跑一个场景。代价是"真模型下的长会话/compact 行为"没有真实观测；
  收益是成本可控且读数可解释。要补是后续任务，不是本任务偷工。
- **回滚**：D0 是一行；harness 改动是加法（新字段、新 flag）；场景文件是新增。
  **没有任何一项需要清理状态**——这也是选择"只加数据与加法式开关"的理由。

## 7. 已知不做

- 不驱动 TUI（见 D7）。
- 不把断言搬进场景 JSON（见 D4）。
- 不让夹具替产品补环境变量（见 D0 的"否"）。
- 不改模型行为让 agent"更会干活"：那是另一个问题，且在本机无凭据时无法验证。
