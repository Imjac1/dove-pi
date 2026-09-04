# Dove Pi 真实用户体验与策略归因审计

## 审计边界

本轮只做可复现的用户路径、请求规划和终止行为观察，不扩大工具调用、耗时或 token 硬上限，也不把模型回答质量冒充成已验证结论。测试均使用临时项目、临时 `DOVE_PI_HOME` 和临时 `PI_CODING_AGENT_DIR`；当前环境没有可用的 Anthropic/OpenAI/DeepSeek/OpenRouter 凭据。

## 真实黑盒结果

### 2026-09-03 临时项目复测

使用 `scripts/real-dove-blackbox.mjs` 在临时目录运行当前全局
`dove-pi --offline --mode rpc`（未修改用户项目或全局安装）。进程收到
`agent_start`，但在 30 秒内没有 `agent_end` / `agent_settled`；日志中的
provider 使用的是 `12321/deepseek-ai/DeepSeek-V4-Flash`，请求停在
`stopReason=pending`，随后出现旧 managed release 的扩展错误：

```text
This extension ctx is stale after session replacement or reload ...
```

`dove-pi doctor` 同时报告 `sourceDrift=drifted`。因此这次现象不能归因于
当前工作区源码的模型能力或硬上限：实际执行的是旧托管版本，且当前环境没有
可用 API key，黑盒只能证明“旧版本 + provider pending + stale ctx 错误”
会让用户看到像是模型卡住。当前源码的 focused/full tests 已覆盖请求终止和
session 生命周期；要验证真实模型质量，仍需先用 source install/update 对齐
版本并配置有效凭据。

源码复现还发现一个独立的确定性缺陷：上下文编译器只把
`personal-agent-runtime.md` 当作运行时契约，漏掉了同目录的
`personal-agent-request-runtime.md`。因此 provider/policy 查询在预算省略后
会错误得到空上下文。现已让两个文件名都进入 runtime 检索，并加入
`tests/pi-adapter.test.ts` 的 stale-context 回归；focused Pi adapter 27/27、
全量 TypeScript 265/265 通过。

## `Operation aborted` 归因

源码中至少有四类主动 `ctx.abort()`：

| 触发点 | 当前内部原因 | 用户看到的风险 |
| --- | --- | --- |
| `before_provider_request` | provider-round 超限、模型上下文预算拒绝 | 像模型自行停止 |
| `message_end` / `agent_end` | 终端 HTTP、鉴权失败、重试上限、非幂等副作用后禁止重试 | 像网络偶发失败或模型取消 |
| `tool_call` / progress guard | 重复失败、无进展、第二次结构化提问、formal convergence 阻断 | 像工具坏了或模型没能力 |
| Pi/会话本身 | 用户取消、session replacement、reload | 可能被 Dove 误判为策略失败 |

Pi 的通用渲染会把这些路径压成 `Operation aborted`。因此当前问题的主要根因
是**终止原因没有统一的可见协议**，不是单纯的上限太低。已有 ledger 虽然保存
`policyAbort` 和 `detail`，但 TUI/headless 用户不能稳定读取同一个 envelope；另外
多个生命周期钩子都可能调用 abort，存在重复调用和具体原因被后续状态覆盖的风险。

### 建议的修复顺序

1. 先统一终止 envelope 和优先级，保证一次逻辑请求只保留一个最具体原因。
2. 再把所有 abort 入口收敛到一个 helper，先记录/通知，再调用 host abort。
3. 增加 `/status full` 和 RPC 查询的 last-terminal 投影。
4. 用 fake/local provider 做确定性黑盒矩阵，再用真实 provider 做小样本验证。

不建议直接提高 provider round、attempt、耗时或 token 上限；那会掩盖来源，且
可能放大非幂等副作用重放风险。

### 源码入口 + 隔离状态

使用 `python dove_pi.py` 在临时项目中运行：

| 命令 | 结果 | 归因 |
| --- | --- | --- |
| `--offline doctor` | 退出 0，返回结构化诊断 | 启动器和 CLI 路由正常 |
| `--offline project bogus` | 退出 1，stdout 为 `{"ok":false,"error":...}`，stderr 为用法文本 | 未知子命令已正确失败；没有 Node 堆栈 |
| `--offline task list` | 退出 0，返回空任务 JSON | 隔离项目状态边界正常 |
| `--skip-version-check task list` | 退出 0，返回空任务 JSON | 前缀不会启动 Pi，回归修复生效 |
| `--offline task bogus` | 退出 1，结构化错误 + stderr 用法 | CLI 错误边界正常 |
| `--offline session record` | 退出 1，缺少标题错误 | 参数校验在执行前发生 |

