# Axi loop host 执行清单

## 开工前的门（不满足就不开工）

- [ ] **本仓先绿**：`npm run typecheck` **0** ✓、`npm test` 全绿 ✓（含既有 8 条 jailer 用例 ✓）。
- [ ] **先量一次机制**：`node --import tsx --test tests/jailer.test.ts` 绿 ✓ —— 避免把"机制坏了"读成"接线错了"。
- [ ] **六条 reason 抄一遍**（`tests/harness-reachability.test.ts:107-110`）✓：条目要按**原文**离场，不是改写 ✓。

## 顺序（顺序即依赖）

1. [ ] **宿主启动时建边界** ✓：在 `runAxiTurn` 的入口，按 `BoundarySpec` 调 `ensureBoundary`（设并回读 ✓）→ 再 `probeToken`（验证 restricting 列表 ✓）。
       **判据**：`invariantViolations` 为空 ✓、`TokenReport` 的 `selfCheck === "pass"` ✓。
       **落点**：`src/commands/axi-turn.ts`（自有派发路径的入口 ✓）；**规格**：`personal-agent-hook...` 无关 —— 见 `use-time-architecture.md` §7 ✓。
2. [ ] **建不起来就拒绝启动** ✓：任一步不自检通过 → 抛错并返回非零，**不降级**。
       **判据**：一条用例（构造一个建不起来/自检不过的 spec）断言"没有派发发生" ✓。
3. [ ] **派发走 helper** ✓：把"改进者要做的事"从**进程内调用**改为 `launchJailed(spec, { command, cwd, tag, timeoutMs })` 启动 ✓。
       **判据**：`LaunchReport.selfCheck === "pass"` ✓；宿主代码里**不存在**可传递的令牌（R2 ✓）。
4. [ ] **`ok` 的读法写进调用点** ✓：注释 + 命名说明 `ok` 是"机制如实 + 令牌已验证"，**不是**"孩子成功" ✓；孩子的非零退出码如实进读数 ✓。
       **判据**：一条用例让"孩子被挡住"（非零退出）时宿主**不**把它记成失败 ✓。
5. [ ] **读数进账本** ✓：边界三项（不变量、令牌自检、launch 自检）与孩子的退出码写进 `axi-turn` 自己的 ledger ✓。
       **判据**：跑一次命令后账本里能读出这三个读数 ✓。
6. [ ] **删掉白名单六条** ✓（`tests/harness-reachability.test.ts`），保留其余条目不动 ✓。
       **判据**：`tests/harness-reachability.test.ts` 绿 ✓ —— 若某条删早了，这道门会红 ✓，那正是它的作用。
7. [ ] **`axi-turn` 的文档段更新** ✓：把 *"Writing, isolation and the improvement loop belong to later milestones"*（`:13-17`）改成实测后的现状 ✓ ——
       **isolation 这一件已经在场**，剩下的（写、回路）仍标为后面的里程碑 ✓。
8. [ ] **规格两页各改一次** ✓（它们自己都写了"当事实变化时改本页，不要加脚注" ✓）：
       - `personal-agent-use-time-architecture.md` §7：`Plane B` 那格从"no runtime path composes it yet"改为实测现状 ✓；
       - `personal-agent-improvement-run.md` §10：`The loop's own host is deliberately deferred | no task owns it yet` 这一行**离开表格** ✓（本任务就是那个 owner ✓）。

## 验证命令

```bash
npm run typecheck                       # 必须 0
node --import tsx --test tests/jailer.test.ts            # 机制仍然绿（8 条）
node --import tsx --test tests/harness-reachability.test.ts   # 六条离场后仍绿
npm test                                # 不下降
node ./bin/dove-pi.cjs axi-turn code-audit "read the notes and stop"   # 真跑一次自有派发路径，读它自己打印的报告
```

## 风险点与回退

| 文件 | 为什么碰它 | 回退 |
|---|---|---|
| `src/commands/axi-turn.ts` | 自有派发路径的入口（启动 + 派发两处） | 单点：去掉 `ensureBoundary`/`launchJailed` 两处调用 ✓ |
| `tests/harness-reachability.test.ts` | 六条按原文离场 | 六条回来（且它们的 reason 仍然为真 ✓） |
| `tests/jailer.test.ts` | 不预期改动 ✓ —— **若它需要改，说明我在改机制** ✗，停下来重估 | —— |
| 两页 spec | 事实变了就改页 ✓ | 页面回到原句 ✓ |

**不做的** ✗：不动 `src/jailer/` 的机制（它已被 8 条用例看着 ✓）· 不动 Pi 宿主那条回路 ✓ ·
不引入 OS 沙箱声明（`Everyone` 档就是现状 ✓）· 不顺手做 A4 的其余步骤 ✓。

## 提交前

- [ ] AC-4 的"拒绝启动"有用例看住（不是靠代码顺序 ✓）
- [ ] AC-3 的六条离场是**删除**，不是 reason 改写 ✓
- [ ] 边界强度的边界（`Everyone` 档、读覆盖路径不覆盖内容 ✓）在 `MODE`/规格里写明，不夸大 ✓
