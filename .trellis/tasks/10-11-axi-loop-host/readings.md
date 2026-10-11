# 读数：真实端口下的 AC-1 / AC-2（2026-10-11 ✓✓）

**仪器**：`C:\Users\Macfy\Desktop\dsh\probe-host.mts`（仓外，保留）· 读数 `probe-host-readings.json` ✓ ·
形状照 A0 实测过的（`planeB\` held-out + `jail\` 可写、限制 SID = `S-1-1-0`、**全程非提升** ✓）·
它只改 `axi-loop-host-probe` 这棵 scratch 树的 ACL —— `ensureBoundary` 只动 `BoundarySpec` 声明的路径 ✓，**不指向仓库** ✗。

## AC-1：三个读数按机制要求的顺序，都在运行路径上拿到 ✓✓

| 读数 | 值 |
|---|---|
| `aclInvariants` | **`as-declared`** ✓（`/inheritance:r` 设完**回读**，`invariantViolations` 为空 ✓） |
| `tokenSelfCheck` | **`pass`** ✓（`CreateRestrictedToken(restrict=[S-1-1-0])=true` ✓ 即 `childDiag`） |
| `childCreateProcessError` | **0** ✓ —— 孩子**真的起来了**，不是"没起来"被读成"被挡住" ✓ |
| 两次 turn | `completed` ✓ —— 边界读数进了报告，而 turn 照常跑完 ✓ |

## AC-2：不变量在**运行路径上**成立，两个方向都量了 ✓✓

| 方向 | 退出码 | 文件 | 判定 |
|---|---|---|---|
| 受限孩子写 **held-out** | **1** | **不存在** ✓ | criterion 1 ✓ |
| 同一个受限孩子写 **可写侧** | **0** | **存在** ✓ | criterion 3 ✓ |

**同一次会话、同一份 spec、同一个受限令牌** ⇒ 差别只来自 ACL，**不是探针瞎了** ✓
（阳性对照由 `tests/jailer.test.ts` 第 5 条常驻看住 ✓）。

## 这一轮量出的两个仪器缺陷（都留档 ✓）

1. **探针住在它自己擦掉的那棵树里** ✗：第一版 `probe-host.mts` 放在 `SCRATCH` 内，开头的 `rmSync` 把自己删了；
   因为模块已加载，运行照旧完成 ✓。规则：**仪器不放在它擦除的东西里面**。
2. **宿主（我写的代码）丢了诊断字段** ✗✓——**这条更值钱**：第一版命令写 `echo probe> …`，而 `echo` 是 `cmd` 内建、不是可执行文件 ⇒
   `CreateProcessAsUser` **两个方向都拒**，而我只把 `{selfCheck, exitCode}` 传出来，于是**held-out 与可写侧都报 `-1`**，
   读起来和"边界守住了"一模一样 ✗。修法：端口带上 `createProcessError` 与 `diag`，且**非零即拒绝启动** ✓；
   并**由一条用例看住**（`tests/axi-turn-boundary.test.ts` 第 4 条，就是从这次失败写出来的 ✓）。

## 与白名单离场的关系 ✓

`tests/harness-reachability.test.ts` 的六条在上一轮离场 ✓；本轮之后它们**有了运行路径的读数**，不只是"有 import" ✓：
`src/commands/axi-turn.ts` 在真跑里建立了边界并派发了孩子 ✓。
