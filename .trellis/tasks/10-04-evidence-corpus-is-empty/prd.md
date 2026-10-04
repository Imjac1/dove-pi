# The evidence corpus is empty, so the loop has nothing to mine

## Goal

让这个项目**能从自己的运行里挖东西** ✓ —— 而今天它挖的是**别人论文里的语料** ✓✓。

**用户价值** ✓：AHE 的三根柱子里，**②（经验可观测）是唯一空的一根** ✗✓ —— 而"自动进化"的**素材**全部来自它 ✓：*"distills millions of raw trajectory tokens into a layered, drill-down evidence corpus that an evolving agent can actually consume"* ✓✓。素材为空 ⇒ 回路只能靠**试错** ✗（正是那篇论文说它要避免的 ✓）。

## Background（全部实测 ✓）

- **这个仓已经在消费语料 —— 只是不是自己的** ✓✓：`src/core/action-policy.ts:657` 引 *"the corpus's **measured evasion (98% of attempts, 88% succeeding)**"* ✓；`src/core/argument-syntax.ts:5` 引 *"the corpus measured exactly that（`2609.30217`）"* ✓✓ → **来源是论文，不是我们跑的会话** ✗✓✓。
- **"corpus" 一词在此仓指三种不同东西** ✗✓：① `src/core/harness-corpus.ts` —— *"**What the recorded corpus contains, as one summary**"* ✓（一份**摘要** ✓）；② `src/core/failure-reading.ts:113` 的 `readonly corpus: readonly string[]` —— *"**What this corpus does not contain**, so an empty reading is not mistaken for a working one"* ✓✓（**"空要说出来"** ✓）；③ 上述论文语料 ✓。**三者同名、无一处互相说明** ✗。
- **没有语料文件或目录** ✓（`.trellis/corpus` ✓ `.trellis/harness-corpus.jsonl` ✓ `.trellis/workspace/corpus` ✓ 全不存在 ✓）。
- **`.trellis/tasks/**` 下的 `*.jsonl` 几乎全是 0 B** ✗✓（约 40 个任务，仅 `09-30-axi-a0/a1/a2` 有字节 ✓）。
- **可挖的原始材料是真的** ✓✓：账本里有 `request.received/planned/terminal` ✓ `request.attempt.*` ✓ `provider.request.*` ✓ `gate.refused` ✓ `tool.observed` ✓ `dispatch.decided` ✓ `model.budget.checked` ✓ `runtime.phase.completed` ✓ `task.convergence.observed` ✓ —— 而 **12 段那一轮还留下了 26.6 KB `readings.md` + 6.4 KB `findings.md`** ✓✓（**本项目第一批真的可挖的轨迹** ✓）。
- **判据的外尺** ✓✓：AHE 论文测得**增益来自 tools / middleware / long-term memory，而非 system prompt** ✓✓（*"factual harness structure transfers while prose-level strategy does not"* ✓）→ 语料要能**指出去改哪个组件** ✓。

## Requirements

- **R1 三种 "corpus" 必须被区分** ✓：规格里说清哪一个是**摘要** ✓、哪一个是**缺口声明** ✓、哪一个是**外部论文语料** ✓；不得继续同名混用 ✗。
- **R2 我们自己的运行必须可挖** ✓✓：从**已有且真实**的账本记录（上列 10 种 `kind` ✓）产出**分层、可下钻**的形式 ✓ —— **不新增采集** ✗（材料已经足够 ✓）。
- **R3 空要说出来** ✓✓：**延伸** `failure-reading` 的既有规矩 ✓（"What this corpus does not contain" ✓），**不发明新词汇** ✗。
- **R4 必须能被演化中的 agent 消费** ✓：产出**受上下文预算约束** ✓（沿本仓的 budget 教条 ✓），并**能指向应改的组件** ✓（AHE 七组件名 ✓，见 `.trellis/harness-surface.yaml` ✓）。
- **R5 先红后绿** ✓；**引文门保持全绿** ✓（新增锚点必须**可解析** ✓）。

## Acceptance Criteria

- [ ] 规格里**三种 corpus 各有其名** ✓，且**没有一处继续混用** ✓。
- [ ] 有一条**今天必红**的用例：给定一组真实形状的账本记录（含 `request.received` 与 `gate.refused` ✓），**产出可下钻的语料条目** ✓。
- [ ] **空语料时明确说"空"及原因** ✓✓（复用 `failure-reading` 的规矩 ✓），且**有空/非空两条对照用例** ✓。
- [ ] 条目**能指向七组件之一** ✓（不是自由文本 ✓✓）。
- [ ] 产出**受预算约束** ✓（有明确上限，且**超限时说它截断了** ✓✗ —— 不得静默截断 ✗）。

## Out of Scope

- **新增采集通道** ✗（账本已够 ✓）；**改动账本写入** ✗；**把语料喂回 prompt 的自动注入** ✗（那是另一个决定 ✓）；**第③柱（预测→下轮验证）** ✗（另有其记录 ✓，见发现 D ✓）。
