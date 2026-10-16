# The host does not provide the hashline edit tool, and the harness says so but runs on

## Goal

Measured: the extension's own status output prints that the current Pi host does not provide the hashline edit tool, and points the reader at installing it. The agent then worked on a real library without those editing tools, and its single change fixed nothing and broke a test that had been passing. The harness knows and states the fact, and continues, so the session looks the same from the outside as one that had the tools. Open question for the design: refuse the session, degrade with the degradation recorded where the reading will show it, or treat the tool as optional and say why.

## 更正：**原因不是宿主**（实测 2026-10-05，故本任务的标题与前提都要改）

**上面那句"当前 Pi 宿主未提供 hashline 编辑工具"是扩展的原话 ✓，而它把原因归错了** ✗✓✓：

| 测的 | 读数 |
|---|---|
| 宿主装没装 | **装了** ✓：`~/.pi/agent/npm/node_modules/pi-hashline-edit-pro` ✓（`pi-lens` 等十二个也在 ✓） |
| field run 带没带**声明** | **带了** ✓：运行自己的 `settings.json` 里有 `npm:pi-hashline-edit-pro@2.7.0` ✓ |
| field run 带没带**包** | **没带** ✗：`PI_CODING_AGENT_DIR` 指向运行自己的会话目录 ✓，里面只有 4 个 json + 会话记录 ✓，**没有 `npm/`** ✗ |
| 把 `npm/` 放进去会怎样 | **`hashlineEditTools=present`** ✓✓、`hashline=active` ✓，其余扩展一并加载 ✓（同一场景、同一克隆 ✓） |

→ **机制**：**声明随 `settings.json` 走，包不走** ✓ —— Pi 从 agent 目录自己的 store 解析包 ✓，所以只有声明到场时**每一个包都加载不了** ✗。**可修面在本仓的运行器**（`scripts/real-dove-blackbox.mjs` 的携带清单 ✓），**不在 Pi** ✗。
→ **已修** ✓：运行器现在连 `npm/` 一并拷入（拷贝 ✓，原件不会被碰 ✓；实测整库 361 MB / 15,272 文件，**约 10 秒** ✓），field-run 规范 §2 的携带清单同步更新 ✓。
→ **而这还牵出两条与*判断*有关的** ✗✓：① **那个 agent 并不缺编辑工具** ✗ —— 它在同一轮里用宿主的 `edit` 改了 3 次 ✓，缺的只是 *hashline* 那一族 ✓，所以"没有编辑工具导致改坏了"这个说法要按这一层重写 ✓；② **历史 field run 的"工具面"读数都不是操作者的工具面** ✗✓ —— 凡是拿那些读数谈工具面的结论，都要按本条重读 ✓。

**本任务还开着的部分** ✓：**要不要把"缺了哪一族编辑工具"变成读数的一个字段** ✓（本轮已由扩展状态行的 `hashlineEditTools=absent/present` 满足 ✓），以及**声明的包与包库不一致时该不该拒绝会话** ✓ —— 这条现在有了真实的判据（声明到场而包缺席 ✓），比原来的"宿主不提供"可测得多 ✓。

## Requirements

- **R1 缺了哪一族编辑工具必须是一个读数** ✓：由扩展状态行的 `hashlineEditTools=present|absent` 满足 ✓（`extension.ts:1280`，读自 `hashlineEditTools` 的同一处判定 ✓）—— 本任务**不再为同一事实加第二个字段** ✓。
- **R2 声明的包与包库不一致时，会话的行为必须被明确选定** ✓：**拒会话 (i)** 或 **加载并记录 (ii)** ✓。`design.md` 给出两条分支、各自的证据与一条建议 ✓；**选哪条是操作者的决定** ✓。
- **R3 无论选哪条，不一致本身要被*指出*** ✓，而不是被默默留下 ✓（仓的教条：refused, never ignored ✓）。
- **R4 结论落进规格** ✓（`personal-agent-field-run.md` 的携带清单旁 ✓），并带**可解析的锚点** ✓。
- **R5 先红后绿** ✓：任何行为改动都要有**今天必红**的用例 ✓。

## Acceptance Criteria

- [x] **缺了哪一族编辑工具是读数** ✓：`hashlineEditTools=absent|present` ✓，其用例已在 `tests/pi-adapter.test.ts` ✓。
- [x] **R2 的选择被写下来** ✓（2026-10-14，操作者选 **(ii)** ✓），并按 (ii) 落地 ✓（见下）。
- [x] 一条**今天必红**的用例 ✓：`tests/pi-adapter.test.ts` 的 "names the declaration that has nothing behind it, instead of blaming the host" ✓ —— 红的时候读数正是缺陷本身 ✓：`actual: '当前 Pi 宿主未提供 hashline 编辑工具（…）'` ✗、`expected: /pi-hashline-edit-pro/` ✓。
- [x] 一条**对照**用例 ✓：同一声明、同一缺失的工具族 ✓，唯一区别是**包库里有那个包** ⇒ 消息**不得**把那个声明说成原因 ✓；否则"凡是读得到的声明都点名"的消息也会过掉主用例 ✓。
- [x] `pentest`/`trading` 等模式与现有工具面用例**全部保持绿** ✓（(ii) 下不拒任何会话 ✓；全套 986/986 ✓）。
- [x] 引文门保持全绿 ✓（四条文档门 34/34 ✓）。

## 落地（2026-10-14，按 (ii)）

- **新模块** `src/pi-adapter/declared-packages.ts` ✓：`npmPackageNameOf` 把 `npm:<name>@<version>` 解成包名 ✓（作用域名以 `@` 开头 ⇒ 版本分隔符取**最后一个** `@` ✓），`declaredPackagesMissingFromStore` 拿声明去包库查 ✓，`NPM_STORE_FROM_AGENT_DIR` 是那条**实测**得来的相对路径 ✓（宿主把自己的 npm root 保持私有 ✓，所以这条路径由我们命名并注明来历 ✓）。
- **那句归错原因的告警改了** ✓（`src/pi-adapter/extension.ts` 里 `!hashline && hasEdit` 那段 ✓）：它**点名**声明里包库没有的包 ✓、说出**查的是哪个包库** ✓；两者一致时它**说一致** ✓，而不是继续声称宿主不提供 ✗ —— 那是这段代码**从来没法检查**的一句话 ✓，正是本仓反复在找的那一类 ✗。
- **声明走宿主的读法** ✓：`SettingsManager.getPackages()` ✓（不手解 `settings.json` ✓）；`getAgentDir()` 实测**调用时读环境变量、不缓存** ✓ ⇒ 用例可中途改 `PI_CODING_AGENT_DIR` ✓。
- **两处我自己的坑，记在用例注释里** ✓：① `representativeTools` **含** `replace`/`insert` ✓ ⇒ 用它那条告警根本不触发 ✗，用例必须自带一个"有 `edit`、无 hashline 族"的工具面 ✓；② 夹具缺 `cwd` 时 `SettingsManager.create` 抛 `TypeError` ✗（`normalizeWindowsShellPath(undefined)` ✓）⇒ 给 `FakeContext` 补了 `cwd?: string` ✓。
- **规则行** ✓：AGENTS.md 加"消息要点名它自己代码能检查的原因" ✓，执行器就是主用例 ✓。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
