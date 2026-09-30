# Design — 不动点放在改进者写不到的地方：基座裁决与三平面架构

## 1. 一句话

**不动点不靠声明，靠几何 + 文件策略。** 改进者在自己的 workspace 里写；**评测器与权限源在 workspace 之外**，由沙箱策略在 OS/ACL 层拒绝写入。
**Pi 提供不了这个"外面"；DSH 有"外面"，但当前是 `danger-full-access`（外面也没被保护）。** 所以第一件事不是选基座，是**验证 DSH 的策略真的会拒写**。

## 2. 决定性事实：两个基座的判定差异（均为实测，非推断）

| # | 要求 | Pi（vendored 0.84.3） | DSH（本安装） |
|---|---|---|---|
| 1 | 文件级可编辑面 | PROVIDED — 扩展是 `cwd/.pi/extensions` 下被发现的普通文件（`loader.js:624-626`）；skill 是 `SKILL.md` | PROVIDED，**但只有 2/7 被真正消费**：7 个声明组件里只有 `system-prompt`（`AGENTS.md`）与 `skill`（`.agents/skills/**`）被 DSH 从本仓库读取 |
| 2 | 自身回合的证据 | PROVIDED（原始记录；归属/裁决是 Dove 的） | **PROVIDED（写了）/ 消费者未建**：会话落 `session.v4.jsonl.zstd`，但运行时自述"hook 脚本读不了"（`dsh-hooks-codex/README.md:87,176`），全文检索被挂成 `openAt: never`（`dsh-base/cordis.patch.yml:129-133`），且**仓库里没有任何读 DSH 回合的消费者**（`trellis-session-insight/SKILL.md:19` 只列 Claude/Codex/Pi/ZCode） |
| 3 | 到达循环决策点 | PROVIDED，两处具名缺口（`shouldStopAfterTurn`/`prepareNextTurn` **无扩展事件**） | **MUST BUILD**：缝是有的（`agent/session-start`、`agent/pre-step`、`tools/pre-execute`、`tools/post-execute`、`agent/turn-stopping`），桥也装了，**但没有任何 patch 行挂载它**；且桥只支持 5 个事件，仓库注册的 `SubagentStart` **被静默丢弃**，`session-start.py` 无注册项。**`agent_task_convergence` 是 Pi 宿主工具，不在 DSH 工具目录里** |
| 4 | 应用与回退 | DOVE MUST BUILD（回退 Pi 完全不给） | PROVIDED —— 靠 git（一次逻辑改动 = 一次提交，`git revert`），**不是因为基座支持** |
| 5 | **evaluator 不可被改进者编辑** | **CANNOT** —— 扩展 hook 本身就是磁盘文件（`loader.js:624-626`），能改文件的 agent 就能改自己的闸门；无 permission hook；无路径限制原语；allow/deny 只是 session 构造参数 | **MUST BUILD（已声明、未强制）** —— `verifier.paths` 把评测器**点到了文件**，但没有任何东西约束它；`dsh-sandbox-policy` 按模式约束**一个 workspace 根**，而不是一个路径集（README:147）；本会话 `danger-full-access`，**`$DSH_HOME` 可写** |

**两张表最关键的一格差异**：第 5 条在 Pi 上是 **CANNOT（结构上没有外面）**，在 DSH 上是 **MUST BUILD（有外面，只是没保护）**。
这就是基座问题的答案：**要 RSI 的有界形态，只有一个候选能承载它**。

**顺带解释了一个长期现象**：196/228 个会话跑在 DSH 里，而自我改进的证据链（ledger、axis、failure reading、convergence）**整条长在 Pi 上**。§2 第 2、3 行就是原因——不是选择，是**没人把 DSH 侧的缝接上**。

## 3. 三平面架构

```
┌─ Plane B：固定（改进者写不到）──────────────────────────────┐
│  held-out 评测器 + 权限源                                   │
│  位置：Plane A 的 workspace 根之外（另一个目录/仓库）        │
│  强制：文件策略模式（workspace-write）→ OS/ACL 拒写          │
│  最外层：人的 keep/revert（与现裁决一致）                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ 读裁决（人可读，机可读）
┌─ Plane C：循环（编排者）──┴──────────────────────────────────┐
│  跑一个改进回合：mine → 选面 → 先记预测 → 一次提交 → 记 applied │
│  → 让下一回合判 → 打印，再由人 keep/revert                    │
│  不变量：任何情况下不让 Plane A 写 Plane B                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ 一次逻辑改动 = 一次提交
┌─ Plane A：可改（改进者自己的）──────────────────────────────┐
│  本仓库：产品（src/…）+ **内层**仪器（harness-axes / failure-  │
│  reading / harness-round / harness-corpus / ledger / verifier）│
│  改这里的代价：一次提交；回退：git revert                     │
└─────────────────────────────────────────────────────────────┘
```

