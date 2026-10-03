# The problems twelve real sessions surfaced, and how each one is solved

## Goal

把 **12 段真实使用**（`10-03-ten-million-token-project` ✓）跑出来的问题，**变成各自有主、有验收的修复** ✓ —— 而不是又一份清单 ✓。

**用户价值** ✓：那些问题**只在真实长跑里出现** ✓（单轮、单会话的测试都看不到 ✓），其中一条**直接打断了这轮要测的东西本身**（延续 ✗），另一条**属于整晚在修的那一类**（断言悄悄失效、无人看管 ✓✓）。

## Background（全部实测 ✓）

**证据来源** ✓：`.trellis/tasks/10-03-ten-million-token-project/findings.md` ✓（两份清单 ✓）与 `readings.md`（26.6 KB 原始读数 ✓）。账 ✓：**12 会话 / 210 消息 / prompt 3,241,490** ✓（目标 10M → **32%** ✗，原因已量清 ✓）。

### 已量到的事实（决定了每条的修法归属 ✓）

- **F（延续被锁）** ✗✓✓：`--continue` 的新回合里，未声明的非幂等工具全被拒 ✓（`agent_project_status` ✓ `agent_project_context` ✓ `agent_task_convergence` ✓ **`bash`** ✓）。**12 段里 10 次首问、7 次撞上** ✓ = 系统性 ✓。
  → **归属已定** ✓✓：拒绝原文在 **`src/core/effect-boundary.ts:122`** ✓（**我们自己的代码** ✓，宿主 bundle 里没有 ✓）；账本按 **`correlation.requestId`** 键控 ✓（`src/cli.ts:392` ✓ / `src/adapters/local-rpc.ts:140` ✓ / `src/adapters/mcp.ts:61` ✓）→ **`--continue` 新回合沿用同一 `requestId`** ✗✓ → **根因在我们这边，修法也在我们这边** ✓✓。且 **`cli.ts:397` 里另有 `stepId`** ✓✓ → 判据本可按步 ✓。
- **`effects.classes` 的遗漏** ✗✓：`agent_*` 共 **13 个** ✓（`extension.ts` ✓）而**没有一个被声明** ✓；`code-audit` 声明 6 条 ✓ · **`pentest`/`trading` 一条都没有** ✗✓ · `code-development` 12 条 ✓ → **跨模式的系统性遗漏** ✓✓。
  → **注意** ✓：`agent_task_convergence` **是写操作** ✓（它写记录 ✓）→ 它被拒**是对的** ✗✓ → 该修的只读集合 = **`agent_project_status` ✓ `agent_project_context` ✓**（+ 同类的 `agent_list_capabilities` ✓ `agent_doctor` ✓）；而 **`bash`** 那条**不在**这一列 ✓。
- **I（记录与树脱节）** ✗✓✓：`acceptance.md` 打勾"AC-001…005 完成" ✓ 而 `evidence.jsonl` **止于 `progress_reviewed`、无关闭事件** ✓、`state.json` 仍 `phase: "intake"`/`decisions: []` ✓；AC 里写死的测试数（7）已被树超越（22）✓；**它自己那条后续发现被同一轮改动作废** ✓✓。
  → **归属** ✓：全仓**没有任何**对 `.dove/tasks/` 的校验 ✓（`decide` 只在循环里 ✓，closure 词汇只在 code-audit 垂直里 ✓）→ **是新的工作量** ✓。
- **G（按名拒绝可绕道）** ✗✓✓：`bash` 被拒后它用"直接跑 `index.js`"替代 `npm test` ✓ —— 与 `ask_before` 注释自陈的同类问题一致 ✓（*"the list is name-based while the condition is about the argument"* ✓）。
- **H（三次未定位硬停）** ✗✓：`EngineCore encountered an issue` ✓ · 21 分钟静默但仍在干活 ✓ · **`node.exe : terminated`** ✓（三种签名 ✓，全无定位 ✗）。
- **C（账本运行中不刷新）** ✓：`execution.jsonl` 最后写入 20:44，而 21:09 仍在写文件 ✓。
- **缓存 0%** ✗✓✓：**13 会话 / 253 请求 · `cacheRead 0` · 累计命中 0.0% · 全 MISS 240 次** ✓。
  → **归属** ✓✓：`src/commands/cache-audit.ts:87` 的 `no-context` 是**推断出来的标签** ✓（"Dove 没注入快照" ✓），**不是开关** ✗✓ → **0% 是*提供商*侧找不到稳定前缀** ✓ → **不在本仓** ✗✓ → 计划里应当是**测量与上报** ✓，不是"修复" ✗。

