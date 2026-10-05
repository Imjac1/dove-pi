# Task artifact linter：设计输入（pstack `check-plan.mjs` 的对照移植）

本文是**设计输入**，不是设计定稿。它先量出把这类 linter 移植到本仓的代价（Part 1），再给出提案（Part 2），
结尾把"要不要强制"留成一个要问用户的问题（§2.7）。

**本文没做的事**（照实记）：没有写任何产品文件、没有跑 `npm test` / `npm run typecheck`、没有提交。
所有计数来自只读命令；每条计数都在 §1.1 与文末列了命令。凡我无法验证的，写成 `unverified` 并给出验证命令。

---

## 1. 测量

### 1.1 语料普查

命令（PowerShell，只读）：

```powershell
Get-ChildItem .trellis/tasks -Directory | Where-Object { $_.Name -ne 'archive' }   # 活跃任务
Get-ChildItem .trellis/tasks/archive -Directory                                     # 归档月份
Get-ChildItem .trellis/tasks -Recurse -File |
  Where-Object { $_.Name -in 'prd.md','design.md','implement.md','task.json' } |
  Group-Object Name | Select-Object Name,Count
```

结果（**281 个任务目录**）：

| 项 | 活跃 | 归档 | 合计 |
|---|---|---|---|
| 任务目录 | 26 | 255（2026-08: 16 / 2026-09: 226 / 2026-10: 13） | 281 |
| `prd.md` | 26 | 255 | **281** |
| `design.md` | 13 | 91 | **104** |
| `implement.md` | 13 | 243 | **256** |
| `task.json` | 26 | 254 | **280** |

`task.json` 比任务目录少 1：`archive/2026-09/09-28-movement-arm-fields` 没有 `task.json`（只有 `prd.md`）。
任何按状态分组的脚本必须先处理这 1 个（我的测量脚本里它是 `(no task.json)`）。

按 `task.json.status` 分组，以及每组内的工件数：

| status | 任务数 | `prd.md` | `design.md` | `implement.md` |
|---|---|---|---|---|
| `planning` | 18 | 18 | 5 | 5 |
| `in_progress` | 8 | 8 | 8 | 8 |
| `completed` | 254 | 254 | 90 | 242 |
| （无 `task.json`） | 1 | 1 | 1 | 1 |

**语言**：按 CJK 字符占比 > 0.15 判定，281 个 PRD 里 **38 个是中文撰写**（比例最高 0.478 / 0.459 / 0.455）。
这一点在 §2.3 里会否掉 pstack 的散文检查（它是英文单语语料上的规则）。

### 1.2 pstack 怎么测它的 linter

**先说一处对不上的地方。** 任务书给的是
`.trellis/.runtime/pstack-research/pstack-main/skills/poteto-mode/scripts/check-plan.mjs`，它确实 185 行：

```powershell
(Get-Content $a).Count          # 185
(Get-FileHash $a).Hash          # 4F9432D9...C80523
```

但**该 checkout 没有 `tests/` 目录**（`Test-Path .../pstack-main/tests` → `False`）。
`tests/check-plan.test.mjs` 在另一个 checkout：`pstack-claude-main/tests/check-plan.test.mjs`（106 行），
而它 spawn 的是**另一份** `check-plan.mjs`：`pstack-claude-main/plugins/pstack/skills/poteto-mode/scripts/check-plan.mjs`，
**203 行，sha256 `EC18E2104B1E2580AE8BB2F127F9F8F35A4A958A1F4107F8E66BC222D856A46D`，与 185 行那份不同**。
所以下面的 fixture 模式我读的是 203 行那份的测试；**"185 行那份的 fixture 长什么样"是 `unverified`**，
验证命令：`Get-ChildItem .trellis/.runtime/pstack-research -Recurse -Filter 'check-plan*'`。

他们的 fixture 模式（`tests/check-plan.test.mjs`）**不存坏文件**，而是从**出厂的骨架**上做字符串手术：

```js
// :12-15  骨架从 playbook 的围栏代码块里抽出来，不另存一份
const playbook = readFileSync(join(mode, "playbooks/multi-phase-plan.md"), "utf8");
const template = playbook.match(/^````markdown\n([\s\S]*?)^````$/m);
if (!template) throw new Error("Multi-phase playbook has no plan skeleton");
const skeleton = template[1];

// :17-29  每个用例写进一个 mkdtemp 临时目录，跑真脚本，回收 stdout+stderr
function run(plan) {
  const dir = mkdtempSync(join(tmpdir(), "pstack-check-plan-"));
  try {
    const file = join(dir, "plan.md");
    writeFileSync(file, plan);
    const result = spawnSync("node", [join(mode, "scripts/check-plan.mjs"), file], { encoding: "utf8" });
    return { code: result.status, out: result.stdout + result.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// :31-35  唯一的手术刀：在给定标题的区间内替换正文
function editSection(heading, edit) {
  const start = skeleton.indexOf(heading + "\n") + heading.length;
  const end = skeleton.indexOf("\n#", start);
  return skeleton.slice(0, start) + edit(skeleton.slice(start, end)) + skeleton.slice(end);
}
```

