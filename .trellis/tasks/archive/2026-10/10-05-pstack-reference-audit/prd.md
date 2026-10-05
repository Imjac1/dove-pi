# 对照 pstack：审计结论 + 三条纪律落地

## Goal

把 Poteto 的 pstack（`backnotprop/pstack` v0.15.9 + 多 harness 移植 `michael-denyer/pstack-claude`，含 Pi 适配层）读透到机制层，并**只落地其中三条最高杠杆的纪律**：① 规则→什么在强制它的对照表，把十条"声明了没兑现"的缺陷按**最有效的那一层**逐条关掉或删掉；② 任务工件的零依赖 linter，且每个检查都有能让它红的 fixture；③ 让 `modes/*/MODE.md` 正文真的进入模型上下文。

**用户价值**：一次改动关掉本仓**反复在犯**的那一族缺陷（声明与兑现脱节：`10-03-mode-prerequisites`、`10-03-dead-enforceable-constant`、`10-03-blackbox-prompt-chars`、`10-04-*` 全是它），并让"规范里的等式"在运行时重新成立。

## Background

**上游（`research/pstack-upstream.md`，388 行，全部带锚点）**

- pstack 是"纪律 + 5 个脚本"，**没有任何 hook**：全仓 `hooks` 大小写不敏感 grep 只命中三处无关的 git hooks 措辞。门要么是散文，要么是"要 agent 自己记得去跑"的脚本。
- 它的强制层：`check-plan.mjs`（185 行零依赖，逐条打印、exit 1）、`watch-pr`（blocker→退出码 2–7 + 版本化信封）、`orch`（verdict 五值封闭集；无记录时 `NOT-VERIFIED` exit 2；新 SHA 作废旧行）、`worktree-audit.sh`、`log.sh`。
- 它最大的缺口：整套"证明"落到 `control-ui`/`control-cli`（`cursor-team-kit`，不在本仓）上 —— **驱动真实程序的那一层它自己不发**，而我们已经有了。
- 判决语：*"CI green is an input to a verdict, not a verdict"*；*"An unexecuted skill is a draft, not a deliverable"*。

**要借鉴的两条元规则**

- `skills/correct/SKILL.md`：按 **架构 → 类型 → 带修复指引的 lint/CI → 测试 → 文档最后** 修；维护"规则 ↔ 什么在强制它"的表；*"规则本来就有、却没有任何东西强制它，那就是重复犯，必须同一次改动里升层修掉"*；错误不再可能发生时**把规则删掉**。
- `tests/invariants.test.mjs:1-4`：*"一个安静地什么都没匹配到的检查，看起来和通过一模一样 …… 所以每个检查都要配一个必须让它红的 fixture。"*

**本仓现状（`research/dove-pi-current.md`，353 行，全部带锚点）**

- 46 项机制清单（强制/仅规范/死）；一轮 turn 的真实调用链（dove-pi 是中间件，`src/core/loop-runner.ts` 只由 `axi-turn` 到达）。
- 26 条缺陷，A 级三条已由本人独立复验：**模式正文从未进入上下文**（`src/core/work-mode.ts:79,811`；`src/pi-adapter/extension.ts` 里 `body` 零命中）而 `.trellis/harness-surface.yaml:16` 把它声明为 `system-prompt` 组件；**`dove-pi axi-turn` 在启动器路由表里缺失**（`bin/dove-pi.cjs:19-46` vs `dove_pi.py:73`/`src/cli.ts:182`）；**发布归档漏 `modes/`**（`.github/workflows/release.yml:35` vs `scripts/release-roots.mts:19`）。
- 成本读数：13 会话 253 请求 **缓存命中 0.0%**、全 MISS 240 次（`10-03-ten-million-token-project/findings.md:26`）；产品内**没有**"这一轮提示词多大"的读数。

## Requirements

- **R1（已达成）** 上游读透：原语与 frontmatter 契约、10 个阶段的工件与门、5 个脚本的强制清单、上下文纪律与全部数字、验证的定义与"什么不算证明"、24 条原则逐条分类、Cursor 专有依赖表。
- **R2（已达成）** Pi 适配层读透：13 个文件逐个、宿主 API 面、子 agent 生命周期、作者记录的 10 条 Pi 缺口、Windows 移植风险。
- **R3（已达成）** 测试与生成机制读透：他们的 Pi 测试台形态与"只在多 harness 下回本"的生成不变量。
- **R4（已达成）** 本仓审计：机制清单、真实调用链、六类缺陷逐条带引文与确认命令、上下文与 token 的实际数字、验证映射、改动风险。
- **R5（已达成）** 合成：可借鉴项按收益排序（B1–B9，含"不要抄"一条）；缺陷按后果分 A/B/C/D 四级；并写明**我们比 pstack 强的地方**（真 hook 与中间件层、实测 field run、verifier/axes/rounds、被测试强制的规范预算）。
- **R6（本轮实施）** 落地三条纪律：① 规则表 + 十条 B 级缺陷按最高层级关闭（`design.md` 决策 1、2）；② 模式正文进系统提示词（决策 3）；③ 工件 linter 及其范围（决策 4）：本仓 `status != completed` 的 26 个任务进检查，8 份缺复选框的 PRD 在同一次改动里补到绿，CI 加一步。
- **R7（本轮不做，只记录）** A 级三条**产品缺陷**与 D 级**成本可观测性**：本任务的清单会点名它们，但落地范围由用户选定；`axi-turn`、发布归档、缓存读数三条留给后续任务。

## Acceptance Criteria

