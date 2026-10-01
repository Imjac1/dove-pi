# A1 执行清单（S1：最窄的端到端回合）

## 顺序

1. [ ] **先证可达**：删掉 `loop-runner` 的 allow-list 条目 → 跑 `tests/harness-reachability.test.ts`。
       **红** = 走查不认我们要用的入口 → 按设计决策 1 改入口（改完再回来删）；
       **绿** = 可达 → 接着删 `loop-scripted`、`checkpoint` 两条。
2. [ ] **红测试先写**：`tests/axi-turn.test.ts` 先落成对断言（`executedActions 1 → 0`）与 keep/revert 记录断言，**此时应当是红的**。
3. [ ] **入口**：`src/cli.ts` 加诊断子命令——组合 `createAgentLoop` + `createScriptedProvider` + 一个只读工具 + `createActionPolicy` + `ExecutionLedger`，打印一次回合。
4. [ ] **只读工具**：一个 `LoopToolSpec`（读文件）；**不做写**（写与隔离是 A2 的事）。
5. [ ] **keep / revert 演练**：临时仓里一次提交 + 一次 `git revert`，两个 hash 与账本条目进读数。
6. [ ] **打印读数**：回合读数写进本任务 `readings.md`（含 `executedActions`、账本条数、闸门判定）。
7. [ ] 三条到期条目已删；跑三条门禁；提交。

## 验证

- `node --import tsx --test tests/axi-turn.test.ts` → 成对断言全绿
- `node --import tsx --test tests/harness-reachability.test.ts` → 不红（条目已删）
- `npm run typecheck` → 0
- `npm test` → **822 / 820 pass / 0 fail / 2 skipped**
- `npm run test:installer` → **141 OK**
- `git log --oneline` → 每次逻辑改动一个提交，且**本仓历史里没有测试提交**

## 风险与回退

- 第 1 步若红：**先改入口**，**不要为了让走查变绿去动走查**（那会把"接上了"变成"看起来接上了"）。
- 第 3 步若必须改宿主的行为：**停下报告**——那是 loop 拥有权那一格。
- 回退点：第 3 步之前整块可丢（还没有产品改动）。

## 提交前

- [ ] 三条门禁的原始读数（与 822/820/0/2 · 141 逐项比）
- [ ] 到期的 allow-list 条目已删，理由写进提交信息
- [ ] 失败与未做项如实写进 `readings.md`，包括"承诺降级"