**RSI 的"递归"发生在哪里，这是全部要点**：
- **内层 verifier 在 Plane A 里，可改** —— 这才叫递归自我改进；
- **外层评测器在 Plane B，不可改** —— 这才是"有界"。Plane A 可以改自己的判分方式，但**改不了谁最终判它**。
- 若 B 也可改，就不是 RSI 而是无界自我修改：AHE 自测 P 11.6% / R 11.1%（9 轮）说明自我判分本身很弱，把它当唯一裁判等于放弃有界性。

## 4. 为什么这不是"迁移到 DSH"

- **09-26 的裁决不受影响，而且正是它让这件事成立**：框架自己拥有 `AgentLoop` 接口，`pi-agent-core` 的 thin `Agent` 只是 adapter 之一，反转成本 = 一个 adapter 实现。三平面架构**不要求换掉任何现有 adapter**。
- **Pi 继续做产品宿主**：闸门、effect claim、ledger、诊断都已实现且已测（`src/pi-adapter/extension.ts` 的 18 个子订阅，其中 8 个是控制点）。
- **新增的是 Plane B 这个组件**，不是一次基座迁移。DSH 是它的**宿主候选**，因为它是唯一存在"外面"的候选；Plane C 的宿主可以后定（它只需要能跑一个回合并把结果落成文件）。
- 因此基座问题的答案不是"选 Pi 还是选 DSH"，而是：**循环的基座保持 dove 自己的接口；评测器的基座必须在 dove 写不到的地方，而 Pi 结构上给不了。**

## 5. 必须先验的前置：实验 0（它决定架构成不成立）

**问题**：DSH 的 `workspace-write` 策略是否**真的拒绝**对 workspace 之外的写入？
**为什么它决定一切**：Plane B 的全部强制力来自这一条。研究方明确写了它**没测**这一条——"I did not attempt a denied write to verify either the assertion or its enforcement boundary"——而本会话是 `danger-full-access`。
**旁证（支持策略真实存在且会拒写）**：本安装带 `diagnose-windows-sandbox-acl` skill，用途正是"诊断意外的 DSH 沙箱拒绝"，并由 `dsh-fs-sandbox` / `dsh-pwsh-sandbox` / `dsh-sandbox-windows-acl` 三个包提供机制；profile 里三档模式 `read-only` / `workspace-write` / `danger-full-access` 是配置行（`profiles/desktop/cordis.patch.yml:13-26`）。

**判据（三个都要，缺一不算）**：
1. `workspace-write` 下对 workspace 之外的路径写一次 → **必须被拒**；
2. 同一模式下对 workspace 之内的路径写一次 → **必须成功**（否则策略不可用，不是安全而是坏掉）；
3. 被拒之后该会话**仍能完成一个回合**（拒绝不得把循环打死）。

**若实验 0 失败**（策略不拒写或不可用）：Plane B 不成立，架构退回"人以纪律充当不动点"——即回到现裁决，RSI 降级为有界自我改进。这不是失败，是**测出来的结论**，并且它本身就是一条可发表的读数。

## 6. 与既有契约的接口（不新造词汇）

| 既有契约 | 本架构如何满足 |
|---|---|
| H1 verifier 在循环之外；拒绝递归自我改进 | 用**目录边界 + 策略**把它从"人读"变成"机制拒"；内层可改、外层不可改 = 有界 RSI，而非被拒的那条轴 |
| H5（`tool-implementation` 绑定整个 `src`，harness 与 verifier 混在一起，"只能靠人读"） | **这正是本架构要修的那一条**：Plane A/B 的边界把"这是不是 verifier 改动"从读者判断变成**跨不跨目录** |
| H3 可回退 | 不变：一次逻辑改动 = 一次提交，回退 = `git revert` |
| H4 七步回合 | 不变，Plane C 只是它的编排者 |
| AC-7 不新增运行时持久化格式 | Plane B 是**文件 + 策略**，不是新格式 |
| 审计 D-B（不把工作流闸门变成安全边界） | 不冲突：Plane B 不是闸门，它是**评测器**；闸门仍在产品侧 |

## 7. 待并入（不改变第一步）

两路外部调研未回：AHE / Self-Harness / SSM 三篇的原始要求，以及同类实践（Claude Code / Codex）。
它们可能**修订 §2 的措辞或 §3 的边界**，但不会改变 **§5 是第一步**——因为 §5 验的是本安装的实际行为，不是文献的主张。

## 8. 不做

- 不迁移、不改产品代码、不写实现（本任务是调研 + 架构）。
- 不把工作流闸门变成安全边界（审计 D-B 已排除）。
- 不引入 OS 沙箱之外的第三方沙箱（审计 C2：原生 Windows 不支持）。
