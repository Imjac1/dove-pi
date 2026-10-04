# 执行清单（`10-04` ✓ —— **一份、单编号、带状态** ✓）

**状态总览** ✓：**任务 1 完成** ✓✓ · **任务 2 完成** ✓✓ · **任务 3：2 片完成 ✓、1 片被测量推翻并合并 ✗✓、1 项（接面）待做** ✗。**A–I 无一条悬空** ✓。

**所有提交** ✓：`f5561a8`（根因 ✓ 端到端验证过 ✓）· `949dd42`（症状 ✓）· `e01edb6`（记录新鲜度 ✓ + 接线 ✓）· `74cd678`（缓存上报 ✓ + 计划更正 ✓）· `78dcb6e`（发现 G 的文档 ✓）· `9bdc1f0`（发现 C 撤回 ✓）。

---

## 任务 1 —— 根因：延续会话里的新请求被当成重放 ✗✓ **完成** ✓✓

1. [x] **判定** ✓✓ **完成** —— 最小复现 = **两句话**（turn A **真派发过** → turn B `--continue` 的第一个工具调用被拒 ✓）· 反例：turn A 只答一句**不触发** ✓ · 临时探针（插在唯一自增点 `startAttempt` ✓，**已移除并逐字节核对** ✓）读数：两回合**租约不同** ✓、每个回合各以 `trigger=initial` 把 `attemptCount` 推到 **1** ✓✓。
2. [x] **红·单元** ✓ 完成（`actual: true, expected: false` ✓ —— 第一次尝试之后它自称重放 ✓）。
3. [x] **绿·一处** ✓ 完成 —— 规则挪到计数器旁并命名 `isReplay()` ✓，比较 `> 0` → **`> 1`** ✓（守卫 `effect-boundary.ts:111` 不动 ✗ · 键 `effect-ledger.ts:194` 不动 ✗）。
4. [x] **集成红→绿** ✓ 完成 —— 同一对复现：修复前**拒** ✓ → 修复后 **`agent_project_status` 成功并返回真实任务状态** ✓✓ · `'Effect refused'` **不再出现** ✓（字面判据 ✓）。
5. [x] **三条安全属性** ✓ 完成 —— `tests/effect-boundary.test.ts` **8/8 不变** ✓（真实重放的未声明非幂等仍被拒 ✓ · 幂等类仍放行 ✓ · 账本不可读时任何情况都拒 ✓）。
6. [x] **顺带：`effects.classes` 补只读四工具** ✓ 完成（`agent_project_status` ✓ `agent_project_context` ✓ `agent_list_capabilities` ✓ `agent_doctor` ✓）—— **`agent_task_convergence`（写）与 `bash` 明确不补** ✗，并有**断言**守住 ✓✓。

## 任务 2 —— 记录新鲜度（发现 I ✓）**完成** ✓✓

7. [x] **红** ✓ 完成 —— `"agent_project_status only reads, and an undeclared effect is non-idempotent, so a retry of it is refused for no reason"` ✓。
8. [x] **绿 + 接线** ✓✓ 完成 —— `src/project-provider/record-freshness.ts`（规则窄到账本真能判定的那条 ✓：**打了勾的判据必须有事件提到它** ✓；未打勾不报 ✓；文本里声称的测试数**不猜** ✗）· 并进 `dove-pi task verify` ✓（与已有的 `prd.md` TBD 检查并列 ✓）· **真实记录读出 `ready: false` + `unsupportedCriteria` 非空** ✓✓。
   **接线不是可选项** ✓✓：只加模块时仓自己的门直接红 —— *"Either wire them or list them with a reason"* ✓，且它**拒占位理由** ✓、把**过期名单条目**判为失败 ✓。

## 任务 3 —— 让不可见的变可见 + 上报

