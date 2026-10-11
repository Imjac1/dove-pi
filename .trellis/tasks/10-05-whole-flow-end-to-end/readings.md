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

---

# 读数（第七次：provider 侧变成"每次第一次调用就被拒"—— 四种解释逐一排除，仍不可从 host 外复现）（2026-10-11 ✓）

**第三、四次真跑同形** ✗✓✓：**20.4 s / 16.9 s** ✓ · `providerRounds=3` ✓ · `stopReasons=["error","error","error"]` ✓ ·
**零 token、模型一个字都没答** ✓（`toolCalls=0` ✗）。**而 intake 仍然工作** ✓：`lane=formal` ✓、
正式任务 + **6 份产物（含 `evidence.jsonl`）** 已建 ✓（两次都 ✓）。

## provider 原文（**取自运行自己的会话，不是推断**）✓✓

```text
attempt 1  assistant  stopReason="error"    usage 全 0
attempt 2  assistant  stopReason="error"    usage 全 0
attempt 3  assistant  stopReason="aborted"  errorMessage="Connection error."  usage 全 0
```

Dove 自己的记录（账本）✓：

```text
provider.request.completed  stopReason="error"  failureKind="transient"  failureReason="reviewed-provider-message"  durationMs=76/18/52
```

→ **失败只用 18–76 ms** ✓ —— **不是超时，是当场被拒或断连** ✓；而 **Dove 把它归为瞬时并如实停了** ✓（`provider-attempt-limit` ✓ `retryable=true` ✓ nextAction ✓）。

## 四种解释，逐一实测排除 ✗✓

| 假设 | 实测 | 判 |
|---|---|---|
| 端点/网络不通 | DNS ✓ 解析到 aliyun ALB ✓；`/v1/models` **连续三次 401**（未认证即为"服务在"）✓ | **排除** ✗ |
| 凭据失效（我提示过轮换 key） | 用**运行自己携带的那份 key** 发最小请求 → **HTTP 200** ✓（key 长度 36、前缀 `atr_`，未回显） | **排除** ✗ |
| 流式被拒（Pi 是流式的，我先前的是非流式） | `stream=true` → **200** ✓（2,467 B SSE）；`stream=false` → 200 ✓ | **排除** ✗ |
| payload 体积（host 发 49 tools / 74,402 B 工具 schema） | 合成 49 tools / **40.5 KB** → **200** ✓ | **排除** ✗ |

**而两次成功与两次失败，payload 逐项相同** ✓✓：

| 运行 | tools | schemaBytes | sysBytes | 结果 |
|---|---|---|---|---|
| 第 1 次（27.8 min） | 49 | 74,402 | 8,280 | 多次成功调用 ✓ |
| 第 2 次（9.7 min） | 49 | 74,402 | 8,280 | 多次成功调用 ✓ |
| 第 3 / 4 次 | 49 | 74,402 | 8,280 | **三次全拒** ✗ |

→ **同一个 host、同一份配置、同一个 payload，今晨（02:54–05:06）可用，15:00 起每次第一次调用就被拒** ✗✓✓。
**我从 host 外面构造的每一种请求都被接受** ✓ —— 所以**这个失败无法从 host 外复现** ✓，
而 **provider 通道是 Pi 的**（D1 ✓）**不是本仓能改的** ✓。**不猜原因、不写成已知** ✗：剩下的可能（网关对 Pi 那组 header 的规则、
该 key 的配额窗口、provider 当天的灰度）**一个都没量到** ✓。

## 对目标的影响 ✓✗

**AC#2 仍未达成** ✗，而**它现在缺的不是任何本仓的东西** ✓：四个场景侧阻断全部修好并各自验证过 ✓，
两次真跑都走到了"正式任务已开、门已执行"这一步 ✓ —— **缺的是一个不被打断的 provider 窗口** ✗。
**所以本轮起转向问题③**（`src/jailer` 接线：纯本地、可离线验证）✓。

---

# 读数（第八次：把 provider 侧失败逼到边界 —— 六种解释全部排除，失败的只在 Pi 那条通道里）（2026-10-11 ✓✓）

**第五次真跑同形** ✗✓：**20.6 s** ✓ · `providerRounds=3` ✓ · `stopReasons=["error","error","error"]` ✓ · 零 token ✓ · intake 仍工作 ✓
（`lane=formal` ✓、正式任务 + 6 份产物 ✓）。**已是连续第三次**（c/d/e）⇒ 是**持续条件**，不是抖动 ✓。

## 全部排除项（每一条都是实测，不是推断 ✓✓）

| 假设 | 怎么测的 | 读数 | 判 |
|---|---|---|---|
| 端点不通 | DNS + 连续三次未认证请求 | 解析到 aliyun ALB ✓；**连续三次 401** | **排除** |
| 凭据失效 | 用运行自己携带的 key 请求 | **200** ✓（`/v1/models` 与 `/v1/chat/completions` 都是） | **排除** |
| 栈差异（PowerShell vs Node） | **用 Node 自己的 undici** 重发 | **200** ✓ | **排除** |
| 流式被拒 | `stream=true` / `false` | 都 **200** ✓ | **排除** |
| 载荷体积 | 合成到 **host 真正的尺寸**（49 tools；40.5 KB → 67.4 KB → **112.2 KB**） | 全部 **200** ✓（含流式 ✓） | **排除** |
| 配置指错地方 | 读运行携带的 `models.json` 字段 | `baseUrl = https://api.atria-asi.ai/v1/` ✓、`api = openai-completions` ✓、与我所测**完全一致** ✓ | **排除** |

**而 host 的请求**：运行自己的会话原文是 `stopReason="error","error"` 然后 `"aborted"` + `errorMessage="Connection error."` ✓；
账本是 `failureKind="transient"` / `failureReason="reviewed-provider-message"` / **18–76 ms** ✗ —— **当场失败**，
而我手工构造的每一种请求（两种栈、四种体积、流式与非流式）都成功，只是**慢**（3.0–30.0 s ✓，provider 现在很慢 ✓）。

## 结论：边界画在这里（不猜原因 ✓）

**再加一行，如实标"未测"而不是"已排除"** ✗：配置里 `settings.json` 带 **13 个 Pi 扩展包** ✓，其中 `pi-cache-optimizer@2.8.6` 是**会改写请求**的那一类 ✓，
而运行的账本里恰有 `cachePolicyVersion: 3` ✓ —— "某个扩展改写了请求、而 provider 改了判据"**能解释**"手造请求都成功、host 的请求秒拒" ✓。
**但它没被量到** ✗：要测它得把 `PI_CODING_AGENT_DIR` 指向一份配置副本（runner 从该变量取被携带的配置 ✓，第 70 行），
而那份 `npm/` 有 **361.5 MB / 15,272 文件** ✗ —— 换取排除一条假设的代价不对 ✓。**记为线索，不记为结论** ✗。
（同时确认 `pi` 不在 PATH 上 ✗，且 `pi-ai` 的 CLI 没有一次性模式 ✗，所以"绕开 runner 直接问 Pi"这条捷径不存在 ✓。）

---

