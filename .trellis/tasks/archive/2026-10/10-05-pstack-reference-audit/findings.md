# pstack 对照审计：它怎么做的、能借鉴什么、我们现在做错了什么（2026-10-05）

**被对照的东西**：`backnotprop/pstack`（Poteto 的 pstack，Cursor 官方插件的镜像，v0.15.9，快照 2026-10-04）与 `michael-denyer/pstack-claude`（同一套 skill 的多 harness 移植，含 **Pi 适配层**）。
**证据**：四份研究文档在 `research/`，每条结论带 `path:line`；本文只汇总，锚点转引时可回查。
**本文档中带 ★ 的三条由我本人在本仓库重新验证过**，其余取自 `research/dove-pi-current.md` 的带锚点清单。

---

## 一、三句话

1. **pstack 不是运行时，是一套纪律 + 6 个脚本。** 全仓 **没有任何 hook**（`research/pstack-upstream.md` §3.F：`hooks` 全仓大小写不敏感 grep 只命中三处无关的 git hooks 措辞）。每一个门要么是散文，要么是一个"要由 agent 自己记得去跑"的脚本。它的价值不在强制执行，而在**把纪律写成能命名、能引用、能被脚本核对的东西**。
2. **它最值得抄的不是 skill 内容，是两条元规则**：`correct` 的「**在最有效的那一层修，并维护规则→强制机制的对照表**」，和 `invariants.test.mjs` 的「**每个静态检查都必须配一个能让它红的 fixture**」。这两条正好命中我们仓库反复出现的缺陷类。
3. **我们现在的漏洞不是"缺少 pstack 的 skill"，而是"声明了却没兑现"** —— 模式正文从未进入上下文、`axi-turn` 在启动器里走错分支、发布归档漏 `modes/`、一批被展示却永不生效的常量。我们**有** pstack 没有的 hook 与中间件层，问题出在这些层没有把仓库自己的声明接上。

---

## 二、pstack 是怎么做的

### 2.1 一层原语：`skills/<name>/SKILL.md`

- 53 个 `SKILL.md`，**52 个带 `disable-model-invocation: true`**：`description` 是唯一的注意力竞争面，**正文按名加载**，不会自动进上下文。唯一例外是 `setup-pstack`。
- `description` 写成**触发器**（含否定触发："Skip when the test path is unclear…"），不是说明文。
- 唯一带文件触发的是 `typescript-best-practices` 的 `paths: ["**/*.ts", "**/*.tsx"]`。
- 约束 skill 大小的规则是散文，不是预算："When in doubt, delete. **Keep only prose that changes a decision.**"（`skills/poteto-mode/playbooks/authoring-a-skill.md:10`）；"Reference, don't inline."（`skills/automate-me/SKILL.md:97`）。全仓**没有**行/token 预算（§8 已记为不确定项）。

### 2.2 上下文怎么省：路由内联，正文按路径打开

- 23 个 playbook 在 router 里**各占一行**（`skills/poteto-mode/SKILL.md:137-159`），只有被匹配的那个才 `open its file`（`:133`），且**步骤逐字拷进 todo list**。
- 没做的步骤必须留痕：`skip: <reason>`（`docs/guide/01-setup.md:45`）。
- 子 agent 拿**文件指针**不拿内联内容（`skills/poteto-mode/SKILL.md:95`：`file pointers not inlined context`）。
- 常用内容反而不拆出去："Keep frequently used content inline. Templates and references used on every invocation belong in the skill file, not in separate files that cost a read each time."（`principle-guard-the-context-window/SKILL.md:15`）

### 2.3 强制层：只有 5 个脚本被指令点名

