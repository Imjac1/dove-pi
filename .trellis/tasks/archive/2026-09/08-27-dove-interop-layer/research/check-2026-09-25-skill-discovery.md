# 2.2 质量检查结果：skill 发现路径依赖（blocking）

**日期**：2026-09-25
**任务**：08-27-dove-interop-layer
**被测版本**：全新克隆，HEAD `d7a6175`（= origin/master，工作树 clean）
**结论**：**FAIL — 1 个 blocking 缺陷**。任务的 9 条 AC 全部勾选，但 AC 所引用的测试在本机红。

## 检查执行

```
git clone https://github.com/Imjac1/dove-pi        # 150 commits，分支 master
python ./.trellis/scripts/init_developer.py aixi   # .developer 被 .trellis/.gitignore 忽略
npm ci                                             # 242 packages
npm run typecheck                                  # PASS (exit 0)
npm test                                           # FAIL
```

| 项 | 结果 |
|---|---|
| AC 引用的 5 个测试文件存在 | ✓ interop-smoke-matrix / capability-protocol / local-rpc / mcp-adapter / interoperable-context |
| `npm run typecheck` | **PASS**（exit 0）|
| `npm test` | **FAIL** — tests 318 / pass 314 / **fail 2** / skipped 2 |

失败项：

- `tests/skills-discovery.test.ts:16` — finds nested project skills and extracts frontmatter descriptions
- `tests/project-provider.test.ts:407` — reports native project readiness without requiring skills
- 失败 suite：`skill discovery`、`Dove native project provider`

## 根因（已实证，非推测）

`src/skills/discovery.ts:16-27`：从起点**一路走到文件系统根**，每层都拼 `.agents/skills`。

```ts
export function discoverSkills(startPath = process.cwd()): readonly DiscoveredSkill[] {
  let current = resolve(startPath);
  while (true) {
    const skillsRoot = join(current, ".agents", "skills");
    collectSkillFiles(skillsRoot, skillsRoot, discovered);
    const parent = dirname(current);
    if (parent === current) break;   // ← 只有走到文件系统根才停
    current = parent;
  }
  ...
}
```

而 `src/project-status.ts:18` 直接拿它当项目 skill 数：

```ts
const projectSkills = discoverSkills(provider.projectRoot).length;
```

### 实证数据（探针已在 dove-pi 内跑过，脚本见本目录 probe-skill-discovery.mts）

| 项目位置 | 发现的 skill |
|---|---|
| `C:\Users\Macfy\AppData\Local\Temp\dove-probe-xxx` | **6 个** = 1 个本地 + 5 个从 `C:\Users\Macfy\.agents\skills` 继承 |
| `D:\_dove_probe\dove-probe-xxx` | **1 个** = 只有本地 |

**同一份项目内容，换块盘结果就不同。** 那 5 个是：
`agent-browser`、`grill-me`、`grill-with-docs`、`paseo`、`vercel-react-view-transitions`
（均位于 `C:\Users\Macfy\.agents\skills`，安装时间 2026-04 ~ 2026-06）

## 为什么这是产品缺陷，而不是测试缺陷

`discovery.ts` 的注释自称：

> Discover project skills using the same `.agents/skills` convention as Pi.

但 Pi 官方 `docs/skills.md`（`@earendil-works/pi-coding-agent` 包内）写的是**两条独立规则**：

> Pi also supports the Agent Skills locations `~/.agents/skills/` and `.agents/skills/`.
> Project `.agents/skills/` directories are discovered from the working directory through its ancestors,
> **stopping at the repository root when one exists.**

| | Pi 约定 | dove-pi 现状 |
|---|---|---|
| 用户级 `~/.agents/skills/` | **显式位置**，与项目在哪无关 | 无此概念，仅靠向上走**碰巧**撞到 |
| 项目级向上走 | **遇仓库根（`.git`）就停** | 一路走到文件系统根 |

后果：

