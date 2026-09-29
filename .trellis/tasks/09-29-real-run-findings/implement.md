# Implement — 真实运行暴露的四件事

## 改动前必读（都是量过的）

| 事实 | 值 | 为什么重要 |
|---|---|---|
| 证据捕获上限 | 2048 字符（`scripts/real-dove-blackbox.mjs` 的 `redact()`） | D1 的依据：真实会话的 `/status full` 正好 2048 字符，在三个新字段之前截断 |
| 该次运行的事件类型 | `tool_execution_start` ×13，`tool_start` **×0** | D2 的依据 |
| 计数器递增点 | `extension.ts:3012` 的 trigger 守卫**排除重试**；重置（`:3139`）只在 `isNewRequest` | D3 的依据：8 次真实请求记成 1 |
| goals 行的来源 | ledger 的 `provider.request.completed`（`cache-diagnostics.ts:333`） | 两个数字量的不是同一件事 |
| 拒绝的作用域 | `retryDecision`（`request-lifecycle.ts:260`）读 lease 上的 `nonIdempotentEffectStarted`，只拒**同一次逻辑请求内的自动重试** | D4 的依据：重新提交本来就是允许的 |
| effect store 的形状 | 目录下 `<effectKey>.json`，每条是 `EffectRecord`（含 `tool` / `target?` / `outcome?`）；读不出即 `UnreadableClaimError` | D4 第 2 点的来源与它的 fail-closed 规矩 |
| 无 work mode 时没有 effect store | `activeEffectBoundary` 只在 mode 加载后创建 | 所以 D4 第 1 点（内存里累积非幂等动作）才是主路径 |

## 执行清单（按依赖顺序）

### 1. D1 — 调整 `/status` 的拼接顺序

- `src/pi-adapter/extension.ts:1217`：把 `${ledgerDetail}` 移到 `${strategyText}` **之前**。
- **不要**动 2048 这个界，也**不要**删 `Snapshot=` —— 它的完整内容在 summary 的 `strategy` 与 ledger 的
  `request.planned` 里另有一份，而 `ledgerDetail` 的三个字段**只在这条消息里**。
- 顺手在 `ledgerDetail` 定义处（`:1188`）写一句为什么它必须排在前面 —— 否则下一个人会"整理"回去。

**断言**（`tests/pi-adapter.test.ts`，沿用既有的 `/status full` 用例）：
断言 `LastPlan:` 的下标**小于** `Snapshot=` 的下标。这不需要真的触发 2048 截断，比断言长度更稳。

### 2. D2 — `extractToolNames` 认实际事件名

- `scripts/real-dove-blackbox.mjs:533`：接受 `tool_execution_start` **或** `tool_start`。

**断言**（`tests/real-dove-blackbox.test.ts`）：在既有的 `--progress-case changing` 用例里断言
`steps[0].toolNames` 包含 `"read"` 且非空 —— 今天它必然是 `[]`，所以这条断言在修好前会红。

### 3. D3 — 拆成两个具名计数器

- `extension.ts:783` 附近：`currentRequestProviderRounds` 保留（含义改为"本逻辑请求内真实发生的 provider 请求数"），
  新增 `currentRoundSinceProgress`（含义：观察阈值用的、重试不算新一轮）。
- `:3012` 的守卫**只**保护阈值告警与 `currentRoundSinceProgress`；`currentRequestProviderRounds += 1` 移出守卫、无条件执行。
- `:3015` 的阈值判断改读 `currentRoundSinceProgress`。
- `:2427` 的观测继续读 `currentRequestProviderRounds`（现在是真实轮数）。
- `:3139` 的重置两处一起清零。
- 在声明处写明两个变量**各自量什么** —— 这次矛盾的根因就是"一个变量承载两种含义"。

**断言**（`tests/pi-adapter.test.ts`）：驱动两个 provider 回合，断言观测里的 `providerRounds` 与
ledger 中该 `requestId` 的 `provider.request.completed` 条数**相等**。再补一条：阈值告警在重试时**不**提前触发
（保护 `:3012` 原本的语义，防止"顺手删守卫"）。

### 4. D4 — 把拒绝的终止信息变成可执行的

三部分，都在 `src/pi-adapter/extension.ts`：

1. **累积本请求的非幂等动作。** `tool_call` 里已经算出 `idempotent`；把 `!idempotent` 的工具名加入一个
   有界、去重的 `currentRequestNonIdempotentActions`（界用**具名常量**）。在 `isNewRequest` 处清零，
   并在 `agent_settled` 的清空清单里一并清掉（那个清单是 per-request 状态的唯一清理点）。
2. **未解决的 effect claim。** 新增一个小读取器（放在 `src/core/effect-store-file.ts` 旁边或该模块内导出），
   签名形如 `unresolvedClaims(directory, limit): Promise<{ tool; target?; effectKey; startedAt }[]>`：
   列目录、逐条读、取 `outcome` 缺失或 `unknown` 的；**读不出来的要如实点名**，不要静默跳过
   （该模块的 `UnreadableClaimError` 已经把这条规矩写死了）。目录来自 `activeEffectBoundary` 的 store 配置
   —— 若没有 work mode，就跳过这一部分并在消息里说明"本请求没有 effect 记录"。
3. **组装 `nextAction`。** 在 `terminalForFailure` 的**调用点**（`agent_end`）覆盖终端的 `nextAction`：
   列出非幂等动作、列出未解决的 claim（若有）、并**明说新请求是允许的**。
   保持 `terminalForFailure` 是纯函数（`agent_end` 才够得着 store 与 workspace root）。

**断言**（`tests/host-work-mode.test.ts` 或 `tests/pi-adapter.test.ts`）：
驱动一个非幂等工具调用（例如 `bash` 且非只读）后触发 provider 失败，断言终止信封的 `nextAction` 里
**出现该工具名**，且**含"新请求允许"之类可执行措辞**。再加一条控制：一次只做只读动作的失败，`nextAction` 不列任何动作。

### 5. 全量门禁

```powershell
npm run typecheck
node --import tsx --test tests/pi-adapter.test.ts tests/real-dove-blackbox.test.ts tests/host-work-mode.test.ts tests/effect-boundary.test.ts tests/request-lifecycle.test.ts
npm test
npm run test:installer
```

installer 的既有 4 个环境性失败**不得增加**（对照 HEAD 的同一命令，见上个任务的记录）。

## 风险文件与回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| `src/pi-adapter/extension.ts` | 四处改动都在这个 3530 行的文件里；`tool_call` 与 `agent_settled` 是热路径 | 四处各自独立，逐处可还原 |
| `scripts/real-dove-blackbox.mjs` | 13 个既有用例依赖它 | 单行改动 |
| `tests/pi-adapter.test.ts` / `tests/real-dove-blackbox.test.ts` / `tests/host-work-mode.test.ts` | 新增断言会拉长套件 | 删除新用例 |

没有新的持久化写入点，**回滚不需要清理状态**。

## `task.py start` 之前的自检

- [ ] `design.md` 的 D1–D4 每条都能在实现里指到具体行。
- [ ] `implement.jsonl` / `check.jsonl` 各至少一条真实 spec 条目。
- [ ] D3 的阈值语义**未被顺手改掉**（有断言保护）。
- [ ] D4 的 `nextAction` 有界（具名常量），且**读不出的 claim 被点名而非跳过**。
- [ ] 每个修复都有一条**在修好前会红**的断言 —— 否则它不是断言，是描述。
- [ ] 可选：修完后重跑一次真实会话确认端到端（会花钱，不是门禁）。