# 读数（第九次：**复现了 provider 的失败** —— 它是网关在持续负载下的 502，不是任何一方的代码）（2026-10-11 ✓✓✓）

**第六次真跑把线索交出来的** ✓：它在 **6 轮 provider 调用 / 约 85 秒**里正常干活（**5 次工具调用 ✓**、3 条收敛观察 ✓、
正式任务 6 份产物 ✓、**目标 phase 到达 `blocked`** ✗✓ —— 收敛机制真的推了它 ✓），然后是 `attempt-limit` / `policyAbort: true` ✗。

**而它的资源读数把"间歇"两个字写实了** ✓✓（runner 自己的汇总 ✓）：`durationMs 88113` ✓ · **`toolCalls 5`** ✓ · **`providerRounds 6`** ✓ ·
`inputTokens 73082` ✓ · `outputTokens 581` ✓ · `toolNames [bash, read]` ✓ ——
而 **`stopReasons` = `["error","error","tool_call","tool_call","tool_call","error"]`** ✓✓：
**两次错误 → 三轮成功（真的调用了工具）→ 又一次错误** ⇒ **失败是间歇的，不是"某次之后永久坏掉"** ✓ ——
这与下面的 12 连发读数同形 ✓。

**由它得出的假设** ✓：**每 key 的速率限制** —— host 在 85 秒里发 6 次 ⇒ 被拒；而**我先前每一次探针都是稀疏的** ⇒ 全部通过 ✓。

**12 连发实测**（`probe-burst.mjs`，同一 key、同一端点 ✓）：

```text
#1..#8   HTTP 200，2.1–7.4 s
#9       HTTP 502 Bad Gateway，246 ms      ← 与 host 的 18–76 ms 失败同形 ✓✓
#10..#12 HTTP 200，3.8–9.0 s
```

→ **结论升级**：**网关在持续负载下会立刻返回 502 / 断连** ✓✓ —— 这**不是** Dove 的、**不是** Pi 的、也**不是**凭据或载荷的 ✓。
先前"差别只能在 Pi 的通道里"是**在稀疏探针下**能画到的边界 ✓；现在这个边界**被量到了更远的地方** ✓。
（延迟本身也是读数：**2–9 秒/次** ✓ —— 该端点在本次测量期间一直吃紧 ✓。）

**对 ② 的意义** ✓：它要的"一个不被打断的窗口"**不是本仓能造出来的** ✗，而**需要的窗口长度已知** ✓
（第六次真跑证明：≥85 秒、≥6 轮就够它走到"工具面进读数 + 收敛观察 + 目标 phase=blocked"✓）。
**可选的出路**（都在 provider/运维侧 ✓）：换一个不吃紧的 provider/端点 · 提高该 key 的配额 · 等端点恢复 ✓。

---

# 读数（第十次：**窗口与窗口之间差异很大** —— 第七次真跑 18 秒就死，三次全失败）（2026-10-11 ✓✗）

**第七次真跑** ✗：`~18 秒` ✓ · **3 轮 provider 调用、3 次全失败** ✗ ⇒ `request.terminal {detail: "attempt-limit", policyAbort: true}` ✓。
对照第六次（**6 轮、其中 3 轮真的调用了工具 ✓**、88 秒 ✓）⇒ **失败率是"每个窗口一个数"，不是常数** ✓：
好窗口里错误与成功**交错** ✓，坏窗口里**一次都不成** ✗。

**这也是那条契约的形状** ✓（`personal-agent-request-runtime.md:313-329` ✓ 原文）：
*"Automatic retry is **bounded and fail-closed**. HTTP 408/425/429/5xx and reviewed transport-reset/timeout codes are transient
**while the attempt limit has not been reached**…"* ✓ —— 所以那个上限是**刻意的策略** ✓（同段给了理由：已发生的 effect 不能被盲目重放 ✓），
**不是疏漏，我不动它** ✗。**结论**：② 需要的是**一个好窗口**，而窗口好坏 **30 秒内可见** ✓ ⇒ **反复试是便宜且机械的**（每次失败 ~20 秒 ✓），
这正是本轮采用的做法 ✓。

**第八次真跑把算术做出来了** ✓✓：**6 轮 provider ✓、5 次工具调用 ✓**（**好**窗口 ✓），仍然 `request.terminal` ✗（~100 秒 ✓）。
即：**好窗口也会在累计到 3 次瞬时失败时结束** ✗。而 ② 要走完（step 0 的冻结+干活+判分、step 1 的收敛+finish+归档）
**需要 ~40 轮** ⇒ 按好窗口的失败率（约 1 次 / 6–10 轮 ✓）**必然累计 ≥3 次** ✗ ——
⇒ **② 在当前端点上不是"运气不好"，是算术** ✗✓✓。

**两条出路，都在"改哪个"上是清楚的** ✓（都要你定 ✓）：
- **(A) 换/等一个健康端点** ✓ —— 不动本仓 ✗；代价是时间或额度 ✓。
- **(B) 把那个上限从"每请求累计"改成"连续"** ✓ —— 依据是同段契约自己写的：*"a started effect no longer refuses one,
  because Pi's provider retry **continues from the existing tool result (measured)** rather than re-executing the tool"* ✓，
  即**重试对工具回路是安全的** ✓；那么"恢复过的请求拿回预算"并不违反 fail-closed 的理由 ✓。
  **代价**：改契约（`personal-agent-request-runtime.md:313-329` ✓）+ 一条用例 + 重写那段的理由 ✓ ——
  与 ① 被授权的改动**同形**，但**不是** ① 那一件 ⇒ **需要你明确同意** ✓。

**决定（2026-10-11，操作者）** ✓：**继续用 `Atria-Dawn-Preview`** ✓（不换端点 ✓）。
依据：服务只提供这一个模型（`GET /v1/models` → `["Atria-Dawn-Preview"]` ✓，HTTP 200 ✓），
而这台机器上也只有这一个 provider 配置 ✓。⇒ **策略回到"反复试、抓一个好窗口"** ✓：
按算术，失败率 10% 时 ~40 轮的请求约 **25%** 能过、5% 时约 **50%** ✓ —— **重试是真策略，只是不保证** ✓。
**每次失败 ~20–100 秒** ✓，而窗口好坏 30 秒内可见 ✓，所以试错成本低 ✓。**每次尝试的读数照旧入档**（不挑好看的记 ✓）。

---

# 读数（第十一次：**阻断被定位到本仓可修处** —— 工具在、模型不调它）（2026-10-11 ✓✓✓）

**第九次真跑**（`…-i`，本会话走得最远 ✓）：**8 轮 provider ✓ · 7 次工具调用 ✓ · `2 request.received` / `2 request.planned`** ✓✓
（**step 1 第一次被送达** ✓），并产生 **1 条 `task.convergence.decision`** ✓。然后两个请求都以 `attempt-limit` 收场 ✗。

## 那条决定说的是什么，以及 agent 调了什么 ✓✓

```text
task.convergence.decision  {eventKind:"product_mutation.blocked", state:"missing", snapshotRevision:0, acceptanceRevision:"unknown"}
工具调用                     bash ×2 · read ×4 · grep ×1        ← agent_task_convergence 一次都没有 ✗
```

