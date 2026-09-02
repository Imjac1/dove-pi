# Dove Pi

[English](./README.en.md)

Dove Pi 是一个面向 Windows 的个人编程 Agent，基于
[Pi](https://github.com/badlogic/pi-mono) 构建。它保留 Pi 的模型与扩展开放性，
同时补上目标连续性、轻量项目记忆、循环控制、诊断和可恢复更新。

简单说：你在自己的项目目录运行 `dove-pi`，然后像和开发同事说话一样直接描述需求。

## 适合谁

- 希望自由选择模型、Provider 和 Pi 扩展；
- 在 Windows 上做长期或大型项目，需要任务、规范和上下文连续性；
- 希望 Pi 和扩展的工具能力保持完整，同时减少重复提问和无效循环；
- 希望更新失败时能修复或回滚，而不是重装全部环境。

## 安装

### 方式一：从源码安装（当前即可使用）

需要：

- Windows 10/11；
- PowerShell 5.1 或更高版本；
- Python 3.10 或更高版本；
- Node.js 22.19 或更高版本；
- Git。

```powershell
git clone https://github.com/Imjac1/dove-pi.git
cd dove-pi
python .\dove_pi.py install
```

安装器会执行依赖安装和快速验证，默认安装完整的 `max` 扩展组合，并把托管应用放到：

```text
$env:LOCALAPPDATA\DovePi
```

安装完成后重新打开终端，然后检查：

```powershell
dove-pi --version
dove-pi doctor
```

如果不想安装可选扩展：

```powershell
python .\dove_pi.py install --no-extensions
```

### 方式二：GitHub Release 一键安装

直接运行：

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 | iex
```

需要避免修改 PATH/字体或跳过可选扩展时，先下载脚本再传入高级开关：

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install.ps1
.\install.ps1 -NoPath -NoFont -NoExtensions
```

想先检查脚本再执行：

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

如果地址返回 `404`，表示仓库还没有发布首个 Release，请使用上面的源码安装。不要把
`master` 分支压缩包当作正式安装包。

Release 安装器会复用符合版本要求的 Python 和 Node.js；缺失或版本过旧时，会通过 `winget`
安装运行时（此时需要系统已安装 Microsoft App Installer）。它还会校验下载文件的 SHA-256，
验证通过后才切换当前版本。

安装完成后重新打开终端，并运行 `dove-pi --version` 和 `dove-pi doctor`；然后再按下面的三步
进入自己的项目。

## 三步开始使用

### 1. 进入你的项目

```powershell
cd C:\path\to\your-project
dove-pi
```

Dove 始终把启动命令时的当前目录当作目标项目。你的代码不需要放进 Dove 的安装目录。

第一次使用、还没有配置模型时，在 Dove Pi 中输入：

```text
/login    选择 Provider 并登录或填写 API Key
/model    选择要使用的模型
```

这两个命令由 Pi 提供，凭据保存在 Pi 的用户目录，不会写进当前项目。

### 2. 直接描述需求

```text
解释一下这个项目的入口和主要模块。
修复当前测试失败并验证结果。
继续当前项目任务。
```

Dove 的 Auto 模式不会按请求裁剪工具。Pi 以及你安装的 Pi 扩展决定模型可以使用哪些工具；
Dove 只观察最终 schema，用于缓存和冲突诊断。请求分类只影响上下文、目标续接和预算，
不决定工具权限。

### 3. 按需要选择模式

在 Dove Pi 中输入：

```text
/mode fast
/mode standard
/mode ultra

/dove-mode auto       自动选择上下文模式
/dove-mode chat       独立对话，不加载项目任务上下文
/dove-mode work       保留项目上下文，复杂工作才创建正式产物
/dove-mode status     查看当前上下文模式
```

- `fast`：简单、明确、优先快速完成；
- `standard`：日常默认；
- `ultra`：复杂项目、长链路分析和高强度执行。

`Ultra` 是运行策略；`max` 是安装时的扩展组合，两者不是同一个概念。

## Dove Native Workflow

普通聊天和小型代码任务直接执行，不需要初始化项目、创建任务或通过阶段门禁。明确的规划、架构、
跨模块或多文件请求会在后台建立一个正式 Dove 任务；状态索引存放在 `.dove/state.json`，正式产物
存放在 `.dove/tasks/<task-id>/`。

你也可以显式初始化或查看状态：

```powershell
dove-pi project init
dove-pi project doctor

# Dove task workflow; commands emit JSON
dove-pi task list
dove-pi task current
dove-pi task status [task]
dove-pi task continue [task]
dove-pi task verify [task]
dove-pi task create "Improve cache hit rate" --description "..."
dove-pi task start <task>
dove-pi task finish
dove-pi task archive <task>

# Lightweight session journal
dove-pi session record --title "Cache validation" --summary "..." --test "npm test" --next-step "..."
dove-pi session list
```

初始化只创建 Dove 的轻量索引，不安装依赖，也不执行 Trellis 脚本。正式任务会按需生成 PRD、design、
implement 和 acceptance 产物；它们用于恢复上下文和验收记录，不是开始编码的前置条件。

之后可以直接说：

```text
继续当前项目任务。
```

Dove 会直接读取当前原生目标。已有 `.trellis` 的项目仍可读取未完成任务、spec 和 journal 作为
兼容数据，但 Dove 不执行 `.trellis/scripts/task.py`、不需要 Trellis npm 包，也不会修改或删除
原有 `.trellis`。选择旧任务继续时，只把必要的目标信息导入 `.dove/state.json`。

## Pi 和 Dove 的关系

| 组件 | 负责什么 |
| --- | --- |
| Pi | 模型、会话、TUI 和原生工具宿主 |
| Dove | 请求上下文、目标续接、循环控制、诊断和执行记录；不取代 Pi 的工具权限 |
| Dove Native Workflow | `.dove/` 中的紧凑状态，以及正式 PRD、设计、实现、验收和证据产物 |
| Legacy reader | 只读投影已有 `.trellis` 任务、spec 和 journal |

Pi 是唯一工具和执行权威。Dove 不增加权限层，只管理上下文、目标连续性、无进展循环和效率诊断。

## 常用命令

### Dove Pi 内部

```text
/status                 查看简要状态
/status full            查看完整诊断
/project                查看项目状态
/project init           显式创建 Dove 原生项目状态（通常无需执行）
/task ...               可选地记录、完成或归档 Dove 目标
/memory [query]         搜索项目记忆
/capabilities           查看 Dove 能力
/dove-tools auto        将工具管理权恢复给 Pi
/dove-tools core        显式使用兼容的精简只读集合
/dove-tools full        显式启用所有已安装工具
/dove-thinking status   查看思考策略
/dove-mode status       查看上下文模式
```

`/thinking` 是 Pi 原生命令；Dove 使用 `/dove-thinking`，不会覆盖它。

### 维护安装

```powershell
dove-pi update --check   # 只检查，并显示当前/最新 Pi 版本
dove-pi update           # 原子更新 Dove 及其锁定的 Pi 运行时
dove-pi repair           # 修复当前版本或恢复 previous
dove-pi rollback         # 切回 previous 应用版本
dove-pi uninstall --yes  # 卸载 Dove，保留用户与项目数据
```

Pi 是 Dove Release 中的锁定组件，不使用 Pi 的全局自更新。只要新 Dove Release
声明了新的 Pi 版本，`dove-pi update` 就会在 staging 中安装并验证该精确版本，成功后
与 Dove 一起原子切换；失败时继续使用旧版本。更新输出会显示 Pi 的旧版本和新版本。
卸载会同时删除 Dove 托管应用和持久化的 launcher PATH 项，新终端生效。

在首个 Release 发布前，从源码安装的用户通过下面的方式更新：

```powershell
git pull
python .\dove_pi.py install
```

### 启动网络控制

```powershell
dove-pi --offline             # 本次启动不做 Pi 网络/扩展包检查
```

托管启动默认关闭 Pi 自身的版本更新提示，因为直接更新 Pi 会破坏 Dove Release 的一致性与
回滚能力；统一使用 `dove-pi update`。兼容参数 `--skip-version-check` 仍可使用。
`--offline` 不会禁用之后显式执行的安装或更新命令。

## 扩展组合

默认安装 `max`。其他可选组合：`minimal`、`dev`、`research`、`security`。

```powershell
python .\dove_pi.py install --profile minimal
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --no-extension-updates
```

Dove 只管理自己声明的扩展及精确版本，不会运行无目标的 `pi update --extensions`，因此不会
顺便升级用户自己安装的 Pi 扩展。可选扩展失败会显示为 `degraded`，不会伪装成健康状态。

## 数据放在哪里

托管应用：

```text
$env:LOCALAPPDATA\DovePi\
  bin\
  app\versions\
  cache\releases\
  state\install.json
  logs\
```

安装、更新、回滚和卸载不会删除：

- `~/.pi/agent` 中的凭据、模型、会话、设置和用户扩展；
- `~/.pi/agent/dove/workspaces/<hash>` 中按项目隔离的 Dove 运行状态；
- 项目中的 `.dove/` 和旧 `.trellis/`；
- 你的源码、Git 分支和未提交修改。
- Python、Node.js、字体和用户自己安装的 Pi 扩展。

普通会话不会在源码仓库生成 `.agent-data/execution.jsonl`。

## 高级接口

Dove Capability Protocol 让 CLI、JSON-RPC、MCP 和 Pi 共用同一套能力格式与执行记录：

```powershell
dove-pi capability list
dove-pi capability run workspace.inspect --args='{"path":"package.json"}'
dove-pi capability run dev.project_test --approve
dove-pi rpc
dove-pi mcp
```

MCP stdio 配置：

```json
{"command":"dove-pi","args":["mcp"]}
```

在 Pi 会话内，Pi 工具调用本身就是宿主执行决定，Dove 不再追加确认。独立 CLI 仍需本地
`--approve`；RPC/MCP 传输不能在请求内容中自行声明授权。

## 开发与验证

```powershell
npm ci
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

正式 Release 只由与 `package.json` 版本一致的 `v*` tag 触发。普通 push 不会发布安装包。

## 常见问题

### 找不到 `dove-pi`

重新打开终端，或运行：

```powershell
& "$env:LOCALAPPDATA\DovePi\bin\dove-pi.cmd"
```

### 一键安装地址返回 404

仓库还没有发布首个 GitHub Release。先使用源码安装。

### Python、Node.js 或 npm 版本不够

源码安装请先安装 Python 3.10+ 和 Node.js 22.19+。Release 一键安装器会在 winget 可用时自动
补齐运行时。

### 扩展显示 degraded

关闭可能占用 native binary 的 Pi/Node 进程，然后运行：

```powershell
dove-pi repair
```

### 项目没有 Dove 状态

无需处理，普通请求会直接执行并在需要时静默创建状态。需要提前创建空状态时才运行
`dove-pi project init`。
