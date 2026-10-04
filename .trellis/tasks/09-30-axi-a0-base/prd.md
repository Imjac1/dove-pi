# A0：把底座钉死——DSH 隔离可用性、Windows 隔离原语、确认无机制级先例

## Goal

在**不写任何产品代码**的前提下，用四个实验确定 axi 的底座能否成立：Plane B 有没有依托（越界写能不能被拦住）、Windows 上有没有可用的 OS 级隔离原语、以及"没有机制级 trace 完整性先例"这一判断是否成立。

这一阶段的价值在于**它可能否掉整个方案**：如果越界写静默生效、且 Job Objects 也做不到，那么"判分权威在 agent 写不到的地方"就不成立，方案退回"人以纪律充当不动点"。所以它排在所有实现之前。

来源：`plan.md` §4.2 A0。

## Background

- Plane B 的前提是"存在一个改进者写不到的地方"。**本机 DSH 的强制力从未测过。**
- `workspace-write` 预设带 `approval: ask`（会弹窗）；无人值守形态需要 `sandbox: workspace-write` + `approval: never`，**出厂预设没有这个组合**。
- Windows 上唯一靠谱的 OS 级隔离原语是 **Job Objects / restricted tokens**（语料对 Omnigent 的记录：bubblewrap+seccomp / Seatbelt / Job Objects）。
- `2609.30266` 里"最安全"的 Muse Code 的机制是**提示词档的 skill 提醒**——需要确认整个被测群体里没有机制级实现。
- 本仓已有读数可复用：`pi-agent-core` 的 `Agent` 曾在编译产物里成功拦截（`toolExecuted 1 → 0`）。

## Requirements

- **R1（A0.1）DSH 隔离可用性**：在一个 `workspace-write` 会话里测越界写是否静默生效。
- **R2（A0.2）Windows 隔离原语**：测 Job Objects / restricted tokens 能否让"一个目录树对某进程不可写"成立。
- **R3（A0.3）确认无机制级先例**：核对 `2609.30266` 及相关材料，确认被测 harness 里没有机制级 trace 完整性实现。
- **R4（A0.4）thin loop 复核**：`pi-agent-core` 的 `Agent` 是否仍能在编译产物里拦截；`AgentHarness`（声明了 `HarnessTool.replay` 的那层）是否仍是 stub。
- **R5 只做测量**：本阶段不改任何产品代码；**失败也要照记读数**。
- **R6（A0.5，执行中追加，见 `amendments.md` §五）宿主与 loop 可替换性**：axi 能不能自调用（起一个无头/SDK 会话）、换掉 `Agent` 后围栏还在不在、`ctx.sandboxPolicy` 归谁设定。三条都有答案。依据：`readings.md` 的 A0.5 段。

## Acceptance Criteria

- [ ] **AC-1（A0.1，三条全过才叫过）**：① 越界写**不得静默生效**——**拒绝或升级为审批都算过**；② 界内写**静默成功且删得掉**；③ 被拒之后**回合仍能完成**。弹窗不算失败。
- [ ] **AC-2（A0.2）**：受 Job Objects 约束的进程**确实写不进目标树**，且仍能正常完成一个回合（不得把循环打死）。
- [ ] **AC-3（A0.3）**：给出结论（有/无机制级先例）与依据来源；若发现先例，记录下来并重新评估 A3 的原创性定位。
- [ ] **AC-4（A0.4）**：给出 `Agent` 拦截能力与 `AgentHarness` 状态的当前读数，附实测方式。
- [ ] **AC-5** 四个实验的原始读数与判定都写回本任务，**包括失败**。
- [ ] **AC-6（A0.5）** 三条（自调用 / 换 loop 后围栏仍在 / 策略源归属）各有判定，且**区分"实测"与"代码-文档级证据"**——A0.5② 属于后者，已在 `readings.md` 逐条标注。

## Out of Scope

- 任何产品代码（loop、闸门、trace 通道的实现分别在 A1–A3）。
- 修改本机 DSH 的配置——A0.1 要**用户自己**起 `workspace-write` 会话。

## Key Decisions / 依赖

- **A0.1 需要用户执行**：让会话跑在 `workspace-write` 下是会话级选择，agent 从会话内部改不了自己。
- A0 的结论是 A1–A3 的输入：AC-1 失败 → Plane B 不成立，退回"人当不动点"；AC-2 失败 → 明确选"策略 + 内容侧防御"，并**写下"我们没有 OS 隔离"**（可接受，但不可声明）。

## Open Questions

（无阻塞项——A0.1 的用户执行是前置条件，不是待决问题。）

## 已裁决（本轮追加，2026-09-30）

**OQ-1 已裁决：Plane B 的强制力由 axi 自己拥有。** 先验 **(a) ACL + 受限令牌**这条 axi 自有的路径；(b) DSH 的 `workspace-write`（A0.1）退为"工具层强制"的读数，**不作为 Plane B 的授权来源**。两条路径**不是同一个量**（下表是裁决时的依据）：

| 路径 | 测的是 | 现状 |
|---|---|---|
| **(a) axi 自己拥有**：ACL + 受限令牌（一个由 axi 拥有的 jailer，改进者跑在受限令牌下） | **改进者这个进程本身**能不能越界写、能不能摘掉那条 deny | 机制已实测存在：deny ACE 挡得住另一个进程、**非提升会话也能起受限进程**（`CreateProcessAsUser` 返回 True/0）；**只差"受限进程摘不掉 deny"这一步未测**（`readings.md` A0.2 结论 1/3 与"未测"段） |
| **(b) DSH 的 `workspace-write` 策略**（A0.1） | **DSH 的工具调用路径**会不会拦越界写 | **未测**（会话必须是 `workspace-write`）；且 A0.5③ 已实测 `ctx.sandboxPolicy` 可被**会话内**改变（`/permission`、会话级切换，且**重启后保留**）→ 该策略源**落在 Plane A**（`amendments.md` §四③） |

**这条裁决影响什么**：Plane B 的权威写在哪份工件里、`harness-loop.md:20-29` 那半句怎么改、以及 axi **要**自带一段 Windows 隔离机制（新增产品面与维护成本，已确定接受）。

**命名一致性（下游，随 OQ-1 一起改）**：`harness-loop.md:20-29` 写"recursive self-improvement 是本项目明确拒绝的轴"；`framework.md` §3 与 `substrate-choice/design.md` §3 的架构是"**内层可上升、外层不可改**"，`design.md` §6 把它称作"有界 RSI"；而 `plan.md` §0.2 与程序任务 `prd.md` 的 R3 又叫"**第 2 级有界自我改进，不是 RSI**"。**同一个架构三个名字**，而纪律 4 是"不声明任何未实现的能力"——所以措辞要**等 Plane B 的读数落定再改**，否则就站到了语料里唯一不存在的位置（声明了隔离却什么都没实现）。
