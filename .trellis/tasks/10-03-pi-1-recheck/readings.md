# 读数：S1b / S1c（2026-10-03 本机实测）

## S1b —— adapter 对宿主的依赖面：**"反转成本 = 一个 adapter 实现"成立** ✓

`src/adapters/loop-pi-agent-core.ts` 的**全部**宿主依赖，就是它的文件头两条 import ✓：

- `@earendil-works/pi-agent-core`：**5 个具名符号** ✓ —— 其中**值只有 1 个**（`Agent` ✓），类型 4 个（`AgentMessage` / `AgentTool` / `BeforeToolCallResult` / `StreamFn` ✓）；
- `@earendil-works/pi-ai`：**2 个类型**（`Api` / `Model` ✓）。

**实际触碰的成员路径：2 个** ✓ —— `agent.prompt` ✓、`agent.state` ✓（全文取 `(agent|harness|session|pi)\.[A-Za-z_]+` 去重后仅此两个 ✓）。

**对照组** ✓：`src/adapters/loop-scripted.ts` **只**从 `../core/loop.ts` 取类型 ✓ —— **对宿主零依赖** ✓✓。这证明 `AgentLoop` 这层**接口本身**与宿主无关 ✓，不是"两个实现都碰宿主、只是碰得少" ✗。

**判定** ✓（AC-4 ✓）：1.0 若要动这 **7 个符号**或 **2 个成员** ✓，代价 = **重写这一个 adapter** ✓ —— 裁决那句话**成立** ✓，且现在有了**可核的量** ✓（此前它只有断言 ✓）。

**未做** ✗：**没有**验 1.0 是否**真的**动了它们 ✓ —— 外部检索不可用 ✓（`HTTP 401` ✓）→ 本次是**盲审计** ✓：识别"什么会破" ✓，不猜"什么破了" ✗。若你给 1.0 的 release 要点 ✓，这一条立刻可从"风险面"升级为"判定" ✓。

## S1c-1 —— `AgentHarness` **仍是 stub** ✓

`node_modules/@earendil-works/pi-agent-core/dist/harness/agent-harness.js`：`HarnessNotImplemented` **存在，且在被抛的路径上** ✓：
`throw this.isClosed() ? new HarnessClosed() : new HarnessNotImplemented(this.operation);` ✓

**判定** ✓：裁决里"将来是**替换**而非重写 Dove 的同类机制"**仍成立** ✓。

## S1c-2 —— `host-version.ts` 的失败行为是**沉默** ✗

`getPiVersion()` 返回 `string` ✓；**任意**失败路径都退化成 `"unknown"` ✓：
- 找不到 `package.json`（`:14` ✓）→ `require(...).VERSION ?? "unknown"`（`:15` ✓）；
- `require` 抛 / JSON 坏 / 无 `version` 字段（`:16-18` ✓）→ `"unknown"` ✓。

**不拒绝 ✓、不告警 ✓、不记录 ✗** —— 调用方拿到的只是一个**看起来正常的字符串** ✓。

**判定（**临时** ✓）**：这正是本仓清过两遍的缺陷类 —— "**看起来是控制，其实什么都没控制**" ✗✓ → **倾向「需改」** ✓。

**为什么是临时** ✗：它的**严重性取决于调用点** ✓ —— 谁读 `getPiVersion()` ✓、读不到时**会发生什么** ✗（拒绝 ✓ / 降级 ✓ / 当正常值继续 ✓），**尚未量** ✗ → 归入 **S1（宿主表面清单）** ✓，不在这里下结论 ✓。
