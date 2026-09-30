# A5 执行清单

## 顺序

1. [ ] **先冻结设计**（照九条第 ① 条）：把条件、指标、判据写下来再动手——本文件即冻结件，后续改动要另外记录。
2. [ ] **冻结 schema**（第 ② 条）：allow/block 规则、**false-refusal 定义**、决策常量、结果 JSON schema。
3. [ ] **选仪器并记录理由**：HarnessOpt-Bench 形状 + RSI-Bench 轴 + 一个前沿实验室框架作参照（决策 1）。
4. [ ] **选候选任务集**：机器可验证、规模可承担（PostTrainBench / LongWoF-Bench / MLS-Bench 任一）。
5. [ ] **建 held-in / held-out 切分**；held-out 放在 Plane B（A4 看住不可读）。
6. [ ] **三条对照实现为可切换条件**：`harness` / `prompt-only` / `external-guardrail`（后者**无确定性补救**）。
7. [ ] **两个评测集**：正常集 + 对抗集（recommendation-bait / leak-bait 类），**分开报**。
8. [ ] **指标**：contract violations admitted；**false refusals introduced**；其余照九条第 ⑧（代码可查）。
9. [ ] **McNemar 配对检验**（model × scenario × repeat 配对）。
10. [ ] **违规信号接到 A3 的外部观察**，**不用** SSM 的自报项。
11. [ ] **成本机制**：预闸门 → 两级评估（第二高分 / 下限 0.4 / 不足 90% 不计入）→ 噪声余量。
12. [ ] **输出纪律**：新的带日期文件；**绝不覆盖已提交工件**；只有打算作为可引用快照的运行才提交（并 bump VERSION + CHANGELOG）。
13. [ ] **在结果开头写边界声明**（决策 5）。

## 验证

- `npm run typecheck` / `npm test` 数字不下降
- 三条对照可切换，且 `external-guardrail` 那一臂确认**没有**确定性补救（否则对照失效）
- 一次完整运行产出：正常集 / 对抗集分开的读数 + McNemar 结果 + 误拒数
- 输出文件带日期，且 `git status` 显示**没有已提交工件被覆盖**
- P/R 读数**带样本量与仪器名**

## 风险点与回退

- **风险**：`external-guardrail` 臂被顺手加了补救 → 三条件对照失效，读数没有意义。回退：确认该臂只有 `pass/redact/refuse`。
- **风险**：样本量不足以支撑结论 → 回退：**把强度说低**，并在报告里写明样本量。
- **风险**：held-out 被改进者读到 → 回退：由 A4 的不变量测试看住。
- **回退点**：第 3–5 步（选仪器/任务集）可整体重选，不影响 A1–A4 的产物。

## 提交前

- [ ] 设计已在动手前冻结（本文件），后续改动有记录
- [ ] 结果开头有边界声明
- [ ] 误拒一侧有读数（不能只有"拦住了多少"）
- [ ] 已提交工件未被覆盖
