# Input-side cost optimization: truncate huge tool outputs & verify capability fast path

> 关联: `08-28-dove-pi-usage-review` (父任务) | `08-29-token-guard-implementation` (已完成的前置: 前缀保险丝 260K + 思考策略 + reasoning 报告)
> 日期: 2026-08-29 | 优先级: P0 | 范围: `src/pi-adapter/extension.ts`, `src/trellis-adapter/*`, `src/core/*`

## Goal

把 input 侧的单次大调用（80K–230K token）压下来。这是观察轮确认的**真正的成本大头**：reasoning（output 侧）已实证不受 thinking level 缩放，而 input 侧大工具结果每次都以原价重计（即使命中缓存，cacheWrite/cacheRead 的舍入与冷重建仍然昂贵）。

## 背景（来自 08-29 观察轮的真实遥测）

交互式会话（pi-agent，max，217 calls）per-call 数据：

- **reasoning 只占总成本 23.1%**（output 侧），且集中在分析型调用 —— 已证实在 deepseek-v4-flash + forceAdaptiveThinking 下思考量不随 level 缩放，thinking level 不是成本杠杆（行为已定案，见 token-guard 任务）。
- **input 侧是真凶**：单次 80K–230K 的调用约 12 个（call 61/64/68/83/87/94-96/181/189/198/200/207/210），合计约占该会话 input 总量 3.18M 的相当比例。
- cacheRead 命中 90%，热前缀便宜；**贵的是每次大工具结果写入 + 前缀增长导致的冷重建窗口**。

## Requirements

- **FIX A — 大工具结果截断（P0）**：在工具结果进入上下文前截断超大输出（如 read/bash 结果 > 40K 字符），保留开头+结尾，加截断标记。目标：消灭 130K–230K 的单次调用。需要可配置阈值（env）与 off 开关。
- **FIX B — 验证 capability 快速通道（P1）**：审查发现 `agent_run_capability` 调用 = 0、bash 硬写 580 次。验证 capability 索引是否已进 system prompt、模型为何不用；补齐提示或调用路径。
- **验证（P0）**：用 token-audit（已有 reasoning% + cacheRead 列）对比优化前后的 input 总量与单次 max 调用。

## 约束

- 离线优先，不新增网络依赖。
- 截断是纯展示层/上下文层裁剪：**绝不改文件、不丢语义关键部分**（保留文件头尾 + 标记可回读）。
- 与已有的 `context-guard`（260K 软阈值）、append-only 上下文消息（epoch 稳定）兼容，不破坏缓存前缀。
- 配置都走 env 变量，默认值保守，可一键关闭。

## Acceptance Criteria

- [ ] FIX A: 会话中不再出现 >80K 的单次工具结果；大结果被截断且带可见标记
- [ ] FIX A: 可配置阈值（`DOVE_PI_TOOL_RESULT_MAX_CHARS` 等），关闭开关存在
- [ ] FIX B: 确认 capability/recipe 索引在 system prompt 中的实际形态；给出模型不用它的证据或修复
- [ ] 验证: 同等工作负载下 input 总量下降可量化（token-audit 对比），单次 max 调用显著下降
- [ ] typecheck + 全量测试通过

## Notes

- FIX A 的最小切入点是 `extension.ts` 的 tool_result 事件（`tool_result` handler 可改 content），或 `before_agent_start` 后对即将进入上下文的 tool result 消息做预处理。
- 不要动 `src/cli.ts` 的格式化存量（已单独提交 ba75d94）。