| 脚本 | 它强制什么 |
|---|---|
| `check-plan.mjs`（185 行零依赖 Node） | 计划文档的**形状**：H1、固定小节顺序、导语 10 行以内、每个 PR 块的 9 个子块按**精确顺序**、`Verify, live.` 必须恰好十条 lane 且每条带截图与 `Pass when`、正文里不许长破折号/弯引号/句中冒号。逐条打印问题，有问题 exit 1 |
| `watch-pr` | "merge-ready" 的**唯一机器裁决**：blocker → 退出码（冲突 2 / review thread 3 / 检查失败 4 / 超时 5 / merge-gate 6 / 查询失败 7），每次输出带版本化信封 `{schemaVersion, sequence, observedAt, mode}` |
| `orch` | 程序账本：verdict 是**五值封闭集**，非法值拒绝；没有 (PR, head SHA) 的行时返回 **`NOT-VERIFIED`（exit 2）而不是空串**；新 SHA 让旧行作废 |
| `worktree-audit.sh` | 只分类不删除，桶是"建议不是许可" |
| `log.sh` | 决策日志的列形状与公式注入防护 |

判决语言是统一的："**CI green is an input to a verdict, not a verdict**"（`orchestrate.md:89`）、"CI green is not a verdict, and an approving bot review is not a verdict"（`shipping.md:7`）、"An unexecuted skill is a draft, not a deliverable"（`create-verification-skill/SKILL.md:40`）。

### 2.4 它的最大缺口

整套"证明"故事落到 **control skill**（`control-ui`/`control-cli`，来自 `cursor-team-kit`，本仓没有）上：十条 live lane 的定义就是"用 control skill 驱动真实界面"（`multi-phase-plan.md:13-15`）。**驱动真实程序的那一层，pstack 自己不发。** 而我们已经有这一层（field run + 黑盒读数）。

### 2.5 它的 Pi 适配层（`pstack-claude`）

13 个 TS 文件，只依赖 `@earendil-works/pi-coding-agent` + `typebox`，12 个文件对宿主只作**类型**依赖。可抄的形态（详见 `research/pstack-pi-adapter.md`）：

- 子 agent 用 `pi --mode rpc` + **stdin RPC 传 prompt**，不用 argv（`pi/child.ts:120`，理由 `child.ts:51-56`："argv never caps it and a leading @ is never a file"）。
- 完成判定用 **`agent_settled`** 而非退出码，正文与 stderr 诊断分开（`pi/agents.ts:81`）。
- 输出按 **UTF-8 字节**安全截断 + 50 KB 上限 + 全量落盘并给指针（`pi/agent-text.ts:12-15,30`）。
- 后台 agent 立即返回 id，完成**以消息投递**（`pi/agent-tools.ts:69-73`）。
- agent 记录写入 session entry，启动时 restore，**pid 身份校验之后才回收孤儿**（`pi/agents.ts:327,333-353,122`）。
- `paths:` frontmatter → 首次命中文件的 `tool_result` 追加一句"去读该技能"（`pi/path-skills.ts:42-55`）。
- `before_agent_start` 上幂等重设 named system-prompt 段，压缩后不丢（`pi/prompt.ts:31-38`）。
- **风险**：整层是 POSIX 形状（`process.kill(-pid)`、`ps -o args=`）。Windows-first 抄之前必须换成 `taskkill /T /F` + `Get-CimInstance Win32_Process`，否则"停止子进程"会静默失效。

### 2.6 它的测试台纪律

`tests/invariants.test.mjs:1-4` 是全套里最便宜、最高收益的一条：*"A check that quietly matches nothing looks identical to a pass, and that already happened once… so **every check gets a fixture that must trip it**."* 其余：共享 fake host（`tests/pi/harness.mjs`：注册面/消息面/事件面只定义一处）、声明式 step 脚本的假子进程（未知 step 直接 `exit 64`）、**断言完整 argv**、每个检查配正/反/已知漏/已知过度拦截四组、live 套件靠环境变量门控且"本机缺前提就跳过、CI 用环境变量把跳过变成失败"。

---

## 三、可借鉴的（按收益排序）