三条断言形状，值得原样抄：

1. **正向控制**：出厂骨架必须绿，且摘要行也要对（`:38-43`）——
   `expect(run(skeleton)).toEqual({ code: 0, out: expect.stringContaining("1 PR sections, 0 problems") })`。
2. **每个检查各有一个"必须变红"的输入，而且断言到具体消息**（`:56-61`）——
   `const plan = editSection(heading, (body) => body.replaceAll("- [ ] ", ""));`
   `expect(result.code).toBe(1); expect(result.out).toContain(`${heading.slice(4)} has no box`);`
3. **成对的双向用例**：同一段盒子放进围栏里就该绿，围栏外就该红（`:70-82`），
   以及九种围栏写法的红绿对照（`:85-105`）。

**他们的测试没有的东西**（这一点就是本仓机会所在）：没有任何机制保证"linter 的检查表"与"fixture 集合"一致。
新加一个检查而不加 fixture，测试全绿。§2.6 的 `--list-checks` 就是补这个洞，本仓已有先例
（`tests/fence-drift.test.ts:21-23`：`This test is the coupling. It fails in both directions`）。

### 1.3 我们的 PRD 实际长什么样

**二级标题的实测清单**（281 个 PRD，跳过围栏代码块；脚本见文末）：

- **distinct h2 = 373 个**；**0 个 PRD 没有 h2**。
- 前几名：`Goal` 275 · `Requirements` 249 · `Acceptance Criteria` 247 · `Out of scope` 168 ·
  `Out of Scope` 45 · `Background` 34 · `Acceptance criteria` 30 · `Notes` 29 · `Open Questions` 22 ·
  `Key Decisions` 8 · `Background: the measurement` 8 · `User Value` 6 · `Out Of Scope` 5。
- 单例标题极多，且长尾是"这一轮写的是什么"：`Background: a path is a claim about the filesystem`、
  `那 12 件真实工作从哪来（**全部实测，不发明** ✗）`（`.trellis/tasks/10-03-ten-million-token-project/prd.md:36`）、
  `First: there are no boxes, and the number was mine`（`archive/2026-09/09-29-the-boxes/prd.md:7`）。

**候选必需章节的实测覆盖**（大小写不敏感，`^<name>\b` 前缀匹配）：

| 候选章节 | 缺它的 PRD 数 | 按状态 |
|---|---|---|
| `Goal` | 3 | completed 3 |
| `Requirements` | 31 | completed 31 |
| `Acceptance Criteria` | 3 | completed 3 |
| `Out of scope` | **59** | planning 11 · completed 48 |
| 必需的四个里缺 ≥1 | 61 | planning 11 · completed 50 |
| 存在但正文为空 | **0** | — |

那 3 个连 `Goal` 都没有的里面，**1 个不是人写的**：`archive/2026-08/00-bootstrap-guidelines/prd.md:1`
`# Bootstrap Task: Fill Project Development Guidelines`，`:3` `**You (the AI) are running this task. The developer does not read this file.**`
——它是 `trellis init` 的引导文档，用它的四个 h2 去判"缺章节"是**假 finding**（§2.3 第 1 条）。

**抽样读过的 PRD（11 个，含中文撰写、英文撰写、归档、刚起步）**：

| # | 文件 | 状态 | 字节 | 它显示了什么 |
|---|---|---|---|---|
| 1 | `tasks/10-03-dead-enforceable-constant/prd.md` | planning | 692 | **刚起步**：`:9` `- TBD`、`:13` `- [ ] TBD`，而 `:5` 已经写了实测缺陷 |
| 2 | `tasks/10-03-blackbox-prompt-chars/prd.md` | planning | 654 | 同上形状（`:9`/`:13` 都是 TBD） |
| 3 | `tasks/10-03-ten-million-token-project/prd.md` | in_progress | 5186 | 中文撰写 · 六个 h2 里只有一个在"前四名"之外有别名：`:46` `## Out of Scope` |
| 4 | `archive/2026-10/10-02-architecture-drift/prd.md` | completed | 4282 | 中文撰写 · 归档 · `:45-46` 记录了"锚点门只开在 `.trellis/spec/**`"的既有裁决 |
| 5 | `archive/2026-09/09-28-archived-criteria/prd.md` | completed | 2137 | **同一个问题的前一次讨论**：`:23-24` 把"PRD 完全没有判据"列为一类缺陷 |
| 6 | `archive/2026-09/09-29-read-interop/prd.md` | completed | — | `:9-11` 点名"implement.md 十四项没有任何盒子，所以文件说不出什么做完了" |
| 7 | `archive/2026-09/09-29-read-adaptive/prd.md` | completed | — | `:9-11` 点名"二十三个盒子全打勾 + 报告 235 个测试而现在是 778" |
| 8 | `archive/2026-09/09-29-the-boxes/prd.md` | completed | — | `:10` `prd.md 7661 chars, checkbox lines: 0`——**PRD 一个盒子都没有** |
| 9 | `archive/2026-09/09-28-citation-sweep/prd.md` | completed | — | `:40-41` AC3 要求"检查必须在播下的坏输入上红，而且这个红要在拔掉种子之前被观察到" |
| 10 | `archive/2026-08/00-bootstrap-guidelines/prd.md` | completed | — | 工具生成的引导 PRD，四个 h2 全缺（假 finding 的来源） |
| 11 | `tasks/09-30-substrate-choice/prd.md` | planning | 25710 | 全仓最大的 PRD：25 KB、中文、正文大量 `file:line` 引用 |

