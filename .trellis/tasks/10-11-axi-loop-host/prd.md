# 回路自己的宿主：启动即建边界，并在边界下派发改进者

## Goal

让 **axi 自己那条派发路径**（今天：`src/commands/axi-turn.ts` → `src/core/loop-runner.ts`）**先建 Plane B 的边界、再在边界下启动改进者** ✓ ——
于是 `src/jailer/` 的六个模块**有真实调用者**，reachability 白名单里的六条按规格自己给的"完成定义"离场 ✓。

## Background（全部实测，附原文）

- **`axi-turn` 自己写明这一步属于"后来的里程碑"** ✓：`src/commands/axi-turn.ts:13-17` ——
  *"Writing, isolation and the improvement loop belong to later milestones"* ✓；它今天不写、不联网、不隔离（provider 是脚本化的 `createScriptedProvider` ✓，唯一工具只在工作区内读一个文件 ✓）。
- **`src/jailer` 的公开面只有三件** ✓（`src/jailer/index.ts:3-6`）：`ensureBoundary`（设 ACL 不变量并**回读** ✓）、
  `probeToken`（建受限令牌并**验证**其 restricting 列表 ✓）、`launchJailed`（**在受限令牌下启动改进者** ✓）。
- **结构性约束写在 `src/jailer/launch.ts:4-6`** ✓：*"the improver is launched by the helper process and never by itself,
  so it can never be its own jailer"* —— 宿主**不得**自己造令牌再传下去，只能"要一个孩子" ✓。
- **`ok` 的语义是"机制如实报了"，不是"孩子干成了"** ✓（`launch.ts:8-11`）：被挡住的写**是** criterion 1 的**成功**，以非零退出码回来；
  把 `ok` 读成"孩子成功"会把每次拒绝读成失败——那是本仓量过的过度拒绝形态（88/120 ✓）。
- **机制那一半已造好并被测试看着** ✓：`tests/jailer.test.ts` 8 条用例 —— criterion 1（写 held-out 必须失败 ✓）、
  criterion 2（不能自升权且 ACL 不变 ✓）、criterion 3（可写侧正常工作 ✓）、**阳性对照**（把"挡住了"与"探针瞎了"分开 ✓）、
  树级不变量（`tests/jailer.test.ts:140` ✓）。
- **白名单六条，各自的 reason 指着同一个消费者** ✓（`tests/harness-reachability.test.ts:107-110`）：
  `types.ts`/`acl.ts` ← "the loop's **startup** path will"；`launch.ts` ← "the loop's **dispatch** path will"；
  `host.ts` ← "`token.ts` and `launch.ts` will"；`token.ts` ← "`launch.ts` will"；`index.ts` ← "the module's public surface, for those two consumers" ✓。
- **完成定义是规格自己给的** ✓：`personal-agent-use-time-architecture.md` §7 —— *"nothing in the runtime reaches `src/jailer/` …
  **removing those entries is the definition of done for wiring it**"* ✓。
- **这条依赖没有 owner** ✓：`personal-agent-improvement-run.md` §10 —— *"The loop's own host is deliberately deferred … no task owns it yet"* ✓；本任务成为那个 owner ✓。
- **谁在等它** ✓：`09-30-axi-a4-plane-b` 的 implement 第 3 步（外部闸门＝**独立进程**）、第 5–8 步（两级评估 / 树形档案 / 归因-回退）、
  第 10 步（HITL 门）都要一个"能在边界下跑起来"的回路宿主 ✓；A4 的 design 决策 5 把不变量落在
  **"路径 + 独立进程 + 测试"三件同时** ✓ —— **"进程"那一件就是本任务** ✓。

## Requirements

- **R1 启动即建边界** ✓：宿主开始时先 `ensureBoundary`（设并回读），**再** `probeToken`（验证 restricting 列表）；任一不符即**拒绝启动**（不是警告后继续）。
- **R2 派发走 helper** ✓：改进者的工作由 `launchJailed` 启动；宿主不持有可传递的令牌，**改进者永远不是自己的狱卒**。
- **R3 `ok` 不当作"孩子成功"** ✓：调用方按"机制是否如实 + 令牌是否被验证"读 `ok`；孩子的非零退出码如实呈现、不折叠成失败。
- **R4 六条离场** ✓：六个模块各有真实调用者，条目按规则**删除**（而不是把 reason 改写成另一种说法）。
- **R5 离线可验** ✓：本任务的判据不依赖真 provider；`npm run typecheck` / `npm test` 数字不下降。
- **R6 边界的作用域要说准** ✓：`Everyone` 档**不是** OS 沙箱（`use-time-architecture.md` §7 已量 ✓）——
  写清它覆盖什么、不覆盖什么（例如"读覆盖声明的路径、不覆盖其内容" ✓）。

## Acceptance Criteria

- [ ] **AC-1** 宿主在一次真实调用里**先建边界再派发**：`invariantViolations` 为空 ✓、`probeToken` 的 restricting 列表被验证 ✓、
      `launchJailed` 的 `selfCheck === "pass"` ✓ —— 三者的读数都进账本 ✓。
- [ ] **AC-2** 不变量在**运行路径上**成立：改进者写 held-out 失败、写可写侧成功；由既有 criterion 1/3 的复现 + 一条**走宿主**的用例看住 ✓。
- [ ] **AC-3** reachability 白名单里 **`src/jailer` 的六条全部离场**，`tests/harness-reachability.test.ts` 绿 ✓。
- [ ] **AC-4** 边界建不起来时宿主**拒绝启动**（不是降级运行）——一条用例看住 ✓。
- [ ] **AC-5** `npm run typecheck` **0** · `npm test` 不下降（含既有 8 条 jailer 用例 ✓）。

## Out of Scope

- **A4 的其余部分**（闸门进程本身、manifest 四件、两级评估、树形档案、HITL 门）——那是 `09-30-axi-a4-plane-b` ✓；本任务只提供它们在等的宿主 ✓。
- **Pi 宿主自己的那条回路**（D1：回路属于 Pi ✓）——本任务只动**我们自己拥有的**那条 ✓。
- **OS 沙箱**：`Everyone` 档就是它现在的强度，不假装更强 ✓。

## 依赖与关系

- **反向依赖**：`09-30-axi-a4-plane-b`（第 3/5–8/10 步）与"把 `src/jailer` 接进运行路径"都等本任务 ✓。
  依赖写在**本文件**里，不靠树的位置暗示 ✓。
- **不新建 parent**：它不是 A0–A5 之一，而是被它们等待的依赖 ✓。

## Risks / 回退

- **风险**：宿主把边界当建议（建失败也继续跑）→ **回退**：AC-4 的用例看住"拒绝启动" ✓。
- **风险**：`ok` 被读成"孩子成功" → **回退**：R3 写进契约，判据用 `selfCheck` 而非退出码 ✓。
- **回退点**：改动集中在"宿主启动 + 派发"两处；回退＝去掉调用点，六条白名单回来（且 reason 仍为真 ✓）。
