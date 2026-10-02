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

## 下一步

R2（速率上限兑现）→ R4（会腐烂的用例）→ 收尾的全范围检查。
