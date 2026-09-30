# A0 读数

判据与决策表见 `prd.md` / `design.md`。**失败、未完成、以及自我纠正都写在这里。**

---

## A0.4 thin loop 复核 —— ✅ 通过（且结论比预期强）

**判据**：给出 `Agent` 拦截能力与 `AgentHarness` 状态的当前读数，附实测方式。

### 结论

1. **接口已经存在，不必重建。** `src/core/loop.ts` 定义了完整的接口面：`AgentLoop`、`ActionGate`、`SynchronousActionGate`、`GateInvocation`、`GateDecision`、`LoopOutcome`、`LoopProvider`、`LoopState`、`normalizeGateDecision`。

2. **已有两个实现，且都被**刻意**挡在生产之外。**
   - `src/adapters/loop-pi-agent-core.ts`（7,858 B）——Pi 的 thin `Agent`；
   - `src/adapters/loop-scripted.ts`——参考 loop。
   - `tests/harness-reachability.test.ts:88-89` 把两者登记为 *"a reference adapter for a loop the host owns; reachable only from the island below"*、`wiredBy: null`。

   → **这是 A1 的实质变化**：A1 不是"定义 `AgentLoop` 接口"，而是"**把既有接口与适配器提升为 axi 的生产 loop**"（属 §2.5 复用清单）。

3. **闸门确实拦得住，而且有已提交的测试断言**（不是靠注释）。`tests/loop-gate.test.ts`：
   - `executedActions === 0`，注释 *"a blocking gate must prevent the tool from running"* ← 即此前记录的 `toolExecuted 1 → 0`
   - `blockedActions.length === 1`，`blockedActions[0].tool === "write_file"`
   - *"an unevaluable action is never allowed"*（gate 抛错 → 拦）
   - *"unrecognised decision"* → 拦；*"an action awaiting consent must not run"*（`ask` → 拦，不是放行）

4. **`AgentHarness` 不是 stub——我此前的记录错了。** `node_modules/@earendil-works/pi-agent-core/dist/harness/` 是**实装**：`agent-harness.js`(7.9 KB)、`reducer.js`(19.5 KB)、`skills.js`(13.2 KB)、`compaction/compaction.js`(23.2 KB)、`env/nodejs.js`(22.9 KB)、`session/**`（state / jsonl repo+storage）、`tools/{read,write,edit,bash,edit-diff}.js`，外加一个 **43 KB 的 `session/testing/conformance.js`**。

5. **`HarnessTool.replay` 确实存在**：`dist/harness/agent-harness.d.ts:313` → `replay?: "never" | "safe";`。
   → `src/core/invocation-disposition.ts:19` 那句注释（*"`replaySafe` is named after what `pi-agent-core` calls it"*）**是有依据的**；**我此前怀疑它过度声称，那个怀疑本身不成立。**（这条自我纠正如实留档。）

6. **包清单**：`@earendil-works/pi-agent-core`、`pi-ai`、`pi-coding-agent`、`pi-telemetry`、`pi-tui` —— 与语料对 Pi 的三层划分一致（model `pi-ai` / runtime `pi-agent-core` / harness `pi-coding-agent` + `pi-tui`）。

### 对方案的影响

- **A1 修订**：R1 由"定义接口"改为"**把既有 `src/core/loop.ts` 与 `src/adapters/*` 提升为生产 loop**"。迁移判据不变（每个复用模块至少一条测试通过）。
- **A3 的一个新事实**：Pi 适配器**没有自己的 dispatch 行**可承接效果声明——文件注释自述 `refusedEffects` 是空的，*"because nothing is claimed here — not because nothing was refused"*，并且它自己已在注释里纠正过一次过度声称。
  → **at-most-once 派发只能落在参考 loop 与宿主身上，不能落在这个适配器上**；A3 的"执行回执"必须由**执行层**给。

---

## A0.3 确认"没有机制级先例" —— ✅ 结论：**没有**

**判据**：给出有/无的结论 + 依据来源。

