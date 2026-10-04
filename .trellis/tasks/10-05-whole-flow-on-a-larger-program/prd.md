# A real user's whole flow, on a program big enough to hurt

## Goal

**让"一个真实用户走完整流程"这件事**可被真跑**、可被读数** ✓ —— 而今天它只有**一步**能真跑 ✓✓。

**用户价值** ✓：上一轮（`10-03-ten-million-token-project` ✓）用**手搓的 12 段**走了一个模式、在一个**极小**的库上 ✓，找出 7 条东西 ✓ —— **而那条路是自创的** ✗✓：仓里**本来就有一套 field-run 工具** ✓✓（`scripts/real-dove-blackbox.mjs` ✓），有**固定的读数格式** ✓✓（规格 §4 ✓），**它只是覆盖不到整个流程** ✗✓✓。这一轮把两件事合起来：**用仓自己的仪器** ✓ + **走完用户真正要走的路** ✓，并且**把程序放大到 agent 必须认真干活** ✓。

## Background（**全部实测** ✓）

- **仪器已有** ✓✓：`node scripts/real-dove-blackbox.mjs --launcher source --provider real --cwd <项目> --scenario <json> --output <仓外> --timeout-ms 900000` ✓；预条件由**人**提供 ✓（凭据**按文件名携带、绝不带内容** ✓✓；输出路径**必须在仓外** —— 原始证据从不提交 ✓）。
- **读数格式已定** ✓✓（规格 §4 ✓）：`scenario/provider/model/date` ✓ · `exitCode/settled/harnessTimedOut/events/duration` ✓ · `terminal: reason/detail/code` ✓ · `resources: toolCalls/providerRounds/elapsedMs/toolDurationMs` ✓ · **`tokens: input/cacheRead/cacheWrite/output/reasoning`** ✓ · `stopReasons`（**列表而非长度** ✓）· **模型真正调用了哪些工具及次数** ✓ · `dialogs: approved/declined/answered/cancelled/defaulted/mismatch/unused` ✓ · `terminalConsistency/closeWaitMs` ✓。
- **场景现状** ✗✓✓：**8 个场景里只有 `read-only-audit.json` 声明 `requires: a real provider`** ✓✓；其余 7 个要的是 `--progress-case` ✓ `--dialog-case` ✓ `DOVE_PI_MAX_MESSAGES` ✓ `--reuse-session` ✓ 或 *"nothing beyond the default faux responses"* ✓ —— 而规格明说：*"Their assertions are written against **scripted** events, so pointing a real model at them **does not test what they assert**."* ✓✓
- **流程的步骤** ✓：由 CLI 的动词定义 ✓（`project init`/`doctor`/`bind` ✓ · `task create/start/verify/continue/convergence` ✓ · `archive` ✓ · `workspace` ✓ · `capability` ✓）—— 今晚全部量过 ✓。
- **上一轮的教训可复用** ✓✓：固定首问 ✓ · 每段**先落文件再读** ✓（我曾在读取时消费掉输出 ✗✓）· **拒绝要原文照抄** ✓✓ · 每段采 `token audit`/`cache audit` ✓。
- **而上一轮最坏的发现已修** ✓✓：`--continue` 的新回合曾被当成重放（发现 F ✓）→ **已根治** ✓（`f5561a8` ✓）→ **所以这一轮的延续读数会比上一轮干净** ✓✓。

## Requirements

- **R1 用仓自己的仪器** ✓✓：`real-dove-blackbox.mjs` + §4 的读数格式 ✓ —— **不新造一套手搓流程** ✗（那是上一轮的欠账 ✓）。
- **R2 场景覆盖整个流程** ✓：**每一步一个 field-runnable 场景** ✓（`requires: a real provider` ✓，且**断言要针对真实模型能产生的观察** ✓✓，不是脚本事件 ✗）。
- **R3 程序要"稍微大一点"** ✓：大到 **agent 必须分多次、真的做工程决策** ✓（多模块 ✓、有真依赖 ✓、有自己的测试 ✓），**小到一回合（`--timeout-ms` 级别 ✓）能推进可见的一步** ✓✓。
- **R4 读数进记录** ✓：按 §4 的格式写进任务记录 ✓；**原始证据保存在仓外** ✓✗（不得提交 ✗）。
- **R5 沿路采尺度** ✓：每步之后 `token audit` ✓ + `cache audit` ✓（命中率与 prompt 增长成曲线 ✓✓ —— 上一轮此法有效 ✓）。

