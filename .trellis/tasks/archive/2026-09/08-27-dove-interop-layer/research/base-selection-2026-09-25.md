# 基座选型研究：dove 应该建在哪个 agent 基座上

**日期**：2026-09-25
**关联任务**：08-27-dove-interop-layer（其 goal 即 host 中立性）
**状态**：研究已完成，**决策未定**（见文末「未决决策」）

## 结论摘要

1. **问题不在「选 Pi 还是选 dsh」，而在 dove 一直在错误的层选基座。**
   dove-pi 依赖的是 harness 层（`pi-coding-agent`），dsh-dove 依赖的也是 harness 层（Cordis 插件）。
   而 dove 需要的钩子（上下文变换、工具预检阻断、会话后端、事件流）**全在 runtime 层**。
2. **`@earendil-works/pi-agent-core` 是 runtime 层库，且钩子与 dove 需求逐条对应**（已实测，见第 3 节）。
3. **dsh 作为基座的问题不是「不好用」，是「过早」**：其插件框架 Cordis 官方 README 自认 API 不稳定。
   但 dsh 原生带审批/沙箱/计划模式/目标/子代理，**对安全域比 Pi 更全**（Pi 官方声明无权限系统）。
4. **换基座的成本有界**：dove-pi 对 Pi 的耦合只有 4 个文件，全在 `src/pi-adapter/`（见第 5 节）。

## 1. 候选与客观指标（GitHub API 实取，2026-09-25）

| 基座 | stars | 许可 | 最后推送 |
|---|---|---|---|
| deepseek-harness (dsh) | 235,656 | MIT | 2026-09-24 |
| anomalyco/opencode（原 sst/opencode） | 209,959 | MIT | 2026-09-25 |
| anthropics/claude-code | 148,033 | 未标注 | 2026-09-25 |
| openai/codex | 126,400 | Apache-2.0 | 2026-09-25 |
| **earendil-works/pi**（原 badlogic/pi-mono） | **109,276** | MIT | 2026-09-25 |
| google-gemini/gemini-cli | 107,162 | Apache-2.0 | 2026-09-25 |
| OpenHands/OpenHands | 89,135 | MIT | 2026-09-25 |
| cline/cline | 69,280 | Apache-2.0 | 2026-09-25 |
| aaif-goose/goose | 54,639 | Apache-2.0 | 2026-09-25 |
| Aider-AI/aider | 49,180 | Apache-2.0 | **2026-05-22（停更）** |
| continuedev/continue | 36,021 | Apache-2.0 | 2026-09-24 |
| mastra-ai/mastra | 28,329 | 未标注 | 2026-09-25 |
| charmbracelet/crush | 28,294 | 未标注 | 2026-09-25 |
| QwenLM/qwen-code | 28,128 | Apache-2.0 | 2026-09-25 |
| RooCodeInc/Roo-Code | 24,297 | Apache-2.0 | **2026-05-15（停更）** |
| SWE-agent/SWE-agent | 20,404 | MIT | 2026-09-21 |

**opencode 的负面信号**（社区帖，分数为 HN points）：Anthropic 对其采取法律行动（483）、
未认证远程代码执行（432）、「Annoying and alarming things about OpenCode」（420）。
作为安全域基座，这三条都需要计入。

## 2. 关键洞察：选错了层

Pi 不是一个产品，是**分层的**：

| 层 | 包 | 谁拥有 loop |
|---|---|---|
| 模型层 | `@earendil-works/pi-ai` | — |
| **runtime 层** | **`@earendil-works/pi-agent-core`** | **调用方** |
| harness 层 | `@earendil-works/pi-coding-agent` + `pi-tui` | 宿主 |

- dove-pi 的 `package.json` 依赖：`pi-coding-agent` 0.84.3 + `pi-tui` 0.84.3（**harness 层**），
  并通过 `.pi/extensions/` 挂进 Pi。
- dsh-dove 依赖 Cordis 插件（**harness 层**）。

