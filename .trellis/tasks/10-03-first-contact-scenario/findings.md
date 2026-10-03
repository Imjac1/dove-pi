# 第一次接触：一轮真实走查的问题与优化点（2026-10-03，全部实测）

## 第二轮补测（2026-10-03 晚）：把"被拒"这条腿走通了 ✓

### 机制（量到的 ✓，不是猜的）

- **用户设工作模式的文件** ✓：**`<项目>/.dove/mode.json`** ✓（`WORK_MODE_DECLARATION = join(".dove", "mode.json")` ✓，`work-mode.ts:869` ✓）；同目录另有 `.dove/workspace.json` ✓（`workspace-policy.ts:22` ✓，**一个关注点一个文件** ✓）。
- 它带 `malformed` 与 `workModeRefusal` 的区分 ✓ —— 产品在这一层**已经有**"声明了却读不到"与"什么都没声明"**不合并**的纪律 ✓✓（本仓前两个任务清的那一套 ✓）。

### **正面发现 ✓✓：治理是真的，而且对照组证明了它**

| 跑法 | 结果 |
|---|---|
| **声明 `code-audit`** + "创建一个新文件 hello.txt" | **4 次工具调用全部被拦** ✓ · **磁盘上什么都没落** ✓ · exit 0 ✓ · `agent_end`/`agent_settled` 都有 ✓ |
| **不声明模式** + 同一请求（对照 ✓） | **`hello2.txt` 真的被创建** ✓ · exit 0 ✓ |

→ **同一请求，有模式被拦、无模式放行** ✓✓ —— 这是"受治理"这件事**第一次被端到端地证明** ✓（不是只跑测试 ✓，是真宿主 + 真模型 + 真闸门 ✓）。

### **负面发现 ✗✗：闸门的"理由"到不了用户手上**

同一个被拒的回合，**两种输出模式下用户看到的东西完全不同** ✗：

| 输出模式 | 用户看到的 |
|---|---|
| **默认（text）** | 一个字：**`terminated`** ✓ · **exit 1** ✗ —— **没有原因、没有出何去何从、没有任何"你刚才被拒了什么"** ✗✗ |
| **`--mode json`** | 事件流正常 ✓（`toolcall_start/end` ×4 ✓），最后由**模型自己**去解释 ✓：*"Every tool call … is being blocked by the sa…"* ✗ —— 这是**模型的转述** ✓，不是闸门的原话 ✗✓ |

**而理由其实存在** ✓：本仓确实把拒绝写进账本 ✓（`appendGateRefused` ✓）—— 所以**机器有、用户没有** ✓✗✓。
**这就是那条新发现（P9）** ✓，而且是本会话反复清掉的同一族（"拦住了，但没人知道为什么/没人知道拦的是哪条" ✗）—— 这次长在**用户可见的输出**上 ✓。

### 另一条新发现（P10 ✗）：非交互下斜杠命令**静默空转、退出码 0**

`-p --mode json "/status"` ✓ → **exit 0 ✓，整个事件流只有一条 `{"type":"session"}`** ✓ —— **命令没执行、没有输出、没有报错** ✗✓。
一个把 `/dove-mode …` 写进脚本的人会得到**看上去成功**的空转 ✓✓（静默失败 + 0 退出码 ✓）。

## 走了什么（命令 + 结果）

| 步 | 命令 | 结果 |
|---|---|---|
| 1 | `node bin/dove-pi.cjs --version` | **`Dove Pi 0.2.0 (Pi 1.0.0)`** ✓ |
| 2 | `node bin/dove-pi.cjs --help` | 一套托管安装生命周期 ✓（`update` / `repair` / `rollback` / `uninstall` ✓） |
| 3 | **`node bin/dove-pi.cjs doctor`** | **exit 0 ✓**，输出 JSON ✓（node / platform / shell / workspace / powershell / tools / managedInstall / diagnostics / adapters ✓） |
| 4 | 真宿主非交互一回合 ✓：`pi -p --provider ant --model Atria-Dawn-Preview --no-session -e <repo>\.pi\extensions\personal-agent.ts "…用 read 工具读 AGENTS.md…"` | **exit 0 ✓**，输出文件第一行 ✓ → **真 provider ✓ + 工具调用真的发生 ✓ + 本仓扩展被加载 ✓** |
| 5 | 斜杠命令探针：`-p` 的提示以 `/dove-mode` 开头 | exit 0 ✓，但**无法区分**"命令被执行"与"模型忽略了这行文字" ✗ → 见 P10 ✓（第二轮已定论 ✓） |
| 6 | 驱动脚本：`node scripts/real-dove-blackbox.mjs --provider faux --launcher <repo>\bin\dove-pi.cjs …` | 驱动**跑了** ✓，产出 1484 B 汇总 ✓，但 `stderr`: **`'dove-pi.cmd' is not recognized…`** ✗ |
| 7 | **声明工作模式后跑真回合 + 对照组** ✓ | 见上 ✓：**治理成立** ✓✓ / **理由不到用户** ✗✗ |

## 问题（按严重度 ✓）