**结论（供 §2.2 用）**：从语料里"推出来"的必需章节清单是 `Goal` / `Requirements` / `Acceptance Criteria` / `Out of scope`；
`Out of scope` 有 59 个缺，`Requirements` 有 31 个缺。**这个清单能推出来，但推不出来"缺了就该红"的理由**——
所以它在 §2.2 里只保住两条（见 §2.3 第 1 条）。

### 1.4 `task.py validate` 到底拒什么（新 linter 不许重复）

命令与原文：

```powershell
python ./.trellis/scripts/task.py validate --help
# usage: task.py validate [-h] dir
# positional arguments:
#   dir         Task directory
```

实现：`.trellis/scripts/task.py:9` `python task.py validate <dir>              # Validate jsonl files`，
真正的函数在 `.trellis/scripts/common/task_context.py:157` `def cmd_validate`，
它只遍历两个文件（`:187`）：`for jsonl_name in ["implement.jsonl", "check.jsonl"]:`

它**硬拒**（计入 `errors`，返回 1）：

| 行 | 拒什么 |
|---|---|
| `:310` | `: Invalid JSON` |
| `:316` | `Expected a JSON object` |
| `:321-328` | `_example` 占位行（老版本 `task.py create` 留下的脚手架） |
| `:342` | `` `file` must be a string path `` |
| `:352` / `:357` | 目录/文件不存在（`Directory not found` / `File not found`） |
| `:388-402` | **0 条 curated 条目** → `✗ (0 curated entries — sub-agents would get zero spec context)` 并 `return 1` |

它**只警告**（从不改退出码）：`:365` 代码文件扩展名、`:381` 超过 `context_injection.max_file_bytes`、
`:177-183` `task.json` 里记录的 branch 已不存在。

它**完全不读** `prd.md` / `design.md` / `implement.md`。我全仓搜过：`.trellis/scripts/**.py` 里 `prd.md`
只出现两次——`common/task_store.py:285` 与 `:287`（模板正文），以及 `:537-542`
（`if not prd_path.exists(): prd_path.write_text(_default_prd_content(...))`，**只在创建时写**）。
`.trellis/scripts` 下 `implement.md` / `design.md` 只有 `task_store.py:287` 与 `:654` 两处提示文本。
**没有任何代码路径读过这三个 markdown 的内容。**

`task.py archive`（`common/task_store.py:1223`）也只拒四种结构条件：没有任务名（`:1228`）、
解析不到 `.trellis/tasks/` 下的目录（`:1237`）、不在 tasks 目录下（`:1258`）、归档目标已存在（`:1270`）。
**归档不读任何工件正文。**

所以：**新 linter 的整个工作面（三个 markdown 的正文）今天零覆盖**，与 `validate` 无重叠。

### 1.5 已有的同类门，以及它们**主动放弃**的正是这块料

本仓已经有一整套"文档 vs 仓库"的门，新 linter 必须避开它们、并继承它们写下的边界：

| 门 | 覆盖 | 明确放弃的部分 |
|---|---|---|
| `tests/spec-anchors.test.ts` | `.trellis/spec/**` 的 `file:line` 能否解析、行是否存在 | `:124-126` `the default walk is the specification directory, because a citation in a task artifact is a note rather than the record of what exists` |
| `tests/document-drift.test.ts:447-473` | `src/`、`tests/` 的注释**禁止**写行号 | `:453-456` 两个具名豁免（`types.d.ts`、`scripts/mode-behaviour-map.mts`） |
| `tests/spec-freshness.test.ts` | 规格页里能被机械量出的计数 | `:24-26` `A number this cannot compute is not a row here` |
| `tests/record-freshness.test.ts` + `src/project-provider/record-freshness.ts` | **.dove 原生工件**（`acceptance.md` + `evidence.jsonl`）里打了勾却没有账本事件的判据 | 只覆盖 `.dove/tasks`，不覆盖 `.trellis/tasks`；产品接线在 `src/commands/task.ts:189` |
| `tests/spec-context-budget.test.ts:116-120` | 规范页的二级标题清单 | `:118` 只比标题数组，**章节被删空但标题保留会通过**（`dove-pi-current.md` 的 D18） |

