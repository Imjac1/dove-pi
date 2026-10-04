# The black-box evidence record stopped reporting the system-prompt size

## Goal

Measured on Pi 1.0.0: inside a provider-evidence record that still exists and still reports a positive message size, `systemPromptChars` is no longer positive.

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

- [ ] 明确选择 (a) 或 (b)，并把选择写进 R1/R2 对应验收。
- [x] 根因已定位并带锚点（`real-dove-blackbox.mjs:95`），实测证据在仓外。
- [ ] 本任务开头的目标句改写为已定位的事实，或按 (b) 关闭。

## Out of Scope

- 回到"是不是 Pi 1.0.0 的问题"—— 已排除。

## Open Questions

**选 (a) 还是 (b)？** 取决于是否还需要那个**外部**读数来交叉验证产品自己的 `prompt=`（(a) 给交叉验证，(b) 少一个会腐坏的外部字段）。
