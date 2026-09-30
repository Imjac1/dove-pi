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

**已实测（从本会话的 PowerShell 里真的起了它）**：

- 启动器：`%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`
- 命令：`dsh --profile sdk --help` → **退出码 0**，输出：
  ```
  Usage: dsh --profile sdk [options]
  Serve DeepSeek Harness SDK clients over stdio JSON-RPC.
  Example:  dsh --profile sdk     serve one SDK runtime until its client disconnects
  ```
- → **`dsh` 是能从普通（非 Electron）进程启动的可执行入口**；**`--profile sdk` 是"在 stdio 上讲 JSON-RPC 的 SDK 运行时"** —— **这就是自调用与程序化驱动的接口**。axi 的回路可以自己 spawn 一个 `dsh` 并驱动它，**不再依赖"有人点开会话"**。
- 另有一条**安全相关的读数**（`dsh-sdk-minimal` 文档）：*"Its **danger-full-access** policy lets the shell modify any path available to the process, so **use it only with an isolated workspace**"* → **SDK 路线默认是"不设限"的**，边界必须由 profile 的策略**显式**给出，不能假定。

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

### 三条实测的现状

**① 非桌面进程能不能起 → ✅ 已实测**（见上：`dsh --profile sdk --help` 退出码 0）。

**② 换掉 `Agent` 后围栏是否还在 → ✅ 有代码级证据（不是文档推断，但不是运行时实测）**

- `dsh-fs-sandbox/index.js`：**`static inject = ["sandboxPolicy"]`**、`this.defaultMode = ctx.sandboxPolicy.defaultMode` → 围栏的**策略来源是注入**，而注入的是**策略服务**。
- `dsh-sandbox-policy`：*"the **single owner** of the [policy]"*；其 `invariant.js` 里 `const inject = ["invariants"]` 与 `{ inject: ["sessions"] }` → **有一条不变式把策略绑在会话上**。
- `dsh-agent-loop` 的注入里**没有 `sandboxPolicy`** → **loop 不在这条链上**。
- 文档：*"all enforcing capabilities use the same mode and workspace for a call"*。

→ **围栏绑在"会话 + 策略服务"，不绑在 agent loop**；换 loop 不改变策略来源。
**诚实标注**：这是**代码与文档级**证据，**不是**"换 loop 后跑了越界写"的运行时实测。要变成运行时读数，需要真的起一个会话并替换 `Agent` 后重跑一次越界写。

**③ 谁设定 `ctx.sandboxPolicy` → ✅ 答案已得，且它带一个必须记下的风险**

三处来源：
1. **部署默认**（profile 配置里的 `defaultPreset`；`dsh-permission-presets`：*"A deployment can configure named presets and a default for newly created sessions"*）；
2. **会话级切换**：*"each session can switch modes independently. **Session choices survive restart**"*；
3. **`/permission` 命令**：*"The `/permission` command reports or **changes the current preset**"*。

→ **风险（这条重要）**：策略的**归属点是 `ctx.sandboxPolicy`，而它可被会话内的命令改变**。因此：
- 它属于 **Plane A**（agent 所在的环境能影响它），**不属于 Plane B**；
- 而**"改动它会削弱边界"正是 §2.3 / 解剖 §3.5.3 要求 HITL 把守的那一类改动**；
- axi 若沿用这条链，**必须把"策略变更"当作受治改动**：独立批准 + 不依赖"让模型知道危险"。
- 另有两条旁证要一起记：*"sandbox execution and approval handling remain **separate enforcement mechanisms**"*（沙箱与审批是两套），以及 *"Before each model request, the model receives the effective policy and workspace"*（模型**被告知**策略——**那是提示词层，不算强制**）。

---

## A0.2 后半（受限令牌 + ACL）—— ✅ 三条判据全过（含一条"跑不起来"的失败配置）

