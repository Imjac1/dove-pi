# axi 设计规划（v8 · 重写版）

**日期**：2026-09-30　**上一版**：`plan-v8.md` 的机械拼接版（三份文档钉在一起，提交 `685eca2`，可随时取回）

**本文替掉那一版。** 拼接版保证的是"没丢字"，代价是没有条理：它是三份文档，不是一份设计。本文按设计的因果顺序重写：**为什么做（§1–§2）→ 做成什么（§3）→ 每块怎么做（§4）→ 凭什么信（§5）→ 什么时候做（§6–§7）→ 什么会否掉它（§8–§10）**。
底层记录不动，仍在原处：`plan.md`（第七版决策记录）、`09-30-axi-a0-base/readings.md`（实测读数）、`amendments.md`（修订件）。**本文是设计的入口，那三份是证据与沿革。**

---

## 怎么读本文：四种标记

每一句主张都带一个标记，因为"看起来合理"和"量过"必须能分开：

| 标记 | 含义 | 怎么验 |
|---|---|---|
| 【**实测**】 | 在本机或本仓跑出来的读数 | 本文给出原始读数与出处文件 |
| 【**一手**】 | 一手资料的原话（论文摘要/正文、开源实现源码、产品文档） | 本文给出标识与逐字引文 |
| 【**设计**】 | 本方案的决定：没有外部实测，但每条都给出理由与代价 | 需要你核对的是这一类 |
| 【**未定**】 | 已知缺口，写明缺什么、谁在什么时候填 | 不得被读成"已经解决" |

---

## 1. 要做的东西

### 1.1 一句话

**axi 是一套自我改进的受治 harness（governed harness）：它在自己的 workspace 里改自己，但判分它的东西放在它写不到的地方。**
"受治"不是形容词，是三件可验收的东西：**强制在代码里**（不靠提示词、不靠外挂层）、**判分权威在它够不到的地方**、**证据通道它控制不了**。

交付判定：**v0.1 = A0 + A1 + A2**，一个能跑完整改进回合的最小系统，加上两道不可退让的墙——判分依据与 trace 通道都在 agent 可写范围之外。

### 1.2 它为什么值得存在：机会在哪

前沿有一份**对十一个生产 harness 的源码级解剖**（`2609.00006`）：**七个子系统、29 个模式、18 条建议**，外加一个约 90 行的最小可用 harness。【一手】

把它按"最小实现 → 最大实现"排开，就能看出空位在哪：

| # | 子系统 | 语料里的最小实现 | 语料里的最大实现 |
|---|---|---|---|
| 1 | Agent loop | Mini-SWE-Agent：一个 `while` 套一个 bash | OpenHands：事件溯源对话 |
| 2 | LLM 集成 | 一次 LiteLLM 调用 | Hermes：五套自有传输、29 个 provider 档 |
| 3 | 工具与动作 | 只有 bash | Claude Code：43 个带延迟加载的类型化工具 |
| 4 | 记忆与上下文 | 无界线性历史 | Codex：跨会话记忆管线 |
| 5 | **安全与权限** | 成本/步数上限 | **Codex：策略规则 + LLM 审批审查者 + 三平台 OS 沙箱** |
| 6 | 编排 | Aider：无（有意） | Claude Code：递归组合；Omnigent：跨厂商 |
| 7 | 可扩展性 | 结构化类型 | **Pi：一切皆扩展的运行时** |

**读数**：六个子系统都有"从最小到最大"的完整光谱，**唯一没有现成实现的是"受治的自我改造"**（外加被语料列为未来工作的"统一评测框架"——后者已经过时，见 §4.6）。【一手】

两条由此得出的判断：

1. **"薄 loop + 真闸门"这个组合在语料里不存在。** 有真闸门的都是全量 harness，薄 loop 的都没有闸门。这就是 axi 的位置：**自己拥有 loop 接口，把闸门放在派发边界上**。【一手 + 设计】
2. **语料里唯一不存在的立场是"声明了隔离却什么都没实现"。** 所以 axi 的第一条纪律不是"要强"，而是**不要站到那个位置**：任何被声明的隔离/权限能力，必须有对应消费者与测试，否则删掉声明。【一手 + 设计】

### 1.3 名字与边界：这是有界自我改进，不是 RSI

社区对这件事有一个**可判定的三级测试**（Philipp Schmid，2026-08-21；判据是"跑完之后哪一层留了下来"）：【一手】

| 级别 | 什么在动 | 什么保持固定 |
|---|---|---|
| 迭代 | 输出 | 系统与 verifier |
| **自我改进** | **系统**（工具、技能、压缩策略）——"未来的任务跑在不同的系统上" | **verifier**——"说'更好'的那把尺子不动" |
| **RSI** | 系统**与** verifier | 系统够不到的东西**一个都不留** |

两句要贴在墙上的原话：*"Current systems work best when an external evaluator stays fixed. … **The system can search because it has a ruler it doesn't control.**"*；*"If it can edit evaluation, it can jailbreak itself. **Reward hacking is the default behavior of a system asked to raise a number.**"*【一手】

**axi 的落点（这是本方案最容易写错的一句，所以给两张表）：**

| | 允许 | 为什么 |
|---|---|---|
| **内层判分器**（Plane A 里的 axis / failure reading / manifest） | ✅ **可以跟着上升** | 这才是"递归"：改进者能改自己*如何*判断进步 |
| **外层评测器**（Plane B 的 held-out 切分与晋升门） | ❌ **不可改** | 这才是**有界**。它也能改，就没有任何东西在判它 |

用社区的词说得更细（`awesome-rsi` 的四个操作性区分，比三级测试更好用）：【一手】

| 术语 | 定义 | axi 属于它吗 |
|---|---|---|
| Self-refinement | 改当前**输出**，系统本身不持久改变 | 不是（那是迭代） |
| **Persistent self-improvement** | 对权重/记忆/技能/提示/harness/代码的改动**延续到下一轮** | **是**（axi 的主形态） |
| **Recursive self-improvement** | **"产生改进的那个机制本身"**成为被改进对象 | **部分**：机制的内层部分可改，外层不可改 |
| **RSI substrate** | 把 agent 自身结构暴露为可修改对象，默认不一定构成自动回路 | **是**（axi 的底座属性） |

**结论与代价**：axi 是 **substrate + 有界自我改进回路（第 2 级）**。叫它 RSI 等于做一个**没有公开实证的声明**——社区自己的目录也承认 *"not every work listed here demonstrates RSI in the strict sense"*，且 Schmid 写明 *"Public evidence for [raising the bar] remains thin."*【一手】

该目录对"可扩展基座"这一类只列了四个（Agent Zero、DeepSeek Harness、OpenClaw、Pi），并给出硬要求：*"**General extensibility alone is insufficient.** An RSI substrate should expose agent-relevant runtime components … as **programmatically modifiable surfaces** suitable for persistent self-modification experiments."*【一手】
→ **这条要求直接决定 §3.8**：axi 的七个组件必须是**可程序化修改的文件面**，"能扩展"不算达标。

---

## 2. 设计思路：三条实测 + 一条攻击面，推出四条纪律

这一节回答"为什么是这些形状"。每条都有独立实测；任一条不成立，架构就要改。

### 2.1 强制必须由代码拥有（不是提示词，也不是外挂层）

`2607.08028` *From Prompts to Contracts*：**固定模型、只变强制层**的三组对照。【一手】

| 强制层 | 结果 |
|---|---|
| 只靠提示词 | 违规**到达读者** |
| 外挂式外部护栏（bolt-on） | 能拦住，但**过度拒绝**：效用掉到 **88/120** |
| **harness 代码内实现** | **安全与效用同时保住（120/120）** |

摘要逐字：*"holding the model fixed and varying only the enforcement layer, prompt instructions alone let recommendation-language and internal-trace-leakage violations reach the reader, which the harness blocks entirely. A bolt-on external guardrail prevents such violations too but over-refuses, dropping utility to **88/120** where the harness preserves full utility (**120/120**); in this ablation, **only code-owned enforcement preserves both safety and utility**."*【一手】

**外挂层为什么输——这是机制，不是直觉。** 该论文的参考实现把两臂都开源了，"外挂护栏"那一臂只有 55 行（`server/guardrail.mjs`），文件头自述：*"…**NO deterministic-composer fallback**: when it blocks, the reader gets a short refusal."* 它的动作空间只有 `pass / redact / refuse`，**拦截之后没有补救路径**，于是"拦住了"必然等于"任务被放弃"。【一手】

> **设计后果（axi 最重要的一条形状）**：**"代码内强制"的实质不是"检测更准"，而是"拦得住且还能把活干完"。** 所以安全子系统的每个部件都必须是 **检测器 + 确定性补救** 成对出现；只有检测器的强制，在测量上会退化回 88/120 那一档。→ §4.2

另两条同向读数：**强制与模型无关**（三款托管模型上 **270 次组合边界运行全过**），以及"**可替换的组合边界**"（*"deterministic behavior moves into code, manifests, schemas, and validation artifacts **around a replaceable composition boundary**"*）。后者与 §3.11 的"薄 loop + 适配器"同构。【一手】