**结论：在被测的生产 harness 里，没有任何一个用机制做到 trace 完整性；最接近的那个用的是提示词。**

依据（`2609.30266`，本会话逐字核对）：

- *"All tested harnesses, except Muse Code, allowed agents to delete their traces when asked, without triggering monitor guardrails."*
- **Muse Code 的机制**：*"This was due to Muse Code having a **built-in skill** that reminds the agent that the traces cannot be tampered with under any circumstances."* —— **内置 skill 提醒 = 提示词档**，不是机制强制。
- 论文对从业者的建议本身说明它不是既存实践：*"We advise practitioners to ensure trace logging happens through an **independent interception mechanism outside of the agent's control**."*
- 两条相关技术路线都在**研究原型**里，不在生产 harness 里：Agent Flight Recorder（`2609.01931`）、VET（`2512.15892`）。

**后果**（照 `design.md` 的决策表）：**A3 是原创部分**——风险最高，也最值钱。

---

## A0.2 Windows 隔离原语 —— ⏳ 做了一半（机制已证，安全边界未证）

### 已测（第二次探测，有效）

| 步骤 | 读数 |
|---|---|
| 基线（无 deny） | 当前进程写**成功**（`base.txt: True`） |
| 目标目录打 `deny(W)`（对本身份） | 当前进程写**被拒**：*"对路径 … 的访问被拒绝"* |
| 同上，**独立子进程**（`cmd.exe`）尝试写 | **也被拒**（stderr `Access is denied.`），`from-cmd.txt: False` |
| 摘掉 deny 后，**同一身份**再写 | **成功**（`after-undo.txt: True`） |

### 结论 1（✅ 判据 1 的弱形式成立）

**一个 deny ACE 能挡住另一个进程的写，且不依赖该进程配合。**

### 结论 2（❌ 但它不是安全边界——重要修正）

**同一个被拒绝的身份可以自己摘掉那条 deny，然后照写。** 所以 ACL 只有在**受限进程不具备 `WRITE_DAC` / 所有权**时才构成边界。

→ **对方案的修正**：语料记录的"**Windows 隔离 = Job Objects**"说法**不够准确**。**Job Objects 本身不限制文件系统写**——它限制进程与资源，并能把一个**安全令牌**施加到 job 内的进程上。文件系统那一半来自 **ACL + 令牌**；**Job Object 的角色是绑定进程集合并施加令牌**。A2/A3 与总览里的措辞按此修正。

### 已测（第三次探测：受限令牌，有效）

环境事实：**Windows PowerShell 5.1**（不是 pwsh 7）、**标准用户、Medium 完整性、未提升**。令牌特权只有六项（`SeChangeNotify` 启用），**没有** `SeAssignPrimaryToken` / `SeIncreaseQuota` / `SeImpersonate` / `SeTcb`。

| 调用 | 读数 |
|---|---|
| `OpenProcessToken(当前进程, TOKEN_ALL_ACCESS)` | **OK** |
| `CreateRestrictedToken(..., DISABLE_MAX_PRIVILEGE)` | **OK** —— 这个调用本身不需要特权 |
| **`CreateProcessAsUser(受限令牌, "cmd /c echo x > 目标")`** | **返回 True，错误码 0**；**受限进程写出的文件存在** |
| `CreateProcessWithTokenW(自己的非受限令牌, …)` | **返回 False，错误码 1314**（缺少所需特权） |

### 结论 3（✅ 判据 1 的强形式成立：**非提升会话也能起受限进程**）

**`CreateProcessAsUser` 在我们的受限令牌上成功了，而那两条 API 的差别正是文档所描述的**：当令牌是**调用方自己主令牌的受限版本**时，**不需要 `SeAssignPrimaryTokenPrivilege`**；而 `CreateProcessWithTokenW` 需要 `SeImpersonatePrivilege`（我们没有 → 1314）。

→ 这条很重要：**axi 在 Windows 上的隔离不必要求提升权限**。它推翻了我此前基于特权清单的推断（我原先预期 1314）。

