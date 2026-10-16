# 读数：S1b / S1c（2026-10-03 本机实测）

## S1b —— adapter 对宿主的依赖面：**"反转成本 = 一个 adapter 实现"成立** ✓

`src/adapters/loop-pi-agent-core.ts` 的**全部**宿主依赖，就是它的文件头两条 import ✓：

- `@earendil-works/pi-agent-core`：**5 个具名符号** ✓ —— 其中**值只有 1 个**（`Agent` ✓），类型 4 个（`AgentMessage` / `AgentTool` / `BeforeToolCallResult` / `StreamFn` ✓）；
- `@earendil-works/pi-ai`：**2 个类型**（`Api` / `Model` ✓）。

**实际触碰的成员路径：2 个** ✓ —— `agent.prompt` ✓、`agent.state` ✓（全文取 `(agent|harness|session|pi)\.[A-Za-z_]+` 去重后仅此两个 ✓）。

**对照组** ✓：`src/adapters/loop-scripted.ts` **只**从 `../core/loop.ts` 取类型 ✓ —— **对宿主零依赖** ✓✓。这证明 `AgentLoop` 这层**接口本身**与宿主无关 ✓，不是"两个实现都碰宿主、只是碰得少" ✗。

**判定** ✓（AC-4 ✓）：1.0 若要动这 **7 个符号**或 **2 个成员** ✓，代价 = **重写这一个 adapter** ✓ —— 裁决那句话**成立** ✓，且现在有了**可核的量** ✓（此前它只有断言 ✓）。

**未做** ✗：**没有**验 1.0 是否**真的**动了它们 ✓ —— 外部检索不可用 ✓（`HTTP 401` ✓）→ 本次是**盲审计** ✓：识别"什么会破" ✓，不猜"什么破了" ✗。若你给 1.0 的 release 要点 ✓，这一条立刻可从"风险面"升级为"判定" ✓。

## S1c-1 —— `AgentHarness` **仍是 stub** ✓

`node_modules/@earendil-works/pi-agent-core/dist/harness/agent-harness.js`：`HarnessNotImplemented` **存在，且在被抛的路径上** ✓：
`throw this.isClosed() ? new HarnessClosed() : new HarnessNotImplemented(this.operation);` ✓

**判定** ✓：裁决里"将来是**替换**而非重写 Dove 的同类机制"**仍成立** ✓。

## S1c-2 —— `host-version.ts` 的失败行为是**沉默** ✗

`getPiVersion()` 返回 `string` ✓；**任意**失败路径都退化成 `"unknown"` ✓：
- 找不到 `package.json`（`:14` ✓）→ `require(...).VERSION ?? "unknown"`（`:15` ✓）；
- `require` 抛 / JSON 坏 / 无 `version` 字段（`:16-18` ✓）→ `"unknown"` ✓。

**不拒绝 ✓、不告警 ✓、不记录 ✗** —— 调用方拿到的只是一个**看起来正常的字符串** ✓。

**判定（**临时** ✓）**：这正是本仓清过两遍的缺陷类 —— "**看起来是控制，其实什么都没控制**" ✗✓ → **倾向「需改」** ✓。

**为什么是临时** ✗：它的**严重性取决于调用点** ✓ —— 谁读 `getPiVersion()` ✓、读不到时**会发生什么** ✗（拒绝 ✓ / 降级 ✓ / 当正常值继续 ✓），**尚未量** ✗ → 归入 **S1（宿主表面清单）** ✓，不在这里下结论 ✓。

---

# 读数（2026-10-17 重核：**宿主已经是 1.0.0** ✓，上面的读数全部录于 0.84.3 ✓）

**上面的节留着不动** ✓ —— 它记录的是当时的盘面 ✓。本节是**更正** ✓：prd §三 记的那次前提变化**真的落地了** ✓，所以下面每一条都是**对着实装的 1.0**量的 ✓，不再是盲审计 ✓。