### 已安装全局命令的版本漂移

当前终端 `Get-Command dove-pi` 指向 `%LOCALAPPDATA%\\DovePi\\bin\\dove-pi.ps1`，不是工作区源码。使用该全局命令运行 `dove-pi --skip-version-check task list` 仍会启动 Pi，并因缺少 API key 失败；`project bogus` 也表现为旧版本行为。

这证明一个真实用户风险：源码修复完成并不等于用户体验已修复。用户若未执行 `dove-pi update` 或 source install，仍会运行旧 managed release。README/doctor 应明确显示“当前执行版本/来源”和“工作区源码与已安装版本是否一致”，否则用户会把旧版本行为误认为当前代码缺陷或模型能力下降。

工作区直接运行 `npm run doctor` 已显示 `managedInstall.sourceDrift = "drifted"`，进一步证明该状态已经能被检测到；但普通启动/失败提示没有主动把这条 drift 信息带给用户。

### RPC/Pi 启动路径

`scripts/real-dove-blackbox.mjs` 在临时项目运行 `dove-pi --offline --mode rpc` 并发送 `hello`：

- 扩展成功加载，状态栏事件为 `Dove Standard · Auto · Ready · Pi off`；
- 由于无 provider 凭据，prompt 在 agent_start 前被拒绝，RPC 返回 `success:false`；
- 未产生 `agent_start`/`agent_end`，说明没有进入模型/工具循环；
- stderr 没有污染 RPC stdout。

这只能验证启动、扩展、RPC framing 和无凭据失败路径，不能证明 fast/standard/ultra 的模型回答质量差异。`Pi off` 与“无 API key”没有在同一条用户可见错误中明确关联，容易让用户把认证失败误判为策略关闭或工具权限问题。

## 请求规划黑盒矩阵

调用 `createRequestPlan({ projectAvailable: true, interactionMode: "auto" })`，三种执行模式的 `outputBudget` 在同一 intent 下不变；mode 主要影响 thinking、provider rounds 和只读预算。

| 用户话术 | 实际 intent/lane | 体验问题 |
| --- | --- | --- |
| `查看当前项目有哪些未完成任务，只读，不修改文件` | `project-work/fast`（当前版本某些路径会把“完成”命中为 `finish-task`） | “未完成任务”中的生命周期词污染只读查询；应优先识别 inventory/read-only 约束 |
| `创建正式任务，编写 PRD、设计和验收标准` | `execution/formal` | 正式任务虽进入 formal，但 intent 仍是 execution，workflowAction 丢失；下游无法只靠 intent 判断“创建任务”语义 |
| `规划并实现缓存优化，修改多个文件` | `execution/fast` | 明确的多文件规划+实现没有自动进入 formal，可能跳过 PRD/design/acceptance 产物 |
| `先分析现状，再设计方案，然后实现并测试` | `execution/formal` | formal 依赖关键词命中，缺少显式可解释的策略原因；相近话术容易落到 fast |
| `不要修改，只查看项目结构和配置` | `lookup/fast` | 只读约束可工作，但只读与 execution 词混合时仍需逐句极性解析 |
| `继续当前项目任务` | `project-work/fast`, `workflowAction=continue` | 继续任务不会自动进入 formal，这是合理的；但状态栏没有显示“继续/当前任务选择器” |

关键观察：`Ultra` 对上述复杂实现仍只有 4096 的规划输出预算；它增加的是 thinking=`max`、provider rounds 和 read-only budget，不是最终答案保证。用户若期待“Ultra=更完整交付”，会出现预期落差。

## 终止行为模拟

`ProgressGuard` 在不同参数下复现如下行为：

- 只读探索达到 warning threshold 后仍允许继续，但只提醒“用已有证据回答”；
- 达到 hard stop 后，下一次只读调用在工具执行前直接 `terminate`；
- 同批次完全重复调用会 coalesce，不计作新的读取；
- 同一工具、不同路径但返回相同观察值不会触发 repeated-success，直到调用参数也重复；
- provider round 达到 `chat=1/2/3`、`lookup=3/4/5`、`project-work=4/5/6`、`execution=5/6/7`（fast/standard/ultra）后，`before_provider_request` 设置 `provider-round-budget:<N>` 并调用 `ctx.abort()`。

