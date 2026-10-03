# 执行清单

**先说清一件事** ✓：本任务**只规划** ✓ —— 下面的每一片都**开成自己的子任务** ✓，各带先红后绿 ✓；本任务在批准前**不动产品代码** ✗。

## 顺序

**收敛成三个任务** ✓✓（原先的六片里，两片是同一缺陷的两半 ✓；另三片都是"让不可见的变可见" ✓）：

### 任务 1 —— 根因：延续会话里的新请求被当成重放 ✗✓（最高优先）

### 判决（**完成 ✓✓** —— 复现到手，根因是"差一个 1"，探测已移除 ✓）

**最小复现** ✓✓✓（两句话、可重复、**无需改码** ✓）：turn A **真的派发过** → turn B `--continue` 的第一个工具调用被拒 ✓。

**探测读数**（临时探针插在唯一自增点 `startAttempt` 上 ✓，**已移除** ✓）：

| 回合 | 探测行 |
|---|---|
| turn A | `startAttempt trigger=initial request=req_29d4e4b5… next=1` ✓ |
| turn B | `startAttempt trigger=initial request=req_0039a384… next=1` ✓✓ |

→ **两个回合是两个不同租约** ✗✓（**推翻了我从账本得出的 (α) 判决** ✓），而**每个回合一开始就以 `trigger=initial` 把 `attemptCount` 推到 1** ✗✓✓。

**根因（与代码和全部观察一致 ✓✓✓）**：`extension.ts:2818` 的
`const replayed = (requestLifecycle.activeLease()?.attemptCount ?? 0) > 0;`
**在任何回合的第一次 provider 调用之后即为 `true`** ✗✓ → 守卫的完整条件是 `claim.claimed || !input.replayed || isAutomaticallyRetryable(effectClass)` ✓ → **只在"未认领 + `replayed` + 非幂等未声明"时拒** ✓✓ → 于是：`read` 不拒 ✓（在 `effects.classes` 里是 `idempotent` ✓）· `agent_project_status` 拒 ✓✓（身份首次被认领 ✓）· `bash` 在命令是新的时也拒 ✗✓（seg-07/08/09/11 四次 ✓✓）。

**而缺陷就是"差一个 1"** ✓✓✓ —— 边界自己的文档写着：*"a dispatch on our own resumption path, where **an attempt after the first** re-issues work an earlier attempt may already have performed"* ✓✓ → **`attemptCount > 0` ≠ "an attempt after the first"** ✗✓ → **`replayed` 应为 `attemptCount > 1`** ✓（或 `trigger !== "initial"` ✓）。

**这不是放宽保护** ✓✓：它让旗标**符合它自己的定义** ✓✓（第一次尝试从来不是重放 ✓）。

**下一步（切片已精确 ✓✓，可直接照做 ✓）**：

1. [ ] **红·单元** ✓：`tests/effect-boundary.test.ts` **已存在** ✓（`createEffectBoundary` ✓ + **`createInMemoryEffectStore()`** ✓ `effect-ledger.ts:159` ✓）→ **新增一条断言点** ✓：把"这次 dispatch 是不是重放"的规则变成**可调用、有名的**东西 ✓，断言 **`attemptCount === 0` / `1` ⇒ 不是重放** ✓、**`>= 2` ⇒ 是** ✓（今天必红 ✓）。
2. [ ] **绿·一处** ✓：把 `extension.ts:2818` 的内联推导**挪到计数器旁边并命名** ✓（`request-lifecycle.ts` ✓，规则与它所读的计数器同处 ✓），比较改为 **`> 1`** ✓ —— **守卫（`effect-boundary.ts:111`）不动** ✗、**效果键不动** ✗。
3. [ ] **红→绿·集成** ✓：用**那对复现**（turn A 真派发 → turn B `--continue` 用 `agent_project_status` ✓✓）验证：修复前**拒** ✓、修复后**不拒** ✓。
4. [ ] **三条安全属性：重跑 + 确认** ✓✓（`tests/effect-boundary.test.ts:58-79` **已覆盖** ✓）：真实重放的**非幂等未声明**仍被拒 ✓ · 幂等/键幂等类在重放中仍放行 ✓ · **账本不可读时任何情况都拒** ✓ —— 它们是"别改坏"的判据 ✓，不是新写的 ✓。
5. [ ] **顺带（原 B 片）** ✓：`code-development` 的 `effects.classes` 补**只读**四工具 ✓（`agent_project_status` ✓ `agent_project_context` ✓ `agent_list_capabilities` ✓ `agent_doctor` ✓）—— **`agent_task_convergence` 是写 → 不补** ✗、**`bash` 不补** ✗；并查 `pentest`/`trading` 的 `effects.classes` **为空** ✓ 是否同因 ✓。（根因修好后它**不再必须** ✓，但**补它无害且能缩短暴露窗口** ✓✓。）

