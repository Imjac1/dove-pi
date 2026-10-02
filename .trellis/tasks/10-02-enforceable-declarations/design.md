# 设计：兑现一处、拒绝两处

## 边界：每一处落在哪

| # | 处置 | 落在哪个模块 | 为什么是那里 |
|---|---|---|---|
| R1 `expires` | **拒绝** | `src/core/work-mode.ts` 的 `AUTHORITY_FIELDS` + 一条点名解释 | 照 `windows` 先例——同一个日历概念，同样属于 grant 不属于模式 |
| R3 无人见证的技巧名 | **拒绝** | `src/core/work-mode.ts`（模式侧）**与** `src/core/authority.ts`（grant 侧） | 两处都能声明 `excluded_techniques`，所以两处都要拒绝，否则关掉一边就是绕过 |
| R2 速率上限 | **兑现** | **状态在 `src/core/action-policy.ts`，判定在 `src/core/authority.ts`** | 会话状态只活在策略的累积器里；而"grant 是否解析"只能由授权决定 |

## 数据流（R2）

```
调用意图
  → 策略读到本会话最近的运行时刻（环形缓冲，会话级）
  → 算出"上一秒内已运行多少次"
  → 随 AuthorityRequest 传给授权（照 intensity 的做法：调用方数、授权判）
  → 授权比较 recent + 1 > constraints.max_requests_per_second
  → block（带补救：等窗口过去，或经 grant 正式提高上限） / allow
```

**窗口用 `invocation.at`，不用 `Date.now()`**：调用方给的时刻让判定可复现、可测——这正是 `intensity` 已经采用的形状（它读调用携带的 `accumulatedIntensity`）。

## 契约变更

- `AuthorityRequest` 增一个**已计数的**字段（如 `requestsInLastSecond`）：**调用方数、授权判**——与 `intensity` 同一分工，不新增第二套。
- `ActionPolicy` 增一个环形缓冲：`recordRun` 已经存在，只需额外记下 `invocation.at`。
- **不新增标签**：grant 约束的既有类别是 `conformance`，沿用。
- **不新增模式字段**：`max_requests_per_second` 已经在 schema 里，只是没人读。

## 兼容与迁移

- **R1/R3 是拒绝**：三个 `modes/*/governance.yaml` 与 `example-engagement/authority.yaml` 各自删掉不能被兑现的声明。**`modes/pentest` 会拒绝加载**，直到它删掉 `social-engineering`——这是有意的（声明要么被执行、要么被拒，不能安静地挂着），**损失记进 `readings.md`**。
- **R2 是新增执行**：`max_requests_per_second: 5` 从今天起真的生效 → 可能让某些"快速连发"的既有测试变红。**那不是回归，是测试在假设一个不存在的自由度**；若出现，逐个判断并如实记。

## 取舍

- **兑现 `expires` 而不是拒绝**：模式会按日期拒绝加载，而且**会再次腐烂**（需要一条会腐烂的用例兜住）→ 拒绝更小、更真。
- **兑现 `social-engineering`**：需要一个可检的语法签名，而它没有 → 拒绝是唯一诚实的选择。
- **兑现速率上限**：它是真控制，且状态载体已在（策略的会话累积器）→ 用户已选兑现 ✓。
- **不新增标签/字段**：本设计只让 schema 里已有的东西开始生效，外加一个**调用方数出来**的计数。

## 回退

- R1/R3 与 R2 **相互独立**，各自一次提交，`git revert` 即回退。
- **唯一需要先说清的回退**：R3 会让一个已发布模式拒绝加载 ✗ → 如果这被判定不可接受，回退点是"只在 grant 侧拒绝、模式侧放行"✗ → **但那会留下模式侧的惰性名，等于退回今天的缺陷**，所以我不推荐，只把它写在这里备查。
