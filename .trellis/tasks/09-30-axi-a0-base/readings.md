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

## A0.2 Windows 隔离原语 —— ⏳ 未做（下一步）

## A0.1 DSH 隔离可用性 —— ⏳ 等用户起 `workspace-write` 会话
