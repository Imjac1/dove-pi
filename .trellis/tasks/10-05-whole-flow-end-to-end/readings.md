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

---

# 读数（第三次：**预算放大到 45 分钟** ✓✗✓）与两处修复（2026-10-05 深夜 ✓）

## 第 0 片：**预算不是那个瓶颈** ✗✓✓（这一条是放大后的主要读数 ✓）

```text
scenario=immutable-directive-work  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-05
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json]
exitCode=0  settled=false  harnessTimedOut=false  scenarioFailed=true  events=2428  duration=567139ms (9.5 min, 上限给的是 45 min)
terminal: reason=failed  detail=unknown  code=provider-unknown  origin=provider  policyAbort=true
resources(账本事件流): toolCalls=11  providerRounds=13  runtimePhases=?  tokens: input=115989(收敛观测) 
tools the model actually called: bash, read   —— **没有一次 `edit`** ✗
```

**上限放大了 3 倍，而这轮 9.5 分钟就结束了** ✗✓✓ —— **不是到点，是 provider 把它结束了** ✓（`harnessTimedOut=false` ✓）。所以**上一轮"预算不够"的判断被这一轮修正** ✓：**同一场景、同一克隆，两次的失败原因不同** ✓（25 min 到点 ✓ / 9.5 min provider 终止 ✓）。

## 🎯 第 1 片：**同一个事件，两次分类不同** ✗✓✓（**本轮最实的一条，已修** ✓）

**两次尝试，一个宿主动作** ✓：

| 尝试 | outcome | failureReason |
|---|---|---|
| 1（`trigger=initial`） | `transient-failure` ✓ → **重试了** ✓ | — |
| 2（`trigger=provider-retry`） | `failed` ✗ | **`unknown`** ✗✓ |

**而宿主自己把这件事写清楚了** ✓✓（会话记录最后一条 ✓）：`message.stopReason = "aborted"` ✓、`message.errorMessage = "terminated"` ✓、`usage` **全 0** ✓（流在响应中途断了 ✓，thinking 也停在半句 ✓）。

**根因量到了行** ✓✓：`classifyAssistantProviderFailure`（`extension.ts:282` ✓）**只读 `errorMessage`/`error` 的文本** ✗ —— 那条文本是 `"terminated"` ✓，**没有任何一条规则匹配它** ✗ → 落到 `classifyProviderFailure({ category: "unknown" })` ✓。**宿主自己的那个词（`aborted`）从头到尾没进过这次判断** ✗✓✓。

**它为什么伤人** ✓✓：终态于是写成 `provider-unknown` ✓、`summary "The provider request ended with unknown."` ✓、`nextAction "Inspect the provider error and adjust the request."` ✓ —— **而账本里没有任何 provider error 可查** ✗✓。

**修法** ✓（`extension.ts` ✓）：在文本规则**之后**补一条**读宿主自己的 `stopReason`** 的规则 ✓ —— `stopReason === "aborted"` → 与已识别的瞬时类同一档（`reviewed-provider-message` ✓），**因为流提前结束正是那一类** ✓。放在文本规则之后是有意的 ✓：`errorMessage` 说了 `aborted by the user` 时**仍然读作取消** ✓。
**判据** ✓✓：新增用例 **先见红** ✓（对着未改的 `extension.ts`：`actual {kind:'terminal',reason:'unknown'}` vs `expected {kind:'transient',reason:'reviewed-provider-message'}` ✓），改了之后绿 ✓。

## 第 2 片：**field run 的工具面不是操作者的** ✓✓✓（**已修** ✓）

**探针实验**（零 token ✓，`/status`-only 不调模型 ✓）：把运行自己的会话目录里放一个指向操作者 store 的 **junction** ✓ → 同一条状态行立刻变成：

```text
Dove Pi: workspace=development, workMode=code-development, hashlineEditTools=present, …, hashline=active, …
```

→ **假设被证伪成事实** ✓✓：`absent` 的根因是**运行器没带包库** ✗（声明带了 ✓、宿主装了 ✓）。

**修法与判据** ✓✓：运行器把 agent 目录的 `npm/` 一并拷进运行 ✓（拷贝 ✓，原件不碰 ✓）；实测 `carriedConfig = ['settings.json','models.json','auth.json','npm/']` ✓、状态行 `hashlineEditTools=present` ✓、`hashline=active` ✓；**整库 361 MB / 15,272 文件，加约 10 秒** ✓（比担心的便宜 ✓）。**判分套件不受影响** ✓：全部测试不是 `--provider faux` 就是 `--no-operator-config` ✓，都不付这份拷贝 ✓。
field-run 规范 §2 的携带清单同步更新 ✓ —— **原文只写了三个文件，所以"工具面"这件事从来没被规范承诺过** ✗✓，而现在它被承诺了 ✓。

