# A user's whole flow, end to end, with the harness mounted and a mode in force

## Goal

**让"一个真实用户的整条流程"能真的跑一遍** ✓✓ —— 而且是**可判分的**：harness 装着 ✓ · **一个工作模式真的生效** ✗（今天做不到 ✓）· agent 带着 **harness 自己的工具** ✗（今天没有 ✓）· **活由项目自己的套件判分** ✓✓。

**用户价值** ✓✓：这一夜已证明**规格会声称"整个流程"而实测不是** ✗✓（归档读数最前面那条 ✓）—— **所以需要一条真能跑通、且每一步都有仪器的流程** ✓，否则"模拟用户使用"永远只是*看起来*在跑 ✓✗。

## Background（**全部实测，含原文** ✓✓）

### 已经成立的 ✓

- **harness 一直装着** ✓✓：两次运行的账本都带 `request.received` ✓ `request.planned` ✓ `request.attempt.started/completed` ✓ `request.terminal` ✓ `model.budget.checked` ✓ `task.convergence.observed` ✓✓；**launcher 跑的就是 `dove-pi` 自己** ✓（`scripts/real-dove-blackbox.mjs:99` ✓）。
- **判分来源可用** ✓✓：`cachecontrol`（1,492 源码行 / 1,375 测试行 ✓ 真依赖 `requests`/`msgpack` ✓）**自己的套件 `115 passed`** ✓✓；判分仪器（`tests/test_immutable.py` **红** ✓）住在**项目自己的套件里** ✓✓。
- **流程的 CLI 各步可用** ✓✓：`project init` ✓ · `bind native` ✓ · `doctor` ✓ · `task create/verify/convergence/archive` ✓（第二次运行里全部跑过 ✓）。

### 两个实测缺口 ✗✓✓（各自成案 ✓）

**① 声明的 mode 被读到、却必然 `missing-file`** ✗✓✓（`10-05-declared-mode-unloadable` ✓）

```
Dove Pi: workspace=development, workMode=failed, modeRefused:
         Work mode 'code-development' could not be loaded: missing-file: mode…
```

**拒绝信息里的名字正是被声明的那个** ✓✓ → **失败在*目录*** ✗✓：`modes/<name>/` 必须在**运行时能看到的根**下 ✓，而那根是**项目** ✗（`spawn({cwd: workspaceRoot})` ✓）；**本仓的 `modes/` 在本仓里** ✗✓。而 `--cwd=项目` 是规格 §2 给的用法 ✓ → **即：在这个布局下，用户在自己的项目里声明 mode *永远*加载不了** ✗✓✓。

**② 宿主不提供 hashline 编辑工具，而会话照跑** ✗✓✓（`10-05-missing-hashline-edit-tool` ✓）

harness **自报**：*"当前 Pi 宿主未提供 hashline 编辑工具（replace<path> Pi 或执行 dove-pi install。"* ✓✓ → **读数 #3 里那个 agent 在没有这套编辑工具的情况下改了 `controller.py`（**恰好一个文件 +565 B** ✓），目标没修好、还弄坏一条原本通过的用例** ✗✓ → **"模型草率"与"工具不在"在读数上无法区分** ✗✓✓。

### 顺手量到、与"整条跑通"直接相关的三处 ✓✓

- **`--mode rpc` 是*传输*参数** ✓（`:101-103` ✓）；**工作模式开关是 `--workspace-mode=`** ✓（`dove_pi.py:124` ✓）；**覆盖来自环境变量 `DOVE_PI_WORKSPACE_MODE_OVERRIDE`** ✓✓（`extension.ts:694` ✓，**runner 从不设置它** ✓）→ **三者互不相干** ✓✓。
- **`summary` 的资源块取自*单条记录*的 `details`** ✗✓（`redactResourceObservation(record.details)` ✓），**而账本是事件流** ✓ → **累计量必须数账本** ✓（`10-05-divergent-records-unreconciled` ✓）。
- **退出码不可信** ✗✓✓：同一 `task verify` 三种调用给 **-1 / 1 / 0** ✓（对照 `node -e "process.exit(7)"` 给 7 ✓✓）—— **今晚又添一例**：`task.py create` 打印了目录名却 `exit code: 1` ✗✓ → **判据读结构化输出** ✓。

