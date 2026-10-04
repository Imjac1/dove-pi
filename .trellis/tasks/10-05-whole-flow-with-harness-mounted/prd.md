# A user's whole flow, with the harness actually mounted

## Goal

**让"一个用户走完整个流程"这句话成立** ✓ —— 而上一轮**它在实测下不成立** ✗✓✓。

**用户价值** ✓：上一轮的读数在"**真模型在真项目上干活**"这一点上有效 ✓✓，在"**这个 harness 走用户流程**"这一点上**一句都不成立** ✗✓ —— **harness 的那一半从未被测到** ✓。本轮把**只有一个变量**的对照跑出来：**同一项目、同一场景、同一任务，差别只有"harness 装没装"** ✓✓。

## Background（**全部实测** ✓）

- **上一轮的实测结论** ✗✓✓（在归档读数的最前面 ✓）：两次运行的**项目副本都没有 `.dove/`** ✓ · 其 summary 记 **`executionMode: "standard"`** ✓ · 37 行会话记录里 `Dove mode`/`Effect refused`/`action-policy` **零命中** ✓ → **那是一个裸 Pi 会话** ✓。
- **根因已量到** ✓✓（`scripts/real-dove-blackbox.mjs` ✓）：**`--launcher source` 跑的就是 `dove-pi` 自己** ✓（`:99` ✓），**扩展由 launcher 加载** ✓（`:104` 注释原话：*"Keep the Dove extension under test **owned by the launcher**"* ✓），**runner 只额外推 faux 的扩展** ✓（`:107-108` ✓）→ **所以"没挂上 harness"不是缺 `--extension`** ✗✓✓，**而是 mode 按*项目*选** ✓ —— **项目没绑定 ⇒ 落到 `standard`** ✓✓。
- **修正已就位** ✓✓：克隆现在**已绑定**（`.dove/project.json` 145 B ✓ `.dove/state.json` 57 B ✓，由 `dove-pi project init` + `bind native` 生成 ✓，`doctor` 报 `ready true` ✓ `taskLifecycle true` ✓）。**同一场景**（`immutable-directive-work.json` ✓）与**同一判分仪器**（`tests/test_immutable.py` **红** ✓✓）都在 ✓。
- **规格的边界** ✓✓：§5 —— **field run 不覆盖"活做得对不对"** ✗✓ → **判分一律在项目自己的套件里** ✓；§3 —— **可比的是形状，不是数值** ✓。

## Requirements

- **R1 唯一的变量是 harness** ✓✓：同项目 ✓ 同场景 ✓ 同任务 ✓；**唯一的差别是 `.dove/` 在不在** ✓。
- **R2 先证明 harness 真被挂上** ✓✓：跑之前或跑之后**必量两处** —— **运行副本里 `.dove/` 是否存在** ✓ 与 **summary 里的 `executionMode`** ✓；**若仍为 `standard`，本次读数不得声称测到了 harness** ✗✓。
- **R3 判分在项目自己的套件里** ✓✓（§5 ✓）：在**运行器那份副本**里跑 `pytest` ✓，与**基线 115 passed / 1 failed** 对照 ✓。
- **R4 累计量取自账本事件流** ✓✓（上一轮已量：summary 的资源块抄**单条记录** ✗✓）→ **数 `provider.request.*` 与 `tool.observed`** ✓。
- **R5 不靠退出码判断成败** ✓✓（上一轮已量：同一命令三种调用给 **-1 / 1 / 0** ✗✓✓）→ **读结构化输出** ✓。
- **R6 改动范围逐文件比对** ✓✓（上一轮：**恰好一个文件 +565 B** ✓）—— 并用**正确写法的 PowerShell** ✗✓（`if` 不是表达式 ✓）。

## Acceptance Criteria

- [ ] **一条**运行里：**副本有 `.dove/`** ✓ **且** `executionMode` **不是 `standard`** ✓✓（**否则本轮的命题仍不成立** ✗，如实记 ✓）。
- [ ] 判分在**副本**里跑出结果 ✓，并与基线（**115 / 1 failed** ✓）并列 ✓。
- [ ] 账本事件流的**累计量**与上一轮并列成**形状对照** ✓（§3：**形状可比、数值不可比** ✓）。
- [ ] **改动范围**逐文件列出 ✓（不是只凭 mtime ✓）。
- [ ] 若 R2 失败 ✗：**先写下"harness 未挂上"的读数并停下** ✓，**不继续解释后续数字** ✗✓。

## Out of Scope

**改运行器或扩展** ✗（本轮是**测量** ✓，不是修 ✓）· **修 `summary` 的资源块** ✗（已另有任务 `10-05-divergent-records-unreconciled` ✓）· **`uv`** ✗（另一条路才需要 ✓）· **流程其余步骤** ✓ 已在上一轮跑过（`init`/`bind`/`doctor`/`task create/verify/convergence/archive` ✓），本轮**只需它们存在** ✓。
