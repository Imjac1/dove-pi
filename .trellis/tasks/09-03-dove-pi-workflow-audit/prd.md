# Dove Pi 全工作流审计与使用指南

## Goal

让用户能够从真实用户视角理解、运行和诊断 Dove Pi 的完整生命周期：源码或 Release 安装、启动路由、Pi 会话、Native Workflow、CLI/Capability/RPC/MCP、扩展管理、更新修复回滚和卸载。审计必须把可复现缺陷转化为回归测试或明确的后续项，并让 README 与实际行为保持一致。

## Background and confirmed facts

- Windows 启动入口是 `dove_pi.py`；它同时负责安装、维护、托管 Pi 启动和本地 TypeScript CLI 路由。
- `src/cli.ts` 提供 `doctor`, `project`, `task`, `session`, `extensions`, `capability`, `rpc`, `mcp`, `skills`, `web`, `token`, `cache` 命令。
- Pi 仍是工具和执行权限的唯一权威；Dove 只提供上下文、目标连续性、收敛、诊断和记录。
- Native 状态写入项目 `.dove/`；Legacy `.trellis/` 只读兼容，Dove 不执行 Trellis 脚本或修改 Legacy 数据。
- 之前的真实缺陷是 `--offline task convergence status` 被误当作 Pi 启动参数；该路由已修复并有 `tests/interop_installer_routing_test.py` 回归测试。
- 真实命令矩阵显示 `project <未知子命令>` 会静默退回项目状态；CLI 失败会向用户暴露 Node 堆栈而不是结构化错误文档。这两项会纳入本任务修复。
- 工具调用、耗时和 token 必须做请求级累计观察；provider-round 仅在上一批工具无有效进展时硬停止，不直接全局提高数字。

## Requirements

1. 审计并记录所有公开入口、参数顺序、状态边界、数据位置、错误/取消/降级行为和恢复顺序。
2. 启动器必须把带有 `--offline` 或 `--skip-version-check` 前缀的已知本地 CLI 命令路由到 CLI，不能启动 Pi；普通 Pi 参数仍按原方式透传。
3. CLI 对未知 `project` 子命令必须失败并给出用法；CLI 失败必须保持非零退出且提供不含堆栈的机器可读错误结果（RPC/MCP 协议流除外，协议错误走 stderr）。
4. 为上述行为补充隔离、可重复的回归测试，不触碰真实 `%LOCALAPPDATA%\\DovePi`、`~/.pi/agent` 或用户项目状态。
5. README 中文和英文版本必须描述完整生命周期、命令路由、状态/数据边界、真实验证方法、故障恢复和当前明确的限制。
6. 审计报告必须区分已修复缺陷、当前修复、未纳入范围的后续风险；不得把 x25519 harness blocker 或硬上限需求偷偷并入本任务。
7. Legacy context projection 在文档数量达到上限时仍必须保留顶层 `workflow.md`，避免大型项目丢失生命周期契约。
8. 请求规划必须正确区分只读任务清单、显式任务生命周期动作和复杂多文件实现：`未完成任务` 不得触发 finish，`创建正式任务` 必须保留 create-task，明确的规划+多文件实现必须进入 formal lane。
9. Dove 策略造成的 provider-round 或 progress-guard 终止必须向交互用户显示具体原因；`/status full` 必须解释执行模式、上下文模式、thinking policy、工具 profile 和当前请求预算的不同职责。
10. 小窗口省略项目上下文不得永久消费同一项目 revision 的快照 epoch；后续新请求在可用窗口下必须能够重新构建上下文。
11. Doctor 已检测到 source drift 时必须提供明确的用户动作提示，但不得自动更新或覆盖 managed release。
12. 用户可见的 `Operation aborted` 必须能够归因到唯一终止类别，而不是把用户取消、Provider 鉴权/网络失败、模型上下文拒绝、provider-round、progress guard 和 formal convergence 全部压成同一句文本。
13. 策略终止必须先持久化一个结构化 terminal envelope，再调用 Pi 的 host abort 边界；UI、RPC 事件和 ledger 至少有一个稳定渠道显示 `origin`、`code`、摘要和下一步。用户主动取消不得显示为 Dove 策略错误。
14. transient provider 故障仍按既有安全重试规则处理；不得通过提高 attempt/provider-round/token 上限掩盖 `Operation aborted`，也不得在非幂等副作用后自动重放。
15. 请求级资源统计必须累计每一轮 Pi usage，而不是只保存最后一轮；同时记录工具累计耗时、stop reason 序列和 cache write。
16. provider-round 达到当前阈值时，若上一批工具成功并产生新证据或项目状态变化，允许一次总结回合并显示警告；连续无进展才硬停止。
17. 初始分类为 chat 但实际调用项目/读取工具的请求，不得继续使用 chat 的两轮预算；应按可观察到的 lookup 工作负载计算。

