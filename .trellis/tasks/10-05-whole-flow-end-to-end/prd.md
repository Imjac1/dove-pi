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

- [x] **一条运行里**：`workMode=<声明的那个 id>` ✓（**不是 `failed`** ✗）· 编辑工具在场 ✓ 或缺失被记录 ✓ · 项目自己的套件给出结果 ✓ · **账本的累计量与判分并列** ✓。
      **四条全成立** ✓✓（读数见 `readings.md` 第二份 ✓）：`workMode=code-development` ✓ · `hashlineEditTools=absent` 进了读数 ✓ · 副本里 `1 failed, 115 passed` ✓ · 累计量数自账本事件流 ✓。
- [ ] **流程各步在同一次运行里都有痕** ✓（安装/绑定 ✓ mode ✓ 干活 ✓ 判分 ✓ 收敛 ✓ 归档 ✓）。
      **不成立** ✗✓✓：**干活那一步被 25 分钟上限切断** ✗（`harnessTimedOut=true` ✓ `settled=false` ✓ 终态 `cancelled/user-cancelled` ✓），**收敛与归档从未到达** ✗（`task.convergence.observed = 0` ✓）。**原因量到了** ✓：截断时会话仍在 bash/edit 交替、最后三次是调试探针 ✓ —— **不是步骤坏了，是预算用完了** ✓。**这一条留开** ✗，**不写成达成** ✓。
      **（2026-10-11 第四次尝试，仍不成立，而原因第四次不同 ✓✗）**：45 分钟预算**给足** ✓，运行却在 **27.8 分钟**因 **provider 瞬时重试预算用尽**自行结束 ✗（`terminal=provider-attempt-limit` ✓ `retryable=true` ✓）；step 0 未 settle ⇒ 步骤 1–3 **一次都没发出** ✗。**多量出一条更早的阻断** ✓✓✓：请求被判成 **`lane=fast`** ⇒ **根本没开正式任务** ✗（`formalTaskCount=0` ✓）⇒ **收敛与归档在请求被规划的那一刻就已注定到不了** ✓；根因在 `src/core/request-plan.ts:178`/`:77`（`what` 的子串命中 + 逃逸名单为空），**而那个 `what` 是上一轮自己写进 prompt 的** ✗✓。判据用仓内真实判定函数**确定性复现** ✓，改写后复核为 `lane=formal` ✓。**判分那一半红了五天的那条已被修绿** ✓✓（副本 `118 passed` ✓），**且判分仪器字节未变** ✓✓。**读数见 `readings.md` 第五次。这一条留开** ✗，**不写成达成** ✓。
      **（2026-10-11 第五次尝试，仍不成立，原因第五次不同 ✓✗）**：lane 修复**在真跑里成立** ✓✓（`formalTaskCount=1` ✓，任务从消息开出来 ✓），而且**引擎里两道门都真的动了** ✓✓（收敛门 `product_mutation.blocked` ✓ 让请求以 `convergence-missing`、`retryable=false` 中止 ✓；沙箱门 `gate.refused` 拦下 `fetch_content` ✓）。**而 step 0 正是被自己的收敛门中止的** ✗✓✓：**门要求先冻结验收标准再改产品文件，而 prompt 从未这么说** ✗ ⇒ 请求在门口停 ✓；收尾那步再由 provider 的瞬时配额杀场 ✗✓（两次真跑同一死因 ✓）。任务终态 `active/intake`、**无 `convergence.json`** ✗ ⇒ **finish/archive 仍未到达** ✗；副本套件 `2 failed, 114 passed` ✗（目标仍红且弄坏一条 ✓，仪器未动 ✓）。**第五个阻断已定位并已修** ✓：场景第 0 步写明"先冻结再改"，复核仍为 `lane=formal` ✓。**读数见 `readings.md` 第六次。这一条留开** ✗，**不写成达成** ✓。
      **（2026-10-11 第八次读数**（位置在第六、七次之前，但它量的是第五次真跑 —— 段序不按时间，按"每次读数只写一条" ✓）**：provider 侧失败被逼到边界 ✓✗）**：第五次真跑同形（**20.6 s**、三次 `error`、零 token、intake 仍工作 ✓）。**六种解释全部实测排除** ✓：端点（连续三次 401 = 服务在 ✓）· 凭据（用运行携带的 key 请求 **200** ✓）· 栈（**Node 自己的 undici** 也 200 ✓）· 流式（两种都 200 ✓）· 载荷体积（合成到 **112.2 KB** 仍 200 ✓）· 配置（`baseUrl` 与我所测一致 ✓）。而 Pi 的请求 **18–76 ms 内失败** ✗ ⇒ **差别只能在 Pi 构造/处理那次请求的路径里** ✓，而 provider 通道属于 Pi（D1 ✓）⇒ **不写成"原因已找到"** ✗。**这段条件下 Dove 的行为是对的** ✓✓（归为瞬时 ✓、`retryable: true` + nextAction ✓、**intake 照常建任务与产物** ✓）。**读数见 `readings.md` 第八次。这一条留开** ✗，**不写成达成** ✓。
      **（2026-10-11 第六、七次尝试：provider 每轮第一次调用就被拒 ✓✗）**：两轮各 **20.4 s / 16.9 s** 就结束 ✗，`providerRounds=3`、`stopReasons=["error","error","error"]`、**零 token、模型一个字没答** ✗；而 **intake 仍工作** ✓（`lane=formal` ✓、正式任务 + 6 份产物 ✓）。运行自己的会话原文：前两次 `stopReason="error"`、第三次 `"aborted"` + `errorMessage="Connection error."` ✓；账本上是 `failureKind="transient"`、`failureReason="reviewed-provider-message"`、**18–76 ms** ✓（不是超时）。**四种解释逐一实测排除** ✓：端点通（DNS ✓ 连续三次 401 ✓）· **key 好用**（用运行携带的那份发最小请求 → 200 ✓）· 流式与非流式都是 200 ✓ · 同规模 payload（49 tools / 40.5 KB）200 ✓；而**两次成功与两次失败的 payload 逐项相同** ✓。→ **不是本仓的问题** ✗，也**不是凭据、不是载荷、不是网络**；**剩下的可能一个都没量到，故不写原因** ✗。**缺的是一个不被打断的 provider 窗口** ✗。**读数见 `readings.md` 第七次。这一条留开** ✗，**不写成达成** ✓。
      **（2026-10-11 第六次读数后的处置（第十二次读数 ✓）：把"先冻结"从散文搬进事实驱动的通道 ✓✓）**：
      第十一次读数定下"只靠散文的规则没人守"✓（模型两次没照做 ✓），而**操作者选定不改策略** ✓ —— 走 GUIDANCE 通道 ✓。
      于是两句分开 ✓：**"有门、门是什么"进稳定系统提示** ✓（`extension.ts:3462` ✓，那句 `never gate Pi tools` 已被实测证伪 ✓），
      **"先冻结"进 `[PERSONAL AGENT REQUEST GUIDANCE]`** ✓，且**由事实驱动** ✓ ——
      条件 `lane === "formal" && readTaskConvergence(...).kind === "missing"` **就是门自己的那次读** ✓（`:2750` ✓），
      **门沉默处这句话也沉默** ✓。**两个方向都实测见红** ✓✓（拿掉 → 红 ✓；改成永远出现 → 红 ✓），
      并登记进 `AGENTS.md` 规则表 ✓。判据：`typecheck 0` ✓ · `npm test 974/974` ✓ · 文档门 16/16 ✓ · **零 token** ✓。
      **仍未达成** ✗✓：AC#2 本身 ✗ —— 本轮的判据（"下一次真跑里账本应在第一次 `tool.started` 之前出现冻结"）**未取** ✗，
      它要一个不被打断的 provider 窗口 ✓（第十次读数已证那是算术、不在本仓手里 ✓）。**这一条留开** ✗，**不写成达成** ✓。
