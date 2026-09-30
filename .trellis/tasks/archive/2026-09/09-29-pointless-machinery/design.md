# Design — 哪些机制该删、该留、该重做

## 1. 一句话

先做一个实验回答"重试会不会重跑工具"（它决定 R0 是安全机制还是纯成本），再按结果处置 R1–R5；
共同的原则是：**判定只留一处，有意的差异写成断言，无害的默认不再静默。**

## 2. 决定性的前置：R0 的实验（必须最先做）

**为什么它排第一**：Dove 拒绝在非幂等效果之后重放的**唯一**理由是"可能把副作用做第二遍"。
P7 说 Pi 的重试是 `agent.continue()` —— 切掉失败的 assistant 消息后**带着已有 `toolResult` 续跑**，
工具不会重跑。若成立，Dove 的拒绝换来的是纯成本（本会话两次真实会话都被一次 503 打死）。
**P7 是读代码得出的、研究方明确标注未经运行验证**，所以必须实验，不能采信。

**实验设计**：驱动一个**真实的** Pi 会话，provider 第一次调用返回可重试错误、第二次成功，
中间有一次会留下痕迹的工具调用（例如写一个文件、或让工具自己计数），然后断言该工具**执行了几次**。

- 首选落点：新增一个聚焦测试，直接用 `pi-agent-core` 的会话 + 一个 flaky 的 stub provider + 一个计数的工具。
- **可行性风险（如实标注）**：构造 `AgentSession` 的环境（model runtime / provider 注册）可能需要比预期多的接线；
  若证实不可行，退路是**用现成的黑盒 harness**（`scripts/real-dove-blackbox.mjs`）跑一次
  "工具已执行后发生可重试错误"的情况，从 `tool_execution_start` 的出现次数读答案。
- **判据**：工具执行 **1 次** → P7 成立（走分支 A）；执行 **2 次** → P7 被推翻（走分支 B）。

**分支 A（工具只跑 1 次）**：Dove 的"非幂等后拒绝重试"**没有安全收益**。处置：
保留"记录并告知"（D4 的成果），但**不再打断 Pi 的重试**；把 `nonIdempotentEffectStarted` 从重试判据
降级为**记录项**。这是一次 fail-closed 语义的放宽，因此**必须**同时新增一条断言钉住新行为，
并在 `personal-agent-request-runtime.md` 的 retry 契约里改写理由。
**分支 B（工具跑了 2 次）**：P7 被推翻，Dove 的拒绝是**真需要**的。处置：拒绝保留不动，
把 P7 的证伪结论写进 retry 契约（防止下一个人再拿它当理由去放宽），R0 结案为"留"。

**两个分支都不改的一件事**：`retryable: false` 仍留在终止信封里（C7 的做法）。

## 3. R3 — 判定收到一处，差异变成断言

**选**：新增一个模块（如 `src/core/invocation-disposition.ts`），导出**一个**分类函数，
返回**具名**结果而不是布尔：

```ts
type Disposition = "read-only" | "mutating" | "unknown";
type Basis = "declared" | "name-table" | "command-text" | "effect-record";
interface InvocationDisposition { disposition: Disposition; replaySafe: boolean; basis: Basis; }
```

- 两张名字表（`REVIEWED_IDEMPOTENT_PI_TOOLS`、`FORMAL_PRODUCT_MUTATION_TOOLS`）合并成**一张声明表**，
  每项写清 `{ readOnly, replaySafe }`。**这就是删而不是加** —— 两张表合成一张，比现在少一个漂移面。
- 两个消费者（冻结闸门、重试策略）**都**从这一个函数取值，各自**显式**决定 `unknown` 怎么办；
  两个选择都写成断言，且注释写明**为什么不同**（冻结闸门是工作流闸门，不是安全边界 —— `extension.ts:2716-2718`）。
- 命令文本那条判据（`isReadOnlyShellCommand`）**只**服务于冻结闸门，并在返回值里以
  `basis: "command-text"` 标出来 —— 让"这条判定不足以支撑重放安全"成为**类型可见**的事实，而不是注释里的提醒。

**否**：只写文档说明差异（用户已选 B）。**否**：让冻结闸门也 fail closed（用户已排除：会把工作流闸门变成
安全边界）。**否**：让重试也吃命令文本（实测三个假阳性：`git branch -D`、`find -delete`、`sed 'w file'`）。

**与 Pi 的关系（P8）**：`pi-agent-core` 已经**设计**了 `HarnessTool.replay: "never"|"safe"` + 逐次调用持久化，
但它**是 stub**（每个方法抛 `HarnessNotImplemented`）。所以：
- **不在 0.84.3 上构建**（会踩空）；
- 但**按它的形状命名**（`replaySafe` 而不是 `idempotent`），并写下将来可以迁移 —— Dove 的 effect-claim
  存储与 Pi 的 `ToolStartedRecord` 是同一个想法，届时是替换而不是重写。

