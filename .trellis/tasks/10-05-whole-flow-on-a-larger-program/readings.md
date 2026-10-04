# 读数（**规范结构，每条实测只出现一次** ✓）

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

## 未定项 ✗

**`uv` 不在这台机器上** ✗ —— **我未擅自安装** ✗✓（装新工具是你的决定 ✓）。`cachecontrol` 这条路**不需要它** ✓✓（已 green ✓）；`jinja` 那条需要 ✓ —— 若要用那条路，我再问 ✓。
