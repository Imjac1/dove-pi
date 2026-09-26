# Journal - aixi (Part 1)

> AI development session journal
> Started: 2026-08-26

---

## Session 1: Auto-update Pi extensions during Dove install

**Date**: 2026-08-28
**Task**: Auto-update Pi extensions during Dove install
**Branch**: `master`

### Summary

Implemented default Pi extension updates during dove-pi install with a fast empty-install path, explicit opt-out, stable update statuses, fail-open reconciliation, machine-readable CLI output, tests, README updates, and Trellis spec synchronization.

### Git Commits

| Hash | Message |
|------|---------|
| `a3e0c41` | (see git log) |
| `d077164` | (see git log) |

### Status

[OK] **Completed**

## Session 2: Dove Pi token guard & capability activation

**Date**: 2026-08-28
**Task**: 08-28-dove-pi-usage-review / 08-29-token-guard-implementation
**Branch**: `master`

### Summary

审查 + 优化 dove-pi 使用:审计了真实会话遥测(pi-agent 与 ~/Desktop/code 共 ~1.9 亿 prompt tokens),发现两大根因——前缀膨胀到 18–21 万 token / 全 MISS 冷启动,以及 capability/recipe 快速通道从未被调用(bash 硬写 580 次)。已落地两轮质量安全优化:

- FIX1 prefix cap(新 `context-guard.ts`): 82% 窗口或 28k 软阈值触发 /compact 建议,**绝不自动删历史**。
- FIX2 capability 清单 + FIX6 派生子代理指引注入 system prompt。
- FIX2b capability 复用提示(tool_result 拦截等价 bash/powershell)。
- FIX3 hashline 编辑工具跨环境对齐诊断。
- FIX7 `dove-pi token audit` CLI(聚合会话 token 账本,支持 --since/--filter)。

### 验证

typecheck ✅ | 测试 94 全过(+7 context-guard +3 token-audit)✅ | extension 加载 ✅ | pi:smoke ✅ | `token audit` 实测输出真实会话账本 ✅

### Git Commits

| Hash | Message |
|------|---------|
| (未提交) | 两轮改动保留在 worktree 待用户 review,未代提交(遵循不自动提交政策) |

### Status

[WORK] 两轮已实现且全绿;待用户回来看效果,决定提交与后续(keepalive 已明确不做)。

---

## Session 3: Token cost root-cause investigation 与结论修正

**Date**: 2026-08-29
**Task**: 08-29-input-cost-optimization（父: 08-28-dove-pi-usage-review）
**Branch**: `master`

### Summary

延续 Session 2 的 token 优化工作，本轮目标是定位 input 侧成本大头并落地优化。经历了完整"假设→验证→推翻→修正"循环，最终用数据定案：

- **初判（错误）**：把 `usage.input` 误读为单次大内容 → 推测"130-230K 大调用"和"40K 缓存悬崖"，并基于此设计了 FIX-C1（中间 cache_control 断点注入）和 FIX-C2（40K 阈值定标）。
- **推翻（实测）**：`usage.input` 在全 MISS 时 = 整个前缀（不是增量）。交叉验证 1,938 次调用（Desktop/code）：MISS 率由**轮次间隔时间**驱动（>60s → 34-40%，<10s → 0.4-5.7%），与前缀大小基本无关 → 无悬崖、无断点问题、短会话无用。
- **修正落地**：撤回 FIX-C1/C2 与"短会话"推论；context-guard 阈值 260K → 150K（实测更早触发、8/13 会话有行动价值）；保留 thinking policy（定位为可控性而非省钱，Session 2 已记录）。
- **诚实结论**：上游缓存 TTL 无法本地修复，现况已接近最优；本轮有价值产出是正确因果认知 + 防误判文档。

### 验证

交叉验证 1,938 调用（间隔×前缀大小分桶表见 prd.md）| 误判链已记录 | typecheck ✅ | 108 测试全过 ✅ | 重启后新代码生效确认 ✅

### Git Commits

| Hash | Message |
| ------ | --------- |
| `0f57642` | feat: auto/lock thinking policy, 260K compact soft cap, reasoning% in token audit |
| `ba75d94` | style(cli): reflow multi-line imports |
| `d77c839` | chore(task): add input-cost-optimization tracking task |
| `7b532f0` | chore(task): FIX A research（40K 悬崖，后续被推翻） |
| `8bc8008` | chore(task): FIX-C1 feasibility（后续被推翻） |
| `f9bba66` | chore(task): re-prioritize（后续被推翻） |
| `d1b8e89` | fix(task): 修正为时间衰减根因，阈值 150K |

### Status

[DONE] 任务结论定案、文档修正、阈值收尾。本任务 archive，等待推送。

## Session 4: 负优化全面检查与修复

**Date**: 2026-08-30
**Task**: 检查已推送改动是否存在负优化（用户要求"确定好再优化"）
**Branch**: `master`

### Summary

对 08-29 推送的全部改动做 8 项负优化检查，用代码路径 + 真实数据逐项确定：