`archive/2026-09/09-28-citation-sweep/prd.md:50` 更直接：`- **Citations in archived task artifacts**, which are history.`
——**归档任务里的引用按既有裁决是"历史"，不检查**。这条直接影响 §2.7 的三个选项。

---

## 2. 提案

### 2.1 范围

- **文件**：每个任务目录（`.trellis/tasks/<name>/` 与 `.trellis/tasks/archive/<month>/<name>/`）下的
  `prd.md`（必有两态）、`design.md`（可选）、`implement.md`（可选）。
- **状态**：默认只判 `planning` 与 `in_progress`（26 个）；`--all` 才把 255 个归档任务算进来（§2.7）。
  没有 `task.json` 的那 1 个目录在 `--all` 下按 `completed` 处理，并在摘要里单列——否则它会被任何
  "按状态过滤"的循环静默漏掉。
- **不做**：不改任何文件（只读）；不判"这句话是不是真的"（§2.3 第 8 条）；不读 `research/**`。
- **怎么被调用**：一段 `node scripts/task-artifact-lint.mjs` 的按需命令，**同时**在
  `tests/task-artifact-lint.test.ts` 里被断言（fixture 恒跑；语料是否恒绿由 §2.7 决定）。

### 2.2 检查清单（每条都由一次真实的做错换来）

四个检查，全部**只判机械可判的形状**。`id` 是稳定标识符，会出现在消息与 `--list-checks` 里。

**`TAL-001 ac-boxes`** — `prd.md` 的 `## Acceptance Criteria` 章节里必须至少有一行 `- [ ]` / `- [x]`。
- 抓到的缺陷：`archive/2026-09/09-29-read-interop/prd.md:9-11`
  > **Its `implement.md` is a fourteen-item plan with no checkboxes at all**, so the file cannot say what is done - but its `prd.md` carries checked acceptance criteria
  ；以及 `archive/2026-09/09-29-the-boxes/prd.md:10` 的 `prd.md                      7661 chars, checkbox lines: 0`。
- 语料成本：**15**（planning 3 · in_progress 5 · completed 7）。这 15 个之一是现役的
  `tasks/09-30-axi-a2-safety`（`in_progress`）。

**`TAL-002 plan-boxes`** — `implement.md` 全文必须至少有 1 个盒子（不规定标题叫什么）。
- 抓到的缺陷：同一条 `09-29-read-interop/prd.md:9-11`（"十四项没有任何盒子"）。被点名的那个任务
  `archive/2026-09/08-27-dove-interop-layer` **正在 16 个命中里**。
- 语料成本：**16**，全部 `completed`，**活跃 0**。

**`TAL-003 no-seed-placeholder`** — 状态是 `in_progress` 或 `completed` 的任务，`prd.md` 里不许留
`task.py create` 播下的占位行。种子文本在 `.trellis/scripts/common/task_store.py:265-288`：
`:277` `- TBD`、`:281` `- [ ] TBD`。
- 抓到的缺陷：`archive/2026-09/09-28-archived-criteria/implement.md:28-32` 把它列成实测到的**三类之一**：
  > | a placeholder criterion | `08-28-dove-sysprompt-reasoning-voice`, whose only criterion reads *TBD* |
  ；现役实例是 `tasks/10-03-dead-enforceable-constant/prd.md:9` 与 `:13`（`planning`，允许）。
- 语料成本：**9**（全部 `completed`；另有 11 个 `planning` 属于合法未写，**不算红**）。

**`TAL-004 criteria-section`** — `prd.md` 必须有 `## Acceptance Criteria` 章节，且正文里有非空行。
- 抓到的缺陷：`archive/2026-09/09-28-archived-criteria/prd.md:23-24`
  > **R3 - Classify what is found**: a box left unticked by a practice, a criterion genuinely not met, or **a task whose PRD has no criteria at all**.
- 语料成本：**3**（全部 `completed`）。"存在但正文为空"今天是 **0**，照实记：这一半是抄 pstack 的
  "非空块"规则，**它对今天的语料不产生任何红色**，只防将来。

四个检查的**并集**：全仓 281 个任务里 **40 个会红**；只看现役 26 个则 **8 个会红**，且全是 `TAL-001`：
`09-29-report-blocker` 不在其中——8 个是 `09-30-axi-a0-base`、`09-30-axi-a1-skeleton`、`09-30-axi-a2-safety`、
`09-30-axi-a3-trace`、`09-30-axi-a4-plane-b`、`09-30-axi-a5-eval`、`09-30-axi-program`、`10-03-first-contact-scenario`。