## S1b 重核 —— **7 个名字在 1.0 里全部仍在** ✓（判定：成立 ✓）

量法 ✓：取 `src/adapters/loop-pi-agent-core.ts` 的两条宿主 import 的**具名符号** ✓，逐个在 `node_modules/@earendil-works/pi-agent-core` 与 `pi-ai` 的 `.d.ts`/`.js` 全文里搜 ✓。

- `@earendil-works/pi-agent-core`：`Agent` / `AgentMessage` / `AgentTool` / `BeforeToolCallResult` / `StreamFn` ✓
- `@earendil-works/pi-ai`：`Api` / `Model` ✓
- **合计 7 个名字，实装 1.0 里缺失 0 个** ✓✓ —— 与上方 2026-10-03 那条"7 个符号"**数字一致** ✓。

**判定** ✓（AC-4）：改名 / 删除类的破坏**已排除** ✓；"反转成本 = 一个 adapter 实现"在 1.0 下**仍然成立** ✓ —— 而且这次是**对着实装核的** ✓，不再依赖"取不到 1.0 要点"的盲审计 ✓。

**未量** ✗：这 7 个名字的**签名**是否变过 ✓ —— 名字在 ≠ 形状不变 ✓。标**未验证** ✗，不写成结论 ✓。

## S1c-1 重核 —— **`AgentHarness` 不是转正，是整个从 1.0 里消失了** ✓✗（判定：**需降级并标注** ✗）

量法 ✓：`node_modules/@earendil-works/pi-agent-core` 包内**全部** `.js`/`.ts`/`.md`/`.json` 搜 `harness`（不分大小写）→ **命中 0** ✓；旧路径 `dist/harness/agent-harness.js` **不存在** ✗；`dist/index.d.ts` 搜 `Harness|AgentHarness` → **命中 0** ✓。

1.0 的该包只剩 **6 个模块** ✓：`agent-loop` · `agent` · `index` · `proxy` · `stream-fn` · `types` ✓。

**所以上方 2026-10-03 的读数在 1.0 下作废** ✓：`HarnessNotImplemented` 与 `agent-harness.js` 都不在了 ✓。

**判定** ✓：prd §三 风险点 3 问的是"若 `AgentHarness` 转正，裁决里'替换而非重写'那条要重读" ✓ —— 实测的答案比那个设想更彻底 ✓：**它变成了"没有可替换的对象"** ✓ → 那条裁决**需降级并标注** ✗，不能按原样引用 ✓。

## S1c-2 重核 —— `getPiVersion()` **实测返回 `"1.0.0"`** ✓，但沉默降级**仍在** ✓（判定：仍成立 ✓，触发条件比旧读数更远 ✓）

**实测** ✓（不是读代码 ✗）：`node --import tsx` 调 `getPiVersion()` → **`"1.0.0"`** ✓。

**这里我先下了一个错的推断，记下来** ✗：看到 `require("@earendil-works/pi-coding-agent")` 在 1.0 下抛
`ERR_PACKAGE_PATH_NOT_EXPORTED`（1.0 的 `package.json` 把 `exports` 收成了 `"."` 与 `"./package.json"` 两条 ✓，**没有 main 回退** ✓），我立刻推断"取版本的方式已经坏了" ✗ —— **被实测否定** ✓。

真因 ✓：`host-version.ts` 的**第一优先路径**是 `findPackageJson()` ✓ —— 从自身目录向上找
`node_modules/@earendil-works/pi-coding-agent/package.json` 并读它的 `version` 字段 ✓，**不经过包的 exports 映射** ✓。会抛的 `require` 只是**回退路径** ✓（`:15` ✓），今天**没有被走到** ✓。