- **检查 1 重启思考级别静默降级 → 确认为真**：ModeController 默认 standard 且 mode 不持久化，重启后 auto 策略断言 high，覆盖用户 settings 的显式 max（defaultThinkingLevel + modelThinkingLevels）。且 pi 原生 `_getThinkingLevelForModelSwitch` 本来就优先 per-model > default——策略在跟原生行为打架。
- **检查 2 free provider thinkingLevelMap 未测试 → 确认为真**：`off:null` 让 off 从可选变隐藏，openai-completions 端点从未实测。
- **检查 5 token-audit 性能 → 排除**：全量遍历 4 项目 53 万条消息仅 0.416s。
- **检查 6 setThinkingLevel 每回合副作用 → 排除**：仅 isChanging 时写 entry/发事件，同级别重复调用零副作用。
- **检查 7 cache-diagnostics reasoning 字段 → 排除**：纯读入采样，不参与命中率计算。
- **检查 3/4/8 可接受或无问题**：thinking_level_select 不持久化符合设计；150K guardNotified 每会话一次不刷屏；env 解析非法值回退 auto、catch 保护。

### Fixes

1. auto 策略尊重用户显式配置：有 per-model 钉或非默认全局级别时不再断言（跳过覆盖），无显式配置时行为不变（照旧按 mode 断言）。
2. free provider thinkingLevelMap 恢复 `{max:max}`，保留 OpenRouter 全映射（实测过）。

### Git Commits

| Hash | Message |
| ------ | --------- |
| `846c869` | fix(thinking-policy): auto policy respects explicit settings; revert free provider map |

### Verification

- 110 测试全过（新增 2 个回归测试：respect 路径不调用 setThinkingLevel、无配置路径调用 high）
- typecheck OK、pi:smoke OK
- models.json 往返验证合法，free 已回滚、OpenRouter 保留

### Status

[DONE] 2 个确认负优化已修复并推送。


## Session 2: Complete Dove-Pi V2 runtime architecture

**Date**: 2026-08-29
**Task**: Complete Dove-Pi V2 runtime architecture
**Branch**: `master`

### Summary

Completed and validated the Dove-Pi clean-slate V2 runtime slice: immutable request planning, full provider-payload budget firewall, capability approval/recovery state, correlated execution ledger, Trellis mutation reconciliation, strict ordinary-chat context isolation, Pi read-only degradation, centralized prompt policy, and full regression coverage. Typecheck, 131 Node tests, 19 installer tests, doctor, Pi smoke, and diff checks passed.

### Git Commits

| Hash | Message |
|------|---------|
| `1add042` | (see git log) |
| `4bee290` | (see git log) |
| `5689998` | (see git log) |

### Status

[OK] **Completed**


## Session 3: Transactional Dove Pi managed installation and stable updates

**Date**: 2026-08-29
**Task**: Transactional Dove Pi managed installation and stable updates
**Branch**: `master`

### Summary

Replaced checkout-backed Git updates with a transactional managed installer and stable GitHub release flow; pinned bundled Pi, TUI, Trellis and Dove-managed extensions; added repair, rollback, bounded uninstall, offline diagnostics, release/bootstrap validation, tests, and complete Chinese/English documentation.

### Git Commits

| Hash | Message |
|------|---------|
| `bef03be` | (see git log) |
| `3584aa9` | (see git log) |
| `ebb8020` | (see git log) |

### Status

[OK] **Completed**


## Session 4: Harden provider token guard

**Date**: 2026-08-30
**Task**: Harden provider token guard
**Branch**: `master`

### Summary

Completed provider budget safety hardening without imposing an Ultra output cap; synchronized known provider limits with accounting, aborted unsafe Pi requests, preserved live-owner ledger records, stabilized prompt prefixes, normalized stop reasons, corrected negated intent detection, isolated Trellis context tests, and documented the runtime contracts.

### Git Commits

| Hash | Message |
|------|---------|
| `6b5df03` | (see git log) |
| `3856a2e` | (see git log) |

### Status

[OK] **Completed**


## Session 5: Personal Agent OS completion

**Date**: 2026-08-30
**Task**: Personal Agent OS completion
**Branch**: `master`

### Summary

Completed and verified the Personal Agent OS architecture and provider safety contracts, archived the parent task and completed bootstrap guidelines, and prepared the P1 interoperability layer as the next implementation target.

### Git Commits

| Hash | Message |
|------|---------|
| `6b5df03` | (see git log) |
| `3856a2e` | (see git log) |

### Status

[OK] **Completed**


## Session 6: Dove Pi normal-user E2E evaluation

**Date**: 2026-08-30
**Task**: Dove Pi normal-user E2E evaluation
**Branch**: `master`

### Summary

Recorded a real TUI prompt-to-agent journey, verified the coding loop, and identified Dove-side intent and Trellis-provider continuation regressions without changing Trellis.

### Git Commits

| Hash | Message |
|------|---------|
| `bb407cd` | (see git log) |

### Status

[OK] **Completed**


## Session 7: Harden Dove request and project flow

**Date**: 2026-08-30
**Task**: Harden Dove request and project flow
**Branch**: `master`

### Summary

Hardened request intent and tool authority, added provider-neutral one-read continuation through Trellis public current API, moved runtime state outside repositories, improved cache/provider observability and launcher options, and verified the original eight-prompt E2E flow.

### Git Commits

