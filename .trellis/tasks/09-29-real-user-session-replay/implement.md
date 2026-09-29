# Implement — 让仓库能重复地重现"一个人真实使用 agent"的情形

## 改动前必读（都是量过的）

| 事实 | 值 | 为什么重要 |
|---|---|---|
| `dove_pi.py` 里 `DOVE_PI_FRAMEWORK_VERSION` 出现次数 | **1（只有 help 文本 `:974`）** | D0 的依据：help 声称会设，代码没设 |
| `--mode rpc` 的派发路径 | `main()` 落到 `:1037 return launch(arguments)` | D0 修的就是 harness 走的那条路 |
| harness 发过的 RPC 命令种类 | `prompt` / `steer` / `follow_up` / `extension_ui_response` / `get_state` / `get_session_stats` | **从未发过 `abort`、`compact`** |
| harness 的 CLI flag 数 | 13（`:9-25`），**无一个控制对话框** | G2 的依据 |
| 对话框应答位置 | `:141-142`，写死 `cancelled:true` / `confirmed:false` | G2 的依据 |
| session 目录 | `resolve(sessionBase, \`\${scenarioSlug}-\${nonce}\`)`（`:40`），`nonce` 含 pid+时间（`:28`） | 跨运行续接需要显式 opt-in |
| `--reuse-session` 必须保护的不变量 | `tests/real-dove-blackbox.test.ts:409` "keeps concurrent scenarios on disjoint runtime roots" | 默认必须保持唯一 |
| 启动器 env 的测试覆盖 | **0 个测试文件**提到 `DOVE_PI_EXTENSION_VERSION` / `launch_env` | D0 要加第一个断言 |
| `tests/` 在声明面内 | `harness-surface.yaml` `tool-implementation: [src, tests]` | 场景放 `tests/fixtures/scenarios/` 而非新建顶层目录 |
| `npm test` 的 glob | `tests/**/*.test.ts` | 场景 JSON 不会被误当测试文件收走 |

## 执行清单（按依赖顺序）

### 1. D0 — `dove_pi.py` 设置 `DOVE_PI_FRAMEWORK_VERSION`

- 在 `:472-476` 的 `DOVE_PI_EXTENSION_VERSION` 赋值旁边加一行，取同一个 `package_versions()[0]`，
  `except RuntimeError` 分支同样回落 `"0.1.0"`。
- 与 `bin/dove-pi.cjs:147` 对齐；两个变量必须分开的理由见该文件的注释（一个是扩展身份，一个是 mode 面向的框架版本）。
- **不要**改 help 文本：help 是契约，缺的是代码。

**测试**（新增，这是本仓库第一个启动器 env 断言）：

- 位置：`tests/installer_test.py`（该文件已直接 import `dove_pi` 的符号）。
- 做法：patch `subprocess.run`，调用 `dove_pi.launch([...])`，断言传给子进程的 `env` 里
  `DOVE_PI_FRAMEWORK_VERSION` 存在且等于包版本；并断言 `DOVE_PI_EXTENSION_VERSION` 与它同在
  （两者一起出现才是"对齐"，只测一个会让下次谁删掉另一个而无人发现）。
- 若 `PI_ENTRY.exists()` 在测试环境下为假，`launch()` 会抛 `RuntimeError`——沿用该文件既有的处理方式（跳过或伪造），
  **不要**为了让测试过而放宽 `launch()` 的前置检查。

**验证**：`npm run test:installer`

### 2. harness — 对话框由场景声明（G2）

- `loadScenario()`（`:292-302`）为每个 step 增加 `dialogs`：一个数组，元素形如
  `{ "method": "confirm", "confirmed": true }` 或 `{ "method": "select", "value": "..." }` 或 `{ "method": "input", "value": "..." }`。
  校验：未知 `method` 直接抛错（与 `:299` 对未知 `kind` 的处理一致——**不要把不认识的答案静默丢掉**）。
- 消费：每个 step 维护一个队列；收到 `extension_ui_request` 时**先取队列**，取空才回落默认。
- 默认保持今天的安全侧（`confirm → false`，其它 → `cancelled`），但**必须标记来源**。
- 记录：每个对话框写 `{ method, answer, source: "scenario" | "default" }` 进运行日志。
- summary 增 `dialogs: { approved, declined, cancelled, defaulted }`。
  `defaulted` 是关键：它把"场景要求的拒绝"与"harness 默认的拒绝"分开——今天这两件事读起来一模一样。
