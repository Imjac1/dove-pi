# dove-pi 现状：机制清单与缺陷审计

本文件是 `10-05-pstack-reference-audit` 的参考基线：**先事实、后缺陷**。所有断言带 `path:line` 锚点；每条缺陷带被引用的原文行、后果、以及一条读者可自行执行的确认命令。凡我未能验证的，明确写 `unverified` 并给出验证路径。

阅读方式说明（`unverified` 的边界）：

- 本文件**只读**：没有修改任何文件，没有提交，没有运行会写盘的命令。`npm test` / `npm run typecheck` / `scripts/harness-*.mts` **未执行**（我这一侧没有可用的执行授权）。因此"某测试会通过/会失败"属于**读来的判断**，不是跑出来的结果。
- `src/pi-adapter/extension.ts`（3609 行）我按区域读取（540-660、2190-2300、2600-2880、3180-3486），未逐行通读；该文件里我未读到的区域一律标 `unverified`。
- 行号以 `read` 工具返回的编号为准（例如 `extension.ts` 共 3609 行，而 `Get-Content | Measure-Object -Line` 报 3487；以 3609 为准）。

---

## 1. 机制清单（存在什么、在哪、是否在代码里强制）

判定口径：**enforced** = 有产品调用点，且该调用点在决策路径上会改变结果；**spec-only** = 只有规范/注释/测试声明，产品路径不消费；**死** = 连测试都不决策，只在状态投影或归一化里出现。

