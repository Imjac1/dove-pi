# 失败的 provider 调用要记下**原因**，而且要有读者把它读出来

## Goal

一次以 `stopReason: "error"` 结束的 provider 调用，账本里**说不出发生了什么**：适配器为了决定"能不能重试"而做的分类（`{kind, reason}`）只活在那个决定里，从没落到记录上。把分类提到写记录之前、把 `failureKind`/`failureReason` 写进记录，并让失败读数把它们读出来。

**用户价值**：今天问"那一轮为什么重试"只能得到"出错了"；改后能得到 `transient / http_429` 这样的答案。这是**可诊断性**，不是行为改动。

## Background（全部实测）

- **触发**：一次真实 field run（`read-only-audit`，`--provider real`，15 轮）里第 6 轮以 `error` 结束（543 ms、`usage` 全 0），2 ms 后 `request.attempt.completed outcome="transient-failure"`、2 s 后 `request.attempt.started trigger="provider-retry"`、最终 `completed` —— **重试是对的，记录说不出原因**。
- **根因（顺序）**：`src/pi-adapter/extension.ts` 的 `pi.on("message_end")` 先写记录（当时在 `:2990`），八行之后才 `lastProviderFailure ??= classifyAssistantProviderFailure(message)`（当时在 `:3009`）—— 而分类正是从 assistant 消息文本里读出 `ECONNRESET` / `429` / `rate limit` 的那个函数（`:282-296`）。**还有一个写入点**（当时 `:2522`，唯一同时持有 `lastProviderFailure` 的地方）只写 `stopReason` 与 `usage: {httpStatus}`。
- **不是孤例**：扫本机 `%TEMP%` 下**全部 602 个** `execution.jsonl`，`stopReason: "error"` 的 provider 记录 **6 条**，写了具体原因的 **0 条**；其中一条 `durationMs = 300,010`（5 分钟）、一条 `174,885`。
- **一条被推翻的初判**：我最初把 `usage: {httpStatus}` 判为"一个字段两种含义、应删"。动手前发现 `src/core/failure-reading.ts:232` **就是从这个字段读状态码**的，写入点与读取点是自洽的 —— 所以那不是缺陷，**没有改**（改它只会把一个有读者的约定换成两个文件的改动）。

## Requirements

- **R1** 分类发生在写记录**之前**，且**只有一处**：`message_end` 里算出的 `providerFailure` 同时供记录与重试决策使用（两次 `??=` 改成一次性赋值 + 一个局部量）。
- **R2** `appendProviderRequestCompleted` 接受可选 `failure: {kind?, reason?}`，写成 `failureKind` / `failureReason` **两个标量**（与 `stopReason` 同级，读者按同一种方式取），不给这两个字段传值时不写。
- **R3** **两个写入点都传**：`message_end` 的错误路径与那个清理路径（后者原本是唯一持有分类的地方，却只记状态码）。
- **R4** 记录里的原因**必须有人读**：`ProviderOutcome` 增加 `failureKind?` / `failureReason?`，`readFailures` 从 provider 记录里取出来。分类与 provider 自己的说法**并列**而不是合并 —— 状态码是边界看到的，kind 是 Dove 推断的。
- **R5** 非错误轮不得挂上原因（`lastProviderFailure` 虽有清理点，也不能靠它；`message_end` 里按 `stopReason` 取值）。

## Acceptance Criteria

- [x] **先红**：`tests/pi-adapter.test.ts` 新用例（`records why a provider round failed…`）在改实现前红在"记录说出 kind"上；改后绿。它驱动 429 文本 → 断言记录里 `failureKind === "transient"`、`failureReason === "http_429"`。
- [x] **读者也钉住**：`tests/failure-reading.test.ts` 新用例断言 `reading.failures[0].provider` 深等于 `{stopReason, failureKind, failureReason}`。
- [x] `npm run typecheck` 干净。
- [x] 受影响的 5 个套件（failure-reading / spec-anchors / document-drift / harness-surface / spec-context-budget）**55 项全绿**。
- [x] `npm test` 全量：除那条**已知**的索引预算红（`22627 > 20000`，见 `10-05-turn-cost-readings/findings.md` §八/E3）外无别的失败 —— 新增两条用例都在其中通过。
- [x] 挂载点引文按**文件实际位置**修好（这次位移部分来自另一个会话的提交 `9921ba3` 改了同一个文件）。

## Out of Scope

- 把 `usage: {httpStatus}` 改成独立字段（它有读者，见"一条被推翻的初判"）。
- 把 provider 的错误**原文**写进账本（长度与不可信文本是另一个决定；本次只记封闭词汇表的分类）。
- 那条索引预算红（另一个问题，已在别处记录）。

## Open Questions

（无。）
