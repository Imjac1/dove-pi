# 「声明了但没人兑现」这一族：逐条修复设计（B 级十条）

**本文是什么**：`findings.md` §四 B 级十项的设计输入。每条回答五个问题：今天的事实、最高可行层级（含"为什么更高层级在本仓库不成立"）、具体改动（删除/命名/接线）、让回归不可能的检查与**必须变红的 fixture**、影响面。
**本文不是什么**：没有改任何产品文件，没有跑构建或测试，没有提交。所有 `path:line` 是我读出来的行号（`read` 工具编号），引文逐字来自该行。凡我未验证的，写 `unverified` 并给出验证路径。
**纪律来源**：pstack `skills/correct/SKILL.md`（原文见 `research/pstack-upstream.md`）与 `tests/invariants.test.mjs:1-4` 的"每个静态检查都必须配一个能让它红的 fixture"。本仓库自己的两条约束贯穿全文——"no speculative validators"（不新增没有消费者的校验）与"subtract before you add"（先减后加）：**凡机制无消费者，优先删除；只有在删除会丢掉一个仓库存档过的决定时，才接线。**

---

## 1. `ENFORCEABLE_SANDBOX`：一个没有任何读者的"可兑现集合"

### 1.1 今天的事实

- 定义：`src/core/work-mode.ts:207`
  `const ENFORCEABLE_SANDBOX = new Set(["network: none", "filesystem: read-only-source"]);`
  （其上的注释 `src/core/work-mode.ts:206`：`/** The isolation claims a host can actually enforce at its tool boundary, without an OS sandbox. */`）
- 全仓库对该标识符只有这一处命中（`rg -n ENFORCEABLE_SANDBOX` → 1 行）。它是模块私有常量，未导出，因此"改它"在任何路径上都不改变行为。
- 真正的装载期拒绝在 `src/pi-adapter/extension.ts:2250-2261`，按 **字面量** 判定：
  - `src/pi-adapter/extension.ts:2253`：`if (sandbox.isolation === "container" || sandbox.isolation === "worktree") unenforceable.push(\`isolation: '${sandbox.isolation}' requires an OS sandbox this runtime does not provide\`);`
  - `src/pi-adapter/extension.ts:2254`：`if (sandbox.network === "allowlist") unenforceable.push(\`network: 'allowlist' requires an egress control this runtime does not provide\`);`
  - `src/pi-adapter/extension.ts:2257`：`` ` The enforceable claims are network: 'none' and filesystem: 'read-only-source' (both checked at the tool boundary), plus isolation: 'none' with network: 'unrestricted'.` + ``——这一句是 `ENFORCEABLE_SANDBOX` 内容的**第二次手抄**。
- 边界强制在 `src/core/action-policy.ts:620-642`：只有两个分支，`sandbox.network === "none" && NETWORK_TOOLS.has(...)`（`:622`）与 `sandbox.filesystem === "read-only-source" && FILESYSTEM_MUTATORS.has(...)`（`:632`）。
- 词汇表在 `src/core/work-mode.ts:203-205`：`SANDBOX_ISOLATION = {none, container, worktree}`、`SANDBOX_NETWORK = {none, allowlist, unrestricted}`、`SANDBOX_FILESYSTEM = {unrestricted, ephemeral, read-only-source}`。
- **我新测到的一个洞**（不在原审计里，属于同一族）：`filesystem: ephemeral` 未被装载期拒绝，也未被边界强制。装载期只在一种组合下拒绝它——`src/core/work-mode.ts:760-761`：`if (sandbox.isolation === "none" && sandbox.filesystem === "ephemeral") { throw new WorkModeError("invalid-type", "governance.sandbox declares 'isolation: none' with 'filesystem: ephemeral', …`。`isolation` **缺省**时该分支不触发（`:751` 的 `readField` 对缺失字段返回 `undefined`），而 `src/pi-adapter/extension.ts:2253` 只匹配 `container`/`worktree`，于是 `filesystem: ephemeral`（不写 `isolation`）装载成功、既不拒绝也不强制。
- 该洞已被文档否认：`modes/trading/governance.yaml:41` 写 `` # this runtime does not have. `container`/`allowlist`/`ephemeral` would refuse to load. ``——对 `ephemeral` 这句话只在写了 `isolation: none` 时为真。

### 1.2 最高可行层级：**architecture（把判定收敛到一处）**

本仓库不需要新增校验，需要的是把"哪些 claim 可兑现"这一个判定放回词汇表所在的模块，让适配器读判定而不是复述字面量。为什么更高的层级不成立：

- **类型层收窄词汇表不成立**，因为拒绝的理由比拒绝本身更重要。`src/pi-adapter/extension.ts:2247-2249` 明写模式作者的两条出路要**被点名**：`The mode author's two ways out are named: declare what the runtime can honour (enforced at the tool boundary), or run the mode under a host that provides the isolation.` 把 `container` 从 `SANDBOX_ISOLATION` 里删掉，会把这个"点名理由"的拒绝降级成 `unknown value` 错误（`src/core/work-mode.ts:747` 的同一模板），而 `personal-agent-framework-core.md` 记录的正是"load 期拒绝必须点名理由"。
- **删除 `ENFORCEABLE_SANDBOX` 不成立**，因为 `src/pi-adapter/extension.ts:2257` 那句可兑现清单必须有个来源，否则下一次改词汇表又是三处手抄——这正是 `src/core/action-policy.ts:28-31` 已经总结过的失败形状：`**The union is maintained here rather than imported, and that is deliberate.** … Without that test this constant is how a third list would quietly appear beside the two that already disagree.`

### 1.3 具体改动（**接线 + 删除**）

- 就地接线：把 `src/core/work-mode.ts:207` 的常量导出，并新增一个从**同一批集合**（`SANDBOX_ISOLATION`/`SANDBOX_NETWORK`/`SANDBOX_FILESYSTEM`，`src/core/work-mode.ts:203-205`）派生的判定，对每个已声明的 claim 回答"边界强制 / 装载期拒绝（附理由）/ 不声明控制"三选一。
- 删除：`src/pi-adapter/extension.ts:2252-2258` 的三条字面量 `if` 与那句手抄清单，改为读上面的判定与理由；拒绝文本由数据生成。
- 顺带关掉 1.1 的洞：`filesystem: ephemeral` 落进"装载期拒绝"桶（没有隔离就没有 ephemeral 文件系统，`src/core/work-mode.ts:759` 的注释已经这么说了，只是漏了 `isolation` 缺省这一支）；同时把 `modes/trading/governance.yaml:41` 的断言改写成"这三种 claim 在没有隔离提供者时拒绝装载"。
- 不新增文件、不新增常量：派生判定住在 `work-mode.ts`，与词汇表同处一地。

### 1.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（新用例，宿主 `tests/work-mode.test.ts`——它已经拥有 loader 与格式校验）：把三个词汇表的**每一个成员**跑一遍上面那个判定，断言每个成员恰好落进一个桶（强制 / 拒绝 / 不声明控制），且"拒绝"桶的成员与 `src/pi-adapter/extension.ts:2250` 实际拒绝的成员集合相等。这直接使"改了词汇表但没改判定"变红。
- **必须变红的 fixture（今天就是红的，不是我造的）**：`filesystem: 'ephemeral'` + 不写 `isolation`。按 1.1 的读法它今天落不进任何桶——检查第一次跑就会报它。这满足 pstack 的"每个检查配一个能让它红的 fixture"，而且是真实输入而不是种子。
- 第二个 fixture（种子）：把判定函数用一个词表外的 claim 调用一次（例如 `network: 'tunnel'`），断言它返回"未分类"而不是静默通过。**理由**：只有真 fixture 会被未来某次词汇表扩容绕过（新成员没有任何桶），种子的作用是证明检查对"未分类"这一分支真的会红。
- 装载层的那一半（拒绝文本）作为**对既有用例的编辑**落在 `tests/host-work-mode.test.ts:711-731`：该用例今天只 `assert.match(refusal ?? "", /network: 'none'/)`（`:725`），改成断言拒绝文本逐条列出与判定桶一致的 claim（含新增的 `ephemeral`）。`:716` 的 fixture 已经同时写了三种 claim，因此这个编辑不需要新 fixture。

### 1.5 影响面

- 改动文件：`src/core/work-mode.ts`、`src/pi-adapter/extension.ts`（约 2250-2261 一段）、`modes/trading/governance.yaml`（一行注释）。测试：`tests/work-mode.test.ts`（新用例）、`tests/host-work-mode.test.ts:711-731`（编辑）。
- 行为变化：`filesystem: ephemeral` 且未声明隔离的模式从"静默通过"变为"拒绝装载"。已发货的四个模式**没有**声明 `ephemeral`（`rg -n ephemeral modes` → 只命中 `modes/trading/governance.yaml:41` 的注释），所以这条拒绝今天不改变任何已发货模式。
- `.trellis/harness-surface.yaml`：无需改路径（`work-mode.ts` 不在七组件里；`middleware`（`.trellis/harness-surface.yaml:21`）已含 `src/core/action-policy.ts` 与 `src/pi-adapter/extension.ts`）。`src/core/task-convergence.ts` 的 `CHANGE_SURFACES`（`src/core/task-convergence.ts:854-856`）无需改：组件名没变。

---

## 2. `readOnlyToolHardStopThreshold`：一个被算、被传、被打印、从不比较的天花板

### 2.1 今天的事实

- 声明：`src/pi-adapter/progress-guard.ts:25` `readOnlyToolHardStopThreshold?: number;`（在 `ProgressRunOptions` 里，`:23-26`）。
- 存储与归一化：`src/pi-adapter/progress-guard.ts:194`（私有字段）、`:227-229`（`this.readOnlyToolHardStopThreshold = optionalPositiveInteger(...)` 后只做 `Math.max(this.readOnlyToolWarningThreshold, this.readOnlyToolHardStopThreshold)`）、`:418`（`reset()` 归 `undefined`）。
- **比较点：无。** 唯一会触发的兄弟是 `src/pi-adapter/progress-guard.ts:369`：`if (!result.isError && result.idempotent && this.readOnlyToolWarningThreshold !== undefined && this.state.readOnlyToolCalls >= this.readOnlyToolWarningThreshold && !this.readOnlyBudgetWarningIssued) {`。同一文件里另外两个 `*HardStopThreshold` 都有比较点：`:263`（`repeatCount >= this.interactiveQuestionHardStopThreshold`）与 `:278`（`previous.count >= this.repeatedSuccessHardStopThreshold`）——`readOnlyToolHardStopThreshold` 是三者中唯一没有的。
- 代码自己承认它不强制：`src/pi-adapter/progress-guard.ts:281-284`
  `// The historical read-only hard-stop is retained as diagnostic metadata,` / `// but a raw call count is not evidence of stagnation. Productive reads` / `// with changed inputs/observations must remain executable; semantic` / `// repetition is enforced by the fingerprint check above.`
