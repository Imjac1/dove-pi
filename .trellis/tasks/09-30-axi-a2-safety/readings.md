# A2 读数

判据与决策表见 `prd.md` / `design.md`。**失败、未完成、以及自我纠正都写在这里。**

---

## S3（提前执行）jailer：把边界从探针变成模块 + 回归测试 —— ✅ 通过

**为什么提前**（偏离 `plan.md` §5.3 的顺序，属于有意为之）：S3 原排在 S1（最窄一回合）与 S2（组件面）之后。提前的理由是你们自己的规矩——**A2/A3 是没有先例的两块，不排在最后**；而边界必须在"有东西在里面运行"之前就存在，否则它是在运行之后才被加上去的。代价：S1 的读数因此还没拿到（记在下面"未完成"）。

**产物**（新仓 `C:\Users\Macfy\Desktop\dsh\axi`，提交 `75df0e6` → `515f45f` → `a145fe1`）：

| 文件 | 它是什么 |
|---|---|
| `tools/jailer-host.ps1` | **机制半边**：`CreateRestrictedToken` / `CreateProcessAsUser` / 用 `Get-Acl` 出结构化 ACL。源码在本仓，不走第三方原生绑定 |
| `src/jailer/types.ts` | **契约**：`BoundarySpec`、两条不变量、`SelfCheck` 的类型 |
| `src/jailer/host.ts` | 唯一调用助手的地方；**文件协议**（请求写文件、结果读文件） |
| `src/jailer/acl.ts` | `ensureBoundary`：用 `icacls` 设，再**读回来**按不变量判（不能靠声明满足） |
| `src/jailer/token.ts` | 建受限令牌并**读回限制 SID 列表**，空列表即失败关闭 |
| `src/jailer/launch.ts` | 以该令牌起改进者；形状上让它**不可能当自己的 jailer** |
| `src/jailer/index.ts` | 对外三个动词：`ensureBoundary` / `probeToken` / `launchJailed` |
| `tests/jailer.test.ts` | **六条**：不变量成立、仪器自检、判据 3、判据 1、判据 2、**正向对照** |

### 原始读数

| 读数 | 值 |
|---|---|
| `tests/jailer.test.ts` | **6 tests / 6 pass / 0 fail**（7.4 s） |
| 门禁全量（迁移基线 **816 / 814 / 0 / 2**） | **822 / 820 pass / 0 fail / 2 skipped**（= 基线 + 新增 6） |
| `npm run typecheck` | exit **0** |
| `npm run test:installer` | Ran **141** tests / OK |

**AC-6 的进度**：① Plane B 路径无 `Everyone` 授予 ② Plane A 路径有 → 两者现在是 `ensureBoundary` 的断言 ✓；③ "受限进程摘不掉限制" → 成了判据 2 的回归，并且**在测试里断言 ACL 前后逐字相同** ✓；④ 写进规格 → 仍未做（按 AC-6 的措辞，等本阶段实现落地）。

### 三条自我纠正 / 仪器教训（都留档）

1. **门禁抓到了我**：`tests/harness-reachability.test.ts` 红了——"these modules nothing reaches are not on the allow-list"。我新加的 6 个模块没有任何东西到达它们。修法按该文件自己的规矩：**要么接线，要么带理由登记**；我登记了理由，并写明"**删掉条目才是那个模块的完成定义**"。这不是障碍，是迁移过来的门禁在正常工作——新仓的第一条真实读数就是"有人试图加没有消费者的代码"。
2. **PowerShell 的 `$pid` 是只读自动变量**：助手程序里 `$pid = 0` 让整个 `verb=run` 路径抛异常，被 `catch` 成 `{ok:false, stage:'exception'}`。**这条错误在 TS 侧表现为 `selfCheck: 'unreadable'`，于是失败关闭生效——没有任何结论被读出来。** 仪器自检抓到了仪器自己的 bug，这正是它存在的理由。
3. **Node 的 spawn 引号**：`cmd /c <带内层引号的命令>` 必须用 `windowsVerbatimArguments: true`，否则 Node 把 `"` 转义成 `\"`，`icacls` 回 **exit 87**（ERROR_INVALID_PARAMETER）——而那同一行手打是好的。这条直接导致正向对照一开始失败。