⇒ **门因为"没有冻结的验收标准"挡住了它的第一次产品变更** ✓（与第五次同形 ✓），**而它从未调用那个工具** ✗。

## 这是"接线缺陷"还是"模型没照做"？——量了，是后者 ✗✓✓

| 检查 | 读数 |
|---|---|
| 工具是否注册 | ✓（`extension.ts` 里它的校验与指南都在 ✓） |
| **工具是否发给了模型** | **✓✓** —— 会话里 100 KB 的 tools 数组 ✓，15 个 `agent_*` 全在，**`agent_task_convergence` 在列** ✓ |
| 模型是否调用 | **✗ 一次都没有** ✓（账本里只有 bash/read/grep ✓） |
| prompt 是否说了要先冻结 | **✓ 说了**（场景第 0 步 ✓），工具自己的指南也说了 ✓ |

⇒ **"先冻结再改"这条规则，今天只靠"告诉模型"来执行，而它两次都没照做** ✗✓✓。
这正是本仓自己那条纪律说的形态：**只靠散文/提示的规则，是没人守的规则** ✓ ——
而它的修法也在本仓手里 ✓✓：**intake 既然已经从那条消息里开出正式任务、并写出了 `acceptance.md`（判据的文本 ✓）**，
**"冻结"这一步就该由 harness 自己做** ✓，而不是等模型记得调一次工具 ✗。
（判据文本已经在场 ✓；缺的只是把它记成 **frozen** 的那条记录 —— `convergence.json` 至今不存在 ✗ ✓。）

**这一步的改动边界**（下一轮的规划，需你点头 ✓）：`src/core/task-convergence.ts`（verifier-embedded ✗ ⇒ 改动要按本仓对 verifier 的规矩来 ✓）
+ intake 的那处调用点 + 一条用例（"开正式任务后，第一次产品变更不再因 `state: missing` 被挡" ✓）+ 相关规格页 ✓。

## 纠正：上一条规划的前提是错的 ✗✓（读代码后自我更正）

**动手前读代码，发现三点，合起来否掉了上一条的修法** ✓：

1. intake 开正式任务的地方在 `src/pi-adapter/extension.ts:3301` ✓（`requestPlan.lane === "formal"` ⇒ `ensureFormalTask(...)` ✓）；
2. **但它写下的 `acceptance.md` 是模板占位** ✗：`native-artifacts.ts:115` 的原文是
   *"Pending: define and verify the acceptance criteria from prd.md."* ✓ —— **不是判据** ✗；
3. 而冻结事件**必须是第一个**（`task-convergence.ts:250`：*"acceptance.frozen must be the first convergence event"* ✓），
   且**判据由调用方提供**（`extension.ts:410`：`operation === "freeze"` ⇒ `criteria: input.criteria ?? []` ✓）。

⇒ **判据的文本并不在场** ✗ —— 它们要**从请求/prd 推导** ✓，那是模型的活 ✓。
所以"让 harness 把自己刚写的东西冻结掉"**做不到** ✓：它写的是占位符 ✗。**上一条规划的这一步作废** ✗✓。

**修正后的选项**（都保留原样记录，不挑好看的 ✓）：

- **(1) intake 把"请求者说过的那句"冻结成一条判据** ✓ —— 文本是**用户自己的**（不发明 ✗），
  于是模型下一次变更不再被 `state: missing` 挡住 ✓，并且冻结快照**反过来把判据显示给模型** ✓。
  代价：产品行为改变（判据的来源多了一个"harness 的转写" ✓），需你定 ✓。
- **(2) 只改工具指南/模式文本（再来一次）** ✗ —— 已经做过两次了（`extension.ts:1546-1549` ✓ 与场景第 0 步 ✓），
  **模型两次都没照做** ✗✓ ⇒ 按本仓纪律，这条不算修法 ✓。
- **(3) 不动它，只把读数留住** ✓ —— ② 保持"被两件事挡住"（模型不冻结 ✓ + provider 窗口 ✗）的如实状态 ✓。

## 再纠正一次：**step 0 不是被 provider 杀死的** ✗✓✓（账本按追加顺序读出来的）

第九次真跑的**事件顺序**（追加顺序 = 时间顺序 ✓）把它说清了 ✓：

```text
#3..#19   5 轮 provider 全部成功（15s / 17s / 7s / 11s / 70s，stop 全是 tool_call ✓）
#20       tool.started read                    ← 模型最后一次动作
#21       task.convergence.decision            product_mutation.blocked / state=missing
#22       request.terminal                     detail=convergence-missing  abort=True   ← 本仓自己的门
#23..#30  step 1 的请求，从这里才开始出现 stop=error（5ms）✗
```

⇒ **provider 一直健康到第 5 轮**（含一轮 **70 秒**的成功调用 ✓），**失败是从门中止之后才开始的** ✗✓✓。
**我上一条读数（"好窗口也会被 provider 杀掉"）过粗，纠正** ✗：**step 0 是 Dove 自己的收敛门中止的** ✓，
而模型**在拒绝之后没有得到任何回应机会** ✗ —— 因为请求在拒绝那一刻就结束了 ✓。

**这把主杠杆换了位** ✓✓：② 的第一阻断是**"冻结必须发生在第一次产品变更之前"** ✓，
而模型的模式是 `read/grep/bash → 直接尝试改文件` ✗，于是每次都在门口结束 ✓。
（**未验证** ✗：那条拒绝给模型的 `nextAction` 在 `state: missing` 情形下到底是什么文本 ——
第九次读到的 `"Resume the active acceptance criterion before mutating product files."`（第五次 ✓）在 `missing` 时**可能本就是错的建议** ✓
—— 它在 `extension.ts` 里搜不到 ✓，我的上下文预算不足以继续追 ✗。**记为待查，不记为结论** ✗。）

> **同一个 URL、同一个 key、同一份载荷、同一个 Node 栈** —— 我构造的请求全部成功，**Pi 的请求 18–76 ms 内失败** ✓。
> 差别只能在 **Pi 自己构造/处理那一次请求的路径里**（它加的 header、它的重试/中止逻辑、它的连接池状态），
> 而 **provider 通道属于 Pi**（D1：本仓不实现它 ✓）。**故不写成"原因已找到"** ✗ —— 剩下的可能一个都没量到 ✓。

**留给运维/上游的一步**（本仓做不到的一步）：开 Pi 自己的调试日志，或在同一台机上换一个 provider/模型试一次；
两者任一即可把"Pi 的通道"与"这台机的路径"分开 ✓。

## 这段条件里 Dove 自己的行为是**对的** ✓✓（值得单独记）

- 三次瞬时失败 → **如实归为 `transient`** ✓（`failureReason: "reviewed-provider-message"` ✓，读的是宿主自己的 `stopReason` ✓）；
- 停场时给出 **`provider-attempt-limit` + `retryable: true` + nextAction** ✓，且**不把重试伪装成新请求** ✓；
- **intake 不受影响** ✓：正式任务与 6 份产物照常建立 ✓（`lane=formal` ✓），
  即"模型一个字没答"与"作业没被登记"被分开了 ✓ —— 这正是 AC#2 里"工具面与登记"那一半 ✓。

