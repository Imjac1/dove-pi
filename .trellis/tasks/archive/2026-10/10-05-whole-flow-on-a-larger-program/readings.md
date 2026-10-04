# 读数（**规范结构，每条实测只出现一次** ✓）

## ⚠ 最重要的更正：**这一轮没有真的模拟用户使用** ✗✓✓（2026-10-05，事后量出 ✓）

### 再更正一次：**判决对，但我给的原因错了** ✗✓✓（同日，第三次运行后量出 ✓）

**我说**：harness 没装上（拿 `.dove` 缺席 ✓ · `executionMode "standard"` ✓ · 会话记录无 mode 字样当证据 ✗✓）。
**真相** ✓✓✓：**harness 一直装着** ✗✓ —— **两次运行的账本都带着 harness 自己的生命周期记录** ✓✓（`request.received` ✓ `request.planned` ✓ `request.attempt.started/completed` ✓ `request.terminal` ✓ `model.budget.checked` ✓ `task.convergence.observed` ✓✓），**而 launcher 跑的就是 `dove-pi` 自己** ✓（`real-dove-blackbox.mjs:99` ✓）。

**缺的是*工作模式*，而原因在第四次测量里定死了** ✓✓：项目里那份 `.dove/mode.json`（`{schemaVersion: 1, mode: "code-development"}` ✓，55 B、无 BOM ✓）**被读到了** ✓✓ —— 扩展自己的状态行给出了证据 ✓：

```
Dove Pi: workspace=development, workMode=failed, modeRefused:
         Work mode 'code-development' could not be loaded: missing-file: mode…
```

**拒绝信息里的名字正是被声明的那个** ✓✓ → **所以失败发生在*目录*** ✗✓：`modes/<name>/` 要落在**运行时能看到的根**下 ✓，而运行的 `--cwd` 是**项目** ✓、**仓自己的 `modes/` 在*仓*里** ✗✓ → **在这个布局下工作模式*不可能*加载** ✗✓✓ = **一条边界**（已开 `10-05-declared-mode-unloadable` ✓）。

**而这一节先前写的那条原因是错的** ✗✓✓（保留于此以便对照 ✓）：我写过 *"运行器每次都传 `--mode rpc`，按优先级它压过项目声明，`mode.json` 连问都没被问"* ✗✓ —— **被推翻** ✓：**CLI 的工作模式开关是 `--workspace-mode=`** ✓（`dove_pi.py:124` ✓），**扩展的覆盖来自环境变量 `DOVE_PI_WORKSPACE_MODE_OVERRIDE`** ✓✓（`extension.ts:694` ✓），**而 runner 的 env 块里没有它** ✓✓ → **`--mode rpc` 与 `executionMode` 都不是在工作模式这件事上说话** ✗✓。

**同一次测量还给出第三条** ✗✓✓✓：**harness 自报"当前 Pi 宿主未提供 hashline 编辑工具"** ✓✓ → **读数 #3 里那个 agent 是在*没有*这套编辑工具的情况下干活的** ✗✓ → **"改了一个文件、弄坏一条原本通过的用例"因此有了一个*在在场的*解释** ✓✓（已开 `10-05-missing-hashline-edit-tool` ✓）。

→ **所以下面这条判决仍然成立** ✓（"用户走完整个流程"确实没成立 ✓ —— mode-scoped 的控制那一套确实没在场 ✗），**而它的证据要按上面这一条读** ✓✓。**"harness 在不在" 与 "工作模式选没选上" 是两个问题** ✓✓ —— **我先前把它们混成了一个** ✗✓✓。

### 当事人（我）当时的量法与结论 ✗✓（保留原样，便于对照 ✓）

**被问到"你模拟用户真实使用了吗"时，我先去量、再回答** ✓✓：