另有一条**载荷记录**（不是缺陷）：助手在 `verb=probe` 的结果里带一个 `readLengthQuery: 122`（ERROR_INSUFFICIENT_BUFFER，来自长度查询），已在字段名里注明"预期，非故障"，免得后来人当异常读。原先它叫 `readError`，会误导。

### 未完成 / 下一步

- **S1 最窄的一回合**（`loop-runner` + scripted provider + 一个只读工具 + 名字层闸门 + ledger + 打印回合）：判据是配对闸门测试 `executedActions 1 → 0`，以及一次 keep 与一次 revert 走得通（AC-4 的骨架）。**S3 提前之后，这是下一件事。**
- **接线**：jailer 现在"没有人到达"。当 loop 的派发路径 import `launchJailed` 时，`harness-reachability` 的对应条目必须**删掉**——那是这个模块接线完成的定义。
- **AC-6 ④**：把两条不变量写进规格（规格描述"现在就有"的东西，所以排在实现落地之后）。

---

## 合回本仓 + 施工仓退役 —— ✅ 通过（形状决定之后的第一批真实产物）

**依据**：程序任务 `prd.md` 的形状决定（**一个东西、一个仓**）与 `implement.md` 的第一条。提交 **`5f14588`**（+874 行）。

### 做法

| 步 | 做了什么 |
|---|---|
| 1 | 从施工仓取 9 个文件（6 个 `src/jailer/*.ts` + `tests/jailer.test.ts` + `tests/harness-reachability.test.ts` + 助手脚本），**先断言目标路径在本仓都不存在**——无覆盖 |
| 2 | 助手脚本落 **`src/windows-runtime/jailer-host.ps1`**，不是新开 `tools/`：本仓 `directory-structure.md` 有成文的规矩——"**Keep deterministic PowerShell/workspace behavior in `src/windows-runtime`**"。**先读了规格再选落点** |
| 3 | 四处引用旧路径的地方（`types.ts` ×2、`host.ts` ×1、测试 ×1）逐处替换，**每处断言出现次数** |
| 4 | 合并后跑三条门禁 |

### 原始读数（本仓）

| 门禁 | 合并前 | 合并后 |
|---|---|---|
| `npm run typecheck` | 0 | **0** |
| `npm test` | 816 / 814 / 0 / 2 | **822 / 820 pass / 0 fail / 2 skipped** |
| `npm run test:installer` | 141 OK | **141 OK**（14.7 s） |

**六条 jailer 回归是在本仓跑的**，不是"抄过来的测试"。

### 两条自我纠正（守卫按设计生效，**两次都没有写入**）

1. 我先写了个"用重写的文字复原那一块"的校验，结果**不相等** → 守卫 `throw`，什么都没写。原因：我在脚本里把那段理由文字重写了一遍，而记录里是另一份。改成**以记录为准**——原文照搬，再做可断言的路径替换。
2. 替换 `types.ts` 的路径时我假设出现 1 次，实际 **2** 次 → 守卫再次 `throw`。（**同一类错误**：`plan-v8` 那次的 `<CR>`/`<NUL>` 也是"我以为它只在那一处"。教训是**数出来，别假设**。）

### 施工仓的退役（可复原）

| 项 | 值 |
|---|---|
| 退役的绝对路径 | `C:\Users\Macfy\Desktop\dsh\axi`（删前打印并核对过） |
| 历史备份 | `C:\Users\Macfy\Desktop\dsh\axi-scaffolding-a145fe1.bundle`（**1206.5 KB**，`git bundle verify` → `is okay`） |
| 恢复方式 | `git clone axi-scaffolding-a145fe1.bundle <dir>` |
| 三个提交 | `75df0e6`（S0 快照）→ `515f45f`（jailer 模块）→ `a145fe1`（allow-list 登记） |

---

## S4（A2 后半）：参数层的语法感知 —— 第一片 ✅（提交 `49cd262`）

**为什么从这一片开始**：§4.2 的部件 1 是"**按语法判参数，不是按名字匹配**"，而本仓已有的最接近实现是 fence —— 它拿"调用者选的字符串"去比"声明的路径"。**这正是实测规避（98% / 88%）最便宜的那一种，而且不需要任何对抗意图**：Windows 自己就把若干种写法当作同一个文件。

**缺口（先证后改）**：`declaredPrefixHit` 对**目录前缀**按 `prefix + "/"` 匹配，所以文件名上的尾随点在目录条目下逃不掉；但**精确文件条目**是按相等比较的 → `…harness-surface.yaml.` 落在它外面 ✗。红测试第一次失败就打在尾随点上（最便宜的那一种）。

