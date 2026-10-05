# pstack-claude：一套 skill 如何生成给 N 个 harness，以及它的 Pi 测试台

对象：`michael-denyer/pstack-claude`（snapshot 2026-10-04，`VERSION` = `0.9.67`，`package.json:4`）。锚点一律相对该 checkout 根，形如 `tools/generate.mjs:317`。本文件只读；未运行任何 build/test，未提交，"某测试会通过/会失败"都是**读来的判断**。

`unverified` 边界（先说清我省略了什么）：

- `tests/sync.test.mjs`（1338 行）、`tests/generate.test.mjs`（929 行）、`tests/pi/live.test.mjs`（460 行）我**没有逐行通读**：读了文件头、`describe/test` 名单、以及下面引到的代表性用例。
- `tests/pi/*.test.mjs` 我只读了每份的头部注释、用例名单，以及 `agents-launch` / `agents-run` / `agents-session` / `sleep-wait` 的少数用例正文；`interaction` / `child` / `config` / `catalog` / `prompt` / `worktree` / `path-skills` 只读了头部与名单（`catalog`、`path-skills` 除外，读了正文）。
- 我**没有**读产品侧 `plugins/pstack/pi/*.ts`（不在本次范围内）。因此"extension 如何实现"我都从 `tests/pi/harness.mjs:11` 的 `install(...)` 引用与测试断言反推，不自称读过实现。
- 目录里还有本次范围外的 `tools/typecheck-pi.mjs`、`tests/pi-equivalence.test.mjs`、`tests/session-hook-sheets.mjs`、`tests/agent-skills.test.mjs` 等，未读，不在结论中。

---

## Part A — 一套 skill 集合如何生成给 N 个 harness

### A.1 关键事实：这里其实有**两层**机器，只有一层和 N 有关

**第一层不是 per-harness 的。** `tools/substitutions.json` 的 65 条规则（9 条带 `files` 作用域、10 条用 `regex`）全部是 **Cursor → Claude Code** 的单向改写，作用对象是**上游 Cursor plugin 的原文**，与"跑在 Codex 还是 Pi 上"无关。证据：该文件里 `Pi` / `pi-` 零命中（`Select-String -Path tools/substitutions.json -Pattern '\bPi\b|pi-'` 无输出），而规则文本全是 Cursor 术语（`tools/substitutions.json:372` `"token": ".cursor/",`，hint 为 `"Cursor config path survived; map it to the Claude Code equivalent"`）。它由 `tools/sync.mjs:320`（`portForm`）在**同步期**施加，不在生成期（`tools/sync.mjs:322` `const sub = applySubstitutions(raw.toString("utf8"), rules, rel);`）。

**第二层才是 per-harness 的**：`tools/runtimes.mjs:19` 的 `export const RUNTIMES = [` 表——两行，Codex 与 Pi（`tools/runtimes.mjs:11-12` "Every runtime other than Claude Code that reads the skills through a mapping file"）。Claude Code 是基座，不在这张表里。

因此"给 N 个 harness 生成"在本仓库的实际体量比标题小得多：**共享的 skill 正文只有一份，per-runtime 的产物只有三类**——一个 mapping 文件里的 `## Model names` 区、一个（只给 Codex 的）preamble 行、一个（只给 Codex 的）slash 命令 stub。Pi 这一行自己写明不参与后两项（`tools/runtimes.mjs:17` "has neither: its one pointer is hand-written in poteto-mode's Platform Adaptation"）。

### A.2 表 A1：机械替换（before → after，全部 harness 共享）

