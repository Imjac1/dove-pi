# 规划：让模型在**第一次产品变更之前**就知道有个正式任务要冻结（未完，待裁决）

## 这条线索是怎么来的 ✓（已量，非推断）

第九次真跑（`…-i`，本会话最远 ✓）的账本按追加顺序读出来：

```text
#3..#19   5 轮 provider 全部成功（15s / 17s / 7s / 11s / 70s，stop 全是 tool_call ✓）
#20       tool.started read          ← 模型最后一次动作
#21       task.convergence.decision  product_mutation.blocked / state=missing
#22       request.terminal           detail=convergence-missing  abort=True
```

而该请求里模型调过的工具只有 **`bash` ×2、`read` ×4、`grep` ×1** ✓ —— **它从未调用 `agent_project_task`，也从未调用 `agent_task_convergence`** ✓。
原因不是接线：`agent_task_convergence` **确实在发给模型的工具表里** ✓（会话里 100 KB 的 tools 数组、15 个 `agent_*` 全在 ✓，见 `readings.md` 第十一次 ✓）。

⇒ **正式任务是 intake 自己默默开出来的** ✓（`src/pi-adapter/extension.ts:3301`：`requestPlan.lane === "formal"` ⇒ `ensureFormalTask(...)` ✓），
**模型不知道它存在** ✓ —— 于是它按"读代码 → 改文件"的常规做法走，第一次改就被门终止 ✓✓。

## 为什么这算"可以不动策略的改法" ✓

现在这条要求只出现在两个地方 ✓：
1. **工具指南**（`extension.ts:1546-1549` ✓，从一次真跑量出来后写的 ✓）：只有在模型"考虑调这个工具"时才会读到 ✗；
2. **场景第 0 步的 prompt**（用户自己的话 ✓）：是这个测试夹具作者写的 ✓，不是产品机制 ✗。

而 Dove 有一条**每个请求都必然携带**的通道 ✓：provider 请求记录里
`cachePrefix.doveContext.bytes: 3708` ✓ —— **每次调用都在** ✓✓（`cache-prefix.ts` 把"Dove 自己写的那些消息"单列为一类 ✓）。
把"已开正式任务 / 先冻结"放进那条通道 ✓，**不需要**改门的策略（`missing ⇒ terminate` ✗ 保持原样 ✓）、
**不需要**新增机制（通道已在 ✓）、也**不改变"判据由谁写"**（仍是模型推导 ✓）。

## 边界（第一步是找，而不是改 ✗）

1. **先找**那条通道的**组装点** ✗ —— 只找到了一半 ✓：
   - **已定位** ✓：`src/pi-adapter/prompt-policy.ts:61` 组装的 **`[DOVE MODE INSTRUCTIONS id=… trust=authoritative]`** 块 ✓，
     它进的是**系统提示**（provider 记录里 `system.bytes: 8280` ✓，每次都在 ✓）；但它是**模式自己写的话** ✗ ——
     而"先冻结"是 **harness 的规则**，不属于任何模式 ✓，所以它不该塞进模式块 ✗。
   - **未定位** ✗：`doveContext`（3,708 B ✓，`cache-prefix.ts` 里单列为一类 ✓）—— **它才是"Dove 自己写的话"那条通道** ✓，
     而我**没找到把哪些文本拼进去的那处** ✗（`cache-prefix.ts` 不在 `src/pi-adapter/` 下 ✓，本轮上下文预算不足 ✓）。
   **没找到之前不动手** ✗。
2. 找到后：在该块里加一句**由事实驱动**的话 ✓（只在"本请求开了正式任务且尚无冻结快照"时出现 ✓，否则不出现 ✗ ——
   一句永远在的话会变成噪声 ✓）。
3. 用例：一条**看住那句话出现/不出现的条件** ✓（这是"规则要有机制"的那一半 ✓）。
4. 判据：下一次真跑里，账本在**第一次 `tool.started` 写工具之前**就应出现冻结 ✓（或至少在 `#21` 之前 ✓）。

## 另一个仍待你裁决的选项 ✓（上轮已提，未答）

**(a) 对 `state: missing` 不终止** ✗ —— 放宽 fail-closed（`extension.ts:2777-2780` ✓）。**改策略，我不擅自做** ✗。
**(b) intake 就地把请求者那句话冻成判据** ✓ —— 改产品行为（判据多一个"harness 转写"的来源 ✓）。**同样待你定** ✗。