## 第 3 片：**编辑（包含我的）会把别处的引用弄烂** ✗✓✓（**已修** ✓）

我在 `extension.ts` 的 `:296` 附近加了 10 行 ✓ → **该页 18 行 mount 表的每一个引用都错位** ✗✓，**被 `tests/spec-anchors.test.ts` 当场抓住** ✓✓（`cites the declaration each mount-point row names` ✓ 红 ✓）。**这个门就是为这件事存在的** ✓。

**修法与判据** ✓✓：整页按实测位移 **+10** 修正 ✓（位移是量出来的、不是猜的：`new ExecutionLedger` 页写 906 / 实为 916 ✓，18 个 mount 行逐个核对 ✓）；门转绿 ✓。

**顺手量出三处*先前就*烂掉的引用** ✗✓✓（**不是我这一改弄的** ✓ —— 若它们原本正确，`+10` 之后就该落在原文所指数上，而它们没有 ✓）：

| 页 | 原文 | 实测真身 | 处理 |
|---|---|---|---|
| `personal-agent-mode-format.md:46` | `extension.ts:3318` | **3362** `const workModeBlock = workModeInstructions(activeWorkMode);` ✓ —— 正是"拼块的同一个调用" ✓ | **已改** ✓ |
| `personal-agent-mode-format.md:86` | `extension.ts:2256` | 2256 是 `try {` ✗；加载拒绝区在 **2247**（`modeRefusal = workModeRefusal(selection)` ✓） | **已改** ✓ |
| `personal-agent-product.md:81` | `extension.ts:3500-3521` | 真身是 **3519-3540** `readOnlyToolBudget` ✓（表里的数正是 `fast 4/6/12`、`standard 6/10/20`、`ultra 12/16/32` ✓） | **已改** ✓ |

## 第 4 片：这轮的判据与代价 ✓✓

| 项 | 读数 |
|---|---|
| `npm run typecheck` | **0** ✓ |
| `npm test` | **947 / 947 pass / 0 fail** ✓✓（比上轮 +1 = 新增的那条用例 ✓） |
| 新增用例**先见红** | 是 ✓（`actual: unknown` vs `expected: reviewed-provider-message` ✓） |
| carrier 修好后的状态行 | `hashlineEditTools=present` ✓、`hashline=active` ✓ |
| token 代价 | run 2 ✓ + 两条探针（`/status`-only，**不调模型** ✓）|

**仍未达成的** ✗✓✓：**"一条运行里走完整个流程"** 仍然**不成立** ✓ —— 而这一轮把它从"预算不够"改成了**"provider 中途终止 + 终止原因当时报成 unknown"** ✓，**后者已修** ✓（下次同样的终止会读作 `reviewed-provider-message` 的瞬时失败并重试 ✓，而不是 `provider-unknown` 的终态 ✓）。**收敛与归档仍未被走到** ✗（`task.convergence.observed` 在 run 2 里出现了 ✓，但 `convergenceSkipReason: "no-formal-native-task"` ✓ —— 克隆里那个任务早已 `archived` ✓，**流程的收尾几步需要一个在流程里新建的任务** ✓）。

---

# 读数（第四次：**给场景加了任务生命周期，然后流程在 22 秒处挂死** ✗✓✓✓）（2026-10-05 ✓）

## 第 0 片：先量"要写进 prompt 的命令能不能跑" ✓✓（**这一步救了整轮** ✓）

**没有直接开跑** ✓ —— 先在临时副本上把整条生命周期跑了一遍 ✓：`task create` → `start` → `verify` → `convergence status` → `finish` → `archive` 全部可用 ✓（`state.json` 最后两个 goal 都是 `archived` ✓）。

**而这一量就撞上第一处** ✗✓✓：**`doctor` 选定的 shell 是 git-bash** ✓，而**启动器只装了 `.cmd` 与 `.ps1`** ✗✓✓（`installer/manager.py:231-238` ✓），于是：