## Requirements

- **R1 每条问题都有主** ✓：**开成自己的任务** ✓，带各自的验收 ✓；本任务只负责**规划** ✓。
- **R2 修法必须对准已量到的归属** ✓：属于我们的 ✓（F ✓ I ✓ G ✓ H ✓ C ✓）→ 修；**不属于我们的** ✗（缓存 ✓）→ 只测量与上报 ✓。
- **R3 F 的修法分两半** ✓：**症状**（只读工具被拒 ✓）与**根因**（requestId 复用 ✓）**分开对待** ✓ —— 因为根因那条会**放宽一道安全保护** ✗✓，它需要自己的论证与验证 ✓。
- **R4 先红后绿** ✓：每条修复都要有**能失败的用例** ✓（沿用本会话的规矩 ✓）。
- **R5 产品代码零改动的红线不适用于本任务** ✗✓（这一轮就是修 ✓）—— 但**本任务自身**在批准前不动代码 ✓。

## Acceptance Criteria

- [ ] **A–I 每一条** ✓ 都落到"**已开的任务** ✓ / **明确不属于我们并已上报** ✓ / **已写明为何不做** ✗✓"三者之一 ✓，无一条悬空 ✓。
- [ ] **F 的两半分开** ✓：症状修复带一行级改动与用例 ✓；根因修复**单独**给出方案、放宽了什么、以及**谁来证明它没放坏** ✓。
- [ ] 缓存那条**产出一份上报** ✓（含 253 请求的读数 ✓ 与"标签≠开关"的定位 ✓），**不含本仓代码改动** ✗。
- [ ] 本任务**不改产品代码** ✗（规划 ✓；改动由各子任务做 ✓）。

## Out of Scope

- **在本任务里动手修** ✗（规划 ✓）；**重跑 12 段** ✗（要重跑的是修复之后的事 ✓）；**把宿主的行为当成我们的缺陷** ✗✓（缓存那条即例 ✓）；A2–A5 的 RSI 题 ✗。

## Open Questions

（**无** ✓ —— 用户已定：**从根本解决** ✓；而根因经测量后**不是**放宽保护 ✓✓。）

## 决定与根因（**实测** ✓，2026-10-04）

**用户选择** ✓：**从根本解决** ✓（不是只修症状 ✗）。

**根因（量到行 ✓✓）**：`src/core/effect-boundary.ts:111` 的判据是

```ts
if (claim.claimed || !input.replayed || isAutomaticallyRetryable(effectClass)) { dispatch } else { refuse }
```

→ **守卫只在调用方说 `replayed: true` 时才拒** ✓✓ —— 也就是说"这是一次重放"是**调用方传来的旗标** ✗✓；而 `--continue` 的新回合里，**调用方把一次新请求标成了重放** ✗✓✓ → **缺陷在旗标，不在守卫** ✓✓。

**键是内容哈希** ✓（`src/core/effect-ledger.ts:194`：`[version, engagement, mode.id/version/governanceVersion, tool, target, argumentsDigest, explicitKey]` ✓ —— **不含 requestId / attempt / session** ✓）→ 所以**守卫的设计自洽** ✓✓（它自己的文档：*"on the first attempt … the action **always dispatches**"* ✓；*"a target outside…"* 那类是**故意**用内容键 ✓）。

**因此修法的性质** ✓✓：**把 `replayed` 说真话** ✓ —— **守卫不改 ✓、键不改 ✓、没有任何安全属性被放宽** ✓✓；要保住的性质写成测试 ✓：**"同一个 dispatch 的真实重放仍被拒"** ✓✓。

**待测** ✗（第一条切片就做它 ✓）：`replayed` 的**来源**在哪 —— 即哪个适配器/循环把它设成 `true` ✓（`src/adapters/` 与 `src/core/loop*.ts` ✓）。
