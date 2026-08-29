# Dove Pi 正常用户全流程 E2E 报告

## 结论

当前版本的基础聊天和真实“读代码 → 修改 → 测试”闭环可以使用，但**暂不建议直接进入大型项目的全自动 Trellis 流程**。

阻断点不是模型速度，而是自然语言 `continue` 缺少确定性状态入口和停止条件：一次请求持续 110 秒，产生 13 次 Provider 请求、19 次工具调用和 317,360 个累计 prompt token，最终只能人工中断。它占整场测试累计 prompt 的 70.3%。89.7% 的该轮缓存读取率只是缓存了重复循环，不能说明流程高效。

第二个高风险问题是请求意图并不真正“exact”。两条明确包含“不要修改、不要运行命令”的中文请求都被规划为 `execution/elevated`，执行工具 schema 开销保持在 8,815 token。模型这次自觉只读，但权限边界本身没有收窄。

## 测试环境

- 仓库提交：`e8883a0`
- 普通命令：`C:\Users\rebot\AppData\Local\DovePi\bin\dove-pi.ps1`
- 该命令实际转发到当前源码 checkout 的 `dove_pi.py`，因此运行的是本仓库当前代码；`doctor` 同时报告 `managedInstall.installed=false`，说明这不是完整 managed release 安装验证。
- Dove Pi `0.1.0`，Pi `0.84.3`，Trellis `0.6.16`
- Provider：`12321`
- 模型：`deepseek-ai/DeepSeek-V4-Flash`
- 声明限制：context `1,000,000`，max output `163,840`
- Pi thinking：`high`；Dove mode：`Standard`
- 临时 fixture 基线提交：`653dc42`
- 会话：`01a04f77-50c6-7515-94a9-839efbf21c1a`

模型元数据内部一致，所有预算检查的 `overflowTokens=0`；本次问题不能归因于旧的 12.8K/16K 模型配置错误。

## 正常旅程结果

| 场景 | 结果 | Provider 请求 | 累计 prompt | 工具 | 关键观察 |
| --- | --- | ---: | ---: | ---: | --- |
| `hi` | 通过 | 1 | 2,937 | 0 | 6.1 秒；比旧 Auto 10,866 降低 73.0% |
| 只回复“收到” | 通过 | 1 | 2,395 | 0 | 1.2 秒；严格按要求响应 |
| 查看 `package.json` | 部分通过 | 4 | 15,998 | 5 | 实际全只读，但 Lookup 前错误弹出 Trellis 初始化询问 |
| 只读分析源码和测试 | 部分通过 | 2 | 24,475 | 2 | 实际只读；规划器却判为 Execution/Elevated |
| 修复并验证 | 通过 | 3 | 45,950 | 2 | 自主 `replace`、`npm test`，2/2 通过 |
| Execution 后只读 | 失败 | 2 | 32,034 | 1 | 实际只调用 `read`，但仍被重新判为 Execution，权限未真正收窄 |
| 一句话总结 | 部分通过 | 1 | 10,025 | 0 | 回答正确；错误判为 Lookup，并发生整段 cache miss |
| Trellis natural continue | 阻断失败 | 13 | 317,360 | 19 | 110 秒循环，无最终答案，人工中断 |

### `hi` 的改善与剩余差距

`hi` 从旧基线 10,866 input 降到 2,937，下降 7,929（73.0%），说明 Chat 去除大工具目录的方向有效。它仍比历史同模型 `--no-tools` 的 1,273 高 1,664（约 131%），所以“接近无工具基线”只能判为部分满足。

该请求没有实际工具调用，planner 为 `chat`，估算的 tool schema overhead 为 964 token。但当前 ledger **没有记录精确的 provider-visible tool names/count 或序列化字节数**，因此不能仅凭“模型没调用工具”证明 Provider 端工具数一定为零。这是可观测性缺口，不应在报告中伪造通过。

### 真实执行闭环

Agent 将：

```js
return subtotal - discountPercent;
```

修正为：

```js
return subtotal * (1 - discountPercent / 100);
```

随后自主运行 `npm test`，结果 2 passed / 0 failed。fixture 中唯一业务源码变化是 `src/invoice.js`，说明核心编码能力和 hashline 编辑链路正常。

副作用是 Dove 在普通 Git 工作区根目录创建了未跟踪的 `.agent-data/execution.jsonl`。账本内容未发现凭据，但这种默认落点会污染用户仓库；更合适的位置是被忽略的 `.dove/state/`、用户级状态目录，或自动维护对应 `.gitignore`。

## 阻断问题：Trellis continue 失控

`/project init` 本身成功，TUI 热重载也成功，创建了：

- `.trellis/tasks/00-bootstrap-guidelines/task.json`
- `status=in_progress`
- developer identity `Dove Pi E2E`

但 `python ./.trellis/scripts/task.py current --source --json` 返回 `current_task=null`，而 `get_context.py` 同时能列出一个 in-progress 的 `Bootstrap Guidelines`。也就是说，系统存在两个不同概念：

1. 当前 session pointer：空；
2. 项目内 in-progress task：恰好一个。

Pi 侧 `agent_project_status` 只返回 `taskCount=1`，没有 `currentTask` 或“唯一 in-progress candidate”。模型随后没有使用一个确定性结果结束，而是在以下位置间反复猜测：

- `.trellis/tasks`：13 次相关访问；
- 不存在的 `.trellis/.runtime`：3 类错误访问；
- `.pi/tasks/session-15756-15756`：存在但为空；
- 不存在的 `.pi/session.json`。

