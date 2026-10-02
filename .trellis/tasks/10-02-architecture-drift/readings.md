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
