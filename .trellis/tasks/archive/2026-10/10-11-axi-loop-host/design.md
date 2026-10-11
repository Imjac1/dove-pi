# Axi loop host 设计

## 边界：动什么、不动什么

**动** ✓：`src/commands/axi-turn.ts`（自有派发路径的**入口**：启动 + 派发两处）· `tests/harness-reachability.test.ts`（六条按原文离场）·
两页 spec（事实变了就改页 ✓）· 可能新增**一条**走宿主的用例文件 ✓。

**不动** ✗：`src/jailer/*` 的机制 ✓（已由 `tests/jailer.test.ts` 8 条看住 ✓）· `src/core/loop-runner.ts` 的回路本身 ✓ ·
Pi 宿主自己的回路 ✓ · A4 的其余步骤 ✓ · 任何"OS 沙箱"声明 ✓。

## 两个调用点，以及为什么落在那里

```text
runAxiTurn()                       ← 自有派发路径的入口（src/commands/axi-turn.ts:72）
  ├─ ① 启动：ensureBoundary(spec)  → 回读 ACL，invariantViolations 必须为空      ✓ 先
  │        probeToken(spec)        → 验证 restricting SID 列表，selfCheck=pass   ✓ 再
  │        （任一步不过 ⇒ 抛错返回非零，不降级 ✓）
  └─ ② 派发：launchJailed(spec, {command, cwd, tag, timeoutMs})                   ✓ 边界之下
```

**为什么是这里** ✓：`axi-turn.ts:3-11` 自己写着"它是那个消费者"——`src/cli.ts` 是 reachability 走的四个入口之一 ✓，
所以**从这里 import 才让模块真的可达** ✓，"删掉白名单条目"于是变成一条**读数**而不是一个意图 ✓。

## 与 `src/jailer` 的契约（照抄规格，不自创）

| 件 | 语义（原文） | 调用方必须怎么用 |
|---|---|---|
| `ensureBoundary` | *"sets the ACL invariants with icacls and then re-reads them"*（`index.ts:3-6` ✓） | 设完**回读**；只有 `invariantViolations` 为空才算建起来 ✓ |
| `probeToken` | *"create the restricted token and verify its restricting list"* ✓ | 自检 `pass` 才算令牌成立 ✓ |
| `launchJailed` | *"start the improver under that token"*；*"the improver is launched by the helper process and never by itself"*（`launch.ts:4-6` ✓） | **只**能"要一个孩子"；宿主不得持有可传递的令牌 ✓ |
| `LaunchReport.ok` | *"**not** 'the child succeeded' … `ok` means the mechanism reported honestly and the token's restricting list was verified"*（`launch.ts:8-11` ✓） | 判据用 `selfCheck`；孩子非零退出码**如实呈现** ✓ |

## 还没量到的东西（**开工前必须量，不许猜** ✓）

1. **`BoundarySpec` 的字段从哪来** ✗：held-out 路径与可写路径**谁声明**？`use-time-architecture.md` §7 说"held-out 路径"与 A0.1 的结论有关 ✓，
   而 A0.1 的读数在 `09-30-axi-a0-base/readings.md` ✓ —— **开工前读它**，把 spec 的**来源**写进本文件 ✓（这是本任务唯一真正的未知 ✓）。
2. **每次启动的代价** ✗：`ensureBoundary` 是 icacls 的 set+read（系统级改动 ✓）。**一次 turn 建一次，还是复用已建成的边界**？量到再定 ✓。
3. **`Everyone` 档的边界** ✓ 已知：**不是 OS 沙箱** ✓；读覆盖**声明的路径**而非其内容 ✓（§7 ✓）—— 写清、不夸大 ✓。

## 权衡

- **代价换什么** ✓：每次 turn 的 ACL set/read（毫秒级系统调用 ✓）换"不变量由**进程**而非声明保证" ✓ ——
  A4 的 design 决策 5 明说三件（路径 + 进程 + 测试）要**同时** ✓，本任务补的就是"进程"那一件 ✓。
- **被挡住的写不等于失败** ✓：读 `ok` 的方式决定了这套机制是"真的在用"还是"每次都报失败" ✓（本仓量过 88/120 的过度拒绝形态 ✓）。
- **不引入更强的强度** ✓：`Everyone` 档是现在的诚实强度；声称更强就是"声明了却做不到" ✓。

## 回退形态

**单点回退** ✓：两处调用（`ensureBoundary`/`probeToken` 与 `launchJailed`）各自独立 ✓；
去掉它们 ⇒ 六条白名单**回来**，且它们原本的 `reason`（"the loop's startup/dispatch path will"）**仍然为真** ✓ ——
所以回退不会留下一个说谎的声明 ✓。测试侧：AC-4 的用例随之删除（它是为这个行为写的 ✓）。

## 测试计划

| 判据 | 由什么看住 |
|---|---|
| 先建边界再派发（顺序） | 一条用例：让 `ensureBoundary` 报违规 ⇒ 断言**没有** `launchJailed` 发生 ✓ |
| 建不起来就拒绝启动（AC-4） | 同上（拒绝启动而不是降级 ✓） |
| 不变量在**运行路径上**成立（AC-2） | 复用既有的 criterion 1/3 复现 + 一条**走宿主**的用例 ✓ |
| `ok` 不被读成"孩子成功" | 一条用例：孩子以非零退出 ⇒ 宿主读数里**不是**失败，且退出码可见 ✓ |
| 六条离场（AC-3） | `tests/harness-reachability.test.ts` ✓ —— 删早了它就红 ✓ |
| 不下降（AC-5） | `npm run typecheck` 0 ✓ + `npm test` ✓ |

## 与 A4 的关系（方向写清，不靠树的位置 ✓）

A4 的第 3 步要"**独立进程**"的闸门 ✓、第 5–8 步要"能在边界下跑起来"的回路 ✓、第 10 步要 HITL 门 ✓ ——
三者都等本任务 ✓。**本任务不实现它们** ✓，只提供它们的前提；A4 的 design 决策 5 里"进程"那一件由本任务交付 ✓。