### 2.3 丢掉的检查，以及为什么

1. **必修章节（`Goal` / `Requirements` / `Out of scope`）——丢。**
   `Goal` 缺 3、`Requirements` 缺 31、`Out of scope` 缺 59，但我**找不到任何一条已记录缺陷**是"因为缺这个章节"
   造成的；而 3 个缺 `Goal` 的里面 1 个是 `trellis init` 生成的引导 PRD（`00-bootstrap-guidelines/prd.md:1`），
   判它红就是假 finding。同理 `Requirements` 的 31 个全在归档里，是历史（§1.5）。
   代价：若用户仍要，`Goal`+`AC` 只要 **3**，加 `Requirements` 要 **31**，加 `Out of scope` 要 **59**（其中 11 个是现役）。
2. **`status=completed` ⇒ `prd.md` 的盒子全打勾——丢，而且本仓已经拒过它一次。**
   `archive/2026-09/09-28-archived-criteria/implement.md:42-43`：
   > **No check was added.** A check that an archived PRD has no unticked box would be red on eighty-eight tasks, and one that lists them all would be a second place to maintain. The practice is the fix
   今天重测：**120 / 254** 个 `completed` 任务的 `Acceptance Criteria` 有空盒或零盒（当年 88/113）。数字变了，结论没变。
3. **`file:line` 锚点解析——丢，代价是量出来的。**
   三个工件里共 **672** 处 `path:line`（prd 297 · design 102 · implement 273）；**424 处解析不到**。
   让正则**要求路径里带 `/`** 之后：242 处，其中 30 处解析不到、**0 处行号越界**；但剩下的 424 处里绝大多数是
   **裸文件名引用**（`extension.ts:2377`、`harness-loop.md:20`），人读得懂、机器判不了；剩下 30 处又是四种
   合法形状（`src/` 省略前缀、兄弟任务相对路径、仓外 checkout、已装包）。`tests/spec-anchors.test.ts:11-14`
   已经把这种结局写死：
   > A check with false findings is worse than no check, because a boundary people turn off protects nothing.
   顺带：**"行号越界"这个能精确判的一半，今天在两仓工件上是 0 命中**——它就是一个今天匹配不到任何东西的检查（§2.6 要防的正是这个）。
4. **pstack 的散文卫生（长破折号 / 弯引号 / 句中冒号）——丢。**
   按他们的规则（含围栏与代码跨度的免除逻辑）扫我们的 641 个工件文件：
   **612 个文件至少中一条**、786 行长破折号、23 行弯引号、**2683 行**句中冒号。
   语料里有 **38 / 281** 个中文 PRD，那里 `——`、`：`、`""` 是正确写法；本仓也**没有任何**成文风格规则
   （对 `.trellis/spec/**`、`AGENTS.md`、`.trellis/workflow.md` 搜 `long dash|em dash|curly|full-width|破折号|引号` → 无命中）。
5. **按标题名判 `implement.md` 的章节（`## Ordered checklist` / `## Validation commands`）——丢。**
   `.trellis/workflow.md:165` 确实把这四样写成 `implement.md` 的合同：
   > - `implement.md` — execution plan for complex tasks: ordered checklist, validation commands, review gates, and rollback points.
   但 256 个 `implement.md` 里，缺"ordered checklist 类"标题的有 **55** 个、缺"validation commands 类"的有 **46** 个，
   而"类"这个字是必需的：漏掉的那些用的标题是 `验证` 17、`提交前` 16、`顺序` 7、`有序切片` 6、`Validation Commands` 6……
   在一个 **373 个不同 h2** 的语料上做标题匹配，产出的就是 §2.2 第 3 条引用的那种假 finding。
   （`TAL-002` 只判"文件里有没有盒子"，不判标题名，正是为了避开这一点。）
6. **`design.md` / `implement.md` 的齐备性（复杂任务三件套）——丢。**
   `workflow.md:167` `Lightweight tasks may be PRD-only`，所以 164 个缺 `design.md` 的 `completed` 任务里绝大多数
   是合法的"轻量"。而且这条是**进入实现前的就绪条件**（`workflow.md:461-470` 那张表），
   该由 `task.py start` 判，不该由一个事后 linter 判。
7. **`design.md` / `implement.md` 里的 `- TBD`——丢**：实测 **0** 命中（`TAL-003` 只写 `prd.md`）。
8. **"引用的那一行是否还说着它声称的话"——丢，但要说清。**
   这是最有价值的一类，本仓也已经两次撞到它的边界：`tests/spec-anchors.test.ts:16-19`
   （`Judging whether the line still *says* what the page claims would need the pages to state one claim per citation`）
   与 `tests/spec-anchors.test.ts:198-202`（解决方法是**让页面自己声明约定**，再按约定判）。
   任务工件的引用里 **424/672 是裸文件名**，没有可判的约定，所以这一条今天做不到；
   真要做，得先改工件的写法，那是另一个任务。

