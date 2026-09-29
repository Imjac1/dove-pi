# Design — 真实运行的做法，与它被遮住的原因

## 1. 一句话

把"真实运行"从一次偶发变成**一条写下来的、有格式的、明确不是门禁的**做法；并把遮住它的四处便宜缺口补掉。

## 2. 证据基线

见 `prd.md` 的 F1–F22。设计只依赖于其中已被实测的三条硬约束：

- **F21**：`personal-agent-harness-loop.md` 只剩 **270 B**、`personal-agent-request-runtime.md` 只剩 **37 B**（上限 24 KiB）。
- **F20**：spec 清单与每份 spec 的 `## ` 标题清单被**硬编码**在 `tests/spec-context-budget.test.ts` 里，用 `deepEqual` 断言。
- **F22**：加一份 routed spec 要**四处同步**（正文、router 链接、测试里的两个清单、`index.md`）。

## 3. 设计决策

### D1 — 真实运行的契约放进**一份新的 routed spec**

**选**：新增 `.trellis/spec/backend/personal-agent-field-run.md`，带一个 `## Scenario: ...` 标题，
并按 F22 同步四处。

**理由（F21 是决定性的）**：最贴合主题的宿主是 `personal-agent-harness-loop.md`（它已经在讲 harness 的证据），
但它**只剩 270 B** —— 约四行，装不下一条契约。`request-runtime` 只剩 37 B。所以"折进现有 spec"不是一个选项，
而是一个算得出来的不可能。

**这不是新发明，是本仓库既有做法**：`personal-agent-harness-loop.md:7-8` 自己写着，它是在**另外两份 spec 触顶之后**
被拆出来的。预算机制的存在就是为了逼出这个动作。

**否 1**：折进 `personal-agent-extension-runtime.md`（9,267 B 余量）。
它**能**通过 `spec-context-budget` 的检查（那份测试只比对 `## ` 标题，加 `###` 不违规），
但主题不对 —— 那份 spec 拥有的是"扩展配置、doctor、身份、授权"，不是"现场证据"。
把一个主题塞进一份不拥有它的 spec，正是这个仓库反复抓到的"自己的声明在说谎"。

**否 2**：写进 `quality-guidelines.md`（5,504 B，且不在 routed 清单里，因此没有预算测试）。
主题同样不对：那是**评审清单**（禁止模式/必需模式），不是运行做法。

**代价**：四处同步（F22），其中 `tests/spec-context-budget.test.ts` 的两个清单是**顺序敏感**的
（`deepEqual` 比对 router 里链接的出现顺序与 `routedSpecNames` 的顺序）。做法：**两边都追加到末尾**，顺序自然一致。

### D2 — 读数格式：**模板在 spec 里，每次的读数写在任务记录里**

**选**：spec 给出一段**固定的字段块**作为模板，并附**一个真实的、跑过的读数**作为样例；
每次运行的读数写进当次的任务记录（与 `09-29-real-run-findings/implement.md` 今天已有的做法一致）。

**理由**：
- AC-3 要的是"两次运行的**形态**可对照"，不是"数值可对比" —— F11 已经说明数值不可复现（端点/模型漂移）。
- AC-9 禁止**运行时**持久化格式。一个写在 spec 里的模板是**文档**，不是运行时格式。

**样例即"最近一次运行"**：模板里那段真实读数同时充当两件事 —— 它演示格式，
也让"上一次真实运行是什么时候、在什么端点/模型上"**一眼可见**（G1 的部分缓解）。
**并且必须写明：没有任何检查校验它是否过期** —— 一个没人验的新鲜度声称就是假保证。

**否**：机器可读的运行索引文件（新持久化，违反 AC-9）；或让测试去解析历史读数（会把不可复现的东西变成门禁）。

### D3 — `verifiedBy`：把 harness 套件登记到 `tool-implementation`

**选**：在 `.trellis/harness-surface.yaml` 的 `verifiedBy.tool-implementation` 追加 `tests/real-dove-blackbox.test.ts`。

**理由**：该套件通过**公开启动器**端到端驱动产品，验证的是 `src` 的行为，而 `tool-implementation` 就是 `[src, tests]`。
**这一步是自验证的**：`tests/harness-surface.test.ts:36-37` 会加载**真实的** `.trellis/harness-surface.yaml`
并断言每个条目都能解析 —— 路径写错就会红。

