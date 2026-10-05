# 读数：**两处缺口的判据都绿了** ✓✓✓（2026-10-05 ✓）

## 判据的原文 ✓✓（扩展自己说的 ✓，不是我推断 ✓）

```
Dove Pi: workspace=development, workMode=code-development, hashlineEditTools=absent, lens=on-next-session, mode=◆ Standard
```

**取自**：`judge.jsonl`（`stepIndex 0` 的 `extension_ui_request`/`notify` ✓✓）—— 一次**只做 `/status`** 的运行 ✓（场景 `tests/fixtures/scenarios/status-line-only.json` ✓），在**已绑定的克隆**上 ✓（`.dove/mode.json` = `{schemaVersion: 1, mode: "code-development"}` ✓，55 B、无 BOM ✓）。

## ① 声明的 mode 加载不了 → **已修** ✓✓✓

**判据** ✓：`workMode=` **从 `failed` ✗ 变成 `code-development`** ✓✓ —— 与 `design.md` 定的判据**逐字一致** ✓✓。

**改法** ✓✓（`src/pi-adapter/extension.ts` ✓，提交 `9921ba3` ✓）：**声明的根优先** ✓，**只有那里没有 `modes/<name>/` 时才回退到扩展自己的根** ✓✓ —— **mode 自己的 grant 文档随胜出的根解析** ✓（这也是为什么必须在**调用点**选、不能在载入器里选 ✓）。

**而第一次改法是错的，被测试当场抓住** ✗✓✓：**替换**根（而不是**回退**）**弄红了 28 条** ✓✓（`905 pass / 28 fail` ✗）—— 因为**宿主测试自己提供根、fixture 的 mode 就在那底下** ✓✓（`action-policy.test.ts:122` `workspaceRoot: files.root` ✓）。**回退改法把它们收了 27 条** ✓（回到 `931 pass / 2 fail` ✓，**余下两条与本次改动无关**：一条数 `agent_project_context` 的索引长度 ✓，一条数规格页的 mount-point 引用 ✓＝**并行窗口自己那条未完的活** ✓）。

## ② 编辑工具缺失不在读数里 → **已修** ✓✓✓

**判据** ✓：状态行里出现了 **`hashlineEditTools=absent`** ✓✓ —— 与工作模式并列 ✓。

**改法** ✓✓（同提交 ✓）：`hashline` 本就在 `/status` 处理函数里算过（`:1159` ✓），**所以不需要任何载体** ✓✓ —— 只把它拼进那条 notify ✓，**理由与工作模式那一行完全相同** ✓（`:1172` 的注释原话：*"a failed load … says so only once … a person who missed the session-start notification had no way to see why nothing ran"* ✓✓）。

**而它报的是 `absent`** ✗✓✓ —— **即：宿主确实没有这套工具，而这现在是*读数*的一部分** ✓✓ → **"模型草率"与"工具不在"从此在读数上可分** ✓✓✓ = **本轮最想要的那一件事** ✓。

## 仍开着的 ✗✓（不粉饰 ✓）

- **AC 里最重的一条仍未证明** ✗✓：**"一条运行里走完整个流程、各步都留痕"** ✓ —— 这次**只跑了 `/status`** ✓；**上一轮跑了活、但在第 1 步就把 15 分钟用光、被 `cancelled`** ✗✓（`provider.request.started 10 / completed 9` ✓）→ **"整条在同一次运行里"仍待证明** ✗✓。
- **`hashlineEditTools=absent` 意味着那个 agent 仍然没有 harness 的编辑工具** ✗✓ —— **AC 的"在场 ✓ 或缺失被记录 ✓"由后半条满足** ✓✓，**而前半条是宿主的事** ✗（`10-05-missing-hashline-edit-tool` ✓）。
- **判据本该被*直接*索取** ✓✓（这一轮的教训 ✓）：**我先前把判据放在一个要等 15 分钟才轮到第 2 步的场景里** ✗✓ → **`/status`-only 这个场景是那条教训的产物** ✓✓，**它会一直有用** ✓。

---

# 读数（第二次，**整条流程跑了一次** ✓✗✓）（2026-10-05 晚 ✓）