---

# 读数（第十二次：**把"先冻结"从散文搬进事实驱动的通道，并用两个方向看住它**）（2026-10-11 ✓✓）

**这一轮不花 provider 预算** ✓✓ —— 它做的是第十一次读数最后那条**已定的修法** ✓（操作者选定方案 A ✓），
判据**全在本地、可确定性复现** ✓。

## 第 0 片：两句分开，各归各的通道 ✓✓（**这是本轮的形状** ✓）

| 话 | 落在哪 | 为什么 |
|---|---|---|
| **"有门，门是什么"**（事实） | **稳定系统提示** `[PERSONAL AGENT]` 从句 ✓（`extension.ts:3462` ✓） | 它在整个会话里**逐字节恒定** ✓，事实是恒定的 ✓ |
| **"先冻结"**（催促） | **`[PERSONAL AGENT REQUEST GUIDANCE]`** ✓（`extension.ts:3433-3437` / 组装点 `:3441` ✓） | 它是**每请求编译**的 ✓，且只有"开了正式任务且尚无冻结快照"时才在 ✓ |

**改前那一句是假的** ✗✓✓：`Formal task artifacts organize work but never gate Pi tools` ✓ ——
对那四个 `.md` **字面为真** ✓，对别的**全部误导** ✗：实测里**第一次产品变更确实被拒了** ✓，
拒它的是**任务的冻结验收记录** ✓，那不是 artifact ✗。改成：
*"…never gate Pi tools themselves; what a formal task gates is its frozen acceptance record."* ✓
（**同一处更正**是 `3743fc0` 给终态 `nextAction` 做的那一次 ✓，理由相同 ✓：一份记录的两半不能对"下一步做什么"各说一套 ✓。）

**催促语**不进稳定块 ✓ —— 写进去它就成了**每个请求都在**的一句 ✓，而那正是第十一次读数自己写下的"噪声" ✗。

## 第 1 片：条件是**门的条件**，不是新判据 ✓✓

```ts
requestLease.isNewRequest && requestPlan.lane === "formal"
  && projectProvider.readTaskConvergence(requestTaskId).kind === "missing"
```

`missing` ✓ —— **这正是门自己用的那一次读** ✓（`:2750`：`currentRequestPlan?.lane === "formal"` + `readTaskConvergence(currentRequestTaskId)` ✓；
`:2770`：`kind !== "valid"` ⇒ `Freeze stable acceptance criteria with agent_task_convergence…` ✓）。
⇒ **门沉默的地方，这句话也沉默** ✓✓，两者不会被各自改动漂开 ✓。
**判据文本**是"no acceptance criteria are frozen for it yet" ✓ —— **它不声称"本请求开了任务"** ✗✓：
任务早于本请求存在时那句话就是假的 ✓，而**这正是本任务在治的那类毛病** ✓。

## 第 2 片：用例**两个方向都实测见红** ✓✓（**本轮的机制** ✓）

`says a formal task's acceptance record is unfrozen only while it is, and keeps the errand out of the stable prompt`
（`tests/pi-adapter.test.ts` ✓）—— 它同时看住四件事 ✓：

| 断言 | 看住什么 |
|---|---|
| 系统提示含 `what a formal task gates is its frozen acceptance record` | 那处**不再说谎** ✓ |
| 系统提示**不含** `so freeze the criteria` | 催促语**没被写回恒定块** ✓ |
| 消息体含 `[PERSONAL AGENT REQUEST GUIDANCE]` 且含 `no acceptance criteria are frozen` | 它在**那条通道**里 ✓（`cache-prefix.ts:148` 认的正是这个标记 ✓） |
| 冻结之后**不再含**这句话 | 条件**真的在动** ✓ |

**红是量到的，不是推的** ✓✓（两次都只改条件、不改断言 ✓）：

```text
把催促语从通道里拿掉        → ✖ the errand rides the guidance channel, which is the one that already carries harness text into every request
把它改成永远出现（不读记录） → ✖ once the record exists the sentence is gone, because a sentence that is always present is noise
```

**并登记进 `AGENTS.md` 规则表** ✓（这条规则现在**有机制看着** ✓，不再只靠散文 ✓）。

## 第 3 片：这一轮自己付的税 ✓✗（**照实记** ✓）

1. **mount 表随位移** ✓✓：我插在 `:3423` 之前 ⇒ **`pi.on("context")` 3523 → 3548** ✓，
   **`cites the declaration each mount-point row names` 当场红** ✓✓（`1 of 18` ✓）—— **这个门第二次为同一件事存在** ✓。
   修：该行 → `:3548` ✓，页顶那条**区间** `:2167`-`:3523` → `:3548` ✓。
2. **同一位移还带出一处页面引用** ✓✗：`personal-agent-product.md:81` 的 `3575-3595` → `3600-3620` ✓（纯位移 +25 ✓，形状未改 ✓）。
3. **顺手量出一处*先前就*烂的引用** ✗✓✓：`personal-agent-mode-format.md:46` 写的 `extension.ts:3418` ✓，
   而**在改动之前的 HEAD 上** `:3418` 是 `requestContextRevision = …empty` ✗，真身 `workModeInstructions(activeWorkMode)` 在 **3433** ✓
   —— **它在我动手之前就已经差 15** ✓（两个数都是量出来的：`git show HEAD:src/pi-adapter/extension.ts` 逐行读 ✓，
   改动后真身是 **3448** ✓）。**已改** ✓（→ `:3448` ✓）。**记在这里，因为是量到的** ✓。

## 第 4 片：这一轮的判据与代价 ✓✓

| 项 | 读数 |
|---|---|
| `npm run typecheck` | **0** ✓ |
| `npm test` | **974 / 974 pass / 0 fail** ✓✓（比上一轮 +1 = 新用例 ✓） |
| 两个方向**先见红** | 是 ✓（两条 AssertionError 原文见第 2 片 ✓） |
| 文档门（`spec-anchors` ✓ `document-drift` ✓） | **16 / 16 绿** ✓✓（含 mount 表那条 ✓） |
| token / provider 代价 | **零** ✓✓（本轮没有真跑 ✓） |

**顺带记一条与本次改动无关的** ✗✓：整轮里 `keeps every child of a parallel batch visible while the batch is in flight`
**红过一次**（`0 !== 2` ✓），**第二次整轮绿** ✓。**它不可能被本轮碰到** ✓ —— 那条用例注册的是 `on() {}` ✓（`pi-adapter.test.ts:1767` ✓），
`before_agent_start` **一次都不进** ✓。**机制是它自己的** ✓：子进程 2,500 ms、而它只等 600 ms ✓，
满套件并发下两次 node 启动可能超出这个固定窗口 ✓。**记为读数，不擅自改** ✓（它不属本任务的 AC ✓）。

## 第 5 片：仍未达成的那一条 ✓✗（**不粉饰** ✓）

- **AC#2「一条运行里走完整个流程」仍不成立** ✗✓ —— 而**这一轮把它的第一阻断从"没人告诉模型"改成了"模型被告知"** ✓：
  以前那句催促只活在"调工具时才读到的指南"里 ✓（两次没被照做 ✓），现在它**每个请求都在** ✓，**且只在为真时在** ✓。
