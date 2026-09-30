# Implement — 哪些机制该删、该留、该重做

## 改动前必读（都是量过的）

| 事实 | 值 | 为什么重要 |
|---|---|---|
| `isReadOnlyShellCommand` 的假阳性 | `git branch -D feature`、`find . -name '*.tmp' -delete`、`sed -n 'w out.txt' in.txt` **全判成只读**（实测） | 所以它**不能**接到重放安全上 |
| 未知工具的两套默认 | 冻结闸门＝「不是改动」，重试＝「不可重放」（实测并排跑） | R3 要修的正是这个 |
| `Snapshot=` 的重复 | `execution-ledger.ts:508` 写入 `request.planned.details.strategy`、`:159` 读回，而 `/status full` 读的就是这份 projection | R1 删它的依据 |
| 门禁基线 | `npm test` **811 tests / 809 pass / 0 fail / 2 skipped**；`test:installer` **141 tests OK / 0 失败**；typecheck 干净 | AC 不得下降 |
| spec 预算 | 每份 routed spec ≤ 24 KiB（归一化）；router ≤ 8 KiB | 若本任务触碰 spec，必须仍在界内 |

## 执行清单（按依赖顺序，R0 必须最先）

### 0. R0 — 先做实验，它决定后面的形状

- 实验：真实 Pi 会话 + flaky provider（第一次可重试错误、第二次成功）+ 一个**会留痕**的工具调用；
  断言该工具**执行了几次**。
- 首选：新增聚焦测试，直接用 `pi-agent-core` 会话 + stub provider + 计数工具。
- **可行性风险**：构造 `AgentSession` 的接线可能比预期多。若证实不可行，**不要硬造** ——
  改用 `scripts/real-dove-blackbox.mjs` 跑"工具已执行后可重试错误"，从 `tool_execution_start` 次数读答案，
  并把"用哪条路、为什么"记进本文件。
- **判据**：1 次 → 分支 A；2 次 → 分支 B。**把实验产物（命令 + 读数）写进本文件**，因为它是结论的唯一依据。

**分支 A（工具只跑 1 次）**：
- `request-lifecycle.ts:260` 的判据从"拒绝"降级为"记录"：不再因 `nonIdempotentEffectStarted` 拒绝重试。
- 同步改 `personal-agent-request-runtime.md` 的 retry 契约：写明**为什么**原理由不成立（引用实验读数）。
- 新增断言：非幂等工具已执行 + 可重试错误 → 请求**继续重试**（今天会红）。
- D4 的"告知"成果保留（`nextAction` 仍说清发生了什么）——它不再是拒绝理由，而是记录。

**分支 B（工具跑了 2 次）**：
- 拒绝**保留不动**。
- 把**证伪结论**写进 retry 契约（防止后人再拿 P7 当放宽的理由），并给 R0 结案为"留"。

### 1. R3 — 判定收到一处

- 新增 `src/core/invocation-disposition.ts`：一个分类函数，返回 `{ disposition, replaySafe, basis }`。
- 两张名字表合并成**一张声明表**（`{ readOnly, replaySafe }` per tool）。
- 冻结闸门与重试策略都从这里取值；**各自显式**决定 `unknown`，两个选择都写成断言。
- `basis` 必须能标出 `command-text`，让"这条判定不足以支撑重放安全"类型可见。
- **先证明行为等价**（或差异是**有意且被断言**的），再删旧函数。

### 2. R1 — 删掉 `/status full` 里重复的 `Snapshot=`

- `extension.ts` 的 `/status full` 拼接去掉 `${JSON.stringify(strategy)}`；保留短形式 `strategy=… providerRounds=… readOnly=…`。
- 断言：`LastPlan:` / `LastTerminal:` / `Refused:` 仍存在；`Snapshot=` **不再**出现。
- 更新既有那条"顺序是契约"的断言 —— R1 之后排序不再需要为它让路。

### 3. R4 — 按 R0 的结果决定补测还是删

- 分支 B（或 D4 路径保留）→ 补上缺的那一支：加载 work mode + 重试被拒 → 列出未解决 claim，
  **含一条读不出的 record 被点名**（`UnreadableClaimError` 的规矩）。
- 分支 A 且路径消失 → 随路径一起删。
- **不要先写测试再跑 R0。**

### 4. R5 — 一致性检查从数数升级为比命令

