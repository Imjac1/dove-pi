# Dove 请求与项目流程加固

## 背景

真实提示词全流程测试暴露出几个彼此关联的问题：中文只读约束会被误判为执行、普通 Lookup 会弹出 Trellis 初始化、自然语言“继续当前任务”会反复探测不存在的私有路径并消耗约 31.7 万 prompt token、默认 ledger 会在 Git 工作区生成 `.agent-data`，同时 cache audit 与 provider ledger 缺少足够精确的诊断字段。

这些问题必须在 Dove 侧修复。Trellis 是外部维护的 ProjectProvider，不是 Dove 的内嵌任务引擎。

## 目标

1. 让 Dove 按动作及其否定/只读约束准确选择 `chat`、`lookup`、`project-work`、`execution`。
2. 让“继续当前项目任务”通过 ProjectProvider 的公开结构一次性得出确定结果，不猜测 Trellis 私有目录。
3. 让 bootstrap、工具暴露与执行权限严格服从同一个 RequestPlan。
4. 在不误杀正常大型任务的前提下，把重复失败和无进展信号反馈给模型。
5. 消除普通使用对项目 Git 工作区的运行状态污染。
6. 让 provider 请求和缓存策略可精确审计，便于定位高 token、低缓存命中和截断问题。
7. 保留 Pi 与 Trellis 的独立更新能力，不 patch 任一上游项目。

## 强制边界

- 不修改、fork、vendor 或复制 `@mindfoldhq/trellis` 的源码、模板、脚本和内部运行结构。
- 不读取或依赖 `.trellis/.runtime` 等 Trellis 私有实现路径。
- 不创建 `.pi/tasks`、Dove 任务数据库或 `.trellis/tasks` 镜像；ProjectProvider 是项目任务状态的唯一来源。
- Dove 只依赖 `ProjectProvider` 的公开契约。Trellis 后续变化通过 provider adapter 兼容，不扩散到 Core 或 Pi adapter。
- 不 patch Pi 的更新检查。Dove 只能提供显式快速/离线启动选项并说明其影响，默认保留 Pi 正常更新提醒。
- 不引入通用“达到次数就硬中止”的守卫，避免误杀有真实进展的大型任务。

## 功能需求

### R1. 请求意图与权限

- 按分句/动作判定极性；`不要`、`别`、`无需`、`只读` 等约束只否定其覆盖的动作。
- “分析……不要修改文件、不要运行命令”必须是 Lookup，并且 provider-visible mutation tools 为 0。
- “继续当前项目任务”必须是只读 Project Work，不因“任务”一词获得执行权限。
- 后续独立的明确执行指令仍必须升级为 Execution，不能被前一句只读描述错误降级。
- planner、tool profile、middleware 共用同一 RequestPlan 结果，不各自实现另一套关键词判断。

### R2. Provider-neutral continuation projection

- Core 提供稳定的 continuation projection，至少区分 `current`、`single_candidate`、`ambiguous`、`none`。
- provider 给出 current task 时返回 `current`；current 为空且仅有一个 in-progress task 时返回 `single_candidate`；多个候选返回 `ambiguous`；无候选返回 `none`。
- projection 只总结公开 project context，包含候选任务和可执行的下一步提示，不修改、启动、完成或归档任务。
- `agent_project_status` 与 `agent_project_context` 返回同一 projection。
- 模型 guidance 明确优先使用结构化状态；不得为续接探测 `.trellis/.runtime`、`.pi/session.json` 或 `.pi/tasks`。

### R3. Bootstrap 与进度反馈

- bootstrap 使用已生成的 RequestPlan；Chat/Lookup 不弹项目初始化。
- 仅 Project Work、Execution 或用户明确要求初始化/创建项目任务时可以提供 bootstrap。
- ProgressGuard 的重复错误/无状态进展 warning 必须进入当前 tool result 的模型可见内容，而非只显示 TUI warning。
- warning 保持 advisory；最终停止权仍由模型、用户或已有 provider budget/safety boundary 决定。

### R4. 状态目录

- `DOVE_PI_STATE_DIR` 保持最高优先级。
- 默认运行状态迁移到用户级 Dove/Pi 状态根目录，并按规范化 workspace path 的稳定 hash 隔离。
- CLI 与 Pi adapter 复用同一 resolver，不能再次出现不同默认路径。
- 旧 `.agent-data` 只做必要的兼容读取/一次性安全迁移，不删除用户数据，不持续双写。
- 在普通 chat、lookup 和 project status 流程中，项目根目录不得新生成 `.agent-data/execution.jsonl`。

### R5. Provider 与缓存可观测性

- provider 最终 payload gate 记录实际 provider-visible tool count、序列化 tool schema bytes 和显式 `cachePolicyVersion`。
- request/session/provider-call 关联字段保持稳定，accepted/rejected/completed 都可追踪。
- v2 context snapshot details 明确写入 `cachePolicyVersion: 2`。
- cache audit 优先读取显式版本；只对旧记录执行兼容推断，不再用易受冒号影响的 `split(":")` 判断。
- 诊断字段不得把完整 prompt、secret 或 tool 参数复制进 ledger。

### R6. 启动网络选项

- Dove launcher 提供清晰、显式的快速/离线启动方式，映射到 Pi 官方支持的环境开关。
- 只跳过 Pi 版本检查与完全离线必须是不同语义；默认启动不强制离线。
- 安装、update 和启动帮助文档说明选项、缓存/更新权衡及恢复方式。

## 验收标准

- [x] 两条真实中文只读提示词均分类为 Lookup，provider-visible mutation tools 为 0。
- [x] “继续当前项目任务”最多进行一次结构化 project context/status 读取后给出 current、唯一候选、歧义或无任务结论。
- [x] continuation 流程不访问 Trellis/Pi 私有猜测路径，不出现 30 万 token 级循环。
- [x] “看看 package.json，这个项目是做什么的”不弹 Trellis 初始化。
- [x] “用一句话总结我们刚才完成了什么”按 Chat 处理，不加载完整 Lookup schema。
- [x] advisory progress warning 对模型可见，且有测试证明不会直接硬中止正常任务。
- [x] 普通新目录使用不生成 `.agent-data/execution.jsonl`；环境变量覆盖和旧路径兼容有效。
- [x] ledger 精确记录 tool count/schema bytes/cache policy version，cache audit 正确识别带多段冒号的 v2 epoch。
- [x] 快速/离线启动选项不修改 Pi，不改变默认在线更新行为。
- [x] 原 8 条 prompt-to-agent E2E 提示词全部复测并保存前后对比证据。
- [x] TypeScript、Node tests、installer tests、doctor、Pi smoke 和相关 cache/benchmark gates全部通过。

## 非目标

- 改造 Trellis 的任务模型、CLI、skills 或 update 机制。
- 自动启动/完成/归档 ProjectProvider 中的任务。
- 为每个外部项目管理器建立专属 Dove 任务副本。
- 通过默认离线掩盖网络慢、扩展更新慢或 provider 路由问题。
- 本任务内重新设计整个 TUI 或通用自主 agent 调度器。