- 但投影与打印仍把它当上限：`src/pi-adapter/extension.ts:980` `readOnlyBudget: { used: progress.readOnlyToolCalls, warning: readBudget.readOnlyToolWarningThreshold, hardStop: readBudget.readOnlyToolHardStopThreshold },`；`src/core/strategy-snapshot.ts:153` 打印 `readOnly=${snapshot.readOnlyBudget.used}/${snapshot.readOnlyBudget.hardStop ?? "unknown"}`。
- 同一文件隔两行已经把这个形状判过一次：`src/core/strategy-snapshot.ts:148-150`
  `// **A count, not a budget.** Nothing fills a provider-round limit any more, so the used/limit form would print a` / `// ceiling that does not exist - providerRounds=3/unknown reads as a budget nobody enforces. The read-only line` / `// below still prints one because it has real thresholds.`
  最后一句是**错的**：它下面那行的第二个数正是 2.1 段里无比较点的那个。这是全仓库离缺陷最近的一句话。
- 数字来源：`src/pi-adapter/extension.ts:3464-3486` 的 `readOnlyToolBudget`：`:3466`（task-inventory `{warning: 1, hardStop: 2}`）、`:3467-3483` 三模式三 intent 的九对数字、`:3484` 解构、`:3485` 返回。调用点只有两处，都在产品里：`src/pi-adapter/extension.ts:963`（状态投影）与 `:2345`（`progressGuard.start(Date.now(), readOnlyToolBudget(...))`）。
- 测试只钉"被传递/被计算"：`tests/pi-adapter.test.ts:1077-1079`（`assert.deepEqual(readOnlyToolBudget(...), { readOnlyToolWarningThreshold: 6, readOnlyToolHardStopThreshold: 12 })` 等三条），以及 `:1065` 的 `guard.start(1_000, { readOnlyToolWarningThreshold: 2, readOnlyToolHardStopThreshold: 3 })`；同用例标题（`tests/pi-adapter.test.ts:1063`）是 `"warns but allows varied read-only exploration beyond the historical request budget"`——即行为是"不终止"，被断言的是数字。
- 文档是诚实的，字段名不是：`README.md:326` 写"只读预算中的 `hardStop` 字段保留用于兼容和观测；它是历史请求数提示，不会单独终止产生新观察的读取"；`.trellis/spec/backend/personal-agent-request-runtime.md:63` 写 `The read-only budget is advisory metadata, not an unconditional terminal: changing reads continue past its historical threshold.`

### 2.2 最高可行层级：**type（把字段删掉）**

- **architecture 不成立**，因为"让它真的终止"与仓库已经存档的决定冲突：`src/pi-adapter/progress-guard.ts:281-284`（代码）、`.trellis/spec/backend/personal-agent-request-runtime.md:63`（规范）、`README.md:347`（"只读请求数达到历史阈值也仅产生 advisory"）三处一致。把 advisory 变成 control 是新增一个没人要求的控制，正好犯 "subtract before you add" 反对的错。
- **check 层单独用不成立**，因为名字本身是错的：`readOnlyToolHardStopThreshold` 读起来就是一个天花板，`src/core/strategy-snapshot.ts:153` 的 `used/limit` 形式会把它渲染成上限。一个只喊"别改这个数"的检查修不了命名。
- 因此停在类型层：**把这个字段从两个接口里删掉**。删掉之后，`used/limit` 那个渲染形式写不出来，因为类型的第二个数不存在；而 `src/core/strategy-snapshot.ts:148-151` 已经给出了同一缺陷的既有修法（providerRound 保留字段、改打印形式），本条的额外一步是把**输入侧的字段**也删掉——否则它继续在 `ProgressRunOptions` 里读作可配置的强制点。

### 2.3 具体改动（**删除**）

- `src/pi-adapter/progress-guard.ts`：删 `readOnlyToolHardStopThreshold`（`:25` 的接口字段、`:194` 的私有字段、`:227-229` 的赋值与 `Math.max`、`:418` 的重置）。
- `src/pi-adapter/extension.ts`：删 `readOnlyToolBudget` 的第二个返回值，于是 `:3466` 与 `:3467-3483` 的九对数字变成单个数字，`:3484-3485` 相应收窄；删 `:980` 的 `hardStop:` 属性。
- `src/core/strategy-snapshot.ts`：删 `StrategyBudgetSnapshot.hardStop`（`:11`），并把 `:153` 的模板改成只打印 `used`；同时把 `:148-150` 那条注释最后一句改掉（"The read-only line below still prints one because it has real thresholds" 在改动后不再成立，且它现在就是错的）。
- 文档（最后、但同一次改动内）：`README.md:326` 与 `.trellis/spec/backend/personal-agent-request-runtime.md:63` 里对 `hardStop` 字段的引用要随字段消失而改写（保留"只读预算是 advisory"这句话，删除对字段名的指名）。
- 不新增任何机制。

### 2.4 让回归不可能的检查 + 必须变红的 fixture

- 检查 A（行为，宿主 `tests/pi-adapter.test.ts`，**编辑既有用例** `:1063-1080`）：写一个"声明的选项键必须被读"的探针——对 `readOnlyToolBudget(...)` 返回的每一个键，在若干个取值上跑一遍 `ProgressGuard`，把 `beforeToolCall(...).action` 与 `recordToolResult(...)?.kind` 的轨迹记下来；**某个键在整个取值空间里都不改变轨迹，就报它**。断言这个报告为空。`:1063-1075` 已经证明"越过阈值仍然 allow"是设计，因此这不会与既有断言冲突。
- 检查 B（形态，宿主 `tests/strategy-snapshot.test.ts`，**编辑既有用例** `:19`）：断言 `formatStrategySnapshot` 的 `readOnly=` 段不含 `/`（即没有第二个数）。`:19` 今天构造了 `readOnlyBudget: { used: 3, warning: 6, hardStop: 12 }`，删字段后该字面量会**编译失败**——类型门本身就是第一道红。
- **必须变红的 fixture**：
  - 检查 A 的种子：把 `{...readOnlyToolBudget(...), aKeyNothingReads: 1}` 交给探针，断言报告正好是 `["aKeyNothingReads"]`。**理由**：删除之后产品里已经没有"未被读的键"可作为反向 fixture，只有种子能证明这个检查对"未读键"这一分支真的会红（本仓库的同类先例是 `tests/document-drift.test.ts:187-204` 与 `:291-303` 的种子双测）。
  - 检查 A 的真实锚点：改动**前**跑一次，探针必须报 `readOnlyToolHardStopThreshold`——这是这个检查不是空转的证据。

### 2.5 影响面

- 产品：3 个文件（`progress-guard.ts`、`pi-adapter/extension.ts`、`strategy-snapshot.ts`）。测试：`tests/pi-adapter.test.ts`（编辑 `:8` 的导入无关；`:1065`、`:1077-1079`）、`tests/strategy-snapshot.test.ts:19`、`tests/local-rpc.test.ts:128`（fixture 里手写了 `hardStop: 20`，会编译失败）——共 3 个测试文件。
- **对外形状变化**：`src/core/strategy-snapshot.ts` 的 `StrategyBudgetSnapshot` 是 `agent_doctor`/`/status full`/`diagnostics/status` 与 `src/adapters/local-rpc.ts` 共用的投影（`schemaVersion: 1`）。删字段会让读 `hardStop` 的外部读者拿到 `undefined`。`README.md:326` 说的"保留用于兼容"是唯一的反对意见；**替代方案**（如果这个形状必须不动）：保留 `StrategyBudgetSnapshot.hardStop` 这个通用槽位但让 `readOnlyToolBudget` 只返回 warning，并删掉 `src/core/strategy-snapshot.ts:153` 的 `/${...}`——代价是留下一个永远为 `undefined` 的字段（与 `providerRound.limit` 同形，`src/core/strategy-snapshot.ts:151` 已经接受了这种留法）。二选一必须显式选，不能默认。
- `.trellis/harness-surface.yaml`：不需要改路径；但 `middleware`（`:21`）已含 `src/pi-adapter/extension.ts` 与测试，`tool-implementation`（`:20`）含 `src, tests`，都已覆盖。`CHANGE_SURFACES`（`src/core/task-convergence.ts:854-856`）不变。

---

## 3. `getProjectContextBudget` 的 `promptChars`：被声明、被计算、被传入，函数体从不读

### 3.1 今天的事实

- 签名：`src/pi-adapter/extension.ts:3438-3442`
  `export function getProjectContextBudget(input: {` / `tokens?: number | null;` / `contextWindow?: number;` / `promptChars?: number;` / `}): number | undefined {`
- 函数体（`:3443-3450`）只读 `input.contextWindow` 与 `input.tokens`：
  `const observedTokens = Math.max(0, input.tokens);` / `const responseReserve = Math.min(8_192, Math.max(2_048, Math.floor(contextWindow * 0.1)));` / `const remainingTokens = contextWindow - observedTokens - responseReserve;`
- 两个调用点都传了它，两个都没有被读：
  - `src/pi-adapter/extension.ts:3241-3242`：`const promptChars = event.systemPrompt.length + event.prompt.length;` / `const remainingContextChars = getProjectContextBudget({ tokens: usage?.tokens, contextWindow, promptChars });`（`promptChars` 只被用来传给这个不读它的参数）
  - `src/pi-adapter/extension.ts:984`：`doveBudgetChars: getProjectContextBudget({ tokens: usage?.tokens ?? undefined, contextWindow, promptChars: contextText.length }),`
- 它上方的注释说的是另一件事，而且属于**另一个函数**：`src/pi-adapter/extension.ts:3416-3419`
  `/**` / ` * Reserve a small amount of headroom for the current user turn and the model` / ` * response. Ultra has no fixed Dove token cap, but it must still respect the` / ` * active model's real context window when Pi exposes one.` / ` */`——这段紧贴在 `getRemainingContextChars`（`:3420`）之上，不在 `getProjectContextBudget`（`:3438`）之上。
- 真正的兜底在上游：`src/pi-adapter/extension.ts:3316-3347` 用 `ModelGateway.validate`（`:3325`）把 `builtSystemPrompt`、`event.prompt`、`messageForTurn` 三段一起校验，超限则丢掉项目上下文并写 `:budget-omitted`（`:3341`）。因此"本回合自身长度"这件事**已经在别处被算过**。
- `promptChars` 既没有落账也没有断言：`rg -n promptChars src/pi-adapter/extension.ts` → `984, 3241, 3242, 3441`，函数体区间内零命中。

### 3.2 最高可行层级：**type/architecture（删参数），不是"读它"**