| 测的 | 读数 |
|---|---|
| **agent 干活时项目绑定了吗** | **`.dove` 不存在** ✗✓✓（**两次运行的副本都没有** ✓）；**克隆里的 `.dove` 是我*事后*才建的** ✓ |
| **运行时用的哪个 mode** | **`executionMode: "standard"`** ✗✓✓✓ —— **不是任何 Dove mode** ✓ |
| **会话记录里有没有 Dove 的痕迹** | 37 行 ✓；grep `Dove mode` / `Effect refused` / `action-policy` → **零命中** ✗✓ |

**所以** ✓✓：**agent 那一半是真的** ✓（真模型 ✓ 真项目 ✓ 16 轮 ✓ 15 工具 ✓）；**user 那一半不成立** ✗✓✓ —— **项目没绑定** ✓（无 mode ✓ 无权限轴 ✓ 无能力面 ✓✓）· **流程各步是我事后分开手工跑的** ✓，**不是一条连续的用户旅程** ✓ · **"用户"就是*我*，没有被模拟** ✗✓。

**它改写了两件事** ✗✓✓：
1. **这一轮测的是"裸 Pi 会话在真项目上干活"** ✓ —— **不是"这个 harness 在真项目上走整个流程"** ✗✓✓：**harness 的那一半根本没被测到** ✓；
2. **读数 #1 的机制因此*不完整*** ✗✓：我量到的（`summary` 的资源块取自**单条记录的 `details`** ✓，而账本是事件流 ✓）**成立** ✓，**但 `executionMode: "standard"` 是第二个、独立的解释** ✓ → **两个原因都在、都未排除** ✓✓（`providerEvidence: []` 与 `terminalConsistency: "completed-ledger-only"` 在无扩展的会话下也自洽 ✓✓）。

**这条更正应当先于下面每一条读** ✗✓ —— 下面的读数在"真实模型在真项目上干活"这一点上依然有效 ✓✓，**在"harness 走流程"这一点上不成立** ✗。

## 🎯 读数 #1（**对照跑** ✓）：**summary 说零，会话记录说它干了活** ✗✓✓

**命令** ✓（规格 §2 原文 ✓）：`node scripts/real-dove-blackbox.mjs --launcher source --provider real --cwd %TEMP%\dove-whole-flow\cachecontrol --scenario tests/fixtures/scenarios/read-only-audit.json --output %TEMP%\dove-whole-flow\runs\control.jsonl --timeout-ms 900000` ✓。

**同一次运行里，两份记录互相矛盾** ✗✓ —— **而 §4 的读数格式取自 `summary`** ✓：

| 来源 | 它说什么 |
|---|---|
| **会话记录**（`pi-session/*.jsonl`，26,097 B ✓） | `system` → **`assistant`/`think`** → **3 × `toolResult`（`toolCallId: chatcmpl-tool-…`）** → **`think`** → **`assistant`/`text`** ✓✓ = **模型思考、调工具、读结果、给答复** ✓ |
| **`summary.json`**（§4 读数取自它 ✓） | `inputTokens 0` · `outputTokens 0` · `observedTokens 0` · `toolCalls 0` · `providerRounds 4` · `resources.elapsedMs 8` · `stopReasons []` ✗✓ |
| **成功信号**（两端都亮 ✓） | `exitCode 0` · `settled true` · `harnessTimedOut false` · `sawAgentStart/End/Settled = true/true/true` · **`reason "completed"`** · **`stderr` 空** · `terminal {origin: session, code: completed}` · **`terminalConsistency "completed-ledger-only"`** ✓✓ |

→ **这不是"运行坏了"，是"记录坏了"** ✓✓ —— 且**只有把两份记录对起来看才发现** ✓✓。

**更正轨迹** ✗✓（两次，都是我读错，都被下一份证据推翻 ✓）：
1. **"没有凭据"** ✗ → 被推翻 ✓：**凭据在 `models.json` 的 `apiKey` 里** ✓✓，**被完整携带**（496 B ✓），**且此刻有效** ✓（直接调 CLI 回 `ok` ✓ exit 0 ✓）。
2. **"静默 no-op"** ✗ → 被推翻 ✓✓：**会话记录 11 条 message** ✓，含思考 ✓、三次工具结果 ✓、最终答复 ✓✓。