### 2.4 输出契约

- **退出码**：`0` 干净；`1` 有 finding；`2` 用法错（参数缺失/路径不是任务目录）。
  与 pstack 一致：`check-plan.mjs:33-35` `console.error("Usage: node check-plan.mjs <plan.md>"); process.exit(2);`
  以及末行 `process.exit(problems.length ? 1 : 0);`。
- **消息形状**：每行一条 finding，写 stderr，形如
  `<repo-relative-file>:<line>: <check-id>: <message>`——**沿用 `check-plan.mjs` 的 `fail()`**
  （`const fail = (line, message) => problems.push(\`${file}:${line}: ${message}\`);`），
  这样它和 `spec-anchors` 的 `finding.problem`、`task.py validate` 的 `file:line: message` 是同一种可跳转的读数。
  stdout 只放摘要一行：`<n> artifacts, <m> problems, <k> checks`（对照 `check-plan.mjs` 的
  `` console.log(`${prSections.length} PR sections, ${problems.length} problems`) ``）。
- **机器可读**：`--json` 输出 `{ "schemaVersion": 1, "artifacts": n, "findings": [{ "file", "line", "check", "message" }] }`。
  **默认不开。**
- **要不要抄 pstack `watch-pr` 的 2-7 退出码 + 版本化信封？——不抄，那是 over-engineering。**
  我读了他们那份：`watch-pr/policy.ts:313-319` 把 `exitCode` 2/3/4/6 分别挂在不同的 `BLOCKER` 上、`:334` 7、
  `:396` 5、`:440` 0，信封字段在 `types.ts:259` `readonly schemaVersion: 1;`。
  那套东西存在的理由是一个**轮询器要按类别决定重试还是放弃**（`github.ts:535` 把 fast-path 的退出码原样带走）。
  我们这里只有一种工件、一种动作（改文件）、一个调用者（测试/人），退出码能表达的信息已经饱和；
  多出来的类别只会变成第二份需要维护的契约。需要细粒度时用 `--json`，那是**一种**接口，不是七种退出码。

### 2.5 位置、运行时、用法行

- **位置**：`scripts/task-artifact-lint.mjs`（仓库根的 `scripts/`，不是 `.trellis/scripts/`）。
  理由一：`scripts/` 已有同形状的零依赖 ESM 脚本（`scripts/real-dove-blackbox.mjs`）。
  理由二：`.trellis/scripts/task.py` 在 `.trellis/.template-hashes.json` 里（见 `AGENTS.md` 的注记），
  `trellis update` 可能覆盖它——把新门放进去等于把它交给上游。
- **运行时**：**node，零依赖，不经 tsx**。当前 `engines` 是 `package.json:11` `"node": ">=22.19.0"`；
  CI 是 `.github/workflows/compatibility.yml:9,17`（`runs-on: windows-latest`、`node-version: 22`），
  而测试运行器是 `package.json:15` `node --import tsx --test tests/**/*.test.ts`。
  所以脚本用 `#!/usr/bin/env node` + `.mjs`，测试用 `spawnSync("node", [script, ...])` 起它——
  与 `check-plan.test.mjs:22` 完全同形，且在 Windows 上不需要 shell。
- **用法行**：

  ```text
  node scripts/task-artifact-lint.mjs <task-dir> [<task-dir> ...]
  node scripts/task-artifact-lint.mjs --active        # .trellis/tasks/*（planning + in_progress）
  node scripts/task-artifact-lint.mjs --all           # 含 .trellis/tasks/archive/<month>/*
  node scripts/task-artifact-lint.mjs --list-checks   # 一行一个 id + 一句话
  node scripts/task-artifact-lint.mjs --json --active
  node scripts/task-artifact-lint.mjs --only TAL-002 --skip TAL-001 <task-dir>
  ```

  `--only` / `--skip` 不是给人用的花样，是 §2.6 的红绿对照要的开关。

### 2.6 fixture 测试：每个检查必须有一个"必须变红"的 fixture

**位置**：`tests/task-artifact-lint.test.ts` + `tests/fixtures/artifact-lint/`。
`tests/fixtures/` 已经按主题分目录（`capability-protocol/`、`code-audit/`、`harness/`、`ledger/`、`scenarios/`），
所以这是既有约定。

**为什么是"存下来的 fixture"而不是 `spec-anchors` 那种临时目录**：临时目录无法被枚举，
而下面那条穷尽性断言需要一张**可枚举的清单**。两种模式本仓都有，选存盘的那种是被这条需求逼的。