而 dove 需要的钩子都在 runtime 层 —— 这解释了为什么两边的适配都别扭。

## 3. `pi-agent-core` 实测结果（可复现）

脚本：`probe-pi-agent-core.mjs`（本目录，已在 dove-pi 内跑通）。
注意：dove-pi 只直接依赖 `pi-coding-agent`；`pi-agent-core`/`pi-ai` 是其**嵌套依赖**（0.84.3），
裸 import 解析不到，脚本按脚本位置推导嵌套路径后直接 import 文件。

实测输出：

```
WITHOUT gate: toolExecuted=1
WITH    gate: toolExecuted=0
VERDICT gate blocks       : true
VERDICT reason reaches LLM: true
VERDICT context injected  : true
```

### 钩子对照

| dove 需要 | pi-agent-core 提供 | 实测 |
|---|---|---|
| 上下文压缩/注入 | `transformContext(messages, signal)` | ✓ 每请求调用一次，注入内容进入第 2 次请求 transcript |
| **授权闸门（能真拦）** | **`beforeToolCall(ctx) -> {block, reason, terminate}`** | ✓ 工具执行 1 → 0 |
| 拦截原因可达模型 | 拦截后写入 `toolResult` | ✓ `authorization-missing` 出现在 transcript |
| 拦截不杀会话 | 循环继续 | ✓ 走到第 2 个脚本化响应 |
| 工具注册 | `agent.state.tools` / `AgentTool`（含 `executionMode`、`onUpdate`） | 构造成功 |
| 领域消息类型 | declaration merging + `convertToLlm` | 未实测 |
| 会话持久化 | 可插拔 session backend | 未实测 |
| 事件流/执行记录 | `agent.subscribe(event)` | ✓ 事件序列完整 |
| 确定性离线测试 | `pi-ai` 的 `fauxProvider` / `fauxAssistantMessage` / `fauxToolCall` | ✓ 全程无网络 |

**附带价值**：`faux` provider 让 dove 能做**离线、确定性的门禁回归测试**，
正好对上 SkillsBench 主张的 paired（with/without）+ deterministic verifier 口径。

## 4. 社区 / SOTA 判定（7 条，含出处）

| # | 判定 | 出处 |
|---|---|---|
| 1 | Skills 优于自定义工具/MCP；skill 不加载工具定义 | Armin Ronacher《Skills vs Dynamic MCP Loadouts》2025-12-13 |
| 2 | **共享状态要落在文件系统**；避免「dead end」 | Armin《Agent Design Is Still Hard》2025-11-21；Anthropic《Effective context engineering》2025-09-29 亦用 dead-ends |
| 3 | 系统提示与工具选择必须**静态**（否则炸 KV-cache）；**Mask, Don't Remove** | Armin 同上；Manus《Context Engineering for AI Agents》 |
| 4 | 业界「门禁」其实很弱：Claude Code plan mode = markdown + 反复提醒，**无 enforcement** | Armin《What Actually Is Claude Code's Plan Mode?》2025-12-17 |
| 5 | 大部分工作流自动化会被放弃（slash-command 坟场） | Armin《Agentic Coding Things That Didn't Work》2025-07-30 |
| 6 | **聚焦 skill（≤3 模块）胜过穷举包**；paired evaluation 是基础 | SkillsBench, arXiv 2602.12670 |
| 7 | harness 放沙箱外才有「no permission model to enforce and no credential leak」 | Mendral《The agent harness belongs outside the sandbox》2026-04 |

另有：Lilian Weng《Harness engineering for self-improvement》（三模式：Workflow Automation / **File System as Persistent Memory** / Sub-agent）；
HumanLayer《Why Software Factories Fail》（垂直切片；「30 分钟计划省几小时评审」；真正的瓶颈是 review）；
calpaterson《Agent memory as a file format》（「一列提炼后的事实有多大用处？」）；
HumanLayer ACE（frequent intentional compaction；上下文利用率 40%–60%；Research→Plan→Implement）。