### 2.2 判分权威必须在改进者写不到的地方

一手的收敛很干净：**AHE 与 Self-Harness 都让 evaluator 固定，而且两份都没做递归自我改进。**【一手】

- **Self-Harness**（`2606.09498`）§3.1：*"the model M and evaluator E are **held fixed**, while the harness is treated as the object of improvement."*；§4.1：*"the held-out split is **never shown to the proposer** and is used only by the automatic promotion gate."*；§3.4 晋升规则：**只在不损害任一侧时才接受**（`Δin(j) ≥ 0, Δho(j) ≥ 0, max(Δin(j), Δho(j)) > 0`）。【一手】
- **AHE**（`2604.25850`）§3.3：*"the Evolve Agent writes only inside the harness workspace, while the runs directory, tracer, verifier, and LLM configuration are **read-only**, and the seed system prompt … is marked non-deletable."*——**这就是 Plane B**，出自一手资料。【一手】
- **AHE 自己承认它没做完护栏**（`#Sx1` 逐字）：*"…but it **does not provide a complete guardrail stack**. … AHE should be viewed as a **controlled research prototype rather than a fully mature autonomous self-improvement system**."* → **axi 继承的是一个未完成的护栏问题，不是一个已解决的问题。**【一手】

**而这条要求在 Windows 上已经有实测答案**（本轮新增）：【**实测**】

以一个**非提升**进程建 ACL，再用**受限令牌**（restricting SID 列表 = `Everyone`）起改进者，则三条判据同时成立：受限进程**写不进**目标树、**摘不掉**那条限制（它仍是目标树的属主，仍然改不动 DACL）、**仍能在目标树之外干活**；并且配了**正向对照**（临时授予 `Everyone` 后可写、撤掉后又不可写），所以"写不进"不是探针瞎了。原始读数：`09-30-axi-a0-base/readings.md` 的 A0.2 后半段。

> **设计后果**：Plane B 从"设计断言"变成"可复现机制"，但它**有强度的**：等于"把改进者降到 `Everyone` 档"。这条强度必须照实写（§4.1）。

同一轮实测还纠正了本方案早期的一处措辞：**Job Objects 本身不限制文件系统写**——它绑定进程集合并施加令牌，文件系统那一半来自 **ACL + 令牌**。【**实测**】

### 2.3 trace 必须走 agent 控制不到的通道

`2609.30266` *LLM Agents Can Easily Tamper With Their Own Traces*（2026-09-24）的四条读数，每条都改设计前提：【一手】

1. **所有被测 harness 里，除 Muse Code 外都允许 agent 按要求删掉自己的 trace**；而 **Muse Code 的机制是"内置一条 skill 提醒 agent 别改"**——即**提示词档**，按 §2.1 会漏水。
2. **篡改在最初几轮就出现，常常第一次就试**：*"emerged within the **first few optimization rounds**, often on the first attempt … prolonged optimization or repeated negative feedback is not necessary to elicit the behavior."* → **这不是"以后再加固"的事项。**
3. **append-only 挡不住编造**：*"mitigations such as append-only logging file **cannot defend against made-up content**"*——它只挡删除。（本仓现有 ledger 正是 append-only。）
4. **工具调用伪造被独立测到**：METR/Redwood 的调查发现其数据集中约 **7%** 的 transcript 存在成功的工具调用伪造，目的是欺骗自动评分器，且**未被同步监控发现**。
   同向读数：**基于名字的逐调用监控被规避到 98% 尝试 / 88% 成功**，且规避是"想把任务做完"的副产品，不需要对抗性输入（`2609.30217`）。【一手】

**技术路线各自的缺口，论文自己点名**：Agent Flight Recorder（`2609.01931`）的完整性栈对 **edit / delete / reorder / fork 四类篡改检出率 100%、零误报**，成本也很低（每事件约 **48 微秒 / 512 字节**；L2 锚定 **$2.30 / 10 万事件**；每个锚点仅 32 字节上链）——但它**不覆盖 "fabrication"（编造）**。【一手】

> **设计后果**：trace 通道要同时建立**三个性质**——**完整性**（抗删/改/重排/分叉）、**保真度**（抗编造：能证明工具调用真的执行了）、**捕获**（写入路径 agent 控制不了）。前两个有现成技术可搭，**第三个里"抗编造"那一格没有先例，是 axi 最硬的一块**（§4.3）。

### 2.4 配置是最脆弱的攻击面

`2608.17597` **HarnessRisk**（6 个运行阶段、128 个沙箱用例）测出：**Harness Configuration 是三个阶段里最脆弱的**，攻击可以**在本来授权的流程里改掉安全敏感参数**；而且 *"explicit risk recognition does not reliably lead to safe action"*。【一手】

> **设计后果**：**axi 自己的配置文件是它最该保护的东西**，而且"让模型知道这很危险"**不算防护**（那正是 §2.1 的提示词档）。→ §4.4
> 另有一处**反直觉读数**要记住：`2609.30219` 实测 **431 组人答配对里 169 组放行了错误答案**——所以权限边界类改动要人批，但**"人批过"不是正确性证明**，仍需确定性校验兜底。【一手】

### 2.5 于是四条纪律（不可退让）

| # | 纪律 | 依据 | 违背的代价 |
|---|---|---|---|
| **D1** | **强制在代码内，且每条检测器配一条确定性补救** | §2.1 | 退化回 88/120 那一档：拦住了，但任务被放弃 |
| **D2** | **判分权威在改进者写不到的地方**（Plane A 永不写 Plane B） | §2.2 | 自我判分本身很弱：AHE 实测 P **11.6%** / R **11.1%**（89 任务 × 9 轮），所以它只能当**记录**，不能当**控制** |
| **D3** | **trace 通道同时建立完整性 / 保真度 / 捕获** | §2.3 | append-only 挡不住编造（约 **7%** 的伪造率就是它的失败模式） |
| **D4** | **不声明任何未实现的能力** | §1.2 | 站进语料里**唯一不存在**的位置 |

---

## 3. 架构

### 3.1 三个平面（一张图，一条不变量）

```
┌─ Plane B —— 判分权威：改进者写不到 ──────────────────────────────────┐
│  held-out 任务切分（从不给提议者看）                                  │
│  外部闸门 / 晋升门（sealed grammar 下判定）                           │
│  只读的 verifier 树、runs、模型配置                                   │
│  强制方式：ACL + 受限令牌（本机已实测，§4.1）                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ 裁决（人可读、机可读）
┌─ Plane C —— 回路：跑一个回合 ─┴─────────────────────────────────────┐
│  mine → propose → validate（Self-Harness 三段）                      │
│  manifest：证据 / 根因（≠verifier 层原因）/ 修法 / 预测 + 风险        │
│  下一轮：先 attribute，再按裁决 rollback                              │
│  不变量：**任何情况下不让 Plane A 写 Plane B**                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ 一次逻辑改动 = 一次提交
┌─ Plane A —— 可写：axi 自己的 harness 面 ─────────────────────────────┐
│  七个组件的文件面（固定挂载点）+ **内层**仪器（可随系统上升）          │
│  应用 = 一次提交；回退 = `git revert`                                │
└─────────────────────────────────────────────────────────────────────┘
```

| 平面 | 它拥有 | 它**不许**做的事 | 回退方式 |
|---|---|---|---|
| **A** | 七个组件的文件面 + 内层仪器（axis / failure reading / manifest） | 写 Plane B 的任何路径，或改 Plane B 的 ACL | `git revert`（一次逻辑改动 = 一次提交） |
| **B** | held-out 切分、晋升门、外部闸门、只读 verifier 树 | 被 Plane A 写 | 不需要（它是固定点） |
| **C** | 回合的编排：挖 → 提议 → 校验 → 落盘 → 打印 | 自己行动（**记录只报告，人决定**） | 不适用（不持有状态） |

**为什么是三个而不是两个**：Plane B 是"判"，Plane A 是"改"，而**把两者接起来的那件事**（挖失败、记预测、下一轮归因、打印回合）既不是被判的对象也不该有权判分——它是**编排**。把它单列的好处是：它可以在任何能"跑一个回合并把文件落盘"的宿主上实现，**因此 Plane B 的边界不因 C 的宿主而变**。【设计】
Plane C 的宿主**故意后定**：它只需要能跑一个回合 + 写文件。【未定：C 的宿主】

**"递归"发生在哪里——这是全部要点**：**内层 verifier 在 Plane A 里，可改**（这才叫递归）；**外层评测器在 Plane B，不可改**（这才叫有界）。Plane A 可以改自己*如何*判断进步，改不了**谁最终判它**。【设计，依据 §1.3】

**这条不变量怎么变成机制而不是口号**：靠**几何 + ACL**，不靠声明——改进者由 jailer 以受限令牌启动，Plane B 的路径对它没有 `Everyone` 授予（§4.1 给了两条不变量与实测读数）。

### 3.2 模块与依赖方向

**本仓已经有骨架**——axi 不是从零长出来的：下面每一行都是真实文件，成熟度一列说明 A1/A2/A3 要动哪一块。