**判定修正** ✓：S1c-2 的原结论（"任意失败路径都退化成 `unknown`，不拒绝、不告警、不记录" ✓）**仍成立** ✓，而且现在多了一条实装证据 ✓：`require` 那条回退**在 1.0 下确实会抛** ✓ 且**会被 `:16` 的 catch 吞成 `unknown`** ✓ —— 也就是说"沉默降级"不是假想 ✓，只是**今天不触发** ✓（因为第一条路成功 ✓）。**触发条件**：`pi-coding-agent/package.json` 不在向上路径上时（例如换一种安装布局 ✓）才会落到回退 ✓。

## S3 的一半 —— 硬编码旧版本串：**51 处** ✓，其中**这条不是缺陷** ✓

量法 ✓：`src` / `installer` / `tests` / `scripts` / `.github` 搜 `0\.8[0-9]\.\d` ✓ → **51 处命中** ✓。

**逐条判定的第一批** ✓：

- `tests/release_readiness_installer_test.py:27-28` 的 `0.84.3` **不是缺陷** ✓ —— 该文件的 `write_fixture()` ✓ **自己造** `package.json`/`package-lock.json`（`:25-40` ✓），**不读真实清单** ✗ → `0.84.3` 只是 fixture 的任意取值 ✓。**这同时解释了它为什么不红** ✓（§三 风险点 5 要的正是这类"不会红的测试" ✓）。
- `src/extensions/catalog.ts` 的 `minPi: "0.80.0" / "0.82.0" / "0.84.0" / "0.84.1" / "0.80.6"` ✓ —— 是**扩展目录的最低宿主要求** ✓，1.0 **满足**全部 ✓ → **可行** ✓。散文里的 `0.84.3`（`:233` ✓、`:276` ✓）把当时的版本当成最新 ✓，措辞需注意，**不构成缺陷** ✓。
- `src/core/request-lifecycle.ts:162` 与 `src/extensions/install.ts:95` 的 **`Pi 0.84.3`** ✗ —— **注释里钉着一个会漂的宿主版本** ✓。断言内容**实测仍成立** ✓（见下一条 ✓），但版本号该去掉 ✓ → **需改（低）** ✗。

## submission id —— 1.0 **仍未暴露** ✓，所以那条断言成立 ✓（而注释钉着旧版本 ✓）

量法 ✓：在 1.0 的 `pi-coding-agent` 包内全部 `.d.ts` 搜 `submissionId|submission_id|hostSubmission` → **命中 0** ✓；`docs/` 里也 **0** ✓。

**判定** ✓：`request-lifecycle.ts:162` 那条"宿主不暴露 submission id，所以只能用 digest 作证据"**在 1.0 下仍然成立** ✓ —— 与 `personal-agent-request-runtime.md` 的同句 ✓ 一致 ✓。要改的只是**注释里的版本号** ✓（同上一条 ✓）。

---

# S1 宿主表面清单（AC-3，2026-10-17 量）

**先给搜法** ✓ —— 本 prd §二 那张按文件计数的表（`cli.ts`(3) ✓、`commands/token-audit.ts` ✓ …）**没有记下它用的是哪个模式** ✗，
所以那个计数**不可复现** ✗：换一个具名模式，点名的文件就变了 ✓。本节的清单来自**四个写明模式** ✓：

| 模式 | 含义 | 命中 |
|---|---|---|
| **P1** `@earendil-works` | 直接 import 宿主包 | `src/` **7** 个文件 ✓ · `installer/transaction.py` ✓ · 测试 **9** ✓ · `scripts/` **3** ✓ |
| **P2** 宿主扩展 API（`pi.on(` / `pi.register*` / `ctx.ui.` / `ctx.cwd` / `ctx.hasUI` / `pi.getAllTools`） | 挂载点与宿主回调面 | **只有** `pi-adapter/extension.ts` ✓：**157 处调用** ✓，其中 `pi.on(` **18 个挂载点** ✓（与 `personal-agent-use-time-architecture.md` 的"十八个挂载点"一致 ✓） |
| **P3** 宿主版本文本（`Pi <数字>` / `0\.8x\.y`） | 钉在文本里的宿主版本 | `extensions/catalog.ts` **16** ✓ · `pi-adapter/extension.ts` **2** ✓ · `extensions/install.ts` **1** ✓ · `core/request-lifecycle.ts` **1** ✓ |
| **P4** 宿主解析的环境与路径（`PI_CODING_AGENT_DIR`、`.pi/`） | 宿主自己定下的配置根 | 见下表 ✓ |

