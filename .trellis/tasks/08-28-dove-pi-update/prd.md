# dove-pi 自更新与插件更新功能

## Goal

为 dove-pi 增加两条更新路径：

1. `dove-pi update`（或同类命令）：自动从 GitHub 拉取 dove-pi 自身的新版本并完成安装后收尾（npm 依赖、扩展、启动器、验证）。
2. `dove-pi install`（正常安装/重装路径）：除现有功能外，能够更新全部已管理的第三方组件（"插件"），例如 Trellis CLI、Pi 扩展目录等，使重复安装成为"安装 + 全量更新"。

## Background（已确认事实，来自代码勘察）

### 分发与安装模型

- 仓库：`github.com/Imjac1/dove-pi.git`，分支 `master`，无任何 git tag。
- `dove_pi.py` 是可执行入口。`install` 流程（`dove_pi.py install`）：
  1. 检查 Node ≥ 22.19；
  2. `npm ci`（无 node_modules 或 `--clean`）或 `npm install --prefer-offline`；
  3. `dove-pi extensions install <profile>`（默认 max）→ 内部调 Pi 官方 `pi update --extensions` 更新已配置扩展，再补装 profile 缺失项（`src/extensions/install.ts`）；
  4. 可选 Nerd Font / 图标配置（`install_icon_font` / `configure_icons`）；
  5. `npm run typecheck` + `pi:smoke`（`--verify quick`），`--verify full` 追加 `npm test`；
  6. 在 `%LOCALAPPDATA%\DovePi\bin` 写 `dove-pi.cmd`/`dove-pi.ps1` 启动器并加入用户 PATH。
- **安装位置 = 仓库 clone 本身**：启动器回指 `dove_pi.py`（`PROJECT_ROOT = Path(__file__).resolve().parent`），因此 self-update 本质上是在仓库目录内执行 git 操作。
- `bin/dove-pi.cjs` 是 npm 版启动器（`npm i -g .` 场景），spawn Python 入口。

### 插件/受管组件现状

- **Pi 扩展**：`src/extensions/catalog.ts` 定义 5 个 profile（minimal/dev/research/security/max）与包目录；`extensions install <profile>` 负责对齐。profile **不持久化**——重复 `install` 默认回到 max。
- **Trellis**：全局 npm 包 `@mindfoldhq/trellis@0.6.15`（`~/.pi/agent` 之外、npm global root）。`dove-pi project update` 只是对当前项目执行 `trellis update`（`src/project-provider/trellis-cli.ts`），**不更新 Trellis CLI 自身**。
- **Pi 本体**：`@earendil-works/pi-coding-agent@^0.84.3` 是 npm 依赖，随 `npm install`/`npm ci` 更新。
- **其他全局工具**：`agent-browser`、`oh-my-opencode`、`@deepseek-ai/dsh` 等全局 npm 包存在，是否受管待定。
- **图标/字体**：Nerd Font（winget 包 DEVCOM.JetBrainsMonoNerdFont）+ `open-tui.json` icon mode + Windows Terminal 字体，`dove-pi icons` 命令管理。

### 现有约束（来自项目 PRD）

- 启动保持 offline-first；版本检查/更新检查必须显式或缓存，不能是隐藏的网络依赖。
- Windows/PowerShell 5.1/7 一视同仁；注意路径编码、CRLF、进程锁（node_modules 更新时 Windows 可能 EPERM）。
- 模块边界：Agent Core 与 Trellis 实现细节解耦；不要自动执行破坏性操作。

### 风险点

- **工作区脏树**：仓库同时是开发工作区与安装位置，`git status` 当前已有 `M src/cli.ts`，`git pull` 可能失败或冲突——更新流程必须定义处理策略。
- **更新过程中自身正在运行**：`dove_pi.py` 由 PowerShell 启动器调用，更新 npm 依赖时 Windows 文件锁可能报 EPERM。
- 无版本 tag：版本语义已决策为跟踪 master（见决策总结），无需 tag。
## Requirements

