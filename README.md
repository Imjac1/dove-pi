# Dove Pi

Dove Pi 是基于 [Pi](https://github.com/badlogic/pi-mono) 的 Windows 优先个人 Agent 运行层。它保留 Pi 的开放扩展能力，同时补上默认策略、项目上下文、Trellis 项目管理、扩展组合、诊断和可恢复更新。

## 最短使用流程

### 1. 安装

需要 Windows、PowerShell 5.1+、Python 3.10+ 和 Node.js 22.19+。普通用户不需要 Git 或源码仓库。

```powershell
irm https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 | iex
```

如果希望先检查脚本：

```powershell
Invoke-WebRequest https://github.com/Imjac1/dove-pi/releases/latest/download/install.ps1 -OutFile .\install-dove-pi.ps1
Get-Content .\install-dove-pi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dove-pi.ps1
```

安装器默认装入完整的 `max` 扩展 profile，并把程序放到 `%LOCALAPPDATA%\DovePi`。下载的 release zip 会先校验 SHA-256，完成 `npm ci` 和快速验证后才会激活。

### 2. 进入你的项目

```powershell
cd C:\path\to\your-project
dove-pi
```

Dove Pi 始终把你启动命令时的当前目录当作目标项目，不要求把项目放进 Dove Pi 的安装目录。

### 3. 直接说需求

普通对话、查找、项目工作和执行操作会自动选择合适的上下文与工具。常用模式：

```text
/mode fast
/mode standard
/mode ultra
```

`Ultra` 是执行/思考策略；`max` 是安装时的扩展组合，两者没有继承或映射关系。

## Trellis 如何工作

Dove Pi 自带并锁定经过测试的 Trellis 版本，不依赖机器上的全局 `trellis`，也不会在普通启动时偷偷升级它。

在项目内执行：

```powershell
dove-pi project init
dove-pi project doctor
dove-pi project update
```

- `project init` 在当前目录创建 `.trellis/`，并安装该项目需要的共享 skills。
- `project update` 仅在你显式执行时更新当前项目的 Trellis 模板。
- Dove Pi 更新应用本身时，不改写任何项目的 `.trellis/`。
- 初始化后，在 Pi 中可以用 `/skill:trellis-start`、`/skill:trellis-brainstorm`、`/skill:trellis-continue`、`/skill:trellis-check`；在 Codex 中使用 `$trellis-start` 等对应语法。符合 skill 触发条件时，宿主也可自动选择。

通常不需要先手动运行 `trellis init`，也不需要单独安装全局 Trellis。

## Agent、Pi、Dove 和 Trellis 的关系

| 层 | 负责什么 |
| --- | --- |
| Pi | 模型、TUI、会话和原生工具宿主 |
| Dove | 请求策略、能力、审批、工具加载、证据和执行记录 |
| Project Provider | 项目发现和统一上下文边界 |
| Trellis | `.trellis/` 内的任务、spec、workflow、memory 和 journal |

Trellis 是项目数据的权威，Dove 不维护第二套任务/spec 数据库，也不从 core 直接改写 `.trellis/`。Dove 的执行记录与 Trellis 任务 ID 关联，但两者不混成一个状态文件。

常用 Pi 命令：

```text
/status
/status full
/project
/project doctor
/project init
/project update
/memory [query]
/capabilities
/mode fast|standard|ultra
/dove-thinking auto|lock <level>|off|status
/dove-tools auto|core|full|reset
```

`/thinking` 仍是 Pi 的原生命令；Dove 的自动/锁定策略使用 `/dove-thinking`，不会覆盖宿主命令。任务创建、完成和归档需要明确意图及确认；普通聊天不会创建 Trellis 任务。

## 日常维护

```powershell
dove-pi update
dove-pi repair
dove-pi rollback
```

- `update` 查询最新 stable GitHub Release。版本未变化且当前安装健康时，不下载 zip、不执行 `npm ci`；只修复 launcher 并对齐 Dove 自己管理的扩展。
- `repair` 检查当前 release 和 launcher；当前版本损坏时优先恢复可运行的 previous，再按需重建 stable release。
- `rollback` 原子切回 previous 应用版本。Pi 用户扩展位于用户目录，因此不会被伪装成与应用一起原子回滚。

只检查更新而不写入：

```powershell
dove-pi update --check
dove-pi update --check --json
```

`--json` 的 stdout 是单个 JSON 文档，诊断信息写入 stderr。启动、`doctor` 和普通聊天不会检查 GitHub、npm 或 winget。

## 安装边界与恢复

托管目录：

```text
%LOCALAPPDATA%\DovePi\
  bin\
  app\versions\<release-id>\
  cache\releases\
  staging\
  state\install.json
  logs\
```

稳定 launcher 只会运行 `app\versions` 内、通过路径校验的 release。若 current 损坏而 previous 完整，它会回退 previous 并提示运行 `dove-pi repair`。

以下内容不属于托管应用目录，安装、更新、回滚和默认卸载都不会删除：

- `~/.pi/agent` 中的凭据、模型、会话、settings 和用户扩展；
- 任意项目的 `.trellis/`；
- 你的源码仓库和未提交修改；
- 用户自行安装的第三方 Pi 扩展或全局 Trellis。

卸载托管应用：

```powershell
dove-pi uninstall --yes
```

## 扩展管理

默认 profile 是 `max`。可选 profile：`minimal`、`dev`、`research`、`security`、`max`。

```powershell
python .\dove_pi.py install --profile dev
python .\dove_pi.py install --no-extensions
python .\dove_pi.py install --no-extension-updates
```

Dove 只对 selected profile 中自己管理的 package identity 执行 Pi 官方精确版本安装：

```text
pi install npm:<package>@<exact-version>
```

它不会执行无目标的 `pi update --extensions`，因此不会顺便升级或改写用户自行安装的扩展。可选扩展失败会记录为 degraded，剩余组件继续安装；应用核心验证失败则不会激活。

## 从旧版迁移

从源码 checkout 执行一次：

```powershell
python .\dove_pi.py install
```

现在这条兼容命令会把源码复制并验证到独立的托管版本目录，而不是把全局 launcher 指向 checkout。若旧 `.dove/manifest.json` 中有有效 profile，会导入该 profile；原 checkout 的文件、分支、提交和未提交修改保持不变。

## 高级选项

```powershell
dove-pi update --verify quick
dove-pi update --verify full
dove-pi update --no-extensions
dove-pi repair --verify full --json
```

- `quick`：typecheck + Pi smoke，默认。
- `full`：在 quick 基础上运行完整测试。
- `none`：仅用于受控诊断或开发，不建议普通安装使用。
- V2 不支持 `update --force`；安装损坏请运行 `repair`，不会对源码仓库执行 `git reset --hard`。

如需隔离测试或开发，可设置临时托管根：

```powershell
$env:DOVE_PI_HOME = Join-Path $env:TEMP 'DovePi-test'
python .\dove_pi.py install --verify none --no-extensions --no-font --no-path
```

## 开发与验证

```powershell
npm ci
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

发布仅由与 `package.json` 版本匹配的 `v*` tag 触发。普通 push 不会发布，也不会改变用户安装。当前 release 使用 SHA-256 完整性校验；发布者代码签名尚未加入。

## 常见问题

- `dove-pi` 找不到：打开一个新终端，或直接运行 `%LOCALAPPDATA%\DovePi\bin\dove-pi.cmd`。
- current 损坏：运行 `dove-pi repair`；launcher 可在 previous 完整时自动回退。
- 扩展 degraded：关闭可能锁定 native binary 的 Pi/Node 进程，再运行 `dove-pi repair`。
- 项目没有 Trellis：在项目根执行 `dove-pi project init`。
- 需要完整扩展工具：在 Pi 中使用 `/dove-tools full`；普通请求默认按意图延迟加载，减少 prompt token。