### 但有一个必须说清的限度（⚠️）

本次用的受限令牌**只带了 `DISABLE_MAX_PRIVILEGE`**——它只剥特权，**不限制文件访问**；而这个令牌本来就没有特权可剥。所以**"能起受限进程"不等于"写不进目标树"**：文件系统那一半仍要由 **ACL** 给，而 §结论 2 已证明**同一身份可以把自己打上的 deny 摘掉**。

**因此下一个探测是**：构造带**限制 SID（restricting SIDs）**的令牌，与"目标树 deny ACE"组合，检验
1. 受限进程**写不进**目标树；
2. 受限进程**摘不掉**那条 deny（这才是与结论 2 的区别）；
3. **判据 2**：受限进程在目标树**之外**仍能完成一件正常事务。

### 未测（更新）

- **限制 SID 的构造**与组合效果（下一个探测，是 A0.2 能否给出"真隔离"的最后一环）；
- `JOBOBJECT_SECURITY_LIMIT_INFORMATION` 能否把令牌施加到**整个 job**（需要 `SeTcb`，本令牌没有 → 预期失败，但要从实测取码，不从清单推断）；
- 第 2 条判据在**组合**场景下的表现。

### 二次自我纠正（同一实验里犯了两次同类错误，留档）

**第二次探测的 `err=203` 是我的测量坏了**：我把 `GetLastWin32Error()` 包在一个 PowerShell **函数**里，函数调用本身会破坏"紧邻 P/Invoke"的即时性，于是拿到的是无关的陈旧错误码。改成**紧邻取值**后，同一次调用返回的是 **True / 0**。

→ 教训与第一次同源：**测量仪器本身要先被验证**。两次错法不同（一次是进程没起来、一次是错误码取值不即时），**根因都是"从不可靠的中间量下结论"**。`design.md` 的风险清单预写了第一种，没有预写第二种——已补进清单。

### 一次自我纠正（留档）

**第一次探测无效。** 我用 `pwsh -NoProfile -Command` 起子进程，但 **`pwsh` 不在本机 PATH 上**（`CommandNotFoundException`），子进程根本没执行——于是"文件不存在"被我误读成"被挡住"。
**这正是 `design.md` 风险清单里预写的"假通过：进程根本没起来"**，风险清单抓住了它。重做时改用 `cmd.exe`（`C:\Windows\system32\cmd.exe`）并加了基线对照。
**环境事实记下：本机 PATH 上没有 `pwsh`** —— 将来新仓的脚本不要依赖它。

## A0.1 DSH 隔离可用性 —— ⏳ 等用户起 `workspace-write` 会话

测试脚本见 `a0.1-live-test.md`（自包含，另一个会话读它就能跑）。

**从插件文档取到的两条前置事实（可省掉一次踩坑）**：
- `workspace-write` 允许写**会话 workspace 之内** **或平台的临时根**。→ **用 `%TEMP%` 做"越界"测试是无效的**；测试脚本因此用 `%USERPROFILE%`。
- 被拒返回 **`FS_SANDBOX_DENIED`**，并带**当前模式**与**同回合升级提示**——即"升级为审批"这条路径是**设计里就有**的，与判据 1 的写法一致。

---

## A0.5 宿主与 loop 可替换性 —— ✅ 三条全部成立（结构层面）

**为什么要加这一条**：用户提出"如果 axi 基于 DSH，而会话不能自调用，会很麻烦"。我此前说"会话只能由桌面应用拉起"——**那是从"`dsh` 不在这个 shell 的 PATH 上"推出来的，推错了**。本会话第三次同类错误（前两次：预测 1314、`pwsh` 探测），根因相同：**从没被验证过的仪器下结论**。以下是实测。

### 结论 1：**自调用是设计里就有的**（✅）

- `dsh-headless/lib/startup.js` 是**可被宿主 import 的 Cordis 插件**，其上写着用法：
  `dsh --profile headless "<task>"` —— *"Answer one task, stream reasoning to stderr, print the final assistant message, and exit."*
  → **一次性、可脚本化的会话**，正是回路自调用需要的东西。