| Hash | Message |
|------|---------|
| `65554bd` | (see git log) |
| `279006e` | (see git log) |

### Status

[OK] **Completed**


## Session 8: Dove extension identity and spec context budget

**Date**: 2026-08-30
**Task**: Dove extension identity and spec context budget
**Branch**: `master`

### Summary

Implemented managed-first Dove extension identity synchronization with trusted explicit project override and reload-safe registration claims; split the 68 KB runtime contract into five routed specs under 24 KB, migrated active task manifests, and added context-budget regression tests. Full Node, installer, typecheck, doctor, Pi smoke, and diff checks passed.

### Git Commits

| Hash | Message |
|------|---------|
| `3f926d5` | (see git log) |
| `0741298` | (see git log) |

### Status

[OK] **Completed**


## Session 9: Dove request lifecycle idempotency

**Date**: 2026-08-30
**Task**: Dove request lifecycle idempotency
**Branch**: `master`

### Summary

Added stable logical request leases across Pi redelivery, retry, compaction, continuation, steering, provider calls, capability/tool correlation, and structured settlement; documented the six-abort audit mapping and verified lifecycle regressions.

### Git Commits

| Hash | Message |
|------|---------|
| `60a5960` | (see git log) |

### Status

[OK] **Completed**


## Session 10: Publish and verify Dove Pi v0.1.2

**Date**: 2026-08-30
**Task**: Publish and verify Dove Pi v0.1.2
**Branch**: `master`

### Summary

Completed Release-locked Pi update, safe Windows uninstall, bootstrap controls, native runtime detection, and public v0.1.2 install/update/uninstall acceptance.

### Git Commits

| Hash | Message |
|------|---------|
| `cac5021` | (see git log) |
| `558d6dc` | (see git log) |
| `e07788c` | (see git log) |

### Status

[OK] **Completed**


## Session 11: Complete Dove planning workflow handshake

**Date**: 2026-08-31
**Task**: Complete Dove planning workflow handshake
**Branch**: `master`

### Summary

Added a host-independent PlanningSession and restricted agent_project_task workflow so planning questions advance to one native Trellis confirmation instead of repeating. Added lifecycle intent routing, provider refresh after task creation, regression replay coverage, and updated runtime/project specs. Verified typecheck, 220 Node tests, 90 installer tests, doctor, Pi smoke, and activated managed source release 0.1.2+source.d6d4d9fde25c.

### Git Commits

| Hash | Message |
|------|---------|
| `2206668` | (see git log) |

### Status

[OK] **Completed**


## Session 12: Fix planning question loop and cache diagnostics

**Date**: 2026-08-31
**Task**: Fix planning question loop and cache diagnostics
**Branch**: `master`

### Summary

修复规划输入完成后仍重复调用 ask_user_question 的跨层问题：PlanningSession 进入 awaiting-create 后由 Pi tool_call 边界强制转向 agent_project_task；补充回归测试、运行时规格和跨层复盘。完成 220/220 Node、90/90 installer、typecheck、doctor、Pi smoke、spec budget、task validate，并以全新 Desktop\\code 进程验证 ask_user_question=1、agent_project_task=1；缓存审计显示最新会话热态 95.6%、项目汇总热态 90.1%。

### Git Commits

| Hash | Message |
|------|---------|
| `68aed5e` | (see git log) |

### Status

[OK] **Completed**


## Session 13: 发布并验证 Dove Pi 0.1.5

**Date**: 2026-09-01
**Task**: 发布并验证 Dove Pi 0.1.5
**Branch**: `master`

### Summary

修复 LF/CRLF 规格预算差异并发布 v0.1.5；GitHub Actions、四件 Release 资产、托管 update、doctor、token audit 两种 --since 形式均通过。隔离真实回归完成聊天、只读、修复测试和连续追问，记录 token/cache/tool 证据；只回复场景存在 provider 追加文本，已作为后续内容一致性问题记录。发布流程明确本地 readiness 一次、标签 CI 一次，移除重复人工全量门禁。

### Git Commits

| Hash | Message |
|------|---------|
| `dea33bf` | (see git log) |
| `28cc55e` | (see git log) |
| `af4776d` | (see git log) |

### Status

[OK] **Completed**


## Session 14: Deterministic task inventory runtime

**Date**: 2026-09-01
**Task**: Deterministic task inventory runtime
**Branch**: `master`

### Summary

Fixed managed Dove wrapper authority, routed unfinished-task inventory through one zero-tool ProjectProvider projection, excluded archived task context, added read-only budgets and phase timing evidence, and validated the exact Desktop/code prompt in 9.317 seconds with one Provider round and zero tool calls.

### Git Commits

| Hash | Message |
|------|---------|
| `6beabf1` | (see git log) |
| `6b20d04` | (see git log) |

### Status

[OK] **Completed**


## Session 15: Installed Dove real-flow A/B validation

**Date**: 2026-09-02
**Task**: Installed Dove real-flow A/B validation
**Branch**: `master`

### Summary

Installed current HEAD as 0.1.5+source.659f79a5a9fd and ran the four-prompt matrix through one long-lived RPC session with DeepSeek-V4-Flash. All 4 goals completed with 7 Provider rounds, 3 tool calls, 0 structured questions, 3/4 warm first-call cache hits, stable 47-tool schema, and 25,417 uncached input tokens versus 41,541 for direct Pi + Trellis. Archived dove-real-flow-recovery; other active tasks remain untouched.