| # | 机制 | 做什么 | 位置（定义） | 产品调用点 | 判定 |
|---|---|---|---|---|---|
| 1 | 工作模式加载（三文件） | 读 `MODE.md`+`governance.yaml`+`permissions.yaml`，逐字段校验并**拒绝**不能兑现的声明 | `src/core/work-mode.ts:455`（`loadWorkMode`）、`src/core/work-mode.ts:993`（`loadWorkModeFromDirectory`）、`src/core/work-mode.ts:967`（`readWorkModeFiles`） | `src/pi-adapter/extension.ts:2222` | **enforced**（含 `extension.ts:2214-2219` 对 `DOVE_PI_FRAMEWORK_VERSION` 缺失的拒绝） |
| 2 | 模式 body（`MODE.md` 正文=指令） | 应为模式的指令文本 | 声明 `src/core/work-mode.ts:79`；赋值 `src/core/work-mode.ts:811` | **无** | **死**（见缺陷 D2） |
| 3 | permission 列表 | `never_allow` / `ask_before` / `always_allow` / `unlisted` 四条判定 | `src/core/work-mode.ts:69`（`PermissionSet`）、`evaluatePermission`、`matchesPermission` | `src/pi-adapter/extension.ts:2635`（仅名字的 `denyDecision`）、`src/pi-adapter/extension.ts:2751`（`evaluate`）、`src/core/action-policy.ts:427`、`src/core/action-policy.ts:756` | **enforced** |
| 4 | `ask` 的两种来源 | `ask_before` 命中 vs `unlisted: ask`，并对两种答案都落账 | `src/core/action-policy.ts:760-773` | `src/pi-adapter/extension.ts:2772-2807`（`ctx.ui.confirm`，无对话框即拒绝） | **enforced** |
| 5 | `fence`（保护 prefix） | 拒绝写入模式声明的路径；junction/大小写/尾点/`\\?\` 都归一到同一位置 | `src/core/work-mode.ts:167`（类型）、`src/core/action-policy.ts:512-581` | `src/pi-adapter/extension.ts:2751` | **enforced** |
| 6 | 运行时 state root 保护（不依赖模式声明） | 任何模式下都拒绝写入 `.dove` state 父目录 | `src/core/action-policy.ts:593-610` | 同上 | **enforced** |
| 7 | `sandbox` 可兑现部分 | `network: none` 按工具名、`filesystem: read-only-source` 按 mutator 名拒绝 | `src/core/work-mode.ts:145`（类型）、`src/core/action-policy.ts:620-642` | `src/pi-adapter/extension.ts:2751` | **enforced（部分）**：只有这两个断言可兑现 |
| 8 | `sandbox` 不可兑现部分的拒绝 | `container`/`worktree`/`allowlist` 在装载期拒绝 | `src/pi-adapter/extension.ts:2250-2261` | 会话启动 | **enforced**，但**与 #9 重复** |
| 9 | `ENFORCEABLE_SANDBOX` | 名为"可兑现集合"的常量 | `src/core/work-mode.ts:207` | **无** | **死**（见缺陷 D1，任务 `10-03-dead-enforceable-constant` 记录的就是它） |
| 10 | `gate.limits`（阈值门） | 参数缺失/非有限=block；超上限/低于下限=block | `src/core/gate-limit.ts:73`（`createLimitGate`） | `src/core/action-policy.ts:722-726` | **enforced** |
| 11 | 累计 limit 上限 | 同一 limit 在一次会话内累加后仍判上限 | `src/core/action-policy.ts:335`（`cumulativeLimitBreach`）、`:730-731`；累加在 `:794-799` | 累加调用点 `src/pi-adapter/extension.ts:2810`（`recordRun`） | **enforced** |
| 12 | `gate.intensity` 天花板 | 按 phase 计"已跑过"的次数并拒绝超限 | `src/core/action-policy.ts:476-485`、`:708-721` | 计数 `src/core/loop-runner.ts:167-168`；`src/pi-adapter/extension.ts:2749` 传入 `accumulatedIntensity` | **enforced** |
| 13 | `scope.exclusions` | 目标落在排除名单=block（id/address 双向解析） | `src/core/action-policy.ts:402-425` | `evaluate`（`:499-500`） | **enforced** |
| 14 | capability scope | 模式授予的 capability 集合是上限 | `src/core/capability-scope.ts:107` | `src/core/action-policy.ts:287`、`:683-685` | **enforced**，仅当 `source.viaCapability` |
| 15 | `registered` 检查 | 模式授予但本部署未注册=`block` | `src/core/action-policy.ts:692-701` | 同上，仅 `viaCapability` | **enforced** |
| 16 | technique 见证 | 从命令行**语法**读被禁技术（而非声明的 `technique` 字段） | `src/core/argument-syntax.ts:129`（`TECHNIQUE_WITNESSES`）、`:134` | `src/core/action-policy.ts:643-678` | **enforced** |
| 17 | Capability Protocol 常量 | `1.0.0` 协议字面量 | `src/core/capability-protocol.ts:5` | `src/cli.ts:30`、`:382` | 常量存在；**schema 逐条拒绝规则未逐条核对** `unverified`（验证路径：读 `personal-agent-capability-runtime.md:39-42` 并对 `tests/capability-protocol.test.ts` 逐 case） |
| 18 | capability registry | 注册/查找/重复注册报错 | `src/core/capability-registry.ts:3` | `src/runtime.ts:15`（组合根） | **enforced** |
| 19 | capability 执行状态机 | 不允许的状态迁移抛错 | `src/core/capability-runtime.ts:40`（`transitionCapabilityExecution`） | `src/core/fast-path.ts:35,48,53,66,72,110,113,124,129,149` | **enforced** |
| 20 | 统一调用服务 | 协议/平台/审批/证据的统一入口 | `src/core/capability-invocation.ts:21` | `src/adapters/local-rpc.ts:28`、`src/pi-adapter/extension.ts:1624` | **enforced** |
| 21 | Fast Path + 授权边界 | 无 host 回调时副作用 capability `blocked` | `src/core/fast-path.ts:24` | `src/core/capability-invocation.ts:48`、`src/core/recipe-registry.ts:49` | **enforced** |
| 22 | effect boundary + effect ledger + store | 重放尝试上"已领取"拒绝、`unknown` 语义、claim 文件 | `src/core/effect-boundary.ts:75`、`:111`；`src/core/effect-ledger.ts:310`；`src/core/effect-store-file.ts:93` | `src/pi-adapter/extension.ts:2286-2293`（装载）、`:2814-2839`（dispatch 前）、`:2875-2877`（结果） | **enforced** |
| 23 | `dispatchOnce` | 另一份 exactly-once 实现（claim→run→complete） | `src/core/effect-ledger.ts:411` | **无**（仅测试） | **spec-only / 重复实现**（见缺陷 D7） |
| 24 | execution ledger（JSONL） | 追加式记录面；`append*` 一族 | `src/core/execution-ledger.ts:594`（`appendGateRefused`）、`:605`、`:617`（`appendToolObserved`） | `src/pi-adapter/extension.ts:2637,2756,2803,2821,2928` 等 | **enforced** |
| 25 | "失败的工具不留记录" | `tool.observed` 只在成功时写 | `src/pi-adapter/extension.ts:2925-2940` | 同 | **enforced**（与 `personal-agent-harness-loop.md:146-149` 一致） |
| 26 | 记录种类封闭集 | `ExecutionRecordKind` 联合类型 | `src/core/contracts.ts:90` | 全 ledger 写入 | **enforced（编译期）** |
| 27 | dispatch policy（成本校准） | inline/subagent/parallel 路由决策 | `src/core/dispatcher.ts:29`、`src/core/dispatch-policy.ts:3` | **无** | **spec-only**（见缺陷 D4） |
| 28 | invocation disposition | 一次回答"这是什么调用"（gate 与 replay 共用一张表） | `src/core/invocation-disposition.ts:159` | `src/pi-adapter/extension.ts:2658`（formal 门）、`:2884`（replay 读法） | **enforced** |
| 29 | context admission | 一切非对话内容进模型前的截断+摘要+摘要后的 digest/artifact | `src/core/context-admission.ts:141` | `src/pi-adapter/extension.ts:603/3101`（payload）、`:3587`（工具结果） | **enforced** |
| 30 | context compiler | 按相关性/大小预算取舍文档，标 `included/duplicate/irrelevant/budget/empty` | `src/core/context-compiler.ts:57`、`:131` | `src/trellis-adapter/context.ts:81`、`src/context/interoperable.ts:84` | **enforced** |
| 31 | cache-prefix 证据 | 每调用记录 system/tools/dove-context/history 的 digest 与变化类别 | `src/core/cache-prefix.ts:227`、`:274` | `src/pi-adapter/extension.ts:3144`（写入 ledger）、`:2984`（归因） | **只记录，不阻断**（设计如此，见 `personal-agent-request-runtime.md:66-68`） |
| 32 | ModelGateway 预算校验 | 段/token/保留量核算，超限抛 `ModelBudgetError` | `src/core/model-gateway.ts:324` | `src/pi-adapter/extension.ts:3090`、`:3119-3137`、`:3317` | **enforced** |
| 33 | `ModelGateway.dispatch` | "validate 后再 transport.send 一次" | `src/core/model-gateway.ts:329` | **无**（仅测试） | **spec-only** |
| 34 | failure reading（挖掘） | 把失败请求变成有界记录（class/mechanism/refusals/preserve） | `src/core/failure-reading.ts:178` | 仅 `scripts/harness-failures.mts`、`scripts/harness-corpus.mts` | **spec-only by design**（`tests/harness-reachability.test.ts:81`） |
| 35 | SSM axis / ITQ | 崩溃自由率、隔离拒绝率、每轮 criterion 向量 | `src/core/harness-axes.ts:105`、`:169` | 仅 `scripts/harness-axes.mts` | **spec-only by design**（`harness-reachability.test.ts:76`） |
| 36 | surface fit / verifier fit | 提交是否落在声明面内 / 是否动了 verifier | `src/core/harness-round.ts:52`、`:65` | 仅 `scripts/harness-rounds.mts:148,154` | **spec-only by design**（`harness-reachability.test.ts:86`） |
| 37 | corpus 摘要 | 一手汇总已有语料，并说明为何为空 | `src/core/harness-corpus.ts:56` | 仅 `scripts/harness-corpus.mts` | **spec-only by design**（`harness-reachability.test.ts:90`） |
| 38 | task convergence（收敛记录） | 冻结验收、事件归约、checkpoint、verdict | `src/core/task-convergence.ts:247`（`reduceTaskConvergence`）、`:317`、`:1069`（`verdictFor`）、`:1114` | `src/pi-adapter/extension.ts:1653-1654`（`agent_task_convergence` 工具）、`:2686-2717`（formal mutation 门） | **enforced** |
| 39 | change manifest / 预测-裁决 | 先记预测、下一轮写 `change.decided` | `src/pi-adapter/extension.ts:1787-1832`；`task-convergence.ts:944-945`（`MAX_CHANGES`/`MAX_PREDICTIONS`，在 `:583`、`:661` 强制） | 同 | **enforced** |
| 40 | checkpoint（动作边界） | 动作边界快照 | `src/core/checkpoint.ts` | **无** | **spec-only**（`harness-reachability.test.ts:62` 明写其理由） |
| 41 | authority + 装载期 preflight | 授权文档与 grant 窗口/证据摘要的预检 | `src/core/authority.ts:282` | `src/pi-adapter/extension.ts:2230` | **enforced**（见缺陷 D3：模式文档仍说它没有调用者） |
| 42 | evidence 秘密过滤 | 证据引用中的凭据/私钥名与扩展名被剔除 | `src/core/evidence.ts:10`、`:17` | `src/core/fast-path.ts:133` | **enforced**（仅 captureEvidence 路径；capability 自带 refs 是否同样过滤 `unverified`） |
| 43 | extension identity / 重复装载抑制 | 只保留启动器指定的那份 wrapper | `src/core/extension-identity.ts:61` | `.pi/extensions/personal-agent.ts:12` | **enforced** |
| 44 | project status | 项目健康/任务/技能读法 | `src/project-status.ts:16` | `src/cli.ts:148,174` | **enforced** |
| 45 | managed install status | 托管安装根/sourceDrift | `src/managed-install-status.ts:58` | `src/cli.ts:67` | **enforced** |
| 46 | 声明可编辑面（harness surface） | 七组件→路径的映射，装载时校验每条能解析 | `src/core/harness-surface.ts:74`、`:165` | `src/pi-adapter/extension.ts:581-601`（只回 count） | **enforced（仅解析与组件名）**；`verifiedBy`/`verifier` 在产品内**解析后丢弃**（见缺陷 D8） |

---

## 2. 一轮 turn 的真实调用链

关键事实：**产品里跑的不是 `src/core/loop-runner.ts`**，而是 Pi 自己的 agent loop；dove-pi 是它的中间件。`loop-runner.ts` 是"参考 loop"，唯一产品消费者是诊断命令 `dove-pi axi-turn`（`tests/harness-reachability.test.ts:51-55`）。

1. **进程入口**：`bin/dove-pi.cjs:152` `spawn(process.execPath, [piEntry, "-e", extension, ...], …)`；扩展入口是 `bin/dove-pi.cjs:17` 的 `.pi/extensions/personal-agent.ts`，它在 `.pi/extensions/personal-agent.ts:2` 转手 import `src/pi-adapter/extension.ts`。CLI 形态的入口是 `src/cli.ts:43`（`process.argv`）——两者是**不同**入口，`bin/dove-pi.cjs:48-66` 的 `shouldUsePiFastPath` 决定走哪条（见缺陷 D5）。
2. **系统提示词组装**：`pi.on("before_agent_start")` 的回调在 `src/pi-adapter/extension.ts:3309`：
   `const builtSystemPrompt = \`${event.systemPrompt}\n\n[PERSONAL AGENT]\n${stablePromptPolicy(buildCapabilityIndex(registry, recipes))} …\``
   —— 即 **Pi 自己的 system prompt + 固定的 Dove 策略串（`src/core/prompt-policy.ts:4`）+ capability 索引**。`AGENTS.md` 是被 **Pi** 读进去的（`node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js:116`：`const candidates = ["AGENTS.override.md", "AGENTS.md", …]`），不是 dove-pi 读的：`src` 全树没有 `AGENTS.md` 字面量。**`modes/` 的文本不进入系统提示词**（缺陷 D2）。