**为什么它最重** ✓✓：**整轮实验的证据基础**就是这份读数 ✓ —— **只读 `summary`** 会得出"模型没参与" ✗（**我起初正是如此，两次** ✗✓）；**只读会话记录** 会看不到 token 与成功信号的缺口 ✗。**两份必须一起读** ✓✓。

### 分叉的机制（**已量到行** ✓✓）

**账本里数据是全的** ✓✓（`dove-state/execution.jsonl`，41 行 ✓）：`provider.request.started` **×4** ✓ · `provider.request.completed` **×4** ✓ · **`tool.observed` ×2** ✓ · `request.terminal` ×1 ✓ —— **而 summary 说 `toolCalls: 0`** ✗✓ → **它不只和会话记录矛盾，也和账本矛盾** ✓✓。

**原因在 runner 的取值方式** ✓✓：

```js
:489  const resources = resourceRecord ? redactResourceObservation(resourceRecord) : strategy?.resources;
:516  function redactResourceObservation(record) {
:517      const details = record?.details || {};
:519      toolCalls: details.toolCalls,
:520      providerRounds: details.providerRounds,
:523      inputTokens: details.inputTokens,
```

→ **这些字段全部取自*同一条*记录的 `details`** ✗✓✓ —— 而账本是**事件流** ✓ → **"单条详情"与"事件流"在结构上即可不一致** ✓✓。

**那条记录是谁** ✓（已量 ✓）：`execution-ledger.ts` 里 `resourceRecord` 的选法是 `[…].reverse().find(kind === "task.convergence.observed")` ✓✓ = **末次收敛观测** → **summary 描述的是那一刻的状态，不是整场累计** ✗✓✓ —— 而 §4 的格式让后者看起来像"整场运行的数字" ✓✓。**（runner 从何处取得那条记录：尚待核 ✗✓ —— 我不把它写成已知。）**

**因此本轮的实用规则** ✓✓：**累计量取自账本事件流** ✓（数 `provider.request.*` ✓ · 数 `tool.observed` ✓）；**summary 的 `resources` 只作末次观测读** ✗✓。

## 🎯 读数 #3（**流程跑** ✓）：**努力是真的，结果是错的** ✗✓✓

**命令** ✓：同一 `real-dove-blackbox.mjs` ✓，`--scenario tests/fixtures/scenarios/immutable-directive-work.json` ✓，`--cwd` = 克隆 ✓，输出在仓外 ✓。

**判分在运行器自己那份副本里跑** ✓✓（规格 §5：**活做得对不对，由项目自己的测试说** ✓✓）：

```
FAILED tests/test_immutable.py::TestImmutable::test_immutable_is_not_revalidated_while_fresh   ← 目标
FAILED tests/test_redirects.py::TestPermanentRedirects::test_bust_cache_on_redirect           ← 原本通过
2 failed, 114 passed in 2.30s        （基线：115 passed / 1 failed ✓）
```

**两次运行的对照** ✓✓：

| 项 | 对照跑 | **流程跑** |
|---|---|---|
| 账本行数 | 41 ✓ | **132** ✓✓ |
| `provider.request.started` / `.completed` | 4 / 4 ✓ | **16 / 16** ✓✓ |
| **`tool.observed`** | 2 ✓ | **15** ✓✓ |
| 改动 | 无 ✓ | **`cachecontrol/controller.py` 改过** ✓✓（03:07:41 ✓ **20,655 B vs 原 20,090 B** ✓ = **+565 B** ✓） |
| summary 的裁决 | `exitCode 0` · `reason "completed"` ✓ | **`exitCode null`** · **`settled false`** · **`reason "cancelled"`** · **`terminalConsistency "harness-timeout"`** ✗✓ = **15 分钟到点** ✓ |
| **项目自己的套件** | 115 / **1 failed**（我放的红 ✓） | **114 / 2 failed** ✗✓✓ |

