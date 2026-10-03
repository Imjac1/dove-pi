# 设计：让 `replayed` 说真话

## 边界

**改的是旗标的来源** ✓ —— **守卫（`effect-boundary.ts:111`）不改** ✓、**效果键（`effect-ledger.ts:194`）不改** ✓、**没有安全属性被放宽** ✗✓。
本任务（`10-04-real-run-problems-fixes`）只规划 ✓；**动手在各子任务里** ✓。

## 问题的一句话

**一个延续会话里的新请求，被当成上一请求的重放** ✗ —— 于是"非幂等且未声明"的工具（只读的项目工具 ✓、`bash` ✓）在**本不该被拦**的时刻被拦 ✓✓。

## 为什么根因是旗标而不是守卫（**实测** ✓）

| 事实 | 读数 |
|---|---|
| 守卫的判据 | `claim.claimed \|\| !input.replayed \|\| isAutomaticallyRetryable(effectClass)` → **只要 `replayed` 为假就一定放行** ✓✓ |
| 键的构成 | 内容哈希 ✓（engagement/mode/tool/target/argumentsDigest/explicitKey ✓）→ **不含请求或尝试标识** ✓ |
| 守卫自己的文档 | *"on the **first attempt** the claim is taken and the action **always dispatches** — there is no earlier attempt to duplicate, so refusing would be a **false positive by construction**"* ✓✓ |
| 实际发生 | 12 段 10 次首问、**7 次撞上** ✓；原文含 *"already reached dispatch in an earlier attempt **of this request**"* ✓ |

→ 三条合起来的意思是：**守卫的语义是对的 ✓；它被告知的"这是重放"是错的** ✗✓。

## 数据流（谁在哪一步）

| 步 | 谁 | 做什么 | 契约 |
|---|---|---|---|
| 1 | 宿主/适配器 ✓ | 决定**这次 dispatch 是不是重放** ✓ | **本设计要改的就是这一步** ✗✓ |
| 2 | `effect-boundary.prepare()` ✓ | 取键 ✓、查账本 ✓、按 `replayed` 与效果类判定 ✓ | **不变** ✓ |
| 3 | `effect-ledger` ✓ | 内容键 ✓、claim/complete ✓ | **不变** ✓ |

## 根因已定位到表达式（**实测** ✓✓，2026-10-04）

```ts
// src/pi-adapter/extension.ts:2818-2819
const replayed = (requestLifecycle.activeLease()?.attemptCount ?? 0) > 0;
const effect = await activeEffectBoundary.prepare({ action: identity.action, arguments: identity.arguments, replayed });
```

而 `src/core/request-lifecycle.ts` 里：**新租约 `attemptCount: 0`** ✓（`:182` ✓ `:212` ✓）· **`++lease.attemptCount`** 在 `:229` ✓ · **`attemptCount >= maxAttempts → retry: false`（`attempt-limit`）** 在 `:277` ✓。

→ **`attemptCount > 0` 的语义是对的** ✓✓（"这是同一请求的重试" ✓）；**缺陷是 `--continue` 的新回合没有拿到一个新租约** ✗✓✓ —— 于是**一次新请求被读成了重试** ✗。

**两处候选（由同一个仪器判定 ✓）**：

> **2026-10-04：仪器跑完了，答案在 `request-lifecycle.ts:190-202` 的第四行** ✓✓✓ —— 两处候选**都不是**：
>
> ```ts
> public beginRequest(input: { readonly prompt: string }) {
>   const pending = …;                                  // 排队中的提示词 → 新租约（attemptCount 0）✓
>   if (pending) return { …, isNewRequest: true };
>   if (this.#active?.origin === "input" && this.#active.state === "active") {
>     return { ...snapshotLease(this.#active), isNewRequest: false };   // ★★ 缺陷 ★★
>   }
>   if (this.#active) this.#settleLease(this.#active, "superseded");
>   …新建 synthetic（attemptCount: 0, isNewRequest: true）…
> }
> ```
>
> **缺陷** ✗✓✓：只要有一个"来源 `input` 且仍 `active`"的租约（＝上一回合的 ✓，它没被 settle ✓），`beginRequest` 就**原样返回它**并报 `isNewRequest: false` ✓ —— **完全不比较 `promptDigest`** ✗✓，**而租约身上就带着这个字段** ✓✓（`:180` ✓ `:210` ✓）。于是新回合继承上一回合的 `attemptCount` ✓ → `replayed === true` ✓ → 被拒 ✓。
>
> **修法（唯一自然的那个）** ✓✓：**`promptDigest` 不同 ⇒ 新请求** ✓ —— 先把旧租约 settle 为 `superseded` ✓，再走 `:203-216` **已经写好**的新建分支 ✓✓。**改动面：一个条件** ✓。
>
> **为什么它不动任何安全属性** ✓✓✓：**真实重试走的是另一个函数** —— `startAttempt`（`:223` ✓，`++lease.attemptCount` 就在它里面 ✓）→ **重试仍会得到 `attemptCount > 0`、仍会被拒** ✓✓。这条属性是**结构性**保住的 ✓✓，不靠约定 ✓；而用例仍要写（见 `implement.md` ✓），因为"结构性"也是判断，判断要被测住 ✓。

## 契约（改后必须成立的，逐条可测 ✓）

1. **新请求的第一次 dispatch** → `replayed: false` ✓ → **一律放行** ✓（含只读项目工具与 `bash` ✓✓）。
2. **同一 dispatch 的真实重放**（我们的恢复路径重发同一件工作 ✓）→ `replayed: true` ✓ → **非幂等且未声明者仍被拒** ✓✓ —— **这是必须保住的安全属性** ✓，写成用例 ✓。
3. **幂等/键幂等的效果** ✓ → 真实重放中**照样放行** ✓（现状即如此 ✓，别改坏 ✓）。
4. **账本记录读不出来** ✓ → **任何尝试、任何类都拒** ✓（现状 ✓，别改坏 ✓）。
5. **`--continue` 的第二个新回合** ✓ → 同样是**新请求** ✓ → 放行 ✓✓（这正是 12 段里被锁的那件事 ✓）。

## 取舍与回退

- **取舍** ✓：把"是不是重放"的判断从**全局**收到**同一 dispatch 的范围**内 ✓ —— 代价是**需要一个新的标识**来界定"同一次 dispatch" ✗✓（哪一个是现成的：`toolCallId` ✓ / `executionId` ✓ / `stepId` ✓ —— **第一条切片先量这个** ✓）。
- **风险** ✗✓：若标识取得太宽 ✓ → **真实重放不再被拒** ✗（安全属性 2 失守 ✓）→ 因此**属性 2 必须先红后绿** ✓✓；若取得太窄 ✓ → 重放被漏判 ✗（保守方向 ✓，可容忍 ✓）。
- **回退** ✓：单点改动 ✓（旗标的来源 ✓），回退即恢复现状 ✓；**守卫与键不动** ✓，所以回退面**极小** ✓✓。