## Acceptance Criteria

- [x] `dove-pi --offline task convergence status`、`dove-pi --skip-version-check task list` 等已知本地命令在隔离项目中只启动 CLI，不创建 Pi 会话或任务。
- [x] `project` 的未知子命令和 CLI 其他失败路径返回非零、稳定的 JSON 错误对象且不输出 Node 堆栈；RPC/MCP 的 stdout 协议帧保持不被错误文本污染。
- [x] 安装、启动、项目、任务/会话、扩展、Capability、RPC/MCP、维护和数据边界均有 README 中的可执行示例与预期结果。
- [x] 新增/更新回归测试通过；现有 `npm run typecheck`、`npm test`、`npm run test:installer`、`npm run doctor`、`npm run pi:smoke` 全部通过。
- [x] 大型 Legacy 投影仍包含 `.trellis/workflow.md`，且标准模式的显式 workflow 查询可检索到该文档。
- [x] `.trellis/tasks/09-03-dove-pi-workflow-audit/research/` 含有代码证据、真实命令矩阵和外部 Pi/MCP 资料；`design.md` 与 `implement.md` 完成且与本 PRD 一致。
- [x] 请求策略回归矩阵覆盖任务清单、正式任务创建、复杂多文件实现、只读分析和普通小修复，并断言 intent/lane/workflowAction。
- [x] provider-round/progress hard stop 的 TUI 提示与 `/status full` 能区分策略层，不改变现有阈值。
- [x] 预算省略后的下一逻辑请求可重新获得相关项目上下文；已有 prompt-cache 顺序测试仍通过。
- [x] `doctor` 对 `sourceDrift=drifted` 输出明确的 update/source-install 建议。
- [x] 相同的黑盒 harness 能分别复现 user-cancel、HTTP 401、HTTP 429/503 达到重试边界、provider-round、model-budget、progress-guard 和 convergence stop，并断言每一种都得到不同的结构化终止 code；只有 user-cancel 使用 cancelled 语义。
- [x] TUI 不再只显示裸 `Operation aborted`：策略终止显示 Dove 原因和恢复建议，Provider 失败显示状态/可重试性，模型上下文拒绝显示预算诊断；RPC/无 UI 路径可以从最终事件或查询接口读取同一 envelope。
- [x] 每个逻辑请求最多持久化一个 terminal record；`agent_end`、`message_end`、`agent_settled` 和 session replacement 不得重复 abort、覆盖更具体原因或读取 stale ctx。
- [x] 请求资源记录包含累计 input/cacheRead/cacheWrite/output/reasoning token、工具累计耗时和 stop reason 序列；测试证明多轮 usage 不会被最后一轮覆盖。
- [x] 有效工具进展后的 provider-round 会收到一次总结宽限；无进展请求仍按原阈值终止；chat 转工具链使用 lookup 预算。

## Out of scope and deferred

- 不实现工具调用、耗时或 token 的硬上限；资源指标保持观察性。
- 不修复独立 x25519 harness linker blocker，不改 builtin `09-03-task-convergence-control` 的验收范围。
- 不引入第二套权限/确认层，不执行或写入 `.trellis`，不更新全局 Trellis，不改变 Pi 的工具权限模型。
- 不进行真实 Release 发布、全局安装、用户 PATH 清理或联网扩展升级；这些只通过隔离测试验证。
- 不改变 Pi 内部固定的通用 `Operation aborted` 文案；Dove 通过在 abort 前后提供结构化、可见的原因解决歧义。

## Open questions

无阻塞问题。错误输出采用单个 JSON 对象；RPC/MCP 的协议完整性优先于 JSON CLI 友好性，协议错误写 stderr。
