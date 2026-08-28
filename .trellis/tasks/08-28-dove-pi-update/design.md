# dove-pi 自更新与插件更新功能 — 设计

## 1. 架构与边界

```
┌─ 用户命令（任意 cwd）───────────────────────────┐
│  dove-pi update [--check] [--force] [--verify] │
│  dove-pi install [既有 flags]                   │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌─ dove_pi.py（Python 入口）──────────────────────┐
│  main(): 路由命令                               │
│    update → run_python_update()（主体在 Python）│
│    install → install()（既有）                  │
└────────────────────────────────────────────────┘
```

**关键决策：update 主体放 Python 而非 TS。** 理由：

1. **自更新期间代码会变**：TS 侧 `src/` 在执行中可能被新代码覆盖，但 `dove_pi.py` 是入口且很少变，Python 侧脚本在 pull 前后都可用。若放 TS，pull 后需要重新用 tsx 加载新代码，增加"旧代码跑新逻辑"的复杂度。
2. **与 install() 同构**：install 已在 Python 侧做了 npm/扩展/字体/启动器编排，update 复用同一套 `run()`/`executable()`/`write_launchers()`。
3. **测试面**：现有 `tests/installer_test.py` 已是 Python unittest 风格，update 测试可同域。

Python 侧只做 **git 编排 + npm + 启动器**；扩展对齐继续委托 `run_local_cli(["extensions", "install", profile])`（TS 侧既有能力，避免重写）。

## 2. 数据流

### 2.1 `dove-pi update`（默认路径）

```
1. 解析 flags: --check / --force / --verify
2. 定位仓库根: PROJECT_ROOT（__file__ 所在目录，与 cwd 无关）
3. 预检（本地，无网络）:
   - 是 git 仓库？origin 存在？当前不在 detached HEAD？（detached 时中止并提示）
   - git status --porcelain 非空 → 无 --force 则中止；有 --force 则 git reset --hard
4. --check 路径: git fetch origin master → 比较 HEAD vs origin/master
   → 输出 { currentCommit, targetCommit, updateAvailable }，返回，不落地
5. 更新前: 读 manifest，写 previousCommit=<当前 HEAD> + profile（沿用或默认 max）
6. git fetch origin master
7. 比较 HEAD vs origin/master:
   - 相等 → 输出"已是最新"，跳过 8-10，进入 11（无副作用）
   - origin/master 在 HEAD 之后 → git merge --ff-only
   - 分叉（本地有私有提交）→ 中止提示（需人工处理，--force 已在上游处理）
8. 依赖安装: npm ci（或 npm install --prefer-offline，沿用 install() 的 lockfile 逻辑）
9. 扩展对齐: run_local_cli(["extensions", "install", profile]) （更新 Pi 扩展 + 补装缺失）
10. Trellis CLI 更新: npm update -g @mindfoldhq/trellis（失败仅警告，不阻断）
11. 启动器: write_launchers() + PATH（复用 install 逻辑，幂等）
12. 验证: --verify quick（npm run typecheck + pi:smoke，复用 install 的 check 逻辑）
13. 写 manifest: currentCommit=<新 HEAD>，输出结构化结果
```

### 2.2 `dove-pi install`（变更点）

既有 install() 流程中，第 3 步扩展对齐前**读取 manifest 的 profile**（未记录则默认 max），扩展对齐后**新增 Trellis CLI 更新**（`npm update -g @mindfoldhq/trellis`，失败警告不阻断），并在成功后**写回 manifest**（profile + currentCommit）。

## 3. Manifest 契约（.dove/manifest.json）

```jsonc
{
  "schemaVersion": 1,
  "profile": "max",                // 扩展 profile：minimal/dev/research/security/max
  "previousCommit": "73abdb2…",    // 最近一次 update 前的 commit（回滚依据）
  "currentCommit": "9f3e5c1…",     // 当前 commit
  "lastUpdatedAt": "2025-08-28T10:30:00+08:00"  // ISO 8601
}
```

- 位置：`PROJECT_ROOT/.dove/manifest.json`（dev 与 install 同目录，天然对齐"安装位置=仓库"）。
- **gitignore**：`.dove/` 必须加入 .gitignore（机器状态，不入库）。已在 PRD R8。
- **读**：缺失/损坏 → 用默认值（profile=max），不阻塞。
- **写**：每次 update 成功/install 成功都原子写（temp + rename），避免半写。