| 写法 | 改前 | 改后 |
|---|---|---|
| `…yaml.`（尾随点） | **逃掉** | 拒绝 |
| `…yaml `（尾随空格） | **逃掉** | 拒绝 |
| `\\?\C:\ws\…`（扩展长度前缀） | **逃掉** | 拒绝 |
| `\\.\C:\ws\…`（设备前缀） | **逃掉** | 拒绝 |
| 大写 / 反斜杠 / `./` | 已拒绝（既有归一化） | 拒绝 |

`..` **刻意不动**：把它修剪成空段会被读成"工作区根"，那就把一次拒绝变成一次放行——所以它有自己的断言。

**读数**：`tests/evasion-spellings.test.ts` **4/4**（含"纯写法被拒"的对照 + "未被命名的文件不拒"的效用臂）；五个邻居套件 **68/68**（更严的归一化没有回退任何既有行为）；全量 **829 / 827 pass / 0 fail / 2 skipped**；installer **141 OK**。

### S4 剩余（都是没做的，不是"顺便完成"）

1. ~~**跨调用累积**（一次操作拆到多个调用里完成）~~ → **已完成，见下**；
2. **历史无关**（重试到判据被压缩/淘汰洗掉）；
3. **保持性传感器**（这条声明是否**仍然**管住这一轮）；
4. **7-mutation 故障注入**（逐条打断契约，确认对应校验器报警）；
5. **语义层的技巧检测**：今天 `excluded_techniques` 是从**声明字段** `technique` 读出来的——**字段可以不填**，所以"用等价写法做出 dos"还检测不到。要做成**可判**的，需要一个"技巧名 → 可检测的语法形态"的**声明式字典**（语料里 tree-sitter + arity 字典那一档）；只靠这里的分词过不了关。

---

## S4 切片 1：跨调用累积 —— ✅（提交 `3bab9a4`；架构见 `design.md` 的"落地架构"一节）

**红 → 绿**。红时的读数是"第二次调用（2 + 2 > 3）被放行"——**每次都在单次上限之内，是序列越界**。实现后：

| 断言 | 它看住什么 |
|---|---|
| 逐次合法、合起来越界 → **拒** | 这就是 §1.3 的第二种手法 |
| 理由说清"这是关于**和**的" | 标签仍是 `limit`（同一类问题），"累计"写在 reason 里；remedy 给两条出路（一次做完 / 经授权文档正式提高上限） |
| **被拒的调用不计数** | 与既有 `recordRun` 契约一致：*"an allowed action that never runs, and a blocked one, must not spend the phase's budget"* |
| 效用臂 | 单次 3 仍通过；**新会话干净**（状态按会话而非全局）；未被 limit 命名的工具不受约束 |

**读数**：邻居四套件 **79 / 79**、全量 **832 / 830 pass / 0 fail / 2 skipped**、`typecheck` **0**、installer **141 OK**。

**它挡不住什么（写在前面，免得后来人当成万能）**：**没有受限参数**的动作被拆分——那需要"什么使两个动作相同"的判定，属于 ① 语法解析那片。

---

## 检查回合（工作流 2.2：派 `trellis-check` 子代理）—— ✅ 两条阻断级缺陷

**这一回合本身是一课**：我先前每轮都自己跑"三个门禁"当作检查。三个门禁全绿的那两次提交里，**两条阻断级缺陷都在**。门禁绿 ≠ 检查过。

### 缺陷 A（我引入的）：**受限范围的 `max` 被每个工具花掉**

一次 `recordRun` 会把**每一条**已声明 limit 都累加，只要参数路径能读到数——不管这次调用是不是该 limit 命名的工具。**实测（改前）**：

```
recordRun({tool:"read_file", arguments:{count:9}}); evaluate({tool:"bulk", arguments:{count:1}})
  → block  "…is a ceiling per call and per session: 9 has already run…"
```

**这对已发布的模式是活的**：`modes/trading/governance.yaml` 把 `notional`/`quantity` 用 `tools: [order.submit]` 限定。而**我那条效用臂看不见它**——它只 `evaluate` 了无关工具，从没 `recordRun` 过它。**一条读起来像覆盖、实际没覆盖的测试。**

