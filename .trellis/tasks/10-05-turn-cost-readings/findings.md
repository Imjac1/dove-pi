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
