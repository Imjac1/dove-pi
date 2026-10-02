# 读数

## R1 `expires` + R3 无人见证的技巧名 —— ✅ 先红后绿

**红**（反转的用例 + 新用例，33 / 35）：

```
✖ refuses a mode that declares an expiry the runtime cannot honour  [D4]
   AssertionError: a mode declaring an expiry must be told by name that the runtime cannot honour it:
   [Dove mode] expired loaded from modes/expired …
✖ refuses a mode whose forbidden technique this runtime cannot witness  [D4]
   AssertionError: the name the runtime cannot witness is named back:
   [Dove mode] unwitnessed loaded from modes/unwitnessed …
```

**绿**：七个装载套件 **148 / 148** ✓ · `typecheck` **0** ✓

### 一条**已被写下的指令**被执行

`tests/host-work-mode.test.ts` 原本有一条 `[KNOWN GAP]` 用例：*"loads a mode whose declared expiry is in the past"*，注释里写着：

> *"An authorization with a date on it that is never read is a time-bounded grant with no bound. … **Invert this test when the expiry is enforced; do not delete it.**"*

我按它的**精神**反转了它——**处置是"拒绝这个声明"，不是"执行这个声明"**：仓里已经为同一个日历概念（`gate.windows`）决定过形态，原文是 *"not because it is unimplemented but because it is unenforceable here"* ✓。用例里写明了这个选择，引用原文照旧保留。

## 损失（AC-3）

| 处 | 损失 |
|---|---|
| **R1** `expires`（三个已发布模式） | **无** —— 它从未被读过：`src/` 里没有任何读者，`work-mode.ts` 只把它列为允许的键 ✓ |
| **R3** `social-engineering`（模式 + example 的 grant） | **真实** —— 该模式与 grant **不再声称禁止社工手法** ✗。原因是运行时只能禁止**能被形状见证**的技巧（`src/core/argument-syntax.ts`），而这个名字没有形状可读 ✓。要重新声明它，得先为它建一个见证 ✓。已写进两个文件原位，不只写在这里 |

**顺带**：`modes/pentest` 里那行 `2026-10-01` 去掉后，不再有一个"看起来像控制、且显示已过期"的东西挂在那里 ✗ → 它以前既挡不住任何人、又让人以为挡住了 ✓。

## R2 速率上限 —— ✅ 先红后绿

**红**：

- `typecheck`：`tests/rate-cap.test.ts(27,9): error TS2554: Expected 2 arguments, but got 1` —— 当时契约里还没有那个字段 ✓（另一个是我自己的夹具写错 ✓，改掉了，不算这一条的红 ✓）
- 端到端：**六次全放行** ✗ —— `actual ["allow" ×6]` vs 期望第六次 `block` ✓

**绿**：`tests/rate-cap.test.ts` + `tests/action-policy.test.ts` **28 / 28** ✓ · 全量 **855 / 853 pass / 0 fail / 2 skipped**（**141 套件**，比之前多一套 ✓）· `typecheck` **0** ✓ · installer **141 OK** ✓

### 红测试抓到了一个**真 bug**（这就是它存在的理由）

第一版实现把"记下这次运行的时刻"放在了 `recordRun` 的 **phase 早退之后** ✗ —— 而没有 `phase` 参数的调用会在那里 return ✓ → **计数永远为 0，上限永远不生效** ✗。我自己在紧邻处写的注释恰好说明它必须放在前面 ✓（注释对、位置错 ✗）。**是那条端到端用例把它逼出来的** ✓ —— 当时**只有**授权侧的单位用例是全绿的 ✓✓（它们不经过策略的计数 ✓）。

### 另一条教训（写在这一轮，而不是我心里）

我先在自己新写的套件里**手搭了一个 `WorkMode` 对象** ✗，结果 conformance 门根本没被走到 ✓（判定理由为空 ✓、六次放行 ✓）→ 换成**既有套件 `action-policy.test.ts` 的夹具**（`mode()` / `document()` / `invocation()` ✓）之后，问题立刻显形 ✓。
**手搭一个由加载器校验过的对象，会静默地测不到东西** ✓ —— 它没有报错，只是"允许" ✓。

## 剩余

R4（会大声腐烂的用例）与收尾的全范围检查尚未做；本任务仍为 `in_progress`。
