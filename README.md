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

网络需要代理时可显式传入 HTTP/HTTPS 代理；未传入时安装器按
`HTTPS_PROXY`、`HTTP_PROXY`、`ALL_PROXY` 的顺序读取环境变量：

```powershell
.\install.ps1 -Proxy http://127.0.0.1:10808
```

想先检查脚本再执行：

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

如果地址返回 `404`，请确认网络、仓库地址和该 Release 资产是否仍可用；也可以使用上面的
源码安装。不要把 `master` 分支压缩包当作正式安装包。

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

### Subagent（实验性只读能力）

Dove Pi 现在提供显式的 `agent_subagent` 工具和 `/subagent` 状态命令。它会启动一个独立
Pi 子进程，用于读取、搜索和梳理当前项目；子进程只拥有 `read`、`grep`、`find`、`ls`，
不能写文件、执行 shell、访问网络或继续委派。普通请求不会自动创建子进程。

启用前需要显式配置子进程入口（建议使用托管安装中的 Node 可执行文件和 Pi CLI 路径）：

```powershell
$env:DOVE_PI_SUBAGENT_EXECUTABLE = (Get-Command node).Source
$env:DOVE_PI_SUBAGENT_PREFIX_ARGS = '["C:\\path\\to\\pi-cli.js"]'
```

配置缺失、路径不可用或子进程失败时，`/subagent` 会返回明确诊断；不会伪造成功，也不会
把显式 subagent 调用悄悄改成普通 inline 请求。自动 dispatch 接入仍在验证中，当前稳定
合同不包含可写子 agent、worktree 合并、嵌套编排或硬 token/耗时上限。

`pi-background-tasks` 仍可通过 Pi 自己的 `bg_run`、`bg_delegate` 等工具显式使用。由于 Pi
扩展 API 不允许 Dove 直接调用另一个扩展的私有执行函数，Dove 不会把这些工具冒充成已经
由 Core 自动接管的 subagent provider。

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

## 完整工作流与真实验证

每次调用都按同一条边界处理：启动器先判断 `--version`、维护命令和本地 CLI；只有未匹配的参数才启动 Pi。CLI 在当前工作目录运行，Native 状态写入项目 `.dove/`，Pi 会话和凭据留在 Pi 用户目录。`rpc`/`mcp` 使用 stdio 时，stdout 只保留协议帧，诊断写 stderr。

推荐按下面顺序做一次真实黑盒检查（使用临时项目，不要指向生产代码）：

```powershell
$env:DOVE_PI_HOME = Join-Path $env:TEMP "dove-pi-audit-home"
$env:PI_CODING_AGENT_DIR = Join-Path $env:TEMP "dove-pi-audit-pi"
New-Item -ItemType Directory $env:PI_CODING_AGENT_DIR -Force | Out-Null
mkdir (Join-Path $env:TEMP "dove-pi-audit-project") -Force | Out-Null
cd (Join-Path $env:TEMP "dove-pi-audit-project")
dove-pi --version
dove-pi --offline doctor
dove-pi project init
dove-pi task create "Smoke task"
dove-pi task status
dove-pi session record --title "Smoke" --test "not run"
dove-pi capability list
dove-pi web status
```

`--offline` 和 `--skip-version-check` 可以放在已知本地 CLI 前面；它们不会把 CLI 单词当成 Pi prompt。`task verify` 只检查产物结构和规划字段，不会运行测试，也不代表验收通过。正式任务需要先冻结 acceptance，再记录 evidence，最后由用户决定 finish/archive。

任务命令如果显式传入不存在或不唯一的任务选择器会返回非零错误；未知的 task/session 参数也会被拒绝，不会静默忽略。完成当前任务后，如果恰好只剩一个 active 任务，Dove 会自动把它设为 current；剩余多个任务时仍需显式选择。

如果会话看起来停在 `pending`、像模型自行停止，先运行 `dove-pi doctor` 和 `/status full`：前者会显示实际执行的 managed release 及其与工作区源码的 `sourceDrift=drifted` 状态；后者会拆分模式、thinking、provider round、只读预算和策略终止原因。源码修复后必须执行 `dove-pi update` 或 `python .\\dove_pi.py install` 才会进入全局启动路径；本项目不会自动改写全局安装。

交互启动会直接进入已锁定版本的 Pi Node 运行时，跳过 Python 安装器中间层；安装、更新、修复和诊断命令仍由 Python 处理。这样减少一次进程启动和安装器依赖加载，不改变 Pi 的工具、上下文或请求策略。

出现异常时先运行 `dove-pi doctor`，再按“当前版本 → previous → 精确身份缓存 → 稳定 Release”的顺序执行 `dove-pi repair`；更新失败不会替换 current。`rollback` 只切换 previous，`uninstall --yes` 只删除 Dove 托管目录和精确 PATH 项。

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

### 策略如何生效

这些设置分工不同：`/mode` 只控制执行强度，`/dove-mode` 只控制项目上下文，
`/dove-thinking` 只控制思考策略，`/dove-tools` 只改变显式兼容工具档案；Auto 模式下
工具权限仍由 Pi 和已安装扩展决定。用 `/status full` 或 `agent_doctor` 查看同一份实际生效
快照，包括请求 intent/lane、策略来源、活动工具数、provider/read-only 预算、上下文与缓存
观察，以及最近的终止原因。快照是诊断投影，不会新增权限或改变现有上限。只读预算中的 `hardStop` 字段保留用于兼容和观测；它是历史请求数提示，不会单独终止产生新观察的读取。只有重复且未变化的观察、重复失败或确认循环等语义上的无进展保护会终止工具调用。