### Git Commits

| Hash | Message |
|------|---------|
| `8a73d25` | (see git log) |

### Status

[OK] **Completed**


## Session 16: Dove Pi workflow audit and terminal diagnostics
<!-- trellis-session: v=2 fp=3b3112c6a6e058b2 -->

**Date**: 2026-09-04
**Task**: Dove Pi workflow audit and terminal diagnostics
**Branch**: `master`

### Summary

Completed the Dove Pi full-workflow audit: fixed local launcher routing and CLI error boundaries, preserved Legacy workflow context priority, added request planning and bounded resource/terminal diagnostics, attributed provider failures before generic abort wording, exposed diagnostics through Pi doctor/CLI/RPC, documented lifecycle and recovery in both READMEs, and verified 274 TypeScript tests, 105 installer tests, typecheck, doctor, Pi smoke, Trellis validation, and isolated no-key RPC black-box behavior.

### Git Commits

| Hash | Message |
|------|---------|
| `9ed0c29` | fix: audit Dove Pi workflow and harden request diagnostics |
| `f3fbf70` | docs: refine provider error attribution contract |

### Status

[OK] **Completed**


## Session 17: Dove Pi 策略可观测性与上下文预算修复
<!-- trellis-session: v=2 fp=1f22f39dcc1ca972 -->

**Date**: 2026-09-05
**Task**: Dove Pi 策略可观测性与上下文预算修复
**Branch**: `master`

### Summary

完成 Dove Pi 策略快照、终止原因归因、真实 RPC 黑盒回归与 README 说明；移除 Dove 自有固定上下文上限，并修复大型 legacy task 投影挤出 runtime contract 的问题。聚焦测试、黑盒、安装器、类型检查、doctor、Pi smoke 与 diff 检查通过；全量 Node 仅剩并行 task-convergence-control 未注册 convergence 子命令导致的 2 项失败。

### Git Commits

| Hash | Message |
|------|---------|
| `3e32ac4` | fix: remove Dove-owned context ceilings and add strategy diagnostics |

### Status

[OK] **Completed**


## Session 18: Native read-only subagent dispatch
<!-- trellis-session: v=2 fp=d01db70f7be0b61a -->

**Date**: 2026-09-06
**Task**: Native read-only subagent dispatch
**Branch**: `master`

### Summary

Implemented and verified host-neutral read-only subagent dispatch for Dove Pi, including provider health diagnostics, /subagent UX, managed launcher black-box coverage, unavailable/cancelled/empty-output handling, and README/spec updates. Archived task 09-06-dove-pi-native-subagent; left unrelated parallel-task changes untouched.

### Git Commits

| Hash | Message |
|------|---------|
| `3c99f4d` | feat: add host-neutral read-only subagent provider |
| `a58ccd7` | feat: expose subagent health in doctor |
| `ab3c56b` | test: cover managed subagent black-box flows |
| `866dc07` | feat: integrate read-only subagent UX and black-box coverage |

### Status

[OK] **Completed**


## Session 19: dove-pi 工作区交接：2.2 检查失败 + 基座选型研究
<!-- trellis-session: v=2 fp=77cab1bb6f13c6ec -->

**Date**: 2026-09-25
**Task**: dove-pi 工作区交接：2.2 检查失败 + 基座选型研究
**Branch**: `master`

### Summary

对 dove-pi HEAD d7a6175 跑 2.2 质量检查：typecheck PASS，npm test fail 2/318（skill 发现路径依赖，blocking）；并完成基座选型研究（pi-agent-core 实测可独立跑通且 beforeToolCall 能真拦）。交接文档见 tasks/08-27-dove-interop-layer/research/。

### Main Changes

## dove-pi 工作区交接（来自 dsh-dove 会话）

### 本会话做了什么

- 查了基座选型的社区与一手资料（Pi/Armin 5 篇、Anthropic 官方《Effective context engineering》、Agent Skills 规范、SkillsBench arXiv 2602.12670、HumanLayer wsff/ACE、Manus、Mendral、calpaterson、Lilian Weng；dsh/Cordis 一手文档）
- 对 dove-pi 跑了 **2.2 质量检查 → FAIL（1 个 blocking）**
- 验证了 `pi-agent-core` 可独立跑通（含 `beforeToolCall` 真阻断）

### 最重要的结论（直接可执行）

**2.2 检查失败**：`npm run typecheck` PASS；`npm test` = tests 318 / pass 314 / **fail 2** / skipped 2。

