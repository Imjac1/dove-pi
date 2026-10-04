# 流程五步 ↔ 场景对照表（**第 1 片产出** ✓ —— 本片无红 ✗，如实标注 ✓）

## 五步，与每一步的判分来源

| # | 步骤 | 命令 | 需要真模型吗 | **判分从哪来** |
|---|---|---|---|---|
| 1 | 装/绑定 | `dove-pi project init` ✓ · `bind native` ✓ · `doctor` ✓ | ✗ | 命令自身的退出码与输出 ✓ |
| 2 | **建任务并真干活** | `task create` ✓ → **Pi 会话在项目里改代码** ✓ | **✓ 唯一需要真模型的一步** ✓✓ | **不是这一步** ✗✓ —— 见下方"§5 的边界" ✓ |
| 3 | **判分** | **独立跑项目自己的测试** ✓（`pytest`/`unittest` ✓）→ `task verify` ✓ | ✗ | **项目自己的测试** ✓✓（**必须独立于 field run** ✗✓） |
| 4 | 收敛与验收 | `task convergence` ✓ · 账本事件 ✓ | ✗ | 账本事件的存在与否 ✓ |
| 5 | 归档 | `task archive` ✓ | ✗ | 目录与提交 ✓ |

→ **链上只有第 2 步需要真模型** ✓✓；**其余四步是机械性的** ✓ —— 所以读数设计是"**一步要真跑、四步可断言**" ✓✓。

## §5 的边界（**改了我原先的设计** ✗✓✓）

规格 §5 明说一次 field run **不**覆盖，且**不得被引用为覆盖**：

- **"Whether the agent did the work correctly.** The run proves the **shape of a session**, not the **quality of its result**." ✓✓✓
  → **因此** ✗✓：我设计里那句"项目自己的测试是判分"**不能挂在 field run 上** ✓ —— **`pytest` 必须是*独立的一次运行*** ✓✓，两者**分开记录、分开引用** ✓。
- **`providerEvidence` 对真模型*按构造*为空** ✓✓（*"the capture is written inside the faux provider"* ✓）—— *"a reader who expects them is expecting something this mode cannot produce"* ✓✓。
- **`confirm` 以外的对话框** ✗（无人值守够不到 ✓）· **限流与网络波动** ✗（一次运行只采样一条路径 ✓）· **TUI 渲染** ✗。

## §7 的 Wrong 列表（**几乎逐条写着本任务会犯的错** ✓✓）

- *"**put a field run in CI**"* ✗ → **不把它放进 CI** ✗✓；
- *"**Record a reading without the provider and the model**, so the next reader reads a model change as a defect"* ✓✓ → **每条读数必须带 provider 与 model** ✓（§4 的格式第一行就是它们 ✓✓）；
- *"Declare a scenario field-runnable…"* ✗ → **声明之前先确认真模型能产生它的断言所读的字段** ✓。

## §6 对本任务的硬约束 ✓

- **那页只能有一个二级标题、≤24 KiB** ✗✓ → **不往 `personal-agent-field-run.md` 加小节** ✗（今晚刚撞过预算门 ✓）；
- **每个 code span 里的路径必须从仓根可解析** ✓✓（引文门会查 ✓）；
- **`tests/real-dove-blackbox.test.ts` 在 `harness-surface.yaml` 里被声明为某组件的验证者** ✓ → 新场景若要有测试，**先看它是否已在那份声明里** ✓（不猜 ✓）。

## 关于 `task.py start` 的告警 ✓

`start` 提示 *"Intentionally empty? Re-run with --allow-empty-context"* ✓ —— 因为 `implement.jsonl`/`check.jsonl` 是 **0 B** ✓（实测 ✓）。**本任务是 inline 工作流** ✓（由我本人执行，不经 sub-agent 派发 ✓）→ 按技能：*"Inline workflows skip this JSONL gate because Phase 2 loads context through `trellis-before-dev`"* ✓✓ → **故不补清单** ✗，**如实记录告警原因** ✓。
