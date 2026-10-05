# 一次带 provider 的 field run：缓存那条测出来了，而且答案改了问题的形状（2026-10-05）

## 一、跑了什么

- 命令：`node scripts/real-dove-blackbox.mjs --launcher source --provider real --cwd . --scenario tests/fixtures/scenarios/read-only-audit.json --case-id read-only-audit --output %TEMP%\dove-cache-run\reading.jsonl --timeout-ms 900000`
- 场景：`read-only-audit` —— 8 个场景里**唯一**声明 `requires: a real provider` 的那个；4 步（一次真审计 + `/status` + `/status full` + state）。
- Provider：本机 `~/.pi/agent/models.json` 里的 `ant`（`Atria-Dawn-Preview`，200k 窗口）。先用 `GET /v1/models` 确认认证（HTTP 200）才跑。
- 证据：`%TEMP%\dove-cache-run\reading.jsonl`（362 KB / 2107 行），**在仓外**，按 field-run 规范 §2 不提交。凭据由机器上既有的配置提供，运行本身没有把任何密钥写进日志（runner 只记 `carriedConfig` 的三个**文件名**）。

## 二、这一轮的读数（实测，逐项可回查）

| 读数 | 值 |
|---|---|
| `exitCode` / `settled` / `harnessTimedOut` | `0` / `true` / `false`，`durationMs` **436,587**（7.3 分钟） |
| `providerRounds` / `toolCalls` | **15** / **20** |
| `inputTokens` | **263,705** |
| **`cacheReadTokens`** | **0** |
| `cacheWriteTokens` | **0** |
| `outputTokens` / `reasoningTokens` | 4,674 / 3,625（推理占 output **77.6%**） |
| 缓存诊断行 | `Last CH 0.0% · Warm CH 0.0% · Recent5 RH 0.0% · Session CH 0.0% · R 0 · W 0 · 13 full misses` |
| `stopReasons`（15 轮） | 14 × `tool_call`、**1 × `error`**、1 × `completed` |
| 策略快照读数 | **`prompt=28340`**、`readOnly=4`、`providerRounds=15` |
| `providerEvidence` | `[]`（空） |

## 三、结论一：0% 在这台 provider 上**不可归因于我们**

**对照组**（`.trellis/.runtime/probe-provider-cache.py`，2 次调用、不经过 dove-pi）：同一个 **2,681-token** 前缀、只换最后一句问题，连发两次 —— 两次响应里 `usage.prompt_tokens_details.cached_tokens` 都是 **`None`**（该字段根本没出现），`prompt_tokens` 两次都是 2681。

也就是说这个 provider **不上报前缀缓存**。因此：

- 在它上面量出的 `cacheRead=0` **无法区分**"我们的前缀每轮在动"与"这家 provider 不报缓存"。
- 原本那条"缓存命中率 0% 是最大的成本杠杆"（`10-03-ten-million-token-project/findings.md` 优化点 1）需要**改口径**：那次是在**另一个** provider/模型上量的，所以两个方向都不能外推 —— 既不能说"我们前缀不稳"，也不能说"不是我们的问题"。
- 要把它变成可归因的读数，正确顺序是：**先测 provider 是否报缓存（成本 2 次调用，本页已给出方法），再测前缀是否稳定**。顺序反了就会像这次一样，先得到一个看起来像发现的 0。

## 四、结论二：`systemPromptChars` 的根因**定位了**，它不是 Pi 1.0.0 的问题

`providerEvidence` 为空不是"这个值变成 0 了"，而是**它在这条路径上根本没有写入者**：

- `scripts/real-dove-blackbox.mjs:95`：`const providerExtension = providerMode === "faux" ? writeFauxProvider() : undefined` —— 记录 provider 证据的那个扩展**只在 faux 路径上安装**，而 `providerCapturePath` 是 `writeFauxProvider()` 里 `appendFileSync` 出来的。
- 所以 `--provider real` 的每次运行里，`providerEvidence`（连同它的 `systemPromptChars`、`messageChars`、`toolCount`）**必然为空**，与 Pi 版本无关。

这条直接回答 `10-03-blackbox-prompt-chars`（仍 `planning`）:"在 Pi 1.0.0 上不再为正、根因未定位"——**根因是记录器只装在 faux 那一条腿上**。修法有两条：(a) 给 real 路径也装一个记录扩展；(b) 不再依赖它，因为产品内现在有 `prompt=` 这个读数（本轮 S3 加，并在**这次真跑里第一次生效**：`prompt=28340`）。**本轮不改**，因为 (b) 已经把原先要它回答的问题答掉了。