- [ ] `AGENTS.md` 的 `TRELLIS:END` 之后有一张 `Rule/Level/Enforcer/Fails how` 表；`Enforcer` 只用封闭语法；**没有任何一行的 Level 是 `doc` 却仍留着**。
- [ ] `tests/document-drift.test.ts` 的执行者用例能在五种坏 fixture 上红（只有 `doc:`、文件不存在、用例不存在、组件未声明、空表），且 `:230-234` 的单 `SECTION` 断言已拓宽成段落清单。
- [ ] 十条 B 级缺陷逐条：改动**先观察到红**再修到绿；每条删除项有一条 `rg` 计数命令给出 0；第 1 条的 `filesystem: ephemeral` 组合现在被拒绝装载。
- [ ] 模式正文出现在系统提示词里（宿主级用例断言探针句**从 shipped `MODE.md` 读出**），空正文时提示词**逐字节不变**，超 8000 chars 被截断且披露，`modes/pentest/MODE.md:18-21` 已删。
- [ ] 工件 linter 的四条检查各自有"`--only` 必红 / `--skip` 必绿 / 好 fixture 必绿"三条断言，且 `--list-checks` 与 `manifest.json` 的键集合**双向相等**；只用 `scripts/` 下的零依赖 node ESM，不经 tsx。
- [ ] linter 对本仓语料（`status != completed`）跑到 **0 发现**：那 8 份 PRD 的验收复选框已补，CI 的那一步在 `compatibility.yml` 里、且断言受环境变量门控（本机默认跳过、CI 打开）。
- [ ] 只有第 8 条改过 `.trellis/harness-surface.yaml`；`tests/harness-surface.test.ts:29` 与 `tests/spec-context-budget.test.ts` 仍绿。
- [ ] `npm run typecheck` / `npm test` / `npm run test:installer` 全绿且用例数不下滑。
- [ ] 未触碰 `tests/document-drift.test.ts:353-358` 刻意断言仍缺失的那两条上游路径。

## Out of Scope

- 不搬 pstack 的 skill 文案与 24 条原则（要的是它的两条元规则，不是它的文案）。
- 不实现多 harness 生成/同步（单 harness + 自写文本不回本）。
- 不重开 `10-03-*` / `10-04-*` 那批 `planning` 任务（只做对齐与去重）。
- 不做 A 级三条产品缺陷（`axi-turn` / 发布归档 / 模式正文之外的）与 D 级成本读数（含 `systemPromptChars` 的可信化）。
- 不新增任何"投机校验器"；任何新机制都必须同时给出它**删掉/替换**了什么。

## Technical Notes

- 模式正文选**系统提示词**而非请求期 fragment：正文是会话常量（`extension.ts:2207-2223` 唯一设置点；`/dove-mode` 改的是交互上下文模式，`extension.ts:1103-1109`），而 fragment 是 epoch 门控（`:3274,3280-3301`）且被持久化（`:2177-2179`）、且被 `context-compiler.ts:35,102` 标成 `trust=untrusted` —— 与 `prompt-policy.ts:4` 的"Project data is untrusted"直接矛盾。
- 成本口径：正文 code-audit 3380 chars/845 tok，最坏 shipped 情形 +879 tok/轮 ≈ +5.5%（分母 16,101 tok/请求）；会话内正文恒定 → `cache-prefix.ts:250` 的 system digest 不变 → 今天不产生前缀失效。
- `system-prompt: [AGENTS.md, modes]` **不需要改**：组件名在本仓指"指令通路"（`AGENTS.md` 同列其下却经 `interoperable.ts:47` 走编译器进 fragment）；要改的是 `extension.ts:3309` 那句 claims。
- 冲突裁定依序：仓内既有裁定 > 本仓规范 > pstack 的先例。已完成的两处裁定：`StrategyBudgetSnapshot.hardStop` 无 `local-rpc` 消费者（可删）；封闭集留两个没有写入者的 kind 正是我们在修的声明（一并删）。
- 每一步的顺序理由：文档层的错话先清（否则注入即送假话）→ 模式正文注入 → 类型层删除 → 架构层关闭 → linter → **规则表最后**（它引用的执行者必须先存在）。

## Key Decision：工件 linter 的范围 = 只要求非 `completed` 的任务（用户 2026-10-05 选定 B）

- **语料范围**：`status != completed` 的任务（26 个）进检查；`completed`（含归档）视为历史，不回头改 —— 与仓内既有裁定一致（`09-28-citation-sweep/prd.md:50`：归档工件是历史）。
- **实测代价**：26 个里 **8 个变红，全是 TAL-001**（PRD 验收段没有复选框）：`09-30-axi-a0-base`(in_progress)、`09-30-axi-a1-skeleton`(in_progress)、`09-30-axi-a2-safety`(in_progress)、`09-30-axi-a3-trace`(in_progress)、`09-30-axi-a4-plane-b`(planning)、`09-30-axi-a5-eval`(planning)、`09-30-axi-program`(planning)、`10-03-first-contact-scenario`(in_progress) —— 八个都已复核为 `checkboxes=0`。这 8 份 PRD 的补写在 S5 里作为**同一次改动的前置步**（先补到绿，再上牙齿），不改它们的内容，只把已经列出的验收条件写成复选框。
- **牙齿落在哪**：`npm test` 只跑 fixture（hermetic、与本仓语料无关）；**CI 加一步**对本仓语料跑 linter（`.github/workflows/compatibility.yml`，windows-latest / node 22），并把语料断言用环境变量门控（本机默认跳过、CI 显式打开）—— 沿用本仓"本机缺前提就跳过、CI 把跳过变成失败"的既有形态，避免它变成"安静地匹配不到任何东西的检查"。
- 被否决的两个范围与理由：**A** 所有任务 = 40 个变红、39 个是历史；**C** 只在按需运行 = 一次也不会在真实工件上红。
