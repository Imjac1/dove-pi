# Token Guard & Capability Activation — 实施方案

> 关联:08-28-dove-pi-usage-review | 范围:`src/pi-adapter/extension.ts`、`src/pi-adapter/cache-diagnostics.ts`、`src/core/context-compiler.ts`、`dove_pi.py`
> 原则:每个改动都标注**文件:函数 / 行锚**,可在现行代码上直接落地,离线优先,可配置开关。

---

## 背景(问题→根因)

审查确认两大问题:

1. **前缀无限膨胀 + 全 MISS 冷启动**:会话累积到 18–21 万 token/轮;某 169 轮会话以完整 180k 冷启动结束(cacheRead=0)。
2. **capability/recipe 快速通道从未被调用**:系统提示已有 "Prefer agent_run_capability...",但模型不知道**有哪些** capability、做什么、什么命令对应它,所以只 `bash` 硬写(Desktop 580 次)。

代码事实:`before_agent_start` 是单一收口点(extension.ts L810–880),已有 `getContextUsage()`(返回 tokens/contextWindow)、`getRemainingContextChars()`、`builtSystemPrompt`、append-only 上下文事件。全部修复都在这个收口点内或附近完成,不新增 Pi 依赖。

---

## FIX 1 — 前缀保险丝(prefix fuse)(P0,最大 ROI)

**目标**:不让 prompt 无限逼近窗口,在接近上限前主动降负。这是对 `18-21万 / 181k全MISS` 最直接的拦截。

**位置**:`src/pi-adapter/extension.ts` → `before_agent_start`,紧挨现有 `getRemainingContextChars`(L873 `SwB`)调用之后,`builtSystemPrompt`(L863 `6BY`)之前。

**做法(新增一个 module `src/pi-adapter/context-guard.ts`)**:

```ts
export interface ContextGuard {
  readonly compactAdvised: boolean;
  readonly hint: string | undefined;   // 追加到 workflowHint / custom_message
}

const MAX_CONTEXT_FRACTION = 0.82;      // 会话命中 82% 即告警
const MAX_INPUT_TOKENS = 28_000;        // 可选 hard cap(env: DOVE_PI_MAX_CONTEXT_TOKENS)

export function guardContext(input: {
  tokens?: number | null; contextWindow?: number; mode: AgentMode;
}): ContextGuard {
  const frac =
    input.tokens && input.contextWindow
      ? input.tokens / input.contextWindow
      : 0;
  if (frac >= MAX_CONTEXT_FRACTION) {
    return { componentsAdvised: true, fraction: `⚠ 前缀已用 ${(frac*100).toFixed(0)}%,建议 /compact 释放。` };
  }
  if (input.tokens && input.tokens > MAX_INPUT_TOKENS) {
    return { componentsAdvised: true, fraction: `⚠ 当前累积 ${input.tokens.toLocaleString()} tokens,已超软上限 ${MAX_INPUT_TOKENS}。/compact 或开新会话可避免全量 MISS。` };
  }
  return { componentsAdvised: false, fraction: undefined };
}
```

**接线**:在 `before_agent_start` 里:

- 计算 `guard = guardContext(usage)`;若 `guard.componentsAdvised && ctx.hasUI` → `ctx.ui.notify(guard.fraction, "warning")`(事件返回前只能通知,不阻塞请求)。
- 把同一段文案**追加**到 `requestContextText`(append-only,不破坏缓存前缀——只在过阈值时加,阈值后不再改)。这样模型也读得到,会自己 prompt 用户 compact。
- 若适配到 `getRemainingContextChars` 已返回 `4_096`(接近爆),再降 `maxChars` 到 2k 并压缩项目上下文。

**配置**:`DOVE_PI_MAX_CONTEXT_FRACTION`(默认 0.82)、`DOVE_PI_MAX_TOKENS`(默认 28000)。默认关闭可 `DOVE_PI_PREFIX_FUSE=0`(offline 安全)。

**证据**:当前会话上报 `usage.tokens` 时直接生效;命中即反映在 cache hit(prompt 不再长到 18-21 万)。

---

## FIX 2 — capability/recipe「可调用清单」注入(P1)

