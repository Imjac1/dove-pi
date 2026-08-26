# Dove Pi（中文）

英文文档：[README.en.md](README.en.md)

Dove Pi 是一个 Windows 优先的个人 Agent 运行环境。它使用官方 Pi 作为交互宿主，使用 Dove 作为执行面，并把 Trellis 作为项目管理和上下文控制面。

## 架构

```text
Pi：交互宿主
 └─ Dove Pi Adapter：命令、工具、快捷键、状态栏
     ├─ Dove Core：能力、策略、审批、调度、证据、执行记录
     ├─ Windows Runtime：PowerShell 与事务式工作区操作
     └─ Trellis Provider：项目、任务、规范、工作流、日志、记忆
```

核心不直接依赖 Pi 或 Trellis 的内部实现。当前目录是项目边界；如果发现 `.trellis/`，自动使用 Trellis；没有 Trellis 时提供引导初始化和轻量模式。

数据权威只有一个：Trellis 管理项目数据，Dove 管理执行数据。Dove 不复制任务/规范数据库，也不直接改写 `.trellis/` 文件。

## 环境要求

- Windows 10/11
- Node.js `>=22.19.0`
- PowerShell 5.1 或 PowerShell 7（推荐 PowerShell 7）
- Pi 0.84.x 测试兼容范围
- Trellis 0.6.x 或兼容的本地 provider

## 安装

在仓库目录执行：

```powershell
python .\dove_pi.py install
```

默认行为：

- 安装锁定的 Node 依赖；
- 安装完整的 `max` 扩展 profile；
- 尝试配置 Nerd Font；
- 创建用户级 `dove-pi` launcher；
- 执行快速类型检查和 Pi 集成验证。

常用参数：

```powershell
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --verify full
python .\dove_pi.py install --no-font
python .\dove_pi.py install --no-path
python .\dove_pi.py install --clean
```

`setup` 是 `install` 的别名。旧参数 `--extensions`、`--skip-checks` 仍兼容。重复安装会复用 lockfile 和 npm 缓存，不会每次隐式更新 Pi 或全局扩展。

## 启动与项目检查

从目标项目目录启动：

```powershell
dove-pi
```

也可以直接使用：

```powershell
python .\dove_pi.py
```

检查运行环境和项目 provider：

```powershell
dove-pi doctor
dove-pi project
dove-pi project init
dove-pi project update
```

`project update` 只在明确调用时执行 Trellis 的迁移/更新逻辑。更新前应保留快照；用户修改的模板会通过 Trellis 的冲突和 `.new` 机制处理。

## Trellis 是自动调用还是手动调用？

两者都有，但职责不同：**读取和上下文组装是自动的，项目初始化、更新和任务修改是显式的。**

| 场景 | 调用方式 | 实际行为 |
| --- | --- | --- |
| Dove 启动 | 自动 | 从当前目录向上发现最近的 `.trellis/`，选择 `TrellisProvider`。 |
| 每次 Agent 请求 | 自动 | 在请求进入模型前读取任务、活动任务、规范、工作流和记忆，并按 Fast/Standard/Ultra 编译相关上下文。 |
| `/project`、`dove-pi doctor` | 自动读取 | 显示 provider、Trellis 版本、任务生命周期能力和当前任务，不修改项目。 |
| 没有 `.trellis/` | 不自动初始化 | 使用 lightweight provider；不会偷偷创建 Trellis。 |
| `/project init` 或 `dove-pi project init` | 手动 | 在当前目录执行 Dove 的非交互式 Trellis 初始化预设；完成后显示健康状态和 skill 数量，再用 `/reload` 刷新。 |
| `/project update` 或 `dove-pi project update` | 手动 | 显式执行 `trellis update`，不会在启动时自动更新。 |
| `/task create|start|finish|archive` | 手动 | 通过项目内 `.trellis/scripts/task.py` 执行任务生命周期，并写入 Dove mutation ledger。 |
| `/memory [关键词]` | 手动触发读取 | 查询已经规范化的 Trellis journal/memory，不会自动把对话写成永久记忆。 |
| `/project bind trellis|lightweight` | 手动 | 写入 `.dove/project.json` 固定 provider 选择，不直接修改 Trellis 数据。 |

底层调用可以简化为：

```text
Pi 启动
  → Dove 发现当前项目
  → 发现 .trellis/
  → 自动读取和规范化上下文
  → Agent 请求使用相关上下文

用户执行 /task 或 project init/update
  → Dove 做健康检查和锁定
  → 调用 Trellis task.py 或 trellis CLI
  → 记录结果/失败/未完成 mutation
```

