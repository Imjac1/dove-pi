# 审查并修复真实使用流程逻辑

## Goal

从真实 Pi 会话的端到端行为出发，修复规划任务取消后的状态错误和 token 审计汇总错误，确保用户可以取消、重新回答、再次确认并成功创建任务，同时成本统计的项目明细与合计一致。

## Background and Confirmed Facts

- 当前会话已完成并归档 `08-30-request-middleware-optimization`；本任务不修改其他活动任务。
- `PlanningSession` 在收到非取消的方向/标题回答后进入 `awaiting-create`，Pi 的 `tool_call` 边界会在该状态阻断后续 `ask_user_question`，位置为 `src/core/planning-session.ts:77-115` 和 `src/pi-adapter/extension.ts:1363-1373`。
- `agent_project_task` 的创建确认在 `src/pi-adapter/extension.ts:896-914`。原生确认取消只返回 `cancelled: true`，没有通知 `PlanningSession` 恢复；同一轮后续问题仍会被 `awaiting-create` 守卫阻断。
- `src/commands/token-audit.ts:110-195` 会按项目累加 reasoning，但未将 reasoning 加入 `totals.reasoning`，所以明细正确、合计长期为 0；现有 `tests/token-audit.test.ts` 未断言合计 reasoning。
- 既有规格要求规划状态按逻辑请求隔离、取消/错误后不伪造成功，以及审计输出可解释且统计一致。
- `PlanningSession.begin()` 以 `currentTaskId` 优先于显式 `create-task`；项目已有当前任务时，“新建任务”会错误进入 `planning`，空标题创建随后失败，或模型继续旧任务。
- 创建工具只把一个标题传给 `task.py create`；规划问题虽然声称收集“标题/范围”，但状态快照没有 scope/description，原始目标不会进入新任务的 `description` 或 PRD Goal，跨会话继续时需求丢失。
- `runTokenAudit()` 的 `sinceHours` 只作用于 cache/input/reasoning 样本，`outputTokensOf(entries)` 却统计整个会话；窗口内的 output、reasoning 百分比和项目会话计数因此可能互相矛盾。

## Requirements

### R1. 创建确认取消可恢复

- 创建操作被用户取消后，规划会话必须进入明确的可恢复状态，不得继续停留在 `awaiting-create`。
- 取消结果必须保留给模型/调用方可识别的结构化信息，并允许同一逻辑请求重新收集或修正标题/范围后再次调用 `agent_project_task`。
- 取消不得创建任务、标记 `task-created`、进入 `planning`，也不得绕过原生确认。
- 成功创建、创建失败、用户取消三条路径必须各自有明确状态和回归测试。

### R2. 请求边界不泄漏规划状态

- 新逻辑请求必须重置或替换上一请求的规划状态；取消后新请求不能继承 `awaiting-create` 的提问阻断。
- 重试/同一逻辑请求的 continuation 必须保持既有规划状态，不因重复 `before_agent_start` 重置已收集输入。
- 状态变更必须集中在 `PlanningSession`，Pi 适配器只调用明确的状态转换方法。

### R3. 显式创建不能被当前任务覆盖且必须保留需求

- `create-task` 的优先级必须高于“当前已有任务”提示；新建任务请求不得进入旧任务的 `planning` 状态。
- 规划收集的数据必须区分任务标题与目标/范围，并以结构化字段传给创建边界；至少要写入 Trellis 的 description/PRD Goal，不能只留下一个标题。
- 创建结果和后续 planning 状态必须绑定新创建任务的稳定 ID/path；不能使用旧的 currentTask 作为回退绑定。

### R4. 项目 mutation 恢复不得伪造成功

- 启动恢复必须按 operation 验证实际目标状态；仅 revision 变化不能证明 create/start/finish/archive 成功。
- 无法精确验证时只能记录 `unknown` 并要求显式检查，不得写入 `observed` 或向模型返回成功。
- mutation ledger 必须保留足够的前置/目标身份信息，使恢复结果能与具体任务关联；并发或同毫秒调用不能覆盖彼此的 mutation 记录。

### R5. Token audit 合计一致

- `runTokenAudit()` 的 `totalReasoning` 必须等于所有纳入过滤条件的项目 `reasoningTokens` 之和。
- `totalOutput`、项目 output、reasoning 和 session/message 计数必须使用同一时间窗口；`formatTokenAudit()` 的 reasoning 百分比必须基于修正后的合计，并在无 output 时保持 0.0%。
- 现有 input/cache/output、时间窗口、项目过滤和空目录行为不得改变。

### R6. 真实流程验证

- 单元测试覆盖取消、重新提问、成功创建、显式创建覆盖当前任务、需求传递和新请求切换。
- Pi 适配器测试验证取消后 `ask_user_question` 不再被旧状态误阻断，成功创建仍只发生一次原生确认，且结果绑定新任务。
- Provider/ledger 测试验证 revision 变化但目标未变化时保持 `unknown`，并验证 create 的目标身份与恢复记录一致。
- Token audit 测试验证时间窗口同时过滤 output/session，并验证 raw/formatted aggregate。
- 使用全新 Pi 进程和临时/隔离项目复测取消后重试、已有当前任务时新建、范围传递、成功创建路径及 token audit 输出；不得污染其他 Trellis 任务或真实项目任务。

## Acceptance Criteria

- [x] 创建确认取消返回结构化 `cancelled` 结果，规划状态不再是 `awaiting-create`，后续允许重新收集标题/范围。
- [x] 同一请求重试保留规划状态；新请求从新状态开始，不继承旧的提问守卫。
- [x] 已有当前任务时显式新建仍进入新建握手；标题与目标/范围进入新任务的 description/PRD Goal，并绑定新任务稳定 ID/path。
- [x] 成功创建仍进入 `planning`，失败不伪造成功，取消不产生任务变更。
- [x] revision-only 变化的未完成 mutation 恢复为 `unknown`；目标状态精确匹配时才记录 `observed`，并发 mutation ID 不冲突。
- [x] `result.totalReasoning` 等于项目明细 reasoning 之和，格式化合计显示正确数值和百分比。
- [x] `sinceHours` 同时约束 input/cache/output/reasoning/session/message 统计，项目行与总计使用同一过滤口径。
- [x] 既有测试、类型检查、doctor、Pi smoke 和 installer 测试全部通过。
- [x] 全新 Pi 进程的临时项目回归覆盖取消、重新回答、成功创建、工具调用次数和 token audit 结果。

## Out of Scope

- 不重做 RequestPlan 的意图分类、工具分层、provider cache 策略或 Trellis 存储协议。
- 不改变缓存命中率定义；只修正审计字段在同一过滤窗口内的一致性。
- 不修改 `08-27-dove-interop-layer`、`08-28-dove-pi-web`、`08-30-dove-pi-runtime-reliability-sync` 及其子任务。
- 不发布新 GitHub Release，不迁移其他机器的 managed install，不修改无关的缓存命中率算法。

## Open Questions

- 无。状态设计采用明确的取消状态/转换，取消后允许重新收集输入；不改变成功创建的单次原生确认约束。
- 任务创建字段采用现有 Trellis `description`/默认 PRD Goal 作为最小跨会话承载，不新增第二套需求存储。