**目标**:让模型真正调用 `agent_run_capability`。根因是模型不知道有哪些能力、名称、用途。系统提示只说"要用"没给名单。

**位置**:`src/pi-adapter/extension.ts` → `before_agent_start`,在构造 `builtSystemPrompt` 前(L863 `6BY` 上一行)注入;同时 `src/core/capability-registry.ts` 加一个导出 `listCapabilityIndex()`。

**做法(新增轻量索引,限制在 ~400 token 内)**:

```ts
// capability-registry.ts
export function capabilityIndex(caps: readonly CapabilityDefinition[]): string {
  return caps
    .map(c => `${c.name} — ${c.description} (${c.sideEffects.join(",")}}`)
    .join("\n");
}
```

`extension.ts`:

```ts
const capHint = `\n[DOVE CAPABILITIES]\n${capabilityIndex(registry.list())}\n可用 recipe: ${recipes.list().map(String).join(", ")}\n`;
const builtSystemPrompt = `${event.systemPrompt}\n\n[PERSONAL AGENT]\nPrefer agent_run_capability or agent_run_recipe for registered deterministic work... ${...}${capHint}${webAccessPolicy}`;
```

- 只在 `shouldAppendContext`(epoch 变化)时重算一次,避免每轮重排 cache 前缀(存量调用都是注册不变的,清单基本固定,churn 小)。
- **保真**:注册的命令用 `dev.typecheck`→"npm run typecheck"。当模型在 tool_result 里调了等价的 bash 时,不阻止,但可在 tool_result 顶部贴一条"可改用 agent_run_capability dev.typecheck"——通过 touch `tool_result` 里已压缩返回对象(`extension.ts` L791-797 已在此处做 compact)。

**语义**:这个清单是静态的、离线本地,无网络;清单长度受控(当前仅 7 dev.*+ 2 web.* + 1 windows.*)。

---

## FIX 3 — hashline 编辑器跨仓库对齐(P1)

**位置**:`dove_pi.py`(install)+ `src/pi-adapter/tool-profile.ts` 的 hashline 判断。

**现象**:pi-agent 会用 replace/insert(先跑),Desktop 仍 8 次 edit。已确认 hashline(hasHashlineEditTools)在两边工具名存在时都做了 `删除 edit 保留 replace/insert` 的逻辑;差异来自**两台机器的 Pi 版本/扩展不同**,导致 Desktop 的 host 没暴露 hashline 工具名。

**解法**:在 `dove-pi doctor` 增加 `tools` 检查项:打印当前 host 是否识别 `replace/insert`(hashline),若不是则给出 `dove-pi install --profile dev` 或升级 Pi 提示。不强制改代码,是**诊断 + 安装动作**。新增 `pi-adapter/tool-doctor.ts`:`doctorToolsConsistency(allToolNames)` 返回 mismatch,发到 doctor 命令。

---

## FIX 4 — 冷启动缓解:会话亲和保活(可选,P0.5)

**位置**:`src/`. 新增 `src/adapter..ts keepalive`(与 before_provider_headers 同 adapter 层)。

**做法(离线可选,默认关闭)**:

- 在做完 `before_provider_headers` 设置 `x-session-affinity` 后,Pi 已经在每个请求携带同 sessionId → 上游会复用前缀。真正冷启动只发生在会话**开新**或**同会话但超时**。
- 所以最省钱:不要发心跳。改为**在前端新会话 first request 前,先做一次 → 拦截冷启动**并不现实(无网络)。
- **改成文档 + 自动 /compact**: 新会话不要全部塞 `requestContextText` 历史?不应——历史已在 session 文件。　模型冷启动成本只可能通过**更早读较细 compaction**降(已在上 FIX1)。

**结论**:FIX1(DOVE 层建议 compact + 降maxChars)是主解;保活给 `DOVE_PI_SESSION_KEEPALIVE_MIN` 可选用(写一个每分钟、让 Pi 侧释放历史轮)但**需要 network → 默认 off,offline-first 遵守**。

**我们不做的**:不发无意义模型请求去"预热"前缀(代价大于收益)。

---

## FIX 5 — context-compiler 覆盖面补全(P1,边际)

**位置**:`src/core/context-compiler.ts`(文档压缩)。

