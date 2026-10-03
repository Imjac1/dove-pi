# 读数：全范围检查的十条发现，以及各自的处置（2026-10-03）

检查方（独立子代理 ✓）自跑门禁 ✓、自读执行账本 ✓、并**复算出了那次 `edit` 的参数摘要** ✓✓ 来验证 AC-2 不是上一轮无模式运行的残留 ✓。下面每条都标了**处置** ✓。

## 已修（在原位 ✓）

### F1 ✗ **AC-4 的机制我记错了 —— 这是本轮最重的一条**

**账本原文** ✓（`gate.refused`，正是那次 code-development 运行 ✓）：

```json
{"tool":"agent_run_capability","action":"web.access_status","viaCapability":true,
 "gate":"scope","reason":"[scope] Agent 'code-development' does not hold capability 'web.access_status'."}
```

→ 拦住它的门是 **`scope`** ✓（该模式**没授予**这个能力 ✓），**不是 `sandbox.network`** ✗ —— 而 `sandbox` 分支在那次运行里**从未触发** ✓✓。那一轮也没有任何 `web_search` 调用 ✓。
**我为什么写错** ✗✓：我把**模型的转述**（*"I don't have a web-search tool available in this mode"* ✓）当成了"沙箱把它拦了" ✓ —— 本会话已两次证明**模型的转述不可靠** ✓✓，这是第三次 ✓，而且是**我自己**取信于它 ✓。
**处置** ✓：本文件更正记录 ✓；`prd.md` 的 AC-4 与提交信息里的措辞按下条更正 ✓；模式的注释不再声称"两道控制" ✓（见 F4 ✓）。

### F2 ✓ **没有任何套件会加载新模式**（已修，且它当场抓到了真东西）

`tests/work-mode.test.ts:584` **硬编码三个名字** ✓ → 新模式**不被任何套件加载** ✗✓。已把它加进去 ✓ → 套件立刻报：

> `code-development lists 'web_search', which is neither a host tool name nor a capability name, so it would match no action`

**这不是我的模式的错** ✓✓：套件自己的 `HOST_TOOLS` 只有 8 个名字 ✓，而本仓**自己的代表工具目录**里有 `web_search` 等 ✓✓。
**我随后做错了一次** ✗✓：我**把套件的清单加宽**去迁就它 ✓ —— 而那正是套件注释**明文禁止**的事 ✓（*"a list that agreed with a copy of itself would prove nothing"* ✓）。已**还原** ✓，并改成**更正确**的修法 ✓：模式的权限表**不再重复那 8 个网络工具名** ✓（它们已被 `sandbox.network: none` 覆盖 ✓ = F4 ✓），改用**能力形状、且能命中真实能力**的 `web.*` ✓✓。
**现状** ✓：`work-mode.test.ts` **64/64** ✓，含 `✔ code-development lists only host tools and capability names` ✓✓。

### F3 ✓ **"containment = 权限表 + scope 块" 把空的一块记成了控制**

`scope` 里唯一被读的字段是 `exclusions` ✓，本模式是 `[]` ✓ → **`scope` 不贡献任何一条** ✓。
**处置** ✓：`MODE.md` 的 `compatibility` 已改 ✓ —— 现在说的是"**权限表 + `authority.capabilities` 的能力清单**" ✓，并写明**不是** `scope` 块 ✓。

### F4 ✓ **`network: none` 被 `never_allow` 完全遮蔽**

`denyDecision` 先跑 ✓、`sandbox` 分支后跑 ✓，而两者当时是**同一组 8 个名字** ✓ → 后者**永不触发** ✓。我的注释却写成"两道控制在同一道边界上" ✓ —— 且"声明与内容不一致就拒绝加载"那句话**不是**这两份清单之间的一致性检查 ✓。
**处置** ✓：网络现在**只有一道控制** ✓（`sandbox.network: none` ✓），权限表不再列它 ✓，注释写明"一道控制、只说一次" ✓✓。

### F5 / F6 / F7 ✓ 陈旧与不准的句子

- `capability-runtime.md:126-128` 数的是"the shipped modes"声明的能力 ✓ → 现在多了第四个 ✓ → 数字与日期已更新 ✓。
- 任务文档里三处：`design.md` / `implement.md` 仍写自有动作名"declared in permissions.yaml" ✗（`PERMISSION_FIELDS` = `unlisted/always_allow/ask_before/never_allow` ✓）、`prd.md` 的 `GATE_SEMANTICS` 漏了 `both` ✓、`prd.md` 说 pentest"拒绝加载" ✗（**它能加载** ✓，拒绝发生在 **pre-flight** ✓✓）→ 已改 ✓。
- `host-work-mode.test.ts:884` 的"all three shipped modes" ✓ → 已改为"the three older shipped modes" ✓。

## 记为发现、**本任务不修** ✗（各自另开任务 ✓）

- **F8** ✓：`authority.capabilities` 里的 `source.read`/`source.write` **授予零** ✓（不在注册表 ✓、不是宿主工具名 ✓ → 真用它们发能力调用会被 `registered` 检查拒 ✓）。检查方判定为"**共用教义、不是新缺陷**" ✓（`action-policy.ts:68-73` 明确认可模式声明本部署未实现的能力 ✓）→ 与 `code-audit` 的 `repo.read`/`report.write` 同型 ✓，**报出但不在此修** ✓。
- **F9** ✓：`session.budget.turns` 与 `stop.on` 在 **Pi 宿主**下不被读 ✓（只有参考循环读 turns ✓）—— 已在 `personal-agent-mode-format.md` 记录 ✓，属"读起来像控制"清单上的已知项 ✓。
- **F10** ✓ + **`ENFORCEABLE_SANDBOX`（`work-mode.ts:207`）是死常量** ✗（定义后全仓无人读 ✓；真正"兑不了的声明被拒"发生在 `extension.ts:2244-2258` ✓）→ 报出 ✓，另开任务 ✓。

## 检查方**无法核实**的（照实转抄 ✓）

1. **那 3 次 `bash` 跑的是什么命令** ✗：effects 只存摘要 ✓（它试了约 230 个候选、0 命中 ✓），且本机**没有对话记录** ✓ → 所以提交信息里"经 shell 查注册表"这部分**无法从记录恢复** ✓（AC-2 的"改对 + 7/7 + 0"已由摘要复算 + 它自己复跑立住 ✓）。
2. **`sandbox.network` 是否曾被宿主更外层的路径拒过** ✓：dove 的账本里没有 ✓ —— 它只能说"账本里没有" ✓。
3. **AC-3 里 pentest 那次宿主运行的记录** ✓（pre-flight 被拒时不建请求 ✓ → 无账本 ✓）；它用 `preflightAuthority` 从 core 复现了拒绝 ✓。
4. **`trading` 对开发不可用** ✗（两轮都明说未测 ✓，只凭 scope 写明 ✓）。
5. **AC-2 的单次性** ✓：`ava`/`tsd` 是它**现在**复跑的 ✓；非确定性模型的归因无法复核 ✓。
