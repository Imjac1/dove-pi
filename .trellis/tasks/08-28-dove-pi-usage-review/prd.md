# Dove Pi 使用情况审查与优化规划 (Usage Review & Optimization Plan)

> 来源:真实会话遥测 + 源码审读 + 对比 ~/Desktop/code 中的其他 5 个 Agent
> 日期:2026-08-28 | 优先级:Token 成本第一(次要:模型质量/体验)

## 0. 执行摘要 (TL;DR)

在 **pi-agent** 与 **~/Desktop/code** 两条路径上共统计到 **~1.92 亿 prompt tokens**(pi-agent 4,347 万 + Desktop/code 1.57 亿)。缓存命中率在长会话中表现优异(末轮 97%~99.9%),但存在一个致命问题:

- **每轮固定前缀膨胀到 18–21 万 token**。模型是 `deepseek/deepseek-v4-flash-0731`,经 `cc-switch-open-router`,`PI_CACHE_RETENTION=long`。
- **全缓存未命中(MISS)代价巨大**:某会话 169 轮结束于 179,915 token、`cacheRead=0` 的完整冷启动;另一会话 177 轮平稳运行到 211k。任何一次前缀变动/空闲/换模型都会让整个前缀按原价重计。
- **Capability/Recipe 快速通道几乎未被使用**:两个仓库的会话工具统计中 `agent_run_capability` / `agent_run_recipe` 调用次数 = **0**。模型用 `bash` 生成了 580( Desktop )/ 229( pi-agent )次命令,与"复用确定性自动化来省 token"的目标背道而驰。
- **hashline 编辑器在 Desktop 未生效**:Desktop 会话仍用 `edit` 8 次,而 pi-agent 用的是 `replace`/`insert`。两者工具集应统一。
- **子代理/dispatch 策略基本未跑**:`bg_delegate`/fusion 仅 1 次(Desktop)。

结论:**缓存策略(长保留、会话亲和、auto 单调工具集)真的有效,但代价是前缀无限膨胀;确定性复用策略(capability/recipe)没有真正落地。** 两个方向分别应"加保险丝"和"打通调用路径"。

---

## 1. 用量与成本现状(真实会话数据)

会话目录 `~/.pi/agent/sessions/<cwd-编码>/`(11 + 8 + 4 + 1 = 24 个会话)。

| 项目路径 | 会话数 | 消息数 | Prompt tokens 总计 | 其中 input | 其中 cacheRead | 输出 |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop/code( Dove C2 安全工程) | 11 | 1,090 | **157,197,019** | 19,912,745 | 137,284,274 | 828,940 |
| ChatGPT/pi-agent(本仓库) | 8 | 404 | **43,472,430** | 3,976,254 | 39,496,448 | 187,197 |
| ~(home root) | 4 | 4 | 50,184 | 45,564 | 4,620 | 214 |
| ~/Contacts | 1 | 2 | 11,869 | 11,869 | 0 | 121 |

- Desktop 约 **87%** 的 prompt token 来自缓存读取;pi-agent 约 **91%**。这说明"缓存优先"策略**真实生效**。
- 但绝对量很大:Desktop 一个项目 15 个会话烧了 1.57 亿。
- **输出 token 很少**(828K / 187K),说明 model 在重放流程、每次把整个前缀塞回去 —— 烧钱的是输入侧不是生成侧。

### 1.1 冷启动 / 前缀膨胀证据

| 会话 | 消息数 | 终点 prompt | 终点 input | 终点 cacheRead |
| --- | --- | --- | --- | --- |
| ...27T22-26 | 20 | 47,034 | 1,210 | 45,824(97.4%) |
| ...27T23-40 | 169 | **179,915** | **179,915** | **0(全 MISS)** |
| ...28T00-51 | 177 | 211,437 | 237 | 211,200(99.9%) |
| ...现在(this) | 26 | 67,242 | 938 | 66,304 |

`27T23-40` 是灾难样本:169 条消息后一次完整冷启动烧掉 18 万 input token。触发原因未记录(可能 idle 超时、前缀变化、会话亲和丢失)。

### 1.3 工具调用画像(真凭实据,两个仓库)

pi-agent 主要:bash 229、read 77、replace 44、ls 18、agent_browser 12、grep 11、insert 10、**agent_list_capabilities 4**、agent_project_task 6、ask_user_question 4、mcp 1。

Desktop 主要:bash 580、read 266、replace 121、write 32、powershell 26、grep 23、insert 19、ask_user_question 11、**edit 8**、agent_project_task 6、bg_delegate 1。

