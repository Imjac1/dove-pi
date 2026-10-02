# Pi 1.0 re-check: architecture and plan against the host

## Goal

对**宿主（Pi）大版本变动**做一次全项目的回检 ✓：钉住的宿主表面 ✓、适配器与安装器的暴露面 ✓、以及**计划册是否仍然成立** ✓ —— 产出是**清单与判定** ✓，不是改代码 ✗。

## Background（已确认的事实，2026-10-03 实测）

### 一、「基座 Pi」这条线在本仓**已经裁决并已落地**（不是开放问题 ✓）

出处：`09-30-substrate-choice/prd.md`（191 行，含 09-25 的选型研究与 09-26 的裁决落点）。

- **裁决** ✓：框架**定义自己的最小 loop 接口（`AgentLoop`）** ✓，`pi-agent-core` 的 thin `Agent` 是它背后的**一个 adapter，永远不是地基** ✓。理由含实测：该包是**嵌套依赖** ✓、**0.84.3 vs 已发布 0.87.1** ✓、自带**两套并行 harness 栈**（其一标 `./experimental/pico3`）✓；**反转成本 = 一个 adapter 实现** ✓✓。
- **已落地** ✓：`src/adapters/loop-pi-agent-core.ts` ✓、`src/adapters/loop-scripted.ts` ✓；`pi-agent-core` 已是**直接依赖** ✓；`personal-agent-framework-core.md` 把 `AgentLoop` 写成接口、两个实现各一 ✓。
- **五条硬要求 × 基座的逐格判定** ✓ 里，Pi 有一条**原理性做不到** ✓：**evaluator 不可被改进者编辑** ✗ —— 理由不是成本，是结构：**扩展 hook 本身就是磁盘上的文件** ✓，能改文件的 agent 就能改自己的闸门 ✓。另有：Pi **无** permission/approval 事件 ✓、**无**任何工具元数据表达路径限制 ✓；`AgentHarness` **是 stub**（`HarnessNotImplemented` ✓）→ 将来是**替换**而非重写 Dove 的同类机制 ✓。
- **被点名的缺口 H5** ✓：`tool-implementation` 绑定在**整个 `src`** 上 ✓，而 `src` 同时装着 harness 与 verifier ✗ → "这次改动是不是 verifier 改动"**今天只能靠人读** ✗✓；**把两者在文件级分开是解决它的前提** ✓。
- **两条尚未做、且已被记录在案的** ✗：**实验 0**（DSH 的 `workspace-write` 是否真的拒写 workspace 之外 ✓ —— Plane B 的**全部强制力**来自这一条 ✓，`09-30-substrate-choice` 的 **AC-8 仍空** ✓，原文写明"任何实现都必须排在它之后" ✓）；以及 `src/core/invocation-disposition.ts` 里把 `replaySafe` 说成"`pi-agent-core` 这么叫"的**两行注释** ✓（研究方纠正：该说法在包内**无支撑** ✓，准确表述是"在 stub harness 里被**声明**" ✓）—— **待你允许后改** ✓，零行为变化 ✓。

### 二、这一次量到的（2026-10-03）

- **本仓精确钉住宿主** ✓：`pi-coding-agent` **`0.84.3`**（精确 ✓）、`pi-tui` **`0.84.3`**（精确 ✓）、`pi-agent-core` `^0.84.3`（范围 ✓）。
- **实装与声明一致** ✓：本机 `node_modules/@earendil-works/` 下三者均为 **0.84.3** ✓（另有 `pi-ai`/`pi-telemetry` `0.84.4` ✓）。
- **本树的 CHANGELOG 里没有 1.0** ✗：`pi-coding-agent` 头部是 `## [Unreleased]` ✓，最新已发布条目 **`## [0.84.3] - 2026-08-24`** ✓。
- **宿主表面在 `src/` 的分布** ✓：`core/work-mode.ts`(3) · `cli.ts`(3) · `pi-adapter/chinese-settings.ts`(2) · **`pi-adapter/host-version.ts`(2)** · `adapters/loop-pi-agent-core.ts`(2) · `pi-adapter/extension.ts` · `extensions/install.ts` · `pi-adapter/shell-config.ts` · `commands/token-audit.ts` · `commands/cache-audit.ts` ✓。加上 `installer/*.py` ✓（它装的就是**宿主自己** ✓ → 宿主换版本时它第一现场 ✓）。
- **规格页里没有任何宿主版本字符串** ✗（按版本串模式搜零命中 ✓）→ 宿主版本契约**只活在代码里** ✓（`host-version.ts` ✓）。
- **外部检索不可用** ✗：`web_search` 返回 `HTTP 401`（检索端点 key 无效 ✓）；按工具说明，**只有用户能改该端点** ✓。→ 1.0 的 release 要点**本会话取不到** ✗。

### 三、因此"基座 Pi 到 1.0"对本项目的**确切风险点**（待量 ✓）

