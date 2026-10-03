# 设计：一个与"开发"这件事匹配的模式

## 边界

**只新增一个模式** ✓（`modes/code-development/` 三个文件 ✓）+ 它的验证 ✓。
**不改加载器** ✗、**不改三个既有模式** ✗ —— 若发现必须改加载器 ✓ → **停下报告** ✓，不自己扩 ✗。
**名字** ✓：`code-development` ✓（与 `code-audit` 平行 ✓；合法名 `/^[a-z0-9][a-z0-9-]*$/` ✓✓；**不**与工作区模式名 `development` 混用 ✗）。

## 每个字段的依据（**全部实测** ✓，不是偏好 ✓）

| 字段 | 取值 | 依据 |
|---|---|---|
| `sandbox.filesystem` | **`unrestricted`** ✓ | 只有 `read-only-source` 会挡 `FILESYSTEM_MUTATORS`（`write/edit/bash/powershell/replace/insert/notebook_edit` ✓，`action-policy.ts:21`）—— 而开发**必须**写与跑测试 ✓。实测证据：`code-audit` 的拒绝原话 *"declares `sandbox.filesystem: read-only-source`, so `index.js` can't be mutate[d]"* ✓ |
| `sandbox.network` | **`none`** ✓ | `action-policy.ts:575` 的注释原话：**"`network: none` … is making a claim the policy can keep"** ✓✓；强制在 `:580` ✓，且**带 remediation** ✓（`:585`）。**且它不挡开发闭环** ✓：`NETWORK_TOOLS` 只含 8 个 Pi 工具 ✓（`:20`），**`bash` 不在其中** ✓✓，而 `dev.npm_install` 的副作用是 `workspace_write` 不是 `network` ✓✓ → **装依赖、跑测试、typecheck 全部照常** ✓ |
| `gate.semantics` | **`none`** ✓ | 普通开发**没有外部授权方** ✓（与 `code-audit` 同一论证 ✓✓）；`conformance` 要授权文档 ✗；`limit` 要阈值 ✗ —— 而 `code-audit` **曾**写 `limit` 且无阈值 ✓ = 一个**不存在的控制** ✓✓，不许重演 ✗ |
| `authority.capabilities` | **注册表里的真实名字** ✓ | `capability list` 实测 14 个 ✓：取 `dev.git_status` ✓ `dev.node_version` ✓ `dev.python_version` ✓ `dev.typecheck` ✓ `dev.project_test` ✓ `dev.npm_build` ✓ `dev.npm_install` ✓ `workspace.inspect` ✓ + 本模式自有动作 `source.read`/`source.write` ✓（在 permissions.yaml 里声明并给 effect class ✓） |
| `effects.classes` | `write: idempotent` ✓；`edit`/`bash`/`powershell` **不列** ✓ | 照 `code-audit` 的注释：`write` 是替换 ✓（第二次同状态 ✓），`edit` 是打补丁 ✓（打两次**不是**一次的状态 ✗）→ 默认（非幂等）才是安全方向 ✓ |
| `permissions.yaml` | `unlisted: allow` ✓ + `ask_before: []` ✓ + **`never_allow` 点名那 8 个真实工具** ✓ | 开发要频繁写 ✓ → 每次问会让它**不可用** ✗；而**点名真实名字** ✓ 是硬要求 ✓ —— `code-audit` 的 `never_allow: [network.*]` **匹配不到任何东西** ✗✓（它自己注释警告过这件事 ✓✓），**本模式不重复** ✗ |

## `MODE.md` 要写什么 ✓

- **frontmatter `compatibility`** ✓ 照 `code-audit` 的写法 ✓：**说清是什么 contained 了它** ✓（权限表 + scope ✓，不是 gate ✓）。
- **精确措辞** ✗✓：写 **"本模式下没有任何 Pi 网络工具运行"** ✓ —— **不写**"无法访问网络" ✗（后者说得出、兑不了 ✓✓，正是本仓清了两轮的那一族 ✗）。
- **前置与代价** ✓：需要 `DOVE_PI_FRAMEWORK_VERSION` ✓（与所有模式一样 ✓）；**不需要**授权文档 ✓（这与 `pentest` 的区别 ✓）；依赖的安装**可以**在回合内做 ✓（`dev.npm_install` ✓ 副作用是 workspace_write ✓）—— **但命令经 shell 跑出去时不受 `network: none` 管** ✓，这一点要写明 ✓✓。

## 兼容与迁移

**只增不改** ✓：新模式不影响任何既有模式 ✓；既有套件（`code-audit-mode` ✓ / `pentest-mode` ✓ / `trading-mode` ✓ / `host-work-mode` ✓）应**原样绿** ✓（AC-5 ✓）。
**回退** ✓：删目录即回退 ✓。

## 顺带记下的一条发现（不在本任务修 ✗）

`modes/code-audit/permissions.yaml:22` 的 `never_allow: [network.*]` ✓ **匹配不到任何东西** ✗✓ —— 它 deny 而非 grant ✓（所以不危险 ✓），但它**读起来像一个控制** ✓✓。→ **记为发现** ✓，**另开任务** ✗（本任务不顺手改它 ✗）。