关键事实采样 = 两个项目都 **从未调用** `agent_run_capability` 或 `agent_run_recipe`。① 模型造了命令(而非用已注册的 dev.*/ windows.* capability);② 唯一沾边的 `agent_list_capabilities` 只有 4 次(pi-agent),说明发现后没跟进执行。

---

## 2. dove-pi 的"策略"到底好不好用(逐条验证)

| 策略 | 设计 | 实际效果(证据) | 判定 |
| --- | --- | --- | --- |
| **auto 工具集 + 意图加载**(CORE_TOOL_NAMES + INTENT 正则) | 只发基础工具,识别到浏览器/MCP/LSP/后台才加工具,避免工具元数据固定开销 | 会话显示工具集紧凑;但 `edit`/`replace` 在两条路径表现不一致 | ✅ 有效,有分歧(见下) |
| **单调工具集**(applyAutoTools 只增不减) | 避免每轮 cache-prefix churn | 命中率 99.9% 佐证有效 | ✅ 有效 |
| **上下文编译器 + 相关性打分 + 预算 + 压缩**(ContextCompiler) | fast 16k / standard 24k / ultra ∞ 字符预算;只读未读上下文、压缩超限文档 | 未直接测量,但 prompt 冲到 21 万说明 **Ultra 无上限 + 累积对话**才是大头;compaction 没拦住对话本身 | ⚠️ 有效但覆盖面不足(只处理文档块) |
| **fast/standard/ultra → thinking Low/Med/Max** | 运行时切换 thinking 来省输出 | 输出很少(94K/187K),说明输出不是瓶颈;未来升级模型时有用 | ✅ 方向对,低优先 |
| **capability/recipe 快速通道**(dev.*, windows.*, recipe) | 用确定性命令代替模型重写 | **调用=0**,模型全部用 bash/read 重造 | ❌ **未真正落地** ⏱ |
| **dispatch-policy(inline/subagent/parallel)** | 成本/墙钟估计决定是否派生子代理 | `bg_delegate` 仅 1 次 | ⚠️ 基本未启用 |
| **session 亲和 + 长缓存**(OpenRouter 自定义) | 会话 pin 住 provider 模型,缓存生效 | 命中率 90%+ 有力佐证 | ✅ 有效,且是省钱主力 |
| **hashline 编辑器**(replace/insert/undo,去 edit) | 更省 token 的编辑原语 | pi-agent 全部用 replace/insert;Desktop 仍 8 次 edit → 没喂给该 host | ⚠️ 分发到两个仓库不一致 |

---

## 3. 与 ~/Desktop/code 内 5 个其他 Agent 差距对比

Desktop 里这台工程同时跑了 **Claude Code(.claude)、Codex(.codex)、Cursor(.cursor)、omo(.omo)、opencode(.opencode)**,并与 dove-pi(Personal Agent)对比:

| Agent | 配置亮点 | dove-pi 待借鉴 |
| --- | --- | --- |
| **Claude Code** | 钩子(SessionStart/PreToolUse, matcher `Task | Subagent`);命名 subagent`trellis-check/implement/research`;hooks 注入 subagent 上下文;白名单权限`defaultMode=bypassPermissions` | per-tool 白名单 + subagent 派遣是 dove-pi liberation 差距的关键;dove-pi 目前依赖 dispatch 估算但没真正调用 subagent |
| **Codex** | `config.toml` 显隐 `trellis-*` 三 agent,接 Trellis 生命周期 | **把 Trellis 生命周期无缝接到 dove-pi** 的完成度更高(Trellis provider) |
| **OpenClaude/OpenCLI(opencode)** | 自定义命令/插件/skills/lib,声明式插件系统 | dove-pi 的 extensions 体系(个人-*、notify)可对等 |
| **Cursor** | hooks(注入 shell 会话上下文) + scripts | dove-pi 需补"shell 会话上下文注入"到 powershell/bash 的工具反馈 |
| **omo(同构 continuation agent)** | 会话续跑(多处 run-continuation/ses_*.json) | dove-pi 应支持 seamless 会话续接(当前冷启动 MISS 提示续接成本高) |

**具体差距(强排):**

1. **`agent_run_capability`/食谱没有得到触发** —— 这是与"复用确定性自动化"初衷的最大差距。
2. **上下文续跑/compact**:177-message 会话时 prompt 涨到 211k 都没自触发 compact;其他 agent 会在**前缀接近上限时提示 /compact 或自动截断(仅保留最近 N 轮)**, dove-pi 目前让对话无限累积 + 全程发给模型,这是烧钱主源。
3. **会话级续接/跨会话记忆**:omo 有续跑;dove-pi 依赖新的冷启动 session(代价 180k)。
4. **hashline 编辑器未能在 Desktop host 生效**(不用 edit)。
5. **dispatch 派生子代理没有真正用起来**(通行做法,claude 用 subagent + matcher)。