- **读它不成立，因为正确性未知**：`input.tokens` 来自 `ctx.getContextUsage()`（`src/pi-adapter/extension.ts:3239` 与 `:960`），而 Pi 侧的 usage 是否已包含本回合新加的 prompt，本仓库没有读数可以证明。再减一次 `promptChars` 可能重复扣减，把预算凭空缩小——那是用一个新的猜测替换一个旧的遗漏，而且是 `unverified` 的猜测（验证路径：`@earendil-works/pi-coding-agent` 的 `getContextUsage` 实现，本仓库不拥有）。
- **"更长的 prompt 必须自动缩小预算"这个规则已经有强制点**，就在 `src/pi-adapter/extension.ts:3316-3347`（真 payload 预检 + `:3341` 的 `:budget-omitted`）。按 pstack 的梯队，这条规则已经在"架构"层（真正的组装点）被强制，`promptChars` 是同一规则的第二个、没有比较的实现。高层级已经占位，剩下的动作是**减法**。
- 与第 6 条（`getRemainingContextChars`）是**同一次改动的两半**：删掉那个死函数、把它的那段落位注释（`:3415-3419`）合并到 `getProjectContextBudget` 之上、并删掉 `promptChars`。三个动作合起来把"项目上下文预算"收敛成一个函数、一条规则、一段说明。

### 3.3 具体改动（**删除**）

- 删 `src/pi-adapter/extension.ts:3441` 的 `promptChars?: number;`。
- 删 `:3241` 的 `const promptChars = …` 与 `:3242` 的实参（该表达式没有别的读者）。
- 删 `:984` 的 `promptChars: contextText.length`。
- 把 `:3415-3419` 那段注释移到 `getProjectContextBudget` 之上，并把 `responseReserve`（`:3447`）说明为"本回合与模型回复共同的预留"——这正是那段注释今天的说法，删掉参数等于让代码回到注释描述的行为。
- （与第 6 条合并执行）删 `getRemainingContextChars`（`:3420-3430`）。

### 3.4 让回归不可能的检查 + 必须变红的 fixture

- 检查：与第 2 条同一个"声明的选项键必须被读"探针，作用于 `getProjectContextBudget`——对 `{tokens, contextWindow, promptChars}` 的每个键在若干取值上比较返回值，键不改变结果就报它。宿主 `tests/pi-adapter.test.ts`（**编辑既有用例** `:1451-1458`；`:1451` 与 `:1454` 今天传的 `promptChars: 18_000` / `promptChars: 1_000` 是两条**空转断言**——它们返回 `undefined` 的原因是缺 `tokens`，与 `promptChars` 无关，正好是"只断言声明形状"的例子）。
- **必须变红的 fixture**：
  - 种子：把 `{tokens: 10_000, contextWindow: 200_000, aKeyNothingReads: 1}` 交给同一个探针（探针按参数对象取键，不按类型），断言报告 `["aKeyNothingReads"]`。
  - 真实锚点：改动前把 `promptChars` 传给探针，报告必须含 `promptChars`。
- 不新增测试文件：探针与第 2 条共用一份，宿主同为 `tests/pi-adapter.test.ts`。

### 3.5 影响面

- 产品：1 个文件（`src/pi-adapter/extension.ts`，三处 + 一段注释）。测试：1 个文件（`tests/pi-adapter.test.ts` 的 `:1451`、`:1454` 两个 case 需重写为真断言或删除）。
- 行为：**不变**。这是本条的关键：删的是没有读者的输入，不是算法。项目上下文字符预算在 `:3447-3450` 的算式前后完全一致。可验证的方式是在改动前后各跑一次 `tests/pi-adapter.test.ts` 的预算用例（我未执行，`unverified`；验证路径：`npm test -- tests/pi-adapter.test.ts`）。
- `.trellis/harness-surface.yaml`：`tool-implementation`（`:20`）含 `src`，无需改；`CHANGE_SURFACES` 不变。`src/core/task-convergence.ts` 不涉及。

---

## 4. dispatch policy：零产品调用者的一整套契约

### 4.1 今天的事实

- 定义：`src/core/dispatcher.ts:29` `export async function executeDispatch<TResult>(work: DispatchWork<TResult>): Promise<DispatchOutcome<TResult>> {`；`src/core/dispatch-policy.ts:3` `export function decideDispatch(estimate: DispatchEstimate, hasLongRunningIsolation = false): DispatchDecision {`。
- 调用点全在测试：`tests/core.test.ts:238,251,271,284,296,314`、`tests/strategy-evaluation.test.ts:18,32,40`（`rg -n "executeDispatch|decideDispatch" src` → 只有 `src/core/dispatcher.ts:30` 与 `src/core/dispatch-policy.ts:3` 这两个定义/内部调用）。
- 它已经被自己的门"放行"：`tests/harness-reachability.test.ts:93-94`
  `"src/core/dispatcher.ts": { reason: "pre-existing, from before the framework work; no milestone claimed it while that task was open, and none has since", wiredBy: null },`
  `"src/core/dispatch-policy.ts": { reason: "pre-existing, from before the framework work; no milestone claimed it while that task was open, and none has since", wiredBy: null },`
  该文件的规则（`:14-19`）：`a module unreachable and NOT listed -> fail (new dead code arrived)` / `a module reachable and still listed -> fail (the list rotted; removing the entry is the definition of done for that module)`。
- 配套的骨架仍在封闭集里：`src/core/contracts.ts:90` 的 `ExecutionRecordKind` 含 `"dispatch.decided" | "dispatch.completed"`；写入方法 `src/core/execution-ledger.ts:468`（`appendDispatchDecision`）与 `:484`（`appendDispatchCompletion`），唯一调用者是 `src/core/dispatcher.ts:32` 与 `:97`；投影字段 `src/core/execution-ledger.ts:358`（`readonly dispatch: Readonly<{ readonly decided: number; readonly completed: number }>;`）与 `:424-425`（计数）、`:113`（`["dispatch.", "extension_identity"],`）。
- 类型：`src/core/contracts.ts:103-134`（`DispatchEstimate`、`DispatchDecision`、`DispatchActualMetrics`、`DispatchActual`），唯一消费者是 `src/core/dispatcher.ts:3`、`src/core/dispatch-policy.ts:1`、`src/core/execution-ledger.ts:3`。
- 规范描述的是没有消费者的契约：`.trellis/spec/backend/personal-agent-request-runtime.md:62` `Dispatches write correlated \`dispatch.decided\` and \`dispatch.completed\` records. …`；以及整节 `.trellis/spec/backend/personal-agent-capability-runtime.md:221` `## Scenario: Dispatch Cost Calibration`（`:221-293`）。
- 注意 `dispatchId` 这个**名字**有两个不相干的家族：`src/core/subagent.ts:5,22` 与 `src/pi-adapter/subagent-provider.ts:15,89…` 是产品在用的子 agent 路径（`src/pi-adapter/extension.ts:1597-1598` 真实调用），与本节无关，不要一起删。

### 4.2 最高可行层级：**architecture（删除机制）**

- **接线不成立**：产品要跑 `decideDispatch` 就得提供 `DispatchEstimate`（`src/core/contracts.ts:103-109`：`inlineCost`、`dispatchCost`、`predictedWallTimeMs`、`independentBranches`、`hasSharedMutableState`），而产品里没有任何地方测这三个成本/时间量（`rg -n inlineCost|predictedWallTimeMs src` → 只命中 `dispatch-policy.ts` 与 `contracts.ts`）。为它造估算器就是 "no speculative validators" 直接反对的事。
- **"加个检查"这一层不成立，因为检查已经存在且被绕过了**：`tests/harness-reachability.test.ts` 就是那个检查，而 `:93-94` 正是它的豁免名单；`wiredBy: null` 加一句 reason 就让两个模块合法地待在那里。要在检查层修，只能再给 reason 加一门"理由必须属于某类枚举"的校验——那是给一个空转的豁免名单加校验，不减反增。
- 因此停在架构层：**删掉这个机制**。删掉后"没有消费者的 dispatch 契约"这句话就无法再被写出来——这正是 pstack 的 "Drop a rule once its mistake can't happen"。

### 4.3 具体改动（**删除**，连带清单必须一次说清）

删除集合与**每一处剩余引用**：

1. `src/core/dispatcher.ts`（整个文件，99 行）与 `src/core/dispatch-policy.ts`（整个文件，17 行）。
2. `tests/harness-reachability.test.ts:93-94` 的两条 `ALLOW_LIST` 条目——**必须删**，否则 `:226-233` 的 stale 方向会红（见 4.4）。
3. `tests/core.test.ts:8,10` 的导入与 `:230,234,238,251,271,284,296,314` 的用例；`tests/strategy-evaluation.test.ts:4,5,18,32,40` 的导入与用例（该文件 `:10-51` 的三个用例是 dispatch 的，`:53-77` 是两个 `ContextCompiler` 用例，**保留文件**，只删三个用例与 `:7` 因此失去读者的 `sleep` 辅助）。
4. `src/core/contracts.ts:103-134` 的四个 `Dispatch*` 类型。
5. `src/core/execution-ledger.ts:468-493` 的两个 append 方法；`:358` 的 `dispatch` 投影字段；`:396-397,424-425,436` 的计数；`:113` 的 `["dispatch.", "extension_identity"],`（`:121-126` 的 `executionEvidenceFamily` 靠前缀表工作，删前缀等于 `dispatch.*` 落进 `other`）。
6. `src/core/contracts.ts:90` 的两个 record kind。**这会牵动两个测试的字面量**：`tests/execution-audit-summary.test.ts:71`（`record("dispatch.decided", {}, { requestId: "req-1" })`）、`tests/execution-correlation.test.ts:31,48`（同名字面量）与 `:68`（`assert.equal(executionEvidenceFamily("dispatch.completed"), "extension_identity");`）——三处需要换成仍然存在的 kind（例如 `mode.changed` / `request.received`）并保持被断言的那个 family 不变。**若不想动封闭集**，替代方案是只删 1/2/3 而保留 4/5/6：代价是封闭集里继续留着两个没有任何写入者的 kind，也就是同一族缺陷的下一个实例——二选一必须显式选。
7. 文档（同一次改动）：`.trellis/spec/backend/personal-agent-request-runtime.md:62` 那条 bullet；`.trellis/spec/backend/personal-agent-capability-runtime.md:221-293` 整节。**注意**：删那一节会改二级标题清单，而 `tests/spec-context-budget.test.ts:35-40` 手抄了这份清单（`:37` 就是 `"Scenario: Dispatch Cost Calibration",`），必须同步删除该行，否则 `:116-120` 的断言会红。`tests/document-drift.test.ts:502-510` 要求该 spec 至少点名 5 个测试文件（`assert.ok(named.length >= 5, …)`），而那一节点名的是断言而不是文件（`:265-270`），删除它不影响这个计数（`rg -n "tests/" .trellis/spec/backend/personal-agent-capability-runtime.md` → 命中集中在 `:69-73` 与 `:155-164`）。

### 4.4 让回归不可能的检查 + 必须变红的 fixture

- 检查就是**既有的** `tests/harness-reachability.test.ts`，两条方向都已到位：`:217-224`（不可达且未列名 → 红）与 `:226-233`（可达却仍在名单里 → 红），外加 `:235-239`（条目必须有 ≥12 字符的理由）。**不新增测试。**
- **必须变红的 fixture**：`tests/harness-reachability.test.ts:226-233` 的 stale 方向本身就是 fixture——只删两个模块、不删 `:93-94` 的名单，它立刻红（`these allow-list entries are now reachable. Removing the entry is the definition of done for that module`）。这条自带反向证明，不需要种子。
- 若选 4.3 的**保守替代方案**（只删实现、保留 record kind 与类型），那么"封闭集里没有写入者的 kind"无人可查——此时**必须**加一条新检查（宿主 `tests/execution-audit-summary.test.ts`，新用例）：对 `ExecutionRecordKind` 的每个成员，断言它在 `src/` 里至少有一个 `append*` 或 `kind:` 字面量写入者；fixture：种一个只有读没有写的假 kind 字符串，断言被报出。**这是保守方案的价格，必须一并写进决定。**

