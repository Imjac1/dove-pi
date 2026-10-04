# The corpus is not empty and it is already mined - what is missing is that nobody asks

## ⚠ 前提被两次实测推翻（**2026-10-04** ✗✓✓）

**本任务原先的前提是"语料是空的"** ✗✓ —— **两次测量把它推翻了**：

**① 第一次推翻（`harness-corpus.ts` 比预想的成熟）** ✓✓：`summarizeCorpus`（`:55` ✓）**不重复推导任何东西**（*"Nothing here is derived twice … a corpus summary **cannot disagree with the instrument it is summarising**"* ✓✓），**并且已经写出空的原因**（`EMPTY_FAILURE_NOTE` ✓）。

**② 第二次推翻（决定性，自造证据 ✓✓）**：把它跑在**真实账本**上 —— `node --import tsx scripts/harness-corpus.mts "C:\Users\Macfy\.pi\agent\dove\workspaces"` ✓：

```
ledgers 13 · records 3956 · requests 59
terminals by class:  clean 55 · recovered 0 · interrupted 0 · failure **3**
refusals by label:   deny 3 · effect-claim 42 · sandbox 4 · scope 6

req_8fd11e4c…  failed / provider-unknown  ->  middleware
  because: a gate refused this request (effect-claim, scope), and the policy that refuses is src/core/action-policy.ts …
  cite:     ledger:request:req_8fd11e4c-…
  preserve: tests/action-policy.test.ts, tests/fence-drift.test.ts, …
req_33af17c4…  failed / provider-unknown  ->  unattributed
  because: the cause is outside the harness: a provider outcome is not one of our components
```

→ **要造的东西早就有** ✗✓✓：**组件归属** ✓、**原因** ✓、**回指账本** ✓、**`preserve:`（回归防线）** ✓✓ —— 最后一项**连原计划都没有想到** ✓。**而 `EMPTY_FAILURE_NOTE` 那句"no failure record"对**真实会话**不成立** ✗✓：13 个账本里就有 3 个失败 ✓。

**为什么空注记会写错** ✗✓：它依据的是 **host *测试*** 的 `mkdtempSync` 路径 ✓，而**真实会话的状态目录走 `state-dir.ts:35` 的稳定哈希路径** ✓✓（`…/dove/workspaces/<hash>` ✓）→ **真实会话的账本留得下来** ✓✓（12 段那轮克隆的 `.dove/` **153,242 字节仍活着** ✓）。

## Goal（**改写后** ✓）

**让这台已经建好的挖掘机**被**自动**开动 ✓ —— 而不是**等人手去开** ✓，并且**让那条真正会丢证据的路径（host 测试）不再丢** ✗✓。

**用户价值** ✓：AHE 第②柱要的是 *"a corpus **an evolving agent can actually consume**"* ✓✓ —— 今天它**能被消费** ✓（形状已验证 ✓✓），但**消费它的动作在回路之外** ✗（一个需要人记得跑的脚本 ✓），且**注记里那句断言是错的** ✗✓（它会让读者以为失败不可得 ✓）。

## Requirements

- **R1 注记必须说真话** ✓✓：`EMPTY_FAILURE_NOTE` 现在的措辞（*"no failure record … state directories are not preserved"* ✗）对**真实会话**不成立 ✓ → 改成**区分两条路径**：真实会话的账本**保留** ✓（有 13 个为证 ✓）；host 测试的状态目录**不保留** ✓（那才是它真正在说的事 ✓），且**这一条要能测** ✓✓。
- **R2 让挖掘进入回路** ✓：`summarizeCorpus` 的输出应**在回路能读到的地方出现** ✓（已量到两个面 ✓：`src/cli.ts:73` ✓ 与 `local-rpc.ts:47` 的 `diagnostics/status` ✓✓）→ **并入其中之一** ✓，**不新开命令** ✗。
- **R3 三种 "corpus" 各归其名** ✓：**摘要**（`summarizeCorpus` ✓）· **缺口声明**（`failure-reading` 的 `corpus` 字段 ✓）· **外部论文语料**（`2609.30217` 等 ✓）—— 规格里各给一名 ✓，且**本条不需要假红** ✗（它是措辞 ✓；仓里没有术语门 ✓，实测过 ✓）。
- **R4 保住已经验证过的形状** ✓✓：**组件归属** ✓ · **`cite:` 回指** ✓ · **`preserve:` 防线** ✓ —— 新工作**不得使其退化** ✓（它现在是这个仓里离 AHE 第②柱最近的东西 ✓✓）。
- **R5 先红后绿** ✓（针对 R1 的断言与 R2 的接线 ✓）。

## Acceptance Criteria

- [ ] **一条用例**证明：给定真实形状的账本（含 `gate.refused` ✓ 与 `failure` 终端 ✓），`summarizeCorpus` **报出失败并给出组件归属 + cite + preserve** ✓✓（**今天已绿** ✓ —— 这是**防退化**用 ✓，不是红 ✓；对照：`failure-reading` 与 `harness-axes` 有同款手法 ✓）。
- [ ] **一条用例**证明 **`EMPTY_FAILURE_NOTE` 的措辞与事实一致** ✓✓（**今天必红** ✗ —— 它现在把"host 测试不保留"写成了"失败不可得" ✓）。
- [ ] `summarizeCorpus` 的输出在**既有面**上可见 ✓（并入 ✓，不新开命令 ✗）。
- [ ] 术语三条**各有其名** ✓，且**没有一处继续把"摘要"叫成"缺口"** ✓。

## Out of Scope

**新增采集** ✗（账本已够 ✓）· **改账本写入** ✗ · **自动把语料注入 prompt** ✗ · **第③柱（预测→下轮验证）** ✗（见发现 D ✓）· **给 host 测试做保留机制** ✗（它属于测试基建 ✓，本任务只负责**把断言改对** ✓）。

## 进度

- **第一片（R1 说真话）** ✗ 未开工 —— 红已明确 ✓（`EMPTY_FAILURE_NOTE` 的措辞与实测不符 ✓）。
- **第二片（R2 接线）** ✗ 未开工 —— 面已量到 ✓。
- **R3 命名** ✗ 未开工（措辞 ✓，无假红 ✗）。