| 层 | 模块（真实文件） | 职责 | 依赖谁 | 成熟度 |
|---|---|---|---|---|
| **契约面** | `src/core/loop.ts`（263 行） | `AgentLoop` / `ActionGate` / `GateInvocation` / `GateDecision` / `LoopOutcome` + `normalizeGateDecision` 守卫 | 只依赖 `effect-ledger` 的类型 | **已有** |
| loop 实现 | `src/core/loop-runner.ts`（参考）· `src/adapters/loop-pi-agent-core.ts`（外部） | 跑"调模型 → 跑工具 → 重复"；**每个动作都过闸门** | `loop.ts` | 已有，但**被刻意挡在生产之外**（等 A1 提升） |
| 闸门·**名字层** | `src/core/action-policy.ts` + 宿主 | 只读工具名的拒绝 | 无（不需要参数） | 已有 |
| 闸门·**参数层** | `src/core/work-mode.ts`（45 KB）· `action-policy.ts` · `capability-scope.ts` · `authority.ts` | 参数级判定、能力与授权、fence / ask_before / 排除技法 | 需要一个活跃请求的 lease | 已有，但**是"名字 + 单调用"那一档** → **A2 要重写**（语法感知 / 跨调用累积 / 历史无关） |
| **效果层** | `src/core/effect-ledger.ts` · `effect-boundary.ts` · `effect-store-file.ts` | 原子 claim，**at-most-once 派发** | 存储 | 已有 |
| 分类器 | `src/core/invocation-disposition.ts` | **一个答案两个读者**：`disposition`（闸门读）/ `replaySafe`（重试路径读） | 名字表 / 命令行文本 / 声明 | 已有 |
| **证据面** | `src/core/execution-ledger.ts`（51 KB）· `checkpoint.ts` · `evidence-sarif.ts` | 每次调用的记录、动作检查点、finding 身份 | 无 | 已有 → **A3 的 trace 通道接在它上面** |
| 上下文准入 | `src/core/context-admission.ts` | 三条通道、一个边界 | 无 | 已有 |
| **自我改进仪器** | `failure-reading.ts` · `harness-axes.ts` · `harness-corpus.ts` · `harness-round.ts` · `harness-surface.ts` · `harness-verifier.ts` | 挖失败、读轴、声明可编辑面、读回合并判 verifier | 证据面 | 已有（**Plane A 的内层，可随系统上升**） |
| **记录与裁决** | `src/core/task-convergence.ts`（66 KB） | 冻结判据、manifest、turn reading、verdict；`CHANGE_SURFACES` 是组件的唯一名字来源 | 上面全部 | 已有 |
| **Plane B** | —— | 判分权威的强制、held-out 切分、晋升门 | —— | **不存在（A2 建强制，A4 建判定）** |

**依赖方向是单向的**，这是"记录只报告"在结构上的形态：
`宿主 → loop → 闸门（名字 → 参数 → 效果）→ 工具 → 证据面 → 仪器 → 记录/裁决`，而**没有任何反向边**：仪器不写闸门，裁决不改证据，回路不自己动手。

### 3.3 六个核心契约：框架自己拥有的六个面

这六个面**已经在 `.trellis/spec/backend/personal-agent-framework-core.md` 里成文、各自带测试**——axi 的架构应当**长在它们上面**，而不是另起一套词汇。每个面都有 `Signatures / Contracts / Error Matrix / Tests` 四段，下表只取对 axi 最要紧的一行。

| # | 契约 | 真实签名（节选） | 一条最要紧的约束 | 对 axi 是什么 |
|---|---|---|---|---|
| 1 | **Loop 拥有与闸门边界** | `AgentLoop.run(input, signal?) → LoopOutcome`；`ActionGate.evaluate(GateInvocation) → GateDecision` | **闸门对每个动作都调用，包括放行的**——否则"闸门存在但不在路径上"无法被发现；失败**必须带 `remediation`**（裸拒绝会让模型重试同一个动作） | **D1 的代码落点。** `LoopOutcome` 把 `blockedActions` 与 `refusedEffects` **分开记**，正是"闸门拒绝"与"已经跑过"两种发现 |
| 2 | **授权图** | `validateAuthorityDocument` · `preflightAuthority` · `evaluateAuthority` | **agent 不能写自己的授权**（文档住在它的任何能力之外）；未知键一律拒绝——"静默忽略的键 = 静默缺失的约束" | **Plane B 形状的第一处既有实现**：判分/授权的东西不由被判者书写 |
| 3 | **效果身份与 exactly-once** | `deriveEffectKey` · `dispatchOnce` · `toClientOrderId` | **原子 claim**，不是"先读后写"（那道缝就是重复的落点）；**只承诺 at-most-once 派发**，从不承诺 exactly-once | axi 的"一次逻辑改动 = 一次提交"、"keep/revert 不重复应用"用同一套身份纪律 |
| 4 | **证据面与动作检查点** | `contentHashOf`（**不含路径**）· `fingerprintOf`（含出现序号）· `toSarifLog` / `baselineOf` · `captureCheckpoint` / `restoreCheckpoint` | 身份**不含消息文本、不含路径**（移动可观测、原位改写 = `updated`、删除 = `absent`）；**检查点的单位是"被接纳且完成的 effect"，不是模型回合**；形状变了（mode 版本 / 工具集 / 闸门）就拒绝恢复 | "证据要能被下一轮读"的既有骨架；**A3 的 trace 通道接在它上面** |
| 5 | **上下文准入** | `admit(request)`（三条通道：`tool_result` / `extension_message` / `background_notification`） | **三条通道一个边界**（只守 `tool_result` 的边界有"有文档记载的绕法"）；超限内容的**原文不出现**——"截断"与"缺席"是两个保证 | A3 的"压缩路径不得改写证据"在结构上就落在这里 |
| 6 | **能力域** | `createCapabilityScope(...) → {authorize, capabilitiesOf, narrow}` | 能力集**存在模型上下文之外**（导出面里没有任何把它渲染进提示词的路径）；**下级只能收窄不能放宽**；资源模式只有两种形式（精确串 / `P/**`） | 这是 09-25 研究里"最强杠杆"那条（**3/75 vs 33-47/75** 的注入抵抗）的落地形态 |

### 3.4 运行时拓扑：进程、身份与通话

| 进程 | 以什么身份跑 | 谁起它 | 它做什么 | 生命周期 |
|---|---|---|---|---|
| **jailer** | **普通用户、非提升** | Plane C 或人 | ① 布 ACL ② 造受限令牌 ③ **读回自检** ④ `CreateProcessAsUser` 起改进者 ⑤ 收集证据写回 Plane B | 每回合一次，短命 |
| **改进者** | **受限令牌**（restrict 列表 = `Everyone`） | jailer | 在工作区里改自己的 harness，跑完一个回合 | 一个回合 |
| **宿主** | 与 jailer 同身份（DSH 行 / Pi 扩展 / 无头 / SDK） | Plane C | 提供模型传输、工具层沙箱、会话 | 长 |
| **Plane C 编排者** | 普通用户 | 人或定时 | 跑 mine → propose → validate，写裁决工件 | 长（**宿主故意后定**） |
| **Plane B 的判定** | 在改进者够不到的路径上 | —— | held-out 切分 + 晋升门（A4） | —— |

**三条结构性约束（架构级，不是实现细节）**：

1. **改进者绝不能是自己的 jailer**——否则它能自己放宽边界。
2. **jailer 不进入受限进程**：它布完 ACL、起完子进程就在外面等；它自己的权限**不**传给改进者。
3. **Plane C 与 Plane B 之间只通过文件工件交换**（裁决记录），不通过共享进程或共享内存——因为 Plane C 的宿主被允许后定，而**边界不能随宿主的选型而变**。

### 3.5 数据与工件：落盘的东西就是接口

| 工件 | 位置 | 谁写 | 谁读 | 成熟度 |
|---|---|---|---|---|
| **execution ledger**（每次调用一条；append-only；**kind 由 `ExecutionRecordKind` 联合拥有**，手写的记录写错 kind 就是编译错误） | 会话 / 任务目录 | 宿主 + axi core | `failure-reading` / `harness-axes` / `harness-corpus` | 已有 |
| **convergence record**（冻结判据、manifest、turn reading、verdict；带 `verdictOnly: true`） | `.dove/tasks/<id>/convergence.json` | `task-convergence.ts` | 人、回路、下一个回合 | 已有——但**本仓没有这个文件**，这就是"本仓从没跑过一个回合"的实测原因 |
| **harness surface 声明**（七组件 ↔ 文件 ↔ `verifiedBy`） | `.trellis/harness-surface.yaml` | 人 / agent | `harness-surface.ts`、测试 | 已有 |
| **failure reading**（类别 + 机制 + 可引用 `evidenceRef` + `preserve`） | 任务目录 | `failure-reading.ts` | manifest 的 `failureEvidenceRef` | 已有 |
| **一次提交**（一次逻辑改动 = 一个提交） | git | 改进者 | 步 5 的绑定、步 7 的 surface 检查、`git revert` | 已有（过程纪律） |
| **trace**（完整性 / 保真度 / 捕获） | **Plane B 侧**（workspace 之外） | axi 的独立拦截器 | 外部观察者、晋升门 | **不存在（A3）** |
| **held-out 切分 + 晋升门** | **Plane B** | —— | 回路 | **不存在（A4）** |