根因：`src/skills/discovery.ts` 的 `discoverSkills` 向上走到**文件系统根**，把 `~/.agents/skills` 的 5 个 skill 算成项目 skill。
实测：**同一份项目内容，在 `C:\Users\Macfy\...` 下发现 6 个 skill，在 `D:\` 下只发现 1 个。**

Pi 官方 `docs/skills.md` 的约定是：用户级 `~/.agents/skills/` 是**独立位置**；项目级向上走**遇仓库根即停**。dove-pi 两条都不符 → CI 绿、本机红。

→ 详见 `tasks/08-27-dove-interop-layer/research/check-2026-09-25-skill-discovery.md`
→ 复现：`node --import tsx .trellis/tasks/08-27-dove-interop-layer/research/probe-skill-discovery.mts`

### 基座选型的核心判断

- 问题不在「Pi 还是 dsh」，而在 dove 一直在 **harness 层**选基座；它需要的钩子在 **runtime 层**（`@earendil-works/pi-agent-core`）。
- `pi-agent-core` 实测：`beforeToolCall` 返回 `{block:true}` 使工具执行 **1 → 0**；拦截原因可达模型；`transformContext` 每请求调用且注入生效；`pi-ai` 的 `faux` provider 可做**离线确定性**门禁测试。
- 换基座成本有界：dove-pi 对 Pi 的耦合**只有 `src/pi-adapter/` 下 4 个文件**，其余 69 个源文件零 import。
- dsh 的问题不是「不好用」而是「过早」（Cordis 官方 README 自认 API 不稳定）；但 dsh **原生带审批/沙箱/计划模式/目标/子代理**，安全域反而比 Pi 全（Pi 官方声明无权限系统）。

→ 详见 `tasks/08-27-dove-interop-layer/research/base-selection-2026-09-25.md`
→ 复现：`node .trellis/tasks/08-27-dove-interop-layer/research/probe-pi-agent-core.mjs`

### 下一步（均未决）

1. 修 skill 发现的路径依赖（项目级遇仓库根停 + 显式用户级位置），然后重跑 2.2 全量测试
2. 定基座最终选型：Pi harness / `pi-agent-core` runtime / 在 dsh 上重写
3. 定授权闸门档位（skill 文字 / capability 强闸门 / 再加 pi-security）
4. 9 个安全 skill 超出 SkillsBench「≤3 模块」量级，需聚焦化

### 环境与状态事实

- 抓网页走代理 `socks5h://127.0.0.1:10808`；npm registry 可直连（无需代理）
- dove-pi 是本次新建的完整克隆：150 commits、分支 `master`、HEAD `d7a6175`、工作树 clean
- 已初始化开发者身份 `aixi`（`.trellis/.developer`，被 gitignore）
- **本会话根在 dsh-dove**（不是 dove-pi），所有 dove-pi 操作均用绝对路径完成
- `dsh\_ref\`（抓取的研究原文语料）与 `dsh\_pi-core-probe\`（探针工程）**已从磁盘删除**；结论已转写进上述两份文档
- 本会话**未修改 dove-pi 任何受版本控制的文件**（新增的只有被 gitignore 的 `.developer` 与 `node_modules/`，以及本任务 research/ 下的 3 份文档 + 2 个探针）


### Git Commits

(No commits - planning session)

### Status

[OK] **Completed**

### Next Steps

- 修 src/skills/discovery.ts 的路径依赖后重跑 2.2；再定基座最终选型


## Session 20: Dove base agent framework: research, design, and implementation
<!-- trellis-session: v=2 fp=783f8e4082c3e83a -->

**Date**: 2026-09-26
**Task**: Dove base agent framework: research, design, and implementation
**Branch**: `feat/dove-base-agent-framework`

### Summary

Completed the three-wave research (official/community/GitHub, 26 files, all citations verified) and built plus verified a base agent framework: owned loop with a two-semantics gate, work-mode artifact, authority grant graph, effect identity, evidence plane, context admission, and capability scoping, hosting code-audit, pentest, and trading modes with no core changes. 425 tests, 0 failures.

### Main Changes

## 本会话做了什么

按"先官方、后社区、用代理查"的要求完成研究，然后基于研究结论实现并验证了一个可承载量化交易 / 渗透测试 / 代码审计三类垂直领域的基本 agent 框架。

### 研究（三波，8 个子代理，26 份文件）

- **官方波 5/5**：Anthropic 2024 与 2026 两套分类法、Managed Agents 的 session/harness/sandbox 三分、Claude Agent SDK 的六步权限顺序、OpenAI Agents SDK、Google ADK、Microsoft、LangGraph、MCP 规范、Agent Skills 规范；以及 SEC 15c3-5、MiFID II RTS 6、NIST SP 800-115、PTES。
- **社区波 2/2**：生产证据反驳官方分类法（agent 是 low-variance，投票只放大相关错误）；已发布的闸门/沙箱打穿研究。
- **GitHub 波 3/3**：22 个框架仓库的源码级调查、可复用工作模式的实证字段收敛、17 个垂直实现的控制代码。

**每一处载荷性引用都重新抓取核验过**，包括两篇 arXiv 论文、Anthropic 的架构声明、strands 与 OpenAI 的源码。

### 实现（M0–M9，10/10 里程碑）

```
src/core/    loop · loop-runner · authority · gate-limit · gate-conformance
             work-mode · effect-ledger · evidence-sarif · checkpoint
             context-admission · capability-scope