### 4.5 影响面

- 产品：4 个文件（`dispatcher.ts`、`dispatch-policy.ts` 删除；`contracts.ts`、`execution-ledger.ts` 收窄）。
- 测试：`tests/harness-reachability.test.ts`（删两条）、`tests/core.test.ts`（删段）、`tests/strategy-evaluation.test.ts`（删三个用例，保留文件）、`tests/execution-audit-summary.test.ts`、`tests/execution-correlation.test.ts`、`tests/spec-context-budget.test.ts:37` —— 6 个文件。
- 文档：2 个 spec 文件。
- `.trellis/harness-surface.yaml`：`tool-implementation: [src, tests]`（`:20`）含被删文件所在目录，无需改路径；但 `personal-agent-capability-runtime.md` 属于 `long-term-memory`（`:24`），而它的 `verifiedBy` 是 `tests/spec-context-budget.test.ts`（`:36`）——**这条依赖正好解释为什么删 spec 必须同时改那个测试**。
- `CHANGE_SURFACES`（`src/core/task-convergence.ts:854-856`）：不变（组件名没变）。
- 与存档决定的冲突需要显式记录：`.trellis/spec/backend/personal-agent-use-time-architecture.md` 与 `src/core/subagent.ts` 描述的"子 agent 派发"是**另一条**路径，不在删除集合内（`src/pi-adapter/extension.ts:1597` 真实调用 `subagentProvider.launch`）。

---

## 5. `dispatchOnce` vs `effect-boundary.prepare`：同一"至多一次"规则两份实现

### 5.1 今天的事实

- 产品路径：`src/core/effect-boundary.ts:75` `export function createEffectBoundary(options: EffectBoundaryOptions): EffectBoundary {`，其 `prepare`（`:85-124`）的核心判定在 `:111`：
  `if (claim.claimed || !input.replayed || isAutomaticallyRetryable(effectClass)) {`
  调用点：`src/pi-adapter/extension.ts:2286-2293`（装载 boundary）、`:2814-2839`（`prepare`）、`:2875-2877`（`complete`）。
- 第二条实现：`src/core/effect-ledger.ts:411` `export async function dispatchOnce<T>(`，判定在 `:417`（`if (options.retryPriorAttempt === true && (options.effectClass === undefined || !isAutomaticallyRetryable(options.effectClass)))`）与 `:427-432`（`if (!claim.claimed) { const completed = claim.existing?.outcome === "completed"; if (completed || options.retryPriorAttempt !== true) { return { executed: false, existing: claim.existing }; } }`）。
  `rg -n dispatchOnce src` → 只有 `src/core/effect-ledger.ts:411`；调用点全在测试：`tests/effect-ledger.test.ts:77,78,91,102,116,124,126,128`、`tests/harness-effect-claim.test.ts:116,143,147,155`、`tests/trading-mode.test.ts:119,120,143,144`。
- **修正原审计的一句话**：产品路径并非没有测试。`tests/effect-boundary.test.ts`（109 行，8 个用例）与 `tests/code-development-mode-effects.test.ts:57-81` 都在打 `prepare`（例如 `tests/effect-boundary.test.ts:55` "refuses a replayed dispatch whose class says a second run is not harmless"、`:75` "treats an undeclared action as non-idempotent"）。仍然成立的是：**同一判定有两份实现**，以及 `dispatchOnce` 独有的一批断言（`tests/effect-ledger.test.ts:91` 的 8 路 `Promise.all` 只执行一次）覆盖的是 `dispatchOnce` 这一层，而不是产品实际走的 `begin` + `prepare` 拆分。
- 附带要一起处理的死件：`src/core/effect-ledger.ts:375`（`DispatchOptions`）与 `:403`（`DispatchResult`）只被 `dispatchOnce` 使用；`:289` 的 `EffectRetryRefusedError` 只在 `:418` 抛出（`rg -n EffectRetryRefusedError` → 定义 + `dispatchOnce` 内一处 + `tests/harness-effect-claim.test.ts:144,148`）。
- `src/core/checkpoint.ts:89` 的注释指向它：`* part of it: a blocked action never ran, and a failed one is ambiguous (see \`dispatchOnce\`), so`。
- 规范把它写成契约：`.trellis/spec/backend/personal-agent-framework-core.md:171`（签名）与 `:180-182`（`- \`dispatchOnce\` **skips by default** when a prior attempt exists, completed or not. Re-dispatching an ambiguous attempt requires \`retryPriorAttempt\`, …`）。

### 5.2 最高可行层级：**architecture（删掉第二份实现）**

- **为什么"两份实现就两份"不成立**：`prepare` 与 `dispatchOnce` 回答的是同一个问题（"这个 effect 现在可以派发吗"），输入不同只因调用形态不同——产品必须先拿到 claim 再让宿主执行工具（`src/pi-adapter/extension.ts:2814-2839` → `:2875-2877`），所以产品是 begin/prepare + complete 两段；`dispatchOnce` 是把这两段折叠成一个测试便利函数。折叠版**没有多出任何产品语义**：`retryPriorAttempt`（"允许重提一个结果未知的 attempt"）在 `prepare` 里就是"caller 说 `replayed: true` 且 class 可重试"（`src/core/effect-boundary.ts:111`），而 `dispatchOnce` 的默认（`retryPriorAttempt !== true` → 不重提）正是 `prepare` 对 `replayed: true` 的行为。
- **类型层不够**：把 `DispatchOptions`/`DispatchResult` 收进 `prepare` 的返回类型只是搬家，两份判定还在。
- 所以停在架构层：**保留 `prepare`（产品路径），删除 `dispatchOnce` 及其专属类型与错误类**，并把它的断言按产品路径重写。

### 5.3 具体改动（**删除 + 重写测试**）

- 删 `src/core/effect-ledger.ts:411-441`（`dispatchOnce`）、`:375-394`（`DispatchOptions`）、`:403-409`（`DispatchResult`）、`:289-294`（`EffectRetryRefusedError`）；保留 `isAutomaticallyRetryable`（`:64`），它仍被 `src/core/effect-boundary.ts:111` 使用。
- 重写三个测试文件，把它们变成产品路径的覆盖：
  - `tests/effect-ledger.test.ts:72-129`：`describe("dispatchOnce (exactly-once at the effect boundary)")` 的名字与主体改为 `createEffectBoundary(...).prepare/complete` 的形态（`tests/effect-boundary.test.ts:29-33` 已有现成的 fixture 构造方式，包含 `createInMemoryEffectStore` 与 `createFileEffectStore` 两种）；`:91` 的 8 路并发断言改为直接打 `ledger.begin`，因为"至多一个 claimed"的保证来自 store 的原子性（`src/core/effect-ledger.ts:373` `The claim itself is atomic in the store, so concurrent resumers produce one \`claimed: true\`.`），`prepare` 的契约**故意允许**非 replay 的并发重复（`src/core/effect-boundary.ts:111`），所以这条断言搬到 `begin` 上才是它真正在测的东西。
  - `tests/harness-effect-claim.test.ts:116,143,147,155`：`retryPriorAttempt` 的四种用法改为 `replayed: true` + `effectClasses` 的组合；`:134-136`（`isAutomaticallyRetryable` 的三条）保留；`:144-148`（`EffectRetryRefusedError`）随错误类删除。
  - `tests/trading-mode.test.ts:119-144`：这段是 trading 模式的"未知结果不许自行重提"（`modes/trading/MODE.md:27-31`）的唯一测试载体，改为 `prepare({replayed: true})` 必须 `dispatch: false`（`:143-144` 的"timeout 后重试"改为断言拒绝 + 报告 `existing`/`outcome`）。
- 改一句注释：`src/core/checkpoint.ts:89` 的 `(see \`dispatchOnce\`)` 改为指向 effect boundary 的 `prepare`（注意：`tests/document-drift.test.ts:447-473` 禁止 `file:line` 引用，符名引用是可以的）。
- 规范（同一次改动）：`.trellis/spec/backend/personal-agent-framework-core.md:171` 的签名行与 `:180-182` 的 `dispatchOnce` 契约改成 `prepare`/`complete` 的两段形态；`:191-197` 的错误矩阵（`Not re-dispatched unless the caller opts in` 等）改为"caller 声明 `replayed`"的说法——那节不含二级标题，`tests/spec-context-budget.test.ts:56-63` 的清单不受影响。

### 5.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（**新文件 `tests/one-rule-one-site.test.ts`**，与第 7 条共用）：一张表，每行是 `(规则名, 允许出现该判定的文件集合)`。第 5 条的行是"effect 是否可派发"这条判定，允许的文件集合只有 `src/core/effect-boundary.ts`；检查读 `src/core/*.ts` 的源码文本，数每个文件里 `isAutomaticallyRetryable(` 与该判定的调用点，超出允许集合就报出文件名与行号——错误信息直接点名"把第二个实现并回 `effect-boundary.ts`"。这与 `tests/document-drift.test.ts:447-459` 的"禁则"是同一形状（它也明说 `it forbids a pattern, so it cannot tell whether the file a citation names is the right one. A prohibition is a floor, not a proof`）。
- **必须变红的 fixture（真实锚点）**：改前跑一次，检查必须报 `src/core/effect-ledger.ts:417`——两份实现今天就在那里，所以这不是种子，是实测。种子的作用是证明"文件集合"这一维会红：把允许集合临时收成 `[]`，检查必须报出两个文件。
- 另一条已经存在、不需要新增的检查：`tests/effect-boundary.test.ts` 的 8 个用例就是产品路径的行为网。

### 5.5 影响面

- 产品：2 个文件（`effect-ledger.ts` 删 4 个导出；`checkpoint.ts` 一句注释）。
- 测试：3 个文件重写（`tests/effect-ledger.test.ts`、`tests/harness-effect-claim.test.ts`、`tests/trading-mode.test.ts`）+ 1 个新文件（`tests/one-rule-one-site.test.ts`）。
- 规范：1 个文件（`personal-agent-framework-core.md`，`###` 级，不改标题清单）。
- `.trellis/harness-surface.yaml`：**`verifier.paths`（`:44`）含 `src/core/execution-ledger.ts`**，而 `effect-boundary.ts` 不在里面——`dispatchOnce` 住在 `execution-ledger.ts`，删掉它不改变该文件是否属 verifier；但 `effect-boundary.ts` 承载了唯一实现，`.trellis/spec/backend/personal-agent-harness-loop.md` 的 verifier 边界是否应把它纳入 `verifier.paths` 需要显式判断（本次改动不动它，理由：`verifier` 的定义是"产生 loop 被裁决所用证据的代码"，`effect-boundary` 是控制点不是读数）。`CHANGE_SURFACES` 不变。

