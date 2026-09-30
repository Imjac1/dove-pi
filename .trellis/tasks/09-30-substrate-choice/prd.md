# Which substrate for the self-improving harness: Pi extension, DSH plugins and presets, or something else

## Goal

对一个**受限的自我改进 harness**（bounded self-improving harness）该建在哪个基座上，给出一份**有出处的对比**，并指出每个候选**做不到**什么。

用户价值：这个项目的目的已经确定为「受限自我改进 harness 的实现/研究」（2026-09-30 由用户确认）。基座选择决定了这套机制**能不能成立**——不是风格问题，是能力边界问题：如果所选基座无法把 evaluator 挡在可编辑面之外，那么整个"自我改进"就在原理上退化成 AHE 明确要避免的那种形态。

## Background

### A. 本仓库已经写下的契约（这些是判据，不是背景装饰）

出处：`.trellis/spec/backend/personal-agent-harness-loop.md`（260 行）、
`personal-agent-convergence-record.md`、`.trellis/harness-surface.yaml`。

| # | 契约 | 出处 | 对基座选择的意义 |
|---|---|---|---|
| H1 | **verifier 在循环之外**，所以「改仪器」不是一次循环回合；**recursive self-improvement（系统与 verifier 同时上升）是本项目明确拒绝的轴** | harness-loop.md:20-29 | 基座必须允许把 evaluator 放在**可编辑面之外**。这是硬约束 |
| H2 | AHE §3.3：*"every editable harness component [has] a file-level representation so the action space is explicit and revertible"* | harness-surface.yaml:4 | 可编辑面必须**文件级 + 显式 + 可回退** |
| H3 | AHE 的两个半句是分开满足的：**显式**由 surface 声明满足；**可回退**直到 `change.applied` 把改动绑到 commit 才有目标，回退动作是 `git revert` | convergence-record.md:162-164 | 可回退性依赖**版本控制里的一次提交 = 一个逻辑改动** |
| H4 | 循环的七步（mine → 选面并校验 → 先记预测 → 一次提交 → 记 applied → 让下一回合判 → 打印回合再由**人**决定 keep/revert）；**这里没有任何东西会自己行动** | harness-loop.md:187-206 | 基座需要：可读的自身证据、可声明的面、可回退的提交 |
| H5 | **已知且被点名的缺口**：`tool-implementation` 绑定在**整个 `src`** 上，而 `src` 同时装着 harness 和 verifier，所以「这次改动是不是 verifier 改动」今天**只能靠人读**；**把 harness 代码与 verifier 代码在文件级分开，是解决它的前提**，且"不是这条契约的脚注" | harness-loop.md:33-36 | **这是本任务最该拿来量基座的一条**：哪个基座能让 H1 从"人读"变成"机判" |
| H6 | 判据是行为形状的三样：criterion status / criterion verification state / refusal count；**仪器改动在此集合里读作 `unobserved`**，即"仪器改动由人判"是当前的边界 | harness-loop.md:20-26, 129-133 | 改仪器本身不可被自动判分——这决定了自我改进**改的是行为，不是评测器** |
| H7 | 声明式映射：`harness-surface.yaml` 的 7 个组件 + `verifiedBy`（每个组件由哪些 suite 验证，路径必须可解析，键必须已声明） | harness-surface.yaml | 基座需要"组件 → 文件 → 验证套件"三级都能落到文件上 |
| H8 | AHE 的实测：**P 11.6% / R 11.1% / 9 轮**，所以「回归预测」保持为**记录而不是控制**，回归检测仍交给 held-out criteria、gates、fence | convergence-record.md:127-130 | 引用它时必须说清测的是什么（研究流 R3 的任务） |
| H9 | 本仓库引另外两篇外部工作：**Self-Harness**（失败记录需带①非 verifier 层的因果机制②不得回退的既有行为）与 **SSM**（判定哪些 terminal 算失败的轴） | harness-loop.md:78-79, 105-108; runtime.md:30 | 对比必须对着**它们**的要求。（**本行原先写的"未记 URL"是错的，已更正，见 §调研结果 R3**） |

