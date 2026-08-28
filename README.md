# Dove Pi（中文）

英文文档：[README.en.md](README.en.md)

Dove Pi 是一个 Windows 优先的个人 Agent 运行环境。用户只需要面对 Dove Pi；Pi 是交互宿主，Dove 负责执行，Trellis 在后台负责项目上下文和任务管理。

## 环境要求

- Windows 10/11
- Python 3.10+
- Node.js `>=22.19.0`
- PowerShell 5.1 或 PowerShell 7（推荐 7）

安装器默认安装完整的 `max` 扩展 profile。这里的 `max` 只是扩展集合名称，不是 Dove 的执行策略。

注意：安装完整扩展不等于每轮都把全部工具发给模型。Dove 默认使用 `auto` 工具集合，只发送 Pi 基础工具、Dove 项目工具和必要的交互工具；识别到浏览器、MCP、LSP、后台任务等意图时，会自动加入对应工具。这样普通的 `hi` 或简单问答不会因为扩展元数据产生数万 token 的固定开销。

## 最短使用流程

```powershell
python .\dove_pi.py install
cd 你的项目目录
dove-pi
```

首次进入没有 `.trellis/` 的项目时，Dove 不会在启动阶段阻塞等待初始化确认；Pi 会先立即进入可交互状态并显示提示。第一次进行实现、修复、规划或任务类操作时，Dove 才会询问是否初始化。确认后自动创建 Trellis、切换 Provider 并加载上下文；拒绝则继续使用 lightweight 模式。也可以随时手动执行 `/project init`。

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
/web [status|auth <hosts...> [profile=名称]]
/mode fast|standard|ultra
/dove-tools                 # 查看当前工具集合（默认 auto）
/dove-tools full            # 临时启用已安装的全部工具
/dove-tools auto            # 恢复按意图自动加载
/dove-tools core            # 强制使用低 token 核心集合
/dove-tools reset            # 重置 auto 会话阶段，清除已累加的意图工具
Ctrl+Alt+M
```

`/status full` 里的缓存诊断会同时显示最近一次请求（Last CH）和当前会话累计命中率（Session CH）。`CH` 使用 Pi/provider 已上报的 usage 计算，不会把估算值当成真实命中。

## Web 访问（真实用户模式）

Dove 通过已安装的 `pi-web-access` 扩展提供 `web_search`、`fetch_content`、`source_check`、`get_search_content` 等工具。要像真实用户一样读取网站、避免反爬导致内容残缺，可用“真实用户认证”路径：Dove 读取本机 Edge/Chrome 已登录的真实 cookie，仅发给你白名单里的主机。

```text
/web status                     # 查看配置路径、cookie 开关、authFetch 白名单、Edge/Chrome 是否可用
/web auth example.com www.example.com [profile=名称]   # 启用真实 cookie 并对这些 host 放行
dove-pi web status              # 命令行等价
dove-pi web auth example.com [profile=名称]
```

分层策略：

- 普通/无需登录的内容：`fetch_content` 直接抓；
- 登录墙或 cookie 保护的内容：先用 `/web auth <host>...` 放行该 host，再用 `fetch_content` 的 `auth` 参数（profile 名或 `true`），Dove 会带上本机真实登录 cookie；
- 反爬较重或 JS 渲染的页面（`fetch_content` 报“JavaScript-rendered / incomplete / blocked”）：Dove 会自动改用 `agent_browser`（真实 Chromium 会话）抓取，而不是报告残缺结果。

安全边界：cookie 只发给 authFetch 白名单内的 host；SSRF 校验和 host 范围保持生效；cookie 不会发给第三方托管提取服务。配置写在 `~/.pi/web-search.json`（或 `$PI_CODING_AGENT_DIR` 下）。

若 `agent_browser` 报“Failed to launch Chrome … parallel configuration (14001)”，说明本机 Chrome 的 SxS 运行库坏了（已存在 `chrome.exe.bak_sxs_broken`）。改用 Edge：agent-browser 全局配置已指向 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（`~/.pi/config/pi-agent-browser-native/config.json`）。正式发起的真实浏览器会话使用 `agent_browser` 的 `sessionMode: fresh` 并带 `--executable-path <Edge路径>`。
普通使用不需要记住 `/project bind`、`/task ...` 或 `/skill:*`；它们是高级/兼容接口。

## 执行策略

默认使用 Standard。三种策略只影响上下文深度和调度积极程度，不改变权限、审批、目标范围或模型限制。

| 策略 | 适合场景 |
| --- | --- |
| Fast | 简单、确定、短任务；优先精确能力匹配 |
| Standard | 普通开发和多步骤任务；默认推荐 |
| Ultra | 复杂任务；加载更多相关规范和记忆，并自适应压缩 |

Dove 没有 `max` 执行策略。Pi thinking level 的 `max` 和安装器的 `max` 扩展 profile 是另一回事。

上下文不会把整个 `.trellis/` 目录原样塞进每一轮请求：Fast 只带当前任务 PRD 和运行时契约的相关片段；Standard/Ultra 按请求意图检索规范、工作流或记忆，空查询不会展开整个项目；超长文档会保留相关段落并压缩。`/status full` 中的上下文统计以 Pi/provider 的实际用量为准。

针对大项目还有三层保护：Fast/Standard 的上下文检索有总字符预算，宽泛查询超出预算时只保留高相关度文档；Ultra 不设置人为固定上限，依靠相关性、去重、单文档压缩和 Pi/provider 的模型上下文上限保护；项目任务列表只返回前 50 条预览并显示省略数量。动态 Dove 上下文以版本化 `personal-agent-context` 快照追加到用户回合，只在模式、Trellis revision、workflow hint 或工具策略变化时新增；工具调用期间不会被 `context` hook 移到消息末尾，从而保持 provider cache 前缀稳定。旧版本无 schema 标记的记录会在发送给模型前过滤掉。

### 工具集合与 token

`max` 扩展 profile 解决的是“安装哪些能力”，`core/full` 工具集合解决的是“当前回合把哪些工具 schema 发给模型”，两者是两层设置：

- `auto`（默认）：按当前请求自动加入所需工具；
- `core`：强制低 token 的日常对话和普通开发；
- `full`：临时启用全部已安装工具；
- 环境变量 `DOVE_PI_TOOL_PROFILE=full`：启动时默认使用完整工具集合。

`auto` 不只检查本轮 prompt，也会参考当前 Trellis 任务的状态和文件路径；例如继续一个包含 `.c`、`.go` 或 `.ts` 文件的任务时，会自动补齐相关诊断/符号工具。切换只影响后续模型回合，不会卸载扩展。为稳定缓存前缀，auto 会在当前会话保留已加入的意图工具；长会话可执行 `/dove-tools reset` 回到 core，再按意图重新加入。`/status` 会显示当前工具集合和 Pi thinking level；Pi/provider 的实际 usage 仍是最终计费依据。

对自定义 OpenRouter provider，Dove 会自动把当前 Pi session ID 作为 `x-session-affinity` 发送，以便锁定的上游复用 prompt cache。代理不接受该 header 时，可设置 `DOVE_PI_DISABLE_SESSION_AFFINITY=1` 关闭。缓存保留时间由 Pi 的 `PI_CACHE_RETENTION` 控制；确认上游支持长 TTL 后可设置为 `long`。

如果 OpenRouter 上的 DeepSeek 兼容层把工具调用返回成 `<｜DSML｜tool_calls>` 文本，Dove 会在 Pi 的 `message_end` 边界将完整调用转换为标准工具块，再交给 Pi 原有的工具审批和执行流程。解析失败或不完整的 DSML 会原样保留，不会猜测执行；因此不会因为兼容层异常而把普通文本当成命令。

如果安装了 `pi-hashline-edit-pro`，Dove 会自动隐藏内置 `edit`，并保留 hashline 的 `replace`/`insert` 编辑路径，避免两套编辑权威同时暴露。`dove-pi extensions doctor` 会报告该兼容边界。

Ultra 不等于强制调用所有工具或子 Agent。它允许更积极的上下文和调度，但共享可变状态、短任务和紧耦合调试仍会留在当前 Agent，避免错误并行。

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
python .\dove_pi.py install --no-extension-updates

npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

`setup` 是 `install` 的别名。重复安装会复用 lockfile 和 npm 缓存；如果当前 profile 已经配置过 Pi 扩展，安装器会先调用 Pi 官方的 `pi update --extensions`，再补齐缺失组件。更新失败会警告但继续安装；使用 `--no-extension-updates` 可跳过更新。

安装器会在阶段摘要中明确显示三种状态：已更新已有插件、首次安装没有已配置插件因而跳过更新、或用户显式跳过更新。`--no-extension-updates` 只跳过更新，不会跳过缺失插件的安装；`--no-extensions` 才会跳过整个第三方插件阶段。
扩展安装默认具备容错性：某个可选扩展（例如依赖 Windows 原生二进制的 `pi-lens`）失败时会清理对应的残留 JS/native 包，强制重新构造匹配的 `@ast-grep/cli` 与平台包并重试一次；仍失败则显示原因、继续安装其余组件，并在结果中列出 `failed` 项。这不会阻断 Dove Pi 主程序，修复环境后重新运行同一条安装命令即可补装。若 Windows 正在锁定二进制文件，请先关闭其他 Node/Pi 进程。
安装器也支持用户名或仓库路径包含中文等非 ASCII 字符：`.cmd` 启动器只保存 ASCII 内容并在运行时定位旁边的 PowerShell 启动器，PowerShell 启动器使用带 BOM 的 UTF-8，避免 `UnicodeEncodeError` 或 PowerShell 5.1 乱码。

## 自更新与插件更新

`dove-pi` 从 GitHub 仓库跟踪 `master` 更新自身：

```powershell
dove-pi update              # 拉取最新代码并重新对齐依赖/扩展/启动器
dove-pi update --check      # 只报告是否有更新，不改动任何东西
dove-pi update --force      # 丢弃未提交的本地改动后更新
dove-pi update --verify full  # 更新后跑完整测试
```

行为约定：

- **版本策略**：跟踪 `master`，不做 git tag；更新 = fetch + 快进合并（`--ff-only`），本地历史分叉时中止并提示。
- **脏树保护**：工作区有未提交改动时默认中止；`--force` 会先 `git reset --hard` 丢弃这些改动。
- **插件更新**：`dove-pi install`（或 update 的收尾阶段）会同步更新 Pi 扩展目录（官方 `pi update --extensions` + 补齐缺失项），并更新全局 Trellis CLI（`npm update -g @mindfoldhq/trellis`，失败仅警告不阻断）。
- **回滚**：更新前把旧 commit 写入 `.dove/manifest.json` 的 `previousCommit`；回滚 = `git reset --hard <previousCommit>` 后重跑 `dove-pi install`。
- **profile 记忆**：扩展 profile 持久化在 `.dove/manifest.json`；之后 `dove-pi install` / `update` 自动沿用，不再默认回落 max。
- **离线优先**：`update` 只在显式执行时联网；启动和 `doctor` 从不联网。

`.dove/` 已被 `.gitignore` 忽略（机器状态，不入库）。
当前版本是可运行的基础 MVP。任务 replay、完整远程控制面、第二套原生项目数据库和自动记忆晋升暂不在首个版本范围内。

项目规范位于 [.trellis/spec/](.trellis/spec/)，当前任务位于 [.trellis/tasks/08-26-personal-agent-os/](.trellis/tasks/08-26-personal-agent-os/)。