量化结果：

- 13 次 Provider 请求；
- 19 次工具调用（`ls` 10、`read` 7、`grep` 1、`agent_project_status` 1）；
- 4 次工具错误，全部来自猜测不存在的状态路径；
- uncached input 32,688；cacheRead 284,672；累计 prompt 317,360；
- 无 compaction 事件、无显式 retry 事件；
- 最终 stop reason 为 `aborted`，没有用户可用答案。

这不是正常的大项目探索成本，而是状态机缺失导致的无进展循环。

## 请求策略问题

当前中文 negation 处理存在回归：

- “但不要修改文件、不要运行命令” → `execution/elevated`
- “别修改或运行任何命令” → `execution/elevated`
- “用一句话总结……” → `lookup`

前两轮的实际工具选择恰好安全，不代表策略安全。两轮都保留了与 Execution 相同的 8,815-token tool schema overhead；后一轮简单总结也携带 2,179-token Lookup schema并发生 cache miss。

修复应基于分句后的肯定/否定动作约束，而不是继续叠加更贪婪的正则。至少把本报告中的三个原始提示词加入 planner 和真实 middleware 回归测试。

## 缓存与压缩

隔离审计结果：

- 27 次 Provider 请求；
- uncached input 82,534；
- cacheRead 368,640；
- cacheWrite 0；
- output 9,633；
- 累计 prompt 451,174；
- 全会话 cache-read share 81.71%。

会话没有任何 compaction 事件。这一轮总长度并未逼近 1M 单请求上下文上限，但缺少语义循环熔断，导致大量重复请求先发生；不能把压缩当成修复循环的主要手段。

`dove-pi cache audit` 把该会话标记为 `v1`。这个标签不可信：当前检测器通过 `epoch.split(":").length` 猜版本，但 session 中保存的是带 `:request:<id>` 后缀的 per-turn epoch，Trellis revision 自身也含冒号。当前运行代码已经使用 v2 的稳定 snapshot epoch。应把 cache policy/version 作为显式字段写入事件，不再从 epoch 字符串形状推断。

## 其他体验问题

- 新目录首次启动约 10 秒，启动时串行执行多次 `npm view`，并显示 Pi/扩展更新提示；更新检查污染 TUI 首屏，是“新目录卡住”的可信来源。
- `/project init` 输出包含大 banner、Codex hooks 警告和完整屏幕重绘，成功但噪声大。
- Pi Lens 报告 Python LSP active，而 marksman/json LSP failed；不影响本 fixture，但会造成“已安装即健康”的错觉。
- `doctor` 的 managed install 判定与实际 shim 可用状态矛盾：命令可运行，却显示 `installed=false`。安装/更新应在独立发布任务里验证，不应由本 E2E 报告假装通过。

## 验收结论

| 验收项 | 结论 |
| --- | --- |
| 模型元数据一致 | 通过 |
| Fresh Auto `hi` 明显接近无工具开销 | 部分通过：较旧 Auto 大幅改善，但仍高于 `--no-tools`，且精确工具数缺证据 |
| Response-only 不调用工具 | 通过 |
| Lookup/Project Work 无写入行为 | 行为通过；权限规划失败（只读分析被判 Execution） |
| Execution 正确修复并验证 | 通过 |
| Execution 后移除写权限 | 失败：当前只读请求被再次误判为 Execution |
| Trellis continuation 确定、无重复上下文 | 阻断失败 |
| 每个 Provider 请求可观测 | 部分通过：duration/usage/stop/schema token estimate 齐全；精确工具 count/schema bytes 缺失 |
| 普通 TUI + 默认 Auto | 通过 |
| fixture containment | 通过；但 `.agent-data/` 污染 Git 状态 |
| 适合大型项目试运行 | 暂不通过 |

## 建议拆分的后续修复

不要在本评估任务里混改产品。建议新建三个窄任务，按顺序推进：

1. **确定性的 Trellis continue**
   - `/project continue` 和自然语言 continue 都调用同一个结构化 service；
   - 一次返回 `currentTask`、`inProgressCandidates`、`nextPhase/nextStep`、`source`；
   - current pointer 为空但只有一个 in-progress task 时，明确返回“未绑定 + 唯一候选”，不遍历私有 runtime 路径；
   - 对重复路径、重复负结果和“多轮无状态进展”设置语义熔断，并给用户明确下一步。

2. **修复 request intent/authority**
   - 用分句和动作极性处理中文 `不要/别/无需/只读`；
   - 只读约束必须先于 `修复/测试/命令` 等名词触发；
   - 将本次真实提示词加入 planner、tool profile、middleware 集成测试；
   - 验证 Execution → read-only 后 provider-visible mutation tools 真正为零。

3. **诊断与启动体验**
   - ledger 记录每个 Provider request 的 tool profile、精确 tool count、schema bytes 和 cache-policy version；
   - 修复 cache audit 的 v1/v2 误判；
   - 把更新检查移出阻塞首屏，使用 TTL/后台检查和单行摘要；
   - 将 execution ledger 移出普通 Git 工作区或自动忽略；
   - 单独验证 managed install/update，使 `doctor` 状态与真实入口一致。

完成前两项后，应使用同一个 fixture 和同一组自然提示词重跑。通过标准不是“缓存率高”，而是 Trellis continue 在一次确定性状态读取后给出答案、只读请求不暴露 mutation tools、全旅程不再出现无进展循环。