| 在 git-bash 里 | 读数 |
|---|---|
| `command -v dove-pi.cmd` | **找到** ✓（`/c/Users/Macfy/AppData/Local/DovePi/bin/dove-pi.cmd` ✓） |
| `which dove-pi.cmd` | **exit 1 · no dove-pi.cmd** ✗✓✓（**而那个目录就在 PATH 里** ✓） |
| `which dove-pi` / `command -v dove-pi` | **找不到** ✗✓✓ |
| **README 第 9 行告诉用户跑的** | **`dove-pi`** ✗✓ —— **在 Dove 自己选的那个 shell 里是 command-not-found** ✗✓✓ |

→ 所以场景里的步骤写成 **`dove-pi.cmd`** ✓（实测可用 ✓），**并在 `requires` 里写明为什么** ✓。

## 第 1 片：这一次运行（§4 格式 ✓）

```text
scenario=immutable-directive-work-as-a-task  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-05
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json, npm/]   ← 上一轮的修复在这一轮生效 ✓
exitCode=null  settled=false  harnessTimedOut=true  scenarioFailed=false  events=5422  duration=2700270ms (45.0 min, 恰为所设上限)
terminal: reason=cancelled  detail=user-cancelled  code=user-cancelled (origin=user)
resources(账本): **providerRounds=1**  **toolCalls=1**  账本共 **14 行**  —— 45 分钟里就这么多 ✗✓✓
steps: 0(prompt) tools=['bash'] 未 settle ✓ · 1/2/3 **一次都没跑** ✗
artifactEvidence: formalTaskCount=2  convergenceFileCount=0
```

## 🎯 第 2 片：**22 秒之后就没动静了** ✗✓✓✓（**本轮最重的一条** ✓）

账本第一行 **16:50:37.880** ✓，最后一行 **16:50:59.355** ✓ —— **开工 22 秒后就再没有任何事件** ✗✓✓，**一直到 45 分钟的上限把它切掉** ✓（`harnessTimedOut=true` ✓、`durationMs=2700270` ✓）。**stalled 44.5 分钟** ✓。

**它卡在哪个调用上，是量到的** ✓✓（会话记录里的工具入参原文 ✓）：

```
which dove-pi.cmd; ls -la /c/Users/Macfy/.agents 2>/dev/null; \
  find / -name "dove-pi.cmd" -maxdepth 6 2>/dev/null | head
```

→ **一次从 `/` 开始的全盘 `find`** ✗✓✓ —— **因为 `which dove-pi.cmd` 返回了失败** ✓（第 0 片量到的那个口 ✓），agent 于是改用全盘搜索 ✓。

**而它为什么值得记** ✓✓✓：**整个 45 分钟的上限被*一次 shell 调用*吃光** ✗ —— 这正是**已经开着的** `10-05-tool-call-hangs-without-timeout` ✓（*"A tool call can hang forever, and the shell timeout only covers a whitelist"* ✓）**在真实流程里的第一次复现** ✓，**而且它挡在用户流程的第一步上** ✓✓。

## 🎯 第 3 片：**建任务的是 harness 自己，不是用户** ✓✓（**这条改了 AC 的读法** ✓）

工作副本里**确实**出现了一个新任务 ✓ —— **但它不是 agent 建的** ✓✓：`createdAt = 16:50:37.885` ✓，**比账本第一行只晚 5 毫秒** ✓，而 `request.planned` 写的是 **`intent=execution lane=formal workflow=create-task`** ✓✓。

→ **harness 自己从用户的第一句话建了正式任务** ✓✓，**标题就是那条消息的全文** ✓（所以看起来很长 ✓）。
→ **而 agent 从头到尾没跑成一次 `task create`** ✗✓ —— 它在找那个启动器 ✓，**然后就挂死了** ✓。
→ **顺带解释了 run 2 为什么读作 `no-formal-native-task`** ✓✓：**两条 prompt 落进了不同的 lane** ✓（这一条落 `formal` → 建任务 ✓；run 2 那条落别的 lane → 不建 ✓）→ **"流程里有没有正式任务"取决于 prompt 落在哪个 lane** ✓✓，这比"克隆里的任务已归档"准得多 ✓。

## 第 4 片：这一轮的判决 ✓✗

| AC | 判 |
|---|---|
| mode 生效（`workMode=code-development`）✓ | **成立** ✓（第 1/2/3 轮都一样 ✓） |
| 工具面进读数 ✓ | **成立** ✓，且**这一轮带的是 `npm/`** ✓（`hashlineEditTools=present` ✓） |
| 项目自己的套件给出结果 ✓ | **未走到** ✗（判分那一步没跑 ✓） |
| 一条运行里走完整个流程 ✗ | **不成立** ✗✓✓，**而这一轮的原因与前两轮都不同** ✓：**不是预算、不是 provider，是一次没有边界的 shell 调用** ✓ |

