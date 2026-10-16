# The black-box evidence record stopped reporting the system-prompt size

## Goal

**已定位（2026-10-05）**：`--provider real` 的每次运行里 `providerEvidence` **必然为空** ✓ —— 写它的那个扩展只装在 faux 那条腿上（`scripts/real-dove-blackbox.mjs:110` ✓），而读取在 `:308` 是无条件的 ✓ ⇒ 在 real 路径上 `systemPromptChars` **根本没有写入者** ✗。所以任务开头那句"这个字段变成 0"**不成立** ✓：更早看到的那个读数来自 faux 路径 ✓。

**要决定的**：给 real 路径也装记录器（**(a)**，换来一份外部交叉验证 ✓，代价是**记录器进入被测路径** ✗），还是不再依赖这个外部字段、把"这一轮提示词多大"交给产品自己的读数（**(b)**，`/status full` 的 `prompt=<n>` ✓，实测 `prompt=28340` ✓）。两条分支、各自的证据与一条建议见 `design.md` ✓；**选哪条是操作者的决定** ✓。

## 已定位（2026-10-05，另一次真跑给出答案 —— 见 `.trellis/tasks/10-05-turn-cost-readings/findings.md` §四）

**根因不是 Pi 的版本，而是记录器只装在 faux 那条腿上。**

- `scripts/real-dove-blackbox.mjs:95`：`const providerExtension = providerMode === "faux" ? writeFauxProvider() : undefined` —— 写 `providerCapturePath` 的那个扩展**只在 `--provider faux` 时安装**。
- 因此 `--provider real` 的每次运行里 `providerEvidence` 都是**空数组**（2026-10-05 那次真跑实测：`providerEvidence: []`），`systemPromptChars` 根本没有写入者。既然记录根本不存在，"这个字段变成 0" 这个描述本身就不成立 —— 更早那次看到的负值来自 faux 路径。
- 这条把本任务开头那句话里的"collector 可能在静默丢字段"从一个猜测变成事实：它丢的不是字段，是**整条记录**，而且在 real 路径上是必然的。

**第二个事实（2026-10-14 实测，本任务标题那句"变成 0"确实发生过，只是原因和原来猜的不同）** ✓：faux 路径上记录**存在**（`providerEvidence` 有一条 ✓），但 `systemPromptChars` 是 **0** ✗ —— 记录器那行是 `typeof context.systemPrompt === "string" ? context.systemPrompt.length : 0` ✓，而**宿主不再把系统提示词作为 `context.systemPrompt` 字符串交给 provider** ✗（Pi 1.0 把它变成**第一条 `role: "system"` 消息** ✓ —— 同一次跑的事件流里就有 `message_start` `role: "system"` ✓）⇒ 三元走了 else 分支，写下**由三元产生的常数** ✗。**常数不是读数** ✓；把它和 `messageChars: 23129` 这样的真实数字并排报出来，正是本仓反复在找的那一类缺陷 ✓。所以两条路径上 `systemPromptChars` **都不是读数** ✓ —— 一条是没有写入者 ✓，一条是写入者写常数 ✓。

**两条修法，本轮都没有采纳**（产品内已有替代读数，`/status full` 的 `prompt=<n>`，并在那次真跑里第一次生效：`prompt=28340`）：

- (a) 给 real 路径也装一个记录扩展（要留意：记录器会成为被测路径的一部分）；
- (b) 不再依赖这个外部字段，把"这一轮提示词多大"交给产品自己的读数。

决定 (a) 还是 (b)，以及是否保留 `systemPromptChars` 这个外部字段，是**操作者的选择**；本任务因此不再卡在"根因未定位"上。

## Requirements

- **R1** 若选 (a)：real 路径也写 provider 证据（内容与 faux 路径同形），并有一条用例证明它在 real 模式下非空。
- **R2** 若选 (b)：把本任务记为"由产品读数替代"，并删除或标注外部字段，使读者不再去找一个永远为空的记录。
- **R3** 无论选哪条，本任务的目标句必须更新为实测结论（现在这句"Measured on Pi 1.0.0 …"已不准确）。

## Acceptance Criteria

- [x] **已选 (b)**（2026-10-14，操作者）：不再依赖外部字段，把这一轮的提示词大小交给产品自己的读数（/status full 的 prompt=<n>）。R2 生效，R1 不适用。
- [x] 根因已定位并带锚点（`scripts/real-dove-blackbox.mjs:110` 的 faux-only 安装 ✓，与 `:440` 记录器的三元 ✓），实测证据在仓外，且第二种成因由本仓自己复现 ✓。
- [x] 本任务开头的目标句已改写为已定位的事实（见 `## Goal` ✓）。

## 落地（2026-10-14，按 (b)）

- **real 路径**：摘要**不再报** `providerEvidence` ✓（原来是 `[]` ✗ —— 那读起来像"看过了，什么也没有" ✓，而事实是"这条路上没有记录器" ✗）；新增 `providerEvidenceGap: "no-recorder-installed-for-the-real-provider"` ✓。
- **faux 路径**：`providerEvidence` 照旧有那条记录 ✓，但**不再带它量不出来的尺寸** ✓ —— 记录器在拿不到字符串时**省略该键** ✓（而不是写 0 ✗），摘要给 `providerEvidenceGap: "recorder-cannot-measure-the-system-prompt"` ✓。
- **读数去向**：`/status full` 的 `prompt=<n>` ✓（`src/core/strategy-snapshot.ts:192` ✓，来源 `src/pi-adapter/extension.ts:1071` ✓），它**已有自己的用例** ✓（见 `tests/host-work-mode.test.ts` ✓ 里读 `prompt=(\d+)` 的那条 ✓）—— 所以本任务**不为它另写用例** ✓。
- **用例**：`tests/real-dove-blackbox.test.ts` 的两条现成用例各加一组断言 ✓（没有新增跑动 ✓）—— real 那条断言字段**缺席**且 gap 被点名 ✓；faux 那条断言记录**仍在** ✓、**不带未测出的尺寸** ✓、gap 说明原因 ✓。两条都**先见红** ✓：real 是 `actual: []` ✓，faux 是 `actual: 0` ✓。
- **规格**：`.trellis/spec/backend/personal-agent-field-run.md` §5 那条已改成两个已定位的事实 ✓ + 读数去向 ✓ + 错/对各一例 ✓。
- **那条"根因未定位"的注释被替换** ✓：它曾猜"也许是我们自己的收集器静默丢字段" ✓ —— 方向对了一半 ✓：收集器没有丢字段 ✓，但**两种情况下那个数字都不是读数** ✓。

## Out of Scope

- 回到"是不是 Pi 1.0.0 的问题"—— 已排除。

## Open Questions

**已决（2026-10-14）：(b)** ✓ —— 不再需要那个外部读数来交叉验证产品自己的 prompt=。原问题保留在下：选 (a) 还是 (b)？ 取决于是否还需要那个**外部**读数来交叉验证产品自己的 `prompt=`（(a) 给交叉验证，(b) 少一个会腐坏的外部字段）。