1. **行为随项目在磁盘上的位置变化** —— 位于 `C:\Users\Macfy\` 之下的项目会继承用户级 skill，位于 `D:\` 的不会。
2. **`projectSkills` 名不副实** —— 它把继承来的用户级 skill 算成项目 skill。
3. **CI 绿、本机红** —— GitHub runner 没有 `~/.agents/skills`，所以 CI 一直是过的，本机一直会红。
4. 项目若在 git 仓库内，向上走会越过仓库根，可能继承到**兄弟/上层项目**的 skill（Pi 明确不会）。

## 为什么是 blocking

该任务 AC 明确把 project provider tests 列为证据：

> ...`tests/interoperable-context.test.ts`, context compiler tests, and **project provider tests** cover
> separately labeled authorities, explicit conflict diagnostics, index-first disclosure, targeted excerpts,
> estimates, and lightweight/degraded startup.

且另一条 AC 要求：

> A project with Trellis, `AGENTS.md`, `CLAUDE.md`, or Agent Skills produces **one normalized context projection**

当前行为不 normalized（随路径变化），且被引用的测试在本机不可复现 → **不能宣称该 AC verified**。

## 建议修法（小、有界）

1. **项目级走查在仓库根停**：向上查找 `.git`（或 `.trellis`）作为边界，到边界即停。
2. **显式处理用户级 `~/.agents/skills`**：作为独立位置纳入（可配置），使其与项目位置无关。
3. 这样 `tests/skills-discovery.test.ts` 与 `tests/project-provider.test.ts` 的期望自然成立，
   且跨盘 / 跨机器 / CI 一致。

改完后按 2.2 重跑，并重跑全量 `npm test` 确认 318/318。

## 复现命令

```powershell
cd C:\Users\Macfy\Desktop\dsh\dove-pi
npm run typecheck
npm test                      # 期望：本机 fail 2；CI 绿
node --import tsx .trellis/tasks/08-27-dove-interop-layer/research/probe-skill-discovery.mts
```

## 本轮的改动声明

- **未修改 dove-pi 任何受版本控制的文件**（`git status` dirty = 0，HEAD 仍是 `d7a6175`）。
- 只新增了被 gitignore 的 `.trellis/.developer` 与 `node_modules/`。
- 探针文件在验证后已从仓库根删除，内容另存于本目录的 `probe-skill-discovery.mts`。

---

## 修复记录（2026-09-25，已实施）

按上述「建议修法」改了三处 + 一处注释：

| 文件 | 改动 |
|---|---|
| `src/skills/discovery.ts` | `discoverSkills` 改为**项目作用域且有界**：遇仓库根（`.git`）即停；若起点在用户主目录之下，走到主目录前即停（不再把 `~/.agents/skills` 当成项目 skill）。新增 `discoverUserSkills()`（显式 `~/.agents/skills`）与 `discoverAllSkills()`（项目优先，同名项目覆盖用户）。辅助函数：`safeHomedir` / `samePath` / `isStrictlyBelow` / `hasRepositoryRoot` / `sortSkills`。 |
| `src/context/interoperable.ts` | 上下文投影改用 `discoverAllSkills`（项目 + 用户）|
| `src/pi-adapter/extension.ts` | `/skills` 列表改用 `discoverAllSkills`，并同步命令描述与空状态文案 |
| `src/cli.ts` | `dove-pi skills` 改用 `discoverAllSkills` |

`src/project-status.ts` **未改** —— 它继续用 `discoverSkills`，于是 `projectSkills` 现在名副其实（只数项目作用域）。

### 验证（2.2 重跑）

```
npm run typecheck   -> exit 0
npm test            -> tests 318 / pass 316 / fail 0 / skipped 2
```

（修复前：tests 318 / pass 314 / **fail 2** / skipped 2）

三个作用域的行为验证：

```
discoverSkills(project)  count=1  ["local-only"]
discoverUserSkills()     count=5  ["agent-browser","grill-me","grill-with-docs","paseo","vercel-react-view-transitions"]
discoverAllSkills()      count=6  ["agent-browser","grill-me","grill-with-docs","local-only","paseo","vercel-react-view-transitions"]
```

### 修复后 `probe-skill-discovery.mts` 的输出

```
C: (under user home)   count=1  names=["local-only"]
   root: C:\Users\Macfy\AppData\Local\Temp\dove-probe-ptrLwd
D: (other drive)      count=1  names=["local-only"]
   root: D:\_dove_probe\dove-probe-FnrDsb
```

注意：探针现在两个盘都得到一致结果（修复前是 C: 6 个 vs D: 1 个），因此它同时可作为**回归检查** —— 若哪天两个盘的结果再次不一致，说明有界规则被破坏。

### 过程记录（诚实起见）

第一次尝试是**整体重写** `discovery.ts`，把 `readSkill` 里的正则写坏
（`Invalid regular expression ... Invalid escape`），导致该模块加载失败、连锁 27 个测试报错（fail 29 / tests 256）。
随后 `git checkout` 还原原文件，改为**外科式替换**（保留原正则不动），问题消失。
结论：这类改动应做定点替换而非整体重写。