修复：一个 `limitApplies(limit, tool)` 谓词**同时**供判定与记账使用（`4c7275a`）。

### 缺陷 B（本来就有的）：**不变量被检查在"声明条目"上，而它说的是"整棵被声明的树"**

在真实受限令牌下实测：held-out 树的一个**子项**自带 `Everyone:(OI)(CI)M`（显式 ACE，**不是继承来的**）→ 根上的 `/inheritance:r` **移不掉它** → `ensureBoundary` 报 `violations: []` → **受限进程写进了那棵本该是 Plane B 的树**（exit 0，文件真的存在）。

修复：held-out 路径加 `/remove:g /T`，可写路径加 `/grant /T`（同一个缺陷的镜像症状：可写树里一个自带 ACE 的子项会把受限进程**挡在它本该能做的工作之外**，读起来像边界、其实是策略坏了）（`398025c`）。

同时纠正：`readings.md` 说判据②断言"ACL 逐字不变"，而测试实际比的是一个授予**数量**；且 `icacls` 从受限令牌**读** ACL 也返回 exit 1——所以非零退出**不能**单独区分"写被拒"与"这令牌下 icacls 什么都做不了"。承重的读数是 ACL 本身。

### F-7（**报告但未修**，决定权交回给我）：**fence 是词法比较，一个 junction 就绕过它**

实测（`mklink /J` **不需要管理员**，status 0）：

| 目标 | `relativeTarget` | `fenceHit` |
|---|---|---|
| `ws\.trellis\harness-surface.yaml` | `.trellis/harness-surface.yaml` | **true** ✓ |
| `ws\link\harness-surface.yaml`（junction） | `link/harness-surface.yaml` | **false** → **放行** ✗ |
| `ws\..trellis\harness-surface.yaml` | `undefined` | false ✗ |

### 我的决定：**fence 可以碰文件系统，但只在 fence 分支里碰**

- 这是一类**同一个文件的等价写法**——与我上一片关掉的那一类**同类**，而它更彻底：junction 指向哪里，词法比较根本不知道。
- 边界的作用就是"管住 harness 自己的控制面"。**一个 junction 能绕过的边界，是在多说自己做了什么**（D4）。
- **范围刻意收窄**：只在 fence 分支对目标做 realpath 规范化，**不改** `workspaceRelativeTarget` 本身——它还被 `harness-round.ts` 的读数共用，改它会把读数一起改掉。
- **两条已知残差，先说清**：① 目标不存在时无法 realpath → 要**下探到最深的已存在祖先**再拼余下的段；② 检查之后再建 junction 是 TOCTOU 窗口——与 jailer 那次"读的是声明路径、不是其内容"属于同一类残差。

**为什么当时先不做**：AC-1 的三种手法里没有 junction，而这条要动的是**判定路径上的系统调用**与一个被共用的函数——它是一个**有自己测试与取舍的切片**，不是顺手补的那一行。已列为下一步第一片。

**→ 已完成（见下）。**

---

## F-7 实施：目录别名绕过 fence —— ✅（提交 `e8a0baf`）

**红 → 绿**。红时的读数**恰好是那条缺陷**（对照组拦、别名放行）：

```
✔ refuses the fenced file spelled directly, which is the control
✖ refuses it when a junction names it instead
   > AssertionError: an alias named the fenced file and the fence did not see it
     'allow' !== 'block'
✔ still allows a file behind the same junction that the fence does not name
```

**一处先前判断的纠正**：我以为"判定路径上碰文件系统"是个新决定，要慎重——**`action-policy.ts` 早就 import 了 `node:fs`**（`existsSync` / `readFileSync`），所以这不是新面，只是把同一个模块已有的能力用到了 fence 分支上。

**实现**（`src/core/action-policy.ts`）：

- `canonicalTarget(path)`：从**最深的已存在祖先**取 `realpathSync`，再把余下的段拼回去。**为什么不是整条路径**——一次写可能指向还不存在的文件，而 `realpathSync` 拒绝它打不开的东西；只解析存在的那部分，才让"同一个文件"对**已存在**与**将创建**的两种都成立。
- **两侧都规范化**：目标与 `workspaceRoot`（后者在策略构造时算一次——fence 是唯一消费者，每次调用都 realpath 一遍根是没有读数支撑的开销）。
- **只在 fence 分支**用：`workspaceRelativeTarget` 本身不动，`harness-round.ts` 的读数因此保持原意。

