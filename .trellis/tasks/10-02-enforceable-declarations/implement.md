# 执行清单

**测试先行**：每一处都要有一条"改前会红"的断言。R1/R3 的红是**拒绝**（今天它不拒绝 ✗）；R2 的红是**放行**（今天它不拦 ✗）。

## 顺序

1. [ ] **R1 `expires`**（先做，最小且先例现成）
   - [ ] 红测试：一个声明 `authority.expires` 的模式 → 加载**被拒**且消息**点名 `expires`**（今天它会正常加载 ✗）；
   - [ ] `work-mode.ts`：把 `expires` 从 `AUTHORITY_FIELDS` 移出，并照 `windows` 的句式写解释；
   - [ ] 三个 `modes/*/governance.yaml` 删掉该行；
   - [ ] **先查** `host-work-mode.test.ts` 的夹具是否声明它（`writeFixtureMode` 里有 ✗）——有则一并处理；
   - [ ] 读数：**损失 = 无**（它从未生效过）。
2. [ ] **R3 无人见证的技巧名**
   - [ ] 红测试：声明 `excluded_techniques: [dos, social-engineering]` 的模式 → 加载**被拒**，消息点名那个名字并说明"运行时见证不了它"（今天它会正常加载、而那个名字惰性 ✗）；
   - [ ] 同样在 **grant 侧**（`authority.ts`）加一条：grant 的 `excluded_techniques` 里有无法见证的名字 → 拒绝并点名；
   - [ ] `modes/pentest/governance.yaml:29` 与 `engagements/example-engagement/authority.yaml:34` 去掉 `social-engineering`；
   - [ ] **读数：损失 = 真实**——该模式与 example 的 conduct 声明变弱，写明"我们不再声称屏蔽社工手法，因为运行时无法见证它"。
3. [ ] **R2 速率上限**（兑现）
   - [ ] 红测试三条：① 一秒内第 `cap+1` 次 → 被拒、理由点名 cap；② 跨秒界后 → 放行；③ 低于 cap → 放行。**全部用 `invocation.at`，不用挂钟**；
   - [ ] `action-policy.ts`：环形缓冲记 `invocation.at`，算出上一秒内的次数；
   - [ ] `authority.ts`：`AuthorityRequest` 收下这个计数，与 grant 的 `max_requests_per_second` 比较（照 `intensity` 的分工）；
   - [ ] 复查既有套件：若有测试在假设"连发不限速"，逐个判断（**那不是回归**），并记读数。
4. [ ] **R4 会大声腐烂的用例**：已发布的模式与 example **不得声明运行时无法兑现的控制**（形状照 `pentest-mode.test.ts` 的窗口用例）。
5. [ ] **收尾：全范围 `trellis-check`**——本仓的用法已验证：上一次全范围检查抓到 12+ 条，**全部落在门看不见的地方**。

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
