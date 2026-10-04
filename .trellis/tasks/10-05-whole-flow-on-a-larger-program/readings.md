# 读数（第 4 片：挑项目 + 验它自己的判分）

## 第 3 片：**判分仪器**（已建，红 ✓✓）

**任务** ✓（用户选 (c) 后，由我按"先量后挑"定 ✓）：**让 `cachecontrol` 遵守 `Cache-Control: immutable`（RFC 8246）** ✓✓。

**为什么是它** ✓✓（三条标准，全部量过 ✓）：**代码里 0 次、文档里 0 次** ✗（`immutable` ✓ · 对照：`max-age` 12 次 ✓ `no-store` 6 次 ✓✓）· **没有一处文档说它故意不支持** ✓（"unsupported/deliberately" 全文 0 命中 ✓）· **它小且可判** ✓✓（RFC 8246 的行为 = **新鲜期内不得再验证** ✓ = 这个库自己的信号 `from_cache` ✓✓）。**淘汰** ✗：`stale-while-revalidate`（需*后台*再验证 ✗ 而这是同步库 ✓）· `stale-if-error`（需错误路径 + 时序 ✓ 偏大 ✗）。

**仪器怎么建的** ✓✓（**克隆内** ✓，不在本仓 ✗）：① 在 `tests/conftest.py` 的 `SimpleApp` 加一条路由 ✓（该应用把路径首段 `getattr` 成同名方法 ✓✓ —— `immutable_cacheable` ✓）；② 新增 `tests/test_immutable.py` ✓，断言**只有那一个信号**：第二次请求 `from_cache is True` ✓✓。

**它的红** ✓✓（跑出来的原文 ✓）：`assert False is True` · `where False = <Response [200]>.from_cache` ✓✓ —— 服务器确实起了（`ENGINE Serving on http://127.0.0.1:63560` ✓），**而库真的又去了一趟服务器** ✗✓✓。

→ **于是"做完了"有了机器可判的定义** ✓✓，**且它住在项目自己的套件里** ✓（AC 4 满足 ✓），**而 agent 的活只剩代码改动** ✓（"小" ✓）。

## 第 4 片：项目（四条标准，全部实测 ✓）

## 项目（四条标准，全部实测 ✓）

**`cachecontrol`**（`github.com/psf/cachecontrol` ✓，HEAD `d6e3140` ✓）：

| 标准 | 读数 |
|---|---|
| ① 有自己的测试套件 | **17 个测试文件 / 1,375 行** ✓✓ |
| ② 有真实运行时依赖 | **`requests >= 2.16.0`** ✓ · **`msgpack >= 0.5.2, < 2.0.0`** ✓✓ |
| ③ 比 `yocto-queue`（~300 行）大一档 | **14 个源文件 / 1,492 行** ✓（≈5× ✓ = "稍微大一点"正好 ✓） |
| ④ 可整体克隆、无需凭据 | ✓（公开 ✓，已克隆 ✓） |
| **它自己的测试能跑** | **`115 passed in 2.23s`** ✓✓（exit 0 ✓） |

**被淘汰的两个候选** ✗（记录原因，避免以后重走）：
- **`itsdangerous`** ✗：**运行时不依赖任何东西** ✗（只有 `ruff`/`tox` 工具 ✓）；**951 行**（≈3× ✗）；**其套件 collection 5 错** ✗✓。
- **`jinja`** ✗：尺寸够（**11,616 行 / 24 测试文件** ✓✓）、依赖真（`MarkupSafe` ✓），但**其 dev/test 组在 PEP 735 里** ✗✓、套件需 `trio` ✓ → **对这次实验过于复杂** ✗。

## 🎯 第一条真读数：**在 Windows 上，让真实项目自己的测试跑起来是八步** ✗✓✓

**而这正是"整个流程"的第 4 片（判分来源）所依赖的前提** ✓✓ —— 也就是说，**任何真实项目都会先撞上这八步** ✓，且**它发生在任何 agent 会话开始之前** ✓✓。

| # | 墙 | 谁纠正了它 |
|---|---|---|
| 1 | 运行时依赖未装（`requests`/`msgpack`）✗ | traceback 自己点名 ✓ |
| 2 | `pip install -e ".[dev]"` → **该 extra 不存在** ✗ | pip 的 `WARNING` ✓ |
| 3 | `.[tests]` → **同样不存在** ✗ | pip 的 `WARNING` ✓ |
| 4 | 组在 **`[dependency-groups]`（PEP 735）** 里 ✗✓ | 读 `pyproject.toml` 的表 ✓ |
| 5 | `pip 25.0.1` **无 `--group`** ✗ | 它自己的 `no such option` ✓ |
| 6 | 文档给的是 **`make test`**；**`make` 不存在** ✗、Makefile 是 **POSIX** 形（`$(VENV)/bin/activate`）✗✓ | `Get-Command make` ✓ + 读 Makefile ✓ |
| 7 | 手装"最小集"仍不够 ✗ | 逐条 collection 错误 ✓ |
| 8 | **从未对*这个*项目做 `pip install -e .`** ✗✓（**我在 jinja 上做了、在它身上漏了** ✗ —— 如实记账 ✓）→ 再做**它声明的 extras**（`.[filecache,redis]`）✓ | 错误文本 ✓ → **green** ✓✓ |

**为什么这条重要** ✓✓：规格 §2 早已写着 *"Preconditions, **every one of which a person supplies**"* ✓✓ —— **这八步正是"一个人提供的东西"的真实大小** ✓✓，而**今天没有任何地方记录它** ✗✓。**它既不该算 harness 的缺陷** ✗（不是它的问题 ✓），**也不该被忽略** ✗（没有它，第 4 片无从谈起 ✓）→ **它应当成为流程里被*记录*的一步** ✓✓。

## 未定的一项（留给后面）✗

`uv` **不在这台机器上** ✗ —— **我未擅自安装** ✗✓（往你的机器上装新工具，是你的决定 ✓）。**若**后续片需要它（`jinja` 那条路需要 ✓、`cachecontrol` 这条路**不需要** ✓✓ —— 它已经 green 了 ✓），我再问 ✓。