**三轮，三个不同的原因** ✓✓（25 min 到点 ✗ / 9.5 min provider 终止 ✗ / 22 秒后无限挂死 ✗）—— **这本身就是一条读数** ✓：**"整条流程跑得完"这件事，被三件互不相同的、都在流程自己路径上的事各挡过一次** ✓✓。

## 第 5 片：这一轮改掉的与仍开着的 ✓✗

1. **启动器那个口 —— 已修** ✓✓。装**第三个 shim**：`bin/dove-pi`（无扩展名、`#!/bin/sh`、`chmod 0755` ✓，`installer/manager.py` ✓）—— 对 MSYS 一族先用 `cygpath` 把目录翻成 Windows 形 ✓，再交给**和其他两个同一个** PowerShell 入口 ✓（Python 发现逻辑仍只有一处 ✓）。**npm 就是以这个形状发它的 `npm` / `npm.cmd` / `npm.ps1` 三件的** ✓，这里照抄它的形 ✓。
   **判据**（全部实测 ✓）：`chmod +x` 在 NTFS 上成立 ✓（`-rwxr-xr-x` ✓）；`which dove-pi` 与 `command -v dove-pi` **都找得到** ✓（这正是 `.cmd` 做不到的那件 ✓）；**真正跑一遍** ✓ —— shim 执行 ✓ → 转交 PowerShell ✓ → `.ps1` 找到了自己（路径换算正确 ✓）→ 只因临时布局没有 `state/install.json` 而停 ✓，**链条完整** ✓。
   **而它是"用户第一次想收尾时就会撞上"的那堵墙** ✓：`README.md:9` 教的正是 `dove-pi` 这个名字 ✓。
   **持有的东西** ✓：`tests/managed_installer_test.py` 现在断言它**存在、可执行**（bash 对无扩展名文件两个条件都要 ✓）、且带 `cygpath` ✓；installer 套件 **143 OK** ✓。
   **还没生效** ✗✓：本机那份**已安装**的 launcher 仍是旧的 ✓（只有 `.cmd`/`.ps1` ✓）—— 要 `dove-pi update` / 重装才会带上第三个 ✓。所以这一轮的场景**仍写 `dove-pi.cmd`** ✓（实测可用 ✓），并在 `requires` 里写明原委 ✓。
2. **场景里"让 agent 建任务"那一步 —— 已删** ✓✓。第 3 片量到 **harness 自己会从消息里开正式任务** ✓，所以那一步既多余、**又正是把 agent 推向启动器、推向那个 44.5 分钟挂死的那一步** ✗✓。新版本只留"干活 → 判分 → 收敛 → 归档" ✓，并在第一步里**明说不需要自己建** ✓（好挡住那次探路 ✓）。**这一轮那次运行跑的是旧版本** ✓ —— 读数按旧版本记 ✓。
3. **仍开着的** ✗✓✓：**没有边界的 shell 调用** ✓（第 2 片 ✓）—— **整个 45 分钟的上限被一次从 `/` 开始的 `find` 吃光** ✓。它已经有主 ✓（`10-05-tool-call-hangs-without-timeout` ✓），**而这一轮给了它第一个真实流程里的复现** ✓✓；**只要它还在，任何"整条流程"的运行都可能在任何一步被无限期挂住** ✓ —— 这与启动器那个口是**两件独立的事** ✓，**修了启动器也不等于这条被修** ✗✓。

---

# 读数（第五次：夹具重建、收尾序列实测、便宜判据先取）（2026-10-11 ✓）

**这一轮先量前提，不先花预算** ✓✓ —— 而第一个前提就是断的 ✓。

## 第 0 片：被判分项目不在这台机器上 ✗✓✓

