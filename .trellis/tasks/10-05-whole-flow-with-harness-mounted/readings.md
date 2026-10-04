# 读数：**命题仍不成立，按计划停下** ✗✓✓（2026-10-05 ✓）

## 🎯 查的结果：**模式可以被声明、也会被读到，但它必然 `missing-file`** ✗✓✓ + **harness 自报编辑工具不在** ✗✓✓✓

**仪器就是扩展自己** ✓✓（`extension.ts:1172` ✓）：它打印 `` `workMode=${activeWorkMode?.id ?? "none"}` `` ✓，拒绝时打印 `` `workMode=failed, modeRefused: …` `` ✓ —— **而答案就在那次运行的 `flow-mode.jsonl` 里** ✓✓（`stepIndex 1` = 我场景的 `/status` 那一步 ✓）：

```
Dove Pi: workspace=development, workMode=failed, modeRefused:
         Work mode 'code-development' could not be loaded: missing-file: mode…
```

→ **声明被读到了** ✓✓✓（名字正是我写的 `code-development` ✓）· **加载被尝试** ✓ · **以 `missing-file` 失败** ✗✓ → **因为 `modes/<name>/` 要落在*运行时能找到的根*下，而运行的 `--cwd` 是*项目*** ✓，**仓自己的 `modes/` 在*仓*里** ✗✓ → **在这个布局下，一个工作模式*不可能*加载成功** ✗✓✓ = **一条*边界*** ✓✓（**该写进边界的记录，不是拿去除错** ✓）。

**而先前那条"`--mode rpc` 是元凶"是错的** ✗✓✓：**CLI 的工作模式开关是 `--workspace-mode=`** ✓（`dove_pi.py:124` ✓），**扩展的覆盖来自环境变量 `DOVE_PI_WORKSPACE_MODE_OVERRIDE`** ✓✓（`extension.ts:694` ✓），**而 runner 的 env 块里根本没有它** ✓✓（`:112-117` ✓）→ **`--mode rpc` 是别的东西，`executionMode` 也是别的字段** ✗✓ —— **我又追错了一个字段** ✗✓（今晚第二次同型 ✓）。

**同一份输出里的第三条，而且最大** ✗✓✓✓：

```
当前 Pi 宿主未提供 hashline 编辑工具（replace<path> Pi 或执行 dove-pi install。
```

→ **harness *自己告诉用户*：它的 hashline 编辑工具不在这个宿主里** ✓✓ → **而读数 #3 里那个 agent 是在*没有*这套编辑工具的情况下干活的** ✗✓✓ → **"改了一个文件、弄坏一条原本通过的用例"因此不再只是"模型草率"** ✗✓✓✓ —— **工具不在场是一个在场的解释** ✓✓，**而我在上一轮把它写成了"一处专注、看着合理的改动"** ✗✓。

## 追加：**AC 的前提本身是错的** ✗✓✓✓（第三次运行后量出 ✓）

**第三次运行** ✓：项目里写了 `.dove/mode.json`（`{schemaVersion: 1, mode: "code-development"}` ✓，**55 B，前三字节 `123,10,32` = 无 BOM** ✓✓ —— 这个仓为一个 BOM 付过代价 ✓）→ 复制到运行副本时**`.dove` ✓ 与 `mode.json` ✓ 都在** ✓✓ → **而 `executionMode` 仍是 `"standard"`，且 `executionModeSource` 是 `"user"`** ✗✓✓。

**元凶量到一行** ✓✓✓（`scripts/real-dove-blackbox.mjs` ✓）：

```js
:101  const launcherArgs = launcher === "source"
:102    ? [resolve(repoRoot, "dove_pi.py"), "--offline", "--mode", "rpc", "--session-dir", sessionDir]
:103    : [...managedLauncherArgs, "--offline", "--mode", "rpc", "--session-dir", sessionDir];
```

→ **每一次运行都传 `--mode rpc`** ✓✓ → 按 `work-mode.ts:903` 的优先级（*"highest first: **an explicit override (a CLI flag)**, the project's declaration"* ✓✓），**它压过项目声明** ✗✓ → **所以 `mode.json` 连被问到都没被问到** ✗✓（不是"读到但被覆盖" ✓）。

