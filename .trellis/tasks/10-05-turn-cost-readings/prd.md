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
- **R3（未完成，属实测）** 缓存命中率：`cache audit` 已有读数格式，但 0% 这个事实**没有任何东西会报警**。需要一次带 provider 的 field run 才能测，并需要把"命中率掉到 0"接进已有的读数。
- **R4（未完成，属实测）** `systemPromptChars` 在 Pi 1.0.0 上为何不再为正 —— 需要一次真跑才能定位（它今天的值是 0，所以"提示词多大"只能靠 R1 的读数）。

## Acceptance Criteria

- [x] `/status full` 里出现 `prompt=<n>`，且 `n` 等于同一轮组装的提示词长度（`tests/host-work-mode.test.ts` 的新用例；改前该用例红在"状态行没有报出提示词大小"）。
- [x] `npm run typecheck` 干净；`tests/strategy-snapshot.test.ts` 与 `tests/host-work-mode.test.ts` 全绿。
- [ ] **R3/R4 未完成** —— 它们需要操作者提供可用的 provider 凭据并允许花钱跑一次 field run；本任务不做，也不假装做过。

## Out of Scope

- 用假 provider 冒充一次缓存测量（那是"用一个数字冒充结论"）。
- 把 `promptChars` 变成一个**预算**（阈值、上限、拒绝）：读数先于阈值，阈值是一个要单独论证的决定。

## Open Questions

**要不要跑一次带 provider 的 field run 来测 R3/R4？** 若跑，需要：可用的 provider + 模型 slug、允许的调用次数上限、以及原始证据落盘在仓外（field-run 规范 §2 要求凭据由人提供、原始证据不提交）。若不跑，R3/R4 就停在这里，由 `cache audit` 的读数继续当唯一的观测面。