因此，正常开发时你不需要手动输入 `trellis` 命令；进入一个已经初始化的 Trellis 项目后，Dove 会自动使用它。如果项目还没有 Trellis，直接在 Pi 中执行 `/project init` 即可，不必退出 Pi。

## 在 Pi 中调用 Trellis skills

Trellis skill 是给 Agent 的工作流说明，不是 Trellis CLI 命令。Pi 会从当前项目及其父目录自动发现 `.agents/skills/**/SKILL.md`，首次使用项目资源时按提示信任项目即可。

常用调用方式：

```text
/skill:trellis-start
/skill:trellis-brainstorm
/skill:trellis-before-dev
/skill:trellis-check
/skill:trellis-continue
/skill:trellis-update-spec
/skill:trellis-finish-work
```

用途分别是：初始化/恢复会话、需求分析、编码前加载规范、质量检查、继续当前任务、记录规范、收尾归档。也可以带补充说明，例如：

```text
/skill:trellis-brainstorm 设计一个新的 Windows capability
/skill:trellis-check 检查当前任务的 provider 和上下文边界
```

如果不确定当前项目是否被 Pi 发现，可以使用 `/skills` 查看所有已发现的 skill；也可以在终端运行：

```text
dove-pi skills
dove-pi skills trellis
```

skill 负责指导 Agent 选择 Trellis 工作流；`/project init`、`/task ...` 等命令负责真正执行项目初始化和任务生命周期。执行 `/reload` 可以刷新 skills、扩展和项目上下文；如果自动发现没有生效，也可以用 `--skill .agents/skills` 启动。

## Pi 命令

- `Ctrl+Alt+M`：Fast → Standard → Ultra
- `/mode fast|standard|ultra`：精确切换策略
- `/status`、`/status full`：查看 Dove 状态和 telemetry 来源
- `/project`：查看项目根目录、provider、Trellis 健康状态
- `/project doctor`：检查 Provider、任务能力和 skill 是否需要 `/reload`
- `/project bind trellis|lightweight`：显式绑定 provider
- `/task create|start|finish|archive ...`：调用 Trellis 任务生命周期
- `/memory [关键词]`：搜索项目日志和记忆
- `/capabilities`：查看可复用能力

Pi 原生的模型选择和退出快捷键保持不变。Pi 的 thinking level `max` 和扩展安装 profile `max` 仍然保留，但它们不是 Dove 执行策略。

## 三种执行策略

| 策略 | 行为 |
| --- | --- |
| Fast | 只加载当前任务 PRD 和运行时规范，优先精确能力匹配，尽量不调度子 Agent。 |
| Standard | 使用相关性排序的任务/规范上下文，按正常规则执行能力和调度。 |
| Ultra | 扩大相关上下文和记忆检索，去重并自适应压缩，不设置 Dove 自己的固定 token 上限。 |

策略不会改变权限、审批、目标范围或模型限制。正在运行的步骤保持原策略；切换只影响尚未开始的步骤。

调度规则：短任务、共享可变状态、Fast Path 默认 inline；独立且耗时较长的分支才考虑 parallel；可隔离的长任务才考虑 subagent。每次决策记录预测成本、实际耗时和原因。

## Trellis 同步模型

同步是 provider 介导的规范化，不是文件镜像：

1. 发现项目根目录和 provider；
2. 在会话开始及上下文敏感操作前读取 Trellis；
3. 转换为 Dove Core 的统一只读模型；
4. 所有项目修改通过 provider；
5. Dove ledger/evidence 保存 Trellis task ID 和 provider revision；
6. 发现冲突时保留双方并要求显式处理，不使用静默的 last-write-wins。

项目内容进入模型上下文时会标记为不可信数据，不能覆盖系统安全策略。快照、证据和日志默认排除凭据文件。

## 开发与验证

```powershell
npm install
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

当前实现是可运行的基础 MVP，不是完整的开发、运维或安全能力市场。任务 replay、完整远程控制面、第二套原生项目数据库和自动记忆晋升暂不在首个版本范围内。

## 当前后续工作

下一阶段重点是：干净环境安装和真实 Trellis 生命周期验证、真实 Pi 子 Agent/channel 调度、成本校准、Trellis 版本更新/冲突/回滚测试，以及发布前的 CI 和安全边界检查。

项目规范位于 [.trellis/spec/](.trellis/spec/)，当前任务位于 [.trellis/tasks/08-26-personal-agent-os/](.trellis/tasks/08-26-personal-agent-os/)。