```text
tests/fixtures/artifact-lint/
  manifest.json                 # 唯一的真相：id -> {why, bad, good}
  good/prd.md                   # 最小但合规：Goal + Acceptance Criteria(有盒子) + Out of scope
  good/implement.md
  bad/TAL-001-ac-boxes/prd.md
  bad/TAL-002-plan-boxes/implement.md
  bad/TAL-003-no-seed-placeholder/prd.md
  bad/TAL-004-criteria-section/prd.md
```

每个检查三条断言（**成对**，缺一条都不成立）：

1. `--only <id>` 跑它的 bad fixture：退出码 `1`，**并且** find 到的 finding 恰好 1 条、`check` 字段等于 `<id>`。
2. **同一条 bad fixture，`--skip <id>`（其余全开）：退出码 `0`。** 这一条才证明**红是这个检查造成的**，
   而不是别的检查或解析崩了造成的。
3. `good/` 全开：退出码 `0`。（若某检查会误伤 `good/`，是检查的错，不是 fixture 的错。）

**怎么保证它不会退化成"悄悄匹配不到任何东西"**（本仓已有三种成熟写法，全部照抄）：

- **精确计数，不用 `>0`**：第 1 条断言 finding 数恰好为 1。匹配不到 → 断言失败。
- **正向控制挂在语料上**（`tests/spec-anchors.test.ts:168` 的写法）：
  `assert.equal(reading.citations > 20, true, \`only ${String(reading.citations)} citations were read, so this run proves little\`)`。
  我们这边对应：断言这次运行**真的读到了 ≥N 个工件**（`--active` 下 N=26），否则"零 finding"什么都不证明。
- **"声明消失也算失败"**（`tests/spec-freshness.test.ts:20-22`、`:139-142`）：
  > **A claim that disappeared is also a failure.** If the sentence is rewritten away, the row stops matching and the door fails, because a row nobody can find is a row nobody is checking

**核心问题：怎么让"检查表"本身穷尽——新加一个检查而不加 fixture 就红。**
四步，全部是机械的：

1. linter **导出** `CHECKS`（`{ id, describe }` 数组），`--list-checks` 从它打印。检查只能通过注册进 `CHECKS` 生效——
   **没有第二条路**（这正是 `tests/fence-drift.test.ts:16-19` 用 `declaredMutatingToolNames()` 替掉两套手抄名单的同一手法：
   `which replaced the two name sets the adapter used to export ... so this comparison has no copy to drift against`）。
2. 测试断言 `--list-checks` 的 id 集合与 `manifest.json` 的键集合**双向相等**：
   有检查没 fixture → 红；有 fixture 没检查 → 红。
   先例就在本仓，且理由也是现成的（`tests/fence-drift.test.ts:21-23`）：
   > It fails in both directions: a name either list gains that the fence's set lacks, and a name the fence refuses that no list claims mutates anything. **The second direction matters because a fence that refuses too much is a fence people turn off.**
3. `manifest.json` 的每一项必须有非空 `why` 字符串，且 `why` 里必须含一个 `.trellis/tasks/...` 或 `tests/...` 的路径。
   这条把"每条检查都要有一个真实做错的来源"变成机器可判的条件（就是本文 §2.2 每条的引用）。
   （这是形式条件，判不了"引用是否真支持这条检查"——那要读者。检查自己要说清这个限度，
   照 `09-28-citation-sweep/prd.md:34` `**R5 - The check states its own limit**` 的成例。）
4. **红过一次才算数**：新增检查的第一次提交里，测试必须先以 fixture 的形式红、再绿。
   这不是流程口号，是本仓的成文规矩：`archive/2026-09/09-28-citation-sweep/prd.md:40-41`
   > **AC3** The check lives in `tests/document-drift.test.ts`, **fails on a seeded line citation, and that failure is observed before the seed is removed.**
   ；以及 `archive/2026-10/10-02-architecture-drift/prd.md:36`
   > **AC-5** R6 的门若判定值得做，它必须至少抓住一处**已经存在**的过期数字；抓不到就说明它是装饰，如实记下。

### 2.7 retrofit 决策：三个选项与量出来的代价

数字全部来自 §2.2 的四个检查（`TAL-001`…`TAL-004`）。

| 选项 | 谁会被判红 | 现存量到的代价 | 代价的分布 |
|---|---|---|---|
| **A. 全仓强制**（`--all` 进 CI） | 281 个任务 | **40 个任务红** | `TAL-001` 15 · `TAL-002` 16 · `TAL-003` 9 · `TAL-004` 3（并集 40）；其中 255 个是**归档历史** |
| **B. 标记之后强制** | 由标记决定 | **`status != completed`（26 个）：8 红**；**`createdAt >= 2026-10-05`：0 红**；`createdAt >= 2026-10-03`：7 红 | `status != completed` 的 8 个红全是 `TAL-001`（`09-30-axi-{a0,a1,a2,a3,a4,a5}` + `09-30-axi-program` + `10-03-first-contact-scenario`）。按日期则要看阈值：`createdAt` 分布里 2026-09-28 一天就有 121 个任务 |
| **C. 只按需**（CI 里只有 fixture，语料不判） | 无 | **0 红** | 四个检查的 fixture 仍在 CI 里恒跑；语料由人手动跑 |