src/adapters/ loop-scripted · loop-pi-agent-core
modes/       code-audit · pentest · trading（零核心改动）
engagements/ example-engagement/authority.yaml
.trellis/spec/backend/personal-agent-framework-core.md
```

### 关键设计结论（均有来源）

1. **没有任何一层是边界** —— 拒绝清单、进程沙箱、内核强制、人工审批、闸门自身配置、生产监控器全部有已发布的打穿记录。最强**实测**杠杆是放在模型上下文之外的**能力作用域**（注入效果 33-47/75 → 3/75）。
2. **三个垂直需要三种不同的控制形状** —— 代码审计靠发现身份、渗透靠符合性闸门、量化靠限额闸门。只提供一种的框架会逼另外两个绕过它。
3. **exactly-once 属于工具契约**，不属于循环 —— "the harness barely matters, the contract explains 81%"。
4. **"200 行的 loop + 真闸门"这个组合在调查里不存在**。
5. **五个知名框架已失效/冻结/掏空/转型** —— "vendor the loop; depend on the protocol"。

### 本会话中被纠正的五处（其中三处是自己的错）

- "没找到重复副作用的证据" —— 是元数据贫瘠语料的假象；LIMBO 有实测证据（不可回读时重复 56%/74%）
- "沙箱是最后一道控制" —— 沙箱同样被打穿，连被提出的内核修复方案本身也是
- "幂等是框架责任" —— 重新框定为属于工具契约
- "OpenAI guardrail 只有并行" —— 现在还提供进程内 `tool_guardrails`
- 把 `AgentHarness` 当作可用选项 —— 它是**桩**，执行确认所有方法抛 `HarnessNotImplemented`

### 验证

```
npm run typecheck  -> 0 errors
npm test           -> tests 425 / pass 423 / fail 0 / skipped 2   (318 基线 + 107 新增)
```

全部离线可跑。关键验证：配对闸门测试（开/关闸门执行数 1→0）、8 个并发恢复者恰好执行 1 次、2,865,326 字符诊断的原文**缺席**（不是截断）、渗透五条验收判据、Pi adapter 与参考 loop 行为一致。

### 过程中发现并修复的真实缺陷

- 并发测试抓到 `dispatchOnce` 的**设计缺陷**：崩溃恢复要重试、并发安全要跳过，而账本无法区分"飞行中"与"已死在中途"。解决为**默认绝不重复、重试显式选择加入、由模式决定**。
- 授权文档校验器抓到我自己写的夹具错误（把 `targets` 写进 `authorizes`），并把这一类"静默忽略未知键"变成守卫。
- 三个测试缺陷被修正（其中两个是测试断言了代码不该做的事）。

## 新增依赖

- `yaml@^2.9.1` —— 拒绝手写 YAML 解析器（调查抓到的真实 adapter bug 就是 YAML block-scalar）
- `@earendil-works/pi-agent-core@0.84.3` —— 钉在匹配已安装 `pi-coding-agent` 的版本，仅用于 adapter

## 未处置 / 下一步

1. **框架已完整，垂直尚未开始** —— 现有 11 个能力全是 `dev.*` / `web.*` / `windows.*` / `workspace.*`；代码审计、渗透、量化**各零个**能力实现。下一个任务应是第一个真实垂直（按爆炸半径我倾向代码审计）。
2. **08-27-dove-interop-layer 的 3 条缺失断言** —— `discoverUserSkills` / `discoverAllSkills` 无测试覆盖。
3. **两个 spec 文件属于 08-27 任务**，仍未提交：`.trellis/spec/backend/personal-agent-project-context.md`、`.trellis/spec/backend/quality-guidelines.md`。
4. **13 个预先存在的 Trellis 框架更新文件**（0.6.16→0.6.17）仍未提交，不是本任务产物。注意它删掉过 `task.py` 的 `convergence` 接线，已按"0.6.17 + 接线"修复。
5. **`pico3` 的 `Forbidden` 语义**仍是未验证项（Pi 里唯一可能已有拒绝路径的地方）。


### Git Commits

| Hash | Message |
|------|---------|
| `fa5a268` | feat(framework): own the loop and add a two-semantics gate boundary |
| `004eb60` | feat(framework): add work modes, the evidence plane, admission, and capability scoping |
| `22817f0` | feat(modes): add code-audit, pentest, and trading work modes with no core changes |
| `7dcac57` | docs(spec): record the framework core contracts |
| `a2affde` | chore(task): record 09-25-dove-base-agent-framework planning and research |

### Status

[OK] **Completed**


## Session 21: Code audit vertical: commit, closure, and five-task wrap-up
<!-- trellis-session: v=2 fp=1271237003ae8fb8 -->

**Date**: 2026-09-26
**Task**: Code audit vertical: commit, closure, and five-task wrap-up
**Branch**: `feat/code-audit-vertical`

### Summary

Committed the code audit vertical that the previous session left uncommitted (41 files, 7 work commits), ticked and evidenced its 13 closure boxes, and archived it plus four other in_progress tasks whose work was verified to be on master, taking active tasks from 12 to 7.

### Main Changes

## 本会话做了什么

接上一个会话未收尾的代码审计垂直（09-26-dove-code-audit-vertical），把它从"实现已完成但整个工作树未提交"
推到归档，然后逐个核对并归档了另外 4 个已经做完却一直挂在 in_progress 的任务。

### 一、代码审计垂直：提交 + 归档（8 个 commit）

上个会话在 20:25 完成了实现（M0–M6 加八轮复查、闸门 496/494/0），但 41 个文件全部留在工作树里没有提交，
任务卡在 Phase 3.4。本会话按 Phase 3.4 的分批提交流程补上：

| Hash | Message |
|------|---------|
| `20276d5` | fix(core): make finding identity path-free and move-aware |
| `f7d94e0` | feat(code-audit): add the deterministic seed spine and coverage receipt |
| `f17e03e` | feat(code-audit): add the finding claim schema |
| `a24c4ca` | feat(code-audit): register the audit capabilities and derive findings from seeds |
| `9cef15d` | test(code-audit): drive the vertical end to end |
| `fd39cba` | docs(spec): record the code audit vertical contracts |
| `4e5b6f1` | chore(task): record 09-26-dove-code-audit-vertical planning and implementation |
| `4ed2384` | docs(task): record verified acceptance criteria for the code audit vertical |

提交前重跑了闸门（不采信记录）：`npm run typecheck` 0 errors，`npm test` 496 / pass 494 / fail 0 /
skipped 2，与 `implement.md` 记录的最终闸门一致。逐路径核对过剩余 91 个脏文件，全部属于约定的排除集
（Trellis 框架 0.6.16→0.6.17 升级 88 个路径、08-27 的两个 spec、harness 任务目录），没有本任务遗留。

`implement.md` 末尾 13 个勾选框（8 条验收判据 + 5 条 start 前自查）全部补勾，并追加一节
"## Record closure" 写明依据。**其中一条写明的是缺口而不是结论**：第 3 条"用户已批准最终规划摘要"
没有任何独立产物，唯一记录是任务到达过 `in_progress`。这个任务的全部主题就是"声明跑在证据前面"，
所以按同一条标准把它写出来，而不是默认勾掉。

### 二、另外 4 个任务：核对后归档

| 任务 | 归档依据 |
|---|---|
| `09-03-task-convergence-control` | implement 31/31 全勾，自述"all AC-* 有观测证据、controller 报告 ready_to_finish"；`scripts/trellis-convergence.mts`、`tests/fixtures/task-convergence-traces.json` 均存在且在 master 上 |
| `09-06-dove-workspace-modes-context-isolation` | implement 14/14，自述全部验证命令通过；`src/core/workspace-policy.ts` 与 `bin/dove-pi.cjs:119`（`pentest` 才加 `--no-lens`）核实存在 |
| `09-01-dove-native-workflow` | 无独立完成声明，以"聚焦测试通过 + spec 契约已记录"为依据：`state-dir / project-provider / task-cli / context-projection` 39/39 通过；`src/project-provider/native-*.ts` 在 master 上 |
| `09-02-installer-reliability-recovery` | 同上依据：`managed-install-status / extensions / windows-runtime` 23/23 通过；`src/managed-install-status.ts`、`src/extensions/install.ts` 在 master 上 |

四者的 `branch` 字段都是空（09-06 甚至记成 master/master），`task.py archive` 按分支校验拒绝了它们。
核实它们的产物**确实都在 master 上**（逐个 `git cat-file -e master:<path>`），即"工作没有自己的分支、
直接落在 master"，所以用脚本为此提供的 `--skip-branch-validation` 归档——不是绕过校验，而是它命名的那个情形。

活跃任务从 12 个降到 7 个。

## 未处置 / 下一步

1. **08-27-dove-interop-layer 仍未收尾，而且是真未完**：它的两个 spec 文件
   （`personal-agent-project-context.md` +107、`quality-guidelines.md` +23）仍在工作树里没提交；
   session 19 留下的下一步是"修 `src/skills/discovery.ts` 的路径依赖后重跑 2.2"，`f513295` 是那一步的代码；
   `discoverUserSkills` / `discoverAllSkills` 仍无测试覆盖。**这是唯一一个不该动它的未收尾任务。**
2. `09-01-dove-adaptive-formal-workflow` 只差一条：`implement.md:61` "Run a longer multi-turn
   real-provider comparison for cache and model"——是一次测量，不是代码。它与已归档的 09-01-native 可能重叠。
3. `08-28-dove-pi-web` 的 `prd.md` 还是未填写的 TBD 模板，状态却是 `in_progress`——该回到 planning。
4. `08-28-dove-pi-usage-review` 状态是 `active`（非标准值），内容是中文用量报告，不是代码任务。
5. **3 个从未执行的任务（全部 artifacts 齐全，都在 Phase 1.4 评审闸门）**：
   `08-30-dove-pi-runtime-reliability-sync`（P0，父）、`08-30-dove-audit-observability-regression`（P0，子）、
   `09-26-dove-agent-harness-capabilities`（P2）。后者的结论值得先读：九项 harness 能力在 `.trellis/` 里
   已经存在并正在跑，而 `src/core/` 里对应的是"只被自己的测试引用"的库。

## 环境事实

- 本会话的 shell 看不到 `DSH_SESSION_ID`，所以 `task.py current` 解析不出活动任务；磁盘上的唯一指针
  `.trellis/.runtime/sessions/dove-pi-workspace.json` 指的是 harness 任务。**跨会话接续要靠产物和 git 判定，
  不能靠这个指针。**
- 用 PowerShell 改仓库里的 markdown 会把 UTF-8 读成 ANSI：`Add-Content`/`Set-Content` 会引入 BOM、
  把 `—` 变成 `鈥?`、并把 LF 换成 CRLF。文件原本是纯 LF。最后用 python 按字节修正。
  **改这个仓库的文件要么用 Edit/Write，要么用 python，不要用 PowerShell 的文本 cmdlet。**
- `Select-String -Pattern '\[x\]'` 走管道（`$c | Select-String`）不生效，用 `-Path` 才生效；
  `if (git cat-file -e ...)` 这种"用命令当条件"的写法恒为假，因为该命令无输出——我因此差点报了一个
  不存在的问题（"master 上没有 native-provider.ts"）。**判存在用 `$LASTEXITCODE`，不要用输出真值。**


### Git Commits

| Hash | Message |
|------|---------|
| `20276d5` | fix(core): make finding identity path-free and move-aware |
| `f7d94e0` | feat(code-audit): add the deterministic seed spine and coverage receipt |
| `f17e03e` | feat(code-audit): add the finding claim schema |
| `a24c4ca` | feat(code-audit): register the audit capabilities and derive findings from seeds |
| `9cef15d` | test(code-audit): drive the vertical end to end |
| `fd39cba` | docs(spec): record the code audit vertical contracts |
| `4e5b6f1` | chore(task): record 09-26-dove-code-audit-vertical planning and implementation |
| `4ed2384` | docs(task): record verified acceptance criteria for the code audit vertical |

### Status

[OK] **Completed**


## Session 22: Harness capabilities: M3 complete, mode files made honest
<!-- trellis-session: v=2 fp=87757b45513705c0 -->

**Date**: 2026-09-27
**Task**: Harness capabilities: M3 complete, mode files made honest
**Branch**: `feat/agent-harness-capabilities`

### Summary

Finished M3 and closed the harness task. Wired the capability scope into the action policy; consumed ask_before at the host boundary by asking the operator through the host's own confirmation dialog (GateDecision gained an ask arm, both loops share normalizeGateDecision, approvals and refusals are recorded as gate.approved/gate.refused); fixed three shipped mode files that declared controls they did not have - trading's limits were unscoped and refused every non-order action, code-audit declared conformance with no document so it refused to load at all, and code-audit's always_allow wildcard matched no action. Gate: typecheck 0 errors, npm test 582 tests / 580 pass / 0 fail / 2 skipped.

### Git Commits

| Hash | Message |
|------|---------|
| `7312367` | feat(scope): consult the capability scope in the action policy |
| `d82cc40` | chore(task): record M3 complete except ask_before |
| `18a17e4` | feat(gate): ask the operator before an action a mode lists in ask_before |
| `ed4a560` | docs(spec): state how an ask is refused, and that the two asks differ |
| `279caa0` | chore(task): record M3 complete |
| `d444cd4` | fix(modes): make code-audit loadable, and its read permission mean something |
| `0fb044f` | docs(spec): keep the framework-core spec inside its context budget |
| `1c97a89` | chore(task): record the two mode-content decisions |

### Status

[OK] **Completed**


## Session 23: Two mode-declaration fixes: a gate that declares no gate, and a grant nothing implements
<!-- trellis-session: v=2 fp=305f94473d921e3a -->

**Date**: 2026-09-27
**Task**: Two mode-declaration fixes: a gate that declares no gate, and a grant nothing implements
**Branch**: `feat/mode-declared-capability`

### Summary

Planned and completed both follow-ups from the harness task. (1) mode-gate-no-gate: gate.semantics gained 
one; limit/both with no limits and none with limits now refuse to load, naming both ways out; code-audit declares none and moves to 1.6.0. (2) mode-declared-capability: the action policy refuses a capability a mode grants and nothing registers, before the approval prompt and before the effect claim. Its premise was falsified mid-flight - six of the nine capabilities the shipped modes declare have no implementation - so five host cases were re-pointed at fixture modes over registered capabilities, and the detector's sensitivity was verified by hand. Also dropped and archived a trading-submission task as unnecessary. Gate: typecheck 0 errors, npm test 594 tests / 592 pass / 0 fail / 2 skipped.

### Git Commits

| Hash | Message |
|------|---------|
| `8d651b6` | docs(readme): state the permission layer a declared work mode adds |
| `d0244fd` | chore(task): record the post-archive documentation audit |
| `7c32cc3` | chore(task): plan the two mode-declaration fixes and archive the dropped task |
| `965cbe0` | feat(mode): refuse a gate declaration that cannot decide anything |
| `c8ac74a` | docs(spec): record the no-gate value and the two refusals |
| `48fea4a` | docs(task): correct a test count in the archived harness record |
| `e1b0097` | chore(task): record the gate-semantics outcome |
| `7bc8f91` | chore(task): move the capability-registration rule to a spec with headroom |
| `dc4f6d7` | chore(task): start the declared-capability task |
| `1123e96` | feat(policy): refuse a capability the mode grants and nothing registers |
| `8c59e7c` | docs(spec): state how a mode's grant and the registry disagree |
| `39263da` | chore(task): record the capability-registration outcome |

### Status

[OK] **Completed**