- `tests/document-drift.test.ts` 的 `frontDoorDrift` 增加第四项：两份 README 里**代码围栏内容的摘要**比对。
- 命令是语言无关的，所以这项比对**有意义**；预期它会**立刻报出现存的不一致** —— 那是它的用处，不是失败。
- 用播种类用例证明它会红（该测试已有 `base` / `base + …` 的播种惯例）。

### 5. R2 — 按处置建议执行（若你采纳）

- 删 `providerRoundBudget` / `effectiveProviderRoundBudget` / `providerRoundLimit` / 告警与告警标志。
- 留 `currentRequestProviderRounds` 与 `/status` 的 `providerRounds=`。
- 删 `tests/pi-adapter.test.ts` 里对应的纯函数用例。
- 若不采纳 → 改名并明写"从不中止"，**不要**继续叫 budget。

### 6. 全量门禁

```powershell
npm run typecheck
node --import tsx --test tests/pi-adapter.test.ts tests/request-lifecycle-pi.test.ts tests/document-drift.test.ts tests/spec-context-budget.test.ts tests/harness-surface.test.ts
npm test
npm run test:installer
```

**验收点**：`npm test` 通过数**不得下降**（811/809/0/2 为基线；删用例会减少总数，需说明减少哪几条、为什么）；
`test:installer` 失败数**不得增加**（0）。

## 风险文件与回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| `src/core/request-lifecycle.ts` | 分支 A 会改 **fail-closed 语义** —— 本任务最危险的一处 | 恢复那一行判据 + 契约文字 |
| `src/core/invocation-disposition.ts`（新） | 两张表合并若不等价，冻结闸门或重试会静默改变行为 | 删新模块，恢复两张表 |
| `src/pi-adapter/extension.ts` | `/status` 拼接、闸门取值点、R2 的删除都在这个 3652 行文件里 | 逐处独立可还原 |
| `tests/document-drift.test.ts` | 新比对可能立刻抓到既存不一致（预期如此） | 去掉那一项 |
| `pi-adapter.test.ts` / `request-lifecycle-pi.test.ts` | 删/改用例 | 恢复用例 |

无新的**运行时**持久化写入点，**回滚不需要清理状态**。

## `task.py start` 之前的自检

- [ ] R0 的实验**先跑**，产物（命令 + 读数）写进本文件；分支已判定。
- [ ] 若走分支 A，retry 契约文字与代码**同时**改，且新断言在改前会红。
- [ ] R3 的行为等价性**有证据**；两张表合并前后的判定逐项对照过。
- [ ] `unknown` 的两个不同默认**各有一条断言**，且注释写明为什么不同。
- [ ] R1 之后不存在 `Snapshot=`，且三个 ledger 字段仍在。
- [ ] R4 的取舍与 R0 的分支一致（没白写测试）。
- [ ] R5 的新比对**被证明会红**（播种类用例）。
- [ ] 门禁数与基线一致（或减少的用例被逐条说明）。
- [ ] D 组五条**未被误改**。

---

## R0 完成记录（实验已跑，2026-09-29）

**结论：P7 成立 —— Pi 的自动重试不重跑已经执行过的工具。** 所以分支 A 适用于 **provider-retry**。

**方法**：raw Pi（**完全不加载 Dove**，因为问题问的是 Pi 的行为，不是 Dove 逼出来的行为）
加一个注册了脚本化 provider 的扩展：

1. provider 调用 #1 → assistant 发出 `bash` 工具调用
2. provider 调用 #2 → `stopReason: "error"` + `errorMessage: "503 Service Unavailable"`
   （匹配 `pi-ai/dist/utils/retry.js:20` 的 `RETRYABLE_PROVIDER_ERROR_PATTERN`）
3. provider 调用 #3 → 成功收尾

`bash` 的命令是 `echo tick >> probe-count.txt`（每次执行追加一行）；provider 包装器每次调用也追加一行。
所以"工具跑了几次"是**可直接数出来的**，不依赖事件解读。

```text
provider calls : 3        <- 重试真的发生了（不是空跑）
tool executions: 1        <- 工具没有重跑
counter file   : 一行 "tick"
verdict        : P7 HOLDS
```

**可复现命令**：

```powershell
$env:PI_CODING_AGENT_DIR = "<root>\agent"
Set-Location "<root>\project"
node node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js `
  --provider probe --model probe-model --extension "<root>\probe.mjs" `
  -p "Run the probe command, then stop."
# 读数：provider-calls.jsonl 的行数 与 probe-count.txt 的行数
```

（`<root>` 是 setup 脚本生成的临时目录；扩展注册 `probe`/`probe-model`，三条脚本化响应如上。）

### 本轮才发现的一个限制 —— 原批准的设计里没有