## 五、顺带得到的两条观测（都不是本任务要测的，但都真实）

- **一次 provider round 以 `error` 结束**（15 轮里的第 6 轮），整轮仍 `completed`、`settled`、`exitCode 0`。这正是 D 级"三种未定位的宿主级硬停"那一族里最轻的一种，今天至少**有位置了**：它是一次 provider 轮的错误，而不是宿主崩溃。证据在仓外那条 `stopReasons` 里。
- **`modeBody=` 在这次运行里没有出现**，因为被复制的项目里没有 `.dove/mode.json`（没声明模式）—— 这是**正确行为**（无模式 → 无块 → 无读数），也顺带证明这个读数不是常量。

## 六、这次的代价

- 2 次 provider 调用（对照探针，2,681-token 前缀）+ 1 次 field run（15 轮、263,705 input tokens、7.3 分钟）。都在 `%TEMP%`，仓内没有任何原始证据。

## 七、把"前缀稳不稳"直接问出来：**15/15 稳，0% 不是我们这一侧的**（2026-10-05 追加）

原判断（`10-03-ten-million-token-project/findings.md` 优化点 1）最后一句是"**前缀为何不稳定，值得单独查一次**"。换一个上报缓存的 provider 本来是为了回答它 —— 但这个问题**不需要 provider 就能答**：我们自己的账本每一轮都记着前缀分析。

**读法**：`provider.request.started` 的 `details.cachePrefix` 带 `sequence` / `classification` / **`stablePrefix`** / `changes`（哪个组成变了、为什么），以及四个组成各自的 `digest` 与 `bytes`（`system` / `tools` / `doveContext` / `history`）。逐轮读那次真跑的账本（`%TEMP%\dove-cache-run\...\dove-state\execution.jsonl`，15 条 `provider.request.started`）：

| 读数 | 结果 |
|---|---|
| `stablePrefix` | **`true` × 15**（第 1 轮 `cold`，其余 14 轮 `stable-prefix`） |
| `changes` | **每轮都是空** |
| `system` 摘要 / 字节 | **1 个取值**，8,248 B × 15 |
| `tools` 摘要 / 字节 | **1 个取值**，9,819 B（17 个工具）× 15 |
| `doveContext` 摘要 / 字节 | **1 个取值**，8,584 B × 15 |
| `history` | 320 B → 91,956 B，**只追加**（`historyChange` 为 `initial` 一次、`appended` 十三次、`unchanged` 一次） |
| input tokens | 第 1 轮 4,181 → 第 15 轮 20,944，累计 263,705 |

**结论**：可缓存的三段（系统提示词、工具 schema、Dove 上下文）在整轮 15 次请求里**逐字节没动**，只有历史在追加 —— 这正是前缀缓存需要的形状。所以那个 0% **不是"我们的前缀在动"**：在这台 provider 上它由"provider 根本不上报缓存"解释（§三的对照），而 `10-03` 那次是在另一个 provider 上量的、其原始账本**不在本机**（`%TEMP%` 下最大的 12 个账本全是本日的），要复核它需要那台机器上的账本或那个 provider 的凭据。

**这条也说明一件方法论上的事**：能回答这个问题的机制**一直都在**（`cachePolicyVersion=3`、逐组成摘要、`stablePrefix`），只是没有人去读它；而当时给出的"值得单独查一次"被理解成"要再花一次钱跑一遍"。先把已有的账本读完，是第一顺序。

## 八、定位：那次 `error` 不是硬停，而是**记录写在分类之前**（2026-10-05）

### 那次发生了什么（好消息）

`read-only-audit` 那轮的第 6 个 provider round 以 `stopReason: "error"` 结束（`usage` 全 0、`durationMs=543`），**543 ms 的请求、2 ms 后 attempt 结束、2 s 后新 attempt 开始**：

```
21:24:21.093 provider.request.started    attempt #1
21:24:21.637 provider.request.completed  stopReason=error usage=0 durationMs=543
21:24:21.640 request.attempt.completed   outcome="transient-failure"
21:24:23.649 request.attempt.started     number=2 trigger="provider-retry"
21:30:32.484 request.terminal            reason="completed"
```

重试机制**工作正常**：错误被判为 transient、触发 provider 重试、第 2 次 attempt 跑完并 `completed`。所以它不是 D 级"未定位硬停"里的"整轮卡死"，而是一次**被正确处理、但无法事后解释**的失败。

### 真正的缺陷：原因在写记录之后才被算出来

