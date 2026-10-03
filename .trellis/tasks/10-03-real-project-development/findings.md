# 真实项目开发：一轮走查的发现（2026-10-03，全部实测）

**方法** ✓：一份**草稿克隆** ✓（`%TEMP%\dove-real-project\yocto-queue` ✓，`git clone` 自 `github.com/sindresorhus/yocto-queue` ✓）→ **先量基线** ✓ → 用**真宿主 1.0.0 + 真 provider + 本仓扩展**做**一件真事** ✓ → 每次尝试都留**原始输出** ✓。

## 走的是什么

| 步 | 命令 | 结果 |
|---|---|---|
| 基线 · 安装 | `npm install` | **exit 0** ✓ |
| 基线 · 行为测 | `npx ava` | **exit 0 · 7 tests passed** ✓ |
| 基线 · 类型测 | `npx tsd` | **exit 0** ✓ |
| 基线 · lint | `npx xo` | **exit 1** ✗ —— ESLint **内部堆栈** ✓（工具链老 ✓，见 Q5 ✓） |
| 这件活 | `index.js:62` 的 **`// TODO: Node.js 18.`** ✓（`peek()` 用可选链 ✓）—— **它自有的** ✓，不是我发明的 ✗ |
| 尝试 1（`code-audit`） | `pi -p … "…按 TODO 改 peek()…"` | **被拒** ✓：*"this session runs in `code-audit` mode, which declares `sandbox.filesystem: read-only-source`, so `index.js` can't be mutate[d]"* ✓ → `index.js:62` **原样未动** ✓ |
| 尝试 2（`pentest`） | 同上（+ 补 `engagements/` ✓） | **拒绝运行** ✗：*"[Dove mode] Work mode 'pentest' declares 'conformance' and its engagement 'example-engagement' does not pre-flight clean: Grant 'g-client-scope' names evidenc[e]…"* ✓ → **`git diff` 为空** ✓ |
| **对照：不声明任何模式** ✓ | 同一句提示词 ✓ | **做完且做对** ✓✓：diff = 守卫+TODO → `return this.#head?.value;` ✓；**它自己的判分绿** ✓（`ava` 7 ✓ + `tsd` exit 0 ✓） |

## 发现

### Q1（高 ✗）**三个已发布模式，没有一个是"开发一个代码库"**

| 模式 | `sandbox.filesystem`（实测） | 拿它开发这个项目的结果 |
|---|---|---|
| `code-audit` ✗ | **`read-only-source`** ✓ | **按设计挡住写** ✗ |
| `pentest` ✗ | `unrestricted` ✓ | **拒绝运行** ✓（授权 pre-flight 不过 ✓） |
| `trading` ✗ | `unrestricted` ✓ | 语义是**交易 venue** ✓（未测 ✗，但 scope 已写明 ✓） |

→ 用户面临的是一个**二选一** ✗✓：**无治理 → 能干活 ✓**（端到端成功 ✓）；**要治理 → 三个模式各自拒绝 ✗**。
**这不是产品"坏了"** ✓ —— 治理**正确地**在 fail-closed ✓✓；**缺的是"一个把治理用在'开发'这件事上的模式"** ✗✓。
**优化点** ✓：加一个**开发语义的模式** ✓（`sandbox.filesystem: unrestricted` ✓ + 一个开发向的 scope ✓ + 不用签名的授权面 ✓）—— 否则"受治理地干活"这条路对**开发**这个最常见的用途**是空的** ✗。

### Q2（中 ✗）**随仓的示例授权本来就过不了 pre-flight**

实测原文 ✓：`Grant 'g-client-scope' names evidenc[e]…` ✓ —— 示例授权的摘要**是占位的** ✓（本仓自己的文档早已承认 ✓，现在是实测 ✓）。
→ 一个想试 `pentest` 的人会**卡在第一步** ✓，而他能得到的唯一出路是模型转述的"**提供签名授权**" ✓ 或"**换个模式**" ✓ —— 后者**不存在**（见 Q1 ✓）。
**优化点** ✓：要么让示例**能过**（明示它是示例 ✓），要么在 `doctor`/模式加载时**先说清"这份示例不会通过 pre-flight"** ✓。

### Q3（中 ✓ **正面**）**无模式时的开发闭环是完整可用的**

真宿主 + 真模型 + 本仓扩展 ✓ → **改对了那一行** ✓✓，**项目自己的两层判分全绿** ✓✓（行为 7/7 ✓ + 类型 ✓）。
→ 产品**能干活** ✓ —— 这是这一轮**最重要的正面读数** ✓✓。

### Q4（中 ✓ **正面**）**两次拒绝都正确、且理由到达了用户**

两次都是 **fail-closed** ✓（一次挡写 ✓、一次拒绝加载 ✓），且**权威原话**（`[Dove mode] …` ✓）**出现在了用户能看到的地方** ✓✓ —— 这是**上一轮 B 的修复在真实场景里生效** ✓✓（改之前，用户只能看到模型的转述 ✓）。

### Q5（低 ✗）**`xo` 开箱即崩**（项目自身的问题 ✗，不是产品的 ✓）

`xo ^0.44` 与当前 Node 24 不兼容 ✓ —— **不是产品缺陷** ✗，但它意味着"用这个项目自身的 lint 判分"这条路**在这里走不通** ✓（已在读数里区分 ✓）。

### Q6（低 ✗ **未定位**）**一次真回合崩在宿主的 `EngineCore`**

尝试过程中的**第一次**调用返回 **exit 1** + *"EngineCore encountered an issue. See stack trace (above)…"* ✓，而**同样的活**在随后的两次里**没再复现** ✓（提示词不同 ✓）。
→ **记为未定位** ✗ —— 我**不猜**它是产品还是宿主的问题 ✓（按本会话的规矩：没量到就写"没量到" ✓）。

## **没有到达**的（同样是发现的一部分 ✗）

`agent_project_task` ✓ · `agent_workspace_verify` ✓ · **`agent_task_convergence`** ✓ —— **一次都没有被调用到** ✗✓：因为**没有任何一条路让"工作"发生** ✓（Q1 ✓）。
→ 也就是说：**产品为项目开发准备的那 12 个能力，在"用户真的想开发"这个场景下，被自己的治理挡在门外** ✗✓ —— 这是 Q1 的直接后果 ✓，也是下一轮该先解决的事 ✓。