### B. 两个候选基座在本仓库里**已经并存**

这是一个强事实：不是"选一个"，而是"两种已经各用了一部分"。

| 基座 | 在本仓库里的实际形态 | 已承载什么 |
|---|---|---|
| **Pi** | `.pi/extensions/personal-agent.ts`、`.pi/extensions/notify.ts`、`src/pi-adapter/extension.ts`（约 3600 行，订阅 Pi 的 30 个事件之一部分）、`src/core/*` | 执行循环的闸门、效果 claim、请求生命周期、证据 ledger、诊断；即 H4 的仪器**全部**在此 |
| **DSH（本 harness）** | `.agents/skills/*/SKILL.md`（13 个 skill）、`.codex/agents/*.toml`（3 个子代理预设）、`.codex/hooks/*.py`（3 个 hook）+ `.codex/hooks.json`、`.codex/config.toml`，以及 `.trellis/*`（workflow、spec、tasks、journal、harness-surface） | 任务/规格/会话记忆、子代理派发与上下文注入、技能路由、回合状态注入；即**规划与记忆层** |

**两边都是文件、都在版本控制里**——所以 H2 对两边都能满足。真正区分它们的是 H1 与 H5：**verifier 能不能真的待在可编辑面之外**。

### C. 上一轮审计已经量过的 Pi 事实（直接复用，不重新推导）

出处：已归档任务 `09-29-pointless-machinery`（`prd.md` 的 P1–P10、C1–C8）。

- **P3/P4**：Pi **没有** permission/approval 事件，**没有**任何 read-only / idempotent / sideEffect 工具元数据 → Dove 的闸门与幂等判定**不是重复 Pi**。
- **P7（已实测）**：Pi 的 provider 重试**不重跑**已执行的工具（3 次 provider 调用 / 1 次工具执行）。
- **P8**：`pi-agent-core` **已经设计**了 `HarnessTool.replay: "never"|"safe"`、逐次调用持久化的 `ToolStartedRecord` 与已实现的记录 reducer，**但 `AgentHarness` 是 stub**（每个方法抛 `HarnessNotImplemented`）→ 将来是**替换**而不是重写 Dove 的同类机制。
- **C1–C2**：业界（Claude Code）把边界交给 OS 沙箱，而**原生 Windows 不支持**；本仓库 Windows-first → "照抄沙箱"不可直接移植。

### D. **这个基座问题已经被研究过（09-25）并被裁决、且已落地（09-26）**

这是本任务最先查到、也最重要的一条。上述"Research Plan"因此**必须重新定向**：不能再当开放问题比较，只能当"既有裁决是否仍成立"来复核。