- 写入 summary 前必须过 `redactSummary`（`:349+`）：答案文本属于用户输入，按既有规则脱敏。

### 3. harness — 新增 `abort` 与 `compact` 两种 step kind

- `:299` 的白名单加 `"abort"`、`"compact"`。
- 派发（`:264` 附近）：`abort → { type: "abort" }`，`compact → { type: "compact" }`。
- **取消必须是"飞行中"的**：`{ "kind": "abort", "duringTools": true }` 时，
  在第一个 `tool_execution_start` 到达时发送（复用 `:134` 的 `queueDuringTools` 机制），
  否则取消会落在两次请求之间，测不到真正的中断路径。
- 两者都要出现在 step 记录里（`:101` 的 `stepRecords`），否则 summary 读不出这一步做了什么。

### 4. harness — `--reuse-session`

- 新增 flag；给了它时 `sessionDir` **原样使用** `--session-dir`，不再追加 `slug-nonce`（`:40`）。
- **默认不变**：不给该 flag 时行为与今天逐字节相同，`:409` 的并发用例必须继续绿。
- 日志里记录本次是复用了哪个目录，否则"续接"这件事在证据里看不见。

### 5. 场景库 — `tests/fixtures/scenarios/*.json`（7 份）

| 文件 | 步骤要点 | 期望的可观测结果 |
|---|---|---|
| `consent-approved.json` | 临时项目声明一个 `ask_before` 含某动作的 mode；prompt 触发该动作；`dialogs: [{confirm, true}]` | ledger 出现 `gate.approved`；动作**真的执行**；`dialogs.approved = 1` |
| `consent-declined.json` | 同上，`confirmed: false` | `gate.refused` 且 remediation 是"操作者拒绝"那一支；动作未执行 |
| `cancel-mid-flight.json` | prompt 触发一个会跑一会的工具；`{kind:"abort", duringTools:true}` | `request.terminal` reason=`cancelled`、origin=`user`；进程干净退出 |
| `resume-across-runs.json` | 两次运行共享 `--reuse-session --session-dir <同一目录>`；第二次发一个新 prompt | 第二次是**新的逻辑请求**（不是被合并的重投）；上下文延续 |
| `correction.json` | prompt A；随后 prompt B 明确推翻 A | 两个不同的 `requestId`；`request.planned` 各一条；无重复 plan |
| `long-session-past-cap.json` | 环境设 `DOVE_PI_MAX_MESSAGES` 为小值；跑足够多轮 | 越过上限后出现守卫的 advisory；运行仍有界、不挂死 |
| `compact.json` | 若干轮后发 `{kind:"compact"}` | `compaction_start` / `compaction_end` 事件出现；其后请求仍完成 |

场景 JSON 只描述**做什么**；断言不写进去（见 design D4）。

### 6. 测试 — 逐场景断言（`tests/real-dove-blackbox.test.ts`）

- 新增 7 个 `it`，每个从 `tests/fixtures/scenarios/<name>.json` 读取（**不要**再在测试里临时拼场景——
  那正是"没有可复用场景"这个缺口本身）。
- 每个用例断言的是**上一张表的第三列**，从 `.summary.json` 与运行 JSONL 里取，不新增断言机制。
- `consent-*` 两个用例需要 mode 能加载：依赖第 1 步的 D0。**若第 1 步未完成，这两个用例必须失败而不是跳过**——
  跳过会让缺口重新变得不可见。
- 复用既有的 `runHarness` helper（`:433` 附近）与其超时约定。

### 7. 真模型那次运行（手动，需要你先配 provider）

**前提**：`~/.pi/agent/` 现在只有 `dove/`。先通过 `/login` + `/model` 或 settings/凭据把 provider 配好，并确认有网络。

**命令**（只跑**一个**代表性场景，不是七个）：

```powershell
node scripts/real-dove-blackbox.mjs --launcher source --provider real ^
  --cwd <一个临时项目> ^
  --scenario tests/fixtures/scenarios/correction.json ^
  --output <仓库外的路径>\real-run.jsonl --timeout-ms 900000
```

**产物处理**：