→ **结论** ✓✓：**努力是真的** ✓ · **改动是真的** ✓ · **结果是错的** ✗✓（目标仍红 ✓ **且弄坏一条原本通过的** ✗✓✓）。

**这一轮的核心发现被它演示了** ✓✓✓：**"会话结束了" 与 "活做对了" 是两个不同的问题** ✓ —— **field run 只能回答第一个** ✓（§5 ✓✓），**第二个只有项目自己的套件能答** ✓✓。

**对读数 #1 的修正** ✗✓：**summary 不是总在撒谎** ✓ —— 这一次它的**裁决字段是诚实的**（`cancelled` ✓ `harness-timeout` ✓）；同一个零仍出现在 `toolCalls`/`inputTokens` 上 ✓✗ → 更准的说法：**summary 的*裁决*可信，*资源累计*不可信** ✓✓。

**改动的范围** ✓✓（**已量，逐文件比对** ✓）：**恰好一个文件** ✓ —— `cachecontrol/controller.py` ✓（**orig 20,090 B → copy 20,655 B** ✓ = **+565 B** ✓✓）；**副本里没有任何新文件** ✓✓。→ **所以它不是乱改** ✗✓：**一处、专注、看着合理的改动** ✓，**却既没达成目标、又弄坏旁边一条用例** ✗✓✓ —— 这比"改得一团糟"更值得记 ✓✓。

## 第 6 片：**形状差值**（§3：*"可比的是形状，不是数值"* ✓✓）

**可比的部分** ✓✓（每一项都是"哪些字段被填充、字段间关系是否成立" ✓）：

| 形状 | 对照跑 | 流程跑 | 关系 |
|---|---|---|---|
| 账本是否记录了 provider 往返 | 是 ✓（4 / 4 ✓） | 是 ✓（**16 / 16** ✓✓） | **关系成立** ✓（started = completed ✓） |
| 账本是否记录了工具观测 | 是 ✓（2 ✓） | 是 ✓（**15** ✓✓） | **关系成立** ✓ |
| 是否有 `request.terminal` | 有 ✓（1 ✓） | 有 ✓（1 ✓） | **关系成立** ✓ —— 两次都终止了 ✓ |
| 裁决的种类 | `completed` ✓ | **`cancelled` + `harness-timeout`** ✗✓ | **不同** ✓（且**这一次 summary 的裁决是诚实的** ✓） |
| 项目被改动 | **否** ✓ | **是** ✓（`controller.py` **+565 B** ✓✓） | **不同** ✓，与场景一致 ✓ |
| **项目自己的套件** | 115 / **1 failed** ✓ | **114 / 2 failed** ✗✓ | **活没做对，且弄坏了别处** ✓✓ |
| summary 的 `tokens` / `toolCalls` | 全 0 ✗ | 全 0 ✗ | **同一处结构性缺陷** ✓✓（非偶发 ✓） |

**不可比的部分** ✗✓（必须写明 ✓）：
- **两次用的场景不同** ✓（`read-only-audit` ✓ vs `immutable-directive-work` ✓）→ 所以**轮数/工具数/token 的*数值*不可比** ✗ ✓；
- **时长不同** ✓（对照跑**未到点** ✓ / 流程跑**到点被取消** ✗✓）→ 它**同时解释**了流程跑为什么轮数更多 ✓（它跑了 15 分钟 ✓）；
- **与上一轮（12 段手搓会话）的任何数字都不可比** ✗✓✓ —— **仪器不同** ✓（`real-dove-blackbox.mjs` vs 我直接调 CLI ✓）；**可对照的只有"形状"层面的一点：两次都真的调到了 provider** ✓✓；
- **§5 的边界** ✓✓：**field run 不覆盖"活做得对不对"** ✗✓ —— **所以判分一律在项目自己的套件里** ✓✓，**绝不从 field run 的读数里推断** ✗。

## 附：这次运行的基础（实测 ✓）

