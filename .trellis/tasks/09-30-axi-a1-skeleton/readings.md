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

~~**S1 最窄的一回合**……~~ → **已于同一天完成，见下。**

---

## S1：最窄的端到端回合 —— ✅ 完成（提交 `bf90771`、`8e16563`）

**产物**：`src/commands/axi-turn.ts`（组合 `createAgentLoop` + `createScriptedProvider` + `createActionPolicy` + `ExecutionLedger` + 一个只读工具）、`src/cli.ts` 的分派（`axi-turn` 子命令）、`tests/axi-turn.test.ts`。

### AC-1 打印一个回合（真实运行，不是测试里的）

```
$ npx tsx src/cli.ts axi-turn code-audit "read the notes and stop"
mode: code-audit   provider calls: 2   stop: completed
gate consultations: 1
  allow read_file
executed actions: 1
blocked actions: 0
refused by the effect boundary: 0
ledger records written: 0
```

### AC-2 配对判据（同一个 provider、同一个工具、同一句提示，**唯一变量是模式的 `never_allow`**）

| 运行 | 结论 |
|---|---|
| 允许 | `executedActions === 1` ✓ |
| 名字层拒绝（`never_allow: [read_file]`） | `executedActions === 0` ✓，且 `blockedActions[0].reason` 点名了被拦的工具 ✓ |

### AC-3 keep / revert

临时 git 仓里演练：一次提交（keep）+ `git revert`（revert），**两个 hash 都断言可读且不同**，且 revert 后文件内容回到原样 ✓。**hash 是每次运行各自的**（临时仓即建即删），所以"记录"落在测试断言与这条读数上；把它写进**账本**是 S6 真改动时的事。

### AC-4 可达性：**实验做了，双向都通过**

删掉 `loop-runner` 与 `loop-scripted` 两条 allow-list 条目后，`tests/harness-reachability.test.ts` **6/6** ✓——两条断言同时成立："没有列在表里却可达的模块"（删对了）与"没有可达却还留在表里"（没漏删）。

**关键前提是用代码先证的**：`src/cli.ts` **就是走查的四个入口之一**（`ENTRY_POINTS`，在 `tests/harness-reachability.test.ts` 顶部；注释写明 *"the other three are CLI and adapter fronts"*），且它是生产路径（`package.json` 的 `doctor` 脚本、`dove_pi.py` 里的 `CLI` 常量）。

### AC-5 门禁

`typecheck` **0** · `test` **825 / 823 pass / 0 fail / 2 skipped**（基线 822/820/0/2 + 新增 3 条）· installer **141 OK**。

## 三件值得留档的事

1. **一条既有门禁抓到了我，而且抓得对**：`document-drift` 的 *"cites a thing and not a position, in the live code"* 红在我写的 `tests/harness-reachability.test.ts:27` 上——**而我的编辑恰好让那些行号移位**（引用瞬间过期）。该检查的注释写着它上一轮发现 18 处位置引用里已有 2 处过期。已改成"指事"（"the list at the top of …"）。
   **与《使用期架构》那一页不冲突**：这条检查只走 `src` 与 `tests`，而规格页的 `file:line` 锚点是**刻意的、且 AC-7 要求**（规格描述"现在就有"，读者要能跳转）。
2. **"允许"没有对应的记录种类**：账本里 `appendGateRefused` 覆盖拒绝，而**允许**一次动作没有合适的 kind——`appendDispatchDecision` 的 `route/reason/estimate` 是 dispatch 路由的概念，唯一调用者是 `dispatcher.ts`；用它记闸门放行就是第二套词汇。所以**只记拒绝**是对的，这条不完整如实记在这里。
3. **我的测试违背了我自己设计里写的风险**：设计写着"演练只断言提交与 revert 各一次、**不断言行尾**"，而我写了内容断言 → 临时仓继承全局 `core.autocrlf=true` 后它红了。修法不是删断言，而是**在临时仓里把行尾变量消掉**（`core.autocrlf=false`）——断言因此更强，不是更弱。

## 下一步

`checkpoint.ts` 仍在 allow-list 上（原因已改正为"**参照 loop 不组装 checkpoint**"）；它到期是在回路真正组装效果边界时。再往后：**S4（参数层：三种规避手法 + 故障注入）**、**S5（trace 三性质）**。
