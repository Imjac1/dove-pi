# Input-side cost optimization: solve the 40K prompt-cache cliff

> 关联: `08-28-dove-pi-usage-review` (父任务) | `08-29-token-guard-implementation` (已完成: 前缀保险丝 260K + 思考策略 + reasoning 报告)
> 日期: 2026-08-29 | 优先级: P0 | 范围: `src/pi-adapter/extension.ts`, `src/pi-adapter/cache-diagnostics.ts`
> 调研: `research/fix-a-cache-cliff.md`（08-29 观察轮实证，结论反转）

## Goal

消除 input 侧的缓存悬崖：单次调用前缀超过 ~40K token 后，上游缓存命中率从 100% 跌到 2-8%，86–91% 的 input 成本都花在这里。

## 背景（调研结论，取代初版 PRD）

- 初版假设"大工具结果（130–230K）是成本大头"——**实测不成立**：最大单条工具结果仅 32K 字符。
- 真实根因：provider 走 `anthropic-messages` API，pi 只设置 3 个 cache_control 断点（system prompt、末工具、末消息）。**断点之间的对话历史从不缓存**，前缀一超过 ~40K（断点覆盖区），中间整段历史每轮全价重算。
- 实证：pi-agent 245 调用中 input>40K 的 26 个调用 100% MISS，合计占 input 91%；Desktop/code 1765 调用中同样口径占 86%。miss reason 29/30 = prefix-change。

## Requirements（新方向，取代原 FIX A/B）

- **FIX-C2 — 前缀增长定标（P0，主方案）**：40K 是悬崖，260K 软阈值太宽松。把 context-guard 软阈值重新定标到悬崖附近，加中间告警，让长会话在被推入全价区前主动轮转/压缩。改动最小、确定有效。
	- **FIX-C1 — 中间断点注入（P1，候选修复，env 开关默认关）**：可行性已验证（payload 可变、provider 接受注入，见 `research/fix-c1-feasibility.md`），但 headless 无法复现悬崖、效果待真实会话确认。实现为 `DOVE_PI_INJECT_CACHE_BREAKPOINTS=1` 开关，限制最多 3-4 个断点只给最大中间块。
	- **FIX-C3 — API 路径评估（P2，可选）**：评估换 `openai-completions` 路径（`prompt_cache_key` + 会话亲和可缓存整前缀）；需验证 OpenRouter/DeepSeek 上游支持。
	- **验证（P0）**：用 token-audit 对比优化前后：>40K 调用的 cacheRead 命中率、input 总量、单次 max 调用。

## 约束

- 不新增网络依赖，离线优先。
- 断点注入必须保持 append-only 上下文消息的 epoch 稳定性，不破坏现有行为。
- 配置走 env 变量，可一键关闭。
- 若 `before_provider_request` 无法注入（payload 形态受限），如实记录并降级为 FIX-C2。

## Acceptance Criteria

- [x] FIX-C1 可行性验证完成：注入中间 cache_control 可行（research/fix-c1-feasibility.md）
	- [ ] FIX-C1 以 env 开关实现（默认关，最多 3-4 断点）；真实会话验证通过后转默认开
	- [ ] FIX-C2：软阈值按 40K 悬崖重新定标并生效（含中间告警）
- [ ] 验证: token-audit 对比显示 input 总量可量化下降
- [ ] typecheck + 全量测试通过

## Notes

- 原始 FIX A（工具结果截断）已取消——调研证明无效。
- 原始 FIX B（capability 通道验证）仍在待办，独立于本任务缓存工作。
- 不要动 `src/cli.ts` 的格式化存量（已单独提交 ba75d94）。