## 4. R1 — 删掉 `/status full` 里重复的 `Snapshot=`

**选**：从拼接里去掉 `${JSON.stringify(strategy)}`，保留短形式 `strategy=idle mode=standard(user) …`
与 `providerRounds=`/`readOnly=` 那一段。

**理由**：它的内容**已经在 ledger 的 `request.planned.details.strategy` 里**
（`execution-ledger.ts:508` 写入、`:159` 读回 —— 而 `/status full` 读的**就是**这份 projection）。
把刚读出来的结构化数据再序列化回一条**有 2048 字符上限**的通知，既重复又挤掉只存在于此的三个字段。
**D1 当初只是把顺序挪了一下 —— 那是治症状。**

**代价与替代**：想看完整快照的人仍可从 ledger 读（`/status full` 已经是"读 ledger 那一条命令"）。
**否**：提高 2048 上限（D1 的 design 已否过）。

## 5. R4 — `listUnresolvedClaims` 要么补测，要么删

**选**：先补上缺的那一支测试（加载 work mode + 重试被拒时列出未解决 claim，含**读不出的 record 被点名**）。
**理由**：AC-5 的规矩是"每个修复都要有一条在修好前会红的断言"；这条分支现在**零覆盖**。
**但**：R0 走分支 A 时这条路径本身可能消失 —— 所以**顺序是 R0 先跑**，分支 A 下改为随路径一起删，
分支 B 下补测。**不先测再跑 R0**，否则可能白写。

## 6. R5 — 一致性检查从"数数"升级为"比命令"

**选**：`frontDoorDrift` 除现有三个计数外，再比对**两份 README 里代码围栏内容的摘要**。

**理由**：命令是**语言无关**的 —— 同一段 powershell 在中文和英文 README 里必须逐字相同。
所以"围栏内容"是可以**有意义地**跨语言比较的东西，而"标题文本"不能。
这正好抓住真正会发生的漂移：一条命令只在一份里被改了（`document-drift.test.ts:380-381` 自己承认
"a command changed in one language and not the other, passes"）。
**否**：比标题文本（那是翻译，会误报）。**否**：取消两份 README（用户没要求，且中文读者需要一份）。

## 7. R2 — provider-round "budget"（产品口味，给处置建议）

**建议：保留计数器，删掉"预算"与告警。**
- 删：`providerRoundBudget()`、`effectiveProviderRoundBudget()`、`providerRoundLimit`、告警与告警标志。
- 留：`currentRequestProviderRounds`（它是资源观测，是数据）与 `/status` 里的 `providerRounds=`。
- 理由：一个**不可能阻止任何事**的东西叫"budget"并在 `/status` 里显示 `used/limit`，是在承诺它做不到的事；
  而它盯的现象（循环空转）**已经**由语义重复守卫真正终止。删掉它是**减少**机制，不是增加。
- 代价：`/status` 少一行 `limit`；`tests/pi-adapter.test.ts:1080` 那条纯函数用例随之删除。
- **替代**：若你更想留，则应把它**改名**（`providerRounds` 观测阈值）并明写"从不中止"，不要叫 budget。

## 8. 兼容与回滚

| 改动 | 风险 | 回滚 |
|---|---|---|
| R0 分支 A（放宽重试） | **安全语义**改变；必须同时改 retry 契约与断言 | 恢复 `retryDecision` 的那一行判据 |
| R3 新模块 | `tool_call` 与重试都是热路径；两张表的合并必须**行为等价**或**有意的差异** | 删新模块，恢复两张表 |
| R1 删 Snapshot | 用户可见文本变短 | 恢复拼接 |
| R4 补测/删 | 小 | 删测试 |
| R5 加围栏比对 | 可能立刻抓到**现存**的双语不一致（那正是它的用处） | 去掉那一项比对 |
| R2 删预算 | 删掉导出的纯函数与一条用例 | 恢复函数与用例 |

- 无新的**运行时**持久化格式（AC-6）。R3 只重组判定，不写新状态。
- **`carriedConfig`、`tool_call` 闸门本身、两处互斥的轮次递增、Pi 自己的 `models-store.json` 一律不动**
  （D 组：它们不是冗余）。

## 9. 已知不做

- 引入沙箱（C2：原生 Windows 不支持）。
- 在 0.84.3 上构建 `AgentHarness`（P8：stub）。
- 照抄 Pi 的只读工具集选择（P9：Dove 的前四项**已经**与 `createReadOnlyTools` 逐字相同 —— 它是对的）。
- 把 `isReadOnlyShellCommand` 接到重试安全上（三个实测假阳性）。
