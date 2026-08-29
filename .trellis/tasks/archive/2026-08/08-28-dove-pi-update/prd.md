# Dove Pi V2 托管安装与更新

## Goal

把 Dove Pi 从“开发仓库就是全局安装目录”的原型安装方式，升级为 Windows 优先、可重复、可恢复的托管安装系统。普通用户首次安装后只需记住：

```powershell
dove-pi update
dove-pi repair
```

默认安装完整推荐能力，但启动、doctor 和普通对话不产生隐藏联网；更新失败时继续使用上一个已验证版本，不留下半更新状态。

## Background and confirmed facts

- 当前全局启动器 `%LOCALAPPDATA%\DovePi\bin\dove-pi.ps1` 直接指向开发仓库 `dove_pi.py`；开发提交会绕过 install/update 立即改变全局程序。
- 当前 `.dove/manifest.json` 记录 commit `1bc521b`，实际 HEAD 为 `6256a38`，已证明安装状态与运行代码漂移。
- 当前真实 `python dove_pi.py update --check` 返回 `local-ahead`；`run_update()` 对 `up-to-date` 和 `local-ahead` 都在组件维护前返回（`dove_pi.py:551-569`）。
- `--no-extensions` 和“读取已保存 profile”都转换为 `extension_profile=None`，因此禁用扩展会被重新解释为沿用 profile（`dove_pi.py:76-80, 685-694`）。
- 当前更新先 fast-forward 活跃目录，再安装依赖和验证；后半段失败会留下代码与依赖不一致的状态（`dove_pi.py:574-583`）。
- 当前完整 install 默认执行全局 `npm update -g @mindfoldhq/trellis`，联网、兼容版本和失败状态不可复现（`dove_pi.py:124-126, 482-492`）。
- 字体与 Trellis 更新嵌套在 `if extension_profile` 下，组件开关并不独立（`dove_pi.py:111-126`）。
- `pi:smoke` 显式传入 Dove extension，而 `launch()` 已固定注入同一 extension（`package.json:18`, `dove_pi.py:361-366`）。
- manifest 声称容错，但字符串 `schemaVersion` 会直接执行 `int(value)`，非法值仍可抛异常（`dove_pi.py:381-399`）。
- 当前 installer tests 19/19、typecheck 通过；这些测试验证的是 V1 内部契约，未覆盖真实目录迁移、事务失败、并发锁和 PowerShell bootstrap。
- Pi 0.84.3 的官方 package manager 支持精确 npm spec：`parseSource()` 识别版本并标记 pinned，`installAndPersist()` 会按包 identity 替换 settings 中的旧 spec（`node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js:618-647, 787-790, 1148-1159, 1481-1485`）。因此 Dove 可以只对齐自己管理的扩展，而不需要执行会升级全部用户扩展的 `pi update --extensions`。
- Trellis 0.6.16 是可作为普通 npm dependency 固定的 CLI 包，且精确依赖同版本 `@mindfoldhq/trellis-core`；Dove 不需要依赖全局 latest。

## User decisions

- 采用 V2 独立托管安装目录；开发仓库不再作为默认全局安装本体。
- 默认使用 GitHub stable release 和 Dove 已测试的组件组合，不追踪 master/latest。
- 默认安装完整推荐 profile；高级裁剪不进入最短使用流程。
- 保持 offline-first：只有显式 install/update/repair 会联网，启动与 doctor 不联网。
- 旧开发仓库必须保留，不在迁移中删除、reset 或改分支。

## Requirements

### R1 — 托管目录边界

Windows 默认目录固定为：

```text
%LOCALAPPDATA%\DovePi\
  bin\                 stable launcher
  app\versions\<id>\  immutable validated releases
  cache\               downloaded release assets
  staging\             incomplete transactions
  state\install.json   current/previous/profile/component state
  state\maintenance.lock
  logs\
```

应用版本目录不得包含 Pi 凭据、会话、用户 settings 或项目 `.trellis/`。这些数据继续由原路径管理。

### R2 — 一条命令首次安装

- GitHub Release 提供 `install.ps1`、Windows release zip、SHA-256 文件和内部 `release.json`。
- 用户不需要 clone 仓库或安装 Git。
- bootstrap 检查 Python 3.10+、Node 22.19+ 和 PowerShell，下载 latest stable asset、校验 SHA-256、在 staging 安装并验证后才激活。
- README 同时提供最短一行命令和“先下载、检查脚本、再执行”的安全版本。