- **仍未证明的** ✗：**第九次真跑里模型会不会照做** ✓ —— 那要一个不被打断的 provider 窗口 ✓，
  而按第十次读数的算术 ✓，那是**本仓造不出来**的东西 ✓。
- 第 4 片那条**与本次同形的判据**（"下一次真跑里账本应在第一次 `tool.started` 之前出现冻结" ✓）**未取** ✗。
- 第十一次读数列出的两个**改策略**的选项 **(a)/(b)** ✓ **仍原样开着** ✗✓ —— 本轮没有走它们 ✓（走的是操作者选定的 GUIDANCE 通道 ✓）。

---

# 读数（第十三次：**装的那份与源的那份，在同一个场景上对得起来**）（2026-10-11 ✓✓）

**重装在前** ✓：`node bin/dove-pi.cjs install` 从本树装出一份新的 ✓ ——
`current = 0.2.0+source.35cc36f24c9d` ✓、`previous = 0.2.0+source.a5b0e17e2318`（旧那份保留 ⇒ `dove-pi rollback` 一步可退 ✓）。
指纹是**全树内容哈希**（`installer/manager.py:_source_fingerprint` ✓，排除 `.git`/`.trellis`/`node_modules` ✓、**含** `.trellis/spec/**` ✓），
所以这棵树一改就得到新 release id ✓，不会命中 `_is_prepared` 的复用分支 ✓。
装的过程照实记 ✓：拷贝 → `npm ci`（335 包 / 11 s）→ `release:manifest` → `typecheck` → `pi:smoke` → 原子切换 →
13 个托管扩展逐个对账（**0 installed / 13 already current / 0 failed** ✓）。

**三个可观测的判据** ✓✓：

| 判据 | 读数 |
|---|---|
| `install.json.current` | **`0.2.0+source.35cc36f24c9d`** ✓（`previous` 是旧那份 ✓） |
| 装的那份 `src/pi-adapter/extension.ts` | **带上本轮** ✓：`:3462` 是新从句 ✓、`:3435` 是 GUIDANCE 里的催促语 ✓ |
| `bin/` | **`dove-pi` 538 B、`-rwxr-xr-x`** ✓✓ —— 第四轮那个无扩展名 shim **终于装上了** ✓ |

**而它解决的正是第四轮那个口** ✓✓：在 harness 选定的那把 shell（git-bash）里
`which dove-pi` 与 `command -v dove-pi` **都解析到 `/c/Users/Macfy/AppData/Local/DovePi/bin/dove-pi`** ✓✓，
`dove-pi --version` 走 shim → PowerShell → `.ps1` → 按 `install.json` 解析 release → `Dove Pi 0.2.0 (Pi 1.0.0)` ✓；
`dove-pi doctor` 在仓外也正常 ✓（13 extensions all healthy ✓）。**从前这里两边都是 command-not-found** ✗✓。

## 两次 `status-line-only`（零 token ✓）

| 项 | `--launcher source` | `--launcher dove-pi` |
|---|---|---|
| exitCode / settled | 0 ✓ / true ✓ | 0 ✓ / true ✓ |
| harnessTimedOut / scenarioFailed | false / false ✓ | false / false ✓ |
| events | 18 ✓ | 18 ✓ |
| durationMs | 26134 | 17359 |
| carriedConfig | `[settings.json, models.json, auth.json, npm/]` ✓ | 同一份 ✓ |
| toolNames / providerEvidence | `[]` / `[]` ✓ | `[]` / `[]` ✓ |

状态行**逐字相同** ✓✓：`workMode=code-development` ✓ · `hashlineEditTools=present` ✓ · `hashline=active` ✓ ·
`1 denied action(s) are refused` ✓。`artifactEvidence.doveState=false` ✓（`/status` 不建状态 ✓，与第五次同形 ✓）。

⇒ **装的那份功能正常** ✓（托管路径走的是 `cmd.exe /c dove-pi.cmd` ✓，`scripts/real-dove-blackbox.mjs:115` ✓），
且**管道仍然通** ✓：mode 真的加载 ✓、工具面在场 ✓（`npm/` 携带修复在里面 ✓）、零模型调用 ✓。

**这次没证明的** ✗✓（**必须写明** ✓）：**本轮那句催促语**看不住 ✓ —— `/status` 那句没有落进 formal lane ✓
（`formalTaskCount=0` ✓），所以那句话**根本不会出现** ✓。**这次量的是管道，不是改动本身** ✓。
要看它，只有一次真跑：请求发到 provider、payload 里带上那块消息 ✓。

**两条 stderr，两次都在、与本次改动无关** ✗✓：`builtin:mcp` 与某扩展的命令冲突 ✓、
以及三处 `typebox` 应在 `peerDependencies` 而非 `dependencies` ✓ —— 都来自那 13 个托管扩展 ✓，
source 与安装两份**一模一样** ✓。**记为观察，没动** ✓。

**顺带纠正一条** ✗✓：配方 §4 原写"这台机器的托管安装还没有那个无扩展名的 shim" ✓ ——
**那句话量于当时为真、现在是假的** ✓，已就地改成当前状态 ✓（并写明"field runner 托管路径仍拼 `dove-pi.cmd`" ✓ 所以场景不变 ✓）。

---

# 读数（第十四次：**第十次真跑 —— 那句话发出去了，而它要防的那条规则一直是死的**）（2026-10-11 ✓✓✓）

**这一轮是"试一下"** ✓：按 45 分钟预算、`--launcher source` 跑了一次整条流程 ✓。

## 第 0 片：这次运行（§4 格式 ✓）

```text
scenario=immutable-directive-work-as-a-task  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-11
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json, npm/]
exitCode=0  settled=false  harnessTimedOut=false  scenarioFailed=true  events=?  duration=5.8 min（上限给的是 45.0 min）
terminal: reason=failed  detail=unknown  code=provider-unknown  retryable=false  origin=provider
resources(账本): toolCalls=7  providerRounds=6  stopReasons=["tool_call","tool_call","tool_call","tool_call","tool_call","error"]
tokens(6 次调用逐条 usage 求和): input=134,098  output=1,854  reasoning=1,484
tools the model actually called: bash, read, fetch_content(gate 拒)
artifactEvidence {doveState:true, doveFileCount:7, formalTaskCount:1, formalArtifactCount:6, convergenceFileCount:0}
```

## 🎯 第 1 片：**那句话确实发出去了** ✓✓（**本轮第一次在真跑里看到它** ✓）

会话原文（运行自己的 `pi-session/*.jsonl` ✓）第 7 行里有 `no acceptance criteria are frozen` ✓，
`[PERSONAL AGENT REQUEST GUIDANCE]` 标记也在 ✓ —— 第十二次读数做的那个机制**在真跑里成立** ✓✓。

**而模型仍然没有冻结** ✗✓：6 轮 provider 全部成功（13.4 / 12.5 / 16.8 / 24.6 / 94.5 s ✓，全 `tool_call` ✓），
工具只有 `bash` / `read` ✓，还试了一次 `fetch_content` ✓ —— **被沙箱门当场拒了** ✓（`gate.refused sandbox` ✓，与第五次同形 ✓）；
`agent_task_convergence` **一次都没调** ✗，`convergenceFileCount: 0` ✗。

