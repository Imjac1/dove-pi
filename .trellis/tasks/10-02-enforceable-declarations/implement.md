# 执行清单

**测试先行**：每一处都要有一条"改前会红"的断言。R1/R3 的红是**拒绝**（今天它不拒绝 ✗）；R2 的红是**放行**（今天它不拦 ✗）。

## 顺序

1. [x] **R1 `expires`** ✅（提交 `deb2cd0`）：`work-mode.ts` 里新增一条点名拒绝（**保留在键集合内**，照 `windows` 的形态 ✓）；三个模式删行并写明原因 ✓；host 夹具改为**只在被要求时**才写该字段 ✓（否则所有夹具用例都会落到拒绝之后 ✗）；红测试 = 反转那条 `[KNOWN GAP]` 用例（33/35 → 148/148 ✓）。
2. [x] **R3 无人见证的技巧名** ✅（同一次提交）：模式侧按 `WITNESSED_TECHNIQUES` 点名拒绝 ✓；`modes/pentest` 与 example 去掉 `social-engineering` 并在原位写明**这是真实损失** ✓。
3. [x] **R2 速率上限** ✅（提交 `b992844`）：判定在 `authority.ts` 的 grant 约束处（紧邻 `intensity` ✓）、计数在 `action-policy.ts` ✓；请求里带**已计数**的字段 ✓；窗口用 `invocation.at`（不用挂钟 ✓）；红测试逼出一个真 bug（见 `readings.md` ✓）。
4. [x] **R4 这一类不得复发** ✅ —— **由 R1/R3 本身满足，故不另写重复用例**：两处"声明了却兑现不了"的东西如今**在加载时被点名拒绝** ✓，所以"已发布的模式与 example 不得声明它们"是**结构上成立**的 ✓，而它的先红后绿读数就是 AC-4 要的那两条 ✓（红：它被当回事地加载了 ✗；绿：它被点名拒绝 ✓）。**这不是省了一条测试，而是承认那条测试已经存在** ✓。
5. [ ] **收尾：全范围 `trellis-check`** —— **唯一未做的一步** ✓。本仓的用法已验证：上一次全范围检查抓到 12+ 条，**全部落在门看不见的地方** ✓。

## 验证

```
npm run typecheck        # 0
npm test                 # 0 fail（通过数写 readings.md，不写在这里）
npm run test:installer   # OK
```

- 每条 R 的**先红后绿**读数各一条
- R4 的用例：在被修的声明上先红、修完绿

## 风险文件与回退点

- `src/core/work-mode.ts`（键集合 + 一条新拒绝）· `src/core/authority.ts`（请求字段 + 判定）· `src/core/action-policy.ts`（环形缓冲）
- `modes/{code-audit,pentest,trading}/governance.yaml` · `engagements/example-engagement/authority.yaml`
- `tests/host-work-mode.test.ts`（夹具若声明 `expires`）
- 回退点：R1 / R2 / R3 各自一次提交，互不依赖。

## 提交前

- [ ] 三处**损失**都写了（R1 写"无"）
- [ ] R2 的窗口只用 `invocation.at`（可测、可复现）
- [ ] 没有新增标签，也没有新增模式字段
