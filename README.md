# Dove Pi（中文）

英文文档：[README.en.md](README.en.md)

Dove Pi 是一个 Windows 优先的个人 Agent 运行环境。用户只需要面对 Dove Pi；Pi 是交互宿主，Dove 负责执行，Trellis 在后台负责项目上下文和任务管理。

## 环境要求

- Windows 10/11
- Python 3.10+
- Node.js `>=22.19.0`
- PowerShell 5.1 或 PowerShell 7（推荐 7）

安装器默认安装完整的 `max` 扩展 profile。这里的 `max` 只是扩展集合名称，不是 Dove 的执行策略。

## 最短使用流程

```powershell
python .\dove_pi.py install
cd 你的项目目录
dove-pi
```

首次进入没有 `.trellis/` 的项目时，Pi 会询问是否初始化。确认后 Dove 会自动创建 Trellis、切换 Provider 并加载上下文；拒绝则继续使用 lightweight 模式。也可以手动执行 `/project init`。

初始化/更新命令会在宿主允许时自动刷新 Pi 资源；如果当前生命周期不支持热重载，下一次 `/reload` 即可加载新 skills。

## 核心关系

```text
用户 → Dove Pi → Agent
              ├─ 自动发现项目
              ├─ 自动读取上下文
              ├─ 自动建议工作流
              └─ 按需调用 Trellis 管理任务
```

| 部件 | 负责什么 |
| --- | --- |
| Pi | 模型、TUI、原生快捷键和会话 |
| Dove | 能力、策略、审批、调度、证据和执行记录 |
| Project Provider | 项目发现、上下文标准化和任务操作 |
| Trellis | 项目、任务、规范、工作流、记忆和日志 |

Trellis 是项目数据的唯一权威，Dove 是执行数据的唯一权威。Dove 不复制第二套任务/规范数据库，也不直接改写 `.trellis/` 文件。

上下文只有一条读取链路：

```text
Project Provider → ProjectContextSnapshot → Context Compiler → Agent
```

因此 `/project bind lightweight` 会同时影响项目状态、任务操作和模型上下文，不会出现“界面是 lightweight、模型仍在读 Trellis”的半切换状态。

## 日常工作

初始化完成后，直接用自然语言描述需求：

```text
修复登录超时问题，并补充测试
```

Dove 会自动判断请求类型、读取相关上下文、建议 workflow skill、优先使用已验证的 capability/recipe，并记录执行结果。普通聊天不会自动创建任务；明确要求跟踪或进行多步骤代码变更时才进入任务流程。

## 任务管理

推荐直接说：

```text
开始跟踪这个开发任务
完成当前任务
归档这个任务
```

Agent 可以调用 Dove 的 `agent_project_task` 工具完成 `create`、`start`、`finish`、`archive`。工具会先请求交互式确认，并通过 Provider 和 Dove mutation ledger 记录。

兼容命令：

```text
/task create <标题>
/task start <任务目录或名称>
/task finish
/task archive <任务目录或名称>
```

## Skill 怎么用

Skill 是 Agent 的工作流说明，不是 Trellis CLI 命令。Dove 会根据意图给出 advisory 建议：

- 需求分析、方案设计 → `trellis-brainstorm`
- 修改或修复代码 → `trellis-before-dev`
- 测试、审查、验证 → `trellis-check`
- 继续上次工作 → `trellis-continue`
- 收尾、归档、记录经验 → `trellis-finish-work`

建议不会自行修改项目。需要执行时可以显式调用：

```text
/skill:trellis-start
/skill:trellis-continue
/skill:trellis-brainstorm
/skill:trellis-before-dev
/skill:trellis-check
/skill:trellis-update-spec
/skill:trellis-finish-work
```

查看 skills：

```text
/skills
/skills trellis
```

## 自动和手动的边界

| 行为 | 默认方式 |
| --- | --- |
| 发现项目、Provider、任务上下文 | 自动 |
| 选择上下文范围和执行策略 | 自动 |
| 建议 workflow skill | 自动建议 |
| 执行 skill | 显式调用或按工作流确认 |
| 创建/修改/完成任务 | 明确意图 + 交互式确认 |
| Trellis 初始化 | 首次启动询问，或 `/project init` |
| Trellis 更新 | `/project update` 明确触发 |
| Provider 绑定 | 仅高级配置使用 |

## 常用命令

```text
/status
/status full
/project
/project doctor
/project init
/project update
/project bind trellis
/project bind lightweight
/memory [关键词]
/capabilities
/mode fast|standard|ultra
Ctrl+Alt+M
```

普通使用不需要记住 `/project bind`、`/task ...` 或 `/skill:*`；它们是高级/兼容接口。

## 执行策略

默认使用 Standard。三种策略只影响上下文深度和调度积极程度，不改变权限、审批、目标范围或模型限制。

| 策略 | 适合场景 |
| --- | --- |
| Fast | 简单、确定、短任务；优先精确能力匹配 |
| Standard | 普通开发和多步骤任务；默认推荐 |
| Ultra | 复杂任务；加载更多相关规范和记忆，并自适应压缩 |

Dove 没有 `max` 执行策略。Pi thinking level 的 `max` 和安装器的 `max` 扩展 profile 是另一回事。

## Trellis 更新

Trellis 更新必须显式执行：

```text
/project update
```

或：

```powershell
dove-pi project update
```

更新由 Trellis 自己处理模板哈希、用户修改保护、冲突和 `.new` 文件。Dove 只负责调用 Provider、刷新状态并记录结果。

## 故障排查

```powershell
dove-pi doctor
dove-pi project
dove-pi skills trellis
```

Pi 内可以执行 `/project doctor` 和 `/skills trellis`。

- 没有 Trellis：确认初始化提示，或执行 `/project init`；
- skills 没出现：执行 `/reload`，并确认 Pi 已信任项目目录；
- Provider degraded：先看 `/project doctor`，修复 `.trellis/` 后再更新；
- 想暂时绕过 Trellis：`/project bind lightweight`。

## 安装与验证

```powershell
python .\dove_pi.py install --verify full
python .\dove_pi.py install --no-font
python .\dove_pi.py install --no-path
python .\dove_pi.py install --clean

npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

`setup` 是 `install` 的别名。重复安装会复用 lockfile 和 npm 缓存，不会隐式升级 Pi 或全局扩展。

当前版本是可运行的基础 MVP。任务 replay、完整远程控制面、第二套原生项目数据库和自动记忆晋升暂不在首个版本范围内。

项目规范位于 [.trellis/spec/](.trellis/spec/)，当前任务位于 [.trellis/tasks/08-26-personal-agent-os/](.trellis/tasks/08-26-personal-agent-os/)。