⇒ **这次跑没有走到第一次产品变更** ✓（它 6 轮都在读 `tests/test_immutable.py` 与 `cachecontrol/controller.py` ✓），
所以**收束门从没开火** ✓，而**那次运行也不是门杀的** ✓ —— **关于那句话能否改变行为，这次既没证明有效也没证明无效** ✗✓。
**不写成达成** ✓。

## 🎯 第 2 片：**五天的"修好了"其实到不了** ✗✓✓（**本轮最实的一条** ✓）

死因是一条 **176.0 s** 的 provider 轮 ✓，`stopReason=error` ✓，归类 `terminal/unknown` ✓，**一次都没重试** ✓。
终态给出 `nextAction = "Inspect the provider error and adjust the request."` ✗ —— **账本里没有任何 provider error 文本** ✗✓。

**而这条伤口正是第三次读数写下理由、并"修好过"的那一条** ✓✗。诊断链，每一环都是量的、不是推的 ✓✓：

| # | 事实 | 怎么量的 |
|---|---|---|
| 1 | 那条记录是 `message_end` 写的，不是 `agent_end` 兜底写的 | `appendProviderRequestCompleted` 只有两个调用点（`:2573` / `:3095` ✓）；`usage` 是零值 token 对象而不是 `{httpStatus}` ✓ |
| 2 | 因此 `stopReason` 来自 `normalizeStopReason(宿主原值)` ✓ | `:3083` ✓ |
| 3 | 所以宿主原值属于失败集（`error`/`failed`/`failure`）✓，**不是 `aborted`** ✗ | `model-gateway.ts:62` ✓ |
| 4 | `aborted` 被归一化成 **`cancelled`** ✗ | `model-gateway.ts:61` ✓ |
| 5 | 两个调用点**只在归一化结果为 `error` 时**才分类 ✓ | `:2429` ✓ `:3091` ✓ |
| 6 | ⇒ `stopReason === "aborted"` 那条比较**永远不成立** ✗✓✓ | 由 3+5 直接推出 ✓ |
| 7 | ⇒ 这条改动**读起来像控制，实际没人走到** ✗✓✓ | 正是 AGENTS.md 规则表在治的那一类 ✓ |

**而且第 7 条被函数自己的输出证实** ✓✓（改之前跑真函数 ✓）：

```text
{"stopReason":"error"}                                  -> {"kind":"terminal","reason":"unknown"}   ← 与账本逐字相同
{"stopReason":"failed"}                                 -> {"kind":"terminal","reason":"unknown"}
{"stopReason":"aborted","errorMessage":"terminated"}     -> {"kind":"transient","reason":"reviewed-provider-message"}
{"stopReason":"error","errorMessage":"HTTP 502"}         -> {"kind":"transient","reason":"http_502"}
```

**第一行给出的两个字段就是账本里的那两个** ✓✓ —— **诊断是函数的输出，不是关于它的推断** ✓。

**形状一句话** ✓：**同一件事，看宿主用哪个词，读出来就不同** ✓ —— `error` 读作终态、不可重试、且指去查一条不存在的错误 ✓；
`aborted` 读作瞬时 ✓。

## 第 3 片：改法与它会改变的行为 ✓✓（**写清楚是为了可被有意改回** ✓）

规则改成读**整个失败集**（`aborted`/`error`/`failed`/`failure` ✓），**仍然放在文本规则之后** ✓ ——
说了 `429`、`Connection error.`、`aborted by the user` 的消息在上面就被分掉了 ✓，到不了这里 ✓。

**改变了什么行为** ✗✓：一次只有失败集裸标记的 provider 轮，现在算瞬时、会被重试，而不是当场结束请求 ✓。
**有界且 fail-closed，两道守卫都没动** ✓✓：
`retryDecision`（`request-lifecycle.ts:295-300` ✓）只在 `attemptCount < maxAttempts` 时重试 ✓，到限时的终态是
`provider-attempt-limit` + `retryable: true` + 一条能照做的 nextAction ✓；
非幂等 effect 守卫（`extension.ts:2626-2627` ✓）**与分类无关**地拒绝重放 ✓，所以这不让已发生的 effect 变成可重放 ✓。

**用例先见红，且红在正是账本那个值上** ✓✓：
`actual: {kind:'terminal', reason:'unknown'}` vs `expected: {kind:'transient', reason:'reviewed-provider-message'}` ✓。
改后绿 ✓，typecheck 0 ✓。**已登记进 `AGENTS.md` 规则表** ✓。

**而"会重试"这句话不能只用散文说** ✓✓ —— 那条用例量的是**分类** ✓，而改动真正宣称的是**行为**（会重试而不是结束请求 ✓）。
所以补了第二条用例，把**真跑那个形状**（`stopReason: "error"`、**没有任何 message 文本** ✓）**走一遍真实处理器路径** ✓：
`before_agent_start` → `agent_start` → `before_provider_request` → `message_end` → `agent_end` ✓，然后读账本 ✓，断言整条链 ✓：

| 断言 | 看住什么 |
|---|---|
| `provider.request.completed.failureKind === "transient"` | 分类改了 ✓（旧规则下红：`actual: 'terminal'` ✓） |
| `failureReason === "reviewed-provider-message"` | 由读宿主标记的那条规则命名 ✓ |
| `request.attempt.completed.outcome === "transient-failure"` | **重试真的发生了** ✓✓（这是承诺的那一条 ✓） |
| 没有 `request.terminal` | 重试的尝试不写终态 ✓ |
| `abort` 调用次数 = 0 | 它不再中止请求 ✓（旧的终态会中止 ✓） |

**旧规则下它红在第一条断言上** ✓✓（`actual: 'terminal'` vs `expected: 'transient'` ✓）——
即**这条用例量的是同一条链，而不是另写一遍散文** ✓。

## 第 4 片：这一轮自己付的税 ✓✗（**第三次** ✓）

改动落在所有 mount 点**之上** ✓ ⇒ **18 行 mount 表整体 +12** ✓，
**`cites the declaration each mount-point row names` 当场红** ✓✓ —— **这个门第三次为同一件事存在** ✓（第一次是 `:296` 附近那 10 行 ✓，
第二次是第十二次读数那 16 行 ✓）。整页按实测位移 ✓，并把区间 `:2179`-`:3560` 一起改准 ✓。

**而顺带量出一处不是位移、是*本来就不对*的引用** ✗✓：§3 那句"读参数的那一半"引的是 `:2797`-`:2801` ✓，
而那五行是**门块的结尾加大超时那几行** ✗ —— 真身是 `:2734` 的 `classifyInvocation({toolName, input, registry, recipes})` ✓，
即**真正读 `event.input` 的那一行** ✓。**已改成 `:2734`** ✓（并写进 `research/failed-stream-token.md` ✓）。

## 第 5 片：这一轮的判据 ✓✓

