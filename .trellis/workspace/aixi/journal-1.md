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

## Session 4: 负优化全面检查与修复

**Date**: 2026-08-30
**Task**: 检查已推送改动是否存在负优化（用户要求"确定好再优化"）
**Branch**: `master`

### Summary

对 08-29 推送的全部改动做 8 项负优化检查，用代码路径 + 真实数据逐项确定：

- **检查 1 重启思考级别静默降级 → 确认为真**：ModeController 默认 standard 且 mode 不持久化，重启后 auto 策略断言 high，覆盖用户 settings 的显式 max（defaultThinkingLevel + modelThinkingLevels）。且 pi 原生 `_getThinkingLevelForModelSwitch` 本来就优先 per-model > default——策略在跟原生行为打架。
- **检查 2 free provider thinkingLevelMap 未测试 → 确认为真**：`off:null` 让 off 从可选变隐藏，openai-completions 端点从未实测。
- **检查 5 token-audit 性能 → 排除**：全量遍历 4 项目 53 万条消息仅 0.416s。
- **检查 6 setThinkingLevel 每回合副作用 → 排除**：仅 isChanging 时写 entry/发事件，同级别重复调用零副作用。
- **检查 7 cache-diagnostics reasoning 字段 → 排除**：纯读入采样，不参与命中率计算。
- **检查 3/4/8 可接受或无问题**：thinking_level_select 不持久化符合设计；150K guardNotified 每会话一次不刷屏；env 解析非法值回退 auto、catch 保护。

### Fixes

1. auto 策略尊重用户显式配置：有 per-model 钉或非默认全局级别时不再断言（跳过覆盖），无显式配置时行为不变（照旧按 mode 断言）。
2. free provider thinkingLevelMap 恢复 `{max:max}`，保留 OpenRouter 全映射（实测过）。

### Git Commits

| Hash | Message |
| ------ | --------- |
| `846c869` | fix(thinking-policy): auto policy respects explicit settings; revert free provider map |

### Verification

- 110 测试全过（新增 2 个回归测试：respect 路径不调用 setThinkingLevel、无配置路径调用 high）
- typecheck OK、pi:smoke OK
- models.json 往返验证合法，free 已回滚、OpenRouter 保留

### Status

[DONE] 2 个确认负优化已修复并推送。


## Session 2: Complete Dove-Pi V2 runtime architecture

**Date**: 2026-08-29
**Task**: Complete Dove-Pi V2 runtime architecture
**Branch**: `master`

### Summary

Completed and validated the Dove-Pi clean-slate V2 runtime slice: immutable request planning, full provider-payload budget firewall, capability approval/recovery state, correlated execution ledger, Trellis mutation reconciliation, strict ordinary-chat context isolation, Pi read-only degradation, centralized prompt policy, and full regression coverage. Typecheck, 131 Node tests, 19 installer tests, doctor, Pi smoke, and diff checks passed.

### Git Commits

| Hash | Message |
|------|---------|
| `1add042` | (see git log) |
| `4bee290` | (see git log) |
| `5689998` | (see git log) |

### Status

[OK] **Completed**


## Session 3: Transactional Dove Pi managed installation and stable updates

**Date**: 2026-08-29
**Task**: Transactional Dove Pi managed installation and stable updates
**Branch**: `master`

### Summary

Replaced checkout-backed Git updates with a transactional managed installer and stable GitHub release flow; pinned bundled Pi, TUI, Trellis and Dove-managed extensions; added repair, rollback, bounded uninstall, offline diagnostics, release/bootstrap validation, tests, and complete Chinese/English documentation.

### Git Commits

| Hash | Message |
|------|---------|
| `bef03be` | (see git log) |
| `3584aa9` | (see git log) |
| `ebb8020` | (see git log) |

### Status

[OK] **Completed**


## Session 4: Harden provider token guard

**Date**: 2026-08-30
**Task**: Harden provider token guard
**Branch**: `master`

### Summary

Completed provider budget safety hardening without imposing an Ultra output cap; synchronized known provider limits with accounting, aborted unsafe Pi requests, preserved live-owner ledger records, stabilized prompt prefixes, normalized stop reasons, corrected negated intent detection, isolated Trellis context tests, and documented the runtime contracts.

### Git Commits

| Hash | Message |
|------|---------|
| `6b5df03` | (see git log) |
| `3856a2e` | (see git log) |

### Status

[OK] **Completed**


## Session 5: Personal Agent OS completion

**Date**: 2026-08-30
**Task**: Personal Agent OS completion
**Branch**: `master`

### Summary

Completed and verified the Personal Agent OS architecture and provider safety contracts, archived the parent task and completed bootstrap guidelines, and prepared the P1 interoperability layer as the next implementation target.

### Git Commits

| Hash | Message |
|------|---------|
| `6b5df03` | (see git log) |
| `3856a2e` | (see git log) |

### Status

[OK] **Completed**


## Session 6: Dove Pi normal-user E2E evaluation

**Date**: 2026-08-30
**Task**: Dove Pi normal-user E2E evaluation
**Branch**: `master`

### Summary

Recorded a real TUI prompt-to-agent journey, verified the coding loop, and identified Dove-side intent and Trellis-provider continuation regressions without changing Trellis.

### Git Commits

| Hash | Message |
|------|---------|
| `bb407cd` | (see git log) |

### Status

[OK] **Completed**


## Session 7: Harden Dove request and project flow

**Date**: 2026-08-30
**Task**: Harden Dove request and project flow
**Branch**: `master`

### Summary

Hardened request intent and tool authority, added provider-neutral one-read continuation through Trellis public current API, moved runtime state outside repositories, improved cache/provider observability and launcher options, and verified the original eight-prompt E2E flow.

### Git Commits

| Hash | Message |
|------|---------|
| `65554bd` | (see git log) |
| `279006e` | (see git log) |

### Status

[OK] **Completed**


## Session 8: Dove extension identity and spec context budget

**Date**: 2026-08-30
**Task**: Dove extension identity and spec context budget
**Branch**: `master`

### Summary

Implemented managed-first Dove extension identity synchronization with trusted explicit project override and reload-safe registration claims; split the 68 KB runtime contract into five routed specs under 24 KB, migrated active task manifests, and added context-budget regression tests. Full Node, installer, typecheck, doctor, Pi smoke, and diff checks passed.

### Git Commits

| Hash | Message |
|------|---------|
| `3f926d5` | (see git log) |
| `0741298` | (see git log) |

### Status

[OK] **Completed**