3. **请求计划**：`createRequestPlan`（`src/core/request-plan.ts`）→ `src/pi-adapter/extension.ts:3210` 起的一系列 intent/lane 判定；`request.received`/`request.planned` 落账。
4. **上下文准入与编译**：`src/pi-adapter/extension.ts:3288` `buildInteroperableProjectContext(projectProvider, contextQuery, mode.current, { maxChars: remainingContextChars, … })`；预算数字来自 `:3242` 的 `getProjectContextBudget`（见 §4）。产出的 message 只在其 epoch 变化时发射（`:3274-3281`）。
5. **模型调用前的预算门**：`:3099-3137`（`admitNonConversationalMessages` → `preparePayload` → `gateway.validate`）；失败则 `ctx.abort()` 并写 `model.budget.rejected`（`:3121-3126`）。注意 `:3309-3347` 还有第二处、只针对本回合新编译片段的预检。
6. **模型调用**：Pi 宿主；dove-pi 侧在 `message_end` 记录 `provider.request.completed`（`:2974-2986`）。
7. **工具调用**：`pi.on("tool_call")`，`src/pi-adapter/extension.ts:2623`。顺序（这就是"策略/派发"的真实位置）：
   - `:2628` 模式装载失败 → 一律 block；
   - `:2635` `denyDecision`（只读名字，先于其它判定）；
   - `:2657` 无活跃 lease 直接放行；
   - `:2658` `classifyInvocation`（formal 门 / replay 共用）；
   - `:2686-2717` formal lane 且 mutating → convergence 检查（void/freeze/checkpoint 各有自己的理由）；
   - `:2732` 归一化 `ls` 输入，`:2736-2811` `activeActionPolicy.evaluate`（fence→state root→technique→sandbox→scope→registered→intensity→limit→conformance→ask），拒绝写 `gate.refused`，放行后 `recordRun`；
   - `:2814-2839` effect boundary `prepare`（重放且非同幂等 → 拒绝）；
   - `:2844-2851` replay-safe 读法 + progress guard（只读预算、重复观察）。
8. **工具结果**：`pi.on("tool_result")`，`src/pi-adapter/extension.ts:2871`；`:2875` 写 claim 结果；`:2895` 压缩超大结果（`getToolResultCharBudget`，`:3557`）；`:2925` 成功才写 `tool.observed` 并给出 `[Dove observable: ledger:tool:<id>]` 供验收引用。
9. **结算**：`message_end`（`:2956`）→ `provider.request.completed` / 终止原因归一；`request.terminal` 落账后 `ctx.abort()`；`change.decided` 在轮边界写一次（`harness-loop-turn.md:85-92`；产品侧见 `src/pi-adapter/extension.ts:1810-1832` 附近的 verdict/baseline 读法）。
10. **参考 loop（仅 `axi-turn`）**：`src/commands/axi-turn.ts:125-143` → `src/core/loop-runner.ts:69`（`run`）→ `:124` gate → `:143` effect claim → `:170` 执行工具。

---

## 3. 缺陷清单

### (a) 声明了但不强制 / 死的可强制常量

**D1 — `ENFORCEABLE_SANDBOX` 无人引用（任务 `10-03-dead-enforceable-constant` 的记录仍然为真）。**
`src/core/work-mode.ts:207`：
```ts
const ENFORCEABLE_SANDBOX = new Set(["network: none", "filesystem: read-only-source"]);
```
全仓库该标识符**只出现这一次**（定义处）。真正的装载期拒绝写在 `src/pi-adapter/extension.ts:2252-2258`（`unenforceable.push(...)`），那里把 `network: 'none'` / `filesystem: 'read-only-source'` 作为**字面量字符串写进提示文本**（`:2257`），而不是读这个集合。后果：一个读起来像"强制点"的集合，改它不会改变任何行为；反过来，扩展里的实际判定与它无耦合，两边可以各自漂移。**确认**：`rg -n ENFORCEABLE_SANDBOX src tests scripts` → 一行。任务状态仍为 `planning`（`.trellis/tasks/10-03-dead-enforceable-constant/task.json`）。

**D2 — 模式正文（`MODE.md` body）被加载、校验、投影，却没有任何消费者。**
声明：`src/core/work-mode.ts:79` `readonly body: string;`；赋值：`src/core/work-mode.ts:811` `body,`。
消费者：**无**。`src/` 全树中 `.body` 只有一处命中，而且是注释（`src/core/cache-prefix.ts:90`）。`src/pi-adapter/extension.ts` 中 `body` 一词**零命中**。
后果：`modes/*/MODE.md` 的正文（例如 `modes/code-development/MODE.md:12-24` 的方法条目、`modes/code-audit/MODE.md:14-31` 的九项检查、`modes/trading/MODE.md:27-31` 的"未知结果不许自行重提"）**从不进入模型上下文**。而 `.trellis/harness-surface.yaml:16` 把 `modes` 声明为 `system-prompt` 组件——该声明只被"路径是否存在"检验（`src/core/harness-surface.ts:165-171` 只看 `exists`），因此**"modes 是系统提示词的一部分"这句在规范里成立、在运行时不成立**。模式实际生效的只有 permission/fence/sandbox/limits/intensity/effect-classes 这些结构化字段。**确认**：`rg -n "\bbody\b" src/pi-adapter/extension.ts` → 无输出。

**D3 — `readOnlyToolHardStopThreshold` 被计算、传递、展示，但从不比较。**
声明：`src/pi-adapter/progress-guard.ts:25`；归一化：`:227-229`（只做 `Math.max`）；重置：`:418`；状态投影：`src/pi-adapter/extension.ts:980` `hardStop: readBudget.readOnlyToolHardStopThreshold`；数字表：`src/pi-adapter/extension.ts:3467-3483`（例如 `standard/execution: [20, 40]`）。
全仓库对该字段的**唯一布尔用法**不存在：只有赋值、`Math.max`、投影三处。对比：`readOnlyToolWarningThreshold` 会在 `src/pi-adapter/progress-guard.ts:369` 真正触发告警。
后果：`/status` 打印 `readOnly=…/40` 这类"上限"，而没有任何分支会因达到它而终止；一个显示出来却永不生效的天花板，会被读成控制。注意**规范是诚实的**（`personal-agent-request-runtime.md:63`："The read-only budget is advisory metadata, not an unconditional terminal"），不诚实的是字段名与投影。**确认**：`rg -n readOnlyToolHardStopThreshold src` → 只有 `progress-guard.ts:25,194,227,228,229,418` 与 `extension.ts:980,3466,3484,3485`，无比较点。

**D4 — dispatch policy 完全没有产品调用者。**
`src/core/dispatcher.ts:29`（`executeDispatch`）、`src/core/dispatch-policy.ts:3`（`decideDispatch`）。调用点全在测试（`tests/core.test.ts:238,251,271,284,296,314`、`tests/strategy-evaluation.test.ts:18,32,40`）。`tests/harness-reachability.test.ts:93-94` 把两个模块列在 `ALLOW_LIST` 里，理由是"pre-existing, from before the framework work; no milestone claimed it while that task was open, and none has since"。
后果：`personal-agent-capability-runtime.md:221-293` 整节（"Dispatch Cost Calibration"：`dispatch.decided`/`dispatch.completed` 必须成对、失败也要先写 completion、可选 telemetry 不得改变路由）描述的是**没有产品消费者的契约**；同时 `dispatch.decided`/`dispatch.completed` 仍在 `src/core/contracts.ts:90` 的封闭集里，读起来像活机制。**确认**：`rg -n "executeDispatch|decideDispatch" src` → 只有 `dispatcher.ts:30` 与 `dispatch-policy.ts:3`。

