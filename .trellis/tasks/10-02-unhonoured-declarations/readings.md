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

## R2 / R3 / R3c 与 R4 —— ✅ 已落地

**从恢复点到全绿的四次读数** ✓：`git stash pop` 之后 **31 条失败** ✗ → 修好夹具与迁移后 **4** ✓ → 三处消息/期望对齐后 **1** ✓ → 最后一条修掉后 **0** ✓✓。

**绿**：全量 **864 / 862 pass / 0 fail / 2 skipped**（142 套件 ✓）· `typecheck` 0 ✓ · installer **141 OK** ✓

### 三个 bug，全是我的，全是**测试**抓到的（不是我看出来的 ✓）

1. **拒绝查错了地方** ✗：`grant_graph` 是 `authority:` **里面**的键 ✓，而我的循环在**顶层** governance 上找它 ✗ → 那个字段**从它被写出来要抓的检查手上活了下来** ✗✓。抓它的是我自己那条红用例 ✓（"expected a WorkModeError … but nothing was thrown" ✓）。
2. **夹具追加而不是插入** ✗：`withGovernance` 把行写在**末尾** ✓，于是 4 条用例断言的是落进了 `gate:` 块里的字段 ✗ → **为错误的原因红** ✓ —— 我在原处写下：那是唯一一种不该有耐心的红 ✓。
3. **一个模式文件出现重复键** ✗：我替换 `stop:` 块时**没有包含它后面那一行** ✓（原值是 `emergency_stop: risk-desk` ✗）→ YAML 解析器报 `Map keys must be unique at line 56` ✓✓。**我手写的扫描说文件是干净的** ✗ —— 找到它的是**解析器** ✓。**让解析器当仪器，不要自己写一个更聪明的扫描** ✓。

### 迁移的后果（损失，写在读者会遇到的地方 ✓）

- 三个模式的版本各 bump 一格 ✓（本仓规则：授权变化必须动版本 ✓，否则无法把一次运行归属到一个授权集 ✓）：`pentest 1.5.0` ✓ · `code-audit 1.9.0` ✓ · `trading 1.4.0` ✓。
- `code-audit` / `trading` 删掉了**解析不到**的 grant 名 ✓（`local-review` / `local-paper-trading` ✗）→ 有意的 ✓，损失近似为零（它们指向的文档从未存在 ✓）。
- `code-audit` 那条纪律用例原来断言 `mode.authorityGrant === "local-review"` ✓ → **反转** ✓（内部评审没有外部授权方，诚实的声明就是"没有" ✓）。
- 另一条用例断言 `evidence.artifacts.includes("coverage.json")` ✓ → **反转** ✓（运行时兑现不了的保留承诺比不做承诺更糟 ✓）。

## 尚未做（本任务的第 4/5/6 步）

规格（`mode-format.md` 的错误矩阵要补上这五条拒绝 ✓ + `core.md` 的字段表 ✓）· 门的扩展（`scripts/**` 只查路径 ✓ + 注释去掉行号 ✓）· 收尾的全范围 `trellis-check` ✓。
**注意**：错误矩阵按本仓规矩"要双向枚举加载器拒绝什么" ✓ → 在补上之前，那一页是**不完整的** ✗（已在下一步的清单里 ✓）。