## 第 0 片：判分基线（**跑之前量的** ✓✓）

在**已绑定**的克隆里跑项目自己的套件 ✓：`1 failed, 115 passed in 2.36s` ✓✓ —— 红的那条**正是判分仪器** `tests/test_immutable.py` ✓（`assert False is True` · `from_cache` 为 False ✓）。**基线未变** ✓（与上一轮逐字相同 ✓）。

## 第 1 片：便宜的判据先取 ✓✓（**吸取上一轮的教训** ✓）

`status-line-only` ✓ · `--cwd` = 已绑定的克隆 ✓ · 输出在仓外 ✓：

```text
scenario=status-line-only  provider=real  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-05
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json]
exitCode=0  settled=true  harnessTimedOut=false  events=9  duration=648ms
```

**扩展自己的状态行** ✓✓（判据原文 ✓，不是我推断 ✓）：

```text
Dove Pi: workspace=development, workMode=code-development, hashlineEditTools=absent, lens=on-next-session, mode=◆ Standard, thinking=high (auto:standard), tools=auto, hashline=inactive, operation=idle, progress=idle.
```

→ **`workMode=code-development`** ✓✓✓（**不再是 `failed`** ✓）—— **判据与 `design.md` 所定逐字一致** ✓ ✓。**48 轮的修复在这个布局下成立** ✓✓。

## 第 2 片：整条流程那一次运行（§4 格式 ✓）

```text
scenario=immutable-directive-work  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-05
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json]
exitCode=null  settled=false  harnessTimedOut=true  events=7817  duration=1500015ms (25.0 min, 恰为所设上限)
terminal: reason=cancelled  detail=user-cancelled  code=user-cancelled (origin=user)
resources(取自账本事件流，非 summary): toolCalls=29  providerRounds=27 started / 26 completed  runtimePhases=117  ledger=143008 B
tokens(26 次已完成调用逐条 usage 求和): input=674180  cacheRead=0  cacheWrite=0  output=20823  reasoning=16225
stopReasons: [tool_call x26]
tools the model actually called: bash x17, read x9, edit x3
dialogs: approved=0 declined=0 answered=0 cancelled=0 defaulted=0 mismatch=0 unused=0
terminalConsistency=harness-timeout  closeWaitMs=null
```

**这一步是 §3 说的那种读数** ✓：**不可复现** ✗，**可比的是形状** ✓；**这里只有一次，所以连形状都没有对照** ✗✓。

## 第 3 片：AC 逐条判 ✓✗✓（**不粉饰** ✓）

| AC | 判 | 判据 |
|---|---|---|
| `workMode=<声明的那个 id>` ✓ | **成立** ✓✓ | 状态行 `workMode=code-development` ✓（第 1 片 ✓） |
| 编辑工具在场 ✓ 或缺失被记录 ✓ | **成立（靠后半条）** ✓ | 读数里 `hashlineEditTools=absent` ✓✓ |
| 项目自己的套件给出结果 ✓ | **成立** ✓ | 运行副本里 `1 failed, 115 passed` ✓（第 4 片 ✓） |
| 账本累计量与判分并列 ✓ | **成立** ✓ | 上表 `resources` / `tokens` 全部数自事件流 ✓ |
| **一条运行里走完整个流程** ✗ | **不成立** ✗✓✓ | **work 就被 25 分钟上限切断** ✗ → **convergence / archive 从未到达** ✗（`task.convergence.observed = 0` ✓） |

**为什么断在那里，是量到的、不是猜的** ✓✓：截断时**会话尾部仍在 bash/edit 交替** ✓（不是空转 ✓），最后三次调用是**用 cherrypy 探 `PATH_INFO` 的调试探针** ✓✓ —— 即**它在弄明白测试为什么还红** ✓，**而时间用完了** ✗。

## 第 4 片：**活做得怎么样**（判分在项目自己的套件里 ✓）

```
FAILED tests/test_immutable.py::TestImmutable::test_immutable_is_not_revalidated_while_fresh   ← 目标，仍红
1 failed, 115 passed in 2.24s        （基线：1 failed, 115 passed ✓）
```