**P4 必须分两半，这是机械计数会骗人的地方** ✓：同一个模式把**我们自己的** `DOVE_PI_*` 也捞了进来 ✓ ——
`context-guard.ts` 的 6 处 ✓、`subagent-provider.ts` 的 3 处 ✓、`managed-install-status.ts:76` ✓、`installer/layout.py:38`/`:44` ✓
**全是自有变量** ✓。**它们不是宿主表面** ✗，是我们自己的契约 ✓。真正落在宿主名下的是 `PI_CODING_AGENT_DIR` 与 `.pi/agent` 这个默认根 ✓。

**判定口径（先说清，免得"契约"变成万能答案）** ✓：**契约** = 本仓的**正确性**依赖它，宿主一变我们就错，必须跟着改 ✓；
**便利** = 宿主给了更顺手，没有它我们已经降级 ✓。

| 文件 | 宿主行（本会话量的） | 判定 | 为什么 |
|---|---|---|---|
| `pi-adapter/extension.ts` | `:2322`–`:3733` 的 **18 个挂载点** ✓ + 157 处宿主 API ✓ | **契约**（最宽的一处 ✓） | 事件名就是宿主的词汇表 ✓：改名或移走一个事件，**对应的控制悄无声息地不再挂上** ✓ —— S3 查的正是"这会不会被发现" ✗ |
| `adapters/loop-pi-agent-core.ts` | `:1` `:2` 的 **7 个具名符号** ✓ | **契约**（已量 ✓） | 7/7 在实装 1.0 里命中 ✓ → "反转成本 = 一个 adapter"**仍成立** ✓（AC-4 ✓） |
| `pi-adapter/host-version.ts` | `:8` `getPiVersion()` ✓ | **契约**（沉默降级 → **需改** ✗，归 S5 ✓） | 宿主版本契约**只活在这个文件里** ✓（规格页零版本串 ✓） |
| `pi-adapter/chinese-settings.ts` | 3 个 import ✓ + 4 处宿主路径 ✓ | **契约** | 读的是宿主的 settings 面 ✓ |
| `pi-adapter/shell-config.ts` | 1 个 import ✓ + 2 处 ✓ | **契约** | 读的是宿主选定的 shell ✓ |
| `core/state-dir.ts` | `:32` `PI_CODING_AGENT_DIR` ✓ | **契约** | 宿主配置根：它搬了，这里就读错地方 ✓ |
| `extensions/doctor.ts` | `:144` ✓ | **契约** | 同上 ✓ |
| `extensions/install.ts` | `:165` `:255` ✓ · `:266` ✓ · `:95` ✗ | **契约**；注释 **需改（低）** ✗ | `:266` 的硬编码 `dist/bundle/cli.js` **实测仍存在** ✓，但它是**走文件系统、绕过 exports 映射**的路径 ✓（1.0 的 exports 只有 `.` / `./rpc-entry` / `./client` / `./experimental/plugin` ✓）→ 契约的性质是"依赖宿主内部布局" ✓ |
| `commands/token-audit.ts` `:35` · `commands/cache-audit.ts` `:41` | `PI_CODING_AGENT_DIR` ✓ | **契约** | **这两个文件正是 prd §二 点名、而 P1 抓不到的那一类** ✓：它们依赖宿主的**配置根约定** ✓，不是包 import ✓ |
| `cli.ts` | `:78` 唯一一处 ✓，且是 `DOVE_PI_SUBAGENT_*` ✓ | **不是宿主表面** ✗ | prd §二 给 `cli.ts` 记的是 **(3)** ✗，四个具名模式下**找不到 3** ✓ —— 它是"计数没有搜法"的直接例子 ✓ |
| `web-access/config.ts` | `:4` `:5` `:59` ✓ | **契约** | 三个候选位置（`~/.pi/web-search.json`、`${PI_CODING_AGENT_DIR}/web-search.json`、`$XDG_CONFIG_HOME/pi`）✓ 全是**宿主生态**的约定 ✓ |
| `installer/transaction.py` | `:19` `:20` 的依赖映射表 ✓ | **契约** | "宿主版本钉在哪一层"的答案之一（R4 ✓） |
| `installer/manager.py` | `current_pi_version` / `latest_pi_version` ✓ | **契约** | 升级检查读的是宿主自己的版本 ✓ |
| `extensions/catalog.ts` | `:198` `:199` `:233` `:276` ✓ | **可行** ✓（散文措辞需注意 ✗） | `minPi` 是**扩展的最低宿主要求** ✓，1.0 全满足 ✓；散文把当时的版本当最新 ✓ |
| `core/work-mode.ts` | **`:303`** ✗ | **需改** ✗ | 注释引用 `pi-agent-core` 的 `dist/harness/tools/*.d.ts` ✓ —— 而 1.0 的该包**含 `harness` 的文件数为 0** ✓：它引用了一条**不可能存在**的路径 ✓ |
| `core/request-lifecycle.ts` | `:162` ✗ | **需改（低）** ✗ | 版本注释会漂 ✓；断言本身实测成立 ✓ |
| `context-guard.ts` · `subagent-provider.ts` · `managed-install-status.ts` · `installer/layout.py` | 全是 `DOVE_PI_*` ✓ | **不是宿主表面** ✗ | 我们自己的命名空间 ✓ |

