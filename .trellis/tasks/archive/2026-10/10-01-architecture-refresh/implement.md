# 架构优化：执行清单

**每一步一次提交，先跑门禁。** 判据见 `prd.md`，设计见 `design.md`。

## 第 0 步：交付《使用期架构》一页（AC-7，零风险，先做）

- [ ] 新建 `.trellis/spec/backend/personal-agent-use-time-architecture.md`，按 `design.md` §7 的七节写：拥有者 / 18 个挂载点 / 闸门执行点 / 进程边界 / 信任分级 / 证据与跨会话 / **两处空白**。每条运行期断言带 **`file:line`** 锚点。
- [ ] 在 `personal-agent-runtime.md`（router）的路由表里加一行；在 `spec/backend/index.md` 里登记（**index 必须列出该目录的每个规格**）。
- [ ] **还要改 `tests/spec-context-budget.test.ts` 里那份"声明的 route 清单"**——该文件有一条 *"declares exactly the existing routed runtime specifications"*（L91）：只加文件不改它，这条会红。同一文件另有 L80（预算）、L98（router 只放路由结构）、L105（顶层契约清单）。
- [ ] 过三处既有检查：
      `node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts`
      （新页 ≤ 24 KiB、router ≤ 8 KiB、route 存在、index 与目录一致）
- [ ] 判据：两个测试全绿；**门禁三条不降**；页内**没有**把未实现的东西写成现状。
- [ ] 提交。

## 第 1 步：把声明对齐到真实树（AC-1，零风险）

- [ ] 更新 `.trellis/spec/backend/directory-structure.md`：
  - `Directory Layout` 补齐**未提到的 6 层**：`adapters/`、`code-audit/`、`commands/`、`jailer/`、`skills/`、`web-access/`（真实 14 个目录，现在只列 8 个）；顺带核对根文件（`runtime.ts`、`project-status.ts`、`managed-install-status.ts`）是否该进布局。
  - 写入 **§1 的四层与"箭头只能向下"**（R1）。
  - 写入 **§2 的运行时四层归属**（R2／AC-3 的一半）。
- [ ] 判据：`document-drift` 与 `spec-context-budget` 不红；**门禁三条不降**。
- [ ] 提交。

## 第 2 步：修那处反向依赖（AC-2）

- [ ] 把 `src/project-provider/lock.ts` 移到 `src/core/project-lock.ts`（50 行，只依赖 node 内建——见 `design.md` §3 的证据）。
- [ ] 逐处改 import，**每处断言出现次数**：`core/workspace-policy.ts`、`project-provider/native-provider.ts`、`native-sessions.ts`、`native-state.ts`、`project-provider/index.ts` 的再导出、`tests/project-provider.test.ts` 的 import、以及 `core/effect-store-file.ts` 里的文档引用。
- [ ] 判据：`git grep` 里**零残留**指向 `project-provider/lock`；`core` 不再有任何指向上层的 import（用一次扫描证明，把读数记进 `readings.md`）。
- [ ] 提交。

## 第 3 步：16 条"无人到达"各给处置（AC-4）

- [ ] 按 `design.md` §4 的表，把处置写进 `.trellis/harness-surface.yaml` 相邻的**说明处**（或在 allow-list 条目里补一句"何时删"），让处置**可核对**而不是只写在任务文档里。
- [ ] 判据：`harness-reachability` 不红（条目与理由一一对应）；门禁不降。
- [ ] 提交。

## 第 4 步：把 `plan-v8 §5` 与规格对齐（AC-3 的另一半）

- [ ] `plan-v8.md` 的 §5 原是给**另一个仓**写的开发设计：按形状决定重基（去掉"新仓目录树/迁移"），并把**运行时四层的归属**改成与 `directory-structure.md` **同一种说法**。
- [ ] 顺带解掉已记的缺陷：`plan-v8.md` **81,319 字节 > 注入上限 32,768**，作为 implement 上下文会被截断、**截掉的正好是 §4/§5**——按节拆分 + 让清单指向"节"。
- [ ] 判据：`plan-v8` 内不再出现与新层位冲突的旧说法；拆分后每一节都 < 32,768 字节，且 `implement.jsonl` 指向"节"。
- [ ] 提交。

## 第 5 步（**有前置条件，不在本任务完成**）：两项大改造

- [ ] **D2 拆 `extension.ts`**：先交**接缝分析**（48 处注册聚类成 3–5 组 + 各组依赖），再接缝拆分。**前置条件不需要 S1**（只动 `pi-adapter/**`）——所以它可以先做。
- [ ] **D1 `core/` 子层化**：前置条件 = **S1 接线完成 + `harness-surface.yaml` 与 allow-list 稳定**（可核对）。先交**逻辑分组表**（第 1 步就会写进规格），再移动文件。
- [ ] 两项的前置条件写在各自的清单条目里，**写成可核对的**,不写"以后再说"。

## 收尾

- [ ] 三条门禁与开工前逐项比：`typecheck` 0 · `test` **822/820/0/2** · installer **141**。
- [ ] 读数（含"零残留"的 `git grep` 结果、`core` 反向依赖扫描结果）写进本任务 `readings.md`。
- [ ] 失败与未做项如实写入；承诺降级要写明。
