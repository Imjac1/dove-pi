# 规划修订（A0.5 实测后）

**这份文件是规划 §3.1 的修订件。** 为什么用修订件而不是就地改 `plan.md`：

1. `plan.md` 是 60.9 KB 的**派生副本**（桌面那份的重抄）。**本会话已经因为一次批量文本替换毁掉过一份文件**（丢字 1,530 处、无法完整还原，见 A0 任务 `readings.md` 与规划附录 B）。**同样的操作我不再做第二次。**
2. 修订件**可复查**：改了什么、依据是什么，一眼可见；而就地改会让"哪一版是当前结论"变得不可判定。
3. 与本仓既有的做法一致：**发现问题就记录，不重写既有工件。**

**待办（小改，不是重抄）**：`plan.md` §3.1 的 DSH 那一行与"底座判定"段、桌面 `axi规划方案.md` 的同两处、以及程序任务 `design.md` 里提到"底座"的措辞，都应在下次**单点替换**时同步（单点替换 = 只改那两行，不整文件往返）。

---

## 一、DSH 那一行（替换 §3.1 表格里的 DSH / Cordis 行）

| 候选 | 子系统 5（安全） | 子系统 7（扩展） | axi 要用它做什么 | 代价 |
|---|---|---|---|---|
| **DSH / Cordis** | **工具层沙箱**：每次调用解析会话策略，fs 与 shell **同根**；`workspace-write` 只允许会话 workspace **或平台临时根**；拒绝返回 `FS_SANDBOX_DENIED` 并带升级提示。审批、计划、目标、子代理原生 | **装配全部按 id 声明**（`- id: X` + `name: 包`），patch 层即"按 id 覆盖/禁用/插入" → **组件可替换**；文档明确 *"Choose a custom `Agent` implementation"* | **宿主与脚手架**：axi 作为**宿主** import 无头/SDK 入口，并用自己的 `Agent` **替换**标准 loop。自调用两条：`dsh --profile headless "<task>"`（一次性）与 `ctx.agents`（程序化创建/恢复） | axi 的**闸门**仍要自己写（语法感知 / 跨调用状态 / 确定性补救）。DSH 的沙箱是**它的代码**，落在 Plane A——**改动它会削弱边界，必须过 HITL**（解剖 §3.5.3） |

## 二、"底座判定"段（替换）

**底座判定**（A0.5 实测后修订）：**axi 是宿主，DSH 是脚手架**——axi 拥有自己的 `AgentLoop` 与**闸门**（`pi-agent-core` 的 thin `Agent` 是已验证能在编译产物里拦截的一个适配器），而 **DSH 提供工具层强制、会话持久化、程序化调用与组件替换点**。

三条支撑（依据与原文见 `.trellis/tasks/09-30-axi-a0-base/readings.md` 的 A0.5 段）：

1. **loop 的替换点是受支持的**：`dsh-agent-loop` 被 `dsh-base` / `dsh-sdk-minimal` 当作 *"an explicit row"* 挂载，装配全部按 id 声明，而它自己的文档写着 *"Choose a custom `Agent` implementation only when the standard 'call model, run tools, repeat' lifecycle is insufficient"* —— **axi 正是那个情形**。**这是替换，不是 fork。**
2. **强制在 loop 之下**：`dsh-fs-sandbox` 的围栏*每次调用*由**工具层**解析会话策略得出，且 *"the filesystem and shell families never confine to different roots"* → **换 loop 不会掉沙箱**。这一条同时是 axi 的 A2 需要的性质（fs 与 shell 同根）。
3. **自调用存在**：`dsh-headless/lib/startup.js` 是**可被宿主 import 的插件**，用法为 `dsh --profile headless "<task>"`，行为是 *"Answer one task, stream reasoning to stderr, print the final assistant message, and exit."*；另有 `ctx.agents` 提供程序化创建与恢复。→ **回路不必依赖"有人点开一个会话"**。