**实测** ✓✓：`$env:TEMP` ✓ · 用户目录 depth 5 ✓ · `C:\` depth 4 ✓ · `D:\` depth 6 ✓ —— **都没有 `tests/test_immutable.py`** ✗✓；
**也没有任何绑定过的 `.dove/mode.json`** ✗（搜到的全是测试夹具的 ✓）；`D:\path` 只有 java17 / python3.11 / TDM-GCC / vcpkg / zig ✓。
**而任务记录里没写它在哪、怎么造的** ✗✓ → **前三轮那条读数的"判分那一半"，到这一刻是不可复现的** ✗✓✓。
按 owner 的决定 **重建，并把配方写进 `research/graded-project-recipe.md`** ✓✓。

## 第 1 片：重建 —— 基线逐字复现 ✓✓✓

| 项 | 实测（2026-10-11） | 记录（2026-10-05） |
|---|---|---|
| `cachecontrol/controller.py` | **20,090 B** ✓✓ | **20,090 B** ✓ —— 逐字节相同 |
| 套件 | **`1 failed, 115 passed in 2.43s`** ✓✓ | `1 failed, 115 passed in 2.36s` ✓ |
| 红的那条 | `tests/test_immutable.py::TestImmutable::test_immutable_is_not_revalidated_while_fresh` ✓✓ | 同名 ✓ |
| 失败原文 | `assert False is True` · `where False = <Response [200]>.from_cache` ✓✓ | 逐字相同 ✓ |
| `.dove/mode.json` | **55 B · 无 BOM · LF** ✓✓ | 55 B · 无 BOM ✓ |
| 上游提交 | `2627d9b`（HEAD）✓ | 未记 ✗ |
| `tests/conftest.py` | 5,971 B ✗ | 5,876 B ✗ —— 差 95 B（路由 + 2 行注释） |

**而 `tests/test_immutable.py` 上游并不存在** ✗✓✓：`git show HEAD:tests/test_immutable.py` 失败 ✓，`controller.py` 里 `immutable` 出现 **0 次** ✓。
→ **夹具 = 上游这一版 + 一颗加装的测试** ✓✓；`conftest.py` 那个 281 B 差额也来自它要用的路由 ✓。
**必须写明**：**我写的那颗测试是重建、不是原始字节** ✗✓ —— 判据**同形**（同名、同断言、同失败原文 ✓），**字节不是** ✗。

## 第 2 片：收尾序列在它自己的 shell 里实测 ✗✓✓✓（**本轮的实质发现** ✓）

**harness 选的 shell 实测是 git-bash** ✓（`shell status` 给 `C:\Program Files\Git\bin\bash.exe` ✓）——
**所以在同一把 shell 里跑** ✓。副本上按场景第 2 步的顺序 ✓：

| 命令 | 读数 |
|---|---|
| `python -m pytest -q` | `1 failed, 115 passed` ✓ —— **同一台机器的原生 python 3.11.5** ✓；裸 `pytest` 不给这个保证 ✓（`python -m pytest` 才把 CWD 放 `sys.path` 最前 ✓） |
| `dove-pi.cmd task create / verify / convergence status / finish` | **全部 exit 0** ✓✓ |
| **`dove-pi.cmd task archive`（无选择器）** | **`{"ok":false,"error":{"code":"CLI_ERROR","message":"No current task."}}`** ✗✓✓ |
| `dove-pi.cmd task archive <stableId>`（finish 之后、已无 current） | **exit 0** ✓✓，goal `completed` → `archived` ✓ |

**为什么** ✓✓：`finish` 把**唯一的** goal 置为 `completed` 并**清掉 `currentGoalId`** ✓（`state.json` 实测已无该字段 ✓）
→ 无选择器的 `archive` **没有对象** ✓。**这是场景的缺陷，不是产品的** ✓（CLI 契约本就是 `task archive <task>` ✓）。
**它伤在哪** ✓✓✓：这堵墙**正好立在流程的最后一步** ✓，而 AC 要的恰恰是"归档到达" ✓ ——
**上一轮若走到那里，45 分钟会花在收尾的最后一条命令上** ✓✓。

**顺带量到两条** ✓：
- **`task archive` 的输出形状是 `{operation, projectRoot}`，不含 `task`** ✗✓ —— **它不报告结果状态**（`state.json` 才报 ✓）；
- **`task verify` 在 intake 阶段给 `ready:false`** ✓（无证据 ✓，符合预期 ✓）。

**改法** ✓✓：场景第 2 步改为**点名的归档** ✓，并把**实测原因写进 prompt** ✓
（`dove-pi.cmd task archive <the stableId the earlier JSON printed>` + "finishing this project's only goal clears the
current-task pointer, and an archive that names nothing then answers `No current task.`" ✓）。

**量具本身也修了一次** ✗✓：第一版把中间产物写进 `/tmp` ✓ —— **而 bash 的 `/tmp` 与原生 Windows python 的 `C:\tmp` 不是同一个地方** ✗✓，
于是 `$id` 为空、量到的是"空选择器"而不是 archive ✓。**改成项目内相对路径 + 先打原始输出再解析** ✓，第 2 片的两条读数才成立 ✓。

## 第 3 片：便宜判据先取 ✓✓✓（round 3 的教训 ✓）

`status-line-only` ✓ · 真 provider 载体 ✓ · `--cwd` = 重建后的克隆 ✓ · 输出在仓外 ✓：

```text
exitCode=0  settled=true  harnessTimedOut=false  events=18  duration=13128ms
carriedConfig=[settings.json, models.json, auth.json, npm/]
Dove Pi: workspace=development, workMode=code-development, hashlineEditTools=present, lens=on-next-session,
         mode=◆ Standard, thinking=high (auto:standard), tools=auto, hashline=active, operation=idle, progress=idle.