### P1（高 ✗）**`pentest` 模式的工具在这台机器上不存在，而且没有任何东西会告诉用户**
`doctor` 实测：`tools: { git: ✓, **nmap: null ✗**, ssh: ✓, docker: ✓, **hydra: null ✗** }` ✓ —— 而 `modes/pentest` 是**已发布模式** ✓。
用户选了它 ✓，直到真的需要 `nmap`/`hydra` 的那一刻才会**撞墙** ✓，而**没有任何前置提示** ✗。
**这正是本仓前两个任务清掉的同一族缺陷**（"声明了、但兑现不了/不会报警" ✗✓）—— 只是这次长在**运行时环境**上 ✓。
**优化点** ✓：模式加载时**对照 `doctor` 的工具清单** ✓，缺什么就**当场说**（哪一条能力会因此不可用 ✓）。

### P2（中高 ✗）**工作模式只能在交互里选，脚本化没有杠杆**
grep ✓ 无任何 `DOVE_PI_MODE` / 等价环境变量 ✓；选择入口只有 **`/mode`**（`auto|chat|work` ✓）与 **`/dove-mode`**（L1087 / L1103 ✓）。
→ **CI、场景套件、以及我这次的走查都设不了工作模式** ✗✓（P3 的探针也因此结论不足 ✓）。
**优化点** ✓：给一个**非交互杠杆**（env 或 flag ✓），并让它与 `/dove-mode` 走**同一条解析** ✓（否则又多一处会漂移的重复 ✓）。

### P3（中 ✗）**`-p` 下斜杠命令是否执行，未证实**
一次探针不够（见上表第 5 行 ✓）。**这是 P2 的孪生问题** ✓：若 `-p` 真支持斜杠命令 ✓，P2 就有了便宜解 ✓；若不支持 ✓，就必须新开杠杆 ✓。
**优化点** ✓：用 `--mode json` 跑一次，看事件流里有没有命令执行记录 ✓（一次调用即可定论 ✓）。

### P4（中 ✗）**`managedInstall.installed: false`，但 `--help` 承诺了 `update` / `repair` / `rollback`**
`doctor` 实测：`installed: false ✓`，`root: %LOCALAPPDATA%\DovePi ✓`，`extensions: [] ✓`。
一个刚拿到它的人 ✓，会看到 `--help` 讲"原子更新 / 修复 / 回滚" ✓，而 `doctor` 说**根本没装** ✗ → 那三条命令对他**含义不明** ✓。
**优化点** ✓：`doctor` 在未安装时给**一行人类可读的**说明 ✓（"尚未托管安装；`update`/`repair`/`rollback` 要等安装后才有意义 ✓"）。

### P5（中低 ✗）**`doctor` 默认输出是一整块 JSON，没有人类摘要**
我只跑了 `doctor`（**没加 `--json`** ✓）→ 仍是 JSON ✓。对"第一次接触"的用户 ✓ 它是一面墙 ✓。
**优化点** ✓：默认给**几行摘要**（node ✓ / 生效 shell ✓ / workspace 模式 ✓ / 宿主版本 ✓ / 是否托管安装 ✓ / 缺哪些工具 ✓），`--json` 再给机器读的 ✓。

### P6（中低 ✗）**生效 shell 与 PowerShell 版本，属于"用户无法预测"的一类**
`doctor` 实测：`shell.effectivePath = C:\Program Files\Git\bin\bash.exe ✓`、`scope: global ✓`、`source: auto ✓`；`powershell.version = **5.1**.22621 ✗`（不是 7 ✓）。
→ **在 Windows-first 的产品上** ✓，一次能力调用**落在哪个 shell** ✓ 是用户猜不到的 ✓，而它直接决定命令语法与可用工具 ✓。
**优化点** ✓：在**模式加载或第一次动作之前**把"本次会用哪个 shell"说出来 ✓（而不是等失败 ✓）。

### P7（低 ✗）**本仓自己的真路径驱动找不到产品**
`real-dove-blackbox.mjs` spawn 的是 **`dove-pi.cmd`** ✓，而它**不在 PATH** 上 ✓（我传的 `--launcher` 没生效 ✓，其参数处理未读 ✗）。
套件里它是过的 ✓ → 说明**套件传参的形态与我不同** ✓ → 这是**文档/参数契约**问题 ✓。
**优化点** ✓：把 `--launcher` 的**取值形态**写进脚本自己的 usage ✓（下一次省掉一次失败运行 ✓）。

### P8（正面 ✓，值得保留）
- **真一回合首次就成功** ✓（exit 0 ✓、工具调用真的发生 ✓、扩展加载成功 ✓）—— 这是产品**核心路径能跑**的硬证据 ✓。
- **`.pi/extensions/personal-agent.ts` 无需构建** ✓（薄包装直接 `import` 源码 ✓）—— 上手成本低 ✓。
- **`doctor` 覆盖面好** ✓（node ✓ platform ✓ shell ✓ workspace ✓ powershell ✓ tools ✓ managedInstall ✓ adapters ✓ protocolVersion ✓）。

## 本轮**没走**的（诚实 ✗）

- **交互式 TUI** ✗（本会话无 TTY ✓）—— `/mode` / `/dove-mode` 的**真实交互**未体验 ✓。
- **三个模式各一个受治理回合** ✗ —— 卡在 **P2** ✓（设不了模式 ✓）。
- **一次被拒** ✗ —— 同上 ✓。
- **P1 的实际后果**（选 pentest 后到底怎样）✗ —— 未走 ✓。