## 5. dove-pi 的适配器边界（换基座成本有界）

实测：dove-pi `src/` 中对 Pi 各包的 import **只出现在 4 个文件**，全在 `src/pi-adapter/`：

```
src/pi-adapter/shell-config.ts     -> pi-coding-agent
src/pi-adapter/extension.ts        -> pi-coding-agent, pi-tui
src/pi-adapter/host-version.ts     -> pi-coding-agent
src/pi-adapter/chinese-settings.ts -> pi-coding-agent, pi-tui
```

其余 69 个源文件（`core/`、`capabilities/`、`project-provider/`、`commands/`、`adapters/`、`windows-runtime/`）
**零 import Pi 任何包**。即换基座不是大迁移，而是重写这 4 个文件 + 换一个 adapter。

## 6. dsh 作为基座的判据（一手）

| 项 | 证据 |
|---|---|
| 公开 | `@deepseek-ai/dsh` 0.1.5-rc.3 / MIT；`dsh-session` 0.0.1-rc.1 / BSD-3；`dsh-base` 0.0.1-rc.1 / BSD-3 |
| 插件 API | Cordis 官方 README 原文：「Cordis is under active development. **The API is not yet stable and may change without notice.**」 |
| 文档 | 同页：「official documentation is still under construction」 |
| 论文 | arXiv 2608.25512：「a preprint under active revision」 |
| 扩展面 | dsh 官方文档确有「会话与持久化 / 策略与交互 / 执行与工具」等节 |
| 原生能力 | **审批、权限预设、沙箱、计划模式、目标、子代理、文件系统、技能、工作流** |

**重要修正**：Cordis API 不稳定**不足以**作为放弃 dsh 的理由 —— Pi 自己的插件入口也标 `experimental`。
dsh 的真正价值是：**安全域最需要的原语（审批/沙箱/计划）dsh 原生就有**，而 Pi 明确没有，
dove-pi 只能自己在 capability 层重造一套 fail-closed。

## 7. 未决决策

1. **基座最终选哪个** —— 三个选项：(a) 保留 Pi harness；(b) 改用 `pi-agent-core` runtime 层；
   (c) 在 dsh 上重写（用 dsh 原生审批/沙箱/计划 + 文件状态）。
   证据倾向 (b) 或 (c)，但**取决于 dove 主要跑在哪个宿主**。
2. **授权闸门档位**：skill 文字 / capability 强闸门 / 再加 `@amaster.ai/pi-security`。
   资料倾向 capability 强闸门（因 plan mode 被证明无 enforcement）。
3. **9 个安全 skill 超过 SkillsBench 的「≤3 模块」量级** —— 需聚焦化或拆分。
4. **三处方案补充**：加 frequent intentional compaction + 40–60% 上下文利用率目标；补垂直切片与「中等任务单文档不拆阶段」档；不再往 skill 嵌工具契约。

## 8. 局限 / 未验证

- **原文语料已丢失**：本会话曾把抓取的原文放在 `dsh\_ref\research\`，该目录已从磁盘删除。
  本文结论均基于当时读到的原文；如需复核，URL 可重新抓取（Armin 博客 lucumr.pocoo.org；
  agentskills.io；anthropic.com/engineering；arXiv 2602.12670 / 2608.25512；github.com/humanlayer；
  calpaterson.com/memoryfields.html；manus.im/blog；mendral.com/blog；lilianweng.github.io）。
- **未做真实 provider 实测**：第 3 节全程用 `faux` provider，未验证接真实模型端点的路径。
- **未实测**：会话后端替换、`harness/*` 导出（compaction / effect-gate / reducer）。
- SkillsBench 的「at most three modules」**只见于 abstract**，正文 Finding 6 仅表述为
  「Compact, focused Skills outperform exhaustive ones」，未核实该数字的适用边界。
- GitHub stars 是唯一采用度指标（npm 下载量接口返回空）。