[Dove mode] code-development loaded from modes<path> (none, no authority document: this mode declares no conformance):
            1 denied action(s) are refused, and 0 action(s) run only after you confirm them.
```

→ `workMode=code-development` ✓✓ · `hashlineEditTools=present` ✓✓ · **模式真的在生效**（1 条 deny ✓）✓
→ **重建后的绑定被读到了** ✓ → P4 的前提成立 ✓。顺带：`artifactEvidence.doveState=false` ✓ —— `/status` 不建状态 ✓。

## 第 4 片：P4（45 分钟真跑）—— **第四次是新的死因** ✗✓✓

**这一次跑的是"改过第 2 步、未改第 0 步"的场景** ✓（第 0 步的措辞于运行开始后才改，见第 5 片 ✓）。

```text
scenario=immutable-directive-work-as-a-task  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-11
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json, npm/]
exitCode=0  settled=false  harnessTimedOut=false  scenarioFailed=true  events=10429  duration=1669890ms (27.8 min；上限给的是 45.0 min)
terminal: reason=failed  detail=attempt-limit  code=provider-attempt-limit (origin=provider, retryable=true)
         nextAction="Check provider availability, then submit the request again."
resources(账本事件流): toolCalls=48  providerRounds=44  toolDurationMs=28296
tokens: input=2032686  cacheRead=0  cacheWrite=0  output=17779  reasoning=14619
stopReasons: 41×tool_call + 3×error
tools the model actually called: bash, read, insert, replace, lens_diagnostics   ← hashline 那一族在场且被用了 ✓
steps: 0 failed/未 settle（10424 事件）→ 1、2、3 **一次都没发**（各 0 事件）✗
terminalConsistency=completed-ledger-only  closeWaitMs=282
dialogs: approved=0 declined=0 answered=0 cancelled=0 defaulted=0 mismatch=0 unused=0
```

**它不是被预算切断的** ✗✓✓：45 分钟的上限给足 ✓，而它在 **27.8 分钟**自己结束 ✓ —— 死因是
**provider 连续瞬时失败把 Dove 的瞬时重试预算用尽** ✓（`stopReasons` 里有 **3 条 `error`** ✓）。
**而这件事本身是 D4 的正面读数** ✓✓：终态不是通用的 *Operation aborted* ✓，而是
`provider-attempt-limit` + `retryable=true` + 一条 nextAction ✓ —— **上一次同类终止曾被报成 `provider-unknown` 并让人去查一条账本里不存在的 provider error**（round 3 已修 ✓），**这一次报对了** ✓。

**流程仍没走完** ✗✓✓：step 0 未 settle → **runner 按序发送，步骤 1–3 从未发出** ✗ → 收敛、归档、判分那一步**都没到达** ✗。
**四轮，四个互不相同的死因** ✓✓：25 min 预算到点 ✗ · 9.5 min provider 终止 ✗ · 22 s 后无限挂死 ✗ · **27.8 min 瞬时重试预算用尽** ✗。

## 第 5 片：**"流程里有没有正式任务"取决于 prompt 落在哪个 lane** ✗✓✓✓（**本轮第二个实质发现** ✓）

**活体读数** ✓：这次请求的 `request.planned` 写的是 **`lane: "fast"`** ✗ → **`formalTaskCount=0`** ✗ —— **harness 没有开正式任务** ✓。
**而收敛与归档都以"存在正式任务"为前提** ✓✓ → **这一步的结局在请求被规划的那一刻就已经定了** ✗✓✓。

**根因量到了行** ✓✓：`src/core/request-plan.ts:178` 的守卫 ——
**`EXPLANATORY_QUERY_PATTERN`（`:77`，无词边界的子串匹配）命中 `what`，而逃逸名单里一个词都没有** →
早退 `return false` → `isFormalTaskRequest=false` → `fast`。
而命中的那个 `what` 来自我（上一轮）写的这句：`change only what the behaviour needs` ✗✓。

**这是自己造成的** ✓✓✓：round 4 为了躲开那次挂死，把"让 agent 建任务"那一步**删掉**了 ✓ ——
**而恰恰是那一步的措辞（`create a task`）把请求送进 formal** ✓（`:173`：`workflowAction === "create-task"` 直接 `return true` ✓）。
**一个修复抵消了另一个修复的效果** ✗✓ —— 上一轮的读数早就写下过这句：*"「流程里有没有正式任务」取决于 prompt 落在哪个 lane"* ✓。

**判据可确定性复现** ✓✓（用仓里真实的判定函数，不靠推断 ✓）：拿场景原文调 `createRequestPlan` →
`lane=fast  intent=execution  formalTaskRequest=false` ✓（与运行里的 `request.planned` 逐字一致 ✓）。
**改法并复核** ✓✓：第 0 步改写成"请求本来就该是 formal 的那种"（带 `implement` ✓、`acceptance criteria` ✓、去掉 `what` ✓）→
同一个函数给出 **`lane=formal`** ✓✓；而第 1 步（收尾那一步）**仍是 `fast`** ✓✓ —— 正是想要的：
**收尾作用于已存在的那个任务，而不是再造一个** ✓。

## 第 6 片：判分那一半 —— **红了五天的仪器被修绿，且仪器未被触碰** ✓✓✓

**跑运行自己的副本** ✓（runner 拷出来那份，不是原件 ✓）：

| 项 | 读数 |
|---|---|
| 运行副本里项目自己的套件 | **`118 passed in 2.21s`** ✓✓（基线 **116**：115 绿 + 1 红 ✓） |
| `cachecontrol/controller.py` | **20,090 → 20,844 B** ✓（修复本体 ✓） |
| `tests/test_cache_control.py` | **14,784 → 16,065 B** ✓（它自己补了 ~2 条 ✓ → 116 → 118 ✓） |
| **`tests/test_immutable.py`** | **1,305 B，字节未变** ✓✓✓ |
| **`tests/conftest.py`** | **5,971 B，字节未变** ✓✓✓ |
| 新增文件 | **只有缓存目录**（`.mypy_cache` / `.ruff_cache`）✓，无新源码 ✓ |

→ **判分仪器没有被改** ✓✓（round 2 那个 agent **动过 conftest** ✗ → 那一次"改测试"与"改代码"在读数上分不开 ✓；
这一次分开了 ✓✓）。**而"通过"这件事仍然只是 118 条里的 118 条** ✗ —— 一条仪器只决定一个行为 ✓（配方第 4 节 ✓）。

**这一轮证明了什么、没证明什么** ✓✓：
- **证明了**：夹具可复现 ✓（基线逐字回来 ✓）· 收尾序列在 git-bash 里可用 ✓ · 便宜判据（mode 生效 + 工具面在场）绿 ✓ ·
  活真的做了且判分仪器保持干净 ✓ · 请求被判成哪个 lane **决定了**整条流程能不能收尾 ✓✓；
- **没证明**：**"一条运行里走完整个流程"** ✗✓ —— 仍未达成 ✓，而**原因换了第四次** ✓。

---

# 读数（第六次：lane 修好之后重跑 —— **三道门都真的动了，而 AC 仍未达成，原因第五次不同**）（2026-10-11 ✓）

**这一轮跑的是修好的场景** ✓（step 0 改写为落 formal ✓、step 1 点名归档 ✓），原件先量过仍是 `1 failed, 115 passed` ✓。

## 第 0 片：lane 修复**在真实运行里成立** ✓✓✓

`request.planned` → **`lane: "formal"`** ✓✓（上一轮是 `fast` ✗），且项目 `.dove/` 里 04:53:25 就出现了
`state.json` + `tasks/goal-25b1762c…/` ✓ → **正式任务被开出来了** ✓✓：
`artifactEvidence {doveState:true, doveFileCount:6, formalTaskCount:1, formalArtifactCount:5}` ✓
（上一轮 `formalTaskCount=0` ✗）。**题目的标题就是那条消息的全文** ✓（与 round 4 量到的同形 ✓）。

## 第 1 片：**引擎里两道门真的动了** ✓✓✓（本轮最实的读数 ✓）

**① 收敛门拦住了一次产品变更，并让请求中止** ✓✓：

```
task.convergence.decision  {eventKind:"product_mutation.blocked", state:"missing", snapshotRevision:0, acceptanceRevision:"unknown"}
request.terminal           {reason:"failed", detail:"convergence-missing", policyAbort:true,
                            terminal:{origin:"convergence", code:"convergence-missing", retryable:false,
                            nextAction:"Resume the active acceptance criterion before mutating product files."}}
