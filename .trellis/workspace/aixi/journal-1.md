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
