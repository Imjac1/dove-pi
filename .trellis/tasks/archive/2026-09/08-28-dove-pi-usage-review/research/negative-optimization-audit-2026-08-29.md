# Dove Pi 负优化复核（2026-08-29）

## 结论

本轮确认一个已修复的兼容性问题，并记录四个需要继续用数据验证的优化边界。没有证据表明应当重新引入固定 Ultra 上下文上限、会话保活请求或第二套缓存账本。

## 已确认并修复

### P0：扩展覆盖 Pi 内置 `/thinking`

- 根因：`src/pi-adapter/extension.ts` 注册了同名命令。
- 现象：Pi 报告 command conflict，并跳过 Dove 命令的自动补全。
- 修复：Dove 改用 `/dove-thinking auto|lock <level>|off|status`；Pi 原生 `/thinking` 保持唯一权威。
- 验收：扩展测试断言命令集合包含 `dove-thinking` 且不包含 `thinking`；README 中明确两者职责。

### P1：优化测量脚本使用过期的 28K 阈值

- 根因：`context-guard` 已从 260K 调整为 150K，但 `scripts/measure-optimization.mts` 仍统计 `input > 28,000`。
- 风险：审计输出会夸大触发比例，误导后续阈值决策。
- 修复：导出 `DEFAULT_MAX_CONTEXT_TOKENS`，测量脚本复用同一常量；活动实施计划同步为 150K。

## 保留现状、继续观测

### P1：工作流建议与缓存稳定性的张力

当前 context epoch 只由 `mode + Trellis revision` 组成，避免每次 prompt 意图变化都重建前缀；因此 prompt-specific workflow hint 只会在 epoch 创建时进入快照。这样缓存更稳定，但同一 epoch 中后续的“实现/检查/规划”请求可能不会再次把精确 skill 建议注入模型。

下一步先用会话日志统计“建议出现时机”和“用户显式 skill 调用率”，再比较静态通用规则、UI advisory、一次性 transient message 三种方案。禁止直接恢复每轮 append，因为历史数据已证明这会制造 prefix-change 全 MISS。

### P1：Trellis 投影的重复文件读取

`TrellisProvider.getContext()` 会在短缓存过期后重新扫描并读取任务、规范和 workspace Markdown。250ms 请求内缓存能消除同一事件的重复读取，但长会话仍会产生周期性磁盘 I/O。

下一步测量大项目中文件数量、读取耗时和 revision 变化频率；若有明显影响，再做 stat/hash 增量缓存或元数据/内容分层。不能只为减少 I/O 而放宽 stale-context 风险。

### P1：auto 工具集合单调增长

单调加入工具可稳定 provider cache 前缀，但长会话可能累积较大的第三方工具 schema。当前 `/dove-tools reset` 是显式、可控的回收点。应先测量工具 schema 字符数和命中率变化，再考虑按阶段或大小提示 reset；不要自动卸载工具。

### P2：`x-session-affinity` 路由兼容性

该 header 对自定义 OpenRouter provider 可能提高缓存复用，但不同代理可能按 header 分片或拒绝未知 header。现有实现尊重已有 header，并提供 `DOVE_PI_DISABLE_SESSION_AFFINITY=1` 关闭开关。继续保留诊断和 opt-out，不做无数据的强制改写。

## 明确不做

- 不自动压缩或删除用户对话历史。
- 不为“保活缓存”发起无意义模型请求。
- 不把 Ultra 改回固定 token 上限。
- 不引入新的 npm latest 查询、memory 引擎或独立缓存账本。

## 验证记录

- `node --import tsx --test tests/pi-adapter.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run pi:smoke`
- `node --import tsx scripts/measure-optimization.mts`（阈值与 guard 共用常量）
