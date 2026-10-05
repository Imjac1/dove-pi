# Dove Pi 产品定义页

## Goal

给产品面补一份**被路由和被门禁绑住**的定义页 `.trellis/spec/backend/personal-agent-product.md`，回答五个问题：**用户装上的是什么、能做什么、会看到什么、被承诺了什么、明确不做什么**；同时把产品定义从**一归档就会断指针**的 task 目录里搬出来。

**可交付的判定**：新页出现在 router、`backend/index.md` 与 `routedSpecNames` 里，三条门禁读数不下降，且页面里**每一句话都有锚点**，每一句都能被读成"已被证明 / 未被证明 / 未被检查"三者之一。

> 语言：本文件与 `design.md` 用中文（产品意图，需要你审）；**规格页本身、以及被测试逐字钉住的标题字符串用英文**——`backend/index.md` 写明 *All documentation should be written in English*。

## Background（已确认的事实，本会话实测）

- `README.md`（592 行）是**唯一**的产品面文本，全仓 `axi` 在其中出现 **0 次**（实测 grep）。
- `.trellis/spec/backend/` 共 **19** 个文件，其中 **12 份被路由**，全部是"内部座位"契约（谁拥有 loop、闸门在哪一行、信任阶梯）。**没有任何一份回答"用户装的是什么、能做什么"。** 最接近的 `personal-agent-use-time-architecture.md` 自述是"从用户座位看谁被调用"——那是调用图，不是产品面。
- 产品级定义目前只住在 `.trellis/tasks/09-30-axi-program/`（`prd.md` 78 行 + `plan-v8.md` + 6 个子任务）。该 task **尚未归档**；归档会把目录移走且不重写指针（AGENTS.md 记着 5 条/次，本仓已踩两次）。
- `README.md ↔ .trellis/spec/` 交叉引用**只有 1 条**：`README.md:287` → `personal-agent-field-run.md`；反方向 0 条。
- **整条用户流程在同一次运行里走完，从未成功**：`10-05-whole-flow-end-to-end/readings.md:29` 原文是"AC 里最重的一条仍未证明"——那次只跑了 `/status`；上一轮在第 1 步用光 15 分钟被 `cancelled`（`provider.request.started 10 / completed 9`）。
- 扩展自己报的状态行读数（同文件 `:6`）：`workspace=development, workMode=code-development, hashlineEditTools=absent, lens=on-next-session, mode=◆ Standard`。其中 `hashlineEditTools=absent` 意味着**宿主确实没有该编辑工具**——这是读数的一部分，不是"模型草率"。
- `10-03-first-contact-scenario/findings.md`（17 KB，五轮实测）记了 **P1–P13** 十三条产品面发现；该 task 仍是 `in_progress`、无 `readings.md`。
- 门禁会把新页绑死，机制已读源码确认：
  - `tests/spec-context-budget.test.ts`：`routedSpecNames` 是**硬编码数组**，router 链接表与它 **`deepEqual`（顺序敏感）**；每页 `##` 标题与 `expectedHeadingsBySpec` **`deepEqual`**；router 只允许 3 个 `##` 标题、**不得含围栏代码块**；router ≤ 8 KiB、每页 ≤ 24 KiB。
  - `tests/document-drift.test.ts:288`：`.trellis/spec` 下**每个子目录的 index 必须与目录双向相等**；`:406` backend/frontend 里点名的路径**必须存在**。
- `.trellis/.template-hashes.json` **不含任何 `.trellis/spec/**` 路径** ⇒ 规格是项目内容，`trellis update` 不覆盖它（`document-drift` 那个 *"the specifications untracked"* 说的是这件事，不是 git）。
- `src/` 实测：`jailer/` 存在，`trace/` 与 `plane-b/` 不存在；`directory-structure.md:43` 把 `plane-b/` 写成 **not built yet**（属实）。113 个源文件、**1 条向上 import**（`src/core/workspace-policy.ts:5`）——该页"实测 2026-10-02"的数字**仍然成立**（我先怀疑后实测，见诊断 D 节）。

## Requirements