**我的建议（不由我定，见下）**：**B，且标记用 `status != completed` 而不是日期。**
理由是量出来的：A 会让 40 个任务红，其中 39 个是历史，而本仓对"历史工件"已有明确裁决
（`09-28-citation-sweep/prd.md:50` `- **Citations in archived task artifacts**, which are history.`），
一次性把 40 个判红的结果照 `spec-anchors.test.ts:11-14` 的预言就是"门被关掉"；
C 则让这门永远不在一件真实工件上红过，而 `10-02-architecture-drift` 的 AC-5 已经把这种门叫"装饰"。
B 的 8 个红**全部集中在现役的 `09-30-axi-*` 一族**（它们的 `Acceptance Criteria` 用的是数字/条目叙述而不是盒子），
是一次半小时内能补完的真实欠账，补完之后门才第一次有资格说"它守着东西"。
日期标记我不推荐的原因也在数字里：2026-09-28 单日产了 121 个任务，日期阈值对"这一族是什么形状"一点都不敏感，
而 `status` 正好就是它要表达的东西。

**这是要问用户的那个问题**：强制面选 A / B / C 哪一个；若选 B，标记用 `status != completed` 还是某个日期。

---

## 3. 未验证项与验证命令

- **185 行那份 `check-plan.mjs` 的配套测试**：`unverified`（该 checkout 没有 `tests/`）。
  验证：`Get-ChildItem .trellis/.runtime/pstack-research -Recurse -Filter 'check-plan*'`。
- **pstack 的 linter 在它自己的 CI 里怎么被调用**：`unverified`（我只读了 `tests/check-plan.test.mjs` 与
  `playbooks/multi-phase-plan.md:10` 的第 6 步）。验证：读 `pstack-claude-main/.github/workflows/**`。
- **`tests/**/*.test.ts` 的 glob 在 Windows 上是否展开**：`unverified`（我没跑 `npm test`）。
  验证：`npm test`，或读 `package.json:15` 的脚本在 CI 里的实际输出。
- **`10-03-dead-enforceable-constant` 等 11 个 `planning` 任务的 `- TBD` 是不是有意留的**：`unverified`（只有作者知道）。
  验证：读 `.trellis/tasks/10-03-dead-enforceable-constant/task.json` 的 `description` 与 `notes`。
- **§2.2 那 9 个 `TAL-003` 命中里有没有"任务本来就废弃"的**：`unverified`。
  验证：对这 9 个跑 `python ./.trellis/scripts/task.py list-archive` 并逐个读 `task.json` 的 `notes`。

## 附：本文用到的测量命令

```powershell
# 任务/工件计数（§1.1）
Get-ChildItem .trellis/tasks -Recurse -File |
  Where-Object { $_.Name -in 'prd.md','design.md','implement.md','task.json' } |
  Group-Object Name | Select-Object Name,Count
Get-ChildItem .trellis/tasks/archive -Directory | ForEach-Object { "$($_.Name): $((Get-ChildItem $_.FullName -Directory).Count)" }

# 标题清单、缺章节、空章节、TBD、盒子数、锚点、并集成本（§1.3, §2.2, §2.3）
# 一个只读 node 脚本：遍历任务目录 -> 解析 h2 与围栏 -> 统计；脚本正文见本任务会话记录
node -e "<见 §1.3/§2.2 的统计脚本>"

# pstack 侧（§1.2）
(Get-Content .trellis/.runtime/pstack-research/pstack-main/skills/poteto-mode/scripts/check-plan.mjs).Count  # 185
Get-Content .trellis/.runtime/pstack-research/pstack-claude-main/tests/check-plan.test.mjs                    # 106 行

# validate 的合同（§1.4）
python ./.trellis/scripts/task.py validate --help
Select-String -Path .trellis/scripts/common/task_context.py -Pattern 'def cmd_validate'
```

> 备注：本文的 node 统计脚本是一次性内联脚本（`node -e`，只读），没有落盘，因此没法给出稳定路径；
> 上面每条结论都带了它的输出数字。要复现，把 §1.1/§1.3/§2.2 的规则照写一遍即可——
> 规则本身（h2 正则、围栏翻转、盒子正则 `^\s*-\s*\[[ xX]\]`、锚点正则
> `/[A-Za-z0-9_.][A-Za-z0-9_./-]*\.(?:ts|mts|md|yaml|yml|ps1|json|jsonl|py):(\d+)/`）
> 与 `tests/spec-anchors.test.ts:49` 是同一条。