## 4. git 操作契约

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| 仓库校验 | `git rev-parse --is-inside-work-tree` + `git remote get-url origin` | 非仓库/无 origin → 中止，报"dove-pi 不是 git 安装，无法自更新" |
| 脏树检测 | `git status --porcelain` | 非空 → 默认中止 |
| 丢弃本地 | `git reset --hard HEAD`（--force 时） | 丢弃未提交改动 |
| 快进 | `git fetch origin master` + `git merge --ff-only origin/master` | 保证线性；分叉时报错 |
| 检测 detached | `git symbolic-ref -q HEAD` | 无输出 → detached，中止 |
| --check | `git fetch origin master` + `git rev-parse HEAD` / `git rev-parse origin/master` | 只读远端引用，不改工作区 |

**注意**：`git fetch` 会更新 `.git/FETCH_HEAD` 和远端追踪引用 —— 这属于"工作区内文件未变但 git 状态变"。AC4 判定"工作区没有任何变化"应宽松解释为 `git status --porcelain` 无源码级变化（fetch 不产生）。设计上接受，测试断言用 `git status --porcelain`（fetch 不改 tracked/untracked 文件）。

## 5. Windows 兼容设计

- **文件锁（EPERM）**：更新 npm 依赖时，若 Windows 上 `node_modules` 被 Pi TUI/其他 Node 进程占用，`npm ci` 可能 EPERM。处理：
  - 复用 install.ts 已有思路（`maxRetries`/`retryDelay`、明确报错+提示关闭其他 Node 进程）；
  - update 入口打印提示「建议关闭其它 Pi/Node 会话后更新」。
- **进程自重**：`dove_pi.py` 由 PowerShell 启动器 spawn；update 会替换 src/ 但 python 进程已加载到内存，不受影响。npm 更新的是 node_modules 下包，与运行中的 python 无关。唯一风险是 npm 正在重写 `@ast-grep` 原生二进制时被 AV 锁——沿用 `repairNativeDependency` 的重试逻辑。
- **编码**：manifest 用 UTF-8（ensure_ascii=False 与 open-tui 配置一致）；git 输出解析用 `text=True, encoding="utf-8"`，失败兜底 locale。

## 6. 回滚

- 回滚点 = `previousCommit`（manifest 记录）。
- 命令：`git reset --hard <previousCommit>` + `dove-pi install`（重新对齐依赖/扩展/启动器）。
- 无整目录备份（决策 6）。风险：上游已有新提交时 reset 是"往回走"，之后 `update` 会再快进回来——符合预期。
- update 失败于步骤 8-12 时：仓库 HEAD 已是新 commit，但依赖/扩展可能未对齐。下次 update 会重新走 8-12（幂等），失败不影响已有安装的启动。

## 7. 离线-first

- `update` / `update --check` 是唯一联网路径（`git fetch`）。
- `install` 保持现状（npm 可能联网，但不是"检查更新"——有 `--prefer-offline`）。
- 启动/doctor 不加任何 fetch。doctor 可选在未来从 manifest 读 `currentCommit` 展示本地版本（无网络），本轮不做。

## 8. 错误输出约定

- stdout 保留给结构化结果（JSON，一行），延续 CLI 现状。
- 进度/警告走 stderr（`console.error` / python `print(..., file=sys.stderr)`）。
- 退出码：成功 0；中止/失败 1；--check 有更新 0（信息性输出，不因"有更新"而失败）。

## 9. 测试

- `tests/installer_test.py` 增加：
  - manifest 读写（缺失/损坏/默认 profile）
  - 脏树检测逻辑（mock git status）
  - --force 路径（mock git reset）
  - 版本比较（HEAD vs origin/master 相等/落后/分叉）
- TS 侧不改动（update 主体在 Python）。若 extensions/cli.ts 有 routing 改动，补 cli 测试。

## 10. 兼容性与迁移

- manifest 是新增文件，无迁移。
- `.gitignore` 追加 `.dove/`：现有机器上 `.dove/` 空目录，git 本就不跟踪空目录，无影响。
- `dove_pi.py` main() 增加 `update` 路由；不影响既有命令。
- 未来如需 tag 发布：`update` 的 fetch+ff-only 逻辑架构上可扩展为"比较 tag"，但本轮不做（决策 1）。

## 11. 关键权衡

- **Python 而非 TS 承载 update**：牺牲 TS 类型安全换取自更新稳定性与 install 复用（前文理由）。代价是 git 操作无 TS 单测覆盖，用 Python mock 测试弥补。
- **git 而非 zip/tarball 分发**：维持现状（安装位置=clone），零新增分发机制。代价是不适合非 git 用户——PRD 已确认此模型为 Out of Scope。
- **fetch 也算联网**：`--check` 会联网（fetch 远端引用），符合决策 5"显式触发"。
