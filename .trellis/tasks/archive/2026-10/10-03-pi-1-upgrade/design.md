# 设计：先升，再让门禁说话，最后才在 Pi 里走一遍

## 边界

**升宿主到 1.0.0** ✓ + **只修真的坏了的地方** ✓ + **让三个已发布模式在 Pi 1.0 里可体验** ✓。
**不做** ✗：不做审计（那是 `10-03-pi-1-recheck` ✓）、不改计划册 ✗、不发 GitHub release ✗、不动 A3/场景两条线 ✓（除非它们被升级弄红 ✓）。

## 为什么是"先升、再看"，而不是"先查 breaking changes"

本会话最贵的一课 ✓：**猜**哪里会坏 ✗ —— 我据错误判断了 8 次 ✓，**每一次都是仪器纠正的** ✓。而这次**拿不到 release notes** ✗（检索端点 `HTTP 401` ✓）。
→ 所以：**升完之后的门禁结果，就是这次唯一的读数** ✓✓。猜不是证据 ✓。

## 升什么（已量 ✓）

| 事实 | 读数 |
|---|---|
| 五个包的最新 | `pi-agent-core` / `pi-coding-agent` / `pi-tui` / `pi-ai` / `pi-telemetry` **全部 1.0.0** ✓ |
| `pi-agent-core@1.0.0` 的引擎要求 | `node >=22.19.0` ✓ —— 与本仓一致 ✓，**不引入新约束** ✓ |
| 1.0.0 的依赖 | `typebox 1.3.27` ✓ · `pi-ai ^1.0.0` ✓ |
| 本仓钉点 | **只有 `package.json`** ✓（`pi-coding-agent` 与 `pi-tui` **精确** ✓、`pi-agent-core` `^` ✓）；`installer/*.py` 里**没有**版本串 ✓（量过 ✓） |
| 本机托管安装 | **不存在** ✓（`%LOCALAPPDATA%\DovePi` = absent ✓）→ **体验只能从本仓跑** ✓，托管那条路径本次不涉及 ✓ |

## 已知影响面（来自本会话的实量，不是预测 ✓）

- **导入宿主的文件：6 个** ✓ —— `adapters/loop-pi-agent-core.ts` ✓ · `extensions/install.ts` ✓ · `pi-adapter/{chinese-settings,extension,host-version,shell-config}.ts` ✓。
- **`Extension` 是最大面** ✓：**3481 行**、触碰 **26 个宿主成员路径** ✓（`pi.on` / `registerCommand` / `registerShortcut` / `getAllTools` / `appendEntry` / `ctx.sessionManager` / `ctx.ui` / `ctx.isProjectTrusted` / `ctx.getContextUsage` / `ctx.thinkingLevel` … ✓）。**它的命令/事件名一变就连不上** ✗ —— 而它**不一定会报警** ✗✓。
- **`AgentLoop` 的 Pi adapter** ✓：7 个符号（值 1 个 ✓）+ 2 个成员路径 ✓；对照实现 `loop-scripted.ts` **零宿主依赖** ✓ → 这一层的反转仍然便宜 ✓。
- **`pi-ai` 同时跨主版本** ✗：adapter 直接依赖它的 `Api` / `Model` ✓ → **与 adapter 那 7 个符号同一条风险** ✓。
- **已知沉默点** ✗：`host-version.ts` 失败时返回 `"unknown"` ✓，不拒绝/不告警/不记录 ✓ → **升级后必须专门看它** ✓（若它变成 unknown ✓，`--version` 会显示出来 ✓，但**别处若依赖它做判定就不会报** ✗）。

## 契约与取舍

- **`package.json` + lock 只升一次，且先单独提交** ✓ —— 这样"红"是**干净读数** ✓，与修复不混 ✓（本会话把"发现与修分开"的同一条理由 ✓）。
- **修不动就降级该点并标注** ✗（例如某个事件名在 1.0 里消失了 ✓ → 该功能记为限制 ✓，不是假装能用 ✗）。
- **若整体修不动** ✗ → **降级回 0.84.3** ✓ 并在原位写明"体验优先，但 1.0 未达成" ✗（**不假装** ✗）。
- **体验判据** ✓：`--version` 必须**真的报 1.0.0** ✓（否则没升上去 ✓）；三个模式各一个回合 ✓，含**一次被拒** ✓。

## 回退

- 升级是一次可 `git revert` 的提交 ✓；修复各自小提交 ✓。
- 每步都能停在"可跑 + 如实标限制"的状态 ✓ —— **没有"必须全绿"的假前提** ✗。