**D5 — 启动器的命令路由表与 Python 本地命令集不一致，`axi-turn` 走错分支。**
`bin/dove-pi.cjs:19-46` 的 `pythonCommands` 集合列出 `doctor … extensions, workspace, shell, install … version`，**不含 `axi-turn`**；`shouldUsePiFastPath`（`:48-66`）因此在遇到 `axi-turn` 时返回 `true`，`:168-169` 直接 `spawnPi(["axi-turn", …])`。而 `dove_pi.py:73` 明确写了 `"axi-turn",` 在 `LOCAL_CLI_COMMANDS` 里，`src/cli.ts:182` 也有 `args[0] === "axi-turn"` 分支，帮助文本也把它当命令列出（`dove_pi.py:962-963`）。
后果：安装后的 `dove-pi axi-turn`（帮助里那一条）不会到达 `src/cli.ts:182`，而是被当作 Pi 的参数启动一个 agent 会话。参考 loop 的唯一产品入口在**文档给出的那条路径上不可达**（只有 `python dove_pi.py axi-turn` 可达）。
该文件同时**在类型门之外**：`tsconfig.json:22` 的 `include` 不含 `bin`，`tsconfig.json:16-21` 说明理由是十三条 `TS2339` 噪声；`tests/installer_test.py:209-213` 是唯一覆盖它的测试，而它只断言源码里**存在**三个标识符（`shouldUsePiFastPath`、`process.execPath`、`pythonCommands`）；CI 只跑 `npm run pi:smoke`（`.github/workflows/compatibility.yml:25`，该脚本 `package.json:18` 仅执行 `--version` 与 `--help`）。两个门都不会经过命令集合。**确认**：`Select-String -Path bin\dove-pi.cjs,dove_pi.py -Pattern axi-turn` → 只有 `dove_pi.py:73`。

**D6 — `getProjectContextBudget` 的 `promptChars` 参数被声明、被计算、被传入，函数体内从不读取。**
签名：`src/pi-adapter/extension.ts:3438-3442`（`promptChars?: number;` 在 `:3441`）；调用：`:3242`；实参来源：`:3241` `const promptChars = event.systemPrompt.length + event.prompt.length;`；函数体 `:3443-3451` 只用 `contextWindow` 与 `input.tokens`。
后果：决定"给项目上下文多少字符"的算式**没有减去当前用户回合自身的长度**，而这个长度正是被记录的 max_tokens 截断事故里的变量之一（`:3310-3314` 的注释说这段预检就是为了防它）。另一个调用点 `:984` 同样传了 `promptChars: contextText.length` 而同样无人读。**确认**：`rg -n promptChars src/pi-adapter/extension.ts` → `984, 3241, 3242, 3441`，函数体区间内无命中。

**D7 — 同一"至多一次"规则有两份实现，产品只用其中一份。**
产品路径：`src/core/effect-boundary.ts:75`（`prepare`）→ `:94-123`（`ledger.begin` → `unreadable` 拒绝 / `claimed || !replayed || isAutomaticallyRetryable` 放行 / 否则拒绝）。测试专用第二条：`src/core/effect-ledger.ts:411`（`dispatchOnce`），调用点仅在 `tests/effect-ledger.test.ts`、`tests/harness-effect-claim.test.ts`、`tests/trading-mode.test.ts`。
后果：`dispatchOnce` 的 8 处测试断言（含并发 `Promise.all` 8 次只执行一次）**不覆盖产品使用的那条路径**；两条实现对"重放 vs 故意重复"的判定各自演化时，测试会继续通过。**确认**：`rg -n dispatchOnce src` → 只有 `effect-ledger.ts:411`。

**D8 — `verifiedBy` / `verifier` 在产品内被解析后丢弃。**
`src/pi-adapter/extension.ts:592` `const parsed = parseHarnessSurface(…)`，`:595-597` 只用 `parsed.components` 生成本组件路径数（`:597`），`parsed.verifiedBy` 与 `parsed.verifier` 未再引用。真正读 `verifiedBy` 的是脚本：`scripts/harness-failures.mts:82`、`scripts/harness-corpus.mts:96`。
后果：`agent_task_convergence operation=status` 报出的 surface 只有计数，没有 `verifiedBy`（规范 `personal-agent-harness-loop.md:30-32` 说"读者手上有这份清单"，对**脚本读者**成立，对**会话内读者**不成立）。这不是错误，但它是"声明被消费到哪一层"的边界，改动时容易误判。**确认**：`rg -n "verifiedBy" src` → 只有 `harness-surface.ts`、`failure-reading.ts:178/291`、`harness-corpus.ts:28/73`（后两处由调用方注入，会话内无注入点）。

### (b) 代码与规范互相矛盾（两边都给出）

**D9 — `harness-axes.ts` 的 `evidence` 句与同一文件里已经实现的两个目标互相否定。**
`src/core/harness-axes.ts:212`：
```ts
evidence: "no ledger record carries a second measured objective; the fields a request terminal does carry are its reason and its terminal envelope, in the ledger's own record types.",
```
而同一文件 `:105-133` 的 `safetyAndStability` 正是从 `request.terminal` 与 `gate.refused` 记录里算出**两个**目标（`crashFreeRatio`、`isolationRefusalsPerRequest`），`:206` 的注释本身也承认"这一条曾被它所在的文件否定"。规范 `personal-agent-harness-loop.md:136-147` 把 `UNCOMPUTABLE_AXES` 定义为"不能读的轴，声明而非省略"——现在这条轴的理由句不成立，而条目仍以"缺少测量"的措辞出现（`reason`/`wouldNeed` 两句已改成"缺的是前沿决策"，只有 `evidence` 未同步）。
后果：任何依据 `evidence` 字段判断"这条轴值不值得继续投入"的读者会得到错误结论。**确认**：`rg -n "no ledger record carries a second measured objective" src` → `harness-axes.ts:212`。

**D10 — `modes/pentest/MODE.md` 仍写"preflightAuthority 没有运行时调用者"，而运行时已经调用它。**
模式文档 `modes/pentest/MODE.md:18-21`：
> **Not yet performed by the host** (2026-09-26). `preflightAuthority` exists in the framework and has **no runtime caller** …

代码：`src/pi-adapter/extension.ts:2230` `const preflight = preflightAuthority(loaded.authorityDocument, new Date().toISOString(), { evidenceDigests: evidenceDigestsFor(...) })`，并在 `:2233-2237` 把 `outcome === "block"` 变成拒绝装载。实现处 `src/core/authority.ts:282`。同一事实也被代码注释承认：`src/pi-adapter/extension.ts:2227-2228` "It used to be prose in `modes/pentest/MODE.md` with no caller behind it."
后果：模式文档把一条**已经生效**的控制说成"操作者责任"，这是最坏的一种漂移方向——读者会以为自己必须手工执行一个已经自动发生的检查（或反过来，以为可以跳过它）。**确认**：`rg -n preflightAuthority src` → `extension.ts:67,2230` 与 `authority.ts:282`。