**这次证明的是 `provider-retry`。** 但 Dove 自己把触发器分成 `provider-retry` 与 `compaction-retry`
（`extension.ts` 的 `attemptTrigger` 判据），而研究指出 **overflow 恢复（compaction）时会重发 prompt**
（`pi-coding-agent` 的 `willRetry` on `session_before_compact`）—— 那条路上模型**可能**重新发出工具调用。

**所以分支 A 必须收窄**：只放宽 `provider-retry`；`compaction-retry` **保持拒绝不变**，
它需要**它自己的实验**（用同样的方法，把失败换成 `session_compact` 的 `willRetry`）。

这仍然解决真实痛点：本会话两次真实会话都死于 provider 503，触发器**就是** `provider-retry`。

**这也意味着方案有实质变更** —— 按 Trellis 的规矩，批准后工件实质变更要重走一次终审。

### compaction-retry 的第一次尝试：**未定论**（不是"成立"）

同法跑了一次，把失败注入点换成"把 faux 模型的 `contextWindow` 调到 1024，逼 Pi 走 compaction"。
扩展同时订阅 `session_before_compact` / `session_compact`，**所以"没走那条路"能被看出来**：

```text
before_compact  : false
compacted       : false
provider calls  : 2      <- 只有"工具调用 → 收尾"，根本没有重试发生
tool executions : 1
verdict         : INCONCLUSIVE（compaction 这条路根本没被走到）
```

**这一次的 1 次执行什么都不能证明** —— 没有重试，就没有"重试是否重跑工具"的问题。
（第一次走 SDK 那次也是同类陷阱：0 次 provider 调用却打印出"P7 成立"。两次都靠把计数打出来才没被读成结论。）

**下一步（可照做）**：`contextWindow: 1024` 不够触发。改用**巨大的工具结果**把观测 token 顶上去 ——
例如让 `bash` 输出约 100 KB（`for i in $(seq 1 5000); do echo "line $i padding..."; done`），
Pi 才会判定需要 compact。判据不变：`session_compact` 必须为 true，否则**仍是未定论**。

**在它定论之前**：`compaction-retry` 的拒绝**保持不动**。

---

## Phase 2 执行记录（2026-09-29）

### R3 行为等价性：**48 个用例逐项对照，0 处不一致**（探针已删）

一个临时探针（`tmp-equivalence.mts`，跑完即删）把**改动前**的逻辑逐字抄进来当对照：
两张名字表 + 内联的闸门表达式 + `isPiToolInvocationIdempotent`；主体是 `classifyInvocation`。
每个用例是一**次调用**，两个答案并排打印，所以不一致是**读出来的**而不是被断言掉的。

```powershell
node --import tsx tmp-equivalence.mts
```

```text
bash {"command":"git branch -D feature"}   gate false false ok  replay false false ok  read-only/command-text
bash {"command":"find . -name '*.tmp' -delete"} 同上
bash {"command":"sed -n 'w out.txt' in.txt"}    同上
agent_run_capability {"name":"no.such_capability"} gate false false ok  replay false false ok  unknown/declared
agent_run_recipe {"name":"no.such_recipe"}         gate true  true  ok  replay false false ok  mutating/declared
third_party_unknown {} / mcp_some_server_write {} / ask_user_question {}   gate false false ok  replay false false ok  unknown/name-table
EQUIVALENT on 48 cases
```

**这 48 行覆盖了 D 组要保留的两处有意不对称**：`agent_run_capability` 指不到能力 → `unknown`（闸门放行），
`agent_run_recipe` 读不出 → `mutating`（闸门拦下）。两处**改动前后相同**，并被
`tests/invocation-disposition.test.ts` 各钉了一条断言。

**等价的是判定，不是全部行为**：闸门对未知工具**依旧放行**，但不再静默 ——
`extension.ts` 现在为它写一条 `gate: "undetermined-disposition"` 的 ledger 记录并通知。
这是 D-B 要的"点名"，**不是**判定改变；`unknown` 在重试侧仍然 `replaySafe: false`。

### 逐条落地

