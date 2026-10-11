# Axi loop host 执行清单

## 开工前的门（不满足就不开工）

- [ ] **本仓先绿**：`npm run typecheck` **0** ✓、`npm test` 全绿 ✓（含既有 8 条 jailer 用例 ✓）。
- [ ] **先量一次机制**：`node --import tsx --test tests/jailer.test.ts` 绿 ✓ —— 避免把"机制坏了"读成"接线错了"。
- [ ] **六条 reason 抄一遍**（`tests/harness-reachability.test.ts:107-110`）✓：条目要按**原文**离场，不是改写 ✓。

## 顺序（顺序即依赖）

1. [x] **宿主启动时建边界** ✓（2026-10-11）：在 `runAxiTurn` 的入口，按 `BoundarySpec` 调 `ensureBoundary`（设并回读 ✓）→ 再 `probeToken`（验证 restricting 列表 ✓）→ 再 `launchJailed` ✓。
       **判据成立** ✓：真跑读数 `aclInvariants: "as-declared"` ✓ · `tokenSelfCheck: "pass"` ✓ · `childCreateProcessError: 0` ✓（见 `readings.md` ✓）。
2. [x] **建不起来就拒绝启动** ✓：任一步不自检通过 → 抛错并返回非零，**不降级** ✓。
       **判据成立** ✓：三条用例（不变量不符 · 令牌未验证 · 孩子没被创建 ✓）。
3. [x] **派发走 helper** ✓：改进者的工作由 `launchJailed(spec, { command, cwd, tag })` 启动 ✓；宿主没有可传递的令牌 ✓。
       **判据成立** ✓：`selfCheck: "pass"` + `createProcessError: 0` ✓。
4. [x] **`ok` 的读法写进调用点** ✓：契约写在 `BoundaryPort.launch` 与 `BoundaryReading` 的注释里 ✓；孩子非零退出码**如实记录、不判失败** ✓（两处独立用例 ✓）。
5. [x] **读数进账本** ✓（2026-10-11，第二轮补上）：复用既有阶段（`runtime.phase.completed`，`name: "plane-b-boundary"` ✓）
       —— 账本的种类是**封闭词汇表**，所以**没有新增种类** ✓：建边界**本就是准备**（`phase: "request-prepare"` ✓），
       而 `metrics` 收数字与布尔，正好是这几个码 ✓。**判据成立** ✓：真跑两次的读数都能从文件里读出
       （held-out 写：`childExitCode: 1` ✓；可写侧写：`childExitCode: 0` ✓，两者 `aclInvariantsAsDeclared: true` ✓）。
6. [x] **删掉白名单六条** ✓：`tests/harness-reachability.test.ts` 绿 ✓ —— 而且它是**自己变红并点名六个模块**之后我才删的 ✓。
7. [x] **`axi-turn` 的文档段更新** ✓：*"Writing, isolation and the improvement loop belong to later milestones"* 已改为实测后的现状 ✓（isolation 已在场 ✓）。
8. [x] **规格两页各改一次** ✓：`use-time-architecture.md` §7 三处 + `improvement-run.md` §10 那一行（缺口没关掉，只是**移动**了 ✓）。

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
