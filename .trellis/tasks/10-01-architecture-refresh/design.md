# 架构优化：技术设计

## 1. 目标形状：四层，一个方向

| 层 | 现在有谁 | 允许依赖 |
|---|---|---|
| **L0 `core/`**（底） | 契约 / 模式 / 上下文 / 能力 / 账本 / 闸门策略 / 内生仪器 / dispatch | 只依赖 node 与自身 |
| **L1 机制** | `windows-runtime` · `jailer` · `project-provider` · `trellis-adapter` · `context` · `skills` · `web-access` · `capabilities` · `code-audit` | L0 |
| **L2 权威** | `plane-b`（**新**：held-out 切分 / 晋升门 / manifest / 成本） | L1、L0 |
| **L3 宿主** | `pi-adapter` · `extensions` · `commands` · `adapters` · `runtime.ts` · `cli.ts` | L2、L1、L0 |

**规则一句话：箭头只能向下。** 现状实测：111 个源文件里 26 个跨层，其中 **22 个是向下（允许）**、**1 个向上（违规，见 §3）**、其余在宿主机内部。

## 2. 运行时四层各自住哪（R2）

| 运行时部件 | 归属 | 理由 |
|---|---|---|
| **`gate`**（语法感知 / 跨调用累积 / 历史无关 + **每检测器一条确定性补救**） | **L0 `core/`**（未来 `core/gate/` 组） | 它是 loop 派发时被咨询的**底层机制**；现有成员：`action-policy.ts`、`authority.ts`、`capability-scope.ts`、`context-admission.ts`、`gate-conformance.ts`、`gate-limit.ts` |
| **`trace`**（完整性 / 保真度 / 捕获） | **L0 `core/`**（未来 `core/trace/` 组） | 它是**证据面的加强**，与既有 `execution-ledger.ts`(50 KB)、`checkpoint.ts`、`evidence-sarif.ts` 同组；既有内生仪器 `harness-*` 也在这里——保持一致比另立一层更重要 |
| **`jailer`**（ACL / 受限令牌 / 受限启动 + 助手脚本） | **L1 `src/jailer/`** | 它已是机制层（Windows 强制原语，与 `windows-runtime` 同族）。**不进 core 的理由**：它有副作用、会起外部进程，与"只依赖自�身"的底层不同性质 |
| **`plane-b`**（held-out 切分 / 晋升门 / manifest / 成本） | **L2 `src/plane-b/`（新）** | 它是**判分权威**：依赖 jailer 的强制，但不被 improver 依赖。独立成层让"**谁判它**"在目录上一眼看得见——这正是本项目的中心问题 |

## 3. 修那处反向依赖（R3）：证据与修法

**事实（实测）**：`src/core/workspace-policy.ts:4` **值导入**（非 `import type`）`../project-provider/lock.ts` 的 `withProjectMutationLock`——底层反向依赖机制层。

**关键读数**：`lock.ts` **50 行 / 1,913 字节**，import 只有 `node:fs/promises` 与 `node:path`——**它与 provider 毫无关系**，只是"恰好住在那儿"。使用者：core 一处（`workspace-policy.ts`）+ provider 三处（`native-provider.ts`、`native-sessions.ts`、`native-state.ts`），并从 `project-provider/index.ts` 再导出（`tests/project-provider.test.ts` 从那里 import）。

**修法：把 `lock.ts` 下移到 `core/`**（拟名 `src/core/project-lock.ts`）。
**为什么不选另一种修法**（把锁注入 `workspace-policy`）：它是纯函数模块，**没有合成根可以注入**；而 lock 本身是**基础设施原语**，下移之后方向自然只剩"机制层 → 底层" ✓。
**代价（可核对）**：4 处 src import + `project-provider/index.ts` 的再导出 + 1 处文档引用（`core/effect-store-file.ts` 描述了该锁的行为）+ 1 处测试 import。

## 4. 16 条"无人到达"的处置（R4）