| 位置 | 手上有什么 | 写/做了什么 |
|---|---|---|
| `src/pi-adapter/extension.ts:2984-3002` | `stopReason`、`observed.usage`、assistant 的 `message` | **写下** `provider.request.completed`（`stopReason`、真实 token 用量、cache、durationMs）——**没有任何失败原因字段** |
| `src/pi-adapter/extension.ts:3008-3011` | `message` | **八行之后**才 `lastProviderFailure ??= classifyAssistantProviderFailure(message)` —— 而分类就是拿 `message.errorMessage` 里的 `ECONNRESET`/`429`/`rate limit` 等文本算出来的（`:282-296`） |
| `src/pi-adapter/extension.ts:2519-2526` | 唯一**同时**持有 `lastProviderFailure` 的地方 | 但只写 `stopReason: "error"` + `usage: call.httpStatus === undefined ? undefined : { httpStatus: call.httpStatus }`；而且那时 `currentProviderCall` 已被 `:3006` 清空，所以它通常什么都不写 |

**所以那条记录写不出原因不是"漏了一个字段"，而是顺序决定的**：写记录时分类还没发生。分类结果只被用在本轮的重试决策（`:3011` 的 `retryDecision`）和 attempt 记录（`outcome: "transient-failure"`）上，**从未落到 provider 记录里**。attempt 记录说的是"属于 transient 这一类"，provider 记录说的是"出错了"——**两者都没说是哪种**（429？socket reset？5xx？）。

### 这不是孤例：全量 602 个账本，6 条错误记录，0 条带原因

扫 `%TEMP%` 下**全部 602 个** `execution.jsonl`：

| 读数 | 结果 |
|---|---|
| `stopReason: "error"` 的 provider 记录 | **6 条** |
| 其中写了具体原因（`failure`/`reason`/`code`/`httpStatus`/`message`）的 | **0 条** |
| 这 6 条的 `usage` 形状 | 全部是 token 形状 `('cacheRead','cacheWrite','cost','input','output','totalTokens')` |

两条附加事实：

- 其中一条 `durationMs = 300,010`（正好 5 分钟）、一条 `174,885`（约 3 分钟）—— **这就是 10-03 里"长静默与已死无法区分"的那种轮次**，而现在能说出它的形状：一次 5 分钟的 provider 轮，然后 `error`，原因无处可查。
- **`usage: {httpStatus}` 这个形状出现 0 次**：`:2522` 那个"唯一持有分类"的写入点在全部 602 个账本里**从未写下过任何记录**。也就是说：`usage` 这个字段在一个写入点放 token 数、在另一个（从未触发的）写入点放 HTTP 状态码 —— **一个字段两种含义**，正是本会话一路在关的那一类；而且它唯一能记的东西（状态码）几乎从不存在。

### 修法（未实施，等确认；S 号）

1. **把分类提到写记录之前**（`:3008-3009` → `:2984` 之后、`:2990` 之前），让记录在写的时刻就知道原因。
2. **给记录一个自己的字段**：`appendProviderRequestCompleted` 增加可选 `failure?: { kind, reason }`（`ProviderFailureClassification` 是既有且**封闭**的词汇表），`:2990` 与 `:2522` 两处都传。
3. **停止把状态码塞进 `usage`**：`httpStatus` 单独成字段，让两个写入点的形状一致（否则读者无法判断 `usage` 里是 token 还是状态码）。
4. **先红后绿**：在宿主 seam 上驱动一次带 `429`/`ECONNRESET` 文本的 provider 失败（`tests/pi-adapter.test.ts` 已有"provider status 优先于 abort 措辞"这类用例可循），断言账本记录**点出 kind/reason**；改之前它必须红在"记录里没有原因"上。

**为什么值得修**：这条不是行为缺陷（重试是对的），而是**可诊断性**缺陷 —— 今天问"那次为什么重试"只能得到"出错了"。它与本会话的主题一致：一个在手的结论（分类）没有被任何读者看得见。

## 九、对"换一个 provider 再跑一次"的答复（2026-10-05）


- 本机**只有一个 provider**（`~/.pi/agent/models.json` 里只有 `ant`，`auth.json` 是空的 `{}`），所以"换 provider"必须先由操作者提供凭据。
- 但上面 §七 已经把我们这一侧的问题答完了：**换 provider 不会再改变关于我们的结论**，它只能再确认一遍"那家 provider 报不报缓存"。
- 因此本次**没有**再花钱跑第二次：第二次的边际信息是 0，代价不是 0。若要**交叉验证**（用另一家上报缓存的 provider 确认 `cacheRead > 0` 确实会出现），需要操作者的凭据，那是一个明确的、可选的花钱决定。