**D11 — 同一份模式文档内部对"模式自己的 action 名在哪里声明"给出两种说法，其中一句不成立。**
`modes/code-audit/governance.yaml:14-19` 说 `repo.read`、`report.write` 等是"this mode own action names, declared in permissions.yaml"。而 `permissions.yaml` 的字段封闭集是 `permissions.yaml` 的四个键：`src/core/work-mode.ts:191` `const PERMISSION_FIELDS = new Set(["unlisted", "always_allow", "ask_before", "never_allow"]);`——不可能声明 action 名。另一份模式文档已经把这点写对：`modes/code-development/governance.yaml:16-19` "that file's accepted fields are unlisted, always_allow, ask_before and never_allow, so it cannot be, and this mode does not repeat the claim."
后果：读者按 `code-audit` 那句去 `permissions.yaml` 找一个不存在的声明；而 `10-03-unproducible-action-names` 记录的正是这些名字**只有模式文件自己在用**、既不在 registry 也不是 host 工具。**确认**：`rg -n "PERMISSION_FIELDS" src/core/work-mode.ts` 后对照 `modes/code-audit/permissions.yaml`。

**D12 — 规范比代码能兑现的更多：`system-prompt` 组件包含 `modes`，但只有 `AGENTS.md` 真的进入系统提示词。**
规范侧：`.trellis/harness-surface.yaml:16` `system-prompt: [AGENTS.md, modes]`；`personal-agent-harness-loop.md:151-155` 说这是"harness 自己组件的文件级表示"。
代码侧：`:3309` 只拼接 `event.systemPrompt`（Pi 的，其中含 `AGENTS.md`，见 `resource-loader.js:116`）＋固定策略串（`src/core/prompt-policy.ts:8`）＋capability 索引；`modes` 的正文无消费者（D2）。
后果：`harness-rounds` 的 surface fit 会把一次 `modes/*/MODE.md` 编辑判为 `inside system-prompt`，而该编辑对运行时行为**没有**任何影响（除非它改的是 frontmatter 之外被 loader 读取的字段）。这个"面内=有效"的等式在 `modes` 上不成立。**确认**：`rg -n "harness-surface" src/pi-adapter/extension.ts`（只有 `590-597`）＋ D2 的确认命令。

### (c) 重复机制（同一件事做两遍）

**D13 — 拒绝计数这一条规则有两份逐字相同的实现。**
`src/core/harness-verifier.ts:58`（`countGateRefusals`）与 `src/core/harness-axes.ts:63`（`gateRefusalCounts`）：函数体相同（都按 `+` 拆 atom 计数），注释也几乎同义。产品与脚本各自选了一份：`src/pi-adapter/extension.ts:1810` 与 `harness-verifier.ts:107` 用前者；`harness-corpus.ts:72` 与 `harness-axes.ts:109` 用后者。
后果：与规范直接冲突——`personal-agent-harness-loop.md:176-178` 说 refusal label 由"axis refusal split（导出为 `gateRefusalCounts`，三个读者共用一条规则）"给出，`src/core/harness-corpus.ts:14-16` 更明写 "**Nothing here is derived twice.**"；实际上有两条实现，任何一边改了拆分规则，corpus 与 convergence status 就会对同一个 ledger 给出不同的拒绝数。**确认**：`rg -n "countGateRefusals|gateRefusalCounts" src`。

**D14 — 主机工具面有三份名单，且互不一致。**
`src/core/action-policy.ts:21` `NETWORK_TOOLS`（8 个名字：`web_search, fetch_content, get_search_content, source_check, browser, agent_browser, mcp, mcpScript`）；`tests/fixtures/representative-tool-catalog.ts:2-11` 的 57 个名字（含 `agent_browser`、`web_search`、`source_check`、`fetch_content`、`get_search_content`，无 `browser`/`mcpScript` 之外的对应关系；`mcp` 与其并列）；另有 `tests/work-mode.test.ts` 里硬编码的一组。任务 `.trellis/tasks/10-03-host-tool-surface-sources/task.json` 已把它记为缺陷："NETWORK_TOOLS holds eight names, the representative tool catalog carries a different set, and work-mode.test.ts hardcodes eight more… today the three disagree and nothing reconciles them."
后果：`sandbox.network: none` 的覆盖面取决于选中的那份名单；测试用一份、运行时用另一份，于是"某个名字是否被拒绝"在测试与产品里可以是两个答案。同一文件 `tests/fence-drift.test.ts:11-14` 已经把这个结构写成"a third list is how the first two came to disagree"，只是那条处理的是 mutation 名单而不是 network 名单。**确认**：`rg -n NETWORK_TOOLS src` 与 `rg -n "\"read\"|web_search|agent_browser" tests/fixtures/representative-tool-catalog.ts tests/work-mode.test.ts`。

**D15 — 两处预算函数，一处只被测试使用。**
`src/core/../pi-adapter/extension.ts:3420`（`getRemainingContextChars`，保留量 `min(8192, max(2048, floor(window*0.05)))`，`:3423-3429`）与 `:3438`（`getProjectContextBudget`，保留量 `min(8192, max(2048, floor(window*0.1)))`，`:3447-3450`）。前者在 `src/` 内**无调用者**，只有 `tests/pi-adapter.test.ts:8,1444-1446`。产品只用后者（`extension.ts:984,3242`）。
后果：两个"预算"函数保留量不同（5% vs 10%），读者无法从名字判断哪个是现行规则；已废弃的那个仍被导出、仍被测试断言，改动时容易被当成第二个现行预算去"保持一致"。**确认**：`rg -n getRemainingContextChars src tests`。

### (d) 只断言声明形状、删掉功能也仍然通过的测试

**D16 — `tests/installer_test.py:209-213` 断言的是启动器源码里存在三个标识符，不是路由行为。**
```python
self.assertIn("shouldUsePiFastPath", source)
self.assertIn("process.execPath", source)
self.assertIn("pythonCommands", source)
```
删掉 `pythonCommands` 里的任何一条命令、或把 `axi-turn` 加进去（D5 的修复），这个测试都照样通过。**确认**：读该文件 209-213 行；`npm run test:installer`（我未执行）。

**D17 — `tests/document-drift.test.ts:67-78` 断言"声明里点名的符号是导出函数"，功能是否被调用不在检查内。**
```ts
assert.equal(typeof imported[symbol], "function", symbol + " is named as verifier code in " + entry.path + " and is not an exported function there");
```
它把 `.trellis/harness-surface.yaml:58` 的 `symbols: [parsePredictedMovement, verificationStateOf, verdictFor, decidableChanges]` 与 `task-convergence.ts` 的导出面绑定——一个符号从生产调用点被摘掉后，只要还 `export`，此检查仍然绿。测试自己的头注释也承认这个限度（`tests/document-drift.test.ts:29-35`："a check holds that a name resolves, never that the sentence around it is still true"）。

**D18 — `tests/spec-context-budget.test.ts:116-120` 断言规范文档的二级标题清单。**
```ts
assert.deepEqual(secondLevelHeadings(readSpec(name)), expectedHeadingsBySpec[name], `unexpected contract inventory in ${name}`);
```
它会把"某个契约章节被删空但标题保留"判为通过；反过来，把一个章节改名（无行为变化）会红。它检查的是**目录**，不是内容——该文件自己的 `:22-82` 是一张手抄的标题表。

**D19 — `tests/runner-pattern.test.ts:18-27` 断言的是"测试文件都在一层目录下"，即运行器 glob 的假设，不是被测行为。**

**D20 — 黑盒证据里的 `systemPromptChars` 被采集、被类型声明，但没有任何断言。**
采集：`scripts/real-dove-blackbox.mjs:404`（`systemPromptChars: typeof context.systemPrompt === "string" ? context.systemPrompt.length : 0`）；读取：`:536`；测试侧只在接口里声明该字段（`tests/real-dove-blackbox.test.ts:22,55` 的 `providerEvidence?: Array<{ … systemPromptChars?: number; … }>`）。任务 `.trellis/tasks/10-03-blackbox-prompt-chars/task.json` 记录 Pi 1.0.0 上该值已不再是正数且"root cause not located"。
后果：一个用来证明"系统提示词有多大"的读数可以安静地变成 `0`，而套件不红；任何以它为前提的 token 结论都失去支撑。**确认**：`rg -n systemPromptChars tests scripts` → 测试里只有类型声明，无比较。