- R1　`dove-pi update`：从 GitHub 拉取 dove-pi 自身新版本（跟踪 master），完成后自动执行依赖安装、扩展对齐、Trellis CLI 更新、启动器写入、验证。
- R2　`dove-pi update --check`：只对比远端 HEAD 与本地 HEAD，报告是否有更新、当前/目标 commit，不落地任何变更。
- R3　脏树保护：工作区有未提交改动时默认中止；`--force` 覆盖（丢弃本地改动后更新）。
- R4　更新前把旧 commit hash 写入 `.dove/manifest.json`，支持 `git reset --hard` 回滚。
- R5　`dove-pi install`（及重装）自动更新全部已管理插件：Pi 扩展目录（现有 `extensions install` 机制）+ Trellis CLI 自身（`npm update -g @mindfoldhq/trellis`）。
- R6　扩展 profile 持久化：`.dove/manifest.json` 记录上次 profile，install/update 自动沿用；未记录时默认 max。
- R7　离线-first：update 只在显式执行时联网；`--check` 是唯一未落地检查；`doctor`/启动永不触发网络。
- R8　`.dove/` 加入 .gitignore（manifest 含机器状态，不入库）。
- R9　Windows 优先：处理文件锁（EPERM 重试/提示）、编码（UTF-8/CRLF）、PowerShell 5.1/7 兼容。
- R10　命令路由：`dove_pi.py` 的 main() 将 `update` 路由到本地 CLI（当前会落到 launch()）。

## Acceptance Criteria

- [ ] AC1　在仓库当前有未提交改动（如 `M src/cli.ts`）时，`dove-pi update` 默认中止并提示先 commit/stash 或加 `--force`；加 `--force` 能继续并丢弃本地改动。
- [ ] AC2　远端 master 有新提交时，`dove-pi update` 快进合并到新 commit，`git log -1` 等于 `origin/master`，且旧 commit 写入 `.dove/manifest.json` 的 `previousCommit`。
- [ ] AC3　远端无新提交时，`dove-pi update` 报告「已是最新」，不产生任何 git/npm 副作用。
- [ ] AC4　`dove-pi update --check` 在远端有新提交时输出当前/目标 commit 与「可更新」标记，且工作区没有任何变化（git status 前后一致）。
- [ ] AC5　`dove-pi update` 完成后（或 install 重装后），`npm ls @earendil-works/pi-coding-agent` 与 package.json 声明版本一致，`dove-pi doctor` 输出正常。
- [ ] AC6　install 重装后 Trellis CLI 为最新：`npm ls -g @mindfoldhq/trellis` 显示更新后版本（若远端有新版）。
- [ ] AC7　install/update 自动沿用上次 profile：`.dove/manifest.json` 有 `profile: security` 时，重装 profile 不回落 max。
- [ ] AC8　`.dove/` 已被 .gitignore 忽略，`git status` 不显示 manifest 变化。
- [ ] AC9　离线场景（无网络）：`update --check` 报清晰错误且不崩溃；`doctor`/启动无任何网络行为。

## Out of Scope（已确认）
- 不引入独立的包管理器/二进制分发（保持 git 分发模型）。
- 不改动 Pi 官方扩展更新机制（仍由 `pi update --extensions` 拥有版本解析）。

## 决策总结（用户 08-28 全部选定）

1. **版本策略**：跟踪 master（`git fetch` + 快进合并，记录新 commit hash；无 tag 流程）。
2. **脏树处理**：默认中止，`--force` 覆盖（丢弃本地改动）。
3. **插件更新范围**：Pi 扩展目录（保留现有 `extensions install`）+ 新增 Trellis CLI 自身（`npm update -g @mindfoldhq/trellis`）；其他全局工具、图标字体不在范围内。
4. **profile 持久化**：扩展 profile 写入 `.dove/manifest.json`（gitignore/兑底），install/update 沿用上次选择，未写入默认 max。
5. **离线-first**：update 只在显式执行时联网；`--check` 只对比远端 HEAD；startup/doctor 永不触发网络。
6. **更新安全**：记录旧 commit hash 于 manifest；回滚 = `git reset --hard` + 重跑收尾。
## Notes

- 任务类型：complex（跨 Python 入口 + TS 命令 + git/网络/系统级操作），需要 `design.md` 和 `implement.md`。
