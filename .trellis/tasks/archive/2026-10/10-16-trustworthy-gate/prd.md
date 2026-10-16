# A gate that fails only when the change is wrong

## Goal

让仓库自己的验证**只在该红的时候红** ✓ —— 把那两处**固定睡眠围栏**换成**用例自己持有的状态** ✓，并给这一类配上执行器 ✓，使它不会重新长出来 ✓。

**用户价值** ✓：CI 红一次要人去读 ✓；如果红的原因是"那台机器慢" ✗，读它的人就会开始**忽略**红 ✓ —— 而那正是门失去作用的方式 ✓。

## Background（全部实测 ✓）

- **失败那次** ✓：`test (locked)` 挂在 `npm test` ✓（run `38811790771` ✓，commit `9651312` ✓，4m20s ✓），而那个提交**只改了一个 `task.json` 状态** ✗ ⇒ 不可能弄坏测试 ✓；同一工作流在它之前与之后都是 success ✓。
- **失败的那一条** ✓：`not ok 46 - keeps every child of a parallel batch visible while the batch is in flight` ✓ —— `0 !== 2` ✓、`duration_ms: 2807` ✓、`tests/pi-adapter.test.ts:2195` ✓。
- **机制** ✓：`:2193` 在两次派发之后**固定睡 600 毫秒** ✓，然后断言两个都还在飞行中 ✓ ⇒ 它假设"这 600 毫秒内它们既不会结束、也一定已经登记" ✗。本机连跑 **5/5 全过** ✓ —— 同一缺陷的幸运面 ✓。
- **同类存量已量清** ✓（全套 `setTimeout` 只有 5 处 / 3 文件 ✓）：
  - `pi-adapter.test.ts:2193` —— 会**真失败** ✗✓；
  - `project-provider.test.ts:427` —— 会**静默空过** ✗✓：断言是**顺序** ✓，第二次发起晚了照样通过 ✓，而它要证明的串行化从没被测到 ✓；
  - `pi-adapter.test.ts:2163` —— **不是**围栏 ✓：那是**被测子进程自己**的 2500 ms 脚本 ✓；
  - `capability-protocol.test.ts:43` —— **不是**围栏 ✓：10 秒超时 + abort 监听 ✓（防挂 ✓，坏的时候会响 ✓）。
- **共享夹具的爆炸半径** ✓：子脚本经 `DOVE_PI_SUBAGENT_PREFIX_ARGS` 注入 ✓ —— **进程级**环境变量 ✓ ⇒ 两个子进程收到同一份 argv ✓，**没法**各自知道自己是谁 ✓；只有两处断言读它的 stdout ✓（`:2197`、`:2198` ✓）；`pi-subagent-provider.test.ts` 用**自己的**夹具 ✓。

## Requirements

- **R1** 两处围栏都改成**持有状态** ✓，不是把数字改大 ✗（改大只是换一台机器输 ✓）。
- **R2** 两处改写后**仍然会红** ✓ —— 判据是**变异** ✓：把行为改坏则用例必须红 ✓。
- **R3** 给这一类配**执行器** ✓，否则下一处还会长出来 ✓。
- **R4** 不越界 ✓：**不改产品代码** ✗（本子任务只动测试与规则行 ✓），也不声称覆盖所有时间假设 ✗。

## Acceptance Criteria

- [x] `pi-adapter.test.ts` 那条**不再有固定睡眠** ✓（子进程写 `started-<pid>` ✓、等共享 `release` ✓；用例数到两个标记后再读 doctor ✓），且**仍然会红** ✓：把 `activeRuns` 改成 `.slice(-1)` ⇒ `actual: 1` ✓、报 `a batch in flight must be reported as two runs, not one overwritten slot` ✓。**耗时从 ~2800 ms 降到 1663 ms** ✓（不再等时长 ✓）。
- [x] `project-provider.test.ts` 那条**不再可能空过** ✓：重叠由 `entered` / `release` 两个承诺**构造** ✓，且新增了那条关键断言 ✓ —— 锁被持有时 `events` 仍为 `["first-start"]` ✓；变异（`if (acquired)` → `if (true)` ✓，只改那一行 ✓）⇒ **红** ✓，报 `the second action waits for the lock rather than running beside it` ✓。
- [x] 两处改写**保住了**它们原本测的东西 ✓：`child answer` 仍写在 stdout ✓（两处断言读它 ✓）、注入仍是 argv 前缀 ✓、锁那条的顺序断言原样保留 ✓。
- [x] **扫描执行器**存在 ✓、今天为绿 ✓，且在 `tests/temporary-directory.ts` 加一处**带数字**的固定睡眠后**变红并点名到行** ✓（`temporary-directory.ts:34` ✓），删掉后恢复绿 ✓。
- [x] **规则行**进了前门表 ✓，`document-drift` 解析通过 ✓（四门 34/34 ✓）。
- [x] `npm test` **992/992** ✓、typecheck 干净 ✓、四条文档门全绿 ✓、corpus 45/0 ✓。
- [x] `findings.md` 记了两处变异的**红样** ✓、耗时的前后对比 ✓、扫描**首次运行时抓到自己的注释**这件事与修法 ✓、以及我弄错的两处（变异不够外科 ✓、子进程的 30 秒尾巴 ✓）。

## Out of Scope

- **改产品代码** ✗ —— 两处围栏都在测试里 ✓。
- **审计仓库里每一处时间假设** ✗ —— 只关**已经量清的那一类**（固定睡眠当围栏 ✓）；扫描器**只**认那一个精确形式 ✓，并明说它不是防篡改 ✓。
- **缩短或并行化测试** ✗ —— 那是别的问题 ✓。