## Acceptance Criteria

- [ ] **每个流程步骤都有**一个声明 `requires: a real provider` 的场景 ✓✓，且它们的断言**由真实模型产生的观察**判定 ✓（不是脚本事件 ✗）。
- [ ] **一次完整的 field run** 走完流程 ✓，读数**按 §4 格式**记录 ✓，含 **`tokens`** 与**模型真正调用的工具及次数** ✓✓。
- [ ] **程序满足 R3 的尺寸** ✓ 且有**自己的判分**（`npm test` 级别 ✓）—— agent 的每一步**都能被它自己的测试裁决** ✓✓。
- [ ] 原始证据**在仓外** ✓，且**没有**任何一次运行把证据提交进仓 ✗✓。
- [ ] **沿途曲线**可得 ✓（每步 `token audit`/`cache audit` ✓），且**明确标注哪些读数与上一轮不可直接比较** ✓（上一轮是手搓流程 ✗✓ —— 规格 §4 自己要求"说明它不能被拿来比什么" ✓✓）。

## Out of Scope

**新造 field-run 工具** ✗（已有 ✓）· **改 §4 的读数格式** ✗（它已成熟 ✓）· **把凭据纳管** ✗（规格明说由人提供 ✓）· **把上面的发现当场修** ✗（先读数、后修 ✓ —— 上一轮就是这么做的 ✓）。

## Open Questions

（**无** ✓ —— 形状已定：**用户选 C** ✓：在**已有的大项目**上走整个流程 ✓。）

## 决定与 C 的设计（**2026-10-05** ✓）

**用户选 C** ✓ —— 在此**已有的大项目**上走整个流程 ✓。我先前指出的三条代价（**噪音大** ✓ · **归因难** ✓ · **判分不清** ✓）**现在变成必须被压住的风险** ✗✓，而压法**不是自创** ✓✓ —— **规格 §4 自己就叫 "Reading Format and **Its Comparison**"** ✓✓：

- **压"归因难"与"噪音大"** ✓✓：**先跑一次对照（control run）** ✗✓ —— **同一个项目、同一个场景、agent 不做任何改动** ✓ → 这样**项目自身的 flaky/既有失败被基线化** ✓✓，**只有*差值*才归因给 harness** ✓✓。**这是 C 能成立的前提** ✓（没有它，任何失败都无法归因 ✓）。
- **压"判分不清"** ✓✓：**用项目自己的判分** ✓（它自己的测试套件 ✓）—— 与本仓 doctrine 一致（*"the project's own tests decide"* ✓✓，上一轮的 `test.js` 44→285 就是这么起作用的 ✓）。
- **压"动别人的仓"** ✓✓：**克隆** ✓ + **永不推送** ✗✓（上一轮的既定做法 ✓）+ 原始证据**存仓外** ✓✗（规格 §2 的预条件 ✓）。

**项目的选择标准** ✓✓（由 C 的代价与规格推出 ✓，不靠偏好 ✓）：① **有自己的测试套件** ✓（判分来源 ✓）；② **有真实依赖** ✓（不是零依赖玩具 ✓）；③ **可比上一轮的 `yocto-queue` 大一档** ✓（上一轮是 ~300 行的库 ✓）；④ **能整体克隆、无需网络凭据** ✓（凭据由人提供 ✓，规格 §2 ✓）。

**而这台机器上的实测** ✗✓：**除宿主本身外，本地没有符合 ①②③ 的项目** ✓（`%TEMP%` 下唯一非脚手架的是 `dove-ten-million` ✓ = 12.5 KB / 4 文件 ✓）；而宿主**正被本项目指着** ✗✓（改它是上膛 ✓）→ **所以 C 需要取一个项目 → "哪一个"是你的决定** ✓。