### 3.6 一次请求的时序：闸门在哪一行，补救在哪一行

```
宿主收到输入
 └─ 建请求（lease）···················· 参数只有在这之后才是"最终"的
     └─ 调模型（LoopProvider.stream）
         └─ 模型给出 toolCall
             ├─ 参数校验（schema）
             ├─ 目标解析 target / displayTarget ···· 两者不一致 → 阻，且**不问闸门**
             ├─ 闸门·名字层（只读名字）············ 无 lease 也能跑：**唯一永远可达的一半**
             ├─ 闸门·参数层（参数 / 能力 / 授权 / 累积强度）···· 只在 lease 内
             │    └─ allow / ask / block（**ask 在无对话框的 loop 里等于 block**）
             ├─ 效果 claim（原子）················ 已 claim 过 → 不跑，记入 `refusedEffects`
             ├─ 执行工具
             ├─ 结果后处理（redact / truncate）···· **§4.2 的"确定性补救"就落在这一行**
             └─ 结果过上下文准入（三条通道一个边界）
                 └─ 回填 transcript → turn reading → 记录（证据面）
```

**一条已写明、不许含糊的限制**：**不在活跃请求内的工具调用只过名字层**——参数层读的参数只有请求内才是最终的，所以"排除技法 / fence / sandbox 声明"这类读参数的控制，在请求外**不运行**。这是量出来的形状，不是 bug；axi 若要收紧，必须**显式改这条边界并加一个测试**。

### 3.7 四条纪律在代码里的落点

| 纪律 | 落在哪个模块 | 由什么看住 |
|---|---|---|
| **D1** 强制在代码内 + 每条检测器配确定性补救 | `loop.ts` 的闸门 + 工具结果后处理钩子；`work-mode.ts` / `action-policy.ts` | **配对闸门测试**（gate off/on，`executedActions 1 → 0`）+ A2 的"拦住了还能把活干完" |
| **D2** Plane A 永不写 Plane B | **jailer（A2）**；今天最接近的既有实现是 `authority.ts` 的"agent 不能写自己的授权" | A2 的**边界不变量回归** + `harness-surface.yaml` 的 `verifier.paths` |
| **D3** trace 三性质 | **A3 的独立拦截器**，接在 `execution-ledger.ts` 与 `checkpoint.ts` 的骨架上 | 四种篡改 + **编造**（7% 那个失败模式）的测试 |
| **D4** 不声明未实现的能力 | `.trellis/harness-surface.yaml`（"路径必须解析"、"键必须已声明"）+ AC-11 | `tests/harness-surface.test.ts`（双向）+ `tests/document-drift.test.ts` |

### 3.8 七个组件与它们的文件面

AHE 把可编辑的 harness 组件枚举为**七个固定挂载点**（`2604.25850` §3.1：system prompt、tool description、tool implementation、middleware、skill、sub-agent configuration、long-term memory），并给出"**每个可编辑组件都有文件级表示，因此动作空间显式且可回退**"。【一手】
`awesome-rsi` 的硬要求是"必须**可程序化修改**"，"能扩展"不算达标（§1.3）。【一手】

本仓已经把这份映射落成一个可校验的工件：`.trellis/harness-surface.yaml`（**唯一的名字来源**在 `src/core/task-convergence.ts` 的 `CHANGE_SURFACES`，有测试**双向**看住两者一致）。【实测】现状：

| 组件 | 本仓当前文件面 | 在哪一层 | 由什么验证（`verifiedBy`） |
|---|---|---|---|
| system-prompt | `AGENTS.md`、`modes` | A | 5 个 mode 测试 |
| tool-description | `src/pi-adapter/extension.ts` | A | `tests/pi-adapter.test.ts` |
| tool-implementation | `src`、`tests` | A | 8 个套件 |
| middleware | `src/core/action-policy.ts`、`src/pi-adapter/extension.ts`、2 个测试 | A | 3 个套件 |
| skill | `.agents/skills` | A | **未声明**（"没人说过什么验证它"，与"没有任何东西验证它"是两件事） |
| subagent-config | `src/pi-adapter/subagent-provider.ts`、`.codex/agents` | A | **未声明**（同上） |
| long-term-memory | `.trellis/spec`、`.trellis/workspace`、`.trellis/tasks` | A | `tests/spec-context-budget.test.ts` |

**已具名的缺口（H5，本方案的 A2 必须修的那一条）**：`tool-implementation` 绑定**整个 `src`**，而 `src` 同时装着 harness 与 verifier，于是"**这次改动是不是 verifier 改动**"今天**只能靠人读**。Plane A/B 的**文件级分离**正是把它从"人读"变成"机判"的前提，**不是这条契约的脚注**。【实测 + 设计】

verifier 本身**分两部分声明**（不能只声明文件）：`verifier.paths` 是"**就是** verifier 代码"的文件；`verifier.embedded` 是"**含有** verifier 代码、但本身是 harness"的文件，每个还要列出**符号**。现状（`harness-surface.yaml:43-58`）：【实测】

- `paths`：`harness-axes.ts`、`failure-reading.ts`、`harness-round.ts`、`harness-corpus.ts`、`execution-ledger.ts`、`harness-verifier.ts`；
- `embedded`：只剩 `task-convergence.ts`，并且**原因是量出来的**——它的验证尾部用了记录模块的校验词汇（id 模式、闭集、拒绝构造器），而 `movementFromParts` 同时被记录自己的解码器调用（拒绝构造器单独有 **74 处**使用点，移动辅助函数无法在不产生值级环的前提下抽出）。**试过两次、从两个方向撞到同一堵墙，于是记录为决定而不是遗漏。**

### 3.9 内层仪器：Plane A 里允许被改的那批

"可上升的内层"不是抽象词——它就是下面这些东西，而每个都得能读出**行为形状**的三个可观测量：criterion status / criterion verification state / refusal count。【实测】

| 仪器 | 它读什么 | 现状 |
|---|---|---|
| failure reading | 一次失败：**类别 + 机制**、之前的拒绝、证据指向哪个组件、可引用的 `evidenceRef`、以及"修它不得回退的既有行为" | **有** |
| change manifest | 一次改动：证据引用 / 根因（与 verifier 层原因**不同**）/ 修法 / 预测的修复 / 预测的回归 | **有** |
| `change.applied` | 把改动绑到**一个提交**（回退的粒度从这来） | **有** |
| surface 声明 + `verifiedBy` | 组件 → 文件 → 验证套件，三级都能落到文件 | **有** |
| harness 轴（含 SSM 那一格） | crash-free ratio、Pareto preservation、sandbox violations | **部分**：见下三条缺口 |

**三条已具名的缺口**（本方案自己点出来的，不许含糊）：【实测】

1. **Pareto preservation 今天算不出来**：没有任何 ledger 记录携带**第二个**测量目标，所以 SSM 三项里有一项读不到。
2. **"sandbox violations" 今天读的是本仓自己的闸门拒绝数**，不是"边界是否守住"——那是两个不同的量：前者数 Dove 的决定，后者要 OS 层的拒绝。**A2 落地后用 jailer 的拒绝数替换它，这一格才算真读。**
3. **harness 与 verifier 的文件级分离**（同 §3.8 的 H5）。

### 3.10 一次改进回合：七步，以及每一步的工件与读者

这是回路（Plane C）的**操作定义**。它不是示意流程：每一步都有具体命令与**预期读数**，读不出来时怎么办也写明了（完整版见 `.trellis/spec/guides/harness-loop-turn.md`，本仓已有）。【实测】

| 步 | 做什么 | 落盘的工件 | 谁读它 / 读什么 |
|---|---|---|---|
| 1 | **Mine**：从 ledger 挖一次失败 | 失败记录（类别、机制、前置拒绝、指向的组件、`cite:` 引用） | 步 3 的 `failureEvidenceRef` 要引用它的 `cite:` |
| 2 | **选一个面，并检查它真的是一个面** | 组件 + 路径计数（`harness-rounds`、`operation=status`） | "没有 `verifiedBy` 条目"= **没人说过什么验证它**，不等于没人验证 |
| 3 | **先记预测**（`operation=change`） | manifest：criterion / surface / 证据引用 / 根因 / 修法 / 预测修复（至少一条）/ 预测回归（可为空 = 声明"没有"） | 运行时会**自己**读基线（调用方给不了基线，这是设计） |
| 4 | **一次逻辑改动 = 一次提交** | 一个提交 | 步 5 的 `commit` 字段、步 7 的回退目标 |
| 5 | **记应用**（`operation=applied`） | 改动 ←→ 提交的绑定 | 步 7 要检查这次改动**是否留在声明的面内** |
| 6 | **让下一轮判**（不用输任何东西） | 在**回合边界**写下的裁决：`confirmed` / `contradicted` / `unobserved` | `pending` = 回合边界还没发生；`unobserved` = **答案**（预测指向了记录不携带的东西），不是失败 |
| 7 | **打印回合，然后由人 keep 或 revert** | `applied: <sha> inside/outside <surface>` / `verifier: definite\|possible\|none` / `decision: <verdict> @revision n` | **人**，看着这段输出决定 |