**残差如实写着**：检查**之后**才建的 junction 是 TOCTOU 窗口，这个方法关不掉——fence 读的是调用到达时的现状。这与 jailer 那条"读的是声明路径、不是其内容"属于同一类。

**测试本身的教训**：第一版用了 `execFileSync(..., { windowsVerbatimArguments: true })` → **`typecheck` 红**（那是 `spawnSync` 的选项，不在 `execFileSync` 的类型里）。本仓记录过的那条引号教训用的正是 `spawnSync`——照它改，并把"junction 建成功"变成**断言**（否则下面每一条都会空过）。清理用 `rmdirSync`：**`rmSync(recursive)` 会顺着 junction 递归进目标**，测试里另有一条断言看住这件事。

**读数**：新套件 **4 / 4**；fence 邻近五套件 **84 / 84**（规范化没有改到既有判定）；全量 **838 / 836 pass / 0 fail / 2 skipped**；`typecheck` **0**；installer **141 OK**。

---

## 切片 2：历史无关 —— ✅ **证明片**（提交 `9ac178a`）

**先取证，再决定这一片是修补还是证明。** 结论是**性质已经成立**，所以它是证明片：

| 取证 | 读数 |
|---|---|
| 判定状态住在哪 | 策略实例里（`phaseCounts` + `limitSums`），**与消息历史无关** |
| 策略何时重建 | 只在**模式加载**路径里（`activeActionPolicy = undefined` → `createActionPolicy`）；夹具的用例证明 `session_start` 这条路径包含它 |
| 上限何时花掉 | **`extension.ts:2803`**，`recordRun` 在"动作被许可之后"、**同一个 `tool_call` 处理器内**（原文：*"Counted once the action is permitted"*） |
| 压缩钩子做什么 | `session_before_compact` **只**在"重试 + 非幂等效果已开始"时**取消**压缩；它不写策略、不写账本、不重置任何东西 |

**证明的形状**（加在拥有 host 夹具的套件里，而不是另造一份夹具——那是第二份实现）：花掉一次上限 → 触发 `session_before_compact` 与 `session_compact`（**两个都触发**，因为"替换历史"的是这一对）→ **同一次调用仍然被拒**，且理由仍是累计。

**它不是空过的**：中间那条断言（第二次调用被拒）只在处理器**真的**花掉上限时成立——一条从不记账的路径会在那里红，而不是安静地什么都不证明。

**刻意没做的一条腿**：`压缩不得改写证据`（账本逐字节不变）属于 **A3 的 trace 通道**；在这里量它就是 A3 那个问题的第二份拷贝。

### 一条已量/未量的边界（写清，别当漏洞）

`resume` / `fork` / `reload` / `new` 会**重建策略**，于是**会话上限重置**。

- **依据（已读代码）**：策略在模式加载路径创建；`session_shutdown` 的四种 reason 正是这四个。
- **未实测**：我没有真跑一次 `resume` 看上限是否重置。**这是一条推断，不是读数**——按本仓的规矩，推断就要标成推断。
- **结论**：按会话保持，边界如实标注。**不要**用"历史上出现过什么"去补它——那正是这一片要挡的东西；要跨会话就得让账本记住受限参数值，那是新增记录种类 = 改词汇，属于另一个决定。

**读数**：该套件 **34 / 34**；全量 **839 / 837 pass / 0 fail / 2 skipped**；`typecheck` **0**；installer **141 OK**。

### 检查回合的读数（我自己复跑过，不采信它的数字）

`typecheck` **0** · `npm test` **834 / 832 pass / 0 fail / 2 skipped**（137 套件，较基线 **+2 测试 +2 通过**）· installer **141 OK** · jailer 单独 **7 / 7**。

**理由**：同一个东西内部留着第二个可以构建的地方，就是在邀请漂移——那正是形状决定要消掉的东西。历史留在 bundle 里，产物留在本仓。

### 下一步

`plan-v8.md` 重基（§5.2 新仓目录树、§5.4 迁移整节随形状作废；新增"一个东西的形状"；§5.3 顺序按实际重排），并**顺带解掉它 81,319 字节 > 32,768 注入上限**这条缺陷（拆成按节的文档 + 索引，让 `implement.jsonl` 指向"节"）。之后是 **S1 最窄的一回合**。
