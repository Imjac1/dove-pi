# 读数：**命题仍不成立，按计划停下** ✗✓✓（2026-10-05 ✓）

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