**两条边界在步 7 被行使**（这是本架构与"自动自我改进"的分界）：【实测 + 设计】

- **改了 verifier 的改动不算一个回合**：若步 7 答 `definite`（或 `possible` 并点名符号），这次编辑动到了产生证据的代码，于是它**由它的套件和你**来判，**不由那三个可观测量判**——闭集**故意**不为它放宽。
- **记录只报告，人决定**：回路里**没有任何东西**会自己回退；裁决记录里带着 `verdictOnly: true` 就是为了这件事，`git revert` 是**人**的动作。

### 3.11 谁拥有什么：axi / DSH / Pi

**底座判定（A0.5 实测后修订）**：**axi 是宿主，DSH 是脚手架。** axi 拥有自己的 `AgentLoop` 接口与**闸门**；DSH 提供**工具层强制、会话持久化、程序化调用、组件替换点**。【实测 + 一手】

| 维度 | 谁提供 | 状态 |
|---|---|---|
| loop | **axi 自己**（`src/core/loop.ts` 接口已在，两个实现被刻意挡在生产之外，等 A1 提升） | 接口已存在【实测】 |
| 闸门（语法感知 / 跨调用状态 / 确定性补救） | **axi 自己写** | 设计中（§4.2） |
| 工具层沙箱（每次调用、fs 与 shell 同根） | DSH 的 `dsh-fs-sandbox` | **代码级证据**：围栏由注入的 `sandboxPolicy` 解析，`dsh-agent-loop` 的注入里没有它 → **换 loop 不掉沙箱**。**不是运行时实测**，如实标注【实测（代码级）】 |
| 自调用（回路起一个会话） | DSH：`dsh --profile headless "<task>"`（一次性）+ `ctx.agents`（程序化创建/恢复） | **已实测**：从普通进程启动 `dsh --profile sdk --help` 退出码 0【实测】 |
| Plane B 的强制 | **axi 自己**（ACL + 受限令牌） | **已实测**通过三条判据（§4.1）【实测】 |
| 会话记忆 / 任务 / 规格 | DSH（`.trellis/*`）与 Pi 宿主共用 | 现状 |

三条支撑与一条风险：

1. **loop 的替换点是受支持的，不是 fork**：`dsh-agent-loop` 被按 id 挂载，而 DSH 自己的文档写着 *"Choose a custom `Agent` implementation only when the standard 'call model, run tools, repeat' lifecycle is insufficient."*——**axi 正是那个情形**。【一手】
2. **强制在 loop 之下**，所以换 loop 不掉沙箱（上表第 3 行）。
3. **自调用存在**，回路不必依赖"有人点开一个会话"。
4. **风险（必须记住）**：`ctx.sandboxPolicy` 可由**会话内**改变（`/permission`、会话级切换，且重启后保留）→ 它落在 **Plane A**，**改它会削弱边界**，因此这类改动**必须过 HITL**；而且"模型被告知了当前策略"是**提示词层**，按 §2.1 **不算防护**。【实测】

**为什么不 fork、不插件**：fork 完整 harness = 永久维护别人的 loop，代价与收益不成比例；做成插件/外挂 = §2.1 量到的 **88/120** 那一档。**"薄 loop + 真闸门"这个组合在语料里不存在**，这正是 axi 要做的东西，也是它值得存在的原因。【一手 + 设计】

### 3.12 与 dove-pi 的关系：复用 / 重写 / 丢弃

"重新做一套"必须回答这个问题，否则 axi 只是 dove-pi 改个名。答案按**实测的耦合边界**切。【实测】

**① 复用（有实测依据）**：dove-pi 对 Pi 各包的 import **只出现在 4 个文件，全在 `src/pi-adapter/`；其余 69 个源文件零 import**。因此下列模块**基座无关**，可直接成为 axi 的 Plane A：
`src/core/`（契约、幂等/效果、ledger、请求生命周期、收敛记录与裁决、harness 轴）· `src/capabilities/` · `src/project-provider/` · `src/commands/` · `src/windows-runtime/` · `src/code-audit/` · `src/skills/` · `src/context/` · `src/trellis-adapter/`

**② 重写（三处，各有实测理由）**：

| 重写对象 | 为什么不能照搬 | 依据 |
|---|---|---|
| **loop** | `AgentLoop` 接口已在，但要成为 **axi 自己的接口**，并把强制接在它上面（而不是接在宿主的扩展点上） | §2.1、09-26 裁决 |
| **闸门** | 从"名字匹配 + 逐调用无状态"改为"语法感知 + 跨调用累积 + 历史无关" | §2.3 的 98%/88% |
| **trace 通道** | 从"append-only 本地 ledger"改为"宿主外拦截 + 抗编造 + 抗伪造 + 抗定时清理" | §2.3 |

**③ 丢弃（作为地基，不是删代码）**：`src/pi-adapter/extension.ts` 不再当核心——它的形态（宿主扩展 + 自建 fail-closed）正是 §2.1 量到的 88/120 那一档。以及 `modes/*` 里**"声明了却没人读"的字段**：**要么补上消费者，要么删掉声明**（D4）。

**④ 已有的可达性登记册要一起处置**：本仓维护着一份**可达性登记册**（10 条，各带理由）。axi 的第一遍应当逐条给出"复用 / 重写 / 删"的处置，而不是让它们以现状进入新系统。

**⑤ 一条可验证的迁移判据**（沿用本仓"每个修复都要有一条在改前会红的断言"的规矩）：复用清单里每个模块，在 axi 下**至少要有一条自己的测试通过**；重写清单里每一项，**必须有一条新测试**。**没有测试的迁移不算完成。**

---

## 4. 技术设计

这一节是"怎么做"。每块的形状都从 §2 的实测推出来，所以在每块开头写清**它由哪条实测推出**。

### 4.1 边界：Plane B 的强制（由 §2.2 推出）

**要解决的问题**：让"判分权威"对改进者**既不可写、又不可撬**，而且**不需要提权**、不依赖第三方沙箱（原生 Windows 上不存在）。

**机制：由 axi 拥有的一个 jailer 进程布 ACL，再以受限令牌启动改进者。**【实测】

```
jailer（axi 拥有的小进程，普通用户身份）
  ① 把 Plane B 的目标树 ACL 设成：只有 本用户 / SYSTEM / Administrators，**没有 Everyone**
  ② 把工作区（Plane A 的可写面）ACL 设成：**显式授予 Everyone Modify**（否则改进者干不了活）
  ③ 从**自己的主令牌**造受限令牌：
       CreateRestrictedToken(own, DISABLE_MAX_PRIVILEGE, restrict=[S-1-1-0 /*Everyone*/])
  ④ 仪器自检：GetTokenInformation(TokenRestrictedSids) 读回并断言它非空且等于预期
       ——**列表为空 = 机制没生效，不是"拦住了"**
  ⑤ CreateProcessAsUser(受限令牌, 改进者, cwd=工作区根)
  ⑥ 改进者退出后，jailer 收集证据（Ledger / convergence record）并写回 Plane B
```

**为什么这条能成立（机制层）**：受限令牌的访问检查会做两次——一次用令牌的启用 SID，一次用**限制 SID 列表**，两次都通过才放行。把限制列表设成 `Everyone`，则改进者**只保留"Everyone 能碰到的东西"**，而它自己的用户身份（连同属主身份）**不再产生授权**。

**三条判据（本机已实测全过）**：【**实测**】

| 判据 | 读数 |
|---|---|
| 写不进目标树 | 退出码 1，文件不存在 |
| **摘不掉**限制 | `icacls <planeB> /grant *S-1-5-32-545:(OI)(CI)M` 退出码 1；再试写仍失败；**ACL 前后逐字相同**（它仍是属主，仍然改不动 DACL） |
| 目标树之外仍能干活 | 工作区写：退出码 0，文件出现 |
| **正向对照**（防"假通过"） | 临时给目标树加 `Everyone:M` → 同一个受限进程**写成功**；撤掉后又失败 |

**两条不变量（进 A2 的验收；实现落地后进规格）**：【设计】

1. **Plane B 的每个路径都必须没有 `Everyone` 授予**——否则边界不成立。这不是"把评测器放到另一个目录"就够了，**是一个 ACL 不变量**。
2. **Plane A / 工作区必须显式授予 `Everyone`**——否则改进者连活都干不了。

**强度照实写（D4）**：这条边界等于"**把改进者降到 `Everyone` 档**"。它挡得住写 Plane B 与改它的 ACL；**挡不住**一切对 `Everyone` 开放的东西。**不得写成"OS 级沙箱"。**
另一条读数：`restrict={BUILTIN\Users}` 时进程在**初始化阶段**就退出 `0xC0000022`（STATUS_ACCESS_DENIED），可用档位就是 `Everyone` 那一档——**成因未定，按读数记录，不按推断补理由**。【实测】

