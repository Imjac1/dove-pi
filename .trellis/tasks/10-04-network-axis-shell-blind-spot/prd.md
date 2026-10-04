# A mode that denies the network cannot see the network its shell reaches

## Goal

让 `sandbox.network: none` **只说它能兑现的话** ✓ —— 并让**兑现不了的那部分**（shell 发起的网络访问 ✓）**不再被读成已被控制** ✓✓。

**用户价值** ✓：一个模式作者读 `network: none` 时会以为"这一跑不会出机器" ✓；而 12 段那一轮里，`npm install` **在 `network: none` 下成功拉了新版 `xo`（^0.44 → 0.46.4）** ✗✓ —— **声明的含义与实际被控制的范围不一致** ✓✓，这与今晚修的那两类缺陷同源（**声明与产物不符、且没有东西在看** ✓✓）。

## Background（全部实测 ✓）

- **唯一的执行点** ✓：`src/core/action-policy.ts:622` —— `sandbox.network === "none" && NETWORK_TOOLS.has(invocation.tool)` ✓ → **只匹配 8 个工具名**（`NETWORK_TOOLS`，`action-policy.ts:21` ✓），**`bash`/`powershell` 不在其中** ✗✓✓。
- **拒绝文案** ✓：`:626` *"Mode '<id>' declares 'sandbox.network: none' and '<tool>' performs network access."* ✓ + `:627` 的 remediation ✓。
- **仓内先例** ✓✓：`src/pi-adapter/extension.ts:2254` —— `network: "allowlist"` 被判为 **unenforceable**（*"requires an egress control this runtime does not…"* ✓✓）→ **同一个运行时，同一种不可能，仓里已经承认过一次** ✓✓。
- **规格现状** ✗✓：`.trellis/spec/backend/personal-agent-mode-format.md:57-58` 说轴是 *"honoured or refused, **never ignored**"* ✓，并说 `network: none` **"enforced at the boundary"** ✗ —— **过度声明** ✓✓；而 `:81-82` 已如实记录 **shell 对路径的盲区** ✓，`:60-61` 已给出同类诚实措辞（*"cannot see through the shell"* ✓✓）。
- **发现来源** ✓：`.trellis/tasks/10-03-ten-million-token-project/findings.md` 的发现 A ✓（12 段那一轮 ✓）。

## Requirements

- **R1 声明与可兑现范围必须一致** ✓✓：`network: none` 不能继续隐含"这一跑不出机器" ✗。
- **R2 不得为此牺牲模式的本职** ✗✓：`code-development` **必须**能跑项目自己的测试（即必须能起 shell ✓）→ **"禁用 shell" 不是解** ✗✓。
- **R3 未兑现的部分要被*指出*，而不是被*默默留下*** ✓（仓的教条：*"refused, never ignored"* ✓✓）。
- **R4 结论要落进规格** ✓（`personal-agent-mode-format.md` 的对应小节 ✓），并带**可解析的锚点** ✓✓（引文门会查 ✓）。
- **R5 先红后绿** ✓：任何行为改动都要有**今天必红**的用例 ✓。

## Acceptance Criteria

- [ ] `network: none` 的**含义**在规格里被写成它**真正覆盖的范围** ✓，且**明确说出 shell 不在其中** ✓。
- [ ] 有一处**可执行的判定**（用例 ✓），使得"**声明 `network: none` 且同时保留 shell 的模式**"这一组合**不再无声无息** ✓✓。
- [ ] `code-development` 仍能跑自己的测试 ✗✓（R2 ✓），且 `pentest`/`trading` 等模式**不会因此被拒加载** ✗✓（除非它们确实声明了不可兑现的东西 ✓）。
- [ ] 引文门保持全绿 ✓（新写的锚点**可解析** ✓✓）。

## Out of Scope

- **给 shell 加网络拦截** ✗✓（命令内容对这条轴不可见 ✓；真要拦是**宿主/OS 级 egress 控制** ✓，不属于本仓 ✓）。
- **把 `sandbox.network` 变成真的沙箱** ✗。
- **`isolation: container/worktree`** ✗（同样的 unenforceable 类别 ✓，另有其记录 ✓）。

## Open Questions（**待用户定** ✗）

1. **采取哪种形状** —— 见本轮末尾给你的那一个决定 ✓。