- `dsh-agent-loop` README：*"the public **`ctx.agents` API supports programmatic creation and resume**"*
  → 除了一次性调用，还有**程序化创建与恢复 agent** 的公开 API。
- `dsh-cmdline` / `dsh-headless` / `dsh-sdk-app` / `dsh-sdk-jsonrpc-server` / `dsh-api-gateway` **都没有 `bin`**，`main: lib/index.js` → 它们是**库**，由宿主 import。桌面应用（Electron：`%LOCALAPPDATA%\Programs\DeepSeek Harness`）只是**其中一个宿主**。

**准确的表述**：不是"DSH 不能自调用"，而是"**这个会话的 shell 里没有 `dsh` 启动器**"——是**路径/发现性问题，不是架构问题**。

### 结论 2：**loop 是被明确设计为可替换的**（✅）

- `dsh-base` 的装配**全部是 `- id: <名字>` + `name: <包>`** 的形式（读到的前 60 个 id 都是），而 `cordis.patch.yml` 的定义就是"**按 id 定位的覆盖、禁用、插入列表**"。
- `dsh-agent-loop` 被 `dsh-base` 与 `dsh-sdk-minimal` **当作"an explicit row"挂载** → 可被按 id 替换。
- 最有力的一条来自它自己的文档：*"**Choose a custom `Agent` implementation** only when the standard 'call model, run tools, repeat' lifecycle is insufficient."*
  → **axi 正是那个情形**：它需要代码内强制 + 确定性补救，标准生命周期不够。**DSH 的文档等于在说"那就换一个 `Agent`"。**

### 结论 3：**强制挂在工具层，不在 loop 里**——换 loop 不会掉沙箱（✅，这条最重要）

`dsh-fs-sandbox` README：*"The fence applies **per call**: **the tool layer resolves the calling session's mode and workspace root** into the same policy the bash runner receives, so the filesystem and shell families never confine to different roots."*

→ 强制由 **`ctx.fs` 后端 + bash/pwsh runner 在每次调用时**解析会话的 `ctx.sandboxPolicy` 得出，**位置在 loop 之下**。所以：
**换掉 agent loop，沙箱与政策仍然生效**；而且 fs 与 shell **不会各自界定到不同的根**（这一条正是 axi 的 A2 所需要的性质）。

### 对方案的影响（§3.1 要改）

| 维度 | 旧结论 | 实测后 |
|---|---|---|
| 谁提供 loop | axi 自己造 | axi 自己造，**但 DSH 明确支持替换 `Agent`**——这是**受支持的替换点，不是 fork** |
| 谁提供强制 | axi 自己写 | 两层：**DSH 的工具层沙箱**（代码内、每次调用、fs/shell 同根）+ **axi 自己的闸门**（语法感知、跨调用状态、补救） |
| 自调用 | 我误判为"不行" | **有**：`dsh --profile headless` 一次性调用 + `ctx.agents` 程序化创建/恢复 |
| DSH 的角色 | "开发环境；可选的强制宿主" | **脚手架 + 工具层强制**；axi 是**宿主**（import 无头/SDK 入口），并**用自己的 `Agent` 替换标准 loop** |

### 仍然要实测的三条（不能从文档断言）

1. **真的在一个非桌面进程里起来**（`dsh-headless` 的 `startup` 我读到的是源码，没跑过）；
2. **换掉 `Agent` 之后，端到端一次越界写仍被拒**（结论 3 是从文档推的，要测）；
3. **`ctx.sandboxPolicy` 由谁设定**——如果它可由 agent 所在的进程改，那么它就在 Plane A 里，而**"改动它会削弱边界"正是必须由 HITL 把守的那一类改动**（解剖 §3.5.3）。

**P/Invoke 与探测脚本**：`%TEMP%\axi-token-probe.cs`（A0.2 用，保留）。
