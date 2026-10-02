# 读数

## R1 `scope.exclusions` —— ✅ 已落地（提交 `50008d4`）

**红**：宿主套件 **34 / 35** ✓，失败的正是被反转的那条用例 ✓ ——
```
✖ allows a target the mode excludes, because nothing checks the exclusion  [KNOWN GAP]
   AssertionError: a target the mode excludes must be refused at the boundary: (no reason)
   + actual - expected:  + undefined  - true
```
（`undefined` 而不是 `false` ✓：调用**被放行**了 ✓，即拒绝根本没发生 ✓。）

**绿**：宿主套件 **35 / 35** ✓ · 装载相关套件 **99 / 99** ✓ · 全量 **859 / 857 pass / 0 fail / 2 skipped** ✓ · `typecheck` 0 ✓ · installer 141 OK ✓

### 反转的是它自己要求的用例 ✓

仓里那条用例写着 *"a mode excluded a target and the call ran anyway … **Invert this test when exclusions are enforced; do not delete it.**"* ✓ → 断言与**标题**都反转了 ✓（标题原来写着"because nothing checks the exclusion" ✗，反转后它就成了假话 ✓）。

### 我自己的一个错（同一个缺陷类，出现在修它的补丁里 ✗）

提取、接口字段、边界检查三样都写好了 ✓ —— **却从没把值挂到返回的 mode 对象上** ✗。表现是探针**没有输出** ✓（守卫在它之前就返回了 ✓）。找到它的不是又一次猜 ✗，而是**三行探针** ✓。

## R2 / R3 / R4 / 门 —— 已写好、已证明红、**未落地**（在 `stash@{0}` ✓）

**红**：`tests/work-mode.test.ts` **50 / 55** ✓ —— 五条新用例全红 ✓，每条都打印了它现在**被无条件接受** ✗ 的事实：
```
✖ refuses `authority.grant_graph`, which duplicates what the document binds  [D4]
✖ refuses a `stop.on` reason the runtime never produces  [D4]
✖ refuses `evidence` and `coordination`, whose promises this runtime cannot keep  [D4]
✖ carries `session.budget.turns` and refuses the siblings it cannot honour  [D4]
✖ refuses a `grant` name that resolves to nothing, whatever the semantics  [D4]
```

**取证得到的两条关键事实** ✓：
- `LoopStopReason` = `completed` | `maxTurns` | `stopped` | `providerError` ✓ → 这是 `stop.on` 的**唯一**合法清单 ✓（shipped pentest 点名的三个，一个都不在其中 ✗）；
- 三个已发布模式**都有** `session` / `evidence` / `coordination` / `stop` ✓（比检查回合报的"petest 一处"更广 ✓）—— 迁移面因此更大 ✓。

**为什么不落地就停** ✗：迁移后**29 条旧期望**失败 ✓（它们断言着已被移除的声明 ✓）。把树留在红上不是可交付状态 ✓，所以这一步整体 stash ✓、树回到绿 ✓，恢复点写在 `implement.md` ✓。**这不是放弃，是把它变成一个可恢复的、说明清楚的边界** ✓。

## 一条新发现（本任务未决定 ✗）

三个模式的 `session.memory_scope` **也没有读者** ✗ —— 同一缺陷类 ✓，已就地标注 ✓，但"控制还是记录"的取舍没有在本任务的路线里定过 ✓。