- **R1 落点为 `.trellis/spec/backend/personal-agent-product.md`**（已定：诊断里的"甲"），并进 router 与 `backend/index.md`。**不新建 spec 目录**。
- **R2 页面回答五个问题**：① 是什么/给谁 ② 用户可见的循环 ③ 可触达的面 ④ 哪些是承诺、由什么执行 ⑤ 明确不做什么。
- **R3 每句都有锚点**：`file:line`、`README.md:NN`、或读数文件；且每句被标成 **demonstrated**（带读数）／**not yet demonstrated**（有读数证明它尚未被证明）／**unverified**（无仪器）。**没有锚点的句子不许进页面。**
- **R4 axi 只作为内部程序出现一节**（已定：选项"内部程序"）：说明它是实现方式、对外不承诺，**该节不含任何产品承诺**。
- **R5 产品定义从 task 目录搬出**：产品面内容进产品页；axi 的阶段状态**按名字引用**，**页面里不写会随归档失效的路径**（理由见 `design.md` 决策 5）。
- **R6 修正诊断里的 M2/M3/M5/M6**：plan-v8 已作废的"新仓/迁移"措辞、`09-30-axi-program/prd.md:72` 的**节号引用错误**（它写 §5.2"新仓目录树"，实测在 §5.1）、README 与 spec 互不认识、`plane-b`/`trace` 的形状只存在于那个 task 目录。
- **R7 不新造能力声明**：每条承诺都指到执行者（测试/spec）；指不到的写"未被检查"。
- **R8 门禁不下降**：`npm run typecheck` 0、`npm test` 0 fail、`npm run test:installer` OK；**读数原样记录**，包括与本轮无关的既有失败。

## Acceptance Criteria

- [x] **AC-1** 产品页存在、被 router 指向、被 `backend/index.md` 列出；`spec-context-budget` 与 `document-drift` 全绿。
- [x] **AC-2** 页面的 `##` 标题与 `expectedHeadingsBySpec` **逐字一致**（英文、编号、顺序）。
- [x] **AC-3** 页面点名的每个路径都真实存在（backend 已被 `specPathProblems` 覆盖）。
- [x] **AC-4** 页面**显式写出**"整条流程在同一次运行里尚未被证明"，并指向 `10-05-whole-flow-end-to-end/readings.md` 与 `10-03-first-contact-scenario/findings.md`。
- [x] **AC-5** axi 在页面里**只占一节**，该节没有产品承诺、没有会随归档失效的路径。
- [x] **AC-6** `README.md` 与产品页**互相指认**，且产品页开头写明谁是权威（见 A-6）。
- [x] **AC-7** `09-30-axi-program/prd.md` 里那处节号引用被改成实测值，**修正理由写在原地**。
- [x] **AC-8** 三条门禁读数写进本 task 的 `readings.md`，含既有失败的归因。

## Out of Scope

- 不重写 `README.md`（只加交叉引用与必要更正）。
- 不动 axi 的 A0–A5 实质内容（只搬位置、修引用）。
- 不写愿景/路线图式散文；不新增 spec 目录。
- 不修 10-03/10-05 里那些**独立缺陷**（编辑工具缺失、15 分钟超时、bash 挂起 6 分 33 秒）——只把它们作为"未被证明/已知缺口"的事实引用。

## Resolved decisions（2026-10-05，用户裁决）

- **R-D1（A-6）产品页是产品面的权威，README 跟随**：两者不一致时改 README，不改产品页——除非读数本身变了。放在被门禁绑住的一侧。
- **R-D2（A-2）§8 非目标只写能锚到的，并在节首声明"这份清单的完备性本身没有仪器"**：不追求完备、不用未验证的条目充数。

## Assumptions taken unless corrected（其余五条按建议执行）

- **A-1（U2）** 只有**带读数**的用户面事实升格为产品承诺；`hashlineEditTools=absent` 这类写进"已知缺口"。
- **A-2（U3）** 非目标清单**只**由 README 与 spec 里能锚到的条目构成，**并声明它不完备**；每行带锚点。
- **A-3（U5）** 成功标准写 **"暂不宣称"**，指向 `personal-agent-field-run.md`（黑盒 run 是**测量不是门禁**，`README.md:284-287`）。
- **A-4（U6）** `axi-turn`、`scripts/harness-*.mts` 标为**内部入口、不承诺兼容**。
- **A-5（U7）** 产品页附一张轴对照表：`/mode` · `/dove-mode` · `/dove-workspace` · `modes/<id>`。
- **A-6（M5 的权威问题）** **产品页是产品面的权威，README 是用户面文本**；两者不一致时改 README。
- **A-7** 语言：产品页与 router/index 用英文；本 PRD/design 用中文，**被钉住的标题字符串逐字英文**。

## Open Questions

无阻塞项。A-1 / A-3 / A-4 / A-5 / A-7 按上面写明的默认执行，若与你的理解不同请在 `task.py start` 前说；A-2 与 A-6 已由 R-D1 / R-D2 定下。
