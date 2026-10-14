# The black-box evidence record stopped reporting the system-prompt size

## Goal

**已定位（2026-10-05）**：`--provider real` 的每次运行里 `providerEvidence` **必然为空** ✓ —— 写它的那个扩展只装在 faux 那条腿上（`scripts/real-dove-blackbox.mjs:110` ✓），而读取在 `:308` 是无条件的 ✓ ⇒ 在 real 路径上 `systemPromptChars` **根本没有写入者** ✗。所以任务开头那句"这个字段变成 0"**不成立** ✓：更早看到的那个读数来自 faux 路径 ✓。

**要决定的**：给 real 路径也装记录器（**(a)**，换来一份外部交叉验证 ✓，代价是**记录器进入被测路径** ✗），还是不再依赖这个外部字段、把"这一轮提示词多大"交给产品自己的读数（**(b)**，`/status full` 的 `prompt=<n>` ✓，实测 `prompt=28340` ✓）。两条分支、各自的证据与一条建议见 `design.md` ✓；**选哪条是操作者的决定** ✓。

## 已定位（2026-10-05，另一次真跑给出答案 —— 见 `.trellis/tasks/10-05-turn-cost-readings/findings.md` §四）

**根因不是 Pi 的版本，而是记录器只装在 faux 那条腿上。**

- `scripts/real-dove-blackbox.mjs:95`：`const providerExtension = providerMode === "faux" ? writeFauxProvider() : undefined` —— 写 `providerCapturePath` 的那个扩展**只在 `--provider faux` 时安装**。
- 因此 `--provider real` 的每次运行里 `providerEvidence` 都是**空数组**（2026-10-05 那次真跑实测：`providerEvidence: []`），`systemPromptChars` 根本没有写入者。既然记录根本不存在，"这个字段变成 0" 这个描述本身就不成立 —— 更早那次看到的负值来自 faux 路径。
- 这条把本任务开头那句话里的"collector 可能在静默丢字段"从一个猜测变成事实：它丢的不是字段，是**整条记录**，而且在 real 路径上是必然的。

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
- [x] 根因已定位并带锚点（`real-dove-blackbox.mjs:95`），实测证据在仓外。
- [x] 本任务开头的目标句已改写为已定位的事实（见 `## Goal` ✓）。

## Out of Scope

- 回到"是不是 Pi 1.0.0 的问题"—— 已排除。

## Open Questions

**已决（2026-10-14）：(b)** ✓ —— 不再需要那个外部读数来交叉验证产品自己的 prompt=。原问题保留在下：选 (a) 还是 (b)？ 取决于是否还需要那个**外部**读数来交叉验证产品自己的 `prompt=`（(a) 给交叉验证，(b) 少一个会腐坏的外部字段）。
