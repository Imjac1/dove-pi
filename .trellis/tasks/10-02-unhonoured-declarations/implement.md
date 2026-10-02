# 执行清单

**先红后绿 + 先证明可达** ✓。每一处都要有一条"改前会红"的断言 ✓；R3a 的接线在动手前先证明目标在真实运行路径上 ✓。

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
