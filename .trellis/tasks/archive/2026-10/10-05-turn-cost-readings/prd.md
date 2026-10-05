# 一轮的真实成本：报出组装好的提示词，并测出缓存

## Goal

`/status full` 现在报出**这一轮真正组装出来的提示词有多大**（系统提示词 + 该轮附上的片段），并且这个数被断言钉在与真实产物相等上；**而"缓存命中率 0%"这一条仍未测** —— 它需要一次带 provider 的 field run，凭据由操作者提供。

**用户价值**：成本这一面第一次有了产品内的读数（此前只有片段的读数与宿主的 `token audit`），而且这个读数不能是名义值。

## Background（全部实测）

- **D 级缺口**（`.trellis/tasks/10-05-pstack-reference-audit/findings.md` §四 D）：13 会话 253 请求实测 **`cacheRead 0`**、累计命中 **0.0%**、全 MISS 240 次、4,073,554 prompt 全价付（`10-03-ten-million-token-project/findings.md` 优化点 1）；而产品内**没有**任何"这一轮提示词多大"的读数：`rg -n systemPromptChars tests` 只命中类型声明。
- 唯一采过这个数的是外部黑盒脚本（`scripts/real-dove-blackbox.mjs` 的 `systemPromptChars`），且按 `10-03-blackbox-prompt-chars` 的记录，该值在 Pi 1.0.0 上**已不再为正、根因未定位**，所以它今天不能当读数用。
- 片段级别的读数**早就有**：`doveBudgetChars`（项目上下文）与 `modeBody=`（本轮 S2 加的）。缺的是**两者之和**，也就是真正付钱的那个数。

## Requirements

- **R1（已实现）** 策略快照带上 `promptChars` = 上一轮系统提示词长度 + 该轮片段长度，并在 `/status full` 的 `strategy=…` 行里作为 `prompt=<n>` 出现；从未组装过任何提示词时不打印（`0` 会被读成"提示词是空的"，而事实是"还没发过"）。
- **R2（已实现）** 这个读数被**钉在真实产物上**：宿主用例取同一轮 `before_agent_start` 返回的 `systemPrompt` 与 `message.content` 长度之和，断言它与状态行报出的数**相等** —— 缓存值、名义值、或在追加模式正文之前取的值都过不了。
- **R3（已测，结论改了问题的形状）** 缓存命中率：一次带 provider 的 field run 实测 **15 轮 / 263,705 input / `cacheRead` 0 / `cacheWrite` 0 / 13 full misses**，另加一个 2 次调用的对照探针证明**这台 provider 不上报前缀缓存**（同一 2,681-token 前缀连发两次，`cached_tokens` 两次都为 `None`）。所以 0% 在这台 provider 上**不可归因**：它无法区分"我们前缀在动"与"provider 不报缓存"。全部读数与两个探针见 `findings.md`。
- **R4（已定位，本轮不修）** `systemPromptChars` 为何不为正：**根因是记录器只装在 faux 那条腿上**（`real-dove-blackbox.mjs:95`），所以 `--provider real` 的 `providerEvidence` 必然为空 —— 与 Pi 版本无关。修法要么给 real 路径也装记录器，要么不再依赖它（产品内的 `prompt=` 已替代它回答同一个问题）。

## Acceptance Criteria

- [x] `/status full` 里出现 `prompt=<n>`，且 `n` 等于同一轮组装的提示词长度（`tests/host-work-mode.test.ts`；改前该用例红在"状态行没有报出提示词大小"）。**真跑里第一次生效：`prompt=28340`。**
- [x] `npm run typecheck` 干净；`tests/strategy-snapshot.test.ts` 与 `tests/host-work-mode.test.ts` 全绿。
- [x] **R3 测了**：读数、对照探针、以及"0% 不可归因"的结论都在 `findings.md`，原始证据在仓外。
- [x] **R4 定位了**：不是 Pi 1.0.0，是记录器的安装条件；已写进 `findings.md`，并回填给 `10-03-blackbox-prompt-chars`。
- [x] 代价记账：2 次对照调用 + 1 次 field run（15 轮 / 263,705 input tokens / 7.3 分钟），仓内无原始证据。

## Out of Scope

- 用假 provider 冒充一次缓存测量（那是"用一个数字冒充结论"）。
- 把 `promptChars` 变成一个**预算**（阈值、上限、拒绝）：读数先于阈值，阈值是一个要单独论证的决定。
- 给 real 路径装 provider 记录器（`findings.md` §四的两条修法之一）—— 因为产品内的 `prompt=` 已能回答同一个问题；要不要保留那个外部字段是另一个决定。

## Open Questions

（无。R3/R4 都已回答；下一步若要"测前缀稳不稳"需要**换一个会上报缓存的 provider**，那是操作者的选择，不是本任务能决定的。）
