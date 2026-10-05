# 执行计划：产品定义页

> 顺序不可交换：**标题定稿 → 四处同步 → 填内容 → 修正 → 门禁 → 提交**。每一步有独立验证命令和回退点。

## P0 · 先量基线（不许跳过）

```powershell
git status --porcelain          # 本仓有 5 个 task 的归档移动尚未暂存：不要动它们
npm run typecheck
npm test
npm run test:installer
```

把四条读数（含时间）**原样**写进 `readings.md`。已知本仓此刻有 2 条与本轮无关的 fail（一条数 `agent_project_context` 的索引长度、一条数规格页的 mount-point 引用）——**基线里如实记下**，否则 P6 的对比没有意义。

**回退点**：无（只读）。

## P1 · 标题定稿

按 `design.md` §2 的 9 个字符串，先只写骨架：`# ` 标题 + 9 个 `## ` 标题 + 每节一句断言占位。

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-product.md -Pattern '^## '
```

输出必须与清单**逐字、同序**一致（含 `How to check this page` 不带编号）。

**回退点**：骨架可整段重写，不牵动其它文件。

## P2 · 四处同步（顺序敏感）

1. 页面骨架已就位（P1）
2. `tests/spec-context-budget.test.ts`：`routedSpecNames` 加 `"personal-agent-product.md"`，**位置 = 它在 router 里的位置**；`expectedHeadingsBySpec` 加对应 key 与标题数组
3. `.trellis/spec/backend/personal-agent-runtime.md`：路由表 +1 行（**不新增 `##`、不加围栏代码块**）
4. `.trellis/spec/backend/index.md`：Guidelines Index +1 行

```powershell
node --import tsx --test tests/spec-context-budget.test.ts tests/document-drift.test.ts
```

**回退点**：三个文件各自独立回退；若 `deepEqual` 失败，**只改 router 或只改数组之一**，不要同时动。

## P3 · 填内容（带锚点 + 三选一标记）

逐节填：§1 是什么/给谁 · §2 用户可见循环 · §3 可触达的面 · §4 轴对照表 · §5 承诺与执行者 · §6 尚未证明 · §7 axi · §8 非目标。

必读锚点来源：

| 来源 | 取什么 |
|---|---|
| `README.md` | 用户面叙述：安装、模式、命令、数据位置、维护 |
| `10-03-first-contact-scenario/findings.md` | P1–P13 十三条实测发现（产品面缺口的原始读数） |
| `10-05-whole-flow-end-to-end/readings.md` | "整条流程未在一次运行里证明"与扩展状态行 |
| `10-03-day-two-walk/readings.md` | 第二天续接的读数状态 |
| `personal-agent-use-time-architecture.md` §5/§6/§7 | 信任阶梯、证据落点、两处空白 |
| `directory-structure.md` | 层与那条向上 import |
| `modes/*/MODE.md`、`modes/*/permissions.yaml` | 已发布模式的声明 |
| `src/cli.ts` | 15 个 CLI 子命令（数出来，别记） |

**规则**：不能锚的句子**删掉**。页面短是允许的；有节无内容是**不允许**的（空的节会让产品面读起来比实际完备）。

```powershell
node --import tsx --test tests/document-drift.test.ts   # 点名的路径必须存在
```

**回退点**：按节回退；页面整体回退不影响 P2 的四处同步。

## P4 · §7 axi（按 D5）

只写三样：**实现方式**这一句、**阶段计划是 task 工件**这一句、**按名字**的引用。

`plan-v8.md` **不进注入清单**：实测它 84 001 B，超过 `context_injection.max_file_bytes`（32 768），注入只会拿到被截断的半份计划（`task.py validate` 的警告）。§7 只需要它 §1.1 的一句话与 §10 的非目标，**按需手读**，不靠注入。

```powershell
Select-String -Path .trellis\spec\backend\personal-agent-product.md -Pattern '\.trellis/tasks'
```

期望**无输出**（页面里不出现会随归档失效的具体路径）。

**回退点**：该节独立。

## P5 · 修正向的编辑（M2/M3/M5/M6）

```powershell
# M3：节号引用改实测值，理由写原地
Select-String -Path .trellis\tasks\09-30-axi-program\prd.md -Pattern '§5\.'
# M2：plan-v8 的已作废形状，就地一句标注
Select-String -Path .trellis\tasks\09-30-axi-program\plan-v8.md -Pattern '^### 5\.1|^### 5\.4'
```

- `prd.md:72`：`§5.2 的"新仓目录树"` → 实测 `§5.1`，并写明"原引用错在节号，同仓决定使其整节作废"。
- `plan-v8.md` §5.1 / §5.4 附近：一句就地标注。
- `README.md`：加一条指向 `.trellis/spec/backend/personal-agent-product.md` 的交叉引用；产品页开头写 A-6 的权威句。

**回退点**：三处各自独立，都是文本改动。

## P6 · 门禁

```powershell
npm run typecheck
npm test
npm run test:installer
```

写进 `readings.md`，并与 P0 基线**逐条对比**：只允许出现"文档两条由红转绿"这一种变化；出现别的变化就回去查，不许把新红算成"既有失败"。

## P7 · 提交（走 Phase 3.4 的批处理流程）

工作提交在前、归档与 journal 之后；**不 amend、不 push**。提交信息风格照最近历史：`docs(spec): …` / `fix(docs): …`。

## 刻意不做（写给评审）

- **不为页面的"三选一标记"新增测试**。标记是散文约定，页面自己在 §How to check this page 里写明"真实性由锚点保证，不由测试保证"；为它写解析器是给一个没有读者的仪器。
- **不往 AGENTS.md 规则表加行**（D6）：产品页不是一条规则，`test:`/`suite:`/`type:`/`gate:`/`verifiedBy:` 语法里没有能指的执行者，硬加一行会让 `document-drift` 的语法检查无处可指。
- **不碰** `10-03` / `10-05` 里的独立缺陷（编辑工具缺失、15 分钟超时、bash 挂起）——只作为事实被引用。
