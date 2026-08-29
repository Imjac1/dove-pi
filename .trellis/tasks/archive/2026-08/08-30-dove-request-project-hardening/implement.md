# 实施计划：Dove 请求与项目流程加固

## 阶段 1：请求权限与 bootstrap

1. [x] 为 `createRequestPlan()` 增加 clause/action polarity 模型，先用真实 E2E 提示词补失败测试。
2. [x] 让 tool profile、request middleware 和 bootstrap gate 只消费 RequestPlan。
3. [x] 验证只读请求 mutation tools 为 0，Chat 不加载 Lookup/Execution schema。

## 阶段 2：ProjectProvider 续接

4. [x] 在 Dove 公共层实现 `summarizeProjectContinuation()` 及四态类型。
5. [x] 将 projection 接入 `agent_project_status`、`agent_project_context` 和 workflow guidance。
6. [x] 增加 current/唯一候选/歧义/无任务测试，证明不读取任何 Trellis 私有路径。

## 阶段 3：防循环、状态与诊断

7. [x] 将 ProgressGuard advisory warning 注入模型可见 tool result，补请求级无进展信号测试。
8. [x] 抽取共享 Dove state-dir resolver，迁移 Pi adapter/CLI 默认 ledger 路径并实现安全 legacy 兼容。
9. [x] 在最终 provider payload gate 记录 tool count、schema bytes、cache policy version。
10. [x] 让 v2 context details 和 cache audit 使用显式版本，保留 legacy fallback。

## 阶段 4：启动体验与文档

11. [x] 为 launcher 增加清晰的 skip-version-check/offline 选项，复用 Pi 官方开关且保持默认在线。
12. [x] 更新中英文 README、CLI help 和 runtime spec，说明 Trellis 外部边界、自然语言续接、状态目录和启动选项。

## 阶段 5：验证

13. [x] 运行定向单测、typecheck、全量 Node/installer tests、doctor、Pi smoke、cache/benchmark gates。
14. [x] 在干净临时目录复测原 8 条 prompt-to-agent E2E，保存前后指标和异常路径对比。
15. [x] 检查 Git diff，确认没有 Trellis 上游/生成文件改动，没有 `.agent-data` 普通使用污染。

## 验证命令

```text
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 否定解析过度，漏掉真实执行意图 | clause 级 reducer；后置独立肯定动作回归测试 |
| 自动选错任务 | 仅唯一候选可投影为 `single_candidate`，多候选必须 `ambiguous` |
| 防循环误杀大型任务 | 只注入 advisory warning，不做通用硬 abort |
| 状态迁移丢失或污染 | env 优先、只读兼容/安全迁移、不删除、不双写 |
| 新 ledger 字段影响旧 audit | 显式版本优先，legacy fallback 保留 |
| 快速启动掩盖更新 | 选项显式且默认关闭，skip 与 offline 分离 |
| Trellis 后续更新破坏集成 | 只依赖 ProjectProvider 公共契约和契约测试 |

## 开始实施前 review gate

- [x] 用户确认不修改 Trellis，只从 Dove 侧优化。
- [x] 用户确认本 PRD/design/implement 后，下一条消息再激活任务并开始产品代码修改。