**改动逐文件比对** ✓（相对克隆 ✓）：`cachecontrol/controller.py` **20090 → 20691 B（+601 ✓）** · `tests/conftest.py` **5876 → 6149 B（+273 ✓）** —— **恰好两个文件** ✓，**没有新文件** ✓。

**而这一次的改动是*像样的*** ✓✗：`controller.py` 那一处**把 `immutable` 加进指令表** ✓、**把 `_load_from_cache` 提前**（好在 `max-age=0` 那条 bail 之前拿到 `resp_cc` ✓）、**把 bail 改成 `"immutable" not in resp_cc`** ✓✓ —— **是 RFC 8246 的一种正当实现** ✓。

**两处与上一轮不同的地方，都值得记** ✓✓：

1. **这一次没有弄坏旁边任何一条用例** ✓✓（上一轮弄坏了 `test_redirects.py` ✗）→ **"努力是真的、结果是错的"仍然成立** ✓，**但失败形状不同** ✓：上一轮是**改坏一处** ✓，这一轮是**改对了方向却仍没达成** ✓。
2. **它动了仪器本身** ✗✓✓：`tests/conftest.py` 的 `SimpleApp.dispatch` **被改成忽略空路径段** ✓（为了 `//immutable_cacheable` 能走到 handler ✓）。**判分仍然红** ✓，**所以这不是"改测试让它过"** ✓ —— **但只读"1 failed"的读数会看不见"仪器被动过"** ✗✓✓。

## 第 5 片：**`hashlineEditTools=absent` 的机制，量到了** ✓✓✓（**这是本轮最实的一条** ✓）

**扩展的原文说的是宿主** ✓：*"当前 Pi 宿主未提供 hashline 编辑工具"* ✓。**而实测不是宿主的锅** ✗✓✓：

| 测的 | 读数 |
|---|---|
| 宿主里装没装 | **装了** ✓✓：`~/.pi/agent/npm/node_modules/pi-hashline-edit-pro` ✓ |
| 运行带没带**声明** | **带了** ✓✓：run 自己的 `settings.json` 里有 `npm:pi-hashline-edit-pro@2.7.0` ✓（与操作者那份逐个相同 ✓） |
| 运行带没带**包** | **没带** ✗✓✓：`PI_CODING_AGENT_DIR` = run 自己的会话目录 ✓，里面只有 `auth.json` / `models.json` / `models-store.json` / `settings.json` + 会话 jsonl ✓ —— **没有 `npm/`** ✗✓ |

→ **机制** ✓✓：**声明随 `settings.json` 走 ✓，包不走** ✗✓ → **Pi 加载不到那个包 → 扩展如实报 `absent`** ✓。
→ **两处更正** ✗✓✓：① **这不是"宿主不提供"** ✗（**宿主提供了** ✓，**是这个运行器没把包带进来** ✓）；② **它落在*本仓*的代码里** ✓（`scripts/real-dove-blackbox.mjs` 的携带清单 ✓）—— 上一轮那条 *"宿主是 Pi、不是本仓，所以修不到根上"* **在这一层上过于宽容** ✗✓。

**而 agent 有编辑工具** ✗✓：这一次它用 `edit` **改了 3 次** ✓（`conftest.py` ✓ `controller.py` ✓）→ **"那个 agent 没有编辑工具"是错的** ✗ ✓✓，**准确的说法是**：**harness 的 *hashline* 那一族不在场** ✓，**宿主的 `edit` 在场且被用了** ✓✓。

## 第 6 片：与上一轮**不可比**的部分 ✗✓（必须写明 ✓）

- **预算不同** ✗✓：上一轮 15 分钟 ✓ / 这一轮 25 分钟 ✓ → **轮数与工具数不可比** ✗；
- **模型会漂** ✗：`same command on another day is a different experiment` ✓（§3 ✓）；
- **判分结果可比** ✓✓：两次都是"目标仍红" ✓（**这一层是同一件事的两次独立确认** ✓✓）；
- **未测** ✗：`tokens` 与账本累计量的**正确性**（§5：field run 不覆盖"活做得对不对" ✓）；**`summary` 的资源块**（本轮运行根本没有 `summary.json` ✓ → **这一轮不构成对它的新证据** ✗✓）。