**表面有多宽，一句话** ✓：需要跟着宿主改的文件**至少 15 个** ✓（P1 的 7 个 `src/` + P2 的 1 个 + P4 的 7 个，含重叠 ✓），
外加 `installer/` 的 3 个与 `scripts/` 的 3 个 ✓ —— 而**只有一处**是把宿主**当作可替换件**来写的 ✓（`adapters/` ✓）。
这两件事同时成立，正是 AC-4 与 R1 要分开问的原因 ✓。

## 两条"看着像缺陷、量了不是" ✓

1. **typebox 警告不是本仓的** ✓。每一次真跑的 stderr 都带 **3 次** ✓
   `Host-provided extension packages must be declared in peerDependencies with a "*" range, not dependencies: typebox…`
   而本仓 `package.json:30` **也**把 `typebox` 放在 `dependencies` ✓、`peerDependencies` **整个不存在** ✓ ——
   所以它**看起来**就是那个违规者 ✗。**归因是量的** ✓：本机 13 个已装扩展里**恰好 3 个**把 typebox 放在 dependencies
   （`pi-hashline-edit-pro` ✓、`pi-web-access` ✓、`@juicesharp/rpiv-ask-user-question` ✓），与警告次数相等 ✓；
   再用 `--no-operator-config` 把操作者的包**全部撤掉**跑一次 ✓（faux provider ✓、`status-line-only` ✓）→ **警告 0 次** ✓，
   而同一次跑里 Dove **确实加载了** ✓（`[Dove mode] code-development loaded` ✓ 与 `Dove Pi: workspace=…` ✓ 都在 ✓，
   且 `hashlineEditTools=absent` ✓ 反证操作者那套包确实被撤走了 ✓）。
   **判定：属于操作者那三个包，不属于本仓** ✓ → 不开任务 ✗；但它记在这里，因为**表面读起来像缺陷** ✓。
2. **`:266` 那条硬编码路径没有破** ✓（`dist/bundle/cli.js` 实测 = True ✓）→ 它不是"1.0 破了" ✗，它是一条**契约** ✓。

## 未验证 ✗（不许写成结论 ✓）