| 出处 | 内容 |
|---|---|
| `.trellis/tasks/archive/2026-09/08-27-dove-interop-layer/research/base-selection-2026-09-25.md` | 09-25 的基座选型研究。**结论摘要第 1 条：问题不在「选 Pi 还是选 dsh」，而在 dove 一直在错误的层选基座**——dove-pi 挂在 harness 层（`pi-coding-agent`），dsh-dove 挂在 harness 层（Cordis 插件），而 dove 需要的钩子**全在 runtime 层**（`pi-agent-core`） |
| 同上，§3 实测（探针 `research/probe-pi-agent-core.mjs` 仍在） | `beforeToolCall` **真能拦**：`WITHOUT gate: toolExecuted=1` / `WITH gate: toolExecuted=0`；拦截原因进 transcript；不杀会话；`fauxProvider` 可离线确定性测试 |
| 同上，§5 实测 | dove-pi 对 Pi 的 import 耦合**只有 4 个文件**，全在 `src/pi-adapter/`；其余 69 个源文件零 import |
| 同上，§6 | dsh 的问题"不是不好用、是过早"（Cordis 自认 API 不稳定）；**并自行修正**：这不足以否决 dsh，因为 Pi 的插件入口同样标 experimental。dsh 的真正价值是**审批/沙箱/计划模式原生就有**，Pi 明确没有 |
| 同上，§7 未决决策 | 三选项：(a) 保留 Pi harness；(b) 改用 `pi-agent-core` runtime 层；(c) 在 dsh 上重写。**"证据倾向 (b) 或 (c)，但取决于 dove 主要跑在哪个宿主"** |
| `.trellis/tasks/archive/2026-09/09-25-dove-base-agent-framework/design.md` §10.1 / §10.5（**RESOLVED**） | **裁决：框架定义自己的最小 loop 接口（`AgentLoop`），`pi-agent-core` 的 thin `Agent` 是它背后的一个 adapter，永远不是地基。** 理由：拥有接口使 adapter 选择可逆（该包是嵌套依赖、0.84.3 vs 已发布 0.87.1、且自带**两套并行 harness 栈**，其中一套标 `./experimental/pico3`）；thin 路径已实测（`agent-loop.js:419-429` 编译后可拦）；12-Factor Agents Factor 8 与 Anthropic 生产指导同向；22 框架实证研究："失败主要来自编排问题而非推理上限" |
| 同上 §10.5 | 由**排除法**定案，原文：**"The '200-line loop + real gate' combination does not exist in this survey."** 有真闸门的都是全量 harness，thin 的都没有闸门 → "自己拥有 loop 接口 + 采用 thin loop 作 adapter + 把**我们的**闸门放在派发边界"是唯一可行路径。**反转成本 = 一个 adapter 实现** |
| 同上 §10.2 | 沙箱不是唯一的最后手段；**"capability scoping stored outside the model's context" 是实测最强杠杆（3/75 vs 33-47/75 注入效果，几乎无任务代价）** |
| 现状核实（本任务） | 已落地：`src/adapters/loop-pi-agent-core.ts`、`src/adapters/loop-scripted.ts` 存在；`package.json` 里 `@earendil-works/pi-agent-core` 已是**直接依赖**；`personal-agent-framework-core.md:44` 把 `AgentLoop` 写成接口、两个实现各一 |
| `09-25-dove-base-agent-framework/prd.md:87-93` | 它自己列的两条风险：① `extension.ts` 2735 行、注册 30 个宿主命令，**行为耦合远大于 4 文件的 import 边界**；② 上一次研究**把基座选择留作未决** |

**因此本任务的真问题不是"选哪个基座"，而是三件事之一：**
1. 那条裁决**是否仍成立**（尤其：`pi-agent-core` 从 0.84.3 到现在有没有变化、`AgentHarness` 是否还是 stub——审计 P8 说它仍是 stub）；
2. **DSH 是"要支持的一个宿主"，还是"只是开发环境 + 工作流/记忆层"**（prd.md:95 已写：`.trellis/` 工作流层与 `src/core/` 运行时层**不是二选一**）；
3. **行为耦合**（extension.ts）这条被点名的风险怎么处理。

## 调研结果（陆续到达）

### R1 Pi 基座（已到达）—— 一条决定性否定，一条对我自己工作的纠正

方法要点（影响所有"未找到"的结论）：仓库 `.gitignore` 列了 `dist/`，所以在包目录之上起 grep 会**静默跳过 `dist/`**；本路所有搜索都改在 `dist/` 内部重跑。

**五条硬要求的判定：**

