# A work mode shaped for developing a codebase

## Goal

补上一个**为"开发一个代码库"而设的工作模式** ✓ —— 因为实测（见下 ✓）三个已发布模式**没有一个是** ✓，而用户最常见的用途恰恰是它 ✓。

**用户价值** ✓：这一轮走查里，**同一件真活**在无治理时**能做完且做对** ✓✓（真宿主 + 真模型 + 项目自己判分全绿 ✓），而在**三个已发布模式的每一个之下都做不了** ✗ —— 于是"**受治理地干活**"这件事对**开发**是**空的** ✓✓。

## Background（已确认的事实，2026-10-03 实测）

### 三个模式的立场（实测 ✓）

| 模式 | `sandbox.filesystem` | 拿它开发的结果 |
|---|---|---|
| `code-audit` | **`read-only-source`** | **按设计挡住写** ✓（原话：*"declares `sandbox.filesystem: read-only-source`, so `index.js` can't be mutate[d]"* ✓） |
| `pentest` | `unrestricted` | **拒绝加载** ✓（*"its engagement 'example-engagement' does not pre-flight clean"* ✓） |
| `trading` | `unrestricted` | 语义是**交易 venue** ✓（scope 写明 ✓） |
| **无模式** | —— | **做完且做对** ✓✓（diff 正确 ✓，`ava` 7/7 ✓ + `tsd` 0 ✓） |

### 模板的形状（实测 ✓，取自**能加载**的 `code-audit` ✓）

- **三个文件** ✓：`MODE.md`（frontmatter `name`/`description`/`license`/**`compatibility`** ✓ + Method/Output/Stop ✓）· `governance.yaml` ✓ · `permissions.yaml` ✓。
- `governance.yaml` 的字段集 ✓（实测 ✓）：`version` ✓ · `framework` ✓ · `scope{targets,environment,exclusions}` ✓ · `authority{capabilities[]}` ✓ · `gate{semantics}` ✓ · `effects{classes{}}` ✓ · `sandbox{network,filesystem}` ✓ · `session{budget{turns}}` ✓ · `stop{on[]}` ✓。
- 允许值 ✓（`work-mode.ts` 实测 ✓）：`filesystem: unrestricted|ephemeral|read-only-source` ✓；`network: none|allowlist|unrestricted` ✓；`gate.semantics: none|conformance|limit` ✓；模式名 `/^[a-z0-9][a-z0-9-]*$/` ✓。
- **`code-audit` 的注释本身就是规矩** ✓✓，三条直接适用本题：① **"声明与内容不一致的模式拒绝加载"** ✓（它曾写 `limit` 而**没有阈值** ✓ → 那读起来像一个**不存在的控制** ✓✓）；② **"匹配不到东西的通配符读起来像权限、实际什么都没给"** ✓；③ **"运行时兑现不了的声明"要删掉而不是留着** ✓（`isolation: worktree` 就是这么被删的 ✓✓）。

## Requirements

- **R1 一个新模式 `code-development`** ✓（名字与 `code-audit` 平行 ✓、不和工作区模式名 `development` 混淆 ✓）。
- **R2 立场要与活匹配** ✓：`filesystem: unrestricted` ✓（开发必须写 ✓）；`gate.semantics: none` ✓（普通开发**没有外部授权方** ✓ —— 与 `code-audit` 同一个论证 ✓✓）；**不放任何解析不到的 `grant` 名** ✓。
- **R3 允许 shell** ✓（要跑项目自己的测试 ✓）—— 而 `code-audit` 正是**禁掉**它 ✓，这就是两者立场的差别所在 ✓。
- **R4 `effects` 保守** ✓：`write` 记 `idempotent` ✓；**`edit` / `bash` / `powershell` 保持默认（非幂等）** ✓（`code-audit` 的注释说明了理由 ✓）。
- **R5 权限表点名真实动作** ✓（`code-audit` 的注释：`read_*` 曾匹配不到任何东西 ✓ → **不许再出现** ✗）。
- **R6 `MODE.md` 要说清是什么contain了它** ✓（照 `code-audit` 的 `compatibility` 写法 ✓ —— **不许让读者从 `gates` 里推** ✓）。
- **R7 不改任何既有模式** ✗、不动其它产品代码 ✗（唯一的例外见 Open Question ✓）。

## Acceptance Criteria

- [ ] **AC-1** 新模式**能加载** ✓（可观察：同一套前置下它与 `code-audit` 一样通过加载 ✓）。
- [ ] **AC-2** 用**上一轮那件真活**验证 ✓：在草稿克隆里声明 `code-development` ✓ → 真宿主 + 真模型**改对 `index.js:62`** ✓ → **项目自己的判分绿** ✓（`ava` 7/7 ✓ + `tsd` 0 ✓）。**这是"它真的解决了 Q1"的唯一判据** ✓。
- [ ] **AC-3** 它**没有放松既有模式** ✗（可观察：`code-audit` 仍挡写 ✓、`pentest` 仍要求 pre-flight ✓ —— 各测一次 ✓）。
- [ ] **AC-4 反面也要测** ✗：在 `code-development` 下，**破坏性动作仍被点名动作拦住** ✓（例如 `never_allow` 里写的那一类 ✓）—— 一个"什么都允许"的模式**不是**这个任务的目的 ✓。
- [ ] **AC-5** 三分门 ✓（typecheck 0 ✓ / `npm test` ✓ / installer ✓）+ **模式相关的既有套件**不红 ✓（`code-audit-mode` ✓ / `pentest-mode` ✓ / `trading-mode` ✓ / `host-work-mode` ✓）。

## Out of Scope

- **不动三个既有模式** ✗（除了无人读的字段以外的任何行为 ✓）；**不改加载器** ✗（如果发现必须改 ✓ → 停下来报 ✓，不自己扩 ✓）。
- 不做真 RSI ✗、不动评测回路 ✗；**不碰草稿克隆之外** ✗。

## Open Questions

1. **这个模式对网络取哪一档** ✗：`network: none` ✗（最强、可强制 ✓，但**装不了依赖** ✗ → 只能开发"依赖已在"的项目 ✓）· **`network: unrestricted`** ✓（诚实 ✓，与另两个可写模式一致 ✓；代价：containment 交给**权限表 + scope** ✓ —— 这正是 `code-audit` 的 `MODE.md` 自己写的设计 ✓✓）· `allowlist` ✗（**它的语义我没有测过** ✓ —— 是什么列表 ✓、怎么强制 ✓ 都不知道 ✓ → **不推荐** ✗）。