---

## 6. 两个预算函数：`getRemainingContextChars` 只被测试用

### 6.1 今天的事实

- `src/pi-adapter/extension.ts:3420` `export function getRemainingContextChars(tokens: number | null | undefined, contextWindow: number | undefined): number | undefined {`，预留 `:3423` `const reserveTokens = Math.min(8_192, Math.max(2_048, Math.floor(contextWindow * 0.05)));`。
- `src/pi-adapter/extension.ts:3438` `export function getProjectContextBudget(input: {...}): number | undefined {`，预留 `:3447` `const responseReserve = Math.min(8_192, Math.max(2_048, Math.floor(contextWindow * 0.1)));`。
- 产品只用后者：`src/pi-adapter/extension.ts:984` 与 `:3242`。前者 `rg -n getRemainingContextChars src tests` → 定义 `:3420` + `tests/pi-adapter.test.ts:8`（导入）与 `:1444-1446`（三条断言）。即 **5% 的那份只有测试在喂**。
- 两份的差别只有预留比例（5% vs 10%），且都写 `* 3`（`:3429` / `:3450`），注释的理由也一样（`:3426-3428`）。

### 6.2 最高可行层级：**architecture（一个函数一条规则）**

- 两份实现的名字读起来是同一个概念（"剩余上下文"vs"项目上下文预算"），读者无法从名字判断现行规则——这正是"同一规则两次派生"的形状，本仓库已经用删除解决过一次同类问题（`src/core/invocation-disposition.ts:7-12` 的 header：`Two consumers used to answer it separately, with two name tables and two vocabularies.`）。
- 更高层级（架构）就意味着**只留一个**；更低层级（一个检查断言两者的比例关系）反而是给两份实现上锁。
- 保留哪一份：产品用的那份（10%，`getProjectContextBudget`），因为它有两个真实调用点；5% 的那份没有任何产品读者。这与 3.2 的结论一致，且同一次改动合并执行。

### 6.3 具体改动（**删除**）

- 删 `src/pi-adapter/extension.ts:3420-3430`（整个函数），把 `:3415-3419` 的注释合并进 `getProjectContextBudget`（见第 3 条）。
- 删 `tests/pi-adapter.test.ts:1444-1446` 三条断言；`:8` 的导入列表去掉该符名。
- 不新增函数、不新增常量。

### 6.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（宿主 `tests/pi-adapter.test.ts`，**编辑既有用例** `:1451-1458`）：改成一个"预算函数只有一个入口"的断言——`getProjectContextBudget` 在给定 `(tokens, contextWindow)` 时的返回值必须是**唯一**被产品消费的预算读数，做法是断言 `src/pi-adapter/extension.ts` 里导出的预算计算函数只有这一个（读源码文本数 `export function get*Context*` 或对 `import * as extension` 的导出面取形如 `*Budget*`/`*ContextChars*` 的名字，断言集合等于一个显式声明的名单）。这条检查同时堵住"再添一个更保守的预算函数"这条路。
- **必须变红的 fixture**：改前跑一次，导出面里同时有 `getRemainingContextChars` 与 `getProjectContextBudget`，检查必须报前者——真实锚点。种子：把名单临时改成空集，检查必须报两个名字（证明"数量"这一维会红）。
- 不做"两个函数值相等"的断言：两份的预留比例**故意不同**（5% vs 10%），断言相等会把一个已删除的函数重新拉回来保持一致。

### 6.5 影响面

- 产品：1 个文件（`src/pi-adapter/extension.ts`，删 11 行）。
- 测试：1 个文件（`tests/pi-adapter.test.ts` 的导入与 `:1444-1446`）。
- 行为：**不变**（无人调用）。`unverified` 的是"确实无人调用"这一点我只用 `rg` 验证过 `src` 与 `tests`；验证路径：`rg -n getRemainingContextChars scripts bin .pi .trellis` 应为零命中（`bin/dove-pi.cjs` 在类型门之外，`tsconfig.json:22` 的 `include` 不含 `bin`，所以那里的引用不会被编译期发现）。
- `.trellis/harness-surface.yaml`：无需改；`tool-implementation`（`:20`）含 `src`。`CHANGE_SURFACES` 不变。

---

## 7. 两个拒绝计数器：同一规则两份逐字相同的实现

### 7.1 今天的事实

- 产品侧：`src/core/harness-verifier.ts:58` `export function countGateRefusals(records: readonly ExecutionRecord[]): Readonly<Record<string, number>> {`，主体 `:60-69`（`if (record.kind !== "gate.refused") continue;` … `for (const atom of gate.split("+"))`）。
- 脚本侧：`src/core/harness-axes.ts:63` `export function gateRefusalCounts(records: readonly ExecutionRecord[]): Readonly<Record<string, number>> {`，主体 `:64-74` 逐字相同。
- 消费者：
  - 前者：`src/pi-adapter/extension.ts:59`（导入）、`:1810`（`runtimeBaseline = changeBaseline(manifest, changeObservables(read.snapshot, unresolved, countGateRefusals(await ledger.read())));`）、`src/core/harness-verifier.ts:107`。
  - 后者：`src/core/harness-axes.ts:109`（`const byLabel = gateRefusalCounts(records);`）、`src/core/harness-corpus.ts:3`（导入）、`:72`（`for (const [label, count] of Object.entries(gateRefusalCounts(ledger.records))) byLabel[label] = (byLabel[label] ?? 0) + count;`）。
- 规范明说只有一个：`.trellis/spec/backend/personal-agent-harness-loop.md:176-178`
  `- **Every count comes from a rule that already exists**: the terminal classes are the axis classification, the` / `  failures are the failure reading, and the refusal labels are the axis refusal split (exported as` / `  \`gateRefusalCounts\`, one rule for three readers). …`
  以及 `src/core/harness-corpus.ts:14-16` 的 `**Nothing here is derived twice.** …`。
- **哪一个必须留，是被结构决定的**：`tests/harness-reachability.test.ts:72-76` 把 `src/core/harness-axes.ts` 固定为"故意不可达"，条目原文 `"a reading, consumed by scripts/harness-axes.mts and its test; deliberately not reached by the harness"`。而 `:226-233` 的 stale 方向会在该模块变为可达时红。因此**产品不能 import `harness-axes.ts`**；唯一可行的方向是让 `harness-axes.ts` 与 `harness-corpus.ts` 改读 `harness-verifier.ts` 的 `countGateRefusals`，删掉 `harness-axes.ts:63-75`。
- 三处注释点名的是 `countGateRefusals`（保留者的名字），因此删除后**不需要**改：`src/core/loop.ts:162`、`src/commands/axi-turn.ts:161`、`tests/gate-labels.test.ts:50`。要改的是 `personal-agent-harness-loop.md:177` 那句"exported as `gateRefusalCounts`"。

### 7.2 最高可行层级：**architecture（删掉第二份）**

- 规则本身只说了一件事："refusal label 是复合值，按 `+` 拆"（`src/core/harness-verifier.ts:52-57` 与 `src/core/harness-axes.ts:56-62` 的注释几乎同义）。同一判定两处实现，任何一处改了拆分规则，corpus 与 convergence status 会对同一个 ledger 给出不同拒绝数。
- **检查层不成立**：两个实现今天逐字相等，所以"两个消费者对同一输入给同一答案"的行为断言在双实现下也会绿——它证明不了"只有一份"。可见的检查只能是结构性的（见 7.4）。
- **类型层不成立**：没有任何类型能表达"这一段逻辑只允许存在一处"。
- 因此停在架构层：留一份、删一份，方向由可达性测试强制（7.1 最后一段）。

### 7.3 具体改动（**删除 + 接线**）

- 删 `src/core/harness-axes.ts:63-75`；`src/core/harness-axes.ts:3` 的导入改为从 `./harness-verifier.ts` 引入 `countGateRefusals`；`:109` 改用它。保留 `:56-62` 的注释但改写成"这条规则的家在 `harness-verifier.ts`，本模块与 corpus 都是读者"（并去掉 `one rule, three readers` 里的歧义——读者数没变，实现数变了）。
- `src/core/harness-corpus.ts:72` 的调用名改成 `countGateRefusals`（`:3` 的导入源改 `./harness-verifier.ts`，与 `:3` 现有的 `classifyTerminal, TERMINAL_CLASSES` 来自 `harness-axes.ts` 分开两行）。
- 规范：`.trellis/spec/backend/personal-agent-harness-loop.md:177` 的 `(exported as \`gateRefusalCounts\`, one rule for three readers)` 改为 `(exported as \`countGateRefusals\` from \`src/core/harness-verifier.ts\`, one rule for three readers)`。
- 不新增函数。

### 7.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（与第 5 条共用**新文件 `tests/one-rule-one-site.test.ts`**）：同一张表加一行——"refusal label 按 `+` 拆这条规则"的允许文件集合只有 `src/core/harness-verifier.ts`；检查数每个 `src/core/*.ts` 里 `"gate.refused"` + `split("+")` 同时出现的函数体，超出集合就报文件名与函数名，错误信息点名"并回 `harness-verifier.ts`"。
- **必须变红的 fixture（真实锚点）**：改前跑一次，检查必须报 `src/core/harness-axes.ts` 的 `gateRefusalCounts`——两份实现今天都在。
- 第二个 fixture（种子）：把允许集合临时改成 `[]`，检查必须报出两个文件；证明"集合"这一维真的参与判定，而不是一个恒真的比较。
- 行为网已经存在、不需要新增：`tests/harness-corpus.test.ts`（在 `verifiedBy` 的 `tool-implementation` 里，`.trellis/harness-surface.yaml:34`）与 `tests/harness-axes.test.ts`。

### 7.5 影响面

- 产品：2 个文件（`src/core/harness-axes.ts`、`src/core/harness-corpus.ts`）。
- 测试：1 个新文件（`tests/one-rule-one-site.test.ts`，与第 5 条共用）+ 可能的导入改（`tests/harness-axes.test.ts` 若直接 import `gateRefusalCounts`——需先查；`rg -n gateRefusalCounts tests` 今天只命中 `src`，见 7.1 的消费者清单，故预期不改）。
- 规范：1 个文件 1 行。
- **可达性影响（必须显式说明）**：`harness-axes.ts` 变成 `harness-verifier.ts` 的依赖，而后者被 `src/pi-adapter/extension.ts:59` 引入，因此 `harness-verifier.ts` 已在可达集合里。`harness-axes.ts` 自身的可达性**不变**（它仍然只被 `scripts/` 与测试引入），所以 `tests/harness-reachability.test.ts:72-76` 的条目保持有效——这正是选择这个方向的原因；反向（产品改用 `gateRefusalCounts`）会让 `harness-axes.ts` 变可达，从而使 `:226-233` 红。
- `.trellis/harness-surface.yaml`：**`verifier.paths`（`:44`）同时列出 `src/core/harness-axes.ts`、`src/core/harness-corpus.ts`、`src/core/harness-verifier.ts`**，三者都在，无需改。`middleware`（`:21`）不含这三个，无需改。`CHANGE_SURFACES` 不变。