| 项 | 读数 |
|---|---|
| `npm run typecheck` | **0** ✓ |
| `npm test` | **976 / 976 pass / 0 fail** ✓✓（比上一轮 +2 = 两条新用例 ✓） |
| 新用例**先见红** | 是 ✓（actual 就是账本值 ✓） |
| `spec-anchors`（mount 表那条） | 绿 ✓ |
| 托管安装 | 已重装到 **`0.2.0+source.cbd52bea5c7b`** ✓（`previous` = 本轮之前那份 ✓ ⇒ 一步可退 ✓）—— 装的那份 `extension.ts` 现在**两条都在** ✓：`:287` 的 `FAILED_STREAM_STOP_REASONS` ✓ 与 `:3447` 的催促语 ✓ |
| 装的那份的活体检查（零 token ✓） | `--launcher dove-pi` 跑 `status-line-only`：`exitCode=0` ✓ `settled=true` ✓ `events=18` ✓ `toolNames=[]` ✓，状态行 `workMode=code-development` / `hashlineEditTools=present` / `hashline=active` ✓，与源那次**逐字同形** ✓ |

## 仍未达成的 ✗✓（**不粉饰** ✓）

- **AC#2 仍不成立** ✗✓：这次跑连第一次产品变更都没走到 ✓，死于一条 176 秒的流 ✓。**死因第 5 个形状** ✓
  （25 min 到点 ✗ / 9.5 min provider 终止 ✗ / 22 s 后无限挂死 ✗ / 27.8 min 瞬时预算用尽 ✗ / **176 s 的流被读成 unknown** ✗✓）。
- **那句话能否改变模型行为仍未验证** ✗（第 1 片 ✓）。
- **笔记里两个改策略的选项 (a)/(b) 仍原样开着** ✗✓。

---

# 读数（第十五次：**第十一次真跑 —— 活第一次干成了，而第一道门拦的是"测量"**）（2026-10-11 ✓✓✓）

**这一轮按预注册跑** ✓（判据先写成文件、先提交，再开跑 ✓，见 `research/run-11-preregistration.md` ✓）。

## 第 0 片：这次运行（§4 格式 ✓）

```text
scenario=immutable-directive-work-as-a-task  provider=ant  endpoint=https://api.atria-asi.ai/v1/  model=Atria-Dawn-Preview  date=2026-10-11
launcher=source  providerMode=real  carriedConfig=[settings.json, models.json, auth.json, npm/]
exitCode=0  settled=true  harnessTimedOut=false  scenarioFailed=true  events=8668  duration=20.5 min（上限给的是 45.0 min）
terminal: reason=failed  detail=attempt-limit  code=provider-attempt-limit  retryable=true  origin=provider
         nextAction="Check provider availability, then submit the request again."
resources(账本): toolCalls=25  providerRounds=26  toolDurationMs=193599  stopReasons=22×tool_call + 3×error
tokens: input=1,029,836  output=12,235  reasoning=9,397
artifactEvidence {doveState:true, doveFileCount:8, formalTaskCount:1, formalArtifactCount:7, convergenceFileCount=1}
dialogs: approved=0 declined=0 answered=0 cancelled=0 defaulted=0 mismatch=0 unused=0
steps: 0 settled=true(2223 ev, bash/read) · 1 failed=true(6440 ev, replace/agent_*/bash/read) · 2 与 3 **一次都没发**
```

## 🎯 第 1 片：**判分第一次绿** ✓✓✓

**跑运行自己的副本** ✓（runner 拷出来那份 ✓，不是原件 ✓）：

```text
116 passed in 2.34s        ← 基线：1 failed, 115 passed
```

**目标从红变绿，且一条都没弄坏** ✓✓✓。**而且判分仪器字节未变** ✓✓：
`tests/test_immutable.py` **1305 B** ✓ · `tests/conftest.py` **5971 B** ✓（与配方逐字节相同 ✓）；
改的只有 `cachecontrol/controller.py` **20090 → 21039 B** ✓。**这是十一次跑里第一次把活干成** ✓✓。
（这同时满足 **R4/AC 的"项目自己的套件给出结果"** ✓ 与 §5 的"判分只在项目自己的套件里" ✓。）

## 🎯 第 2 片：**第一道门拦下的不是变更，是跑测试** ✗✓✓✓（**本轮最重的一条** ✓）

按 `toolCallId` 把账本与被拦的那次调用对齐 ✓✓：

```text
chatcmpl-tool-a2305208788ac36e  bash  python -m pytest tests/test_immutable.py -q 2>&1 | tail -20
→ task.convergence.decision  {eventKind:"product_mutation.blocked", state:"missing", snapshotRevision:0, acceptanceRevision:"unknown"}
→ request.terminal           {reason:"failed", detail:"convergence-missing"}
```

⇒ **门把"跑项目自己的测试"读成了产品变更** ✗✓✓，**并在模型做第一件事的时候结束了那个请求** ✗。

**根因量到了行** ✓✓：`src/core/invocation-disposition.ts:112` 的 `READ_ONLY_SHELL_SEGMENT` 是**闭集文法** ✓，
里面**有 `go (test|vet|list|version|env)`** ✓，**没有任何 Python 条目** ✗✓✓。实测（改之前 ✓）：

```text
true   go test ./... 2>&1 | tail -20
false  python -m pytest tests/test_immutable.py -q 2>&1 | tail -20
false  python -m pytest -q
false  pytest -q
false  npm test
```

⇒ **同一种命令，Go 放行、Python 拒绝** ✗✓ —— 而**这个被判分的项目是 Python** ✓。
**这不是保守，是任意** ✓：文法自己的文档写着要放行"read-only inspection and **verification** commands" ✓，
`go test` 就是为这个进去的 ✓ ⇒ **Python 的缺席违背它自己的意图** ✓✓。

**这一条改写了本任务的中心叙事** ✗✓✓：此前第五、六、九次读数把 `product_mutation.blocked` 读成
"**模型在冻结之前就改了产品文件**" ✗ —— 而这一次能对齐，被拦的是**测量** ✓。
即：**模型没有在改文件，它在看测试怎么失败** ✓，而那正是验收标准要被读出来的那一步 ✓。

**改法与判据** ✓✓：文法补上 Python 测试运行器（`python -m pytest` / `python3 -m unittest` / 裸 `pytest` ✓），
**只放行测试运行器** ✓ —— `-m` 点名模块且集合封闭 ✓，所以 `python -m http.server` 与 `python -c "…"` **仍是变更** ✓；
`npm test` **故意不在内** ✓（npm 脚本是任意的 ✓）。用例**先见红** ✓，并把 Go 那条一起断言 ✓（**是对等，不是新许可** ✓）。
**代价：零 mount 表位移** ✓（改动在 `src/core/`，不在 `extension.ts` ✓）。

## 第 3 片：**模型冻结了** ✓✓（**十一次跑里第一次** ✓）

```text
task.convergence.decision  {eventKind:"freeze", state:"working"}
project/.dove/tasks/goal-c09ec8b9-…/convergence.json   ← 真的写出来了 ✓
```

**而且它是在产品编辑之前冻的** ✓✓：会话里 `replace cachecontrol/controller.py` ×2 **出现在冻结之后** ✓。