### (e) 声明了但不解析的路径/名字（仓库自己称为"它反复发现的缺陷"）

**D21 — 已测量、已被测试钉住的两条（属于上游工具文件，本仓库修不了）。**
`.trellis/workflow.md:144` 命名 `.trellis/spec/cli/backend/workflow-state-contract.md`（本仓库只有 `backend`/`frontend`/`guides` 三个 spec 目录）；`.trellis/workflow.md:31` 命名 `.trellis/scripts/inject-workflow-state.py`（本安装里是 `.codex/hooks/inject-workflow-state.py`）。这两条被 `tests/document-drift.test.ts:353-358` **刻意断言为仍然缺失**，证据是 `AGENTS.md:31-35` 的注记；`AGENTS.md:40-42` 说明该文件在 `.trellis/.template-hashes.json` 里，改动会被 `trellis update` 覆盖。**确认**：`rg -n "spec/cli|inject-workflow-state" .trellis/workflow.md AGENTS.md`。

**D22 — `[workflow-state:completed]` 块自述为死代码。**
`.trellis/workflow.md:131-136`：
> `[workflow-state:completed]` → currently DEAD: cmd_archive flips status and moves the dir in the same call, so the resolver loses the pointer (block kept for a future explicit in_progress→completed transition)

后果：一个被声明为"当前不可达"的分支留在唯一每回合注入的文档里；它是诚实记录，但同样意味着任何按该状态编写的行为都拿不到输入。**确认**：读 `.trellis/workflow.md:131-136`，并 `rg -n "workflow-state:completed" .trellis`（除该块外是否还有消费者）。

**D23 — 发布归档的装配清单漏掉 `modes/`，而摘要清单包含它。**
装配：`.github/workflows/release.yml:35`，原文逐字为
```
          $include = @('bin', 'installer', 'scripts', 'src', 'tests', '.pi', 'dove_pi.py', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'README.en.md')
```
——**不含 `modes`**。摘要侧在 `:37-40` 单独补了 `.trellis/spec` 与 `.trellis/workflow.md`，也没有补 `modes`。
摘要侧却把 `modes` 当作必须覆盖的产品内容：`scripts/release-roots.mts:19` `"modes",`，理由见 `:3-8`（"work-mode.ts 会读 `modes/<id>/MODE.md`，code-audit capability 还会读它下面的 catalog"），并被 `tests/release-manifest.test.ts:16-18` 断言。
而归档校验只要求 6 个文件：`scripts/check_release_readiness.py:26-33` 的 `REQUIRED_ARCHIVE_FILES = {dove_pi.py, package.json, package-lock.json, release.json, installer/release.py, src/cli.ts}`——不含任何 `modes/…`。
后果（读出来的推演，未执行构建）：发布出去的 zip 里没有 `modes/`，而 manifest 的 `sourceDigest` 却覆盖它 —— 于是"摘要相同的两次发布"这一保证与"装完之后模式是否可用"脱钩。安装后若工作区模式为 `pentest`，`src/core/work-mode.ts:929-931` 会选中 `modes/pentest`，而它在归档里不存在，装载失败 → `src/pi-adapter/extension.ts:2628-2630` 会**拒绝所有工具调用**；`modes/code-audit/catalog/typescript.json`（`src/capabilities/code-audit.ts:57`）同样缺失。
需要确认的（`unverified`）：我**没有**构建过归档，也没有在安装态运行过。验证路径：在本机跑 `npm run release:manifest -- <tmp>/release.json`，按下 `release.yml:30-42` 的脚本装配 staging，然后 `python scripts/check_release_readiness.py --archive … --checksum … --tag … --manifest …`——按上面的清单它会通过，而 `unzip -l` 里不会有 `modes/`。

### (f) 静默 no-op / 静默失真的地方

**D24 — `bin/dove-pi.cjs:116` 的静默回退。**
```js
} catch { /* malformed optional policy falls back to development */ }
```
`.dove/workspace.json` 解析失败 → 静默按 `development` 启动。有注释说明，且方向是"更宽松的默认"，因此按本仓库自己的标准（拒绝要按名字报出）它是**已被记录的例外**，不是隐藏缺陷；列在这里是因为它属于"读坏输入不报"这一类，与 D5 同一条路径（启动器在类型门之外、只被 smoke 覆盖）。

**D25 — `src/pi-adapter/extension.ts:2941-2945` 的 observable 失败只通知 UI。**
```ts
} catch (error) {
  if (ctx.hasUI) ctx.ui.notify("[Dove observable] This tool result could not be recorded as an observable: " + …);
}
```
无 UI 的运行里，"这次工具结果没有可引用记录"这一事实**没有任何渠道被记下**；下游的验收 pass 会以"引用不可解析"被拒（`src/core/harness-verifier.ts:44-46`），而原因不在 ledger 里。对比同一文件里同一类失败的其它分支都写了 ledger 记录（例如 `:3121-3127` 的 `model.budget.rejected`）。**确认**：读 `extension.ts:2941-2945`；`rg -n "could not be recorded as an observable" src`。

**D26 — `src/pi-adapter/extension.ts:3353`、`:3367`、`:2951` 的 `catch { /* … never block */ }`。**
例如 `:3352-3353`：
```ts
await ledger.appendRequestPlan(...);
} catch { /* diagnostic projection must never block request preparation */ }
```
这是有意的（诊断不得阻断请求），并且注释说明了；但它意味着 `request.planned` 的缺失不会在任何读数里表现为"丢失"——`scripts/harness-failures.mts` 的 corpus 会把它读成"输入本来就没有 plan"。列在这里是为了让"静默"的清单完整，不是因为它是错的。**确认**：`rg -n "must never block|best effort" src/pi-adapter/extension.ts`。

---

## 4. 上下文与 token 纪律

**进入系统提示词的文本（每回合，稳定前缀）**：`src/pi-adapter/extension.ts:3309` 拼三块——
1. `event.systemPrompt`（Pi 自己的，含 `AGENTS.md`：`AGENTS.md` 本仓库 50 行；Pi 侧的发现逻辑在 `node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js:116`）；
2. 固定策略串 `src/core/prompt-policy.ts:4` + `:8`（一句 `DOVE_STABLE_POLICY` 加 web/并行两句，无数字）；
3. `buildCapabilityIndex(registry, recipes)`（`extension.ts:3309`）。
`.trellis/harness-surface.yaml` **不进入提示词**：它只被 `extension.ts:590`（读文件做 status 投影）与三个脚本读（`scripts/harness-rounds.mts:78`、`harness-failures.mts:80`、`harness-corpus.mts:94`）。`.trellis/spec/` 也不由 dove-pi 注入——它由 Trellis 那侧的 hook/skill 注入（`.trellis/workflow.md:8` "Specs injected, not remembered"）。

**每回合的 breadcrumb（追加式 message，只在 epoch 变化时发射）**：`extension.ts:3293` 的 `[PERSONAL AGENT REQUEST CONTEXT]`（项目上下文编译产物）与 `:3306` 的 `[PERSONAL AGENT REQUEST GUIDANCE]`；epoch 定义在 `:3274`（`${mode.current}:${projectContext.revision}`），发射条件 `:3280-3301`。

**真实存在的数字（都在代码里被用）**：

