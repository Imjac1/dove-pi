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