---

## 4. 建议的优化方案(按 ROI 排序,优先 token/价格)

### P0 — 拦截前缀无限膨胀(最大 savings)

- **会话大小自动保险丝**:触发 `prompt 前缀接近上下文窗口阈值(如 80–85%)时,自动 compaction 或在`custom_message` 中建议 `/compact`。可以用缓存诊断`lastHitRate`/`promptTokens` 驱动。
- **可配置对话轮次上限**: 例如 `DOVE_PI_MAX_MESSAGES`(默认如 120–150),到达后引导 compact / 新会话,避免去 211k 冷启动。
- **会话亲和保活**: 每 4–5 分钟无请求时主动调用本地心跳让上游 cache 加速,降低 `27T23-40` 那类冷启 MISS。Offline-first: 做成可选(cached)。

### P1 — 真正注入 capability/recipe 通道

- `agent_list_capabilities` 已注入,问题是模型缺少调用诱因。建议:在系统提示/内联 hint 里列出当前可复用的 capability 名称,并暴露每个 capability 的 `usage` 与上次调用成本;当 model 通过 `bash` 生成的命令命中已注册 capability 时,触发轻量建议改用 `agent_run_<cap>`,省去重写 token。配上"最近 N 分钟"的 token/cost 统计反馈,让复用有真实收益可见。
- **工作区打开时预列可复用 cap/recipe**: 启动时把当前可复用的 capability/recipe 清单注入模型窗口(受限、按需),让"复用"成为默认动作而不是事后发现。

### P2 — cross-agent 对齐

- **hashline 编辑工具全局统一**(pi-agent 已 OK; Desktop/powershell 也 all 用 replace/insert/undo 并禁用 edit)。
- **Trellis lifecycle 作为 dispatch 主线**(已实现)Trellis provider 与 dispatch 打通;在 claude/codex 一样生成 `trellis-{check,implement,research}` 子代理时,dove-pi 用 `bg_delegate`/fusion 的等价路由自动派子代理新增「并行调查」能力。
- **会话续接**: 让 session 通过(dove-provided)uuid 可续,避免每次冷启动(MOOMO/omo 为先例)。

### P3 — 监控与"策略是否真的 work"的持续可观测

- **接通 `CacheDiagnostics` 到 UI**: `formatCacheDiagnostics` 已在代码中,但未在状态栏/UX 呈现。在 dove-pi 状态栏展示 last/session hit rate 与 prompt 规模;当 `lastMissReason === warmup | prefix-change`(完整冷启动)时弹出提醒,并建议 /compact。这样能持续观测"策略是否真的生效"。
 每个 capability/recipe 调用都写进 ledger(已有 kind=capability.* 的 schema,但目前执行账本只有 project mutation,`grep -c capability` = 0)。补上 capability 记录,形成"复用率"指标,持续验证 P1 的成效。

---

## 5. 风险与注意

- **PI_REASONING_LEVEL=max** 会增加 reasoning token?leans 模型(Flash)的 `thinking` 也多走 `output`,而当前输出很小 —— 用 max 的收益在"模型质量优先"场景值得,但在"token 优先"场景考虑用 standard=medium 保低买。
- **Desktop/code 是 Dove C2 场景(黑盒安全侧)**: 部分建议(如自动调试)需保持 `approval` 边界,避免越熟练自动执行敏感命令。`bypassPermissions` 在 claude settings 本地已开, dove-pi 层放行为要保留审批边界。
- **离线/禁止外接**: 会话保活心跳需可关闭(offline-first)。

---

## 结语 / 下一步

这些数据证明:"缓存优先 + 会话亲和"是对 OpenRouter flash 模型最划算的做法;最大的钱袋子就是**前缀膨胀 + 全 MISS 冷启动**,而最该补的"复用自动化"还没真正被用起来。因此下一步:

1. (P0) 加前缀保险丝 + 冷启动保活 → 预计省 %20-40 的重复输入 token(基于 180k/个 MISS + 未压缩 211k)。
2. (P1) 打通 cap/recipe 的调用路径, 配 dashboard 证据。
3. (P2) 补齐与这 5 个 agent 的差距(跨线 compact 续接)。
4. 记录一条每日"token 账本"入 ledger 供持续 validation。

> 待办:同步给下面的 /aitchworkspace 各路径(README 提示)。落地实现前先在 `.trellis` 里发起一 个"实现任务"(如 08-28-*-token-guard)做为后续跟踪。
