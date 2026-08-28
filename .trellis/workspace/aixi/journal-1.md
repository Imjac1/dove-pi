# Journal - aixi (Part 1)

> AI development session journal
> Started: 2026-08-26

---

## Session 1: Auto-update Pi extensions during Dove install

**Date**: 2026-08-28
**Task**: Auto-update Pi extensions during Dove install
**Branch**: `master`

### Summary

Implemented default Pi extension updates during dove-pi install with a fast empty-install path, explicit opt-out, stable update statuses, fail-open reconciliation, machine-readable CLI output, tests, README updates, and Trellis spec synchronization.

### Git Commits

| Hash | Message |
|------|---------|
| `a3e0c41` | (see git log) |
| `d077164` | (see git log) |

### Status

[OK] **Completed**

## Session 2: Dove Pi token guard & capability activation

**Date**: 2026-08-28
**Task**: 08-28-dove-pi-usage-review / 08-29-token-guard-implementation
**Branch**: `master`

### Summary

审查 + 优化 dove-pi 使用:审计了真实会话遥测(pi-agent 与 ~/Desktop/code 共 ~1.9 亿 prompt tokens),发现两大根因——前缀膨胀到 18–21 万 token / 全 MISS 冷启动,以及 capability/recipe 快速通道从未被调用(bash 硬写 580 次)。已落地两轮质量安全优化:

- FIX1 prefix cap(新 `context-guard.ts`): 82% 窗口或 28k 软阈值触发 /compact 建议,**绝不自动删历史**。
- FIX2 capability 清单 + FIX6 派生子代理指引注入 system prompt。
- FIX2b capability 复用提示(tool_result 拦截等价 bash/powershell)。
- FIX3 hashline 编辑工具跨环境对齐诊断。
- FIX7 `dove-pi token audit` CLI(聚合会话 token 账本,支持 --since/--filter)。

### 验证

typecheck ✅ | 测试 94 全过(+7 context-guard +3 token-audit)✅ | extension 加载 ✅ | pi:smoke ✅ | `token audit` 实测输出真实会话账本 ✅

### Git Commits

| Hash | Message |
|------|---------|
| (未提交) | 两轮改动保留在 worktree 待用户 review,未代提交(遵循不自动提交政策) |

### Status

[WORK] 两轮已实现且全绿;待用户回来看效果,决定提交与后续(keepalive 已明确不做)。

---

## Session 3: Token cost root-cause investigation 与结论修正

**Date**: 2026-08-29
**Task**: 08-29-input-cost-optimization（父: 08-28-dove-pi-usage-review）
**Branch**: `master`

### Summary

延续 Session 2 的 token 优化工作，本轮目标是定位 input 侧成本大头并落地优化。经历了完整"假设→验证→推翻→修正"循环，最终用数据定案：

- **初判（错误）**：把 `usage.input` 误读为单次大内容 → 推测"130-230K 大调用"和"40K 缓存悬崖"，并基于此设计了 FIX-C1（中间 cache_control 断点注入）和 FIX-C2（40K 阈值定标）。
- **推翻（实测）**：`usage.input` 在全 MISS 时 = 整个前缀（不是增量）。交叉验证 1,938 次调用（Desktop/code）：MISS 率由**轮次间隔时间**驱动（>60s → 34-40%，<10s → 0.4-5.7%），与前缀大小基本无关 → 无悬崖、无断点问题、短会话无用。
- **修正落地**：撤回 FIX-C1/C2 与"短会话"推论；context-guard 阈值 260K → 150K（实测更早触发、8/13 会话有行动价值）；保留 thinking policy（定位为可控性而非省钱，Session 2 已记录）。
- **诚实结论**：上游缓存 TTL 无法本地修复，现况已接近最优；本轮有价值产出是正确因果认知 + 防误判文档。

### 验证

交叉验证 1,938 调用（间隔×前缀大小分桶表见 prd.md）| 误判链已记录 | typecheck ✅ | 108 测试全过 ✅ | 重启后新代码生效确认 ✅

### Git Commits

| Hash | Message |
| ------ | --------- |
| `0f57642` | feat: auto/lock thinking policy, 260K compact soft cap, reasoning% in token audit |
| `ba75d94` | style(cli): reflow multi-line imports |
| `d77c839` | chore(task): add input-cost-optimization tracking task |
| `7b532f0` | chore(task): FIX A research（40K 悬崖，后续被推翻） |
| `8bc8008` | chore(task): FIX-C1 feasibility（后续被推翻） |
| `f9bba66` | chore(task): re-prioritize（后续被推翻） |
| `d1b8e89` | fix(task): 修正为时间衰减根因，阈值 150K |

### Status

[DONE] 任务结论定案、文档修正、阈值收尾。本任务 archive，等待推送。