| before（Cursor 上游原文） | after（port 文本） | 锚点 |
|---|---|---|
| `AskQuestion` | `AskUserQuestion` | `tools/substitutions.json:175-177` |
| `` `Task` `` | `` `Agent` `` | `tools/substitutions.json:185-187`（rationale: "same tool, backticked; covers `Task` call, `Task` prompts, and the `Task` response body"） |
| `the Task tool` | ``the `Agent` tool`` | `tools/substitutions.json:180-182` |
| `subagent_type: generalPurpose` | `subagent_type: "general-purpose"` | `tools/substitutions.json:277-280` |
| `.cursor/skills/` | `.claude/skills/` | `tools/substitutions.json:248-250`（rationale: "personal skills directory"） |
| `.cursor/rules/` | `CLAUDE.md imports` | `tools/substitutions.json:253-255` |
| `create-skill` | `plugin-dev:skill-development` | `tools/substitutions.json:298-300` |
| `~/.cursor/rules/pstack-models.mdc` | `pstack-models.md` | `tools/substitutions.json:170-172`（rationale 明说顺序依赖："must precede the generic .cursor/rules/ rule or that rule mangles the path"） |
| `Cursor's built-in babysit skill` | `the bundled **babysit** skill` | `tools/substitutions.json:313-315` |
| `restart Cursor` | `restart Claude Code` | `tools/substitutions.json:200-202` |
| ``environment: "cloud"`` + `run_in_background: true` 整句 | 只留 `run_in_background: true`，"Claude Code subagents all run on this machine" | `tools/substitutions.json:120-122` |
| 正则：``\(default `(?:claude\|gpt\|grok\|gemini\|composer)-[^`]+`\)``，仅 `^skills/poteto-mode/playbooks/` | `(default in poteto-mode's Models section)` | `tools/substitutions.json:205-208`（rationale: "model defaults live in models.json and are stamped into Models sections, never hard-coded in prose"） |

配套的**反例清单**（denylist，23 条）：命中即整次同步失败并打印 file:line 与 hint。例：`tools/substitutions.json:340` `"token": "grok-",`；`:372` `"token": ".cursor/",`；`:404` `"token": "environment: \"cloud\"",`。扫描覆盖**写入的字节和原地保留的字节**（`tools/sync.mjs:373-374`），所以一个"上游没动、port 自己含 Cursor 味"的文件也会被抓。

两条让这套规则不会自我欺骗的不变量：

- 每条规则必须有 `rationale`（`tools/sync.mjs:85` `if (typeof rationale !== "string" || !rationale) fail("needs a rationale");`）——机械改写也被迫携带理由。
- 规则按序应用，**后一条的 pattern 含前一条的 pattern 就要报错**（`tools/sync.mjs:101` 的 `findIndex`，`:104` 的 `substitutions[${j}] "${later.pattern}" contains substitutions[${earlier}] ...`），因为前一条会先把它吃掉。

### A.3 表 A2：真正的 per-harness 产物（Codex vs Pi）

| 维度 | Codex | Pi | 锚点 |
|---|---|---|---|
| mapping 文件 | `codex-tools.md` | `pi-tools.md` | `tools/runtimes.mjs:23`、`:29` |
| Model names 段（generator 拥有） | `codexModelNamesSection` | `piModelNamesSection` | `tools/runtimes.mjs:24`、`:29`；区定义 `tools/generate.mjs:360-365` |
| models.json 校验器 | `checkCodexModels` | `checkPiModels` | `tools/runtimes.mjs:41-49`、`:54-73` |
| 每个 skill 首标题下的 preamble | 有（`skillPreambles: true`） | 无 | `tools/runtimes.mjs:26`、`:29`；preamble 文本 `:35-36` |
| prompt stub 目录 | `plugins/pstack/.codex-plugin/prompts` | 无目录 | `tools/runtimes.mjs:27`、`:29` |
| manifest 校验 | `validateCodexMarketplace` | `validatePiPackage` | `tools/runtimes.mjs:115-131`、`:138-152` |
| 手写指针 | 无（靠 preamble + stub） | `pi-tools.md` 的其余全部章节 | `tools/runtimes.mjs:17` |

**Pi 侧的 before/after 具体例子**（表 A3，模型别名解析）：skill 正文里写的是 Claude 别名，Pi 上由 `agent` 工具的 `model` 传别名，extension 按 session 当前 provider 所在列解析，其他 provider 落到 `fallback` 列。

| alias（skill 正文里的写法） | `anthropic` 列 | `openai` 列 | `openai-codex` 列 |
|---|---|---|---|
| `opus` | `anthropic/claude-opus-5-5` | `openai/gpt-6.1-sol` | `openai-codex/gpt-6.1-sol` |
| `fable` | `anthropic/claude-fable-5-1` | `openai/gpt-6-astra` | `openai-codex/gpt-6-astra` |
| `sonnet` | `anthropic/claude-sonnet-5-5` | `openai/gpt-6-sol` | `openai-codex/gpt-6-sol` |
| `haiku` | `anthropic/claude-haiku-4-5` | `openai/gpt-6-luna` | `openai-codex/gpt-6-luna` |

来源：`plugins/pstack/models.json` 的 `pi` 块（`"fallback": "anthropic"` + 三张 `models` 表）被渲染进 `plugins/pstack/skills/poteto-mode/references/pi-tools.md:52-58`（该表就是 `pi-tools.md` 里被 stamp 的那一段）。渲染器 `tools/runtimes.mjs:92-113`；它对 provider 的约束由 `checkPiModels` 强制：每个 `available` 别名都必须有 Pi 模型（`tools/runtimes.mjs:63`），每个值必须是 `provider/<id>` 且无空白（`:68` `!id.startsWith(\`${provider}/\`) || /\s/.test(id)`）。

`pi-tools.md` 共 87 行，只有 `## Model names`（`:48`）一个区是生成的；`## Tool actions`（`:5`）、`## Subagent policy`（`:31`）、`## Session routing`（`:65`）、`## Driver and bundled skills`（`:71`）、`## Per-skill notes`（`:83`）、`## Vendored scripts`（`:107`）、`## Instructions file`（`:111`）全是手写。

### A.4 什么被生成、什么手工维护，以及边界如何被强制

**生成物**（`tools/generate.mjs:730` `plan()` 计算出的全部路径，`:788` 返回 `{ files, ownedDirs }`）：

| 源（手工维护的真相） | 生成物 | 锚点 |
|---|---|---|
| `VERSION` | 4 个 manifest 里唯一的 `"version"` 字段 | `tools/generate.mjs:8`、`:65-70`、`:98-104`、`:749` |
| `CHANGES.md` 必须有一个 `## <version> - <title>` | （不是生成，是校验） | `tools/generate.mjs:9`、`:109-117`、`:734` |
| skill 的 frontmatter `name`+`description` | 共享的 Agent Skills 契约（name 必须等于目录名） | `tools/generate.mjs:10-11`、`:130-163`（`:137` `if (name !== entry) throw ...`） |
| `docs/reference.md` 的 slash 命令表 | 每个 public skill 一个 Codex prompt stub | `tools/generate.mjs:12-17`、`:214-215`、`:224-252`、`:759-764`；stub 文本 `:258-267` |
| `plugins/pstack/models.json` | 各 skill 的 `## Models`、`## Reasoning effort`、interrogate 的 reviewer 表、setup-pstack 的 Models 与 override sheet、每个 runtime 的 `## Model names`、每档一个 effort agent 对 | `tools/generate.mjs:18-24`、`:317-367`、`:448-511`、`:559-614` |
| 每个 runtime mapping 文件的 Per-skill notes 表 | Codex preamble 行（只给有 preamble 的 runtime） | `tools/generate.mjs:25-27`、`:375-401`、`:390-401` |
| `DRIVER_PLAYBOOKS` 常量 | 五个 playbook 下的 driver 行 | `tools/generate.mjs:28`、`:370-372`、`:399` |
| `agents/*.md` + `effort-agents/*.md` | `plugins/pstack/.claude-plugin/plugin.json` 的 `agents` 列表 | `tools/generate.mjs:29-31`、`:616-628`、`:644-646`、`:767-772` |
| `agents/comment-sicko.md`、`LICENSE`、`LICENSE-cursor-team-kit`、`NOTICE-skills.md` | skills 树内的 portable 副本 | `tools/generate.mjs:32-34`、`:72-83`、`:778-787` |

**generated 与 hand-written 的边界是被强制而不是约定的**：`OWNED_DIRS`（`tools/generate.mjs:87-92`）里的目录，凡不在计划中的条目一律删除（`:85-86` "The generator removes every entry of these directories that no planned path runs through, so no hand-written file may live in one."；实现 `:811-817`，`:815` `if (!planned.some(...)) pending.push({ kind: "remove", path });`）。OWNED_DIRS 包含 Codex 的 prompts 目录（`...PROMPT_RUNTIMES.map((runtime) => runtime.prompts)`，`:88`）、`effort-agents`、`poteto-mode/references/agents`、`poteto-mode/references/licenses`。

`plan()` 是**纯函数**：不写盘，且重复调用结果相同（`tools/generate.mjs:740-788`；测试 `tests/generate.test.mjs:645-656` 断言 `expect(plan(root)).toEqual(first);` 与 `expect(snapshot(root)).toEqual(before);`）。`changes()`（`:803`）比对文件字节与 owned dir 的孤儿，`apply()`（`:821`）才写。

### A.5 每个测试禁止什么

| 文件 | 禁止的事（每条都给出让检查变红的原文） |
|---|---|
| `tests/invariants.test.mjs` | 头注释即立场：`:1-4` "A check that quietly matches nothing looks identical to a pass, and that already happened once (the 0.9.10 quad check hunted a retired slug for a whole release), so every check gets a fixture that must trip it." 具体禁止：`plugins/pstack/commands/` 存在（`:49-52`）；skill frontmatter 带 `disable-model-invocation: true`（`:54-57`）；`principle-*` 叶子缺 `user-invocable: false`（`:59-62`）；skill 用裸名派遣插件 agent（`:69-77`，期望 `'skills/caller/SKILL.md:6: subagent_type: "poteto-agent" (use "pstack:poteto-agent")'`）；任何 plugin 文件里残留未解决的三方合并冲突标记（`:87-98`，逐行点名） |
| `tests/sync.test.mjs` | 规则缺 `rationale`、字段拼错、同时给 pattern 与 regex（`:235-247`）；一条规则改写了另一条规则的输出（`:124-130`）；任何规则的 replacement 自身命中 denylist（`:118-122`）；未在 `forks.json` 声明的 fork 会**阻断所有写入**（`:594-611`）；`forks.json` 里指向已不再 fork 的路径算 stale 并 warning（`:625-662`）；二进制三方冲突阻止全部写入；符号链接永不被跟随、不被写穿；dry-run 与真实运行必须给出同一计划（`:768-818`）；denylist 命中时 pin 与树都不动（`:1273`） |
| `tests/generate.test.mjs` | 生成物过期（`--check` 退出 1 并逐个列出 `write:` / `remove:`，`:658-672`）；generator 拥有的文件丢了锚点（`:120-124`，`plugins/pstack/skills/how/SKILL.md: no anchor for the Models section to stamp`）；owned 区外的模型 slug（`:156-184`）；lead line 出现在不拥有它的文件里（`:851-864`）；owned 目录里的孤儿（`:688-706`）；planned 路径上是符号链接或目录（`:707-763`）；两个 producer 用不同文本写同一路径（`:837-853`，`${rel} is planned twice with different text`）；`pi` 包声明了不存在的路径 / 少了 `pi-package` keyword / 有 runtime dependencies（`:254-289` 对 `validatePiPackage`）；agent frontmatter 不是可读的严格 YAML（`:905`） |
| `tests/skill-rules.test.mjs` | port 自己加的规则被静默丢掉：17 条规则各自用"独特到能钉住规则"的原文短语钉在具体文件上（`:108-112` 的 `expect(readFileSync(...)).toContain(phrase)`），并断言短语互不相同、长度 ≥ 20（`:102-106`）。头注释 `:1-5` 说明理由：fork 文件走三方合并，"A rule dropped in either reads as a clean sync" |
| `tests/skill-references.test.mjs` | skill 正文里用 prose 互相引用（`the **how** skill`、`(**principle-x**)`、`` `/name` ``）而产生的悬空引用（`:34-42` 断言 `expect(dangling).toEqual([])`）；poteto-mode 的 Principles 索引必须**恰好**等于实际 `principle-*` 目录集合（`:44-48`） |
| `tests/readme-facts.test.mjs` | 文档里的计数与 pin 漂移：`N skill directories|Agent Skills`、public workflows / prompt stubs、`` N `principle-*` ``、`synced against upstream \`<sha>\`` 逐条与树比对（`:25-51`）。头注释 `:1-3`："Documentation states counts and the upstream pin in prose. Each is derivable from the tree, so this pins every occurrence to its source" |
| `tools/validate-skills.mjs`（由 `generate.mjs:895-896` 调用） | markdown 链接必须是 skills 树内的真实文件、且不通过符号链接逃出树（`:94-125`）；`prosePathProblems` 进一步禁止**正文里 backtick 包住的相对路径**指向"插件里有、但 skills-only 安装里没有"的文件（`:61-92`，`:77` 打印 `(X is not installed with the skills tree)`） |

### A.6 单 harness（我们这种 Pi-only 扩展）该保留哪些

**值得保留**（与 harness 数量无关，成本随项目规模线性）：

- `tests/invariants.test.mjs` 的立场本身：每个静态检查配一个必须让它红的 fixture（`:1-4` + 每 case）。这是全套里最便宜、最高收益的一条。
- idempotent generator + CI 里的 `--check`（`tools/generate.mjs:4-5` "CI contract: `bun tools/generate.mjs --check` writes nothing and fails when a committed copy is stale, so it cannot ship."；`tests/generate.test.mjs:641-643` 的 `expect(changes(repoRoot, plan(repoRoot))).toEqual([])`）。
- owned 目录与孤儿清理（`tools/generate.mjs:85-92`、`:811-817`）：把"生成物"和"手写物"的边界变成可执行的，而不是注释里的。
- plan / changes / apply 三层分离（`:730`、`:803`、`:821`）+ "working tree == plan" 的断言。任何有生成物的项目都该有。
- 写入前的符号链接与"planned 路径上是目录"拒绝（`:791-801`、`:807`）。
- 每个 agent/skill 的 frontmatter 必须能被严格 YAML 读回（`tools/generate.mjs:632-642`；理由在 `:630-631`："Claude Code's loader tolerates frontmatter that strict YAML rejects, so an agent file can load locally and still be unreadable to another parser."——换任何一个宿主都成立）。
- hooks 里每个 `${CLAUDE_PLUGIN_ROOT}/<path>` 必须存在、直接被执行的那个必须可执行（`:702-724`，`:717`），以及 Windows override 路径不要求可执行位（测试 `tests/generate.test.mjs:321-333`）。这类"声明了但不解析的路径"正是我们仓库反复中招的那一类。
- skill 之间的 prose 引用必须解析 + 索引集合必须完整（`tests/skill-references.test.mjs`）。
- 文档里的计数由树推导（`tests/readme-facts.test.mjs`）。
- port 自加的规则按"独特短语 + issue 号"钉住（`tests/skill-rules.test.mjs`）。

**只在多 harness 下才回本**（照原样搬过来会得到一层只有一行的循环）：

1. `RUNTIMES` 注册表本身，以及"每个 runtime 一个 `checkModels`"的接口（`tools/runtimes.mjs:19-38`、`:54-73`；`tools/generate.mjs:461-463` 的 `for (const key of ["tiers", ...RUNTIMES.map((runtime) => runtime.key)])`）。单 harness 时它退化成"校验我自己那张表"。
2. "每个 runtime 的 mapping 文件都必须有一个 generator 拥有的 Model names 区"（`tools/generate.mjs:360-365`；`tests/generate.test.mjs:138-142`）。这条不变量存在的理由是让 N 个 mapping 文件与 `models.json` 保持同步；只有一个文件时没有东西可以不同步。
3. per-runtime preamble + prompt stub 与 `noteSkills` / `LEAD_LINES` 机器：**Pi 这行自己就不用它**（`tools/runtimes.mjs:29` 既无 `skillPreambles` 也无 `prompts`，`:17` 说明 Pi 只有一句手写指针），所以 `tools/generate.mjs:258-267`（prompt stub）、`:372`（`LEAD_LINES`）、`:375-401`（`noteSkills`）全部是"第二个 harness 的入口"成本。`validateCodexMarketplace`（`tools/runtimes.mjs:115-131`）同理：单 harness 只留 `validatePiPackage`。

**第三类，别误归因**：`tools/substitutions.json` + denylist + `tools/forks.json`（45 条 `pstack` + 1 条 `cursor-team-kit`）+ `tools/sync.mjs` 这套三方合并机器（`sync.mjs:261` `classify`、`:286` `FORK_OUTCOMES`、`:294` `syncComponent`、`:529` 只在成功时推进 pin）**不是**"多 harness"的成本，而是"**从另一个 harness 的仓库继承文本**"的成本。它回本的条件是"我们 vendored 了一批用别人的术语写的文件"；Pi-only 且文本自己写的项目不需要它。反过来，如果哪天我们把 pstack 的 skill 搬进来，`forks.json` 的 `upstream` 字段要求（`tools/sync.mjs:139-140`：必须是 `not-proposed` 或一个 GitHub PR/issue 链接）就是最该抄的那一条——它逼每个 fork 说明"为什么不回上游"。

---

## Part B — 他们的 Pi 测试台

### B.1 什么替代了真模型

两层替身，都**不产生任何模型调用**：

1. **fake ExtensionAPI / ExtensionContext**（`tests/pi/harness.mjs:38-74` 的 `fakePi()`、`:76-87` 的 `fakeCtx()`）：被测的是产品真的 extension——`tests/pi/harness.mjs:11` `import { install } from "../../plugins/pstack/pi/index.ts";`，`:165` `install(pi.api, { ...w.settings, ...settings });`。fake API 把 extension 的注册与发送**记下来**：`registerTool` / `registerCommand` / `on` / `sendMessage` / `sendUserMessage` / `getThinkingLevel` / `appendEntry`（`:45-57`）。
2. **fake `pi --mode rpc` 子进程**（`tests/pi/fake-pi.mjs`）：extension 启动的每个 subagent 都是这个 Node 脚本（`harness.mjs:15` `const fakePiBin = fileURLToPath(new URL("./fake-pi.mjs", import.meta.url));`，注入方式 `:107` `pi: { command: fakePiBin, args: [] }`）。它 `:4-6` 自述："logs its invocation, each reply, steer, and settle to `PSTACK_FAKE_PI_LOG`, so a test can wait for the moment it needs, reads JSON commands from stdin as real pi does, and plays the steps `PSTACK_FAKE_PI_SCRIPT` names for the prompt it is given"。

模型本身由 `PSTACK_FAKE_PI_SCRIPT` 的 `{"default": [steps], "byPrompt": {"<prompt>": [steps]}}`（`fake-pi.mjs:6`）替身：`{ reply }` 发一条 assistant `message_end`，`{ error }` 发失败消息，`{ raw }` 原样写 stdout，`{ sleep: ms }`、`{ exit: code }`、`{ stderr }`、`{ touch: "<file>" }`、`{ spawn: "<kind>" }`、`{ mute: true }`、`{ holdSettle: ms }`、`{ awaitMessage: ms }`、`{ askUser: true }` 等（`:8-29`，白名单 `:65-68`）。`${prompt}` / `${history}` / `${steered}` 三个占位符在 `:164-165` 展开，`history` 来自 `--session-dir` 下按 `--session-id` 命名的 `.fake.jsonl`（`:55-61`）——即**跨进程的假会话历史**，让 resume 类用例有真东西可读。

### B.2 fake host 具体控制什么、断言什么

控制面（`harness.mjs:90-117` 的 `world()`）：

- 一个临时世界：`agentDir`、fixture `models.json`（`:17-36`，全部用 `fixture-opus` 一类假 ID）、`script.json`、`fake-pi.log`、`cwd`。
- extension 的设置对象：`pluginRoot` / `modelsFile` / `agentDir` / `pi.command = fakePiBin` / `depth` / `killGraceMs: 300` / `exitGraceMs: 1500`（`:103-117`）。
- 子进程环境**只有四个变量**：`PATH`、`HOME`（指向临时根）以及 `PSTACK_FAKE_PI_SCRIPT`、`PSTACK_FAKE_PI_LOG`（`:108-113`）。这就是沙箱本身。
- 观测口：`log()` / `logged(kind)` / `until(kind, n)` / `invocations()`（`:123-132`）。
- 清理：`cleanup()`（`:142-153`）杀 `strays ∪ pids ∪ log 里每个 pid`，**对 `-pid` 与 `pid` 都发 SIGKILL**（`:146-148`，注释 `:144` 说明零或负数会打到自己这一组），然后删临时根；由 `useWorld()` 在 `afterEach` 注册（`:158-168`），并额外把 extension 记录过的 `pid` 传进来（`:161` `w?.cleanup(pi.entries.map((e) => e.data?.pid))`）。

断言面（举代表性三例）：

- **精确 argv**：`tests/pi/agents-run.test.mjs:22-29` 断言 `inv.argv` 恰为 `["--mode","rpc","--session-id",…,"--session-dir", join(w.agentDir,"pstack","parent-session","agents"),"--model","anthropic/parent-model","--thinking","medium","--pstack-depth","1"]`，并 `:31` 断言 session id 匹配 `/^[0-9a-f-]{36}$/`、`:32` `expect(inv.cwd).toBe(w.cwd);`。`--append-system-prompt` 指向的文件内容被 fake-pi 读出来记进 `invocation.systemPrompt`（`fake-pi.mjs:160`），于是"子 agent 拿到的 system prompt 是哪个 agent 文件"可被断言（`agents-launch.test.mjs:55-66`）。
- **时序而非睡眠**：`harness.mjs:208-214` 的 `waitFor(predicate, timeoutMs = 5000)` 每 20 ms 轮询日志；`agents-run.test.mjs:56-65` 用 `await waitFor(() => pi.messages.length === 1)`，并在 `sendMessage` 被调用的瞬间采一次 `alive(pid)` 来证明"通知到来时进程已死"。
- **注册面**：`tests/pi/agents-launch.test.mjs:18-29` 把 `[...pi.tools.values()]` 的 name→exposure 全量比对为 6 个 `"model-only"`；工具参数 schema 也被断言（`:38` `expect(pi.tools.get("agent").parameters.properties.readonly.type).toBe("boolean")`）。

另外两类"fake pi 造不出"的边界由别的替身覆盖：`tests/pi/child.test.mjs:1-2` 自述 "PiChild against small scripted children, for stream edge cases the fake pi cannot produce"（分块到达的多字节字符、只答 settle 不答 steer 等）；`tests/pi/host.mjs:1-3` 在**独立进程**里跑一个 print-mode 父会话，好让 `process.exit` 与 SIGINT 这两种"宿主被粗暴结束"的路径可测（`:13-20`；使用方 `agents-session.test.mjs:153-166` 对 `["exit","SIGINT"]` 各跑一遍）。

### B.3 套件如何保持 hermetic

- **无网络**：`tests/pi/*.mjs` 里没有 `fetch(`、没有 `http(s)://`、没有 SDK 客户端（`Select-String` 只命中 `pi.api.sendMessage` 这类标识符）。所有"模型输出"都来自 `fake-pi.mjs` 的 step 脚本。
- **无真凭据**：凭据只出现在 live 套件里，且是 symlink 而非拷贝——`tests/pi/live.test.mjs:67` `symlinkSync(join(homedir(), ".pi", "agent", "auth.json"), join(agentDir, "auth.json"));`。
- **隔离的环境**：子进程只有四个环境变量（`harness.mjs:108-113`）；`HOME` 指向临时根，于是任何"往用户目录写东西"的代码要么落到临时根、要么根本找不到路径。
- **真 git，但只在临时目录**：`harness.mjs:193-206` 的 `gitRepo(dir)` 在传进来的目录里 `git init -q -b main` 并提交一个 `README`；worktree 用例靠它拿真实 git 状态（`tests/pi/worktree.test.mjs:1-2` "settleWorktree against real git state"）。
- **真 skill 文件**：`harness.mjs:14` 的 `pluginRoot` 指向真实 `plugins/pstack/`，`agentBody(rel)`（`:188`）从真实 agent 文件里剥 frontmatter，用来断言子进程拿到的 system prompt。
- **失败不留孤儿**：`cleanup()` 按进程组 SIGKILL（`:142-153`）；`host.mjs` 那条路径也一样。`tests/pi/agents-session.test.mjs:163` 甚至断言 `await waitFor(() => w.log().every((r) => !alive(r.pid)));`——把"父进程被 exit/SIGINT 结束，其 agent 也必须消失"变成可观测事实。

### B.4 "live" 套件如何被门控

三处，全部**默认关闭、CI 显式打开**：

1. 实时 Pi 套件：`tests/pi/live.test.mjs:21` `const LIVE = process.env.PSTACK_PI_LIVE === "1";`，`:57` `const suite = LIVE ? describe : describe.skip;`。CI 的 `bun test tests/` 因此把它跳过；人手动跑 `PSTACK_PI_LIVE=1 bun test tests/pi/live.test.mjs`（`CONTRIBUTING.md:65` 说约五分钟）。运行时 `:60-79` 建一次性 `PI_CODING_AGENT_DIR`、把凭据 symlink 进去、`pi install` 本仓库、把 `compaction.keepRecentTokens` 设为 0（`:75`，为的是两轮就能触发压缩），`:91` 用 `PSTACK_PI_LIVE_KEEP=1` 决定是否保留目录；`:81-92` 在收尾时统计 session 文件里真实发生的模型调用数并打印。它测的是真东西：`:94-134` 那条用例要求三个后台 agent 各自在自己的解析模型上完成（`expect(last).toMatchObject({ status: "completed", agent: { model: MODELS.get(alias) } })`）。
2. 模型目录套件：`tests/pi/catalog.test.mjs:48` `const required = process.env.PSTACK_PI_REQUIRE_CATALOG === "1";`，`:51` `test.skipIf(!dir && !required)(...)`——本机找不到已安装 Pi 的 catalog 时跳过，但 CI 的 `Pi extension types` job 设了它，于是"目录搬了"会在 CI 红而不是悄悄跳过（`:46-47` 注释原文："CI's pi-types job installs Pi and sets this, so a catalog that moved fails there instead of skipping."）。
3. Windows hook 套件：`tests/session-hook-windows.test.mjs:61-63`，`const required = process.env.PSTACK_REQUIRE_WINDOWS_HOOK === "1";` 配 `describe.skipIf(process.platform !== "win32" && !required)`；CI 的 Windows job 设它并单独跑这一个文件。

这三条共享同一个形态：**"本机没有前提条件就跳过，但 CI 用环境变量把跳过变成失败"**。

### B.5 Windows 专用测试做什么

`tests/session-hook-windows.test.mjs` 不测任何模块，它**执行 shipped 的 `commandWindows`**：

- `:12` 从 manifest 指向的 hooks 文件里取出 `hooks.SessionStart[0].hooks[0]`，`:31` `const command = handler.commandWindows.replaceAll("${CLAUDE_PLUGIN_ROOT}", plugin);`。
- `:18-20` fixture 故意造出**带空格的路径**：`const plugin = join(fixture, "plugin with spaces");`、`const profile = join(fixture, "user profile");`、`const sheetRoot = codexHome ? join(fixture, "codex home") : join(profile, ".codex");`。
- `:45-51` **两种宿主各跑一次**：`cmd.exe`（`["/d","/s","/c",command]` + `windowsVerbatimArguments: true`）与 `powershell.exe`（`["-NoProfile","-EncodedCommand", base64(utf16le)]`）。
- `:32-44` 环境是**最小集**：`SystemRoot`、只含 PowerShell 目录的 `PATH`、`PATHEXT`、`USERPROFILE`、一个与 profile **不同**的 `HOME`（`join(fixture, "other home")`，用来证明读的是 `USERPROFILE` 而不是 `HOME`）、`CLAUDE_PLUGIN_ROOT`，并把 `PSExecutionPolicyPreference` 钉成 `"Restricted"`（`:39`）。
- 语义断言（不是"退出码为 0"了事）：`:65-67` 两种宿主的 stdout 都**逐字节等于** mandate（PowerShell 侧只把 CRLF 归一化后比对）；`:70-83` `CODEX_HOME` 为空/缺失时回落 `USERPROFILE`、非空时 `CODEX_HOME` 优先；`:85-89` 覆盖 model sheet 的每一种写法；`:91-94` 断言 UTF-8（`"Routing context: 中文 café 🚀"`）且**不加多余换行**；`:96-101` 上下文读不到时必须非 0 退出、stdout 为空、stderr 非空。

### B.6 应复制进我们 `tests/pi-adapter.test.ts` 的模式

我们的现状（用作对比，非本次范围的审计）：`tests/pi-adapter.test.ts` 每个用例**内联**构造假的 API 与 context，例如 `:94-105` 的 `const api = { registerCommand() {}, …, on(name, handler) { events.set(name, handler); } } as unknown as ExtensionAPI;` 与 `:107-113` 的 `FakeContext`。这属于"每个测试自己发明一次宿主"。下面 8 条按收益排序：

1. **一个共享的 fake host 模块**，取代逐用例内联（`tests/pi/harness.mjs:38-74`）。收益：注册面、消息面、事件面只有一处定义，改宿主形状时改一个文件。
2. **对称的 `emit` / `call` 两个入口**（`harness.mjs:65-72`：`emit` 按 `{ type: event, ...payload }` 派发给 handler，`call` 走 `tools.get(name).execute(...)`）。收益：能测"handler 路径上的行为"，而不只是导出的纯函数——我们的 `extension.ts` 是唯一真实入口，这一点尤其重要。
3. **临时世界工厂 + 注册一次的 cleanup，按进程组杀**（`harness.mjs:90-117`、`:142-153`、`:158-168`）。收益：中途失败的用例不留孤儿进程；`HOME` 指向临时根本身就是最强的隔离手段。
4. **声明式 step 脚本的 fake 子进程，未知 step 直接 `process.exit(64)`**（`fake-pi.mjs:6`、`:84-91`，期望文本 `unknown step key "${unknown}"`）。收益：拼错一个 step 名不会"安静地通过成它声称的行为"。
5. **断言完整 argv**，而不是"调用过 agent"（`tests/pi/agents-run.test.mjs:22-29`）。收益：`--exclude-tools`、`--thinking`、`--pstack-depth`、model 解析这些规格全都在 argv 上，一次 `toEqual` 就能全钉住。
6. **把"假会话历史"落成文件**（`fake-pi.mjs:55-61`），让 resume/steer 类用例有可读的真状态，而不是靠 mock 返回值。
7. **分类器用表驱动，并把已知缺陷明确分组**（`tests/pi/sleep-wait.test.mjs:27-31` 的 `knownMisses` / `knownOverBlocks`，配 `:41-47` 两条"分组移动就是一次决策"的断言）。我们仓库有一堆同类谓词（`isReadOnlyShellCommand`、`technique-syntax` 的语法见证、`normalizeLsToolInput`），用这种"正面/反面/已知漏/已知过度拦截"四分法比逐个 `assert.equal` 更能锁住意图；再配一条大输入的性能上界（`:49-69`，200 KB 命令行 < 250 ms）也算上。
8. **live 套件一行门控 + 一次性 HOME，凭据只 symlink**（`tests/pi/live.test.mjs:21`、`:57`、`:60-79`、`:91`）。我们已经有 `tests/real-dove-blackbox.test.ts` 这个形态的证据采集（未在本次范围内打开），要抄的是这几行：门控常量、`describe`/`describe.skip` 二选一、收尾打印真实调用数、`KEEP=1` 保留目录。
   （备选第 9：shipped 命令在 `cmd.exe` 与 `powershell.exe` 各跑一次、fixture 路径带空格、环境最小化、PS 执行策略钉死 —— `tests/session-hook-windows.test.mjs:15-57`。我们有 `tests/windows-runtime.test.ts`，但"两种宿主 + 空格路径 + 最小环境"这个组合值得照抄。）

**移植代价（必须先算）**：`tests/pi/harness.mjs:4` 是 `import { afterEach } from "bun:test";`，而 `tools/generate.mjs:124` 用的是 `Bun.YAML.parse`——**生成器与这套测试台都是 Bun-only**。我们的运行器是 `node --import tsx --test tests/**/*.test.ts`，因此 ①`afterEach` 换成 `node:test` 的同名导出；②`bun:test` 的 `describe.skipIf` / `test.skipIf` 在 `node:test` 里没有，live 门控要写成 `describe(name, { skip: !LIVE }, fn)` 或 `describe.skip`；③`jest`（`tests/pi/interaction.test.mjs:3` 用到 `jest`）需要替换。逻辑本身没有 Bun 依赖，只有进口。

---

## 一句话结论

他们真正的"多 harness"机制只有一张两行的 `RUNTIMES` 表加三个 for 循环；体量最大的那套（65 条替换、23 条 denylist、45 条 fork 声明、三方合并）解决的是**"文本从别的 harness 的仓库继承"**，不是"生成给 N 个 harness"。而最值得抄的、与 harness 数量无关的东西，一是 `invariants.test.mjs` 那条"每个检查都要有一个能让它红的 fixture"的纪律，二是 `tests/pi/harness.mjs` 这种"真 extension + 假宿主 + 假子进程 + 一次注册的进程组清理"的测试台。