| 数字 | 值 | 位置 | 用途 |
|---|---|---|---|
| 项目上下文预算 | `floor((window − observedTokens − reserve) * 3)`，`reserve = min(8192, max(2048, floor(window*0.1)))` | `src/pi-adapter/extension.ts:3447-3450` | 传给 compiler 的 `maxChars`（`:3288`） |
| 另一个预算函数（测试专用） | `reserve = min(8192, max(2048, floor(window*0.05)))`，同样 `*3` | `src/pi-adapter/extension.ts:3423-3429` | 无产品调用者（D15） |
| 工具 schema 预留 | `512 + activeTools*128` | `src/pi-adapter/extension.ts:3321` | `ModelGateway` 的 `toolSchemaOverhead` |
| provider 预留 | `256` | `src/pi-adapter/extension.ts:3322` | `providerOverhead` |
| plan 输出预算 | `4096`（formal）/`1024`（chat）/`2048`（lookup）/`4096` | `src/core/request-plan.ts:230` | `outputBudget`，作最小余量而非上限（`:203-209` 的注释与之对应） |
| 后台消息上限 | `8000` | `src/pi-adapter/extension.ts:540` | `admitNonConversationalMessages`（`:3101`） |
| 工具结果上限 | `32000` | `src/pi-adapter/extension.ts:3531` | `admitToolResult`（`:3587`） |
| admission 默认上限 | `8000` | `src/core/context-admission.ts:142` | `admit()` 的默认 |
| 消息投影上限 | `32000` | `src/pi-adapter/context-projection.ts:4` | `projectModelMessages`（`:79`） |
| context guard 三阈值 | `0.82` / `150_000` / `150` | `src/pi-adapter/context-guard.ts:28-31` | 建议压缩（`:94-100`） |
| session fuse 前缀比 | `0.8` | `src/pi-adapter/cache-diagnostics.ts:64` | 冷启动建议（`:93`） |
| 只读工具预算（建议阈值 / 永不满效的"硬停"） | fast `4/8, 6/12, 12/24`；standard `6/12, 10/20, 20/40`；ultra `12/24, 16/32, 32/64`；task-inventory `1/2` | `src/pi-adapter/extension.ts:3464-3485` | 只有前一个数会触发告警；后一个数见 D3 |
| 变更/预测上限 | `MAX_CHANGES=50`、`MAX_PREDICTIONS=8` | `src/core/task-convergence.ts:944-945`，在 `:661`、`:583` 强制 | 解码期拒绝 |

**测试里被测量的上下文预算，只有规范文档这一层**：`tests/spec-context-budget.test.ts:92-95`
```ts
assert.ok(normalizedUtf8Bytes(readSpec(routerName)) <= 8_192, "runtime spec router exceeds 8 KiB");
for (const name of routedSpecNames) assert.ok(normalizedUtf8Bytes(readSpec(name)) <= 24_576, `${name} exceeds 24 KiB`);
```
对应规范 `personal-agent-runtime.md:40-41`（router ≤ 8 KiB、每个被路由规范 ≤ 24 KiB）。**它量的是 Trellis 注入规范文本的预算，不是 dove-pi 组装系统提示词的预算。**

**明说没有的东西**：**没有任何测试或代码测量"一轮 turn 的系统提示词/breadcrumb 有多大"**。`rg -n "systemPromptChars" tests` 只命中类型声明（D20）；`extension.ts:3241` 算过一次 `promptChars`，但那个值既没有落账也没有断言，而且 `getProjectContextBudget` 不读它（D6）。`extension.ts:956` 把状态写进 TUI，`strategy-snapshot.ts:153` 的 `providerRounds=${round}` 注释明确拒绝打印"上限"（`:148-149`：`providerRounds=3/unknown` 读起来像预算而没有人强制它）。因此"每回合提示词有多大、有没有超出预算"在**产品内没有读数**，只有 `pi-open-tui` 的外部遥测（`extension.ts:1146`）。

---

## 5. 验证映射

来源：`.trellis/harness-surface.yaml:31-36` 的 `verifiedBy`（组件→套件）与 `:44-58` 的 `verifier`，加上我自己的阅读。注意：`verifiedBy` 本身只保证路径存在（`src/core/harness-surface.ts:174-178`），不保证那个套件真的验证了那条行为——这一点规范 `personal-agent-capability-runtime.md:166-168` 自己写明了。

| 组件 | 声明其验证者 | 我的补充读法 |
|---|---|---|
| `system-prompt` | `tests/work-mode.test.ts`, `tests/host-work-mode.test.ts`, `tests/pentest-mode.test.ts`, `tests/code-audit-mode.test.ts`, `tests/trading-mode.test.ts` | 五个套件确实加载真实 `modes/*` 并断言拒绝；但它们全部走 loader+policy，**没有一个断言正文进入模型**（D2），所以"`modes` 是 system-prompt 组件"这件事无验证者 |
| `tool-description` | `tests/pi-adapter.test.ts` | — |
| `tool-implementation` | `tests/task-convergence.test.ts`, `tests/change-verdict.test.ts`, `tests/failure-reading.test.ts`, `tests/harness-corpus.test.ts`, `tests/harness-round.test.ts`, `tests/harness-axes.test.ts`, `tests/harness-surface.test.ts`, `tests/real-dove-blackbox.test.ts` | — |
| `middleware` | `tests/action-policy.test.ts`, `tests/fence-drift.test.ts`, `tests/host-work-mode.test.ts`, `tests/evasion-spellings.test.ts`, `tests/gate-accumulation.test.ts`, `tests/fence-alias.test.ts`, `tests/technique-syntax.test.ts` | — |
| `long-term-memory` | `tests/spec-context-budget.test.ts` | 这个映射值得注意：`long-term-memory` = `.trellis/spec` + `.trellis/workspace` + `.trellis/tasks`（`harness-surface.yaml:24`），而验证者是"规范预算+标题清单"（D18）——即验证者检查的是文档形状，不是记忆质量 |
| `skill` | **未声明**（`harness-surface.yaml:28-30` 明写"deliberately unstated"） | 与我的读法一致：`.agents/skills` 无套件 |
| `subagent-config` | **未声明**（同上） | `src/pi-adapter/subagent-provider.ts` 有测试（`tests/pi-subagent-provider.test.ts`）但未在 `verifiedBy` 里声明；`.codex/agents` 无覆盖 |

**产品机制里没有验证者的**（我读出来的；每条给出确认命令）：

- **dispatch policy / dispatcher**：`tests/core.test.ts:230-320`、`tests/strategy-evaluation.test.ts` 覆盖，但两者都**不是** `verifiedBy` 里的任何组件，且模块本身不可达（D4）。`rg -n dispatcher .trellis/harness-surface.yaml` → 无。
- **`ModelGateway.dispatch`**：只有 `tests/request-plan-model-gateway.test.ts:258-260`；产品路径走 `validate`+`abort`（D4 同构）。`rg -n "gateway.dispatch" src` → 无。
- **`getRemainingContextChars`**：`tests/pi-adapter.test.ts:1444-1446`，产品无调用者（D15）。
- **模式正文注入**：**没有任何验证者**，因为没有实现（D2）。
- **`ENFORCEABLE_SANDBOX`**：没有任何验证者（D1）。
- **`readOnlyToolHardStopThreshold` 的强制**：`tests/pi-adapter.test.ts:1065,1077-1079` 只断言阈值被**传递/计算**，不断言达到它会终止（D3）。
- **黑盒 `systemPromptChars`**：`tests/real-dove-blackbox.test.ts:22,55` 只是类型声明（D20）。
- **启动器路由**：`tests/installer_test.py:209-213` 断言标识符存在（D16）；`package.json:18` 的 smoke 只覆盖 `--version`/`--help`。
- **发布归档内容**：`tests/release-manifest.test.ts` 只检查摘要**清单**里的路径存在，`scripts/check_release_readiness.py:26-33` 只要求 6 个文件（D23）。
- **`checkpoint.ts`、`jailer/*`（6 个文件）**：`tests/harness-reachability.test.ts:62,110-115` 明列为"没有东西到达它们"，只有各自测试。`src/jailer/*` 的 6 个模块是**先建边界、后接 loop**，未接线。