- 原始 `--output` 落在**仓库外**（harness 默认就在 `tmpdir`）。**不要把原始运行提交进 git**：
  `quality-guidelines.md` 要求证据投影不持久化原始 prompt 与绝对路径，本仓库也没有这种先例。
- **读数**（写进本任务的 `implement.md` 与 journal）：退出码；每步 `settled`；
  `ledgerTerminal.terminal.code`；`providerEvidence` 的 `messageCount`/`messageChars`/`toolCount` 增长；
  `dialogs` 计数；总耗时。
- **必须显式写"不可复现"**：记下 provider/model/日期，并说明这份读数不能被当作可重跑的基线。
  不写这句，后来者会把它当门禁。

### 8. 保真边界写进收尾项

在 `implement.md` 末尾与 journal 里写明**本夹具不覆盖**：TUI 渲染、快捷键、状态栏、自定义组件、
真实 provider 的网络与限流差异、以及"agent 是否把活干对"。
避免后来者把"夹具跑绿"读成"产品被测过"。

### 9. 全量门禁

```powershell
npm run typecheck
npm test
npm run test:installer
node --import tsx --test tests/real-dove-blackbox.test.ts tests/harness-surface.test.ts tests/document-drift.test.ts
node scripts/real-dove-blackbox.mjs --launcher source --provider faux --cwd <临时目录> --scenario tests/fixtures/scenarios/consent-approved.json --output <临时目录>\smoke.jsonl
```

最后一条是**手动冒烟**：确认场景能被独立运行，而不只是能在测试里跑。

## 风险文件与回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| `dove_pi.py` | 本任务唯一的行为变更；影响"声明了 mode 且经源码入口启动"的情形（今天是坏的） | 删那一行 |
| `scripts/real-dove-blackbox.mjs` | 13 个既有用例全依赖它；`dialogs` 与 `--reuse-session` 都必须是**加法** | 新字段/新 flag 都是可选路径；还原三处改动 |
| `tests/real-dove-blackbox.test.ts` | 新增 7 个用例会拉长套件时长（每个都真的 spawn 一个 Pi） | 删除新用例 |
| `tests/fixtures/scenarios/` | 纯新增 | 删目录 |

没有新的持久化写入点，**回滚不需要清理状态**。

## `task.py start` 之前的自检

- [ ] `design.md` 的 D0–D7 每条都能在实现里指到具体行。
- [ ] `implement.jsonl` / `check.jsonl` 各至少一条真实 spec 条目（`.trellis/config.yaml` 的 `codex.dispatch_mode` 默认 auto）。
- [ ] 7 个场景文件都在 `tests/fixtures/scenarios/` 下，且**每个都有对应的 `it`**；没有"写了场景但没断言"的孤儿。
- [ ] `consent-*` 两个用例依赖 D0，且**失败而非跳过**。
- [ ] 默认对话框行为未变（`confirmed:false` / `cancelled`），只是现在**被计数**了。
- [ ] `--reuse-session` 缺席时 `:409` 的并发用例行为逐字节不变。
- [ ] 真模型那次的读数写进 `implement.md`，并带"不可复现"声明。
- [ ] 保真边界已写明（第 8 步）。

## 完成记录（实现后追加）

### 落地的改动

| 步 | 内容 | 位置 |
|---|---|---|
| 1 | `dove_pi.py` 设 `DOVE_PI_FRAMEWORK_VERSION`（与 `DOVE_PI_EXTENSION_VERSION` 同取一个 `package_versions()[0]`），并加本仓库第一个启动器 env 断言 | `dove_pi.py` `launch()`；`tests/installer_test.py` 的 `test_launch_sets_the_framework_version_a_mode_range_is_checked_against` |
| 2 | 对话框答案由场景声明（`dialogs`，按序消费、方法不匹配即计 mismatch 并回落默认、未消费的计入 `unused`）；summary 增 `dialogs` 计数 | `scripts/real-dove-blackbox.mjs` |
| 3 | 新增 `compact` step 与 `abortDuringTools` 修饰符 | 同上 |
| 4 | 新增 `--reuse-session`（缺席时行为不变） | 同上 |
| 2b | 新增 `--dialog-case write`，让模型真的请求一个被 mode 闸住的工具 | 同上 |
| 5 | 7 份场景 | `tests/fixtures/scenarios/*.json` |
| 6 | 7 个用例 + 一个 consent fixture mode | `tests/real-dove-blackbox.test.ts` |