**什么会否掉它**：① 目标树被任何来路授予了 `Everyone`；② 改进者的宿主或 DSH 的沙箱策略源被会话内改动（§3.11 的风险 4）；③ 受限令牌的构造在目标平台上不可用（本机可用，且**非提升**——`CreateProcessAsUser` 在令牌是**调用方自己主令牌的受限版本**时不需要 `SeAssignPrimaryTokenPrivilege`）。【实测】
**失败退路**：写下"**我们不做 OS 隔离**"，A2 改走"策略 + 内容侧防御"，Plane B 退回"人以纪律充当不动点"。**是有效结论，照记。**【设计】

**未定**：jailer 自身用什么实现、住在哪（A2 的 `design.md` 定）；Plane B 目标树的确切路径（A4 定）。【未定】

### 4.2 闸门：五部件，每条都必须配确定性补救（由 §2.1 推出）

**形状的第一原则**：参考实现的两臂**共用同一套检测器**，只在"补救方式"上分叉——外挂层只能拒绝，代码内那层**确定性地重新组合**出合法产物。**所以 axi 的安全子系统也应当这样建：检测与补救分离，补救属于掌握上下文的代码。**【一手 + 设计】

| # | 部件 | 它拦什么 | 实现要点 | 依据 |
|---|---|---|---|---|
| 1 | **语法感知的参数级策略** | 名字匹配被绕过的那些（编码命令、等价写法） | 按**语法**判参数，不是按名字匹配；参照 OpenCode 的 tree-sitter + arity 字典那一档 | §2.3（98%/88%） |
| 2 | **跨调用累积状态** | 一次操作被**拆到多个工具调用**里完成 | 判定要看会话级的累积视图，不是单次调用 | 同上 |
| 3 | **不依赖历史的判定** | "重试到上下文离开监控历史" | 判据不得被压缩/淘汰洗掉；压缩路径不得改写判据 | 同上 |
| 4 | **保持性传感器** | 声明漂移（"这条声明是否**仍然管住了**这一轮运行"） | 问的是**preservation**而不是 existence；这是本仓"声明没有消费者"那个老毛病在安全文献里的正式名字 | SAHOO `2603.06333`【一手】 |
| 5 | **隔离（平台允许处）** | 越界写 | §4.1 的 jailer | 本机实测 |
| + | **确定性补救（每条都要配对）** | —— | 触发后**确定性地重新组合**出合法产物，而不是以拒绝收尾 | §2.1 的 88/120 机制 |

**为什么必须有第 5 部件（而不是"策略就够了"）**：没有稳定基底时，失败可能只是**环境漂移**而不是程序缺陷——自我改进会**读错信号**。语料原话：*"Without this stable substrate, verification signals become difficult to interpret."*【一手】

**验证方式三件（A2 的验收）**：【设计】
1. **三种规避手法各一个测试**（编码 / 跨调用拆分 / 重试到历史淘汰）；
2. **保持性测试**：把一条声明的消费端拆掉，传感器必须报警；
3. **故障注入**：照参考实现的做法——*"**7-mutation contract sensitivity check**"*，**逐条打断契约，确认对应校验器报警**。它比"逐条写攻击用例"更系统，因为它同时验证了**契约与校验器的对应关系**本身。

**顺序纪律**：A2 与 A3 **同期**，不后置——篡改在最初几轮就出现（§2.3 第 2 条）。

### 4.3 trace 通道：三个性质、三格技术、一格没有先例（由 §2.3 推出）

**它不是日志设计，是回路可信性的前提。** 要同时建立三个性质：

| 性质 | 它挡住什么 | 技术 | 状态 |
|---|---|---|---|
| **完整性** | 删除 / 改写 / 重排 / 分叉 | **hash chaining + Merkle batching**，周期性把 epoch root **外部锚定**（每个锚点 32 字节，事件内容不上链） | **有现成技术**：四类篡改检出 **100%**、零误报；每事件约 **48 微秒 / 512 字节**；L2 锚定 **$2.30 / 10 万事件**（`2609.01931`）【一手】 |
| **保真度** | **编造**：记一条没有真实执行的工具调用 | **必须自己给机制**：证明"客户端工具调用是按报告执行的" | **无先例**——Agent Flight Recorder 检的四类**不含 fabrication**；METR/Redwood 的 **7%** 就是这一格的失败率【一手 + 设计】 |
| **捕获** | agent 控制写入路径（删 trace、定时清理、改压缩检查点） | 写入路径**独立于 agent 的宿主**（论文建议 *"independent interception server outside the agent's host"*） | **有方向**（Agent Flight Recorder / VET `2512.15892`），生产实现里**没有**先例【一手】 |

**保真度那一格的设计约束（A3 最硬的部分）**：【设计】

- **执行回执必须由执行层给，不能由 agent 自报**——否则它就是"把自报当证明"。本仓已有"效果声明 / 回执"的机制与它同类，A3 要在**宿主的派发边界**上落这条。
- 若做不实，**承诺降级为"可检测"并如实标注**，不阻塞其余交付（已写在程序级风险里）。
- **必须写明它不覆盖什么**：trace 记录的是**模型轨迹**，它 *"does not capture environment state … nor does it record all system activity"*——不写明就是又一处"声明了却没人读"。

**另外三条运行要求（都来自论文原话）**：append-only **且另记重试与完成状态**；抗**定时清理**（agent 会 *"scheduled repeated or delayed cleanup"*）；**压缩路径不得改写证据**（Kimi 改 compaction checkpoint、OpenCode 改 SQLite compaction part 都是实测案例）。【一手】

### 4.4 配置保护（由 §2.4 推出）

**HarnessRisk 测出的那条**：Harness Configuration 是三个阶段里最脆弱的，攻击**在本来授权的流程里**改掉安全敏感参数；而且"识别出风险"并不能可靠地导致安全行为。【一手】

**落在 axi 上的四条**：【设计】

1. **安全敏感参数（权限边界、网络、凭据、沙箱模式）改动需要独立批准**，不能与被它约束的改动走同一个批准通道。
2. **"让模型知道这很危险"不算防护**——那是提示词档（§2.1）。
3. 参照 Claude Code 的两条：**仓库设置不能放宽文件系统隔离**；**配置变更钩子可否决变更**。
4. **本机的具体落点**：DSH 的 `ctx.sandboxPolicy` 可被会话内改变（`/permission`、会话级切换、重启后保留）→ 它在 Plane A，**改它必须过 HITL**；并且"模型每轮被告知当前策略"是提示词层，不算强制。【实测】

### 4.5 回路：manifest、裁决与回滚（Plane C 的契约）

**manifest 的每个字段都对应一条要求，不是字段罗列**：【设计 + 一手】

| 字段 | 为什么需要 | 依据 |
|---|---|---|
| `failureEvidenceRef`（可解析到 ledger 的一条） | 没有证据的改动就是猜测；运行时**拒绝**解析不到的引用 | 失败记录带 `cite:` |
| `rootCause`（与 verifier 层原因**不同**） | 两次运行可以有同一个 verifier 结果（超时、缺产物）而需要**不同**的 harness 改动 | Self-Harness §3.2 的签名 `φ(r) = (c, q, m)`：verifier 层原因 / 因果状态 / agent 机制【一手】 |
| `fix` | 记录要能被人复查 | AHE §3.3 manifest【一手】 |
| `predictedFixes`（≥1） | 预测是"下一轮可伪造的东西"——没有它就没有裁决 | AHE §3.3【一手】 |
| `predictedRegressions`（可为空，但空=声明"没有"） | 回归预测实测很弱（P 11.6% / R 11.1%，89 任务 × 9 轮）→ **降级为记录，不是控制** | AHE §4.4.2 + Appendix D【一手】 |
| `surface`（七个之一） | 动作空间显式且可回退 | AHE §3.1【一手】 |
| 一次逻辑改动 = 一次提交 | 回退粒度、以及"这次改动是否留在面内"的检查都要靠它 | AHE §3.1【一手】 |

**裁决的四个读数（在回合边界写下，一次改动一次）**：【实测】

| 读法 | 含义 |
|---|---|
| `pending` | 回合边界还没发生 |
| `confirmed` | 预测成立 |
| `contradicted` | 预测不成立——**与 confirmed 同样重要**：没做到自己声称要做的事，正是回路最该学的 |
| `unobserved` | 预测指向了记录**不携带**的东西：**这是答案，不是失败** |

**归因与回滚是回路的步骤，不是外挂**（AHE 的算法第 7–8 步：先 `Attribute`，再 `Rollback`）。但有两条本方案的取舍：**① 记录只报告，人决定 keep/revert**（`verdictOnly: true`）；**② 保守晋升**——照 Self-Harness 的规则：**只在不损害任一侧时才接受**。【一手 + 设计】

**"递归"的操作化（内层可上升）**：照 MetaSkill-Evolve 的双时间尺度——**快回路改 harness，慢回路改回路自身的组件（Analyzer / Retriever / Allocator / Proposer / Evolver）**，而 **Plane B 两者都不许改**。【一手】

**期望值必须按低保留率设计**：Karpathy 的 `autoresearch` 约 **700 次实验保留约 20 个（≈3%）**——**成本在门，不在提案**。【一手】