| # | 机制 | pstack 锚点 | 我们缺什么 |
|---|---|---|---|
| **B1** | **规则→强制机制的对照表 + "在最有效的那一层修"** | `skills/correct/SKILL.md`：架构 → 类型 → 带修复指引的 lint/CI → 测试 → **文档最后**；"If the rule was already there and nothing enforces it, that's a repeat, so fix it at the highest level in the same change"；"Drop a rule once its mistake can't happen" | `AGENTS.md` 目前**整篇是散文修正记录**（两处文档纠偏），没有任何"这条规则由什么强制"的对照；同一族缺陷（声明了没人兑现）已在 `10-03-*`、`10-04-*`、本轮反复出现 |
| **B2** | **工件 linter（计划/PRD 形态）** | `check-plan.mjs`：零依赖、逐条问题、exit 1 | 我们的 `prd.md`/`design.md`/`implement.md` 只有 `task.py validate`（非空 + JSONL 有条目）；`tests/document-drift.test.ts` 只验"名字解析"，`tests/spec-context-budget.test.ts` 只验"标题清单还在"（D17/D18） |
| **B3** | **description = 触发器，正文按名加载** | 52/53 个 skill 的 `disable-model-invocation` + router 内联一行 | 我们的 `MODE.md` 正文**被加载但没有任何消费者**（★D2），而 `harness-surface.yaml:16` 把它声明为 system-prompt 组件（★D12）——即这句声明运行时为假 |
| **B4** | **每个静态检查配一个能让它红的 fixture** | `tests/invariants.test.mjs:1-4` | 我们的静态检查大量是"断言声明形状"（D16/D17/D18/D19）——删掉功能也仍然绿 |
| **B5** | **裁决用退出码 + 版本化信封** | `watch-pr/policy.ts:266-271,311-319`（退出码 2–7） | `scripts/harness-failures.mts` / `harness-corpus.mts` / `harness-rounds.mts` 目前以人类可读文本为主，没有"一个数字能被 agent 分支"的协议 |
| **B6** | **账本以 (主体, 修订) 为键，`NOT-VERIFIED` 是一等答案** | `orch/store.ts:17-26,1366-1369` | 我们**已有** `recordedAtRevision` 与 round 边界裁决（这块不必抄）；缺的是"新修订让旧裁决作废"的显式声明与 `patch-id` 式的稳定性（rebase 改 SHA 时裁决不该静默继续有效） |
| **B7** | **Pi 子 agent 的工程形态**（rpc stdin / settled / 字节安全截断 / 后台+消息投递 / 孤儿回收） | `pstack-claude/plugins/pstack/pi/*` | 我们现在是 `--print -- <prompt>`（★`src/pi-adapter/subagent-provider.ts:102`），`MAX_PROMPT_CHARS` 卡 32 000（★`:68`），成功判定是 `code === 0 && stdout.trim()`（★`:118`），截断按**字符** `slice`（★`:63`，会切多字节），`agent_subagent` 纯同步 |
| **B8** | **共享 fake host 测试台** | `tests/pi/harness.mjs` + `fake-pi.mjs` | 我们 `tests/pi-adapter.test.ts` 每个用例内联构造假 API/context（"每个测试自己发明一次宿主"），且没有"扩展真实入口 + 假宿主"的共享台 |
| **B9** | **`skip: <reason>`** | `poteto-mode/SKILL.md:133` | 我们的流程步骤静默跳过时不留痕 |
| — | **不要抄**：generate/sync/substitutions/forks 那套 | `tools/*` | 那解决的是"文本从别人的 harness 仓库继承"，只有 vendored 文本才回本；单 harness + 自写文本的我们不值 |

---

## 四、我们现在做错的地方（按后果排序）

### A 级：产品行为不对（三条我都重新验证过 ★）

