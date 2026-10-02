# 读数：锚点门与它修掉的东西

## 计划里的第 1 步（R7 + R1）

**先红后绿，两条读数都在。**

### 红（门在陈旧锚点上的第一次运行）

```
✖ cites only paths that resolve, and lines that exist
   5 citations cannot be followed
```

### 绿（修完引用之后）

```
✔ cites only paths that resolve, and lines that exist          (29 citations read)
✔ reports a citation whose path does not resolve, and accepts one that does   ← 门自己的敏感度自证
```

## 门的能力边界：一次**撤回**，如实记录

第一版还判"**这一行点名的符号是否出现在被引行上**"，跑完就**撤回**了。理由是量出来的：

- 这些页面做的是**成组声明**——一行点四个类型、引四行（`use-time:12` 的契约行）——**名字与行不是一对一**；
- 于是这条规则把**三处审计已确认正确**的引用判红 ✗（`:90`、`:92`、以及那行契约）；
- **带假阳性的门比没有门更糟**：这个仓自己说过，人们会把关掉的围栏当保护——对检查也一样。

**留下的**是**不用猜就能判**的部分：**被引路径必须能解析、被引行必须存在** ✓。它恰好抓住了那 6 处陈旧锚点里的一类——**读者跟不下去的引用**（路径是缩写、或文件已移动）✓。

## 过程中门自己的两个 bug（都是它自己的假阳性）

| bug | 症状 | 修法 |
|---|---|---|
| 默认遍历**仓根** | 读到 936 条引用（含 `.trellis/tasks/**`、`node_modules` ✗），而规格里只有 58 条 | 默认只走 `.trellis/spec` ✓ |
| 路径正则**首字符不允许 `.`** | `` `.trellis/spec/guides/x.md:11` `` 被截成 `trellis/spec/...` ✗ → 报"无法解析" ✗ | 首字符类加入 `.` ✓ |

两条都记在这里，因为它们是同一个教训的实例：**门会犯错，而它的错法是把对的东西判红**。

## 这一轮修掉的引用（改前 → 改后）

| 位置 | 改前 | 改后 |
|---|---|---|
| `capability-runtime.md:75` | `cli.ts:360` / `:371` | `src/cli.ts:363` / `:374`（**数字也是陈旧的**：360 是空行、371 是 `--args` 守卫） |
| `use-time:78` | `extension.ts:65` | `src/pi-adapter/extension.ts:65` |
| `use-time:79` | `extension.ts:44` | `src/pi-adapter/extension.ts:44` |
| `use-time:85` | `../guides/harness-loop-turn.md:11` | `.trellis/spec/guides/harness-loop-turn.md:11` |
| `framework-core.md:61` | 与 lease 检查无关的 `:2301` | `:2650`（该守卫真正的行） |

**另有一处语病是这一轮我自己打出来的**（把一句好好的话改成了 `test:installer states the same precondition:` ✗），已在同一次提交里修回 ✓——记下来，因为"改一处、坏一处"正是这类工作最容易留下的东西。

## 门**抓不到**什么（写在前面）

**行号本身仍然可能陈旧** ✗：`use-time:48`/`:49`、`use-time:59` 这三处（审计已确认行号过期）**它判不了**，因为判它需要"引用与声明一一对应"，而那是**页面的写法**问题，不是检查的问题。三条出路写在 `implement.md`，本任务尚未决定。

**下一步（本任务内）**：R1 剩余 3 处行号 + R2 两处假声明 → R3 三处陈旧计数 → R5 层页计数 → R6 数字门 → R4 plan-v8 重基。

---

## 第二轮：R1 剩余 3 处 + R2 两处 + R3 两处 + R5

**先取证，再改——两处"偏差"在这一轮被证伪** ✗：

| 审计说 | 实测 | 结论 |
|---|---|---|
| allow-list 注释的 "the six shrinks" 陈旧 | 实际有 **6 个**序数（third…eighth；`eighth` 被换行拆开，我第一次只数到 5） | **原文正确**，不改 ✓ |
| `use-time:12` 的 "all `interface` / `type`" | `loop.ts` 除 17 个类型外**还导出一个函数** `normalizeGateDecision` | **真偏差**，已改 ✓ |

**改掉的**：

| 位置 | 改前 → 改后 |
|---|---|
| `use-time:47` 名字半 | `:2624`-`:2628` → **`:2629`**（`denyDecision` 的实际行） |
| `use-time:48` 闸门返回 | `:2632` → **`:2648`** |
| `use-time:49` 参数半 | `:2626`-`:2628`（**与第 2 条同址，是重复** ✗）→ **`:2745`** |
| `use-time:59` | `:60` → **`:58`（定义在 `:37`）** |
| `use-time:12` | "all `interface` / `type`" → "类型声明**加一个函数**"，并把函数所在行加进锚点 |
| `use-time:13` | "nothing reaches it today" → "**可达**（`axi-turn` 命令），且**不是 Pi 宿主在跑的那个 loop**" |
| A2 `readings.md:28` | jailer **6/6** → **7/7**（并注明"写这一节时是 6/6"） |
| program `prd.md:42` | "当前底线 822 / 820" → **不写通过数**（这一行本身就是"数字写进散文就会烂"的实例） |
| 本任务 `prd.md` AC-3 | 我自己写的 847/845 → 同样改成**不写通过数** |
| `directory-structure.md:48` | 111 / 26 / 22 → **113 / 29 / 95 + 1**，并加一句"这些数字会动、本句已烂过一次；承重的是**规则**与**唯一那条向上箭头**" |

**读数**：门 **2/2**（29 条引用）· 规格结构门 **17/17** · `typecheck` **0** · 全量 **849 / 847 pass / 0 fail / 2 skipped** · installer **141 OK**。

**下一轮**：R6（数字门——先取证哪些数字值得机检、哪些该改成不写）+ R4（plan-v8 重基，10 处）。
