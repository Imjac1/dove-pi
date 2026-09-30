# A5：接入已有评测仪器并报出读数

## Goal

让 axi 的每次改进可被**可引用地**判断：**先采用已有仪器**（不自建评分），并按九条方法论把"一次改动是否成立"变成可复现的读数。

来源：`plan.md` §4.2 A5。

## Background

- **仪器已经存在**：**HarnessOpt-Bench**（*"an agent edits its harness on development feedback; **a separate system tests the candidate on hidden tasks**"*，111 次运行 × 5 优化模型 × 4 任务）；**RSI-Bench**（六轴，可复现清单第 2 条即评测器冻结 + held-out 与搜索分离）；**前沿实验室框架**（Anthropic 的 AI R&D-4、DeepMind FSF 的 ML R&D CCL/TCL、OpenAI 的 RSI Index）。
- 可跑的开源基准：**PostTrainBench**、**LongWoF-Bench**（778 个机器可验证的长工作流任务）、**RSIBench-Data**、**AutoLab**、**MLS-Bench**；**PAST-Bench** 提供反向先验（*"in many scenarios, turning memory on does not help"*）。
- **SSM 轴公式已取到源码**，但 `violations` 来自 `system.get_state_fn()` 的 `sandbox_violation`——**系统自报**，会**奖励篡改状态上报的系统** → axi 的违规信号必须来自 **A3 的外部观察**。其 `pareto_preservation` 是"**对上一轮**不退步"，属**局部**判据，引用时要说清。
- **DGM 的成本机制可直接抄**：`filter_compiled` 预闸门；`get_full_eval_threshold`（阈值 = 档案**第二高分**、下限 0.4、**提交量不足 90% 不计入**）；`noise_leeway` 余量；树形档案与可续跑。
- 语料把"统一评测框架"列为**未来工作**，但前沿实验室**已发布** → 采用时要说明这一点。
- 规模参照：AHE **89 任务 × 9 轮**读出 P 11.6% / R 11.1%；RSI-Bench 最近一次给改进过程约 **50 个决策**，而测量选项需约 **400**。

## Requirements

- **R1** 选一个已有仪器并报出读数；**不自建评分**。
- **R2 九条方法论**：① 先冻结设计再写代码；② 冻结 schema（含 **false-refusal 的定义**）作为前置步；③ 三条对照（`harness` = 代码内闸门 + 确定性回退 / `prompt-only` / `external-guardrail`）；④ 配对比较用 **McNemar**；⑤ 主对照含 *"contract violations admitted"* 与 *"false refusals introduced"* **一对失败**；⑥ 正常集与对抗集**分开报**；⑦ 输出写**新的带日期文件**、**绝不覆盖已提交工件**；⑧ 度量**代码可查**；⑨ 在引言里**声明测量边界**（evaluable object 是 code-checkable contracts 上的行为，不是领域质量）。
- **R3** 违规信号来自 **A3 的外部观察**，不用自报。
- **R4** 接受判定带**噪声余量**；便宜筛查先行，完整评估只给有希望的候选；**未完成的评估不得充当标杆**。

## Acceptance Criteria

- **AC-1** 报出的 P/R **带样本量与所用仪器**，结论强度与样本量相符。
- **AC-2** 配对比较用 **McNemar**，且报告含**"误拒"那一侧**。
- **AC-3** 正常集与对抗集**分开报**。
- **AC-4** 每次运行写**新的带日期文件**，**已提交工件不被覆盖**。
- **AC-5** 引言里明确写出测量**不覆盖**什么。
- **AC-6** 做不到规模时**把强度说低，不伪造**。

## Out of Scope

- 自建基准或评分器；把结果读成模型质量或领域质量。

## Key Decisions / 依赖

- 依赖 **A4**（要先有回路，才谈得上评测它）。

## Open Questions

（无。）
