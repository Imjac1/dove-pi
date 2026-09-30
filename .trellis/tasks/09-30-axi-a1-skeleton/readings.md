# A1 读数

判据与决策表见 `prd.md` / `design.md`。**失败、未完成、以及自我纠正都写在这里。**

---

## S0 门禁先行 —— ✅ 通过（三条读数与 dove-pi 逐项相同）

**判据**（`plan.md` §5.3 S0 / 程序级 AC-3）：新仓在没有写入任何新代码之前，跑出与 dove-pi **逐项相同**的三条门禁读数。没有这一步，"门禁不下降"无从比较。

### 做法（可复现）

| 步 | 做了什么 |
|---|---|
| 1 | `git -C dove-pi rev-parse --short HEAD` → 快照来源提交 **`70ac2dc`** |
| 2 | 新建 `C:\Users\Macfy\Desktop\dsh\axi`（与 dove-pi 并列，**不改本仓**） |
| 3 | 复制**门禁实际读到的整棵树**（见下"复制与不复制"），不含 `.git` / `node_modules` |
| 4 | `npm ci`（从 `package-lock.json` 装依赖；registry 可达，PONG 1746ms） |
| 5 | `git init` + 初始提交 **`75df0e6`**（392 个跟踪文件） |
| 6 | 跑三条门禁，读原始读数 |

### 原始读数（axi 仓，2026-09-30）

| 门禁 | dove-pi 基线 | axi 实测 | 判定 |
|---|---|---|---|
| `npm run typecheck` | exit 0 | **exit 0** | ✅ 相同 |
| `npm test` | 816 / 814 pass / 0 fail / 2 skipped | **816 / 814 / 0 / 2** | ✅ 相同 |
| `npm run test:installer` | Ran 141 tests / OK | **Ran 141 tests in 17.424s / OK** | ✅ 相同 |

**结论：门禁等价成立，且有原始读数。** 从现在起，axi 的每一次改动都以这三条为底线（AC-8）。

### 复制与不复制（都带理由）

**复制的**：`src/`、`tests/`、`scripts/`、`bin/`、`installer/`、`modes/`、`engagements/`、`.pi/`、`.agents/`、`.codex/`、`.github/`、根文件（`README*.md`、`AGENTS.md`、`package.json`、`package-lock.json`、`tsconfig.json`、`.gitattributes`、`.gitignore`、`install.ps1`、`dove_pi.py`），以及 `.trellis/` 下的 `spec/`、`scripts/`、`agents/`、`workflow.md`、`harness-surface.yaml`、`config.yaml`、`.version`、`.developer`、`.gitignore`、`.template-hashes.json`。

**不复制**（各有理由）：

| 没复制 | 理由 |
|---|---|
| `.git/` | 新仓自己 `git init`；继承历史会让"axi 自己的第一次提交"无从辨认 |
| `node_modules/` | 220 MB / 三万文件；`npm ci` 从 lockfile 装，读数一样且更干净 |
| `.trellis/.backup-*`、`.trellis/.runtime` | 本安装的备份与运行时会话状态，不是门禁输入 |
| `.trellis/tasks/*`（含 `archive/`） | dove-pi 的规划与历史；新仓要自己的。但 `.trellis/tasks` 与 `.trellis/workspace` **必须存在**——`harness-surface.yaml` 把它们声明为 `long-term-memory`，而该声明的每个路径都要能解析。故各放一个 `.gitkeep` |
| `docs/` | **本仓本来就没有这个目录**（先前 grep 命中 "docs" 是子串误报）。这是一条自我纠正：我按子串匹配列了复制清单，实际不存在 |

### 一条环境事实（对第 1 步有直接影响）

本会话的 DSH 文件策略下，**Node 的 `child_process` 用管道捕获子进程输出会 EPERM**（受限模式不能开命名管道）。所以：

- 探针/助手程序**不能靠 stdout 回传结果**，要**写文件**再读；
- 测试里起子进程用 `stdio: 'ignore'` / `'inherit'`，不用 `'pipe'`。

这条决定了 jailer 模块与它的回归测试的接口形状（工件即接口），记在这里备用。

### 下一步

**S1 最窄的一回合**（`loop-runner` + scripted provider + 一个只读工具 + 名字层闸门 + ledger 落盘 + 打印回合），判据：配对闸门测试 `executedActions 1 → 0`，且一次 keep 与一次 revert 的路能走通（AC-4 的骨架）。