1. **"反转成本 = 一个 adapter"这句话在 1.0 下还成立吗** ✗ —— 它是整个裁决的地基 ✓。
2. **`AgentLoop` 接口与 `pi-agent-core` 的表面**：adapter 依赖了哪些具体导出 ✓、哪些在 1.0 里可能变 ✓。
3. **`AgentHarness` 是否仍为 stub** ✗（若转正 ✓，裁决里"替换而非重写"的那条要重读 ✓）。
4. **安装与升级路径**：宿主版本钉在哪一层 ✓（`package.json` ✓ / installer 的 release 描述 ✓）、升级与回退是否原子 ✓。
5. **哪些测试会因宿主大版本变红、以及哪些*不会*** ✗✓ —— 后者才是重点 ✓（本会话已两次证明"沉默的破坏"最贵 ✓）。

## Requirements（候选 ✓）

- **R1 暴露面清单** ✓：所有依赖宿主行为的文件与契约 ✓，逐条 `file:line` ✓。
- **R2 "一个 adapter"这句话的**可证伪检查** ✓：列出 adapter 对宿主的具体依赖 ✓，并给出"若 1.0 改了它们，代价是什么"的判定 ✓。
- **R3 宿主版本契约** ✓：`host-version.ts` 怎么判定 ✓、识别不了时怎么办 ✓（拒绝 ✓/降级 ✓/沉默 ✗ —— 若沉默，那正是本仓清过两遍的缺陷类 ✓）。
- **R4 安装与升级** ✓：宿主版本钉在哪 ✓、升级/回退是否原子 ✓。
- **R5 规格与计划册里的宿主假设** ✓：哪些规格页**假定**了宿主行为 ✓；`plan-v8.md` 里哪几条依赖宿主能力 ✓ → **要不要 v9** ✗（改计划册要你批 ✗）。
- **R6 实验 0** ✓（`workspace-write` 拒写 workspace 之外 ✓）—— 已被本仓列为**阻塞实现**的项 ✓，且**至今未跑** ✗✓。
- **R7 测试的宿主依赖** ✓：哪些会红 ✓、**哪些不会** ✗✓。
- **R8 产出形态** ✓：见下面的 Open Question ✓。

## Acceptance Criteria

- [x] **AC-1（S0）** 宿主版本在本仓的**钉点与实装**读数（见 Background §二 ✓）—— 因为一个**不存在的前提**（1.0 ✗）会让后面所有结论失效 ✓。
- [x] **AC-2（S0）** "基座"这条线的**既有裁决**已复核并写明（Background §一 ✓，含两条尚未做的项 ✓、以及一处对该裁决研究者本人工作的纠正 ✓）。
- [ ] **AC-3（S1）** 宿主表面清单存在 ✓，**每条带 `file:line`** ✓，并逐条判定**契约 / 便利** ✓。
- [ ] **AC-4（S1b）** adapter 对宿主的导出依赖**被数出来**（一个数字 + 清单 ✓），并给出"**反转成本 = 一个 adapter 实现**"在 1.0 下**成立 / 不成立**的判定 ✓。
- [ ] **AC-5（S1c）** `host-version.ts` 在**识别不了宿主**时的行为——**实测输出** ✓（不是读代码的推断 ✗）；`AgentHarness` 是否仍为 stub——grep 读数 ✓。
- [ ] **AC-6（S2）** `plan-v8.md` 是否需要 v9 的**判定** ✓，带依据行 ✓（**只判定，不改** ✗）。
- [ ] **AC-7（S3）** "哪些测试**不会**因宿主变动而红" ✗✓ 的清单 ✓ —— 空清单也是结论 ✓，但必须写明**搜法与范围** ✓。
- [ ] **AC-8（S4）** 实验 0 的状态**二选一** ✓：执行读数 ✓，或明写"**未跑 + 原因**"✗（不许写"不适用" ✗）；`replaySafe` 两行注释已**开任务** ✓。
- [ ] **AC-9（S5）** 每条判定都带 **可行 / 需改 / 需降级并标注** ✓，且每条"需改"都有对应**任务 id** ✓。
- [ ] **AC-10** 门禁三连（typecheck / `npm test` / installer）**仍绿** ✓；**若不绿 → 记为发现** ✓ 且**不修** ✗（(A) 已定 ✓）。
- [ ] **AC-11** **零**代码 / 规格 / 计划册改动 ✗ —— 可观察：改动范围只落在 `.trellis/tasks/10-03-pi-1-recheck/**` ✓。

## Out of Scope

- **不做宿主升级** ✗、**不改 `plan-v8.md`** ✗（各自要你单独批 ✓；本任务只出**要不要改**的判定 ✓）。
- **不修任何东西** ✗（(A) 已定 ✓）—— 判为"需改"的各自开任务 ✓。
- 不打断已在手的两条线 ✓（**A3** ✓、**场景** ✓ —— 并行 ✓）。
- 不重跑 09-25 的基座选型 ✗（已裁决项 ✓，本任务只复核**它是否仍成立** ✓）。