同一个 scenario root（`control.jsonl-single-f1a803bfa4f3\` ✓）：**项目的*副本*** ✓（`project/` ✓，含我那条 `test_immutable.py` ✓✓）· `dove-state/execution.jsonl` **25,652 B** ✓ · **凭据按名携带**（`auth.json` 2 B ✓ `models.json` **496 B** ✓ `settings.json` 71 B ✓✓）· **`providerEvidence: []`** ✓（§5：真 provider 下按构造为空 ✓）· `activeToolCount 17` ✓。

## 第 3 片：**判分仪器**（已建 ✓，红 ✓✓）

**任务** ✓（用户选 (c) 后由我按"先量后挑"定 ✓）：**让 `cachecontrol` 遵守 `Cache-Control: immutable`（RFC 8246）** ✓✓。

**为什么是它** ✓✓（三条标准全部量过 ✓）：**代码 0 次、文档 0 次** ✗（对照：`max-age` 12 次 ✓ `no-store` 6 次 ✓）· **无一处说它故意不支持** ✓（全文 0 命中 ✓）· **小且可判** ✓✓（RFC 8246 = 新鲜期内不得再验证 ✓ = 库自己的信号 `from_cache` ✓✓）。**淘汰** ✗：`stale-while-revalidate`（需*后台*再验证 ✗ 而它是同步库 ✓）· `stale-if-error`（需错误路径 + 时序 ✓ 偏大 ✗）。

**仪器** ✓✓（**在克隆内** ✓，不在本仓 ✗）：① `tests/conftest.py` 的 `SimpleApp` 加路由 `immutable_cacheable` ✓（该应用把路径首段 `getattr` 成同名方法 ✓✓）；② 新增 `tests/test_immutable.py` ✓，断言**只有一个信号** `from_cache is True` ✓✓。

**它的红** ✓✓：`assert False is True` · `where False = <Response [200]>.from_cache` ✓ —— 服务器起了（`ENGINE Serving on http://127.0.0.1:63560` ✓），**而库真的又去了一趟服务器** ✗✓✓。→ **"做完了"有了机器可判的定义，且住在项目自己的套件里** ✓（AC 4 ✓），**agent 的活只剩代码改动** ✓（"小" ✓）。

## 第 4 片：**项目**（四条标准全部实测 ✓）

**`cachecontrol`**（`github.com/psf/cachecontrol` ✓，HEAD `d6e3140` ✓）：

| 标准 | 读数 |
|---|---|
| ① 自己的测试套件 | **17 测试文件 / 1,375 行** ✓✓ · **`115 passed in 2.23s`** ✓✓ |
| ② 真实运行时依赖 | **`requests >= 2.16.0`** ✓ · **`msgpack >= 0.5.2, < 2.0.0`** ✓✓ |
| ③ 比 `yocto-queue`（~300 行）大一档 | **14 源文件 / 1,492 行** ✓（≈5× ✓） |
| ④ 可整体克隆、无需凭据 | ✓（公开 ✓ 已克隆 ✓） |

**淘汰的候选** ✗（记原因，避免重走）：**`itsdangerous`**（无运行时依赖 ✗ · 951 行 ✗ · collection 5 错 ✗✓）· **`jinja`**（11,616 行 ✓✓ 依赖真 ✓，但其 dev/test 组在 **PEP 735** ✗✓、套件需 `trio` ✓ → 对本次实验过于复杂 ✗）。

## 🎯 读数 #2：**在 Windows 上，让真实项目自己的测试跑起来是八步** ✗✓✓

**它是第 4 片（判分来源）的前提** ✓✓ —— 即**任何真实项目都会先撞上这八步** ✓，**且它发生在任何 agent 会话之前** ✓✓。

