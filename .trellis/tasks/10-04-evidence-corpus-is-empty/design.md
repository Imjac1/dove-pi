# 设计：从账本挖出可下钻的语料

## 边界与命名（R1 的第一件事 ✓）

"corpus" 本仓三名同用 ✗ —— 本设计**不重命名已有导出** ✗（那会波及调用方 ✓），而是在规格里**给三者各一个名字** ✓✓：

| 名字 | 指什么 | 现在住在哪 |
|---|---|---|
| **缺口声明（corpus-coverage）** | *"这份语料**不**包含什么"* ✓（防空读被当成有效读 ✓） | `failure-reading.ts:113` 的 `corpus` 字段 ✓ |
| **摘要（corpus-summary）** | *"已记录的语料含有什么"，一段话* ✓ | `harness-corpus.ts` ✓ |
| **外部语料（external corpus）** | 论文里量到的行为分布 ✓（`2609.30217` 的 98%/88% ✓） | 引用出现在 `action-policy.ts:657` ✓ `argument-syntax.ts:5` ✓ |

**而缺的是第四样，也正是本任务要造的** ✓✓：**我们自己的轨迹语料（own-run corpus）** ✗。

## 数据流（不新增采集 ✓ R2）

```
账本（已在写 ✓）                        →  投影/归约（已有 ✓）      →  语料条目（新 ✓）
  request.received / planned / terminal       execution-ledger.ts      { 组件, 证据, 计数, 引用 }
  request.attempt.* / provider.request.*      projectExecutionDiagnostics ✓
  gate.refused / dispatch.decided             harness-axes.ts ✓
  tool.observed / model.budget.checked
  task.convergence.observed
```

**为什么不新增采集** ✓✓：今晚实测这十种 `kind` **都已在写** ✓，而且**每种都带 `correlation`**（`requestId`/`sessionId`/`toolCallId` ✓✓ 见 `tool.observed` 的处理 ✓）→ **够挖** ✓。

## 契约（逐条可测 ✓）

1. **条目形状** ✓：`{ surface: <七组件之一>, signal: <kind 类>, count, evidence: <记录引用>, missing?: <缺口声明> }` —— **`surface` 必须是七组件名** ✓（`.trellis/harness-surface.yaml` ✓，且已有测试断言两处一致 ✓✓）。
2. **空要说出来** ✓✓：语料为空时返回**缺口声明** ✓（复用 `failure-reading` 的写法与规矩 ✓），**不是空数组** ✗✓。
3. **预算** ✓：条目数**有上限** ✓，**被截断时必须带上"已截断"的声明** ✓✗ —— 静默截断 = 本会话反复猎的那类错 ✗✓。
4. **可下钻** ✓：**摘要 → 条目 → 证据引用** 三层 ✓（AHE 的 *layered, drill-down* ✓✓）；第二层**不塞原文** ✗（引用必须能回指账本记录 ✓）。
5. **能指向组件** ✓：这是它相对"自由文本总结"的全部价值 ✓ ✓ —— AHE 消融：增益在 **tools / middleware / long-term memory** ✓✓，所以条目必须能落到组件名上 ✓。

## 取舍与回退

- **取舍** ✓：造**第三个**"corpus"概念（本仓已有三个同名词 ✓）—— 代价是命名负担 ✓；回报是**回路第一次有素材** ✓✓。为压低代价：**新名字明确带 own-run** ✓✓，且**不动既有导出** ✗。
- **风险** ✗：条目**过度概括** ✗（"工具常失败"这种无指向的条目 ✓）→ 契约 1 的 `surface` 必填 + 契约 4 的证据引用**共同压住** ✓✓。
- **回退** ✓：新增模块 + 一个入口接线 ✓（照 `record-freshness` 那次 ✓✓），**不改账本写入** ✗ → 回退面小 ✓。