1. **★模式正文从未进入上下文，而规范说它是系统提示词的一部分。**
   `src/core/work-mode.ts:79` 声明 `readonly body: string`，`:811` 赋值；`src/` 全树对 `.body` 的唯一其它命中是 `cache-prefix.ts:89-90` 的注释（讲的是 HTTP body）。`src/pi-adapter/extension.ts` 里 `body` 零命中。
   后果：`modes/code-audit/MODE.md` 的九项检查、`modes/trading/MODE.md:27-31` 的"未知结果不许自行重提"、`modes/code-development/MODE.md:12-24` 的方法**从不进入模型上下文**；一个模式实际生效的只有 `permissions/fence/sandbox/limits/effect-classes` 这些结构化字段。
   同时 `src/pi-adapter/extension.ts:3309` 拼系统提示词时写的正是"**Dove execution mode … supplied separately at request time**"，而 `.trellis/harness-surface.yaml:16` 把 `modes` 列为 `system-prompt` 组件、`src/pi-adapter/extension.ts:590-597` 只校验路径存在 → **"编辑落在面内=对运行时有影响"这个等式在 `modes` 上为假**，而 `harness-rounds` 正是按它判 surface fit。
   确认：`rg -n "\bbody\b" src/pi-adapter/extension.ts` → 无输出。

2. **★`dove-pi axi-turn` 走的不是 CLI 那条路。**
   `bin/dove-pi.cjs:19-46` 的 `pythonCommands` 集合**不含 `axi-turn`**，于是 `shouldUsePiFastPath`（`:48-66`）返回 true，`:168-169` 直接 `spawnPi(["axi-turn", …])`；而 `dove_pi.py:73` 的 `LOCAL_CLI_COMMANDS` 里写着 `axi-turn`，`src/cli.ts:182` 也有对应分支，帮助文本也把它当命令列。
   后果：安装态下帮助里那条命令**到不了** `src/cli.ts:182`，参考 loop 的唯一产品入口在文档给出的路径上不可达。该文件还在类型门之外（`tsconfig.json:22` 的 `include` 不含 `bin`），唯一覆盖它的测试只断言源码里**存在**三个标识符（D16）。
   确认：`Select-String -Path bin\dove-pi.cjs,dove_pi.py -Pattern axi-turn` → 只命中 `dove_pi.py:73`。

3. **★发布归档漏掉 `modes/`，而摘要清单覆盖它。**
   `.github/workflows/release.yml:35` 的 `$include` 为 `bin, installer, scripts, src, tests, .pi, dove_pi.py, package.json, package-lock.json, tsconfig.json, README.md, README.en.md` —— **没有 `modes`**；`scripts/release-roots.mts:19` 却把 `modes` 当作产品内容纳入 `sourceDigest`，`scripts/check_release_readiness.py:26-33` 的必需文件里也没有任何 `modes/…`。
   后果（读出来的推演，未构建过归档）：装完之后 `src/core/work-mode.ts:929-931` 选中 `modes/pentest` 会装载失败，`src/pi-adapter/extension.ts:2628-2630` 随之**拒绝所有工具调用**；"摘要相同的两次发布"这一保证与"装完模式能不能用"脱钩。

### B 级：声明与兑现脱节（pstack 的 `correct` 点名的"重复犯"族）