### R3 — Release unit

- GitHub stable release 是唯一默认应用更新源；release tag 与 `package.json` version 一致。
- `release.json` 记录 release id、commit、平台 asset、最低运行时、Pi/TUI/Trellis 精确版本以及各 profile 的精确扩展 spec。
- Pi core、Pi TUI 和 Trellis CLI 随 Dove 应用 lockfile 安装；不再依赖全局 Trellis latest。
- GitHub release workflow 从 tag 构建资产并生成 SHA-256；普通开发 push 不发布用户更新。

### R4 — 原子安装和更新

- install/update 先取得维护锁，再下载到 cache、解压到新的 staging 目录、执行 `npm ci` 和 quick verification。
- 所有必需步骤成功后，移动到新的 immutable version 目录，并通过原子替换 `state/install.json` 激活。
- 激活前任何失败都保留旧 current；失败 staging 可由下一次 repair 清理。
- 至少保留 current 与 previous 两个应用版本；清理只允许作用于已解析且位于 `app\versions` 下的非 current/previous 目录。

### R5 — `dove-pi update`

- 默认查询最新 stable release；无新版时仍检查启动器和 Dove-managed extensions 是否缺失，但不重装健康的 npm tree。
- 有新版时执行 R4 事务，并在成功后对齐 Dove-managed extensions、launcher 和本地状态。
- `--check` 只读取远端 release metadata 和本地状态，不写应用、用户配置或项目文件。
- `--json` 才承诺纯结构化 stdout；默认输出面向人，阶段简短且结尾给出明确结果。
- 移除普通 update 的 `--force`；托管版本不可变，不再用 git reset 解决安装问题。

### R6 — 组件所有权与 profile

- 默认 profile 为 `max`，profile 与执行策略 `fast/standard/ultra` 继续完全分离。
- state 明确记录 profile 和 Dove-managed extension identities/specs；不把用户自行安装的扩展纳入 Dove 所有权。
- Dove 通过 Pi 官方 `install npm:<package>@<exact-version>` 对齐自己管理的扩展；不得调用无目标的 `pi update --extensions` 更新全部用户扩展。
- profile 中的可选扩展失败时，应用仍可激活，但结果与 doctor 必须列出 degraded component；必需应用组件失败则禁止激活。
- 字体仅在缺失时尝试安装；字体、扩展和应用更新是独立阶段。

### R7 — Trellis 边界

- Dove 调用随 release 固定的 Trellis CLI，而不是机器上不受控的全局版本。
- 更新 Dove 不自动改写任何现有项目的 `.trellis/`；项目模板迁移仍由显式 `dove-pi project update` 执行。
- 用户另行安装的全局 Trellis 不删除、不覆盖。

### R8 — Repair、rollback 和 uninstall

- `dove-pi repair` 验证 current release、launcher、state 和 Dove-managed extensions；损坏时从 cache 或 stable release 重建 sibling version，再原子激活。
- `dove-pi rollback` 切回 previous 应用版本；不谎称已回滚用户自行管理的扩展或项目 `.trellis/`。
- `dove-pi uninstall` 需要明确确认，只移除经过路径校验的 Dove managed app/launcher；默认保留 Pi 用户数据、项目、开发仓库和第三方扩展。

### R9 — V1 迁移

- bootstrap/installer 检测现有 launcher 是否指向普通 checkout。
- 从有效的旧 `.dove/manifest.json` 导入 profile；非法 manifest 回退为 `max`，不得阻塞迁移。
- 新 managed release 验证并激活后才改写 launcher。
- 不修改、移动或删除旧 checkout；输出明确说明旧仓库现在仅用于开发。
- 旧 `python dove_pi.py install` 保留一个兼容周期，改为调用 managed installer，而不是把当前 checkout 直接注册为全局版本。

### R10 — 并发、恢复和诊断

- install/update/repair/rollback/uninstall 共用一个跨进程维护锁；锁包含 PID、命令和开始时间，并能安全识别 stale lock。
- `state/install.json` 原子写入且 schema 校验；未知/损坏字段不得导致启动器崩溃，应回退 previous 或给出 repair 命令。
- 维护事务写本地日志，默认终端只显示阶段和可执行的错误建议，不打印凭据、provider 配置或完整环境变量。
- 正常启动只读取本地 current state，不运行 GitHub、npm、winget 或版本检查。