**已核实这不是硬编码清单**：`harness-surface.test.ts` 的其余用例用的是**合成** surface
（`parseHarnessSurface("version: 1\ncomponents:\n  skill: ...")`），所以这是**纯数据改动**，没有测试期望需要同步。
`CHANGE_SURFACES`（`src/core/task-convergence.ts`）是 **surface 名字**的集合，不是 components 映射，本次不动。

**否**：登记到 `middleware` —— 那是闸门边界，由 `action-policy` / `host-work-mode` / `fence-drift` 验证，
harness 套件不拥有它。**否**：不登记 —— 那正是 G4 要修的空白。

### D4 — README：把误名的段落纠正，并补上真实运行路径

**选**：`README.en.md` 的 "Full workflow and a real-user smoke check"（`:258`）**不是**真实用户检查（F9，全程无模型）
—— 就地纠正它的说法，并补上 `--provider real` 的真实运行路径（F10）。

**理由**：F9+F10 合起来的效果是"按文档做一遍会得到假信心"。这是本任务里**最便宜、杠杆最高**的一处：
读者最可能照着做的那条路，恰好是唯一走不到真实模型的那条。

**约束**：`.trellis/spec/backend/index.md` 写着 **"All documentation should be written in English"** —— 文档一律英文。

### D5 — G5（做不到的读数要求）**已经处置完毕**，不要重做

**已核实**：`09-29-real-run-findings/implement.md` 我已在本会话的 `c818315` 里写明了
`providerEvidence` 是 faux-only、以及上一条记录把它列为读数要求"按构造无法满足"。
所以 G5 **已修**，本任务只需**核对并引用**，不重复劳动。方案里把它标成"非改动项"。

### D6 — spec 里必须写明它**不是**什么

新 spec 必须显式声明：

1. 读数是**测量不是断言**，**不得**进 `npm test`（F11）。
2. "最近一次运行"那行**没有检查校验新鲜度**。
3. 保真边界：一次真实运行**不**证明"agent 把活干对了"；TUI/快捷键/状态栏不在覆盖内。
4. **怎么新增一个真实运行场景**，含 F19 判据：断言写给**脚本化事件**的场景**不能**直接指真模型
   （`correction` / `compact` 的 `requires` 明写 "nothing beyond the default faux responses"）。

## 4. 兼容与回滚

| 改动 | 风险 | 回滚 |
|---|---|---|
| 新增 spec 文件 | 纯新增 | 删文件 + 撤销另三处同步 |
| router 加一行链接 | router 上限 8 KiB，现 4,039 B | 删那一行 |
| `spec-context-budget.test.ts` 两个清单 | **顺序敏感**（`deepEqual`） | 撤销两处追加 |
| `index.md` 加一行 | `document-drift` 要求"列出目录里每份 spec" | 删那一行 |
| `harness-surface.yaml` 加一条 | 自验证；写错路径即红 | 删那一行 |
| `README.en.md` | 长文件，改动应与 `--provider faux` 那段并存而非替换 | 还原段落 |

- 无新的**运行时**持久化点，**回滚不需要清理状态**（AC-9）。
- 新 spec 里任何反引号内的 `src/` `tests/` `scripts/` 路径**必须真实存在** ——
  `document-drift.test.ts:263-281` 会把这些代码跨度里的路径拿去解析。
  只写**已存在**的路径（`scripts/real-dove-blackbox.mjs`、`tests/fixtures/scenarios/read-only-audit.json`、
  `tests/real-dove-blackbox.test.ts`）。`~/.pi/...` 那类**不写成代码跨度**，写成正文。

## 5. 已知不做

- 修 `bash` 非幂等（F15）—— 只记录。
- 把真实运行做成门禁或自动调度（F11）。
- 自动检测"这条路径从未被走过"（D-B 排除的机制）；G1 只有"写下来的协议 + 样例即最近一次运行"这一层缓解。
- 新增真实运行场景（D-C 排除）；本任务只写"怎么新增"。
- 凭据管理（独立安全事务）。