---

## 8. 主机工具面三份名单

### 8.1 今天的事实

- 产品侧边界名单：`src/core/action-policy.ts:21`
  `const NETWORK_TOOLS = new Set(["web_search", "fetch_content", "get_search_content", "source_check", "browser", "agent_browser", "mcp", "mcpScript"]);`——模块私有，唯一读者是 `:622`（`if (sandbox.network === "none" && NETWORK_TOOLS.has(invocation.tool)) {`）。
- 安装面快照：`tests/fixtures/representative-tool-catalog.ts:1-11`，注释 `/** Representative installed Pi catalog captured by the middleware E2E probe. */`（`:1`），57 个名字（`tests/tool-profile.test.ts:8` 断言 `assert.equal(representativeTools.length, 57);`），其中 `:7` 有 `"agent_browser", "web_search", "source_check", "fetch_content", "get_search_content", "mcp", "mcpScript"`——**没有裸 `browser`**。
- 测试侧手抄名单：`tests/work-mode.test.ts:579` `const HOST_TOOLS = new Set(["bash", "powershell", "read", "edit", "write", "grep", "find", "ls"]);`，用途在 `:585-604`（模式权限条目必须"是主机工具名或 capability 名"），其理由写在 `:577-578`：`// The host's half of the vocabulary is written out rather than imported, because the host's tool names are the` / `// thing being checked against: a list that agreed with a copy of itself would prove nothing.`
- 该结构已经被同一仓库判过一次：`tests/fence-drift.test.ts:11-14`
  `// Pi imports and the adapter's declaration lives on the other side of that boundary. A union maintained by hand is a` / `// third list, and a third list is how the first two came to disagree: \`FILESYSTEM_MUTATORS\` names \`bash\` and` / `// \`notebook_edit\`, the declaration table names \`delete\`, \`mkdir\` and the two \`agent_workspace_*\` tools, and neither` / `// is a superset of the other.`
  并且已经给出了修法：声明表在 `src/core/invocation-disposition.ts:51-80`，派生视图 `src/core/invocation-disposition.ts:134-136`（`declaredMutatingToolNames()`），耦合检查在 `tests/fence-drift.test.ts:32-52`。
- `NETWORK_TOOLS` 的八个名字里，`web_search`/`source_check`/`fetch_content`/`get_search_content` 已经在同一张声明表里（`src/core/invocation-disposition.ts:68-71`），`agent_browser`/`browser`/`mcp`/`mcpScript` 不在。
- 覆盖面取决于"看哪份名单"是真实后果，且仓库自己承认第三方名字读不了：`src/core/action-policy.ts:33-35` `of` / `* the 57 tool names installed in this project's host, this repository can read three schemas, so "the rest write` / `* somewhere harmless" is a claim we cannot back.`

### 8.2 最高可行层级：**architecture（一份声明表 + 派生视图）**

- **类型层不成立**：没有一个联合类型能表达"这个字符串是网络工具"，除非把 57 个我们读不到 schema 的名字写成字面量联合——那正是 `src/core/work-mode.ts:217-219` 拒绝做的事（`**The map is deliberately tiny, and the smallness is the design.** The installed catalog holds 57 tool names across extensions this repository cannot read schemas for`）。
- **"让三份名单互相校验"不成立**：`tests/work-mode.test.ts:577-578` 已经把"不从产品导入、写出来才算校验"这条理由写死了——一份与被测物同源的名单证明不了任何事。所以 `tests/work-mode.test.ts:579` 的名单**不应该**变成产品常量的副本；它应该以**安装面快照**（`tests/fixtures/representative-tool-catalog.ts`，它是一次测量而不是一份声明）为对照物。
- 因此停在架构层，分两半：
  1. 产品侧：把"这个工具会出网"变成**一张声明表的一个字段**（`src/core/invocation-disposition.ts:51-80` 的 `DECLARED_TOOLS` 加一个网络标记，并补上表里缺的 4 个名字），边界集合改为派生视图（与 `:134-136` 的 `declaredMutatingToolNames()` 同形）。手抄的 `NETWORK_TOOLS` 被删除，于是"第三份名单"不可能再出现。
  2. 测试侧：`tests/work-mode.test.ts:579` 的名单保留"自己写出来"的性质，但增加一条它以安装面快照为界的断言（见 8.4），使它不会漏掉一个宿主真的安装了的名字。

### 8.3 具体改动（**删除 + 接线**）

- `src/core/invocation-disposition.ts`：`DECLARED_TOOLS`（`:51-80`）每条加一个网络标记，并新增 `agent_browser`/`browser`/`mcp`/`mcpScript` 四条；新增派生视图 `declaredNetworkToolNames()`（与 `:134-136` 同一形状）。
- `src/core/action-policy.ts`：删 `:21` 的 `NETWORK_TOOLS`，`:622` 改读派生视图（从 `./invocation-disposition.ts` 引入——它已在 `src/core` 内，无跨层问题；`src/core/action-policy.ts:10` 已经在从 `./work-mode.ts` 引入，同层引入没有新增耦合）。
- `tests/work-mode.test.ts:579`：名单本身保留，但 `:585-604` 的判定改为"`HOST_TOOLS` 的成员 **或** 安装面快照（`representativeTools`）里的成员 **或** capability 形名"——`tests/host-work-mode.test.ts:12` 已经示范了测试可以 import 该 fixture。
- 文档（同一次改动，最后）：`src/core/action-policy.ts:14-20` 的 header 与 `modes/code-development/permissions.yaml:15-19`（它说"An earlier version of this file repeated those eight tool names here as well"——八个这个名字数在改名后仍然成立，只需确认措辞不指 `NETWORK_TOOLS` 这个符名）。
- 不新增常量、不新增文件。

### 8.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（**编辑既有文件 `tests/fence-drift.test.ts`**，新增一个 `describe`，与 `:32-52` 同形）：两个方向——
  1. 边界集合等于派生视图（派生之后这是恒真的结构断言，它防的是"又有人手写一份"）；
  2. **边界集合的每一个名字都必须在安装面快照里**（`representativeTools`），否则报"这个边界拒绝的是一个这台宿主没有安装的工具名"。
- **必须变红的 fixture（真实锚点，今天就是红的）**：`browser`。`src/core/action-policy.ts:21` 有它，`tests/fixtures/representative-tool-catalog.ts:2-11` 没有它。检查第一次跑就报这一条——这正是"一个静静地什么都不匹配的检查看起来和通过一样"的反面。
- 第二个 fixture（种子）：把"这个名单必须落在快照内"的辅助函数用一个刻意造的名称集合调用（例如 `new Set(["web_search", "not_a_host_tool"])`），断言报告里正好是 `not_a_host_tool`，证明这条判定对"快照外的名字"真的会红。
- 第三个方向（避免误报）：`tests/work-mode.test.ts:579` 的名单必须**是快照的子集**（`bash`, `powershell`, `read`, `edit`, `write`, `grep`, `find`, `ls` 都在 `tests/fixtures/representative-tool-catalog.ts:3` 里），断言它；种一个快照里没有的名字，断言被报出。这条防的是"手抄名单里出现一个宿主其实没有的名字"（也就是 `browser` 那类错误的第三次出现）。

### 8.5 影响面

- 产品：2 个文件（`src/core/invocation-disposition.ts`、`src/core/action-policy.ts`）。
- 测试：2 个文件（`tests/fence-drift.test.ts` 新增段、`tests/work-mode.test.ts:579-604` 编辑）；`tests/host-work-mode.test.ts:746` 的 `web_search` 断言不受影响（该名字仍在集合内）。
- **需要动 `.trellis/harness-surface.yaml`**：`middleware`（`:21`）今天列的是 `[src/core/action-policy.ts, src/core/argument-syntax.ts, src/pi-adapter/extension.ts, tests/action-policy.test.ts, tests/host-work-mode.test.ts]`。把网络边界声明搬进 `src/core/invocation-disposition.ts` 之后，该文件成为 middle 层的一部分，却不在这份清单里——于是"编辑落在面内=对运行时有影响"这个等式在它上面为假（`harness-round` 的 surface fit 会把它判为面外）。**建议加一个路径**：`middleware` 追加 `src/core/invocation-disposition.ts`。该文件的每条路径在装载时被校验存在（`src/core/harness-surface.ts:165-171`，见 `research/dove-pi-current.md` §3 (e) 的读法），所以这是一行低风险编辑；组件名不变，故 `CHANGE_SURFACES`（`src/core/task-convergence.ts:854-856`）不需要动。
- `README.md`/`modes/*`：无必须改动（模式没有一个把网络名字列进权限表的；`modes/code-development/permissions.yaml:15-19` 正好说明为什么不应该那么做）。

---

## 9. `modes/pentest/MODE.md:18-21`：把已经生效的控制写成"操作者责任"

### 9.1 今天的事实

- 模式文档 `modes/pentest/MODE.md:18-21`：
  `**Not yet performed by the host** (2026-09-26). \`preflightAuthority\` exists in the framework and has **no runtime` /
  `caller**, so nothing runs this check before the first action today. Until it is wired, this section is a **requirement` /
  `on the operator** rather than a control the harness enforces - which is a different thing, and the difference is the` /
  `point of saying it.`
- 事实相反，而且是从**装载期**就开始的：`src/pi-adapter/extension.ts:2229-2237`
  `if (loaded.authorityDocument !== undefined) {` / `const preflight = preflightAuthority(loaded.authorityDocument, new Date().toISOString(), {` / `evidenceDigests: evidenceDigestsFor(loaded.authorityDocument, modeRoot),` / `});` / `if (preflight.outcome === "block") {` / `modeRefusal = \`Work mode '${loaded.mode.id}' declares '${loaded.mode.gateSemantics}' and its engagement '${loaded.authorityDocument.engagement}' does not pre-flight clean: …\`;` / `activeWorkMode = undefined;`
  实现：`src/core/authority.ts:282` `export function preflightAuthority(`。
- `preflight.outcome === "block"` 会清空 `activeWorkMode`，而装载失败在任何工具调用之前一律拒绝（`src/pi-adapter/extension.ts:2628-2630`，见 `research/dove-pi-current.md` §2 第 7 步）。
- 代码侧的注释已经承认这次迁移：`src/pi-adapter/extension.ts:2227-2228` `// It used to be prose in \`modes/pentest/MODE.md\` with no` / `// caller behind it.`
- 阅读方向是**最坏的一种**：读者会以为必须手工执行一个已经自动发生的检查（或以为可以跳过它）。

### 9.2 最高可行层级：**doc**