**判据与三个未知**见 `design.md` 的"A0.2 后半"段。探针脚本：`%TEMP%\axi-a02b-restricted-token.ps1`（保留、可重跑；`-Mode restrict|denyonly`、`-RestrictSid`、`-JailSid`）。
**执行**：2026-09-30 19:49–19:53，非提升会话，探针树 `%USERPROFILE%\axi-a02b-probe\`（跑完已删）。

### 结论（三条判据；可用配置 = 限制 SID `{S-1-1-0}`（Everyone））

| 判据 | 读数 | 判定 |
|---|---|---|
| **3** 目标树之外仍能干活 | jail 写：退出码 **0**，`jail\from-child-jail.txt` 出现 | ✅ |
| **1** 写不进目标树 | planeB 写：退出码 **1**，`planeB\from-child-planeb.txt` **不存在** | ✅ |
| **2** 摘不掉限制 | 受限子进程执行 `icacls planeB /grant *S-1-5-32-545:(OI)(CI)M` → 退出码 **1**；随后再写仍失败；`planeB` 的 ACL 前后**逐字相同** | ✅ |

**正向对照（`design.md` 明确要求的那一步，防"假通过"）**：由**不受限的父进程**给 planeB 临时加上 `Everyone:M` 之后，**同一个受限子进程**这次写成功了（退出码 0，`planeB\positive.txt` 出现）；撤掉该 ACE 后，**同一个写操作再次失败**。
→ **"写不进"是 ACL 造成的，不是探针瞎了。** 没有这一步，`文件不存在` 与 `进程根本没有能力写任何东西` 无法区分。

**全程非提升**：`OpenProcessToken` → `CreateRestrictedToken` → `CreateProcessAsUser` 都在普通（非提升）会话里完成，与 A0.2 第三次探测的读数一致。

### 三个未知的答案

1. **限制 SID 列表建不建得起来 → 建得起来。** `CreateRestrictedToken(disable=[], restrict=[S-1-1-0]) = True err=0`；`GetTokenInformation(TokenRestrictedSids)` 读回并**解出 SID 文本**（见"仪器"段的布局说明）：配置 A 读出 `S-1-5-32-545`、配置 B 读出 `S-1-1-0`，与传入值一致。
2. **属主隐含的 DACL 写权限会不会绕过 → 不会（本配置下）。** 受限令牌里仍然带着本用户 SID（`S-1-5-21-…-1001`），而 planeB 的属主就是本用户；它**仍然改不动 planeB 的 DACL**（判据 2），ACL 前后逐字一致。
3. **受限进程还能不能跑 → 取决于限制 SID 取哪一个**（见下）。

### 一条失败配置（不能省）

| 配置 | 初始化（`cmd /c exit 7`） | 判据 3（jail 写） | 结论 |
|---|---|---|---|
| `restrict={S-1-5-32-545}`（BUILTIN\Users） | 退出码 **0xC0000022**（STATUS_ACCESS_DENIED） | 失败（jail 里连日志都写不出） | **不可用**：进程在**初始化阶段**就被拒 |
| `restrict={S-1-1-0}`（Everyone） | 退出码 **7**（正常执行） | 成功 | **可用** |

→ **可用的限制强度是"Everyone 那一档"，不是"Users 那一档"。** 成因未定（本轮没有继续诊断）；**按读数记录，不按推断写成"因为系统 DLL 只授 Everyone"**。

### 对方案的三条后果

1. **Plane B 成立，而且是 axi 自己的机制**：判分权威可以放在"改进者进程写不进、也摘不掉"的地方。用户关于"强制力归 axi 自己拥有"的裁决因此**有了实测支撑**，不再是设计断言；`design.md` 决策表按"三过"那一行走。
2. **边界是"ACL 不变量"，不只是"路径位置"**：受限进程保留 `Everyone` 能碰到的一切，因此 **Plane B 的每个路径都必须没有 `Everyone` 授予**（否则边界不成立），而 **Plane A / jail 必须显式授予 `Everyone`**（否则改进者连活都干不了）。这两条要写进规格，不能只写"Plane B 在 workspace 之外"。
3. **强度要说实话**：这条边界等于"把改进者降到 Everyone 档"。它挡得住"写 Plane B / 改 Plane B 的 ACL"，**挡不住**一切对 `Everyone` 开放的东西。**不得写成"OS 级沙箱"**——按 §纪律 4，声明必须与实测同强度。

### 仪器（三次自身缺陷 + 一处未解缺口，都留档）

- **缺陷 1（第一次运行）**：`RunChild … | Out-Null` 把函数的所有诊断**连同退出码**一起吞掉 → 那一轮"子进程什么都没写"读不出原因。改法：函数不返回值，调用处不加管道。
- **缺陷 2（第一次运行）**：`TokenRestrictedSids` 的缓冲区布局是**猜**的；`Marshal.PtrToStructure` 读出一个无效 Sid 指针，`ConvertSidToStringSid` 返回 `err=1337`（ERROR_INVALID_SID）。第二次改成"带指针解引用"的原始转储 → **AccessViolationException**（.NET 4+ 不可捕获）把整轮打死。
  **修法**：只读**已分配缓冲区之内**的字节，布局**从字节反推**：`{DWORD GroupCount; 16 字节/项的数组; SID 数据 inline}`，SID 载荷在 `8 + 16*GroupCount` 处。现在**全程不解引用任何指针**，读回稳定给出 SID 文本。
  → 教训与前两次同源：**仪器本身先被验证**——第一次是"猜布局"，第二次是"环境没确认"，第三次是"从特权清单推断"。
- **缺陷 3（第三轮）**：`@()` 空数组被 PowerShell 绑成 `null` → C# `NullReferenceException`。已加空值保护。
- **未解缺口（照记）**：受限子进程里，"同一条 cmd 行上**第二条**命令"的输出（`dir` / `whoami` / `icacls` 的 stdout）**没有落进日志**；同一写法在**不受限**的子进程里两条命令都能落（本机对照已跑）。第二条命令**确实执行了**（成功例子里它写的文件出现了）。成因未定，本轮不追。**判据 1/2 的证据不依赖这句话**（文件不存在 + 退出码 + 正向对照 + ACL 未变）。
- **刻意没做**：`-Mode denyonly`（`SidsToDisable` = 本用户 SID，即"丢掉用户身份、保留 Users/Everyone"）。它**严格弱于**已通过的配置，不可能改变本轮判定；等定生产形态时再跑，用来挑"最弱但够用"的限制。

**P/Invoke 与探测脚本**：`%TEMP%\axi-token-probe.cs`（A0.2 前半用，保留）、`%TEMP%\axi-a02b-restricted-token.ps1`（A0.2 后半用，保留、可重跑）。