| # | 要求 | 判定 | 依据（要点） |
|---|---|---|---|
| 1 | 文件级可编辑面 | **PROVIDED BY PI** | 扩展是 `cwd/.pi/extensions` 下被发现的普通文件（`loader.js:624-626`）；skill 是 `SKILL.md`（`skills.d.ts:27-35`）；`reload()` 重读。**注意：Pi 自己的代码是 `node_modules` 里的依赖，不是可编辑组件** |
| 2 | 自身回合的证据 | **PROVIDED BY PI**（原始记录，不是判断） | 每条 `message_end` 落盘（`agent-session.js:371-382`）；session entry 带 id/parentId/时间/类型；扩展可读（`ctx.sessionManager`）也可写（`appendEntry`）。**归属与裁决 Pi 不给**——那是 Dove 的 `execution-ledger.ts` |
| 3 | 到达循环决策点 | **PROVIDED BY PI，有两个具名缺口** | `tool_call` 可 block/terminate/**就地改写 args**；`context`/`before_provider_request`/`before_agent_start`/`message_end`/`tool_result`/`input`/`session_before_*` 皆可达。**缺口：`shouldStopAfterTurn` 与 `prepareNextTurn` 是 `pi-agent-core` 的 `Agent` 选项，没有任何扩展事件**（grep `pi-coding-agent/dist/**/*.js` 无命中）——这正是 09-25 说"钩子在 runtime 层"的实测印证 |
| 4 | 改动的应用与回退 | **DOVE MUST BUILD IT**（应用是 Pi 的，回退不是） | grep `undo\|revert\|checkpoint\|snapshot\|rollback` 在 `pi-coding-agent/dist/**/*.d.ts` 里只命中 TUI 键位、输出累加器、"immutable models.json snapshot"——**没有任何恢复文件的东西**；`fork()/navigateTree()` 回退的是对话不是工作区 |
| 5 | **evaluator 有界/不可被改进者编辑** | **PI CANNOT PROVIDE IT** | **扩展 hook 本身就是从磁盘加载的文件（`loader.js:624-626`），所以一个能改文件的 agent 能改自己的闸门。** 另：无 permission/approval hook（`permission\|approv\|consent\|authoriz` 在两个包的 `.d.ts` 上均无命中）；无任何工具元数据表达路径限制或不可变；allow/deny 列表只是 session 构造参数，**不是强制边界**；`bash`/`powershell` 可跑任意命令。那个可能承载持久化、可校验操作的 `AgentHarness` **是 stub**：`hooks.on`/`events.on` 抛 `HarnessNotImplemented`（`agent-harness.js:59-61,109-111`），每个 lane 操作都 reject（`:115-124`） |

**对本任务的意义（决定性）**：第 5 条在 Pi 上是**原理性做不到**——不是"更难"，是**结构上没有那个外层**。这一点与下面 §E 的 RSI 目标正面相关。

**研究方对我上一轮工作的纠正（真实缺陷，待修）**：`src/core/invocation-disposition.ts` 的模块注释写 `replaySafe` "named after what `pi-agent-core` calls it (`HarnessTool.replay: "never" | "safe"`)"。研究方结论：**该说法在 vendored 包里没有支撑**——`HarnessTool.replay` 只在 **stub** 的 `agent-harness.d.ts:312-314` 里被**声明**，`agent-harness.js` 全文没有 `replay` 这个字符串，两个包中都没有 `replaySafe`。所以准确的表述是"**在 pi-agent-core 的 stub harness 里被声明**"，而不是"pi-agent-core 这么叫"。**这是我上一轮把一个"声明"写成了"事实"。** 处置：记在这里，待用户允许后改（2 行注释，零行为变化）。

### E. 目标与既有裁决的**正面冲突**（必须由用户裁决）

用户 2026-09-30 澄清目标时加入了 **RSI（Agent 递归自我改进）**。而本仓库的 harness 契约**明确拒绝**了这条轴：

> harness-loop.md:20-29 —— "**self-improvement is the system changing while the verifier does not**, and **recursive self-improvement - the system *and* the verifier rising - is the axis this project explicitly declines**."，理由：*"Judging an instrument with the instrument's own output would make the verifier its own judge. The only observable such a change moves is the instrument's output, and a subject that produces its own verdict is not verified."*

两者不可能同时成立。且**基座选择直接取决于这条怎么裁**：

| 若不动点（fixed point）放在 | 允许的自我改进 | 需要的基座 | Pi 能否给 |
|---|---|---|---|
| **人**（现裁决：系统改、verifier 不动，keep/revert 由人） | 有界自我改进，非递归 | 任何基座（含 Pi） | 能 |
| **外层 held-out 评测器**（内层 verifier 可改，外层不可改） | 有界 RSI | **必须提供"agent 改不到的那一层"** | **不能**（见第 5 条：hook 即文件） |
| **无处**（真 RSI） | 无界 | 无关紧要——有界性本身被放弃 | 不适用 |

AHE 自测数字支持"不动点不能交给 agent 自己"：P 11.6% / R 11.1%（9 轮），本仓库因此把回归预测**降级为记录而非控制**（`convergence-record.md:127-130`）。

### R3 外部标准（已到达）—— 以及**对本任务前提的一处推翻**

**推翻**：我在 §A 表 H9 与 §Research Plan R3 里写"Self-Harness / SSM 未记 URL"——**错**。spec 文件确实只写名字，但**已归档任务的调研里记着两者的标识**：
`09-27-harness-scaffold-frontier/research/frontier-anatomy.md:332`（`Self-Harness` `2606.09498`）与
`rsi-community-landscape.md:51`（`RSI-Bench`，github URL）。**且 SSM 不是论文**，是 RSI-Bench 六轴之一。

| 工作 | 标识 | 对本框架最要紧的一条 |
|---|---|---|
| **AHE** *Agentic Harness Engineering* | **arXiv:2604.25850**（v1 2026-04-28 / v4 05-18） | **§3.3 可控性**：*"the Evolve Agent writes only inside the harness workspace, while the runs directory, tracer, verifier, and LLM configuration are **read-only**, and the seed system prompt … is marked non-deletable."* ← **这就是 Plane B，出自一手资料**。另 §3.1：七组件 = 固定挂载点的文件；*"Each logical edit becomes one commit … rollback granularity for free."* |
| **Self-Harness** *Harnesses That Improve Themselves* | **arXiv:2606.09498**（v1 06-08 / v3 08-20） | **§3.1**：*"the model M and evaluator E are **held fixed**, while the harness is treated as the object of improvement."*；**§4.1**：*"the held-out split is **never shown to the proposer** and is used only by the automatic promotion gate."*；**§3.4** 晋升规则：只在不损害另一侧时才接受 |
| **SSM** = **Safety & Stability**，RSI-Bench 六轴之一 | `github.com/sunghunkwag/rsi-bench`（**无论文**，自己是 `@software`） | 该轴三项指标：**crash-free ratio / Pareto preservation / sandbox violations**。RSI-Bench 自称 *"Measurement categories … not achieved results"*、*"Missing is not zero."* |

**决定架构的一条汇聚（三份一手资料一致）**：

> **AHE 与 Self-Harness 都让 evaluator 固定。** AHE 把它设为只读；Self-Harness 连 held-out 切分都不给提议者看。**两份都没有做递归自我改进**——RSI 是被**测量**的轴（RSI-Bench），不是被实践的设计。

所以本仓库那句"recursive self-improvement … is the axis this project explicitly declines"（`harness-loop.md:20-29`）**不是保守，而是与一手资料一致**。任何走向 RSI 的动作都是对三份资料的偏离，必须被论证而不是被默认。

**AHE 的 P/R 到底测什么**（回答 H8 的悬问）：测的是**进化模型自己声明的回归预测**与下一轮真值的对照，语料是 **Terminal-Bench 2 的全部 89 个任务**、9 轮；Appendix D：43 条回归预测只有 5 条命中，累积 **P=11.6%**，另有 40 个未预见的回归发生，累积 **R=11.1%**——仅为随机基线（5.6%/5.4%）的约 2 倍。修复侧为 33.7%/51.4%。**所以本仓库把回归预测降级为"记录而非控制"是准确的解读。**

**另发现两处引用缺陷**（都在仓库里，均非行为改动，详见 `framework.md` §8）：
1. `.trellis/harness-surface.yaml:4` 把"文件级表示"那句话归给 **AHE §3.3**；论文里它在**摘要/§1**，七组件在 **§3.1**，§3.3 是可控性 + manifest。内容对、节号错（`task-convergence.ts:842` 同错）。
2. `09-28-preserve-behaviours/design.md:31` 把 Self-Harness 引成 *"a record of the passing behaviours to preserve that a proposal must not regress"*——**该字符串不在论文里**；论文原文是 *"records of passing behaviors that should be preserved"*，且它在**提议者的上下文**里，不是失败记录的字段。

**框架文档**：`framework.md`（本任务目录），三平面 + 七步回合与文献的逐条对照 + 实验 0 + 证伪条件。

## Research Plan（查什么资料、每条要回答什么、为什么它值得查）

四路，各自必须回答**它能否满足 H1/H2/H5**，而不是泛泛介绍。

| 流 | 资料来源 | 必须回答的问题 | 为什么决定选择 |
|---|---|---|---|
| **R1 Pi 基座** | vendored `node_modules/@earendil-works/pi-*` 的 dist、`.pi/extensions/*`、`src/pi-adapter/extension.ts` | Pi 暴露哪些事件/拦截点？能否 block/改写工具调用？有无 plugin/preset/skill/subagent 概念？**循环归谁**（谁调模型、谁派发工具）？扩展能否把 evaluator 放到自己够不着的地方？ | Pi 拥有循环 → 在 Pi 上，**harness 与 verifier 必然同处一棵可编辑树**，这正是 H5 缺口的来源 |
| **R2 DSH 基座** | `.agents/skills/*`、`.codex/agents/*.toml`、`.codex/hooks/*`、`.codex/hooks.json`、`.codex/config.toml`、`.trellis/config.yaml`，以及我自身运行时的工具面（子代理/teammate/workflow/goal/plan/sandbox 模式） | DSH 的可编辑面和**不可编辑面**各在哪？哪些是文件、哪些是运行时不透明行为？**能否把判分器放在 agent 改不到的地方**？能否读到自身回合证据？ | 若 DSH 的运行时**本身**就是不可编辑的 evaluator 宿主，那 H1 在 DSH 上**天然成立**；代价是循环内部（工具对齐、重试、权限）也一并不可插桩 |
| **R3 外部标准** | 已完成——AHE（**arXiv:2604.25850**）、**Self-Harness**（**arXiv:2606.09498**）、**SSM**（= RSI-Bench 的 Safety & Stability 轴，`github.com/sunghunkwag/rsi-bench`，**不是论文**） | 三篇各要求什么？AHE 的 P 11.6%/R 11.1% 测的**是什么**？哪一条本项目已声明**不满足**？ | 没有这把尺子，对比就退化成偏好；H1（拒绝递归自我改进）和 H8（记录≠控制）都来自这里 |
| **R4 同类实践** | Pi/pi-mono 文档、Claude Code（subagents/hooks/skills/plugins/settings + 沙箱）、OpenAI Codex（sandbox mode / approval policy / AGENTS.md / profiles），以及审计已收的 C1–C8 | 别人让"harness 被自己编辑"时，**显式面与回退路径**长什么样？他们把 evaluator 放在哪？ | 判断我们的取舍是**共性约束**还是**本仓库的特例** |

### 对比框架（五条硬要求 × 三个基座）

对每个基座逐条回答 **PROVIDED / MUST BUILD / CANNOT**，每条必须带 file:line、路径或"我查了 X 没找到"：

1. **文件级可编辑面**（H2）
2. **自身回合的证据**（H4 第 1、6 步）
3. **到达循环决策点**（闸门、重试、工具派发）
4. **改动可应用且可回退**（H3）
5. **evaluator 有界/不可被改进者编辑**（H1，最关键的一条）

三个待比较的基座：
- **S1**：现状——Pi 扩展（Dove 作为 Pi extension）
- **S2**：DSH 插件化 + agent 预设（skills / subagents / hooks / config 作为治理面）
- **S3**：Pi 的另一条路（直接吃 `pi-agent-core` SDK、或等 P8 的 `AgentHarness` 从 stub 转正、或其他不经过 Pi 扩展层的做法）

## Requirements

- **Rq1** 三个基座 × 五条硬要求，**逐格**给出 PROVIDED / MUST BUILD / CANNOT 与证据（路径、file:line，或明确写出"搜了什么、没找到"）。
- **Rq2** 指明**哪一条要求在哪个基座上原理性做不到**（不是"更难"，是做不到），并说明理由。
- **Rq3** 引 AHE / Self-Harness / SSM 的原始要求时，必须带出处与引文；找不到的必须写明"未找到 + 搜过什么"，不得用听起来合理的替代品。
- **Rq4** 复用上一轮审计已实测的 Pi 事实（P1–P10、C1–C8）时标明复用，不重新推导、不重复劳动。
- **Rq5** 结论必须落回 H5（harness/verifier 文件级分离）：给出**每个基座下这条缺口能不能补、怎么补**。
- **Rq6** 明确"不做什么"：本任务是**调研 + 架构设计**，不做迁移、不写实现。
- **Rq7**（新增，因用户把目标扩到 RSI）给出**有界 RSI** 的架构，并写明它与 `harness-loop.md:20-29` 拒绝那条轴的**确切关系**：哪一半保留、哪一半被替换、替换依据是什么。
- **Rq8**（新增）把架构的**强制力来源**写成可验证的实验，而不是设计断言：DSH 的 `workspace-write` 是否真的拒写 workspace 之外。若否，给出退路。

## Acceptance Criteria

- [x] **AC-1（Rq1）** 五条 × 基座对照表：**Pi 与 DSH 两列已实测填满**（本文件 §调研结果 R1、`design.md` §2）；第三列（Pi 的另一条路）由 09-26 裁决覆盖并已落地。
- [x] **AC-2（Rq2）** 原理性做不到已具名：**Pi 上第 5 条**（evaluator 不可被改进者编辑），理由为"扩展 hook 即磁盘文件"——结构问题，不是成本问题。
- [x] **AC-3（Rq3）** 三篇外部工作的引文与出处齐备（见 §调研结果 R3）：**AHE 2604.25850 / Self-Harness 2606.09498 / RSI-Bench（无论文）**；无法取得者已逐条列为未验证（RSI-Bench 轴的公式实现、其是否对应任何论文、AHE 的 PDF），并写出搜索过程（含 `web_search` 本会话 401 不可用、github.com 全不可达）。**并更正了本任务自己的错误前提**。
- [x] **AC-4（Rq5）** H5 缺口的可补性：**Pi 不可补**（无路径限制原语）；**DSH 可补**（目录边界 + 策略模式），但当前**未强制**。
- [x] **AC-5** 建议唯一且带取舍：`design.md` §3/§4；反方证据见 §2 第 3 行（DSH 的循环接入是 MUST BUILD，不是现成）。
- [x] **AC-6（Rq4）** 复用项已标为复用（§C），与已归档审计无冲突；**并新增一处对本人上轮工作的纠正**（`replaySafe` 注释，见 §调研结果 R1 末）。
- [x] **AC-7（Rq7）** 有界 RSI 架构与现裁决的关系已写明：`design.md` §1/§3/§6。
- [ ] **AC-8（Rq8）** 实验 0 的判据（三条，含失败退路）已写成：`design.md` §5；**但未执行**——需在会拒写的会话里跑。

## Out of Scope

- 任何实现、迁移、代码改动。
- 引入沙箱（审计 C2：原生 Windows 不支持）。
- 把工作流闸门变成安全边界（审计 D-B 已排除）。
- 改变 at-most-once 的重试立场（审计 C6/C8 支持它）。

## Open Questions

- **OQ-1 已解决**：用户把不动点的选择权交给本任务（原话："这个得你去查资料，然后设计架构来定"）。架构见 `design.md`，结论是**不动点靠几何 + 文件策略，不靠声明**。
- **OQ-2（阻塞实现，不阻塞本任务的结论）**：**实验 0 的结果**——DSH 的 `workspace-write` 是否真的拒写 workspace 之外。Plane B 的全部强制力来自这一条，所以任何实现都必须排在它之后。研究方明确记录它**没测**过这一条。
- **OQ-3（不阻塞）**：Plane C（编排者）的宿主未定。它只需要"能跑一个回合并把结果落成文件"，因此可以后定，且不影响 Plane A/B 的边界。