- 行为已经强制，缺的只是文档的那句话。改动是**改写这段散文**，把控制写成"装载期发生、失败即拒绝启动"，并给出它的强制点（模式装载，而不是某个工具调用）。
- 为什么更高层级不适用：**没有可写的机制**。要"架构层"修，就得把已经存在的装载期预检再写一遍；要"类型层"修，就得给文档字面量加类型——两者都是添加。
- 为什么不能只留文档：一句话的真实性无法被机械校验（`tests/document-drift.test.ts:29-30` 自己写明这个限度：`They share one: a check holds that a name resolves, never that the sentence around it is still true.`）。因此下面只加一条**禁则**，而禁则是地板不是证明——这一点必须在同一处写明，避免下一次有人以为它检查了那句话。

### 9.3 具体改动（**删除 + 命名**）

- 改写 `modes/pentest/MODE.md:12-21` 的 `## Before the first action`：保留"engagements 必须预检干净"的规则（`:14-16` 照旧），把 `:18-21` 那段四条"尚未由宿主执行 / 没有调用者 / 是操作者责任"删掉，替换为一句陈述控制点的话（装载期、`preflightAuthority`、失败即模式拒绝装载、`modes/pentest/governance.yaml` 的 `gate` 语义决定它是否被调用）。
- 不改 `modes/pentest/governance.yaml`、不改 `governance.version`：这次改动不改变模式授权集合，而 `tests/code-audit-mode.test.ts:376-386` 记录的规则是"authority 变化才递增版本"。
- 不新增机制。

### 9.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（**编辑 `tests/pentest-mode.test.ts`**，该文件已在 `.trellis/harness-surface.yaml:32` 的 `verifiedBy` 里，且 `:18` 已经读 `MODE.md` 全文）：加一条禁则——`modes/pentest/MODE.md` 的正文不得含"声明某机制没有运行时调用者"的措辞（点名到具体模式文件与具体符名 `preflightAuthority` + `no runtime caller` 这一组合，而不是泛泛的词表）。错误信息要说出修法："如果它真的没有调用者，就删掉那条控制而不是写一句免责；如果有，就写它是怎么被强制的。"
- **必须变红的 fixture**：把原 `:18-21` 那段文本作为字符串喂给同一个判定函数（判定函数接受文本而不是文件路径），断言它被报出。**理由**：这条禁则的输入本来就是历史文本，用真实历史文本当 fixture 比造一个更诚实——它同时把"这条禁则真的能看见当初那段话"证成一个事实。
- 第二条：断言 `tests/pentest-mode.test.ts:139`（`"pre-flights clean on the example engagement"`）与 `:144`、`:152` 这三个装载期预检用例仍在——即"控制还有网"，防止有人把文档改对而把控制删掉。这条是对既有文件的存在性断言，不需要新 fixture（它断言的是三个已命名的 case，删掉任一个就红）。

### 9.5 影响面

- 产品：1 个模式文档（`modes/pentest/MODE.md`，只改正文，不动 frontmatter，因此 `src/core/work-mode.ts` 的 loader 行为不变）。
- 测试：1 个文件（`tests/pentest-mode.test.ts` 新用例）。
- `.trellis/harness-surface.yaml`：`system-prompt: [AGENTS.md, modes]`（`:16`）含 `modes`，无需改。**注意**：这次改动正好落在 `modes` 这个"面内但对运行时无影响"的组件上（见 `research/dove-pi-current.md` §3 (a) D2/D12）——对 `MODE.md` **正文**的编辑确实不改变运行时行为，只有 frontmatter 与被 loader 读取的字段才会。这一点不影响本条的结论（本条改的就是正文，目的就是让读者读到真实情况），但它是 `harness-round` 的 surface fit 在 `modes` 上不成立的一个具体例子，值得在同一次改动里写进 `AGENTS.md` 的对照表。
- `CHANGE_SURFACES`：不变。

---

## 10. `modes/code-audit/governance.yaml:14-19`：`permissions.yaml` 不可能声明 action 名

### 10.1 今天的事实

- 断言：`modes/code-audit/governance.yaml:15-16`
  `# capability names: they are in the registry \`dove-pi capability list\` prints. \`repo.read\` and \`report.write\` are this mode own` /
  `# action names, declared in permissions.yaml and given an idempotency class below. A grant covers what the mode may do, which is both`
- `permissions.yaml` 的字段封闭集只有四个键：`src/core/work-mode.ts:191` `const PERMISSION_FIELDS = new Set(["unlisted", "always_allow", "ask_before", "never_allow"]);`——**它不能声明 action 名**。
- 而且那两份文件里根本没有这两个名字：`modes/code-audit/permissions.yaml:14-21` 的条目只有 `write`、`edit`、`bash`、`powershell`、`network.*`。
- 同一事实已经被另一份模式文档写对：`modes/code-development/governance.yaml:16-19`
  `# measured in work-mode.ts, and it is why a reader should not assume every dotted name here is a` / `# capability. (code-audit's file says its own action names are "declared in permissions.yaml"; that` / `# file's accepted fields are unlisted, always_allow, ask_before and never_allow, so it cannot be, and` / `# this mode does not repeat the claim.)`
- 这两个名字**被运行时读到的地方**只有一处：`modes/code-audit/governance.yaml:47-48`（`repo.read: idempotent` / `report.write: idempotent`），由 `src/core/effect-ledger.ts:64` 的 `isAutomaticallyRetryable`/`effectClassOf` 消费。
- 相关的既有事实：`tests/host-work-mode.test.ts:121-125` 记录了"九个声明里六个没有任何实现"（`repo.read`, `report.write`, `net.scan`, `exploit.run`, `market.read`, `order.submit`），并说明这类调用会被注册检查先拒绝（`src/core/action-policy.ts:692-701` 的 `registered` 门）。

### 10.2 最高可行层级：**doc**

- 这次要修的是**句子**，而"让句子成真"的路被 loader 自己的规则堵死了：
  - `permissions.yaml` 不能声明名字（`src/core/work-mode.ts:191` 四键）；
  - 也不能靠 `always_allow` 把它们列进去——`src/core/work-mode.ts:66-68` 明说 `\`always_allow\` is the list that answers \`unlisted: ask\` for named actions. With \`unlisted: allow\` it could only restate the default, so the loader refuses that combination`，而 `modes/code-audit/permissions.yaml:10` 正是 `unlisted: allow`；
  - 唯一的"更高层级"修法是**删掉这两个名字**（它们只被模式自己的散文与 `effects.classes` 使用），但那会改变 `authority.capabilities`，按 `tests/code-audit-mode.test.ts:376-386` 的既有规则必须同时递增 `governance.version`，并且属于任务 `10-03-unproducible-action-names` 的范围——不在本次改动内。
- 因此：**doc 层改写**，把句子改成与 `modes/code-development/governance.yaml:16-19` 同形的事实（这两个名字是本模式自己的 action 名；它们不在 `permissions.yaml`，因为那个文件只接受四个键；运行时读它们的地方是下面的 `effects.classes`；loader 不对它们做 registry 解析）。

### 10.3 具体改动（**删除 + 命名**）

- 删 `modes/code-audit/governance.yaml:15-16` 里 `declared in permissions.yaml` 这句，替换为指向同文件 `effects.classes`（`:40-48`）的陈述，并把 code-development 已经写好的那段"另一个文件不可能做到"的推理保留在此处（它是这个文件自己的债务，不是 code-development 的）。
- 不改 `authority.capabilities`（`:19`）、不改 `effects.classes`、不改 `governance.version`（`:1`）。
- 不改 `modes/code-development/governance.yaml:16-19`——它已经说对了；**但**它点名了 code-audit 的错误，改完 code-audit 之后这一句就过时了。处置：把 code-development 那句里的"code-audit's file says…"整段删掉（`:17-19`），因为被纠正的事已经不在那里；留着它就是一个新的过期断言。这是"文档最后，但同一次改动内"的实例。

### 10.4 让回归不可能的检查 + 必须变红的 fixture

- 检查（**编辑 `tests/code-audit-mode.test.ts`**，加进既有用例 `:394`（`"declares no gate, states its approval stance, and names only actions that can occur"`）或紧跟其后）：把这个文件为那两个名字所做的**唯一可机械化的断言**钉住——`governance.authority.capabilities` 里**注册表不持有**的名字，必须在同一文件的 `effects.classes` 里有条目。`:231-242` 已经示范了"两份清单必须一致"的写法（含 `assert.ok(registered.length > 0)` 的非空转保护），本条照抄那个形状：先断言这类名字的个数 > 0（今天正好 2 个），再逐个断言 `mode.effectClasses` 含它。
- **必须变红的 fixture**：把 `modes/code-audit/governance.yaml` 的 `effects.classes` 里 `repo.read: idempotent` 那一行在种子副本里删掉，断言检查报 `repo.read`。**理由**：这条检查是这次文档改写里唯一有机械内容的半句（"given an idempotency class below"），种子是它真的会红的唯一证明。
- 明确写出**它的边界**：这条检查不检查散文，也不管 `modes/pentest` 的 `net.scan`/`exploit.run`——后者是"声明了部署没有的 capability"这一**存档过的决定**（`src/pi-adapter/extension.ts:2269-2271` 与 `tests/host-work-mode.test.ts:121-125` 都写了），把它纳入本检查会与那条决定冲突。范围写进用例注释。

### 10.5 影响面

- 产品：2 个模式文档（`modes/code-audit/governance.yaml` 一段注释；`modes/code-development/governance.yaml:16-19` 删一句）。两份都是注释行，**不改任何被 loader 解析的键**，因此 `governance.version` 不动、`src/core/work-mode.ts` 的行为不变。
- 测试：1 个文件（`tests/code-audit-mode.test.ts` 一个用例内追加）。
- `.trellis/harness-surface.yaml`：`system-prompt: [AGENTS.md, modes]`（`:16`）含 `modes`，无需改；路径存在性校验（`src/core/harness-surface.ts:165-171` 一族的读法）不受影响。`CHANGE_SURFACES` 不变。
- 与任务 `10-03-unproducible-action-names` 的关系：本条**不动**那些名字，只把关于它们的句子改对；真正的"名字没人用"仍留给那个任务。

---

## 11. 规则 → 强制机制 对照表的落点

### 11.1 `AGENTS.md` 与 `tests/document-drift.test.ts` 的关键事实

- `AGENTS.md` 的可写区由两个 marker 划出：`AGENTS.md:21` `<!-- TRELLIS:END -->`，`AGENTS.md:19` 的说明是 `Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future \`trellis update\`.`；本仓库自己的段落 `AGENTS.md:26` `## Where this harness is documented` 就在 marker **之后**（`AGENTS.md:23-24` 的注释也这么写）。
- 该位置被测试钉住：`tests/document-drift.test.ts:230-234`
  `const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");` / `const SECTION = "Where this harness is documented";` / `assert.ok(agents.includes(SECTION), "AGENTS.md still carries this repository own section");` / `assert.ok(!managedRegion(agents).includes(SECTION), "and it is outside the managed block, which a tool update may overwrite");` / `assert.ok(agents.slice(agents.indexOf("<!-- TRELLIS:END -->")).includes(SECTION), "which is to say, after the end marker");`