9. [x] **发现 G 的诚实处置** ✓✓ 完成（`78dcb6e` ✓）—— 写进 `.trellis/spec/backend/personal-agent-mode-format.md` 的"看不见什么"一节 ✓，逐条指出是**哪个名**（`effect-boundary.ts:122` ✓ · `action-policy.ts:431`/`:611` ✓ · `action-policy.ts:21` ✓），附那一轮**原文照抄**的绕道证据 ✓。**引文门当场抓我一次** ✗✓（漏 `src/core/` 前缀 ✓）。
10. [x] **缓存上报** ✓✓ 完成（`74cd678` ✓ · `cache-report.md` 2682 B ✓）—— 253 请求 / 0.0% 命中 / 240 全 MISS ✓ · `cache-audit.ts:87` 的 `no-context` 是**标签不是开关** ✓ · 归属**提供商/宿主** ✗✓ · **本仓零代码改动** ✓。
11. [x] **接一个面** ✓✓ **完成** —— `projectExecutionDiagnostics` 现在带出 **`requestsReceived`** ✓ · **`requestsTerminated`** ✓ · **`unterminatedRequests`** ✓✓（`execution-ledger.ts` ✓）；红是 `actual: undefined` ✓ → 绿两条 ✓。**而两个"面"早就存在** ✓✓：`src/cli.ts:73` 已在读账本 ✓、`local-rpc.ts:47` 的 **`diagnostics/status` 是运行中可查的活接口** ✓✓ —— **缺的只是投影说不出"有请求从未结束"** ✗✓。
    **仓自己的规矩纠正了我两次** ✓✓：① 一条既有用例（*"carries only the schema version when the ledger holds nothing to project"* ✓）说明**空则省略键** ✓ —— 而我原本"无条件上报" ✗ → 改回省略 ✓；② **代码注释不得引行号** ✓✓（*"a comment cites a line of this repository, which drifts: name the thing instead"* ✓）—— 我三次引文违规里，这是门给出的**比我的习惯更好的规矩** ✓。
    - **计划记的"把终态落盘"不存在** ✗✓：账本**早已**写 `request.received` ✓ `request.planned` ✓ `request.attempt.*` ✓ **`request.terminal`** ✓ `provider.request.*` ✓ `gate.refused` ✓，且 `projectExecutionDiagnostics`（`execution-ledger.ts:152` ✓）**已在归约** `received`/`terminal`/`terminalReasons` ✓✓ → **"被杀" = 一个从未 terminal 的请求** ✓✓。
    - **发现 C 撤回** ✗✓：`execution-ledger.ts:444` 的 `append` 就是 `await appendFile(...)` ✓ —— **无缓冲** ✗ → 账本每条即写 ✓；我原先的证据把**工作区目录**的 mtime 当成了**账本文件**的 ✓（重取：账本 mtime **比目录新** ✓✓）。
    - **真问题只剩"面"** ✓：**数据在，运行中看不见** ✓。
    - **做法** ✓：照 `record-freshness` 那次 —— **先看有没有，再造** ✓；仓内先例 **`harness-axes.ts:85`**（*"没有终态的账本不得报满分"* ✓✓）。
    - **不做** ✗：**不为不存在的缓冲问题加 flush** ✗✓。

## 任务 3 之外：这条**新读数**归属它自己的任务 ✗✓

12. [ ] **`pentest` 与 `trading` 的 `effects.classes` 一条都没有** ✗✓（量过 ✓）→ 那两个模式下**每个工具**都非幂等，含只读的 ✓ → **同一类遗漏、面更大，单独开任务** ✓。

## 验证（每次提交前都跑过 ✓）

```
npm run typecheck && npm test          # 最后：0 · 899 / 897 pass / 0 fail / 2 skipped
```
另有按片追加的：`tests/request-lifecycle-new-request.test.ts` ✓（4 ✓）· `tests/code-development-mode-effects.test.ts` ✓（2 ✓）· `tests/record-freshness.test.ts` ✓（4 ✓）· `tests/harness-reachability.test.ts` ✓（6 ✓）。

## 风险与回退 ✓

- **任务 1 已落** ✓：单点改动 ✓（规则与调用点各一处 ✓）→ 回退面小 ✓；安全属性是**结构性**保住（重试走 `startAttempt` ✓ 与 `beginRequest` 不同）✓，且**仍有用例** ✓✓。
- **任务 2 已落** ✓：新增模块 + 一处接线 ✓；`ready` 的语义变化是**有意的** ✓（记录撑不住自己的打勾就不该 ready ✓）。
- **剩余项** ✗：只增观测 ✓，不改判定 ✗。

## 与本任务同时进行的精神条款（本会话立的规矩 ✓）

**先量再写** ✓（今天我自己的判读被仪器纠正 **≥8 次** ✓：`beginRequest` 连调 ✓ · `:200-202` ✓ · 任何 `--continue` 都拒 ✓ · 效果记录带 `stepId` ✓ · 账本租约复用 ✓ · `effectClassOf` 参数序 ✓ · YAML 缩进 ✓ · **锚点写 `**被杀**` 而文件是 `被杀`** ✓ · **引文漏路径前缀** ✓ · `state.json` 位置 ✓ · **发现 C 的 mtime 混淆** ✓）。
