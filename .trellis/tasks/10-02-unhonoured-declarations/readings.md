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

## 第 4 步（规格）✅ 与第 5 步（门）的一半 ✅

- **规格矩阵补齐** ✓：`personal-agent-mode-format.md` 的错误矩阵新增 **六行**（`grant_graph` ✓ · `evidence`/`coordination` ✓ · `memory_scope` ✓ · `budget` 的兄弟字段 ✓ · `stop.on` 的非法种类 ✓ · 解析不到的 `grant` 名 ✓），并说明**为什么**拒绝而不只是拒绝 ✓。那一页按本仓规矩要"双向枚举加载器拒绝什么" ✓ → 在此之前它是不完整的 ✗。
- **门的根因先修** ✓：`scripts/mode-behaviour-map.mts` 的两处引用**去掉行号** ✓（只点函数名 ✓）+ 在注释原位写明理由 ✓ —— 行号在这类注释里**没有任何读者会校对** ✗，而这正是它烂两次的原因 ✓。

## R3a 的结论：**如实记为限制** ✗（已测量 ✓，且**检查回合证伪了我原话里的两句** ✗）

**`loop-pi-agent-core` 在 `src/` 里没有任何导入者** ✓✗ → 那个桥**不可达** ✓ → 把模式的 `session.budget.turns` 接到它的 `maxTurns` 上，等于接进空气里 ✗。运行时**真正在用**的回合界是 `src/core/loop-runner.ts:75` ✓（在 `axi-turn` 之下 ✓）。

**我在这里写下的两句是假的 ✗，检查回合用实测证伪 ✓**：
- 我写"`turns` **被带上模式**" ✗ —— **不成立**：`WorkMode` 上没有承载它的字段 ✓，值只能经 `mode.governance.session` 间接取到 ✓，而 governance blob **一直都在透传** ✓ → 本任务**没有改变**这件事 ✗。
- 我写"**非法值被拒**" ✗ —— **不成立**：`budget.turns: sixty` 与 `budget.turns: {max: 60}` 都被**接受** ✓。

**准确的状态**：`turns` 的**兄弟字段**被拒 ✓、`budget` 的形状**未校验** ✗（F3 ✓）、非数字 `turns`**被接受** ✗、**没有任何回合界读它** ✗。→ **我写下的比事实更满 ✗** —— 这正是本任务反复出现的那一类错误 ✓，而这次是**在读数里** ✓。

**检查回合的 F1 更重** ✗：`modes/trading` 的 `exclusions: [production-venue]` **仍然拦不住任何东西** ✓ —— 该模式没有 `target_argument` ✓，而我的检查在缺它时直接放行 ✗ → **一个已发布模式里的安全声明至今是惰性的** ✗，而我的 AC-1 声称"两个模式真的生效" ✗ = **假** ✓。trading 那条用例的标题写着 "keeps production out of reach" ✓，但它只断言原始值 ✓。

**另**：本文件的失败数读数（31→4→1→0 ✓）是**当时现场测的** ✓，中间状态从未提交 ✓ → **现在无法重现** ✗（检查回合如实指出 ✓）。那条 "99/99" 的**分组也没写下来** ✓，检查回合按四个显然的装载套件实测是 93 ✗ → **没点名的数字就是会烂的数字** ✗（我又犯了一次 ✓）。


## 检查回合之后的修补（按它的优先序）

### F1 ✅ `3af0f51` · F2 ✅ `00527f0` · F3 ✅ `00527f0` · F4 ✅ `00527f0` · F5 ✅（本次提交）

| # | 结果 |
|---|---|
| **F1** | `modes/trading` 的 `exclusions` 惰性 ✗ → 加载时**点名拒绝一个无法生效的清单** ✓；损失原位 ✓；用例反转 ✓（红 **34/35** → 绿 **113/113** ✓） |
| **F3** | 四种绕法（`turns: sixty` ✓、`budget: 60` ✓、`session: {turns}` ✓、`stop.on` 标量 ✓）全部关闭 ✓（键白名单 + 严格类型 ✓）；红：**当时四种全部通过** ✗ |
| **F4** | 停止词表从 `loop.ts` **导出** ✓ 并被导入 ✓（**不再手抄** ✗）+ 一条**走一遍它**的用例 ✓ |
| **F2** | `turns` **被校验**（正整数 ✓）· **被承载**（`sessionTurns` ✓ + 用例 ✓）· **被接线**（`axi-turn` → 运行时唯一在用的界 ✓） |
| **F5** | 排除项改为**经文档的 target 表解析** ✓（id ↔ address 是同一个东西 ✓）。**红是重建的** ✗：把策略那个文件 stash 掉后，同一个 target 的**另一个名字**被放行 ✓（`{"outcome":"allow"…}` ✓），修好后被拦 ✓ |

### 两处**明说未做到**的地方 ✗（不是遗漏，是记录 ✓）

1. **F2 的承载用例写在实现之后** ✗ → **没有红的读数** ✓（非空断言 ✓ —— 那个字段在本次改动前不存在 ✓ —— 但本会话已在这类断言上错过三次 ✓ → 说出来 ✓）。
2. **F2 的接线没有用例** ✗，而且我**测过它是否便宜可测** ✓：`axi-turn` 的脚本化夹具**一个回合就完成** ✓ → "界为 1"与"界为 4"在结果上**不可区分** ✗ → **缺少一个可观察的接缝** ✓。这不是懒，是**量出来的**：要么给那个夹具加一个需要两个回合的场景 ✓，要么给 `runAxiTurn` 加一条把收到的界报出来的读数 ✓ —— 两者都不是"顺手" ✓。

## 尚未做

**F6 的后半**（字符串字面量里的 `file:line` **无人看守** ✗ —— 那处**已错**的引用本次已修 ✓）· **F7 的判定**（`scope.targets` / `environment` / `ownership_evidence` 是控制还是记录 ✓ —— 要你取舍 ✓）· **F8**（行为图里另有 **4 处行号** ✓，与"不再有行号"自相矛盾 ✗）· **F9**（一条过期注释 ✓ + 矩阵缺 fence 的装载期拒绝 ✓）· **F10**（一处措辞顺序 ✓）· **门的另一半**（`scripts/**` 只查路径 ✓）· **收尾的全范围 `trellis-check`** ✓。