## Requirements

- **R1 一条命令跑完整条流程** ✓✓：安装 ✓ → 绑定 ✓ → 声明并*生效*一个 mode ✗→✓ · 干活 ✓ · 判分 ✓ · 收敛 ✓ · 归档 ✓ —— **每一步都在同一次运行里留痕** ✓。
- **R2 mode 必须真的生效** ✗✓✓：判据是**扩展自己的状态行** ✓（`workMode=<id>` ✓ 而非 `workMode=failed` ✓）—— **不是我推断** ✓。
- **R3 工具面与实际一致** ✗✓✓：要么 hashline 编辑工具在场 ✓，要么**缺失被记在读数看得见的地方** ✓✓ —— **今天它只出现在一条通知里** ✗。
- **R4 判分只在项目自己的套件里** ✓✓（§5 ✓），**基线在跑之前量** ✓（`115 passed / 1 failed` ✓）。
- **R5 累计量取自账本事件流** ✓；**退出码不作判据** ✓。
- **R6 每步成果可被下一个人复盘** ✓：读数进任务记录 ✓，**形状可对照、数值不可比** ✓（§3 ✓）。

## Acceptance Criteria

- [ ] **一条运行里**：`workMode=<声明的那个 id>` ✓（**不是 `failed`** ✗）· 编辑工具在场 ✓ 或缺失被记录 ✓ · 项目自己的套件给出结果 ✓ · **账本的累计量与判分并列** ✓。
- [ ] **流程各步在同一次运行里都有痕** ✓（安装/绑定 ✓ mode ✓ 干活 ✓ 判分 ✓ 收敛 ✓ 归档 ✓）。
- [ ] **两处缺口的处置各有可复现判据** ✓（见"待你定"✗）：修好了是绿的 ✓，没修是红的且有原文 ✓。
- [ ] **失败时如实记、并停下** ✓✓（上一轮的 AC 就是这么写的 ✓ 而它**被执行了** ✓：AC 失效时记下 "AC void, not failed" ✓✓）。

## Out of Scope

**改 `summary` 的资源块** ✗（另有 `10-05-divergent-records-unreconciled` ✓）· **退出码的成因** ✗（同上 ✓）· **`uv`** ✗（另一条路才需要 ✓）· **`cachecontrol` 的 `immutable` 活本身** ✗（它是**判分仪器** ✓，不是目标 ✓）。

## 决定（**已定，故不再是开放问题** ✓✓）

**切法：按"用户能不能自己救自己"** ✓✓ —— 用户能自救的是**准备** ✓，不能自救的是**缺陷** ✗✓。

- **① 一个被声明的 mode 加载不了 → 修** ✓✓（**定案见 `design.md`** ✓：**mode 目录相对*扩展*解析** ✓，**外加"拒绝时说出我找过哪里"作保底** ✓）。
  **理由** ✓✓：**用户在*自己的项目*里声明了 mode，harness *读到了那个名字*，却因为找不到目录而拒绝** ✗✓（拒绝原文里就是 `code-development` ✓）—— **用户在自己那一侧无法自救** ✓ → **这是 harness 的缺陷** ✓。
- **② 宿主没有 hashline 编辑工具 → 记** ✓✓（**定案见 `design.md`** ✓：**把这条事实从"一条通知"变成"读数的一个字段"** ✓，与 mode 走**同一条状态行通道** ✓）。
  **理由** ✓：**宿主是 Pi，不是本仓** ✗ → **修不到根上** ✗；**而"读数看得见"是本仓能给的** ✓✓，**且它立刻让"模型草率"与"工具不在"在读数上可分** ✓✓ —— **本轮最想要的就是这一件事** ✓。

**被否掉的那条** ✗：**把两处都写成"用户必须准备"的一步**（规格 §2 的 *preconditions* ✓）—— **便宜，但它让 AC 里那条 `workMode=<id>` 永远不会绿** ✗✓，**"整条跑通"也就永远做不到** ✗。