**而它是自己摸索出来的** ✗✓✓：三次调用、两次被拒 ✓（见下），然后才成功。三次的原文：

| 模型传的 | 工具回的 |
|---|---|
| `operation:"freeze"` + 3 条很好的判据 + **`task`: 一段散文** | `Task convergence requires the current native formal task.` |
| `operation:"start"` | 一串裸 schema 校验失败 |
| `operation:"freeze"`（同样带散文 `task`） | 同一条报错 |

**根因量到了行** ✓✓：`extension.ts:1767-1768` —— 非空的 `task` 被当成**选择器** ✓（`resolveTask(散文)` → undefined ✓），
而**两个不同的原因共用一条消息** ✗✓；且 `task` 参数在同样有描述的邻居之间**是唯一没有描述的** ✗（`:1740` ✓）。
⇒ **模型不知道该改哪个参数** ✓ —— 于是它 **`grep -rn "requires the current native formal task" "C:/…/DovePi/"`** ✓，
**对整份托管安装做递归 grep（含 361 MB 的 `node_modules`）** ✗✓✓，而**该命令不在超时白名单里**（`timeoutApplied:false` ✓），
**运行在那里停了 1.5–4 分钟**（两次探针之间的窗口 ✓，不是精确值 ✓）。

**改法与判据** ✓✓：`task` 现在**有描述**（"a task selector … the stableId agent_project_task printed …" ✓）；
拒绝**点名参数** ✓、**引回它收到的值**（截到 120 字符 ✓，因为被误读的值可以是一段话 ✓）、并**说该传什么** ✓；
"选到了但不是原生正式任务"单独一条 ✓，所以两个方向都不会说错 ✓。用例**先见红** ✓（红在缺少描述 ✓），
**并且带一个对照**：不带选择器的那次调用成功冻结 ✓ ⇒ **是选择器的问题，不是冻结本身的问题** ✓。

## 第 4 片：**预注册自己的两处缺陷** ✗✓✓（**规划也是被测的东西** ✓）

预注册是我写的，而**有一行差点让我把重试读成"修复生效了"** ✗✓：

| 候选 | 实测 | 说明 |
|---|---|---|
| 那两轮 `error`（28 ms / 7 ms）后面跟着成功的一轮 | 一度被我读成**修复生效** ✗ | **查了会话才发现**：它们带 `errorMessage:"Connection error."` ✓，命中 `:293` 的**文本规则** ✓ ⇒ **旧规则下同样判瞬时** ✗ |

⇒ **Claim B 的判据行写得不够** ✗✓✓：`failureKind: transient` + 后面还有一轮 ✓ **区分不出是哪条规则产生的** ✓。
**本次运行里三个 `error` 全部带 `Connection error.`** ✓（会话原文 ✓）⇒ **Claim B 又一次没被量到** ✗✓。
**这是关于这个 endpoint 的读数** ✓：它总是带那条文本，所以**跨行标记那条修复在这条通道上不会被走到** ✗✓。

**Claim A 的判据行同样太宽** ✗✓：它把 `product_mutation.blocked / state: missing` 读作"在冻结之前改了产品文件" ✓，
**而门把 shell 命令也判成变更** ✓ ⇒ **那一行可以为一个测量而开火** ✓。第 2 片的对齐就是它的反例 ✓。

**教训一句话** ✓✓：**判据要能认出"是谁产生的这个值"** ✓，而不只是"这个值出现了" ✓。

## 第 5 片：逐条判（预注册的判据表 ✓）

| 预注册的可观测 | 实测 | 判 |
|---|---|---|
| `convergence.json` 存在 / `state` 不是 `missing` | 存在 ✓，`freeze / state=working` ✓ | **冻结了** ✓ |
| `product_mutation.blocked / state: missing` | 开火了 ✓，**但对象是 `python -m pytest`** ✓ | **这一行没说出它以为的那件事** ✗✓ |
| `request.terminal detail: convergence-missing` | 13:38 出现过一次 ✓ | 门结束过一个请求 ✓ |
| 一次变更工具都没有 | 有 `replace` ×2 ✓，**在冻结之后** ✓ | 模型走到了岔路口 ✓ |
| `failureKind: transient` + 后面还有一轮 | 两次 ✓，**但都来自文本规则** ✓ | **Claim B 未量到** ✗ |
| `failureKind: terminal / unknown` | **没出现** ✓ | — |
| `request.terminal detail: attempt-limit` | **就是它** ✓ `retryable=true` ✓ | 有界重试用尽后停下 ✓（**设计行为** ✓） |

## 第 6 片：AC 逐条 ✓✗（**不粉饰** ✓）

| AC | 判 |
|---|---|
| mode 生效 / 工具面进读数 | **成立** ✓（与前几轮同 ✓） |
| 项目自己的套件给出结果 | **成立，而且是绿的** ✓✓（`116 passed` ✓） |
| 账本累计量与判分并列 | **成立** ✓（第 0 片全部数自事件流 ✓） |
| **一条运行里走完整个流程** | **仍不成立** ✗✓✓：step 0 **settled** ✓、step 1 **failed** ✗（`attempt-limit` ✓）、**step 2/3 一次都没发** ✗；任务终态 `status=active phase=intake` ✗ ⇒ **finish/archive 未到达** ✗ |

**六个死因** ✓✓（25 min 到点 ✗ / 9.5 min provider 终止 ✗ / 22 s 后无限挂死 ✗ / 27.8 min 瞬时预算用尽 ✗ /
176 s 的流被读成 unknown ✗ / **20.5 min 瞬时预算用尽，而活已经干完** ✗✓）——
**而这一次与前五次不同** ✓：**工作成功、冻结成功、终态如实** ✓，缺的只是把收尾那几步跑完 ✓。

## 第 7 片：本轮改的与代价 ✓✓

| 项 | 读数 |
|---|---|
| `npm run typecheck` | **0** ✓ |
| `npm test` | **978 / 978 pass / 0 fail** ✓✓（+2 = 两条新用例 ✓） |
| 两处修复的用例**先见红** | 是 ✓（选择器那条红在缺描述 ✓；文法那条红在第一条 Python 断言 ✓） |
| mount 表税 | **零** ✓（选择器修复付过一次 +18 ✓，文法修复在 `src/core/` 不付 ✓） |
| 托管安装 | 仍是 `0.2.0+source.cbd52bea5c7b` ✓，**不含本轮三处修复** ✗（要再装一次 ✓） |

## 仍未达成的 ✗✓

- **AC#2 仍不成立** ✗✓，但**第一次**：活干成了、验收冻结了、终态如实 ✓ ⇒ 剩下的**只是收尾那几步** ✓。
- **Claim B（裸标记重试）两次真跑都没被走到** ✗✓（这个 endpoint 总是带文本 ✓）—— 它现在只有用例看着 ✓。
- **两个改策略的选项 (a)/(b) 仍原样开着** ✗✓。
- **下一步最有价值的一件** ✓：**再跑一次** —— 文法修复之后，门不会再为"跑测试"开火 ✓，
  step 0 应当能在同一个请求里读完、冻结、改完 ✓，step 1 的收尾序列才有可能跑到 archive ✓。