### 实现中发现并修正的四处（都是我自己的错）

1. **取消不能做成独立 step。** dispatcher 是严格串行的（第 N+1 步在第 N 步 settle 后才发），所以一个独立的 `abort` step 只能取消空闲的 agent —— 永远碰不到用户真正打断的那个飞行中请求。改成 `abortDuringTools` 修饰符，骑在既有的 `tool_execution_start` 边沿上，和 `queueDuringTools` 同一机制。
2. **`loadScenario` 把 `abortDuringTools` 丢了。** 返回对象里没带它，所以标志永远是 `undefined`，取消从未发出。用例断言 `reason === "cancelled"` 直接暴露了它（实际是 `completed`）。
3. **把"主机正确拒绝"当成了场景失败。** `compact` 在内容太少的会话上回 `success: false` + `"Nothing to compact (session too small)"`，这是主机行为正确。harness 不该自己发明这条策略（design D4：harness 只跑，断言在测试里），改为总是完成该 step 并记录 response。
4. **两层模板字面量的转义。** 我给 faux provider 写的 `content: "approved\n"` 经过 harness 自己的模板字面量后被折成真换行，生成的扩展出现未闭合字符串 → `Failed to load extension` → 全部 faux 用例连带失败。已改为不带换行的内容。

### 门禁结果

```text
npm run typecheck        PASS
npm test                 811 tests, 809 pass, 0 fail, 2 skipped   (改动前 804；+7 = 新增用例)
black-box 套件           18 pass / 0 fail / 2 skipped            (改动前 11 pass；11 个既有用例全绿)
npm run test:installer   141 tests, 4 failures                   (改动前 140 tests, 4 failures)
```

**installer 的 4 个失败是环境性的，且经受控对比证明与我无关**：把 4 个 tracked 改动 stash 掉、在 HEAD 上跑同一命令，得到**完全相同的 4 个失败**（`install.ps1` 的平台判定、`Path.home()`、子进程找不到 Python）。恢复后 4 个文件逐字节一致，stash 已清空。先前记录过的"1 个失败"基线是因为当时没设 `TEMP`，3 个 PowerShell 用例根本没执行 —— 这是基线错了，不是新增了失败。

### 第 7 步：真模型那次运行 —— **未执行**

**原因（已核实）**：`~/.pi/agent/` 下只有 `dove/`，没有 `settings.json`、没有 `auth.json`。未配置任何 provider 与凭据，所以 `--provider real` 必然以 `provider-authorization-denied` 结束。**这一步只有配置了凭据的人能做。**

配好之后要跑的命令（只跑一个代表性场景）：

```powershell
node scripts/real-dove-blackbox.mjs --launcher source --provider real ^
  --cwd <一个临时项目> ^
  --scenario tests/fixtures/scenarios/correction.json ^
  --output <仓库外的路径>\real-run.jsonl --timeout-ms 900000
```

要写下来的读数（写进本节与 journal）：退出码；每步 `settled`；`ledgerTerminal.terminal.code`；`providerEvidence` 的 `messageCount` / `messageChars` / `toolCount` 增长；`dialogs` 计数；总耗时。

**这份读数不可复现**，必须与 provider / model / 日期一起记，且**不得**被当作可重跑的门禁。原始 `--output` 落在仓库外，**不进 git**（`quality-guidelines.md` 要求证据投影不持久化原始 prompt 与绝对路径）。

### 第 8 步：保真边界（本夹具**不**覆盖）

- **模型是被脚本化的。** 这 7 个场景说的是"情形被正确重现"，**不是**"agent 把活干对了"。
- **TUI 渲染、快捷键、状态栏、自定义组件**：Pi 的 headless 面是 RPC，这些无法无人值守驱动，也不是 Dove 的策略所在层。
- **只有 `confirm` 对话框是可达的。** `ask_user_question` 不是 Pi 内置工具（整个 Pi 发行版里 0 命中），它来自可选扩展；所以 harness 能发的 `select` / `input` / `editor` 应答**没有已提交的场景支撑**，那三条路径只有装了会调用它们的扩展才可达。
- **真实 provider 的网络与限流差异**，以及真模型下的长会话 / compact / 进度守护行为，本任务没有真实观测。

不写这一段，后来者会把"夹具跑绿"读成"产品被测过"。
