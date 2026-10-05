# The resume flag should carry the conversation it is named for

## Goal

让 `--reuse-session`（配同一个 `--session-dir`）**真的把上一次的对话带进这一次**——这正是它的名字、README 原本那句话与夹具描述所声称的；**或者**，如果宿主的 RPC 模式从本脚本这条路上做不到，就把这个名字与声称收窄到它真正做的事，并**把原因量出来**（不猜）。

## Background（2026-10-05 实测，全部真 provider、真退出码）

| 跑 | 仪器 | 结果 |
|---|---|---|
| A | 黑盒，真 provider | 加 `max(a,b)`、用例覆盖两分支、`npm test` 2/2、提交 `5f2370b` |
| B | 黑盒，**新会话** | 问"上一次我们做到哪了" → **"不确定…所以不猜"** |
| B2 | 黑盒，**`--reuse-session` ＋ 同一个 `--session-dir`** | **同样"不确定，不猜"**；根里有**两个**会话文件；`sessionDir` 两次**完全相同** |
| C | **宿主的 `--session <A 的会话文件>`**（经 `bin/dove-pi.cjs`，同一工作区） | **"…新增了 `max(a, b)`…两条用例全部通过…提交号是 `5f2370b`"** —— **15 秒**，逐项说中 |

**本仓用例只守住了什么**：`tests/real-dove-blackbox.test.ts:543` 断言"两次 `sessionDir` 相等"＋"第二跑不是第一跑的 redelivery"，由 `faux` 守着——**它不可能断言模型记得**。所以 B2 的失败**不违反任何用例**，却违反了名字与声称。

**宿主有什么**：`--continue, -c`（Continue previous session）、`--resume, -r`、`--session <path|id>`、`--session-id <id>`、`--fork`、`--session-dir <dir>`（`pi --help` 实测）。黑盒构造的参数是 `--offline --mode rpc --session-dir <dir>` ＋ 扩展——**不含任何一个续跑开关**。

**未隔离**：黑盒没带过去的原因（Pi 的 RPC 模式语义 vs 脚本构造的参数）。**事实已量到，原因没有**——本任务不许用猜的补上。

**已在本轮做掉的部分**：声称已收窄（`README.md`、`README.en.md`、`tests/fixtures/scenarios/resume-across-runs.json` 的 `description` 与 `requires`），措辞改成"共享会话根，不带对话"。

## Requirements

- **R1 先隔离原因**：量出"是 Pi 的 RPC 模式不续、还是脚本没传开关"。可用的手段：给黑盒的启动参数加 `--continue` / `--session <file>` 后重跑，与宿主直跑（C）对照；**读数优先于推理**。
- **R2 二选一，都要有读数**：
  - (a) **让它续**：第二跑问同一句话，答出第一跑的函数、测试结果与**真实提交号**（判据同 `10-03-day-two-walk` 的第三轮）；
  - (b) **让名字与声称说真话**：把 `--reuse-session` 改成它真正做的事（或加一个真会续的新开关），并写明原因。
- **R3 不破坏既有断言**：`tests/real-dove-blackbox.test.ts:543` 那两条（共享 `sessionDir`、第二跑不是 redelivery）**仍然成立**；`--provider faux` 的确定性不受影响。
- **R4 夹具描述与用例对齐**：`resume-across-runs.json` 的描述要么被行为追上，要么保持收窄后的措辞——**两者不能又打架**。
- **R5 门禁不降**。

## Acceptance Criteria

- [ ] **AC-1（R1）** 原因被隔离：一条读数说明"哪一层没有续"（宿主/脚本），或明写"仍未隔离 + 已试过什么"。
- [ ] **AC-2（R2）** (a) 或 (b) 完成，且带读数（(a) 要含真实提交号；(b) 要含收窄后的措辞与原因）。
- [ ] **AC-3（R3）** `real-dove-blackbox.test.ts` 全绿（18 pass / 2 skip 基线不降）。
- [ ] **AC-4（R4）** 夹具描述与实际行为一致。
- [ ] **AC-5（R5）** 三连门禁与三道文档门不降。

## Out of Scope

- **Dove 自己的会话日志**（`dove-pi session record|list`）——那是另一件事，与宿主会话续跑无关。
- **TUI 里的交互式续跑**（本会话够不到；宿主自己已经支持）。
- **给 Pi 加功能**（宿主是上游；本任务只动本仓的脚本与措辞）。

## 出处

- 读数：`.trellis/tasks/10-03-day-two-walk/readings.md`（第三轮）
- 前门与夹具：`README.md`、`README.en.md`、`tests/fixtures/scenarios/resume-across-runs.json`
- 用例：`tests/real-dove-blackbox.test.ts:543`
- 台账第 8 条已按台账自己的规则**离开台账**（有 task 接手了）。