Dove 不按 Fast、Standard、Ultra 预设上下文总量，也不截取模型窗口的固定百分比。
上下文预算只在 Pi 报告活动模型窗口和 usage 时按实际剩余容量估算；最终完整 payload
仍由 provider-window 校验决定。窗口或 usage 不可知时显示 `unknown`，不会猜一个较小
预算。只有最终校验确认放不下时，才会省略 Dove 项目上下文。

### 终止原因与恢复

Pi 可能仍显示通用的 `Operation aborted`，但 Dove 会保留具体终止对象：

| 原因 | 含义 | 下一步 |
| --- | --- | --- |
| `provider-authorization-denied` | provider 未授权或 API key 无效 | 检查 `/login` 或 provider 凭据后重试 |
| `model-budget-rejected` | 当前请求无法放入模型上下文 | 缩小上下文或更换模型后重试 |
| `provider-round-budget` | provider 轮次观察阈值已达到 | 查看 `/status full`；该阈值不会单独中止请求 |
| `progress-*` | 工具循环重复或停滞 | 使用已有证据，改用更窄的查询 |
| `user-cancelled` | 用户主动取消 | 准备好后提交新请求 |
| `startup-conflict` / `superseded` | 会话被其他运行实例接管 | 关闭旧实例或从新会话继续 |

无 UI 时运行 `dove-pi doctor`，或通过 `diagnostics/status` 查看相同的结构化原因和下一步；
资源/token/cache 数值仅用于观察和建议；只读请求数达到历史阈值也仅产生 advisory，不会因数量本身终止；重复且无进展的
read-only guard 仍可能按上表策略结束停滞的请求。

要复现隔离的真实 RPC 路径，可运行
`node scripts/real-dove-blackbox.mjs --launcher source --provider faux --cwd <temporary-project> --output <temporary-output>`。
该命令只使用临时项目和测试 provider，输出会脱敏；长文档的 `compacted` 是单文档提取
证据，不等于 Dove 的总上下文上限。

黑盒回放按一个真实 Pi 会话运行：每次运行会创建独立的项目副本、Dove state、Pi session
和 provider capture 根目录，即使多个回放共享输出父目录也不会串账。默认的 `--prompt` 仍
兼容单回合用法；需要多回合时用 `--scenario <json>`，格式如下：

```json
{"steps":[
  {"kind":"prompt","message":"读取项目并只做审计"},
  {"kind":"prompt","message":"/mode fast"},
  {"kind":"prompt","message":"/dove-thinking off"},
  {"kind":"prompt","message":"/dove-tools core"},
  {"kind":"prompt","message":"/dove-tools auto"},
  {"kind":"follow_up","message":"继续刚才的审计并给出验收标准"},
  {"kind":"state"},
  {"kind":"stats"}
]}
```

步骤严格按前一步完成后发送；`prompt` 既可是真实请求，也可是真实用户输入的 slash
command，`follow_up` 保持同一会话但使用新的逻辑回合。驱动在最后一次 settle 后请求
state/stats 并关闭 stdin，让 Pi 自己正常退出；`exitCode: 0` 且 `signal: null` 表示正常
结束，只有 `harnessTimedOut: true` 才表示测试器超时强制终止。JSONL 只保留 digest、事件
类型和白名单计数，不写入原始 prompt、工具参数、凭据或绝对路径。摘要还会记录每个模型
回合的策略值与来源、逻辑请求 ID、活动工具数，以及项目 `.dove/` 产物的相对路径/计数；
slash command 和 `state`/`stats` 是 `command-only` 步骤，不会伪造 ledger strategy。

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
`repair` 会依次检查当前版本、previous、精确匹配 release identity 的本地缓存和稳定
Release。损坏的 `install.json` 不会被当成全新安装；修复会优先使用有效备份，再扫描已验证的
托管版本。启动器也会在每次运行时重新寻找可用的 Python 3.10+，不绑定安装时的绝对路径。

从源码安装的用户通过下面的方式更新：

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

未知的 CLI 子命令会返回非零退出和单个 JSON 错误对象；不要依赖 Node 堆栈文本做自动化解析。工具调用、耗时和 token 数值仅用于诊断观察；数值本身没有固定硬上限，但重复或停滞的循环仍受上表的进度保护约束。

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
  state\install.json.bak
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

无 UI 调试时，`dove-pi doctor` 的 `requestDiagnostics` 和 JSON-RPC 的只读
`diagnostics/status` 都从项目隔离的 `execution.jsonl` 投影最近一次终止和资源观察；它们与 Pi
内的 `agent_doctor` 返回相同的 `lastTerminal` / `lastResourceObservation` 字段。终止对象包含
`origin`、`code`、摘要、是否可重试和下一步建议，因此 Pi 显示通用 `Operation aborted` 后仍能归因：

```powershell
'{"jsonrpc":"2.0","id":1,"method":"diagnostics/status"}' | dove-pi rpc
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

检查网络、仓库地址和 Release 资产是否仍可用；也可以先使用源码安装。

### Python、Node.js 或 npm 版本不够

源码安装请先安装 Python 3.10+ 和 Node.js 22.19+。Release 一键安装器会在 winget 可用时自动
补齐运行时。

### 安装状态损坏或更新中断

重新运行下载的一键安装脚本，或在仍可用的 launcher 中执行：

```powershell
dove-pi repair
```

修复只操作 Dove 托管目录，会保留 Pi 用户数据、项目 `.dove`/`.trellis` 和源码目录。

### 扩展显示 degraded

关闭可能占用 native binary 的 Pi/Node 进程，然后运行：

```powershell
dove-pi repair
```

### 项目没有 Dove 状态

无需处理，普通请求会直接执行并在需要时静默创建状态。需要提前创建空状态时才运行
`dove-pi project init`。