- `install.ts:95` 那条断言 —— "宿主**没有**公开的持久化多源安装 API" —— **在 1.0 下是否仍成立** ✗。
  本会话只量了它旁边的**版本号**会漂 ✓，**没量**那个 API 的有无 ✗。

**测试与脚本不进这张表** ✓：它们属于 S3/R7 ✓（`tests/` **9** 个文件引用宿主包 ✓、`scripts/` **3** 个 ✓）。

## S1c 之二 —— 识别不了宿主时：**实测**返回 `"unknown"`，且**一言不发** ✓（AC-5 ✓）

上面那条 S1c-2 的判定当时**有一半是读代码的推断** ✗（"`:16` 的 catch 会把它吞成 `unknown`"）。本会话把那一半**量了** ✓。

**量法** ✓：`src/pi-adapter/host-version.ts` 只依赖 node 内置 ✓（无仓内 import ✓），所以可以**原样**复制走 ✓ ——
先逐个祖先确认**没有** `node_modules/@earendil-works/pi-coding-agent/package.json` ✓，再用**本仓自己的** tsx CLI 跑它 ✓：

| 位置 | 调用 | 输出 |
|---|---|---|
| 探针目录（向上搜索**必然失败** ✓） | `getPiVersion()` | **`RETURNED "unknown"`** ✓ —— **一行** ✓，无警告 ✓、无日志 ✓、无抛出 ✓ |
| 仓库内（搜索**成功** ✓） | `getPiVersion()` | `RETURNED "1.0.0"` ✓ |

**判定** ✓：**"沉默降级"从推断升级为读数** ✓ —— 宿主不可达时它**既不拒绝、也不告警、也不记录** ✓，
而这是本仓已经清过两遍的缺陷类 ✓ → **需改** ✗，归 S5 ✓。探针目录已删 ✓。

---

# S2 自我声明：**不需要 v9** ✓（AC-6 ✓）· S3 哪一类变动不会被发现 ✓（AC-7 ✓）

## S2 —— `plan-v8.md` 与规格页里的宿主假设，逐条

量法 ✓：在 `09-30-axi-program/plan-v8.md`（**84,746 B** ✓）与 `.trellis/spec/**/*.md` 里搜宿主词 ✓，逐条读命中行 ✓。

**`plan-v8.md` 的宿主引用极少，且全是架构性的** ✓：

| 行 | 说的是什么 | 判定 |
|---|---|---|
| `:217` | loop 实现：`src/adapters/loop-pi-agent-core.ts`（外部 ✓） | **可行** ✓ —— 这是**放置**，不是宿主能力 ✓ |
| `:592` | 目录树里的 `adapters/` ✓ | **可行** ✓ |
| `:673` | 依赖表：`@earendil-works/pi-agent-core` 是**适配器层唯一必需的 pi 包** ✓；`pi-coding-agent`/`pi-tui` 只出现在 Pi 宿主 profile ✓ | **可行**，**需补一句限定** ✗：实测 adapter **还**从 `pi-ai` 取两个**类型**（`loop-pi-agent-core.ts:2` ✓），而 `pi-ai` **不是本仓的直接依赖** ✓（`package.json` 的 7 个依赖里没有它 ✓）→ 那句话差一个词 ✓ |

**`AgentHarness` 在 `plan-v8.md` 里出现 0 次** ✓ —— 所以 1.0 那次"它整个消失"的变动**根本不触及计划册** ✓。

**规格页同样少，而且都带锚** ✓：

- `personal-agent-use-time-architecture.md:11` —— "loop 的拥有者是 **Pi 宿主**" ✓：1.0 下**仍成立** ✓（宿主照样拥有 session/TUI/provider ✓，本轮每一次真跑都是宿主在驱动 ✓）。
- 同页 `:17` 的 "The eighteen mount points" ✓ 与 `:44` 的 `pi.on("tool_call")` @ `extension.ts:2866` ✓ —— 实测 **18** 个 ✓、**`:2866` 正是 `tool_call` 那一行** ✓ → **可行** ✓。
- `request-runtime.md` / `extension-runtime.md` / `managed-install.md` 各 1–3 处 ✓，都是宿主契约的**责任描述** ✓，不含版本串 ✓（prd §二 已量：规格页零版本串 ✓）。

