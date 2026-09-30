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

**理由**：同一个东西内部留着第二个可以构建的地方，就是在邀请漂移——那正是形状决定要消掉的东西。历史留在 bundle 里，产物留在本仓。

### 下一步

`plan-v8.md` 重基（§5.2 新仓目录树、§5.4 迁移整节随形状作废；新增"一个东西的形状"；§5.3 顺序按实际重排），并**顺带解掉它 81,319 字节 > 32,768 注入上限**这条缺陷（拆成按节的文档 + 索引，让 `implement.jsonl` 指向"节"）。之后是 **S1 最窄的一回合**。