**而 `executionMode` 取自 `strategy?.executionMode`** ✓✓（`:495-498` ✓）= **harness 自己的策略记录** ✓ → **所以 `"standard"` 是"工作模式"，被一个*传输*参数覆盖** ✗✓✓ = **本轮真正的发现** ✓✓。

**最关键的一条** ✗✓✓✓：**harness 从来都装上了** ✓✓ —— **两次运行的账本都带着 harness 自己的生命周期记录** ✓✓（`request.received` ✓ `request.planned` ✓ `request.attempt.*` ✓ `request.terminal` ✓ `model.budget.checked` ✓ `task.convergence.observed` ✓✓）；**而 launcher 跑的就是 `dove-pi` 自己** ✓（`:99` ✓）→ **"harness 在不在" ✓ 与 "工作模式选没选上" ✗ 是*两个*问题** ✓✓ —— **而我的 AC 用第二个去判第一个，判错了** ✗✓✓。

**所以本任务的 AC 已失效** ✗✓：它要检的东西**不是它以为的那个东西** ✓ → **下一次该问的是**：*这个运行器里，一个工作模式**能不能**被选上* ✓（若能 ✓ → 那"用户流程"要它 ✓；若不能 ✗ → **那是运行器的边界，应当写成边界** ✗✓）。

## 这一轮要检的两条（**AC 原文** ✓）

| AC 要求 | 读数 |
|---|---|
| 运行副本里有 `.dove/` | **True** ✓ |
| **`executionMode` 不是 `standard`** | **`"standard"`** ✗✓✓ |

→ **两条必须同时成立** ✓✓ —— **第二条没有** ✗✓ → **按 AC 的原话**：*"否则本轮的命题仍不成立，如实记并停下 —— **不继续解释后续数字**"* ✓✓✓。

## 跑了什么 ✓（命令与上一轮相同，**唯一变量是 `.dove/`** ✓）

**前置复验** ✓✓：绑定后的克隆里判分仪器**仍是红的** ✓（`1 failed, 115 passed in 2.24s` ✓）· `.dove` **存在** ✓ → **所以"完成"的定义仍然有效** ✓。

**运行** ✓：`node scripts/real-dove-blackbox.mjs --launcher source --provider real --cwd <已绑定的克隆> --scenario tests/fixtures/scenarios/immutable-directive-work.json --output %TEMP%\…\runs\flow-bound.jsonl --timeout-ms 900000` → `exit 0` ✓ · scenario root `flow-bound.jsonl-single-63b843da45b0` ✓。

**两个关键字段** ✗✓：**`.dove in the RUN's copy: True`** ✓✓ **而 `executionMode: "standard"`** ✗✓✓ · `interactionMode "auto"` ✓ · `activeToolCount 17` ✓ · **`reason "failed"`** ✗✓ · **`settled false`** ✗✓。

## 我先前那条"根因"被这一次推翻 ✗✓✓

**我说**：mode 按**项目**选 ✓，项目没绑定 ⇒ 落到 `standard` ✓。
**这一次**：**项目绑了（副本 `.dove/` 为真 ✓✓），而仍是 `standard`** ✗✓✓ → **所以 mode 由*别的东西*决定** ✗✓ —— **而我还没量它** ✗✓✓ → **故不写、不猜** ✗。

## 按 AC 停下 ✗✓（**未解释的东西，一律不写** ✓）

- **判分**（副本里 `pytest`）**我没跑** ✗ —— 因为 AC 说"命题不成立则停下" ✓✓；
- **账本累计量** 与 **改动范围**：**同为未取** ✗（同上 ✓）；
- **`reason: "failed"`** ✗ 的含义：**未查** ✗（我只把它记下来 ✓）。

## 下一步（**真正的下一步，而不是接着跑** ✓）

**先量"mode 由什么决定"** ✓✓ —— 候选（**都未量** ✗）：`sessionDir` 的某个文件 ✓ · `PI_CODING_AGENT_DIR` 指向的场景目录 ✓ · 扩展在 *source* launcher 下的加载条件 ✓ · 项目里的 `.dove/mode.json` **是否存在** ✗✓（上一轮量到过 `mode.json` 是 *mode 选择*的声明文件 ✓✓ —— **而 `project init` 只生成了 `project.json` 与 `state.json`，没有 `mode.json`** ✗✓✓ → **这是最该先查的一条** ✓✓）。