---

## 6. 要改动这些，必须先知道的事（风险与耦合）

**1. `src/core/task-convergence.ts`（1126 行）与 verifier 的纠缠是已测的，不是感觉。**
`.trellis/harness-surface.yaml:45-58` 与 `personal-agent-harness-loop.md:57-71` 记录了数字：验证尾巴使用记录侧词汇（id 模式、封闭集、`invalid` 拒绝构造器），`invalid` 在记录模块里有 **74** 个使用点；`movementFromParts` 同时被记录的 decoder 与解析器调用。因此"把 verifier 从记录模块里抽出来"需要一个两边都 import 的第三模块，并会遇到值级循环（类型级可容忍、值级不行）。文档还记录了两条可以重开这件事的条件（`harness-surface.yaml:52-56`）。**任何改动 `verdictFor` / `verificationStateOf` / `parsePredictedMovement` / `decidableChanges` 名字的动作都会牵动 `harness-verifier.ts:19` 的 import 与 `.trellis/harness-surface.yaml:58` 的符号清单，而后者被 `tests/document-drift.test.ts:67-78` 直接导入比对。**

**2. `src/pi-adapter/extension.ts`（3609 行）是唯一的真实入口，且一个文件同时是五件事。**
`tests/harness-reachability.test.ts:27-32` 把它列为 Pi 唯一实际运行的入口。它内部同时持有：提示词组装（`:3309`）、模式装载与拒绝（`:2208-2294`）、action policy 的两个半场（`:2635`、`:2751`）、effect boundary（`:2814-2839`）、ledger 的全部写入点（约 40 处 `ledger.append*`）、以及 19 个 `pi.registerTool`（`:1496-2094`）。**改这一行附近任何东西都要问：gate 的输入是不是最终 args？**该文件自己给出了理由（`:2733-2735`：host 在 mutation 之后不再 validate，`types.d.ts:703-708`），所以"在 handler 顶部提前判定"是错的。

**3. 三个"清单"是三份手抄的真相，没有交叉检查。**
(a) `bin/dove-pi.cjs:19-46`（Node 路由）↔ `dove_pi.py:68-74`（Python 本地命令）↔ `src/cli.ts:291-294`（usage 文本）；(b) `scripts/release-roots.mts:14-28`（摘要）↔ `.github/workflows/release.yml:35-41`（归档装配）↔ `scripts/check_release_readiness.py:26-33`（归档校验）；(c) `src/core/action-policy.ts:21`（网络名）↔ `tests/fixtures/representative-tool-catalog.ts:2-11` ↔ `tests/work-mode.test.ts` 的硬编码。**每一组里，改一份不会让另外两份失败**（唯一例外是 (c) 里的 `FENCE_MUTATION_TOOLS`：`tests/fence-drift.test.ts:30` 把 `declaredMutatingToolNames()` 读进 `PRODUCT_MUTATION_TOOLS`，并在 `:38-47` 双向断言它、`FILESYSTEM_MUTATORS` 与 `FENCE_MUTATION_TOOLS` 的并集关系；该测试自己的头注释 `:11-14` 就是"第三份名单是前两份分歧的原因"）。D5 与 D23 都是这一类的产物。

**4. `src/core/work-mode.ts`（1040 行）是"拒绝词汇"的单一来源，四处依赖它。**
`WorkMode`（`:76-187`）被 `src/core/action-policy.ts:10`、`src/core/effect-boundary.ts:39`、`src/core/loop-runner.ts`（经 `loop.ts` 的 `mode` 字段）与 `tests/gate-labels.test.ts:29-46` 的 `mode()` 工厂共同构造。`gate-labels.test.ts:78` 用真实 `createActionPolicy` 断言 `policy.gates ⊆ GATE_LABELS`，而 `policy.gates` 的构成写在 `src/core/action-policy.ts:489`——**加一个门就要同时改三处（policy 的 `gates`、`GATE_LABEL_NAMES`（`task-convergence.ts:886-892`）、以及产生它的 `labelled(...)` 调用点），少一处就是"没人能预测的拒绝类别"**（`task-convergence.ts:876-884` 记录了这个教训）。

**5. `src/core/execution-ledger.ts`（709 行）的种类是编译期封闭集。**
`src/core/contracts.ts:90` 的 `ExecutionRecordKind` 是 union，新增一种记录必须同时改它；`personal-agent-harness-loop.md`（经 `harness-loop-turn.md:124-132`）记录了"手写 ledger 行时发明 kind"的教训：`task.resource.observed` 没有写者也没有读者，而所有读数都正确地保持沉默。任何新增记录面的工作量都先落在这一行上。

**6. 模式里的版本号有四处写同一件事，其中一处是硬编码。**
`package.json:3` `"version": "0.2.0"` → `bin/dove-pi.cjs:147` `DOVE_PI_FRAMEWORK_VERSION = packageJson.version` → `extension.ts:2209` 读取 → `work-mode.ts:455`（`loadWorkMode`）用它判 `framework: ">=0.2.0 <0.3.0"`（四个模式文件都这么写，如 `modes/code-development/governance.yaml:2`）。而 `src/commands/axi-turn.ts:73` 把它**写死**为字符串：`{ frameworkVersion: "0.2.0" }`。
后果：`package.json` 升到 0.2.1（或模式上限升到 `<0.4.0`）时，`axi-turn` 与主程序会对同一个模式给出不同判定。`bin/dove-pi.cjs:143-147` 的注释已经解释了为什么这两个变量必须分开（identity vs framework）——但 `axi-turn.ts:73` 没有走那条路。**确认**：`rg -n '"0\.2\.0"' src bin package.json modes`。

**7. 规范文档本身是被测试钉住的形状。**
`tests/spec-context-budget.test.ts:102-120` 会因 router 的链接集合或任一规范的二级标题清单变化而失败；`tests/document-drift.test.ts:161-205` 会因某个 spec 目录的 `index.md` 与目录内容不一致而失败（该文件 `:21-29` 还要求在`.trellis/spec/**` 里命名的路径能解析）。**因此"改一句话"在 `.trellis/spec/backend/*.md` 里不是零成本动作**：它同时牵动预算（≤24 KiB）与标题清单。

---

## 附：本文件未验证项一览

- 未运行：`npm test`、`npm run typecheck`、`npm run pi:smoke`、`npm run test:installer`、`scripts/harness-*.mts`、任何构建/安装/发布命令。
- 未逐行读：`src/pi-adapter/extension.ts` 的 1-540、660-1490、1500-2190、2300-2600、3000-3180、3487-3609 区间；`src/core/task-convergence.ts` 的 1-840、970-1126；`src/core/execution-ledger.ts` 大部。凡这些区域内的机制，本文件只按我读到的锚点陈述，未读处不作断言。
- D23 的"发布归档里没有 modes"是**读装配脚本得出的**，我没有真的打过包（见该条内的验证路径）。
- `personal-agent-capability-runtime.md:39-42` 的 schema 拒绝逐条（协议版本、semver、未知字段、标识符过长、参数上限）**未逐条核对实现**；无验证路径时我给的是"读 `tests/capability-protocol.test.ts` 逐 case"。
- `personal-agent-capability-runtime.md:125-133` 的"19 个被声明 capability 中 8 个无实现"我未逐个复核（该名单：`repo.read`, `report.write`, `source.read`, `source.write`, `net.scan`, `exploit.run`, `market.read`, `order.submit`；它们确实不出现在 `src/capabilities/*` 的注册里，这一点我按 `src/runtime.ts:17-20` 的四个注册器读了，算部分验证）。