| 模块 | 处置 | 理由 / 何时 |
|---|---|---|
| `src/jailer/*.ts`（**6**） | **接线** | S1：loop 的派发路径 import `launchJailed`。**接线完成 = 删条目**（该文件自己写着这条规矩） |
| `core/loop-runner.ts`、`core/checkpoint.ts` | **接线** | S1 的参照 loop 就是 `loop-runner`；`checkpoint` 只经它到达 |
| `adapters/loop-pi-agent-core.ts`、`adapters/loop-scripted.ts` | **保留为参照** | 记录的理由已足（"reachable only from the island below"） |
| `core/harness-axes.ts`、`failure-reading.ts`、`harness-round.ts`、`harness-corpus.ts` | **保留** | 它们是**读数**，被 `scripts/harness-*.mts` 与各自测试消费，harness **故意**不达 |
| `core/dispatcher.ts`、`core/dispatch-policy.ts` | **S2 决定：接线或连同测试退休** | 有测试消费者（`tests/core.test.ts:8,10`、`tests/strategy-evaluation.test.ts:4,5`），但**没有任何 milestone 声称它们**；判据 = 运行时是否走 dispatch 这条路。**不留在"没人到达也没人认领"的状态** |

## 5. 两项大改造，以及它们各自的前置条件（顺序的依据，不是风格）

**D1 `core/` 子层化**（`core/*.ts` → `core/<组>/*.ts`，组 = §1 的职责组）
会同时需要改：**`harness-surface.yaml` 里 8 条 `core/*.ts` 路径** + **测试里 46 条 `core/*.ts` 路径** + **`harness-reachability` 的按路径 allow-list**。
**前置条件**：**S1 接线完成、surface map 与 allow-list 稳定**——因为那三样正是 S1（接线 `loop-runner`、删 jailer 条目）与 S2（组件面）同一轮要改的**同一批文件**。
**先做的一步（零风险）**：在规格里写出**逻辑分组表**（不移动文件）——那张表就是 D1 的蓝图，有了它，D1 只是机械执行。

**D2 拆 `pi-adapter/extension.ts`**（3602 行 / 227 KB / 59 import / 48 处注册 / 26 导出）
**不撞**上面那三样（只动 `pi-adapter/**`）。**前置条件**：**先做接缝分析**——把 48 处注册聚类成 3–5 组（工具 / 命令 / 钩子 / UI / 上下文编译），按组拆成模块，`extension.ts` 退化为装配与转发。
**所以 D2 可以先于 D1**：它的前置条件是本任务就能交付的（接缝分析），而 D1 必须等 S1。

## 6. 风险与回滚

| 风险 | 处理 |
|---|---|
| 修完方向后，后来的读者又把它当"允许的例外" | §1 的表要**进规格**（R1），而不是只活在本文件里 |
| 移动文件打断引用 | 本仓自己记过（归档打断引用、读起来仍正常）：**每步替换都断言出现次数**，并用 `git grep` 复核零残留 |
| D1 与在飞程序撞车 | 前置条件写成**可核对**的："接线完成 + surface/allow-list 稳定"，不写"以后再说" |
| 把"优化"做成重写 | 本任务**不写产品代码**除 §3 那一处移动；其余是声明与分组（零风险） |

## 7. 那页《使用期架构》：内容、位置与纪律（自己定的四点）

**位置**：`.trellis/spec/backend/personal-agent-use-time-architecture.md`，从 `personal-agent-runtime.md`（router）route 出去，并在 `spec/backend/index.md` 登记。

1. **为什么不写进 router**：router 有 **8 KiB 硬上限**且只做路由（"router shape" 被测试断言）；它现在是 4,459 B，加一段正文就会挤掉路由表的余地。
2. **为什么放 `backend/` 而不是 `guides/`**：它描述的是运行期**所有权**（谁在什么时候被调用），与其它 backend 规格同类；`guides/harness-loop-turn.md` 是"怎么做"的操作指南，分工不同。
3. **七节内容**：① **拥有者**（Pi 拥有 loop；`core/loop.ts` 只是契约、`loop-runner.ts` 无人到达）② **18 个挂载点表**（事件 → 何时 → 做什么，带 `extension.ts` 行号）③ **闸门的执行点**与它的两个半边（先名字后参数，参数那半在输入定稿后才跑）④ **进程边界**（工具与子代理是真子进程；工作区快照与项目变更锁）⑤ **信任分级**（模型 < agent 脚本 < 工具层半可信 < 人 < Plane B）⑥ **证据落盘与跨会话**（`execution.jsonl`、checkpoint、`.dove/tasks/<id>/convergence.json`）⑦ **两处空白**。
4. **规格纪律（这条最重要）**：只写**现在就有**的东西；axi 会改的那一格（loop 归自己、Plane B 在 agent 够不到处）**标注为未实现并指向 `plan-v8.md`**——否则就站到了语料里唯一不存在的位置：声明了做不到的能力。
5. **顺序**：它零风险、不撞 S1，且正是被连着问的那件事 → **排第 0 步**。