**仍站得住 / 被推翻的** ✓✗（都留档 ✓）：站得住——拒绝只在 `replayed` 为真时出现 ✓；被推翻——`beginRequest` 连调可复现 ✗ · 缺陷在 `:200-202` ✗ · 任何 `--continue` 都拒 ✗ · 效果记录带 `stepId` ✗ · **账本显示的"租约复用"** ✗（两回合租约不同 ✓）。
2. [ ] **红** ✓：一条用例——"**新请求 + 延续会话**"下，只读工具与 `bash` **不被拒** ✓（今天必红 ✓）。
3. [ ] **绿** ✓：按判定结果改 (α) 或 (β) ✓ —— **守卫（`effect-boundary.ts:111`）不动** ✗、**键（`effect-ledger.ts:194`）不动** ✗。
4. [ ] **三条安全属性各一条用例** ✓✓（**必须先红后绿** ✓）：真实重放的**非幂等未声明**仍被拒 ✓；幂等类在重放中仍放行 ✓；账本不可读时**任何情况都拒** ✓。
5. [ ] **顺带（原 B 片）** ✓：`code-development` 的 `effects.classes` 补**只读**的四个 ✓（`agent_project_status` ✓ `agent_project_context` ✓ `agent_list_capabilities` ✓ `agent_doctor` ✓）—— **`agent_task_convergence` 是写 → 不补** ✗、**`bash` 不补** ✗；并查 `pentest`/`trading` 的 `effects.classes` **为空** ✓ 是否同因 ✓。
   （**它是症状** ✓：根因修好后这条**不再必须** ✓ —— 但**补它是无害的** ✓✓，且能**缩短暴露窗口** ✓。）

### 任务 2 —— 记录新鲜度（发现 I ✓）

6. [ ] **红** ✓：一条用例断言"**打勾意味着账本里有对应事件**" ✓ —— 对今天的 `acceptance.md` **必红** ✓（打勾 AC-001…005 ✓ 而 `evidence.jsonl` 无 closure ✓）。
7. [ ] **绿** ✓：与 `spec-freshness` 同构 ✓✓ —— **只对账机器能算的** ✓（测试数 ✓ / CI 矩阵 ✓ / 引擎声明 ✓；AC↔账本事件 ✓）。

### 任务 3 —— 让不可见的变可见（发现 H + C + G + F ✓）

8. [ ] **每次会话的结束状态落盘** ✓（正常 ✓ / 被拒 ✓ / 被杀 ✓）—— 让"长静默"与"已死"在外部**可区分** ✓✓（发现 H ✓）。
9. [ ] **账本在运行中可见** ✓（现在最后写入停在运行开始处 ✓，发现 C ✓）。
10. [ ] **发现 G 的诚实处置** ✓：**在文档里如实承认"这类控制只挡名字、不挡意图"** ✓✓（比收紧到效果层小得多 ✓，且更诚实 ✓）。
11. [ ] **缓存上报** ✓（**不改本仓代码** ✗）：253 请求 / 0.0% 命中 / 240 全 MISS ✓ + 定位（`cache-audit.ts:87` 的 `no-context` 是**标签不是开关** ✓）+ 归属**提供商/宿主** ✗✓。

## 验证

```
npm run typecheck && npm test && npm run test:installer
# 子任务 A 另需：一条"新请求在延续会话里不被拒"的用例（今天必红）
#             + 三条"安全属性仍成立"的用例
# 子任务 C 另需：一条"打勾必须有账本事件"的用例（对今天的 acceptance.md 必红）
```

## 风险与回退点

- **子任务 A 的风险** ✗✓：标识**太宽** → 真实重放漏判 ✗（安全属性失守 ✓）→ **属性用例必须先红后绿** ✓✓；**太窄** ✗ → 保守方向 ✓，可容忍 ✓。
- **子任务 B 的风险** ✗：把**写**工具也补成幂等 ✗✓ → **只补只读那四个** ✓，`agent_task_convergence` 明确排除 ✓。
- **子任务 C 的风险** ✗：把检查做得比记录本身还复杂 ✗ → **只对账机器能算的** ✓（照 `spec-freshness` 的边界 ✓✓）。
- **回退** ✓：A 是单点 ✓（旗标来源 ✓），B 是清单 ✓，C 是新增检查 ✓ —— 三者的回退面都小 ✓✓。

## 提交前

- [ ] **A–I 每条都落到"子任务 ✓ / 不属于我们并已上报 ✓ / 写明为何不做 ✗✓"之一** ✓，无悬空 ✓
- [ ] 安全属性 2、3、4 **各有自己的用例** ✓（不是靠"改动很小"来担保 ✗）
- [ ] 缓存那条**没有**引入本仓代码改动 ✗
- [ ] 每条子任务都有**今天必红**的用例 ✓（先红后绿 ✓）