| # | 缺陷 | 锚点 | 后果 |
|---|---|---|---|
| D1 | `ENFORCEABLE_SANDBOX` 全仓只出现一次（定义处） | `src/core/work-mode.ts:207`；真正判定用字面量写在 `src/pi-adapter/extension.ts:2252-2258` | 一个读起来像强制点的集合，改它不改变行为；两边可各自漂移。任务 `10-03-dead-enforceable-constant` 至今 `planning` |
| D3 | `readOnlyToolHardStopThreshold` 被算、被传、被显示，**从不比较** | `src/pi-adapter/progress-guard.ts:25,227-229`；`src/pi-adapter/extension.ts:980` | `/status` 打印 `readOnly=…/40` 这种"天花板"，没有任何分支会因它终止。规范自己说它是 advisory，不诚实的是字段名与投影 |
| D6 | `getProjectContextBudget` 的 `promptChars` 传入后从不读 | `src/pi-adapter/extension.ts:3441`（调用 `:3242`） | 决定"给项目上下文多少字符"的算式没有减去本回合自身长度，而这正是被记录过的截断事故的变量之一 |
| D4 | dispatch policy **零产品调用者** | `src/core/dispatcher.ts:29`、`src/core/dispatch-policy.ts:3`；`tests/harness-reachability.test.ts:93-94` 把它列进 `ALLOW_LIST` | `personal-agent-capability-runtime.md:221-293` 整节描述的是没有消费者的契约；`dispatch.decided/completed` 仍在封闭集里 |
| D7 | 同一"至多一次"规则两份实现，产品只用其一 | 产品 `src/core/effect-boundary.ts:75`；测试专用 `src/core/effect-ledger.ts:411` | 8 处并发断言覆盖的不是产品路径 |
| D15 | 两个预算函数，保留量 5% vs 10%，其中一个只被测试用 | `src/pi-adapter/extension.ts:3420` vs `:3438` | 读者无法从名字判断现行规则 |
| D13 | 拒绝计数两份逐字相同的实现，与"Nothing here is derived twice"直接冲突 | `src/core/harness-verifier.ts:58` vs `src/core/harness-axes.ts:63`；`src/core/harness-corpus.ts:14` | corpus 与 convergence status 会对同一账本给出不同拒绝数 |
| D14 | 主机工具面三份名单互不一致 | `src/core/action-policy.ts:21`（8 名）/ `tests/fixtures/representative-tool-catalog.ts:2-11`（57 名）/ `tests/work-mode.test.ts` 硬编码 | `sandbox.network: none` 的覆盖面取决于选了哪份名单 |
| D10 | 模式文档把**已经生效**的控制写成"操作者责任" | `modes/pentest/MODE.md:18-21` "no runtime caller" vs `src/pi-adapter/extension.ts:2230` 真实调用 | 最危险的一种漂移方向：读者以为要手工做（或以为可以跳过）一个已自动发生的检查 |
| D11 | 同一模式内两种说法冲突，其中一句不可能成立 | `modes/code-audit/governance.yaml:14-19` 指向 `permissions.yaml`，而 `src/core/work-mode.ts:191` 的允许字段只有四个键 | 读者去找一个不存在的声明；同一事实在 `modes/code-development/governance.yaml:16-19` 已写对 |
| D22 | 唯一每回合注入的文档里留着自述"当前 DEAD"的分支 | `.trellis/workflow.md:131-136` | 任何按该状态写的行为都拿不到输入 |

### C 级：测试只钉声明，不钉行为

- `tests/installer_test.py:209-213` 只断言启动器源码里**存在**三个标识符 —— 把 `axi-turn` 修好（D5）它照样绿。
- `tests/document-drift.test.ts:67-78` 只断言"被点名的符号是导出函数" —— 符号从生产调用点摘掉后仍绿；文件头自己承认"a check holds that a name resolves, never that the sentence around it is still true"。
- `tests/spec-context-budget.test.ts:116-120` 断言的是规范文档的**标题清单** —— 章节删空仍绿，改名却红。
- `tests/runner-pattern.test.ts:18-27` 断言的是运行器 glob 的假设。
- `scripts/real-dove-blackbox.mjs:404` 采集 `systemPromptChars`，测试里只有类型声明、**零断言**（`10-03-blackbox-prompt-chars` 记录该值在 Pi 1.0.0 上已不再为正，仍 `planning`）→ 一个用来说明"系统提示词多大"的读数可以安静变成 0 而不红。

### D 级：成本与规模的可观测性