```

→ **"先把验收标准冻结，再改产品文件"这条规则在真跑里被执行了** ✓✓，**且拒绝带 nextAction** ✓（D2/D4 的承诺 ✓）。
**而这也正是 step 0 的死因** ✗✓✓：**不是 provider，是本仓自己的门** ✓。

**② 沙箱门拦了一次网络取数** ✓：

```
gate.refused {tool:"fetch_content", action:"fetch_content", gate:"sandbox",
              reason:"[sandbox] Mode 'code-development' declares 'san…"}
```

→ **mode 的声明在工具边界上真的生效**（不只是状态行里好看 ✓）。

## 第 2 片：**落进 formal 反而挡住了"干活"** ✗✓✓（本轮最该记的一条 ✓）

**两轮对照，同一个场景、同一份夹具** ✓：

| | 上一轮（`fast`） | 这一轮（`formal`） |
|---|---|---|
| 门 | **没有门**（fast 不建任务 ⇒ 无收敛门 ✓） | **有门，且拦了** ✓ |
| 干活 | **把红的那条修绿了** ✓✓（`118 passed` ✓） | **没修好，还弄坏一条** ✗（`2 failed, 114 passed` ✗） |
| 收尾 | 到不了（无任务）✗ | 到不了（**请求被自己的门中止**）✗ |

→ **"干活"与"冻结验收"在场景里的顺序是错的** ✗✓✓：门要求**先冻结验收标准再改产品文件** ✓，
**而场景的第 0 步从来没说要先冻结** ✗ —— 于是 agent 一头撞在门上，请求 `convergence-missing` 中止 ✓。
**这是场景的缺陷，不是门的缺陷** ✓（门按声明做了它该做的 ✓）；**而修法是把顺序写进 prompt** ✓：
冻结 → 干活 → 判分 → 收敛 → finish → 归档 ✓。

## 第 3 片：**provider 又用同一种方式杀掉了收尾** ✗✓

step 1（收尾那步，`lane=fast` ✓ `workflowAction=archive-task` ✓）跑了 **10 次工具调用 / 9.7 min** ✓ 后：

```
request.terminal {reason:"failed", detail:"attempt-limit", terminal:{origin:"provider", code:"provider-attempt-limit", retryable:true}}
stopReasons: 11×tool_call + 3×error
```

→ **两次真跑，两次死在同一个 provider 瞬时配额上** ✗✓（45 分钟的预算两次都没用上 ✓：一次 27.8 min ✓、一次更早 ✓）。
**这是 provider 侧的读数，不是 Dove 的** ✓，而 Dove **如实报出了它** ✓✓。

## 第 4 片：终态与判分那一半 ✓✗

| 项 | 读数 |
|---|---|
| 任务终态 | **`status: active`, `phase: intake`** ✗ → **finish / archive 都没到** ✗ |
| 收敛记录 | **`convergence.json` 不存在** ✗（decision 里也写着 `state:"missing"` ✓）—— 说明 `freeze` **从未被执行** ✗ |
| 运行副本里项目自己的套件 | **`2 failed, 114 passed`** ✗ —— 目标仍红 ✗，**且 `tests/test_redirects.py::TestPermanentRedirects::test_bust_cache_on_redirect` 被弄坏** ✗ |
| 判分仪器 | 未被触碰 ✓（与上一轮同 ✓） |

**"努力是真的、结果是错的"第二次出现** ✓（round 2 是它的第一次 ✓）—— 而这一次**能看出为什么** ✓：
**它没被允许（也没有被告知要先）冻结验收标准**，于是在门口撞停；收尾那一步再由 provider 收场 ✓。

## 第 5 片：两轮合起来，五个阻断各自的处置 ✓✗

| # | 阻断 | 状态 |
|---|---|---|
| 1 | 夹具不在这台机器上（不可复现） | **已修** ✓（重建 + 配方 ✓） |
| 2 | 收尾 `task archive` 无选择器 | **已修** ✓（场景点名 ✓） |
| 3 | 请求落 `fast` ⇒ 无正式任务 | **已修并复核** ✓（改写 + 定性复现 + 真跑验证 ✓） |
| 4 | **prompt 没说要先冻结验收标准** | **待修** ✗（下一件要做的事 ✓） |
| 5 | provider 瞬时配额两次杀场 | **不是本仓的** ✗（读数如实 ✓；换一个稳的 provider 或等它稳 ✓） |