- [x] **两处缺口的处置各有可复现判据** ✓（定案见 `## 决定`✓ 与 `design.md`✓）：修好了是绿的 ✓，没修是红的且有原文 ✓。
      **两处都成立** ✓✓：① `workMode` 从 `failed` ✗ 变成 `code-development` ✓；② `hashlineEditTools=absent` 在读数里 ✓。
      而 ② **多量出一层** ✓✓：**这不是宿主不提供** ✗ —— 宿主装了 ✓、声明也带进了运行 ✓，**没带的是包** ✗（run 的 agent 目录里没有 `npm/` ✓）→ **缺口的可修面在本仓的运行器，不在 Pi** ✓。
- [x] **失败时如实记、并停下** ✓✓（上一轮的 AC 就是这么写的 ✓ 而它**被执行了** ✓：AC 失效时记下 "AC void, not failed" ✓✓）。

## Out of Scope

**改 `summary` 的资源块** ✗（另有 `10-05-divergent-records-unreconciled` ✓）· **退出码的成因** ✗（同上 ✓）· **`uv`** ✗（另一条路才需要 ✓）· **`cachecontrol` 的 `immutable` 活本身** ✗（它是**判分仪器** ✓，不是目标 ✓）。

## 决定（**已定，故不再是开放问题** ✓✓）

**切法：按"用户能不能自己救自己"** ✓✓ —— 用户能自救的是**准备** ✓，不能自救的是**缺陷** ✗✓。

- **① 一个被声明的 mode 加载不了 → 修** ✓✓（**定案见 `design.md`** ✓：**mode 目录相对*扩展*解析** ✓，**外加"拒绝时说出我找过哪里"作保底** ✓）。
  **理由** ✓✓：**用户在*自己的项目*里声明了 mode，harness *读到了那个名字*，却因为找不到目录而拒绝** ✗✓（拒绝原文里就是 `code-development` ✓）—— **用户在自己那一侧无法自救** ✓ → **这是 harness 的缺陷** ✓。
- **② 宿主没有 hashline 编辑工具 → 记** ✓✓（**定案见 `design.md`** ✓：**把这条事实从"一条通知"变成"读数的一个字段"** ✓，与 mode 走**同一条状态行通道** ✓）。
  **理由** ✓：**宿主是 Pi，不是本仓** ✗ → **修不到根上** ✗；**而"读数看得见"是本仓能给的** ✓✓，**且它立刻让"模型草率"与"工具不在"在读数上可分** ✓✓ —— **本轮最想要的就是这一件事** ✓。

**被否掉的那条** ✗：**把两处都写成"用户必须准备"的一步**（规格 §2 的 *preconditions* ✓）—— **便宜，但它让 AC 里那条 `workMode=<id>` 永远不会绿** ✗✓，**"整条跑通"也就永远做不到** ✗。