- **缓存命中 0%。** 跨 13 会话 253 请求：`cacheRead 0`、累计命中 0.0%、全 MISS 240 次、4,073,554 prompt 全价付（`10-03-ten-million-token-project/findings.md` 优化点 1）。而 `src/core/cache-prefix.ts`、`src/pi-adapter/cache-diagnostics.ts`、`token audit`/`cache audit` 都在 —— **机制齐、读数缺，没有任何东西在命中率掉到 0 时报警**。
- **产品内没有"这一轮提示词多大"的读数。** `rg -n systemPromptChars tests` 只命中类型声明；`extension.ts:3241` 算过一次 `promptChars` 但既不落账也不断言（D6）。Trellis 侧反而有被测试强制的预算（`tests/spec-context-budget.test.ts:92-95`：router ≤ 8 KiB、被路由规范 ≤ 24 KiB）。

---

## 五、我们比 pstack 强的地方（别抄错方向）

| 我们有的 | 证据 | 为什么不要因为"pstack 那样做"而丢掉 |
|---|---|---|
| **真正的强制层**：hook + 中间件 + 工具边界 | `src/core/action-policy.ts`、`src/pi-adapter/extension.ts`、`.codex/hooks/` | pstack 全部门都是"你记得去跑"；我们能在工具边界拒绝并**点名理由与出路**（`modes/*` 的 sandbox/fence 实测拦下写放行读） |
| **实测的 field run 与读数格式** | `scripts/real-dove-blackbox.mjs`、规范 §4 | pstack 的"证明"落到它不发的 control skill 上；我们已经有驱动层和固定的读数格式 |
| **verifier / axes / rounds 这套仪器** | `src/core/harness-axes.ts`、`harness-round.ts`、`harness-verifier.ts` | pstack 没有"编辑 verifier 不算一次 loop turn"这种边界概念 |
| **被测试强制的上下文预算（Trellis 侧）** | `tests/spec-context-budget.test.ts:92-95` | pstack 没有任何 skill 规模预算 |

**所以正确的姿势不是"把 pstack 的 skill 全家搬过来"**（那正好犯 `principle-subtract-before-you-add` 反对的错），而是**用它的两条元规则（B1 对照表、B4 每个检查配反例）来关掉我们自己的漏点**。

---

## 六、下一步的三个候选（这是需要你决定的地方）

| 方案 | 内容 | 代价 / 收益 |
|---|---|---|
| **A（推荐）** | 只落地三条最高杠杆：① `AGENTS.md` 换成"规则→强制机制"对照表 + 把 D1/D3/D6/D7/D15 这类"声明了没兑现"按**最有效的那一层**逐条关掉或删除；② 给计划工件加一个零依赖 linter（B2）并给每个静态检查配反例 fixture（B4）；③ 让 `modes/*/MODE.md` 正文真的按模式加载进入上下文（B3，顺带修掉 D2/D12 的假等式） | 一次改动关掉"我们反复在犯"的缺陷类 + 让规范与运行时的等式重新成立；不引入新原语 |
| **B** | 先修 A 级三条缺陷（模式正文、`axi-turn`、发布归档），pstack 借鉴先放着 | 立刻恢复三个"产品行为不对"的点；但缺陷类（B 级）会继续长出来 |
| **C** | 只到这里：报告 + 四份研究文档入库，不动代码 | 零风险；但 `10-03-*` 那批 `planning` 任务会继续与这份清单重叠 |

---

## 七、落地之后：这一轮自己长出来的发现（2026-10-05 晚，实施 S1–S6 期间）