因此用户感知的“模型不继续”可能来自三种不同原因：

1. provider 没有凭据或请求预算拒绝（模型根本没有开始生成）；
2. Dove 的只读 hard stop/provider round policy 在模型循环中止；
3. 模型自身选择停止或 provider 返回 length/error。

当前 UI/状态栏没有把这三类原因统一展示，ledger 虽记录了结构化 detail，但普通用户通常看不到 ledger。

## 归因结论

## 质量门禁观察

`npm run typecheck` 通过。早期一次运行曾为 264 通过、1 失败，失败位于首次相关项目上下文注入断言；该问题已修复并由空检索、预算省略、恢复会话和 stale-context 回归覆盖。最新完整质量门为 `npm test` 269/269，通过 shutdown/terminal 优先级修复后的聚焦测试为 45/45；不再将旧的 264/1 结果作为当前状态。

### 已确认是 Dove 策略/UX 问题

1. **策略概念重叠**：`/mode fast|standard|ultra`、`/dove-mode auto|chat|work`、`/dove-thinking auto|lock|off`、`/dove-tools auto|core|full` 同时存在，状态栏只显示简写，用户无法判断哪一层改变了上下文、thinking、工具 schema 或终止预算。
2. **复杂请求 lane 不稳定**：执行词先于 formal 判定；“规划并实现多文件功能”可进入 execution+fast，导致正式工作流预期与实际产物不一致。
3. **生命周期词污染查询**：`finish/完成` 等词可能出现在“未完成任务”查询中，必须由 inventory/read-only 识别优先级压过生命周期动作。
4. **硬 stop 缺少可见解释**：只读 hard stop 和 provider-round abort 对用户表现都像“模型自己停了”；没有直接显示剩余预算、触发策略和下一步建议。
5. **全局 managed release 漂移**：用户运行的 `dove-pi` 可能不是源码修复后的版本；当前 doctor 没有把版本来源差异作为显著提示。

### 已确认但不应归因给 Dove 的问题

- 无 API key 时 prompt 失败是 provider 配置问题，不是模型能力下降；本轮不能进行真实模型质量 A/B。
- Pi 的 native tool host 和扩展加载属于 Pi 责任边界；Dove 不应再加第二套权限层。

### 尚不能确认

- fast/standard/ultra 在真实模型上的成功率、代码正确率、工具选择质量差异；需要同一模型、同一 prompt、同一项目和有效凭据的 RPC/SDK A/B。
- provider context-window rejection 是否主要由 Dove context、Pi history 还是工具 schema 引起；ledger 有拒绝样本，但仍需按 provider-call 采样重放。

## 后续规划（不在本任务直接实现）

1. **先统一策略模型**：把“交互上下文”“执行强度”“thinking policy”“工具 profile”“终止预算”拆成可查询的单一状态对象，并让 `/status full` 展示每个字段的来源、当前值、是否生效于下一回合。
2. **重排分类优先级**：inventory/read-only 约束 → 明确 workflowAction → formal complexity → execution imperative；为“规划并实现”“只查看未完成任务”等回归样例建立决策表。
3. **把硬 stop 改成可观测策略事件**：每次 warning/terminate/provider budget 都在用户可见摘要中显示 `reason`, `observed`, `nextAction`；在完成校准前不提高或降低阈值。
4. **增加真实模型 harness**：使用 Pi SDK 的 `createAgentSession` 或 RPC，同一个 fake/local provider 先验证工具循环和策略事件，再使用真实 provider 做小样本 A/B。Pi 官方文档确认 SDK 可注入 custom provider/streamSimple，RPC 可驱动 prompt、steer、follow_up 并监听 agent 事件。
5. **版本一致性检测**：`doctor` 输出 launcher source、managed release、extension version 和工作区版本；当用户从源码运行但 PATH 仍指向旧 managed release 时给出明确修复命令。

## 外部依据

- Pi SDK 文档：`node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`，支持 `createAgentSession`、事件订阅和自定义 model/provider。
- Pi RPC 文档：`node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`，定义 JSONL prompt/steer/follow_up、response 和 agent 事件。
- Pi custom provider 文档：`node_modules/@earendil-works/pi-coding-agent/docs/custom-provider.md`，支持 `pi.registerProvider` 与 `streamSimple`，并建议复用 provider stream/overflow 测试套件。
- MCP transport 规范：stdio stdout 必须只承载协议帧，诊断写 stderr；当前黑盒未发现 stdout 污染。
