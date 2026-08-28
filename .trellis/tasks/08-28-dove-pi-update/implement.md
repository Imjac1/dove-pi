# dove-pi 自更新与插件更新功能 — 实施计划

## 变更文件清单

| 文件 | 变更类型 | 内容 |
| --- | --- | --- |
| `dove_pi.py` | 修改 | main() 增加 `update` 路由；新增 update 编排函数与 manifest 读写；install() 读 profile + 更新 Trellis CLI + 写回 manifest |
| `tests/installer_test.py` | 新增测试 | manifest 读写、脏树检测、--force、版本比较、Trellis 更新开关 |
| `.gitignore` | 修改 | 追加 `.dove/` |
| `README.md` | 修改 | 文档新增 `dove-pi update` / `--check` / 回滚说明 |
| `src/cli.ts` | 不改（除非 routing 需要） | update 由 python 承载，TS 侧无改动 |

## 实施顺序

### Step 1 — manifest 基础设施（`dove_pi.py`）

1. `MANIFEST_PATH = PROJECT_ROOT / ".dove" / "manifest.json"`；常量 `default_profile = "max"`。
2. `read_manifest() -> dict`：缺失/损坏返回 `{"profile": "max"}`，不抛异常（报 stderr 警告）。
3. `write_manifest(profile, previous_commit=None, current_commit=None)`：UTF-8、`ensure_ascii=False`、原子写（`tempfile` 同目录 + `os.replace`）。
4. `.gitignore` 追加 `.dove/`。

验证：`python -m unittest tests.installer_test`（先补 manifest 单测）。

### Step 2 — `update` 编排（`dove_pi.py`）

1. `run_update(arguments)`：解析 `--check / --force / --verify`（默认 quick）。
2. 预检（无网络，全部本地）：
   - `git rev-parse --is-inside-work-tree` — 非仓库 → 中止；
   - `git remote get-url origin` — 无 origin → 中止；
   - `git symbolic-ref -q HEAD` — detached → 中止；
   - `git status --porcelain` 非空 → 无 `--force` 中止提示；有 `--force` → `git reset --hard HEAD`。
3. `--check` 路径：`git fetch origin master` → `rev-parse HEAD` / `rev-parse origin/master` → 输出 `{ "currentCommit", "targetCommit", "updateAvailable" }` → return 0。
4. 更新前：读 manifest，写 `previousCommit=<HEAD>`（保留 profile）。
5. `git fetch origin master` → 比较：
   - `HEAD == origin/master` → "已是最新"（进入 Step 3 收尾，跳过 npm/扩展）；
   - `origin/master` 是 HEAD 后代 → `git merge --ff-only origin/master`；
   - 分叉 → 中止报错（提示手动处理；`--force` 场景已在预检丢弃本地改动，理论上不会分叉，若发生仍报错）。
6. 依赖安装：复用 install() 的 lockfile 逻辑（npm ci / npm install --prefer-offline）。
7. 扩展对齐：`run_local_cli(["extensions", "install", profile])`。
8. Trellis CLI：`npm update -g @mindfoldhq/trellis`，`check=True=False` 失败仅 stderr 警告。
9. 启动器：`write_launchers(launcher_directory())`（幂等）。
10. 验证：`--verify quick` → `npm run typecheck` + `pi:smoke`；full → 加 `npm test`；none → 跳过。
11. 写 manifest：`currentCommit=<HEAD>`；输出结构化 JSON。

### Step 3 — `install()` 变更

 1. install() 开头 `profile = read_manifest().get("profile", "max")`（替代硬编码 max；`--profile` 显式传入时用传入值）。
 2. 扩展对齐后新增：`npm update -g @mindfoldhq/trellis`（失败 stderr 警告不阻断）。
 3. install 成功后 `write_manifest(profile, current_commit=git rev-parse HEAD)`。

### Step 4 — 收尾

 1. 测试全绿：`npm run test:installer`、`npm run typecheck`、`npm test`。
 2. README 文档：`dove-pi update` 用法、`--check`、`--force`、回滚（`git reset --hard <previousCommit>` + `dove-pi install`）、manifest 说明。
 3. 三件套评审通过 + `task.py start` 后才动代码。

## 验证命令

```bash
python -m unittest discover -s tests -p installer_test.py   # 新增单测
npm run test:installer                                       # 全量 installer 测试
npm run typecheck                                            # TS 侧不回归
npm test                                                     # 全部测试
# 手工场景（真机）:
dove-pi update --check            # 有更新时输出两 commit + updateAvailable:true，工作区无变化
dove-pi update                    # 脏树中止 → --force 继续 → ff 合并 → 收尾
dove-pi update                    # 再跑一次 → "已是最新"
git reset --hard <previousCommit> # 回滚演练
```

## 风险点与回滚

- **分叉合并失败**：中止并提示，不自动破坏（设计保证）。
- **Windows EPERM**：npm ci / 扩展安装报错时，提示关闭其它 Pi/Node 会话后重试；install.ts 已有重试逻辑兜底。
- **manifest 损坏**：读失败回默认，写失败 warn 不阻断主流程。
- **回滚**：`git reset --hard <previousCommit>` + `dove-pi install`；不整目录备份（决策 6）。
- 若 Step 2 实现中发现 update 需要访问 TS 侧能力（如 profile 合法性校验），加 `src/` 最小改动并在 `tests/extensions.test.ts` 补测。

## 评审门（task.py start 前）

- [ ] prd.md 决策总结与 AC 与用户确认一致
- [ ] design.md 架构决策（Python 承载、git ff-only、manifest 契约）评审通过
- [ ] 本 implement.md 顺序与验证命令评审通过