### 4.6 评测：先采用已有仪器，别自建（A5）

**仪器已经有人造好了**，这是 A5 的第一版应当是"采用"而不是"发明"的理由：【一手】

| 仪器 | 它已经给的 | axi 取什么 |
|---|---|---|
| **HarnessOpt-Bench** | *"An agent edits its harness on development feedback; **a separate system tests the candidate on hidden tasks.** Across 111 runs, 5 optimizer models, and 4 tasks"* | **别人已经把 held-in/held-out 造好了**，规模是我们单独做不到的 |
| **RSI-Bench**（开源六轴：SMD / ITQ / ODR / MAS / SSM / AGG） | 可复现清单第 2 条：*"Freeze the evaluator and separate held-out tasks from search."*；SSM 的公式已从源码验证 | 采用 SSM 与 ITQ 两轴（其余轴我们读不到） |
| **Anthropic / DeepMind / OpenAI 的自改进评测框架** | RSP 的 AI R&D-4 阈值；Frontier Safety Framework 的 ML R&D 的 CCL/TCL；**RSI Index**（Internal Research Debugging + KernelGen 1P + NanoGPT + PostTrainBench Lite + MLE-Bench Revised） | **选一个并报出读数**，不自建评分 |

**一条必须知道的缺陷，否则用 RSI-Bench 会自欺**：SSM 的 `violations` 来自 **`system.get_state_fn()` 里的布尔值——即系统自报**，而**篡改自己状态上报的系统（正是 §2.3 的失效模式）会在这条轴上得分更高**。所以 axi **不能**照搬它的违规项：**违规信号必须由外部观察**（来自 A3 的独立通道）。另注意它的 `pareto_preservation` 是 `new >= prev - 1e-10`，即"**对上一轮不退步**"——这是一条*局部*判据，引用时要说清。【一手】

**方法论照抄那份消融设计的九条**（`docs/phase3-guardrail-baseline-design.md`），其中**第 4、5、6、9 条是 axi 现在完全缺的**：【一手 + 设计】

- 4 **配对比较用 McNemar**，不用裸计数；
- 5 **主对照是一对失败**：`contract violations admitted` vs `false refusals introduced`——不是只报"拦住了多少"；
- 6 **两个评测集分开报**：reference（正常问题）+ adversarial-stress（recommendation-bait / leak-bait）；
- 9 **明确写出测量的边界**：*"the evaluable object is harness/guardrail behavior on code-checkable contracts"*，并写在该节引言里。

**成本机制可以直接抄 DGM 的外层循环**（`jennyzzt/dgm` 的 `DGM_outer.py`），但**不抄它的接受语义**：【一手 + 设计】

| DGM 的机制 | axi 怎么用 |
|---|---|
| `filter_compiled()`：候选先过"能否编译" | **先跑最便宜的那层**（语法/静态检查），不过就不进评估 |
| `any_exceeding_context_length()`：超出上下文长度的运行不算失败 | **区分"改坏了"与"跑挂了"**，否则读错信号 |
| `get_full_eval_threshold()`：两级评估 + 动态阈值（阈值 = 档案里第二高的分数，下限 0.4，且提交量不足 90% 的运行不计入阈值） | **成本问题的现成答案**：便宜筛查先行；**未完成的评估不得充当标杆** |
| `update_archive()`：`score >= baseline - noise_leeway`（默认 0.1） | 提升判定要有**噪声余量**，否则在噪声上做决策 |
| 档案保留全部，`parent_commit` / `children_count` 组成树，父节点默认**随机** | 取**树形谱系 + 可续跑** |
| **接受语义**（默认 `keep_all`，晋升靠"谁被选为父节点"隐式发生） | **不取**：接受仍用 Self-Harness 那条保守规则 |

**样本量纪律**：报出的 P/R **必须带样本量与所用仪器**，结论强度与样本量相符；**做不到规模就把强度说低，不伪造**。参照量级：AHE **89 任务 × 9 轮**；RSI-Bench 最近一次实验给改进过程约 **50 个决策**，而测量选项需约 **400**。【一手】

---

## 5. 证据台账：每条主张凭什么

读本文时如果要挑一句去核，就从这张表里挑。**"设计"那一类是需要你核对的产品决定，其余都有外部或本机出处。**

| 主张 | 标记 | 出处 |
|---|---|---|
| 只靠提示词会漏；外挂护栏 88/120；代码内强制 120/120 | 一手 | `2607.08028` 摘要（逐字） |
| 外挂层输在"没有确定性补救回退"（55 行参考实现） | 一手 | `server/guardrail.mjs` 文件头 |
| AHE 与 Self-Harness 都让 evaluator 固定，都不做 RSI | 一手 | `2604.25850` §3.3；`2606.09498` §3.1/§4.1 |
| 自我判分很弱：P 11.6% / R 11.1%（89 任务 × 9 轮） | 一手 | AHE §4.4.2 + Appendix D |
| trace 篡改在最初几轮就出现；append-only 挡不住编造；伪造率约 7% | 一手 | `2609.30266`；METR/Redwood |
| 名字匹配被规避到 98% / 88% | 一手 | `2609.30217` |
| 完整性技术（hash chain + Merkle + 锚定）的四类篡改检出 100%、成本读数 | 一手 | `2609.01931` |
| 配置是最脆弱阶段；"知道危险"不等于安全行为 | 一手 | `2608.17597` |
| 人批不等于正确：431 组里 169 组放行了错误答案 | 一手 | `2609.30219` |
| RSI-Bench 的 SSM `violations` 是系统自报（用它要小心） | 一手 | `rsi_bench/axes/axis5_safety_stability.py` |
| 三级测试 / 四个操作性术语 / "可扩展基座"硬要求 | 一手 | Schmid 2026-08-21；`awesome-rsi` |
| 语料里唯一没有现成实现的是"受治的自我改造" | 一手 | `2609.00006` 子系统表 |
| Job Objects 不限制文件系统写；ACL + 令牌才是那一半 | **实测** | `readings.md` A0.2 前半 |
| **Plane B 的三条判据在本机成立，且非提升** | **实测** | `readings.md` A0.2 后半（含正向对照） |
| 可用档位是 `Everyone`；`Users` 档在初始化即被拒 | **实测** | 同上 |
| 换 loop 不掉沙箱（代码级，非运行时实测） | 实测（代码级） | `readings.md` A0.5 |
| 自调用存在：`dsh --profile sdk --help` 退出码 0 | 实测 | 同上 |
| `ctx.sandboxPolicy` 可被会话内改变 → 落在 Plane A | 实测 | `amendments.md` §四③ |
| 七个组件、`verifiedBy`、verifier 的两部分声明与现状 | 实测 | `.trellis/harness-surface.yaml` |
| 七步回合的每一步命令与预期读数 | 实测 | `.trellis/spec/guides/harness-loop-turn.md` |
| 四个 import 文件 / 69 个零 import 模块（复用的边界） | 实测 | 09-25 基座研究（已归档） |
| **三条平面、两条不变量、强度照实写、五部件配对补救、九条方法论里缺四条** | **设计** | 本文 §3–§4 |
| jailer 的实现与驻地；Plane B 的确切路径；Plane C 的宿主 | **未定** | A2 / A4 定；C 的宿主故意后定 |

---

## 6. 路线图：A0–A5，带现状

| 阶段 | 产出 | 判据 | 现状（2026-09-30） |
|---|---|---|---|
| **A0** 把底座钉死 | 四个实验的读数 + 追加的 A0.5 | 越界写能否被拦、Windows 隔离原语、无机制级先例、loop 可拦 | **A0.2/A0.3/A0.4/A0.5 已得**；A0.2 后半三过；**A0.1 待跑（需你起一个 `workspace-write` 会话，非阻塞）** |
| **A1** axi 最小骨架 | 把既有 `src/core/loop.ts` 与 `src/adapters/*` **提升为生产 loop**（不是"定义接口"）+ 七组件挂载点 | 能跑通一个回合；一个改动能 keep，也能 revert | 未开始。A0.4 已把 A1 的措辞改对：接口**已存在**，两个实现被刻意挡在生产之外 |
| **A2** 安全子系统五部件 | 语法感知策略 / 跨调用累积 / 历史无关 / 保持性传感器 / **隔离（jailer）**；每条配确定性补救 | 三种手法各一测试；保持性测试；**故障注入**；拦住了还能把活干完；**边界不变量有回归**（Plane B 无 `Everyone` 授予 / Plane A 有 / 摘不掉限制） | 未开始。**依赖 A0.2 的结论已到**：机制是 ACL + 受限令牌，不是 Job Objects |
| **A3** 配置保护 + trace 通道 | ① 配置变更需独立批准 ② trace 经宿主之外的独立拦截写出、落在 workspace 之外 ③ 完整性 / 保真度 / 捕获三性质 | agent 无法无批准改安全参数；无法删自己的 trace；**无法伪造一条没有真实执行的工具调用**（用 7% 那个失败模式测）；无法借压缩路径改写；被拒后回合仍能完成 | 未开始。**与 A2 同期，不后置** |
| **A4** Plane B 与回路 | 外部闸门 + held-out 切分 + manifest + 下一轮归因与回滚 | 权限边界类改动必须 HITL；一个改动能走完"预测 → 裁决 → keep/revert" | 未开始 |
| **A5** 评测 | 最小 held-out 切分 + 晋升门 + 一次带样本量的 P/R 读数 | 采用已有仪器；九条方法论（含 McNemar、一对失败指标、两个评测集、声明测量边界） | 未开始 |