**判定：不需要 v9** ✓ —— 依据是"计划册假定宿主行为的地方只有上表这些，且没有一条被 1.0 推翻" ✓。**只判定，不改** ✓。
**范围声明** ✓：这是**对"宿主假设"这一个问题**的判定 ✓，不是对 84 KB 计划册的通审 ✗。

## S3 —— 哪一类宿主变动**会被发现**，哪一类**不会** ✓

**能测的那一半先给** ✓：宿主的 `on()` 是**字面量类型重载** ✓（`pi-coding-agent` 的 `dist/core/extensions/types.d.ts:1144` ✓ 起，一行一个事件名，如 `on(event: "session_start", …)` ✓）→ **Dove 那 18 个挂载点是编译器看着的** ✓：事件被改名或删掉 → `npm run typecheck` 红 ✓（本会话它是绿的 ✓）。

| 宿主变动类别 | 谁看着它 | 会不会红 |
|---|---|---|
| 事件名 / 回调签名 | **typecheck** ✓（字面量重载 ✓） | **会** ✓ |
| adapter 取的 **7 个导出** | **typecheck** ✓ | **会** ✓（AC-4 ✓） |
| 配置根 `PI_CODING_AGENT_DIR` | **9** 个文件 ✓ | **会** ✓（我们自己那侧 ✓） |
| `.pi/agent` 默认根 | **1** 个文件 ✓（`real-dove-blackbox.test.ts` ✓） | 部分 ✓ |
| **宿主内部布局** `dist/bundle/cli.js`（`install.ts:266` ✓） | **0** ✓ | **不会** ✗ |
| **版本读取本身**（`getPiVersion` ✓、`host-version` 模块 ✓） | **0** ✓ | **不会** ✗ |
| **依赖形状**（`typebox` 在 `dependencies` ✓） | **0** ✓ | **不会** ✗ |
| 注释里的版本与路径（`install.ts:95` ✓、`request-lifecycle.ts:162` ✓、`work-mode.ts:303` ✓） | **0** ✓ | **不会** ✗ |

**一个具体到行的例子** ✓（量到的，不是举例说明 ✓）：`tests/release_readiness_installer_test.py:25-40` 的 `write_fixture()` ✓ **自己造** `package.json`/`package-lock.json` ✓（`:27-28` 把 `0.84.3` 写死 ✓），**不读真实清单** ✗ → 宿主怎么变它都**不会红** ✓。

**判定** ✓："这次大版本变动能不能被发现"的答案是**分层的** ✓：挂载点与导出**由编译器看着** ✓，所以 1.0 这类变动会被发现 ✓；
而**版本读取、宿主内部布局、依赖形状、注释**没有任何 instrument 看着 ✓ —— 而这四类里前三类**恰好是 1.0 真正动过或可能动的地方** ✓（`harness` 消失 ✓、包 `exports` 收窄 ✓）。
**搜法与范围** ✓：`tests/` 与 `scripts/` 的全部 `.ts` / `.mts` / `.py` / `.mjs` ✓，模式逐项写明 ✓。

---

# S4 已在案项 ✓（AC-8 ✓）· S5 汇总判定清单 ✓（AC-9 ✓）

## S4 —— 实验 0：**未跑** ✗，原因是环境依赖 ✓

**实验 0**（DSH 的 `workspace-write` 是否真的拒写 workspace 之外 ✓）需要**一个会拒写的会话** ✓ ——
而**本会话不是** ✗：本会话的运行时自述是 `Current DSH file policy: danger-full-access` ✓。
所以按 AC-8 的写法 ✓：**未跑 + 原因** ✗（**不是**"不适用" ✗），并且它**保留阻塞地位** ✓ ——
`09-30-substrate-choice` 的 **AC-8 仍然空着** ✓。没有把"跑不了"记成"已排除" ✓。