**质量优先决策:Ultra 预算保持无限。** `contextBudgetChars("ultra")` 维持 `Infinity` 不回退——Ultra 是"尽力模式",砍它的上下文预算可能丢弃模型所需的相关文档,反而有害质量。

投入使用方向:上下文压缩(compact)只由模型真实窗口(`getRemainingContextChars`)和 FIX1 建议性 guard 驱动,不从 dove-pi 侧硬性卡 Ultra 预算。

**质量护栏:任何预算调整都不得静默丢弃用户/对话历史**,只允许压缩非必要的项目文档块(已有 `skip_context` 语义),且以"建议 /compact"而非自动删除的方式处理会话累积。

---

## FIX 6 — 派生子代理真正用起来(P2)

**问题**:dispatch-policy 代码完备,但 `bg_delegate` 只用了 1 次。同样根因:**模型不知道何时该派、代价收益**。

**方案**:这属于「auto 工具意图正则」,在 `tool-profile.ts` 的 `INTENT_TOOL_NAMES` 已匹配 `delegate/background`。真正缺的是:模型在复杂任务时选择。补 = 在 `builtSystemPrompt` 加一句"当任务可拆分为 ≥2 个独立分支且超 60s,考虑用 bg_delegate/fusion 并行,评估收益高于协调开销"。固定文案,零代码成本(在 FIX2 的 builtSystemPrompt 一并注入)。

---

## FIX 7 — 可观测性:把审查的账本做成常驻命令(P3)

**位置**:`src/cli.ts` + 新增 `src/commands/token-audit.ts`。

**目标**:把我在审查中手工做的分析,变成 `dove-pi audit` 命令,复现:

- 读 `~/.pi/agent/sessions/*` 的 usage(live 已有 cache-diagnostics 样例行),汇总 per-project 的 input/cacheRead/output/命中率。
- 输出 markdown 表格(与 prd §1 一致)。
- 加 `--since=24h` 过滤,考虑成本(按当前 provider 单价可配置)。

**外加**：把 `formatCacheDiagnostics` 接到 `ctx.ui.setStatus` 的 footer(path 的 dove status 里已有)
---

## 落地顺序与验收(可离线逐项)

| # | 改动 | 文件 | 验收假 | 触碰 token? |
| --- | --- | --- | --- |
| 1 | prefix fuse | 新 prefix-guard.ts + extension.ts | 长会话接近 82% 给出 /compact 提示;prompt 仍增长但 < 历史上 211k 并在通知后回落 | ⬇️ |
| 2 | capability index 注入 | extension.ts + capability-registry | 会话中出现 `agent_run_capability dev.typecheck` ≥1 | ⬇️(复用替代 bash 重写) |
| 3 | hashline 对齐诊断 | tool-profile + cli doctor | doctor 报告两 host 工具集差异 | — |
| 4 | keepalive(off) | 新 (off) | 默认 off;开时 output 无多开销 | — |
| 5 | Ultra 预算保持无限(质量优先) | context-compiler(不改) | Ultra 不被砍预算;只受模型真实窗口保护 | — |
| 6 | 派生子代理提示 | builtSystemPrompt | 并行任务时用 bg_delegate | ⬇️ |
| 7 | say token-audit | cli.ts + token-audit.ts | `dove-pi token audit --since=1d` 输出表 | — |

## 已实现(两批,全部质量安全)

**第一批(省 token + 提质量核心)**:
- **FIX1 prefix fuse**: `src/pi-adapter/context-guard.ts` + `extension.ts`;82% 分数或 28k 绝对上限触发;仅 UI 通知 + append 上下文(建议 /compact),**绝不自动删历史**;`DOVE_PI_PREFIX_FUSE=0` 关闭。
- **FIX2 capability 清单**: `buildCapabilityIndex()` 注入 system prompt,列出已注册能力+recipes;FIX6 派生子代理指引一并注入。