## 三、由此修正的旧结论（连同我的一次自我纠正）

- **旧文**：*"DSH 只作开发环境；插件层给不了'代码内强制'"*。
- **修正**：**后半句仍对**（axi 的闸门必须自己写，见 §1.1 的 120/120 vs 88/120）；**前半句低估了 DSH**。它的方案是"**用你自己的 `Agent` 替换标准 loop，强制留在工具层**"，而那**正好是 axi 需要的形状**。
- **一次自我纠正（留档）**：我曾断言"会话只能由桌面应用拉起，我起不了"。**那是从"`dsh` 不在这个 shell 的 PATH 上"推出来的，推错了。** 本会话第三次同类错误（另两次：从特权清单预测 1314；用 PATH 上没有的 `pwsh` 起子进程）。**根因相同：从没被验证过的仪器下结论。** 已写进 A0 的 `implement.md` 检查清单。

## 四、A0.5 的实测结果（三条全部有答案）

**① 自调用 → ✅ 已实测通过。** 启动器是 `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`；从本会话的 PowerShell（**普通非 Electron 进程**）执行 `dsh --profile sdk --help` → **退出码 0**，输出 *"Serve DeepSeek Harness SDK clients over stdio JSON-RPC."*
→ **axi 的回路可以自己 spawn 一个 `dsh` 并驱动它**，不依赖"有人点开会话"。

**② 换掉 `Agent` 后围栏是否还在 → ✅ 在（代码级证据，非运行时实测）。**
围栏的策略来自**注入**：`dsh-fs-sandbox` 声明 **`static inject = ["sandboxPolicy"]`** 并读 `ctx.sandboxPolicy.defaultMode`；`dsh-sandbox-policy` 自述 **"the single owner"**，并带 `invariant.js`、`{ inject: ["sessions"] }` 把模式**绑在会话上**；而 **`dsh-agent-loop` 的注入里没有 `sandboxPolicy`** → **loop 不在这条链上**。
**诚实标注**：这是**代码与文档级**证据；要变成运行时读数，需要真的起一个会话、替换 `Agent`、再重跑一次越界写。

**③ 谁设定 `ctx.sandboxPolicy` → ✅ 三个来源，而第三条必须在规划里被当成受治改动。**
1. **部署默认**（profile 的 `defaultPreset`；只管新建会话）；
2. **会话级切换**：*"each session can switch modes independently. **Session choices survive restart**"*；
3. **`/permission` 命令**：*"reports or **changes the current preset**"*。

**由此对规划追加的两条硬约束**：
- **策略变更属于 Plane A，必须过 HITL**（§2.3 / 解剖 §3.5.3）。axi 若沿用这条链，**不得把"模型被告知了模式"当作防护**——原文 *"Before each model request, the model **receives** the effective policy"* 是**提示词层**，正是 §1.1 那个 88/120 的坑。
- **沙箱与审批是两套机制**（*"sandbox execution and approval handling remain separate enforcement mechanisms"*）→ 二者要**分别**声明与测试，不能互相顶替。

**仍未做（保留为待办，不影响上面的结论）**：②的运行时确认；`sdk-minimal` 默认 `danger-full-access`（其文档自述 *"use it only with an isolated workspace"*）意味着**走 SDK 路线边界必须显式给出**。

## 五、对 A0 判据的追加

三条实测归入 **A0.5**（宿主与 loop 可替换性），与 A0.1–A0.4 并列；A0 的"决策表"相应增加一行：

| 实验 | 结果 | 后果 |
|---|---|---|
| A0.5 | 三条成立 | **axi 作为宿主、用自定义 `Agent` 替换 loop**；强制分两层（DSH 工具层 + axi 闸门） |
| A0.5 | 1 或 3 不成立 | 回落为"自建宿主"：直接用 `pi-agent-core` 起自己的进程，DSH 只作参照 |