**`replaySafe` 两行注释** ✓ → **已开任务** ✓ `10-17-replaysafe-names-a-missing-type` ✓。
理由（量的 ✓）：那条注释说 `replaySafe` 的名字来自 `pi-agent-core` 的 `HarnessTool.replay` ✓，
而 `HarnessTool` 与 `replaySafe` 在四个已装宿主包的**全部** `.d.ts` / `.js` / `.mjs` / `.md` / `.json` 里命中 **0** ✓；
`HarnessTool` 在本仓只出现 **1 处** ✓ —— 就是那条注释本身 ✓。

## S5 —— 汇总判定清单（每条带证据与后续）

| # | 判定对象 | 判定 | 依据（本会话量到的） | 后续 |
|---|---|---|---|---|
| 1 | "反转成本 = 一个 adapter 实现" ✓ | **可行** ✓ | 7/7 具名符号在实装 1.0 命中 ✓ | — |
| 2 | 既有裁决里"`AgentHarness` 若转正是**替换而非重写**" ✓ | **需降级并标注** ✗ | 1.0 的 `pi-agent-core` 里 `harness` 命中 **0** ✓；`AgentHarness`/`HarnessNotImplemented` 在 spec/src/tests 命中 **0** ✓ | **就地标注**在本任务 prd §一 ✓（本任务可改自己的文档 ✓） |
| 3 | `host-version.ts` 识别不了宿主时的行为 ✓ | **需改** ✗ | 实测 `unknown` ✓：1 行输出、无警告、无日志 ✓ | `10-17-host-version-silent-degradation` ✓ |
| 4 | 三处注释钉住宿主细节 ✓ | **需改（低）** ✗ | `work-mode.ts:303` 引用不存在的 `dist/harness/` ✓；`install.ts:95` ✓ 与 `request-lifecycle.ts:162` ✓ 的版本号 | `10-17-host-detail-comments-drift` ✓ |
| 5 | `replaySafe` 注释命名了不存在的宿主类型 ✓ | **需改** ✗ | `HarnessTool` 在四个宿主包 **0** 命中 ✓ | `10-17-replaysafe-names-a-missing-type` ✓ |
| 6 | `plan-v8.md:673` 的"适配器层唯一必需的 pi 包" ✓ | **需改·待批** ✗ | adapter **还**从 `pi-ai` 取两个**类型**（`loop-pi-agent-core.ts:2` ✓），而 `pi-ai` **非**直接依赖 ✓ | **无 task** ✗ —— 要改的是计划册 ✓，而改计划册在本任务的 Out of Scope 里 ✓（需单独批 ✓） |
| 7 | `catalog.ts` 的 `minPi` 与散文版本 ✓ | **可行** ✓ | 1.0 满足全部 `minPi` ✓ | — |
| 8 | `install.ts:266` 硬编码 `dist/bundle/cli.js` ✓ | **可行** ✓ | 实测仍在 ✓ | — |
| 9 | `typebox` 的依赖形状 ✓ | **可行** ✓ | 撤掉操作者的包后警告 **0** 次 ✓ | — |
| 10 | adapter 从 `pi-ai` 取类型而 `pi-ai` 非直接依赖 ✓ | **可行** ✓ | 类型导入 ✓、由 `pi-agent-core` 传递提供 ✓；若断了 **typecheck 会红** ✓（**不是**沉默 ✓） | — |
| 11 | `install.ts:95` 那句"1.0 无公开持久化多源安装 API" ✓ | **未验证** ✗ | 本会话只量了它旁边的版本号 ✓ | 不写成结论 ✓（归 #4 的 AC-3 ✓） |

**每条"需改"都有任务 id** ✓（#3 ✓ #4 ✓ #5 ✓ 各一个 ✓）。**#6 是唯一例外** ✓，理由写明在表里 ✓：它要改的是计划册 ✓。

