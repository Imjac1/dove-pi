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

## Acceptance Criteria

- **AC-1（A0.1，三条全过才叫过）**：① 越界写**不得静默生效**——**拒绝或升级为审批都算过**；② 界内写**静默成功且删得掉**；③ 被拒之后**回合仍能完成**。弹窗不算失败。
- **AC-2（A0.2）**：受 Job Objects 约束的进程**确实写不进目标树**，且仍能正常完成一个回合（不得把循环打死）。
- **AC-3（A0.3）**：给出结论（有/无机制级先例）与依据来源；若发现先例，记录下来并重新评估 A3 的原创性定位。
- **AC-4（A0.4）**：给出 `Agent` 拦截能力与 `AgentHarness` 状态的当前读数，附实测方式。
- **AC-5** 四个实验的原始读数与判定都写回本任务，**包括失败**。

## Out of Scope

- 任何产品代码（loop、闸门、trace 通道的实现分别在 A1–A3）。
- 修改本机 DSH 的配置——A0.1 要**用户自己**起 `workspace-write` 会话。

## Key Decisions / 依赖

- **A0.1 需要用户执行**：让会话跑在 `workspace-write` 下是会话级选择，agent 从会话内部改不了自己。
- A0 的结论是 A1–A3 的输入：AC-1 失败 → Plane B 不成立，退回"人当不动点"；AC-2 失败 → 明确选"策略 + 内容侧防御"，并**写下"我们没有 OS 隔离"**（可接受，但不可声明）。

## Open Questions

（无阻塞项——A0.1 的用户执行是前置条件，不是待决问题。）
