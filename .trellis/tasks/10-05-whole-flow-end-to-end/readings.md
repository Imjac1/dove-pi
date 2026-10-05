# 读数：**两处缺口的判据都绿了** ✓✓✓（2026-10-05 ✓）

## 判据的原文 ✓✓（扩展自己说的 ✓，不是我推断 ✓）

```
Dove Pi: workspace=development, workMode=code-development, hashlineEditTools=absent, lens=on-next-session, mode=◆ Standard
```

**取自**：`judge.jsonl`（`stepIndex 0` 的 `extension_ui_request`/`notify` ✓✓）—— 一次**只做 `/status`** 的运行 ✓（场景 `tests/fixtures/scenarios/status-line-only.json` ✓），在**已绑定的克隆**上 ✓（`.dove/mode.json` = `{schemaVersion: 1, mode: "code-development"}` ✓，55 B、无 BOM ✓）。

## ① 声明的 mode 加载不了 → **已修** ✓✓✓

**判据** ✓：`workMode=` **从 `failed` ✗ 变成 `code-development`** ✓✓ —— 与 `design.md` 定的判据**逐字一致** ✓✓。

**改法** ✓✓（`src/pi-adapter/extension.ts` ✓，提交 `9921ba3` ✓）：**声明的根优先** ✓，**只有那里没有 `modes/<name>/` 时才回退到扩展自己的根** ✓✓ —— **mode 自己的 grant 文档随胜出的根解析** ✓（这也是为什么必须在**调用点**选、不能在载入器里选 ✓）。

**而第一次改法是错的，被测试当场抓住** ✗✓✓：**替换**根（而不是**回退**）**弄红了 28 条** ✓✓（`905 pass / 28 fail` ✗）—— 因为**宿主测试自己提供根、fixture 的 mode 就在那底下** ✓✓（`action-policy.test.ts:122` `workspaceRoot: files.root` ✓）。**回退改法把它们收了 27 条** ✓（回到 `931 pass / 2 fail` ✓，**余下两条与本次改动无关**：一条数 `agent_project_context` 的索引长度 ✓，一条数规格页的 mount-point 引用 ✓＝**并行窗口自己那条未完的活** ✓）。

## ② 编辑工具缺失不在读数里 → **已修** ✓✓✓

**判据** ✓：状态行里出现了 **`hashlineEditTools=absent`** ✓✓ —— 与工作模式并列 ✓。

**改法** ✓✓（同提交 ✓）：`hashline` 本就在 `/status` 处理函数里算过（`:1159` ✓），**所以不需要任何载体** ✓✓ —— 只把它拼进那条 notify ✓，**理由与工作模式那一行完全相同** ✓（`:1172` 的注释原话：*"a failed load … says so only once … a person who missed the session-start notification had no way to see why nothing ran"* ✓✓）。

**而它报的是 `absent`** ✗✓✓ —— **即：宿主确实没有这套工具，而这现在是*读数*的一部分** ✓✓ → **"模型草率"与"工具不在"从此在读数上可分** ✓✓✓ = **本轮最想要的那一件事** ✓。

## 仍开着的 ✗✓（不粉饰 ✓）

- **AC 里最重的一条仍未证明** ✗✓：**"一条运行里走完整个流程、各步都留痕"** ✓ —— 这次**只跑了 `/status`** ✓；**上一轮跑了活、但在第 1 步就把 15 分钟用光、被 `cancelled`** ✗✓（`provider.request.started 10 / completed 9` ✓）→ **"整条在同一次运行里"仍待证明** ✗✓。
- **`hashlineEditTools=absent` 意味着那个 agent 仍然没有 harness 的编辑工具** ✗✓ —— **AC 的"在场 ✓ 或缺失被记录 ✓"由后半条满足** ✓✓，**而前半条是宿主的事** ✗（`10-05-missing-hashline-edit-tool` ✓）。
- **判据本该被*直接*索取** ✓✓（这一轮的教训 ✓）：**我先前把判据放在一个要等 15 分钟才轮到第 2 步的场景里** ✗✓ → **`/status`-only 这个场景是那条教训的产物** ✓✓，**它会一直有用** ✓。