**第二批(对齐 + 可观测)**:
- **FIX2b capability 复用提示**: tool_result 拦截 bash/powershell 命中已注册能力命令时,前置一小行"改用 agent_run_capability <name>"提示(纯建议,不阻塞/不改写)。contracts 增 `hintCommands`,commandCapability 填充。
- **FIX3 hashline 对齐诊断**: session_start 检测 host 是否有 hashline(replace/insert/undo),缺且有 edit 时 UI warning 提示升级/install。
- **FIX7 `dove-pi token audit`**: 新 `src/commands/token-audit.ts` + cli.ts 接线;聚合 `~/.pi/agent/sessions/*` 每项目 input/cacheRead/write/output, 支持 `--since=Nh` `--filter=substr`, 输出 markdown 表。

**验证(第一批/第二批)**: typecheck ✅ · 测试 94 全过 ✅ · extension 加载 ✅ · pi:smoke ✅ · `token audit` 实测 ✅。

**第三批(上下文缓存命中率优化——检测工具 + 根因修复)**:
- **检测工具 `dove-pi cache audit`**(新 `src/commands/cache-audit.ts` + cli.ts):逐会话报告请求数/会话命中%/末次命中%/warmup/全MISS/末次miss原因/未缓存input,支持 `--min-requests=N` `--filter=substr` `--below=0.8`(= 或空格两种参数形式)。
- 实测(真实会话 1816 请求):**总体命中 90.6%(请求)/89.9%(token)**,但 157 次全 MISS、~29M 未缓存 input,**miss 原因以 prefix-change 为主**(warmup 仅 1/会话预期;idle 少量)。
- **根因 1(主)**:`before_agent_start` 的 epoch 原含 `suggestion?.skill`(随用户措辞意图翻转)与 `toolEpoch`(随 auto 工具增长变化),导致**每轮意图切换都重建上下文消息 → provider 前缀失效 → 全 MISS**。修复:epoch 仅保留 `mode + project revision`。
- **根因 2**:`contextRevision` 原计入 memoryFiles(workspace index + journal-N.md 每次会话都追加),导致**journal 写入也翻转前缀**。修复:从 revision 中排除 memoryFiles(内容仍会在真实变更时重读)。
- 测试同步更新:pi-adapter 断言改为验证"意图翻转不重建快照"(原断言固化了旧行为);+3 cache-audit 测试。**97 全过** ✅ typecheck ✅ extension 加载 ✅。

## 测试结果(能力提升 + token 消耗实测)

用 `scripts/measure-optimization.mts`(导入真实 capabilities + 扫真实会话)实测:

**A. 注入开销(成本侧)**: `[DOVE CAPABILITIES]` 313 token/轮 + dispatch 83 = 约 438 token/轮固定开销。占 18–21 万前缀 <0.03%(微小), 换来模型知道并复用确定性工作。

**B. capability 复用命中(质量侧)**: 981 次 bash/powershell 调用,初版 exact 匹配 0 命中(真实命令是 `cd … && npm run typecheck 2>&1 | tail`);改进匹配器(剥 cd 前缀+去尾管道)后命中 25 次(typecheck 18 / test 7)。

**C. prefix-fuse 节省潜力(token 侧最大杠杆)**: 148/1740 样本 input>20k(8.5%);155 次全 MISS(prompt>10k、cacheRead=0)累计 ~22.65M uncached input;峰值单请求 413k。fuse 提示/用户 compact 可命中这些冷启动。

## 需要确认的开关决策(已按质量优先定稿)

- `DOVE_PI_MAX_TOKENS` 默认 **28000**;模型窗口由 `usage.contextWindow` 自动探测,guard 采用 min(frac 0.82, 28000) 双保险。
- **Ultra 预算保持无限**(质量优先,不改 `contextBudgetChars`)。
- `keepalive/FIX4` 保留但默认 off(不发无意义网络请求)。
- `token-audit` 作为 CLI 子命令 `dove-pi token audit`。

## 质量保障声明(本次实现遵守)

1. **绝不自动删用户/对话历史**:guard 只提示 `/compact`,由用户决定;不做静默 truncate。
2. **Ultra 预算不动**:避免因省 token 丢弃模型所需项目文档。
3. **capability 清单只增不误导**:注入的能力名与会话中已注册的完全一致,不改变模型可选工具语义,只补齐"该用哪个"的锚点 → 减少猜 bash、错误更少。
4. 全部改动集中在 `before_agent_start` 可观测单点,离线可用,可随时通过 `DOVE_PI_PREFIX_FUSE=0` 关闭。