### R11 — 确定 bug 修复

- 用显式布尔值/配置对象区分“沿用 profile”和“禁用扩展”，删除 `None` 双重语义。
- manifest 非数字 schema 必须安全降级。
- smoke 只加载一次 Dove extension。
- 组件阶段计数来自实际 plan，不由嵌套条件手工猜测。

### R12 — 文档和 UX

- 中文、英文 README 同步更新。
- 首页最短流程只展示首次安装、进入项目、运行 `dove-pi`。
- 日常维护主文档只展示 `update`、`repair`、`rollback`；高级 JSON/profile/离线参数放到单独参考部分。
- 每个命令成功时给出一行最终状态；失败时给出当前仍可运行的版本和下一步。

## Acceptance Criteria

- AC1：在没有 Git、没有源码仓库的干净 Windows 用户环境中，PowerShell bootstrap 能安装并启动 Dove Pi。
- AC2：安装完成后 launcher 与 state 仅指向 `%LOCALAPPDATA%\DovePi\app\versions\...`，不指向开发 checkout。
- AC3：在下载、SHA 校验、`npm ci`、quick verification 四个断点分别注入失败，current release 与 launcher 均保持不变。
- AC4：成功更新后 current 切换到新 release、previous 指向旧 release，`dove-pi rollback` 可恢复启动旧 release。
- AC5：同版本重复 `dove-pi update` 不执行 `npm ci`，只做轻量本地健康检查和必要的 managed-extension reconciliation。
- AC6：两个并发维护命令中只有一个获得锁；另一个快速退出并显示持锁 PID/命令，不损坏 state。
- AC7：迁移当前真实 launcher 后，旧开发仓库保持字节/branch/status 不变，旧 profile 被导入，新 launcher 指向 managed release。
- AC8：`--no-extensions` 的 CLI 端到端测试证明不会读取 manifest 后重新启用扩展；默认无 profile 时仍沿用有效 state profile。
- AC9：Dove 只更新 release manifest 中自己管理的精确扩展 spec，用户额外安装的 Pi 扩展 spec 和版本不变。
- AC10：Dove 使用 release 中固定的 Trellis CLI；install/update 不执行全局 `npm update -g @mindfoldhq/trellis`，也不自动改动项目 `.trellis/`。
- AC11：非法 state/legacy manifest、缺失 current 目录和 stale lock 都产生可恢复诊断，不出现 Python traceback 作为默认用户输出。
- AC12：默认输出不混称为 JSON；`--json` 成功与失败路径均可被 JSON parser 直接读取。
- AC13：smoke 验证只注册一次 Dove extension，installer unit、TypeScript test/typecheck、Windows E2E 全部通过。
- AC14：启动和 doctor 在网络拦截测试中不发起 GitHub、npm 或 winget 请求。
- AC15：uninstall 默认保留 `~/.pi/agent`、所有项目 `.trellis/`、用户第三方扩展和旧开发仓库。

## Out of Scope

- 首个 V2 版本不发布 npm global package；分发使用 GitHub Release assets。
- 不做后台静默更新、启动时联网提示或强制升级。
- 不自动升级所有用户 Pi 扩展，也不自动迁移项目 `.trellis/`。
- 不删除现有开发 checkout，不自动 reset/stash/切换其 Git 分支。
- 不在本任务实现 macOS/Linux 的一键 bootstrap；保留现有开发运行能力，托管安装 E2E 先覆盖 Windows。
- 首版做 SHA-256 完整性校验，不在本任务引入代码签名证书或独立更新服务器。
- `edge`/nightly channel 延后；MVP 只有 stable。

## Risks and deferred items

- Pi extensions 位于用户级 npm root，不能与应用目录一起原子切换；因此它们被定义为可降级的外部组件，rollback 只保证 Dove 应用版本。doctor 必须如实展示这一边界。
- Windows 杀毒软件或运行中的 Node 进程可能锁定扩展 native binary；维护器只重试有限次数，不终止用户进程。
- GitHub API/Release 暂时是单一分发源；网络失败时保持 current，并优先允许 repair 使用本地 cache。
- SHA-256 防止下载损坏，但不等于发布者代码签名；签名作为独立后续安全任务。

## Open Questions

无阻塞问题。