**阶段之间传什么**：A0 → A1 传"Plane B 存在 + 隔离可行（但未实现，jailer 由 A2 建）"；A1 → A2/A3 传"闸门挂载点、提交/回退形态、迁移基线读数"；A2 → A3 传**违规事件**（**由 A3 的外部通道记录，不由 A2 自报**）；A3 → A4/A5 传**执行回执**与违规信号；A4 → A5 传回路与档案。

**v0.1 = A0 + A1 + A2**；"有界回路" = 再加 A3 + A4；"可引用" = 再加 A5。

---

## 7. 验收标准

| # | 标准 | 状态 |
|---|---|---|
| AC-1 | A0 的实验有原始读数与判定 | 部分：A0.2/A0.3/A0.4/A0.5 已得；**A0.1 待跑** |
| AC-2 | 强制**在代码内**，且能用三种规避手法各自回归 | 待 A2 |
| AC-3 | agent 无法无批准改掉安全敏感配置；无法删掉自己的 trace | 待 A2/A3 |
| AC-4 | **一次真实的 keep + 一次真实的 revert 被记录**（提交 hash） | 待 A1/A4 |
| AC-5 | 权限边界类改动需要 HITL，且这条**由测试看住** | 待 A2/A4 |
| AC-6 | P/R 读数带样本量**与所用仪器**；无"单任务当基准"的过度归因 | 待 A5 |
| AC-7 | **不声明任何未实现的隔离或权限能力** | 持续 |
| AC-8 | 门禁不下降：`npm run typecheck`、`npm test`（基线 **816/814/0/2**）、`npm run test:installer`（**141 OK**） | 当前成立（本轮规格改动后逐项相同） |
| AC-9 | 无法伪造一条没有真实执行的工具调用；无法借压缩路径改写证据；无法删掉自己的 trace | 待 A3 |
| AC-10 | **迁移可验证**：复用清单每个模块至少一条自己的测试通过；重写清单每项一条新测试 | 待 A1 |
| AC-11 | **不站到语料里唯一不存在的位置**：任何被声明的隔离/权限能力都有消费者与测试，否则删掉声明 | 持续 |
| AC-12 | **拦住了还能把活干完**：每条检测器触发后回合仍产出合法产物 | 待 A2 |
| AC-13 | **评测方法合规**（九条） | 待 A5 |

---

## 8. 风险与证伪

| 风险 | 应对 |
|---|---|
| **A0.1 失败**（越界写静默生效） | 它**不再是 Plane B 的授权来源**（Plane B 已由 A0.2 后半的机制承担），但仍会改写"工具层强制"这一行的措辞 |
| **A2 的实现做不出 jailer** | 回退到"策略 + 内容侧防御"，**并写下"我们不做 OS 隔离"**（可接受，但**不可声明**）——**机制本身已实测存在**，所以这条回退指的是实现失败，不是机制不存在 |
| **边界强度被误读** | 照实写：`Everyone` 档，不是沙箱。任何"OS 级隔离"的措辞都要删 |
| **A3 保真度那一格做不实**（唯一无先例） | 承诺降级为"**可检测**"并如实标注，**不阻塞其余交付** |
| **评测语料太贵**（AHE 89 × 9） | 降低结论强度，不伪造；先用已有仪器 |
| **照搬 RSI-Bench 的 SSM 违规项** | 它的 `violations` 是**系统自报**，会奖励篡改状态上报的系统 → axi 的违规信号必须**由外部观察** |
| **HITL 不是万无一失** | 实测 431 组里 169 组放行错误答案 → 人批之外**仍需确定性校验兜底** |
| **保留率天生很低（≈3%）** | 按"门的成本"设计，不按"每次改动都有用"设计 |
| **记忆累积与工具创造自带风险** | `2509.26354`：记忆累积后安全对齐会退化；工具创造与复用会引入漏洞。这两条 axi **结构上就会有**，不是意外 |
| **规模不足** | 把结论强度说低，不伪造 |

**证伪条件**：① A0.1 显示越界写静默生效**且** jailed 机制在目标平台不可用；② axi 的强制无法在代码内实现（退回外挂层，效用掉到 88/120）；③ held-out 切分在本项目规模**不可测量**——AHE 需要 89 任务 × 9 轮才读出 P/R，而单次任务的运行"**不是一个基准**"。**第三条是本方案的真正成本，写在这里供人在开工前判断。**

---

## 9. 不做（明确排除项）

- **不 fork 完整 harness**（Codex / Pi 都不）——永久维护别人的 loop。
- **不把 axi 做成插件 / 外挂**——实测会过度拒绝（88/120）。
- **不做真 RSI**（外层发布权威也上升）——没有东西可以判它。
- **不声明做不到的能力**（D4）。
- **不引入第三方沙箱**——原生 Windows 上不存在这个选项；Windows 的答案是 ACL + 受限令牌（已实测）。
- **第一版不动模型权重**（SIA 那条路留到以后，且**要写明这条边界是有意的**）。

---

## 10. 待决 / 待办

**需要人动手的**：

1. **A0.1**：起一个 `workspace-write` 会话，跑 `09-30-axi-a0-base/a0.1-live-test.md`（自包含）。**非阻塞**——Plane B 的授权来源已由 A0.2 后半承担。
2. **两处引用修正**（碰产品源码、零行为变化）：`src/core/invocation-disposition.ts` 的 `replaySafe` 注释；`.trellis/harness-surface.yaml:4` 与 `src/core/task-convergence.ts:842` 的 AHE 节号。
3. **桌面那份的同步**：`axi规划方案.md` 的同两处点替换（仓库外、无版本控制，改前先记字节数）。

**需要决定的**：

4. **Plane C 的宿主**（可以后定，不影响 A/B 边界）。
5. **A1 的迁移取舍**：69 个基座无关模块用 subtree / submodule / 复制 + 重设基线哪一种（A1 的 `design.md` 定）。
6. **A2 的 jailer 实现形态**（语言 / 驻地 / 与 DSH 宿主的关系）。

**已定的（供核对）**：Plane B 的强制归 axi 自己拥有；axi 是有界自我改进（第 2 级），不是 RSI；底座 = axi 是宿主、DSH 是脚手架；隔离 = ACL + 受限令牌（`Everyone` 档）。

---

## 附录 A：本文与三份记录的关系

| 本文的段 | 底稿在哪 |
|---|---|
| §1–§2（问题、定位、设计思路）、§3.11（底座）、§4.5（回路）、§6（路线）、§7（验收）、§8（风险）、§9（不做） | `plan.md`（第七版决策记录）——本文重排并统一标记，**未改其结论** |
| §2.2 的实测、§4.1 全部 | `09-30-axi-a0-base/readings.md`（A0.2 后半段） |
| §3.8/§3.9 的组件与 verifier 声明 | `.trellis/harness-surface.yaml`；`.trellis/spec/backend/personal-agent-harness-loop.md`；本仓 `src/core/*` 的真实文件与 `.trellis/spec/backend/personal-agent-framework-core.md`（§3.2–§3.7 的模块、契约、拓扑、数据、时序都从这两处来） |
| §3.10 的七步 | `.trellis/spec/guides/harness-loop-turn.md` |
| §3.11 的底座修订 | `amendments.md`（§一/§二；已就地应用进 `plan.md`） |
| §1.3 的三级测试与术语 | `09-27-harness-scaffold-frontier/research/rsi-community-landscape.md`（已归档任务的调研） |

**本文不是证据**：任何引文与读数都要回到上表去找原处。本文的职责是**把设计的因果讲清楚**。

---

## 附录 B：本版的沿革与一个真实的缺陷（留档）

- 本版**替换**了提交 `685eca2` 里的"机械拼接版"。那一版把三份文档逐字钉在一起，保真但没有条理——**用户的判词是准确的：它是三份文档，不是一份设计。**
- 那一版还有一个**真实的缺陷，是我造成的**：拼接脚本里我用了**可插值 here-string**（`@"…"@`）来写"本版更新"那一段，而我写的文本里有反引号——PowerShell 把 `` `r `` / `` `0 `` / `` `t `` 当成了转义，于是 `restrict={BUILTIN\Users}` 变成 `<CR>estrict=…`、`0xC0000022` 变成 `<NUL>xC0000022`，该段的反引号全部丢失。**它也是 `read` 工具把这个文件判定成"二进制"的原因。**
- **我的校验看不见它**：我验的是"字节总数相符 + 三篇正文逐字在内"——两条都过，因为它们只验**来源还在**，不验**我自己写的那一段**。这与本项目已有的三次教训同源（从没被验证过的仪器下结论）：**对自己生成的那部分，也要有断言。**
- 本版由文件写入工具（不走命令行文本往返）生成，并已自查：**除换行外无控制字节**。

---