| # | 墙 | 谁纠正的 |
|---|---|---|
| 1 | 运行时依赖未装（`requests`/`msgpack`）✗ | traceback 点名 ✓ |
| 2 | `.[dev]` **不存在** ✗ | pip `WARNING` ✓ |
| 3 | `.[tests]` **同样不存在** ✗ | pip `WARNING` ✓ |
| 4 | 组在 **`[dependency-groups]`（PEP 735）** ✗✓ | 读 `pyproject.toml` 的表 ✓ |
| 5 | **`pip 25.0.1` 无 `--group`** ✗ | 它自己的 `no such option` ✓ |
| 6 | 文档给 `make test`，而 **`make` 不存在**、Makefile 是 **POSIX** 形 ✗✓ | `Get-Command make` ✓ + 读 Makefile ✓ |
| 7 | 手装"最小集"仍不够 ✗ | 逐条 collection 错误 ✓ |
| 8 | **从未对*这个*项目做 `pip install -e .`** ✗✓（**我对 jinja 做了、对它漏了** ✗ —— 如实记账 ✓）→ 再做它声明的 extras ✓ | 错误文本 ✓ → **green** ✓✓ |

**为什么重要** ✓✓：§2 写着 *"Preconditions, **every one of which a person supplies**"* ✓✓ —— **这八步就是那句话的真实大小** ✓✓，**而今天没有任何地方记录它** ✗。**不该算 harness 的缺陷** ✗（不是它的问题 ✓），**也不能被跳过** ✗（没有它就没有判分 ✓）→ **它应当成为流程里被*记录*的一步** ✓✓。

## 🎯 读数 #4（**流程第 1/3/4/5 步** ✓）：**同一个命令，三次调用、三个退出码** ✗✓✓

**第 1 步（装/绑定）在克隆上第一次跑** ✓：`.dove` 原本不存在 ✓ → `project init` ✓（`initialized true` ✓ `ready true` ✓ `taskLifecycle true` ✓，退出码 **0** ✓）→ `.dove/project.json` 145 B ✓ `.dove/state.json` 57 B ✓✓；`doctor` ✓ 打印 `shell …bash.exe (global, source auto)` ✓ · `workspace … (mode development, source default)` ✓ · `powershell 5.1.22621.6133` ✓ · `missing tools nmap, hydra` ✓ · **`extensions none`** ✗✓（**而同一份输出又认得 `mode development`** ✓✓）。

**第 3/4/5 步** ✓：`task create` ✓（`"operation": "create"` + stableId ✓，退出码 **0** ✓）· `task verify` ✓（打任务对象 ✓）· `task convergence status` ✓（同 ✓）· `task archive` ✓（`"operation": "archive"` ✓，退出码 **0** ✓）。

**而退出码不可信** ✗✓✓✓（**同一命令 `task verify`，三次调用三个值** ✓）：

| 怎么调用 | 它给什么 |
|---|---|
| 夹了管道的读法（先前那几次 ✓） | **-1** ✗✓ |
| **立刻读、不夹管道** ✓ | **1** ✗✓ |
| **经 `cmd /c … & echo %ERRORLEVEL%`** ✓ | **0** ✗✓✓ |
| **对照**：`node -e "process.exit(7)"` ✓✓ | **7** ✓✓ —— **证明测法本身准** ✓ |

→ **原因未定位** ✗✓（"`.cjs` shim 在两种 shell 下处理不同"是**假设** ✓，**未量** ✗✓ → **不写成已知** ✓）。

**实用规则** ✓✓：**不靠退出码判断成败** ✗✓ → **读它的结构化输出** ✓✓（它本就打 `ready` / `status` / `operation` ✓✓）。这与本仓在别处早已采用的教条一致 ✓（*"the project's own tests decide"* ✓✓）。

**而它与读数 #1 同族** ✓✓：**"输出说成功、另一份记录说不是"** ✓ —— 三次实例（`bind native` 输出 healthy 而 -1 ✗✓ · `doctor` 说 `extensions none` 而认得 mode ✗✓ · 退出码三值不一 ✗✓✓）→ **"同一件事的两份记录可以不一致" 在本轮出现于三个不同层次** ✓✓✓。

## 未定项 ✗

**`uv` 不在这台机器上** ✗ —— **我未擅自安装** ✗✓（装新工具是你的决定 ✓）。`cachecontrol` 这条路**不需要它** ✓✓（已 green ✓）；`jinja` 那条需要 ✓ —— 若要用那条路，我再问 ✓。