- **刻意断言两条路径仍然缺失的那处**（原文）：`tests/document-drift.test.ts:353-358`
  `for (const known of [` / `".trellis/workflow.md: .trellis/spec/cli/backend/workflow-state-contract.md",` / `".trellis/workflow.md: .trellis/scripts/inject-workflow-state.py",` / `]) {` / `assert.ok(missing.includes(known), "the tool document no longer names " + known + ", so the note in AGENTS.md can be revisited");`
  它的理由写在 `:340-342`：`**The expected set is exact on purpose.** A check that skipped the tracked document would never say the day it stopped being broken, and the note this repository added to \`AGENTS.md\` is correct for exactly as long as these two paths are wrong`。这两条属于上游工具文件（`AGENTS.md:40-42` 说明它在 `.trellis/.template-hashes.json` 里），**本次改动不碰它**，新表也不得引用这两条路径。

### 11.2 仓库里是否已有同类表（先搜后建）

搜索结果：**没有**"规则 → 强制机制"的表。

- `docs/` 不存在（`glob docs/**` → 无文件）。
- `README.md` 的表是别的配对：`:242-247`（组件→职责）、`:337-344`（终止原因→含义→下一步）、`:580-584`（适配器→调用方式）。`README.md:320-331`（"策略如何生效"）是策略分工的散文，不是规则清单。
- `.trellis/spec/backend/index.md:21-40` 是规范索引；`.trellis/spec/backend/personal-agent-framework-core.md:191-197`、`.trellis/spec/backend/personal-agent-request-runtime.md:74-93` 是"条件→要求行为"的矩阵，主语是行为不是规则。
- 最近的邻居是 **`.trellis/harness-surface.yaml:31-36` 的 `verifiedBy`**（组件 → 验证它的套件）与 `:44-58` 的 `verifier`。它与本表**不是同一配对**（组件 vs 规则），因此不进它，也不复制它的内容：新表的 `Enforcer` 列允许写 `verifiedBy:<component>` 这类**间接引用**，由检查回到 `harness-surface.yaml` 解析——这样既不重复那份清单，又让两份清单互相咬合。

结论：**建一张新表**，落点 `AGENTS.md`（marker 之后），而不是新建文档、也不是塞进 `.trellis/spec/**`。理由三条：
1. `trellis update` 只拥有 marker 之间那块（`AGENTS.md:19`），marker 之后是本仓库内容，且已被 `tests/document-drift.test.ts:233` 断言在块外；
2. `AGENTS.md` 正是 Pi 每回合读进系统提示词的那份文件（这就是 `research/dove-pi-current.md` §3 (a) D2/D12 的证据链：`src/pi-adapter/extension.ts:3309` 拼的 `event.systemPrompt` 里含它），规则表放在这里才在"要遵守它的那个 agent"的上下文里；
3. `.trellis/spec/**` 虽然同样不被工具跟踪（`tests/document-drift.test.ts:247-248`：`const specs = Object.keys(hashes.hashes ?? {}).filter((path) => path.startsWith(".trellis/spec/"));` / `assert.deepEqual(specs, [], "a tool update tracks a specification now, so editing one may be reverted by it");`），但那是 `long-term-memory` 组件、由 Trellis 侧注入的 20 份规范，规则表在那里会变成第 21 份文档而不是一句在眼前的话。

### 11.3 表的列、`Enforcer` 列允许什么、以及那一条测试

- **列（四列，顺序固定）**：
  1. `Rule` — 禁止的那件事，写成一句可判定的禁令（不是名词短语："同一规则只允许一份实现"而不是"重复实现"）。
  2. `Level` — 修复所用的层级，取值只能是 `architecture` / `type` / `check` / `test` / `doc`（pstack 的梯队顺序即优先级；`doc` 出现在这一列是诚实的记录，`doc` 出现在 `Enforcer` 列是错误）。
  3. `Enforcer` — 一到多个可解析的指针（多个用 ` + ` 连接）。
  4. `Fails how` — 它红的时候打印什么，一句话；这一列是把"检查必须能让它红"写成可读事实的地方（也顺便回答"这条规则要是没有执行者，读者怎么知道"）。
- **`Enforcer` 列允许的前缀与解析规则**（每个前缀一条解析器，全在测试里头）：
  - `test:<path>#<case name>`：文件存在，且其文本含以该名字命名的 `it(`/`test(` 用例。
  - `suite:<path>`：文件存在（当整个文件的遍历本身就是那条检查时用）。
  - `type:<path>#<Symbol>`、`gate:<path>#<symbol>`：`await import(path)` 后该符名存在且是函数/对象——`tests/document-drift.test.ts:6-8` 已经在做同一件事（`import * as record from "../src/core/task-convergence.ts";`）。
  - `verifiedBy:<component>`：`<component>` 必须是 `.trellis/harness-surface.yaml:31-36`（或 `:15-24` 的 components 键）里的一个键，且其列表非空——**这是唯一的间接引用形式**，也是本表不与那份清单重复的机制。
  - `doc:<path>`：**不允许**作为执行者。理由写在表头：文档是 pstack 梯队里最后的一层，一个只由文档执行的规则等于没有执行者。
- **那条测试**：扩展 `tests/document-drift.test.ts`（新用例，**编辑既有文件**；该文件的 header `:13-15` 已经把"文档命名事物"分成了六类，这是第七类，header 的 `:37-38`（`**Why eleven cases in one file rather than four files**: they are one shape and the helpers are the rules.`）里的用例数需要一并更新）。它做四件事：
  1. 从 `AGENTS.md` 抽出表行（表必须**恰好一张**，且行数 ≥ 一个下限——防止"一个静静地什么都不匹配的检查"）；行数为零或表缺失即红。
  2. 每行的 `Level` ∈ 五个取值；每行的 `Enforcer` 至少含一个受支持前缀；`doc:` 出现即红（"这条规则没有执行者"）。
  3. 逐个解析 `Enforcer` 的每个指针；解析失败的红信息点名**行 + 指针 + 该指针的解析方式**（例如 `tests/does-not-exist.test.ts is named by the rule "<…>" and does not exist`）。
  4. 把 `AGENTS.md:230-234` 的那条"在块外"断言从单一 `SECTION` 拓宽成一份显式的本仓库段落清单，新表所在段落在其中。
- **必须变红的 fixture**（种子式，与该文件既有 `:187-204`、`:291-303` 同形）：
  - 一行 `Enforcer` 只写 `doc:README.md` → 必须报"没有执行者"；
  - 一行写 `test:tests/does-not-exist.test.ts#某用例` → 必须报文件不存在；
  - 一行写 `test:tests/document-drift.test.ts#a case that is not there` → 必须报用例不存在（证明它检查的是**用例名**而不是文件存在性——这正是 `research/dove-pi-current.md` §3 (d) D17 的教训）；
  - 一行写 `verifiedBy:不存在的组件` → 必须报组件未声明；
  - 一张空表 → 必须报"抽不出任何行"。
- **裁定**：一行规则在执行者消失时也必须消失——即"机制被删掉的那次改动，同时删掉这一行"，与 `tests/harness-reachability.test.ts:19` 的 `the list can only shrink` 同一条纪律。

### 11.4 这张表要承接的行（本文件十条的落点）

按 11.3 的四列，本文件十条各自产生的行（规则 / Level / Enforcer）至少包括：

| Rule | Level | Enforcer |
|---|---|---|
| 一份规则的执行者只能有一个实现 | architecture | `test:tests/one-rule-one-site.test.ts#…`（第 5、7 条共用） |
| 可兑现的隔离 claim 只能由一处判定 | architecture | `test:tests/work-mode.test.ts#…` + `type:src/core/work-mode.ts#ENFORCEABLE_SANDBOX` |
| 声明的选项键必须被读 | type | `test:tests/pi-adapter.test.ts#…` |
| 边界名单只能从声明表派生，且必须落在安装面快照内 | architecture | `test:tests/fence-drift.test.ts#…` + `type:src/core/invocation-disposition.ts#declaredNetworkToolNames` |
| 模式文档不得声明一个已经生效的控制"没有调用者" | doc | `test:tests/pentest-mode.test.ts#…` |
| 本仓库不能被工具更新覆盖的内容都在 marker 之后 | check | `test:tests/document-drift.test.ts#…`（既有用例拓宽） |
| 每条规则都要有能解析的执行者 | check | `test:tests/document-drift.test.ts#…`（本表自身） |
| 只有一条 exactly-once 判定 | architecture | `test:tests/effect-boundary.test.ts#…` + `verifiedBy:middleware` |

（这些行的具体 case 名在实现时确定；本表只规定形状与解析方式。）

---

## 12. 五问速查

| # | 缺陷 | 最高可行层级 | 改动性质 | 检查宿主 | 必须变红的 fixture |
|---|---|---|---|---|---|
| 1 | `ENFORCEABLE_SANDBOX` | architecture | 接线 + 删除 | `tests/work-mode.test.ts`(新) / `tests/host-work-mode.test.ts`(编辑) | 真实：`filesystem: ephemeral` 且不写 `isolation` 今天无人裁决；种子：词表外 claim |
| 2 | `readOnlyToolHardStopThreshold` | type | 删除 | `tests/pi-adapter.test.ts`(编辑) / `tests/strategy-snapshot.test.ts`(编辑) | 真实：探针报未读键；种子：`aKeyNothingReads` |
| 3 | `promptChars` | type | 删除 | `tests/pi-adapter.test.ts`(编辑) | 真实：探针报 `promptChars` |
| 4 | dispatch policy | architecture | 删除 | `tests/harness-reachability.test.ts`(既有) | 自带：删模块不删名单 → stale 方向红 |
| 5 | `dispatchOnce` | architecture | 删除 + 重写测试 | `tests/one-rule-one-site.test.ts`(新) | 真实：报 `effect-ledger.ts:417` |
| 6 | `getRemainingContextChars` | architecture | 删除 | `tests/pi-adapter.test.ts`(编辑) | 真实：导出面报两个预算函数 |
| 7 | 两个拒绝计数器 | architecture | 删除 + 接线 | `tests/one-rule-one-site.test.ts`(新) | 真实：报 `harness-axes.ts:63` |
| 8 | 三份工具面名单 | architecture | 删除 + 派生 | `tests/fence-drift.test.ts`(编辑) | 真实：`browser` 不在安装面快照里 |
| 9 | `modes/pentest/MODE.md` | doc | 改写散文 | `tests/pentest-mode.test.ts`(编辑) | 历史文本本身 |
| 10 | `code-audit/governance.yaml` | doc | 改写散文 + 删一句 | `tests/code-audit-mode.test.ts`(编辑) | 种子：删掉 `repo.read` 的 effect class |
| — | 规则→执行者表 | — | 新增表 | `tests/document-drift.test.ts`(编辑) | 种子五条（无执行者/文件不存在/用例不存在/组件不存在/空表） |

**两次必须显式做的二选一**（不能默认任何一种）：第 2 条是否保留 `StrategyBudgetSnapshot.hardStop` 这个通用槽位（对外 RPC 形状）；第 4 条是否连 `dispatch.decided/completed` 的封闭集成员一起删（`tests/execution-correlation.test.ts:68` 等三处字面量会跟着改）。