| # | 发现 | 证据 | 处置 |
|---|---|---|---|
| **E1** | **`mode.changed` 是封闭集里第三个"没人写"的记录种类** | 新加的检查（`tests/harness-reachability.test.ts#reaches every record kind from a writer`）从 `src/core/contracts.ts` 读联合体、要求每个成员在别处作为字面量出现 —— 它点出了唯一一个没有写入者的种类 | 从联合体删除；四处用它当 fixture 的测试改指 `capability.started`；`tests/fixtures/ledger/legacy.jsonl` 里那一行**保留**（那支用例的对象正是"读到不认识种类也要读下去"）。若当初只靠人工审计，这一条会跟着 D4/D7 一起漏掉 |
| **E2** | **我自己写进规则表的两行是"有声明没执行者"** —— 正是本任务在关的那一类 | 规则表的门只能验"名字解析得到"，验不了"那个用例真的在查这条规则"。两行（"至多一次的实现在产品路径上只有一份"、"一条规则不做第二遍推导"）指的 suite 走的是模块 import 边，看不见函数级重复 | 第一行删掉；第二行换成那个门真的会红的内容（"没人到达的模块要么接线要么删除"）。**这条是审计我的人发现的，记在这里因为它说明：规则表本身需要人再读一遍，门只能当底线** |
| **E3** | **`npm test` 全量跑红一条，且不是本任务引入；原因有两个，我最初只量到第一个** | `tests/pi-adapter.test.ts:253` 的项目上下文索引预算：第一次实测 **20019 > 20000**，把 `tests/task-cli.test.ts` 排除后同一套全绿 → 当时判断为"该文件在仓库自己的 `.trellis/tasks/` 下建三个 `helper-*-<pid>` 目录、与正在索引那个目录的 `pi-adapter.test.ts` 形成竞态，索引只差约 19 个字符到顶"。**晚些时候再跑同一套，实测 21849 > 20000** —— 那时本会话与另一个会话一共新增了四个任务目录，所以第二个原因是**语料本身已经越过这个绝对阈值**：索引按设计随任务数增长，`20000` 这个数不再表达"索引而不是原始倾倒"这句话 | **未修**（不在本任务范围；抬高预算就是掩盖）。E3 的初判已在此更正：竞态是真的，但它不是唯一原因，也不足以解释 21849。后续候选：要么让索引自身有界（截断并说明省略了什么），要么把这条断言从"绝对字符数"换成与语料同尺度的性质（索引远小于它所索引的内容）。失败信息已改成带长度，诊断需要它 |
| **E4** | **一次编辑 `extension.ts` 就要修一次挂载点引文** | S2 之后 18/18 条引文错位、S4a 之后 16/18、S4c 之后 5 条 `action-policy.ts` 引文错位 —— 每次都由 `tests/spec-anchors.test.ts` 抓到 | 修了三次（用脚本按声明查行号，不按算术）；记在这里作为设计候选：挂载点表或许该引符号而不是行号，否则最大那个文件每改一次都要付这笔税 |

---

## 附：本轮证据在哪

| 文件 | 内容 |
|---|---|
| `research/pstack-upstream.md`（388 行） | pstack 上游：原语/前端契约、10 个阶段的工件与门、5 个脚本的强制清单（含退出码）、上下文纪律与全部数字、验证的定义与"什么不算证明"、24 条原则逐条分类、Cursor 专有依赖表、7 项不确定 |
| `research/pstack-pi-adapter.md`（262 行） | `pstack-claude` 的 Pi 适配层：13 个文件逐个、宿主 API 面、子 agent 的 rpc/settled/截断/后台/孤儿回收、`paths:` 触发、作者记录的 10 条 Pi 缺口、Windows 移植风险 |
| `research/pstack-pi-tests.md` | 一套 skill 生成给 N 个 harness 的机制（替换表、生成物 vs 手写物的边界、每个测试禁止什么、单 harness 该保留哪些）+ 他们的 Pi 测试台（fake host、假子进程 step 脚本、hermetic 做法、live 门控、Windows 专用用例、8 条可抄模式与 Bun→node 移植代价） |
| `research/dove-pi-current.md`（353 行） | 本仓 46 行机制清单（强制/仅规范/死）、一轮 turn 的真实调用链、26 条缺陷（六类，逐条带引文与确认命令）、上下文与 token 的实际数字、验证映射与未验证清单、改动风险与耦合 |
