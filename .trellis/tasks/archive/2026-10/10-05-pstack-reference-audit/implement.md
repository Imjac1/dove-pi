# 实施清单：三条纪律按依赖顺序落地

## 顺序

> 每一步 = 一个逻辑改动 = 一个提交（这样 revert 有目标）。每一步都先写用例、**观察到红**，再修到绿，并在提交信息里写下"关掉了哪条已记录缺陷"。

1. [ ] **S1 文档层的错话先清（设计决策 2 的第 9、10 条）** —— 必须在注入之前做，否则注入的第一天就把假话送进每一轮。
   - 删 `modes/pentest/MODE.md:18-21`（它说 `preflightAuthority` 没有运行时调用者，而 `src/pi-adapter/extension.ts:2229-2237` 真的调用并在拒绝时阻止装载）。
   - 改 `modes/code-audit/governance.yaml:14-19` 那句指向 `permissions.yaml` 的说法（`src/core/work-mode.ts:191` 的字段封闭集只接受四个键）。
   - 缩短 `modes/trading/MODE.md:23-25`（今天为真，但同一写法会腐坏）。
   - 红→绿：宿主 `tests/pentest-mode.test.ts` 加一条禁则检查（模式文件不得再声称该检查没有调用者）；改前它必须在那四行上红。
2. [ ] **S2 模式正文进入系统提示词（决策 3）**
   - 唯一改点是 `src/pi-adapter/extension.ts:3309` 那一个表达式；新增 `formatWorkModeInstructions` + `MODE_BODY_MAX_CHARS = 8000`；在 `:2210`/`:2223` 处维护 `activeWorkModeSource`（frontmatter `name` 与目录名不保证相等：`:809` vs `:878`/`:960`）。
   - 四条 red-first：RT1 模式一章到达模型（编辑 `tests/host-work-mode.test.ts`，探针句**从 shipped `MODE.md` 读出**而不是硬编码）；RT2 边界仍成立（20k 正文 → 截断 + 披露，且 1k 窗口下 fragment 仍被丢）；RT3 空正文不致命（新文件 `tests/mode-body-prompt.test.ts`，纯函数，正例锁住 id/目录名分离）；RT4 每请求都在 + `/mode` 变更 epoch 前缀（注意工作模式中途**不能**换）。
   - 同一次改动里把"正文进了多少字符、是否截断"写进 `src/core/strategy-snapshot.ts:153` 那行快照输出。
3. [ ] **S3 类型层的两处删除（第 2 条；第 3+6 条合并）**
   - S3a：删 `readOnlyToolHardStopThreshold` 全链（`src/pi-adapter/progress-guard.ts:25,194,227-229,418`；`src/pi-adapter/extension.ts:980,3466,3484-3485`；`src/core/strategy-snapshot.ts:11,153`）。
   - S3b：删 `getProjectContextBudget` 的 `promptChars`（`extension.ts:3441` 及 `:984`、`:3241-3242`），并删只被测试使用的 `getRemainingContextChars`（`:3420-3429`，测试 `tests/pi-adapter.test.ts:1444-1446` 同改）。
   - 验证形状：删完后 `rg -n "readOnlyToolHardStopThreshold|promptChars|getRemainingContextChars" src` 必须为 0 处；`tests/strategy-evaluation.test.ts` 里对 `hardStop` 的断言随之改。
4. [ ] **S4 架构层的四处关闭（第 1+1b、7、8、4、5 条，各一个提交）**
   - S4a：`ENFORCEABLE_SANDBOX` 派生三桶判定 + 适配器改读它（`src/core/work-mode.ts:207` → 导出；`src/pi-adapter/extension.ts:2250-2261` 删字面量）；同一次把 `filesystem: ephemeral` 归入"主机无法兑现"桶（`work-mode.ts:753-762`）。
   - S4b：留 `countGateRefusals`、删 `gateRefusalCounts`（`src/core/harness-axes.ts:63`），改 `harness-axes.ts:109`、`harness-corpus.ts:72` 与 spec `personal-agent-harness-loop.md:177`。
   - S4c：`src/core/invocation-disposition.ts:51-80` 的 `DECLARED_TOOLS` 加网络标记 + 补 4 个名字 + `declaredNetworkToolNames()`；删 `src/core/action-policy.ts:21` 的 `NETWORK_TOOLS`；**唯一一次改** `.trellis/harness-surface.yaml`（`middleware` 追加 `src/core/invocation-disposition.ts`）。
   - S4d：删 `src/core/dispatcher.ts` + `src/core/dispatch-policy.ts` + `tests/harness-reachability.test.ts:93-94` 两条 `ALLOW_LIST` + `src/core/contracts.ts:90` 的 `dispatch.decided`/`dispatch.completed` + 规范 `personal-agent-capability-runtime.md:221-293` 那节（三处测试字面量同改）。
   - S4e：删 `src/core/effect-ledger.ts:411-441` 的第二份"至多一次"；三个测试（`effect-ledger` / `harness-effect-claim` / `trading-mode`）改打产品的 `prepare`/`complete`；并发断言改打 `ledger.begin`。
