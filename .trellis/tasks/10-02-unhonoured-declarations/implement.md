# 执行清单

> ## 进度与恢复点（2026-10-02，会话中断于此）
>
> **R1 ✅ 已落地并提交**（`50008d4` ✓）：红 **34/35** → 绿 **35/35** ✓；`scope.exclusions` 现在被带上模式 ✓ 并在边界拦 ✓，目标从**宿主已解析的 `target`** 与 `target_argument` **两处**取 ✓。
> **我自己的一个错，记在这里** ✓：提取、接口字段、检查三样都写好了 ✓，却**从没把字段挂到返回的 mode 对象上** ✗ —— 三行探针（而不是又一次猜 ✗）找到的 ✓。**同一个缺陷类，出现在修它的补丁里** ✓。
>
> **R2 / R3 / R4 / 门：已写好、已证明红、未落地** ✅→ 全部在 `stash@{0}` 里 ✓（`git stash list` 第一条 ✓，消息自述内容 ✓）。里面有：
> - `src/core/work-mode.ts`：`grant_graph` / `evidence` / `coordination` 四条点名拒绝 ✓、`session.budget` 的兄弟字段拒绝 ✓、`stop.on` 校验（合法值取自 `LoopStopReason` 的 `completed|maxTurns|stopped|providerError` ✓，**不另立第二份清单** ✓）、`grant` 名在任何语义下都必须可解析 ✓；
> - 三个模式的迁移 ✓（`session` 只留 `turns` ✓、`evidence`/`coordination` 删掉并**在原位写明损失** ✓、`stop.on` 映射到真的种类 ✓、`code-audit`/`trading` 的悬空 `grant` 名去掉 ✓）；
> - `tests/work-mode.test.ts` 的 **5 条用例**（已红 ✓，50/55 ✓）。
>
> **恢复点：`git stash pop`** ✓ → 然后**只剩一件事**：那 29 条失败的测试是**断言着已移除声明**的旧期望 ✓（`pentest-mode` / `code-audit-mode` / `trading-mode` / `host-work-mode` / `gates` / `action-policy` / `axi-turn` ✓）—— 逐条把期望改成"现在的文件" ✓，而不是把声明加回去 ✗。
>
> **再往后的三步**：② 规格补上新的拒绝（`personal-agent-mode-format.md` 的错误矩阵 ✓ + `personal-agent-framework-core.md` 的字段表 ✓）；③ 门的扩展（`scripts/**` 只查路径能解析 ✓ + `mode-behaviour-map.mts` 的注释去掉行号 ✓）；④ 收尾的全范围 `trellis-check` ✓。
>
> **一条新发现，留在这里**（同一缺陷类，本任务未决定 ✗）：三个模式的 `session.memory_scope` **也没有读者** ✗ —— 已在三个文件里就地标注 ✓，但它属于"控制还是记录"的取舍，没有在本任务的路线里定过 ✓。

## 顺序（从最便宜、最该先修的 R1 开始）

1. [ ] **R1 `scope.exclusions`（兑现）**
   - [ ] 红测试：一条 `[KNOWN GAP]` 用例**反转**它（仓里的指令：*"Invert this test when exclusions are enforced; do not delete it."* ✓）→ 一个排除掉的 target 被**拦住** ✓（今天它被放行 ✗）；
   - [ ] `work-mode.ts`：把 `scope.exclusions` 带上 `WorkMode` ✓；
   - [ ] `action-policy.ts`：解析出的目标（id 与地址 ✓）命中排除清单 → block + 补救 ✓；
   - [ ] 两个模式**保留**它们已有的 `exclusions` ✓（从此真的生效 ✓）。
2. [ ] **R2 `grant_graph`（拒绝）**
   - [ ] 红测试：声明它的模式 → 加载被拒且**点名** ✓；
   - [ ] 照 `expires` 的形态：键留在允许集合内 ✓ + 一条解释 ✓；
   - [ ] `modes/pentest/governance.yaml:12` 删掉该行 ✓ + 原位写明（损失：无 ✓，它从未生效 ✓）。
3. [ ] **R3a `session.budget.turns`（接线）**
   - [ ] **先证明可达** ✗：Pi 桥的 `maxTurns` 是否在真实运行路径上 ✓（可达性走查 ✓）；不可达 → **如实记为限制** ✓，不假装 ✓；
   - [ ] 把模式里的数字喂给那个**已有的**界 ✓（绝不新增第二个 ✓）；
   - [ ] 红测试：模式声明一个回合预算 → 跑到界就停 ✓（今天不生效 ✗）。
4. [ ] **R3b `stop.on`（校验）**
   - [ ] 合法值来自 `LoopStopReason` 的**那一份**清单 ✓；
   - [ ] 红测试：`stop.on` 里有一个运行时不会产生的种类 → 加载被拒且点名 ✓；
   - [ ] `modes/pentest` 的 `stop.on` 改成真的种类 ✓（没有对应物就删 ✓）。
5. [ ] **R3c `evidence` / `coordination`（拒绝）**
   - [ ] 红测试：声明它们 → 加载被拒且点名 ✓；
   - [ ] `modes/pentest` 删掉这两块 ✓ + **原位写明损失** ✓（不再声明证据保留与协调节奏 ✓）。
6. [ ] **R4 grant 名（兑现）**
   - [ ] 红测试：`limit`/`none` 模式下名字不可解析 → 加载被拒且点名 ✓（今天它被静默忽略 ✗）；
   - [ ] 保留"不为非 conformance 加载文档"的早退 ✓（它自己的理由仍然成立 ✓），只加**名字必须可解析** ✓；
   - [ ] `code-audit` / `trading`：补真文档 **或** 删名 ✓（这是一次产品改动 ✓，两种都记读数 ✓）。
7. [ ] **门（扩展 + 让引用不再会烂）**
   - [ ] `scripts/mode-behaviour-map.mts` 的注释**去掉行号** ✓，只点函数名 ✓；
   - [ ] 把引用检查扩到 `scripts/**` ✓（**只查路径能解析** ✓，不要求行号 ✓）；
   - [ ] 红测试：`scripts/` 里指向一个不存在的路径 → 门变红 ✓。
8. [ ] **收尾：全范围 `trellis-check`** ✓（上一轮两次都证明：三绿灯之下仍可有阻断缺陷 ✓，而它抓到的东西**全部落在门看不见的地方** ✓）。

## 验证

```
npm run typecheck        # 0
npm test                 # 0 fail（通过数写 readings.md，不写在这里）
npm run test:installer   # OK
```

- 每一条的先红后绿读数各一条 ✓（红若是**重建**出来的 ✓，必须标注 ✓）
- R1 的红来自仓里那条自带指令的用例 ✓ —— **反转，不删除** ✓

## 风险文件与回退点

- `src/core/work-mode.ts`（带两个值 ✓ + 三条拒绝 ✓ + 一条校验 ✓）· `src/core/action-policy.ts`（排除检查 ✓）· `modes/{pentest,code-audit,trading}/governance.yaml` · `scripts/mode-behaviour-map.mts`
- 回退点：R1 / R2 / R3 / R4 / 门，各自一次提交 ✓ 互不依赖 ✓（除 R3 的三小项共用 `work-mode.ts` ✓）。

## 提交前

- [ ] 每处**损失**都写在**读者会遇到的地方** ✓（不只写在读数里 ✓）
- [ ] R3a 的接线**证明了可达** ✓，或如实记为限制 ✓
- [ ] 没有新增第二份清单 ✓（`stop.on` 用 `LoopStopReason` ✓、`turns` 用已有的界 ✓）
- [ ] 注释里没有新增行号引用 ✓