| 条 | 落地 |
|---|---|
| **R0** | 分支 A **收窄到 `provider-retry`**：`request-lifecycle.ts:257` 去掉 `nonIdempotentEffectStarted` 判据（效果留在 lease 上作记录）；`compaction-retry` 改为在 `session_before_compact`（`willRetry`）用 `{ cancel: true }` 拒绝 —— 那是 Pi 自己的、可取消的边界。契约文字与代码同时改（`personal-agent-request-runtime.md` 的 retry 段 + 决策表 + Good cases）。 |
| **R1** | `/status full` 拼接去掉 `Snapshot=${JSON.stringify(strategy)}`；`pi-adapter.test.ts` 的"顺序是契约"断言换成"`Snapshot=` 不再出现 + `strategy=` 仍在"。 |
| **R2** | 删 `providerRoundBudget` / `effectiveProviderRoundBudget` / 阈值告警 / 两个告警标志 / `isMeaningfulToolProgress` 与其用例；`currentRequestProviderRounds` 与 `/status` 的 `providerRounds=` 保留，`used/unknown` 改成只印计数（`strategy-snapshot.ts`）；spec 的"provider budgets"措辞与两份 README 的 `provider-round-budget` 行一并删。 |
| **R3** | 新增 `src/core/invocation-disposition.ts`：一张声明表（`{readOnly, replaySafe}`）+ `classifyInvocation` + `basis`；两个消费者各自显式决定 `unknown`；`declaredReadOnly` / `declaredMutatingToolNames` 是同一张表的两个只读视图（`fence-drift.test.ts` 改从这里取名字，不再有第二份拷贝）。 |
| **R4** | 路径**保留**（compaction 守卫），所以补测而非删：`host-work-mode.test.ts` 新增一条 —— 加载 work mode + 非幂等效果 + **一条读不出的 claim**，断言拒绝消息逐条点名两者并标 `record unreadable`。 |
| **R5** | `document-drift.test.ts` 的 `frontDoorDrift` 增加第四项：两份 README **围栏内命令**的比对（去注释、排序、语言无关）。它**第一次跑就抓到既存漂移** —— 英文 README 少记 9 个 `dove-pi task` 子命令与 2 个 session 命令，已补；另有播种类用例证明它会红。 |

### 门禁（与基线对照）

```text
npm run typecheck   clean
npm test            815 tests / 813 pass / 0 fail / 2 skipped   （基线 811/809/0/2）
npm run test:installer  141 tests OK / 0 失败
```

**总数 +5 的来历**（`npm test`）：删 3 条（`providerRoundBudget`、`isMeaningfulToolProgress` 两条纯函数用例，
以及搬到 `invocation-disposition.test.ts` 的那条），新增 8 条（新模块 6 条 + R4 1 条 + 闸门"未判定即点名" 1 条）。
`fail` 与 `skipped` 与基线一致，没有用例被改成空跑。终值：**816 / 814 pass / 0 fail / 2 skipped**。

---

## Phase 3.3 spec 更新记录（2026-09-29）

**先量预算再写**：`spec-context-budget.test.ts` 对每份 routed spec 硬性要求归一化后 ≤ 24 KiB，而
`personal-agent-request-runtime.md` 只剩 **16 B** 余量（24,560/24,576），`personal-agent-harness-loop.md` 只剩 270 B。
所以这次 spec 更新**没有写进 request-runtime**（R0/R2 的契约文字本轮之前已在里面），而是写进了有余量的三份：

| spec | 写入了什么 | 缘由 |
|---|---|---|
| `personal-agent-framework-core.md`（21,005 → 22,591） | Gate Boundary 的 Contracts 增加"一个分类器两处读法"与"未判定即点名"两条；`command-text` 不足以支撑重放安全；Tests Required 指向两个测试文件 | R3 改变了判定所在的位置，并让 `unknown` 的两个默认成为**被断言的**决定 |
| `personal-agent-extension-runtime.md`（15,309 → 16,037） | `/status` 契约增加一条硬规矩：状态行**不得携带 ledger 已有投影的序列化副本**（2048 字符有界证据） | R1 的病因是重复，不是顺序；这条规矩是防下一份 `Snapshot=` |
| `personal-agent-field-run.md`（8,619 → 9,217） | 给那条真实读数加注：`retry-refused-after-effect` 是**当天的历史**，R0 之后只对 overflow 重放生效 | 读数不可改写，但可以被误读成当前行为 |

**没有更新的**：`personal-agent-request-runtime.md`（预算只剩 16 B，且契约文字本轮之前已改）、
`quality-guidelines.md`（没有新的禁止模式）、`guides/*`（这次没有产生"写代码前该先想什么"的新清单项）。

**写到一半被检查纠正的一处**：闸门的未判定记录最初写 `action: event.toolName` / `viaCapability: false`，
而同一调用的拒绝记录写解析后的 action —— 同一次调用会读成两条不同记录。已改为 `resolveActionIdentity`。