5. [ ] **S5 工件 linter（决策 4，范围已定：`status != completed`）**
   - **S5a 先把语料补到绿**：给 8 份 PRD 的验收段补复选框 —— `09-30-axi-a0-base`、`09-30-axi-a1-skeleton`、`09-30-axi-a2-safety`、`09-30-axi-a3-trace`、`09-30-axi-a4-plane-b`、`09-30-axi-a5-eval`、`09-30-axi-program`、`10-03-first-contact-scenario`。**只把已经写着的验收条件写成 `- [ ]`，不加内容、不改语义**；八份各自一个提交，标题写明"为工件 linter 补复选框"。
   - **S5b `scripts/task-artifact-lint.mjs`**（node ESM、零依赖、不用 tsx）+ `tests/task-artifact-lint.test.ts` + `tests/fixtures/artifact-lint/{manifest.json, good/, bad/<id>/}`。
   - 四条检查 TAL-001..004；每条三条成对断言 + `--list-checks` 与 `manifest.json` 的**双向集合相等** + 精确发现数 + "确实读了 N 个工件"的正向控制。
   - **S5c 上牙齿**：`.github/workflows/compatibility.yml` 加一步跑本仓语料（`--status-not-completed`），语料断言受环境变量门控（本机默认跳过、CI 打开）；改 `.trellis/scripts/` 一个字都不动（`trellis update` 可能覆盖）。
6. [ ] **S6 规则→强制表的家（决策 1）** —— **最后做**：表要引用的执行者必须已经存在，否则表自己的检查就是红的。
   - `AGENTS.md` 的 `TRELLIS:END`（`:21`）之后新增表：`Rule` / `Level` / `Enforcer` / `Fails how`；`Enforcer` 只用封闭语法；**没有执行者的规则不许留行**。
   - `tests/document-drift.test.ts` 加执行者用例（文件头 `:37` 的用例数同改；`:230-234` 的单 `SECTION` 断言拓宽成段落清单）+ 五条种子 fixture。
   - 先把 S1–S5 落成的每一条目写进行里（含本次新增的表自身、linter、模式正文注入），逐一指向真实 `test:`/`type:`/`verifiedBy:`。

## 验证

```powershell
npm run typecheck                      # 每次删除后先跑这个
npm test                               # 用例数不得下滑；新用例必须先观察到红
npm run test:installer
node scripts/task-artifact-lint.mjs --list-checks                  # S5b 之后
node scripts/task-artifact-lint.mjs <任务目录>                      # 坏 fixture 与好 fixture 各一次
node scripts/task-artifact-lint.mjs --status-not-completed         # S5a 之后必须 0 发现
python ./.trellis/scripts/task.py validate 10-05-pstack-reference-audit
```

- 每一条删除都要有一条 `rg` 计数命令给出 0（写进提交信息）。
- 结构性的两个测试必须仍绿：`tests/harness-surface.test.ts:29`（面与 `CHANGE_SURFACES` 两向一致）、`tests/spec-context-budget.test.ts`（规范预算）。
- 第 8 条之后补一次 `tests/work-mode.test.ts` 的网络名单用例，确认它以**安装面快照**为界而不是第三份手抄。

## 风险点与回退

- **风险**：S4c 改 `.trellis/harness-surface.yaml` 会让"面内=有效"的等式对 `src/core/invocation-disposition.ts` 才成立 —— 改错方向会让一次真实编辑被判 outside。回退：单提交 revert。
- **风险**：S2 改的是每轮系统提示词（最坏 +879 tok/轮）。回退：删 `extension.ts:3309` 的那一个表达式，其余不动；快照读数随之保留但不显示正文长度。
- **风险**：S4d 动封闭集与规范一节，牵动三处测试字面量。回退：单提交 revert（模块与记录种类一起回来）。
- **风险**：S5 若选"所有任务"，40 个任务变红（39 个是历史），与仓内"归档工件是历史"的裁定冲突（`09-28-citation-sweep/prd.md:50`）。
- **回退点**：S1/S2（产品可见）与 S3–S5（机制层）可以整组回退互不影响；S6 单独可回退（表是纯新增）。

## 提交前

- [ ] 每个改动都有"改前红、改后绿"的观察记录，写在提交信息里
- [ ] `npm run typecheck` / `npm test` / `npm run test:installer` 全绿，`npm test` 用例数不下滑
- [ ] 每条删除的 `rg` 计数 = 0，并写进提交信息
- [ ] 新增的每一件（表、linter、模式正文注入）都有 `test:` 级 Enforcer 行，表里没有只靠 `doc:` 的行
- [ ] 只有 S4c 一处改过 `.trellis/harness-surface.yaml`
- [ ] S5a 的 8 份 PRD 只补了复选框，未改任何验收条件的语义（逐份 `git diff` 只出现 `- [ ]` 行）
- [ ] `node scripts/task-artifact-lint.mjs --status-not-completed` 为 0 发现，且 CI 那一步已在 `compatibility.yml` 里、断言受环境变量门控
- [ ] `modes/*/MODE.md` 里会被注入的正文，逐句**今天为真**（回到当天复核，不靠印象）
- [ ] 未触碰 `tests/document-drift.test.ts:353-358` 刻意断言仍缺失的那两条上游路径
