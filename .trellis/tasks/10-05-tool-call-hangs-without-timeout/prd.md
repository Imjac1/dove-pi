# A tool call can hang forever, and the shell timeout only covers a whitelist

## Goal

**让"一次工具调用挂死"不再只能靠*外层* watchdog 收场** ✓ —— 而更小、更准的目标是：**让读数能区分"挂死"与"慢"** ✗✓✓。

**用户价值** ✓✓：这一夜有**三次 field run 因为挂住而报废** ✗（两次 `cancelled`、一次 `harness-timeout` ✓），**而外部一片寂静** ✗ —— **`stderr` 长度 0** ✓ · **事件流 6 分 33 秒不写一个字** ✓ · **只有 `harness_timeout` 一条** ✓ → **读它的人只能看到"超时"，看不到"卡在哪条命令上"** ✗✓✓。**而这一轮的全部主题就是：读数的缺失会让后面的读数出错** ✓✓（前两条读数就是这么错的 ✓）。

## Background

**完整的实测序列、两处记录的时间戳、源码行号、以及"没量到的不写成已知"** ✓✓ —— 全在 **`readings.md`**（本任务目录内 ✓），此处不重复 ✓。要点三条：

- **挂死** ✗✓：`19:08:37.113` 一条 `bash` 开始 ✓ → **之后 6 分 33 秒两处记录都不写** ✓ → `19:15:10.744` 只有 `harness_timeout` ✓；`sawAgentEnd false` ✓ · `stderr` 长度 **0** ✓。
- **那条 240s 只覆盖*白名单*** ✗✓✓（`src/pi-adapter/extension.ts` 的 `applyAdaptiveShellTimeout` ✓）：`:228` 的正则只认 `go test` / `npm test` / `pnpm test` / `yarn test` / **`pytest`** / `cargo test` / `dotnet test` / `make test` / `make check` ✓✓；**`pytest` 在名单里** ⇒ **所以那次运行里有 4 条"已设 240s"的通知** ✓✓；**挂死的那条不在名单里 ⇒ 没有超时** ✗✓✓。
- **而它的注释早已把这个现象写下来了** ✓✓✓：*"**Pi's bash tool intentionally has no default timeout** … a package-wide test command can therefore **sit behind a Git-Bash pipe** … **This is an escape hatch, not a global tool limit: ordinary commands are untouched**"* ✓✓ —— **今晚量到的与它一字不差** ✓。

## Requirements

- **R1 读数必须能区分"挂死"与"慢"** ✗✓✓：**一条正在跑的调用，在读数里要看得见** ✓（今天只有"开始" ✓ 和**六分钟后的** `harness_timeout` ✗ ✓）。
- **R2 一条不在名单里的长命令不得*毫无*保护** ✗✓✓：今天**完全没有**超时 ✓（名单是白名单 ✓）。
- **R3 不推翻既有的取舍** ✓✓：那段的注释明确选了*"普通命令不碰"* ✓ —— **若改行为，必须连那条理由一起改** ✓（**改注释不是改行为的替代品** ✗✓）。
- **R4 判据可复现** ✓✓：**用今晚这条序列即可** ✓（挂住 6 分 33 秒 ✓、`stderr` 0 ✓、只有 `harness_timeout` ✓）—— **不需要再跑一次真 provider** ✓。

## Acceptance Criteria

- [ ] **一条挂住的调用在读数里留下痕迹** ✓：不必等到 watchdog ✓ —— **可见的判据**：事件流里出现"仍在执行"的记录 ✓，或读数里有一行说某条调用至今未返回 ✓。
- [ ] **一条不在名单里的长命令要么有超时、要么其"无超时"是*被声明*的** ✗✓✓（**今天是隐式的** ✗）。
- [ ] **若改了行为**：**既有取舍（普通命令不碰）的理由在改动里被一并处理** ✓，且 `applyAdaptiveShellTimeout` 的既有测试仍绿 ✓。
- [ ] `readings.md` 里标为"推断"的那一条（**挂死的很可能是起服务器/带网络的命令** ✗）**在被下一个人采信之前必须被量到** ✓✓。

## Out of Scope

**修 Git-Bash 的 stdio 行为** ✗ · **改 Pi 宿主的 watchdog** ✗（不在本仓 ✓）· **那个 `summary` 的资源块** ✗（另有 `10-05-divergent-records-unreconciled` ✓）· **`cachecontrol` 那个 `immutable` 活本身** ✗（它是判分仪器 ✓）。

## Open Decision（**留给接下这个任务的人，不在这里定** ✗）

**三条路，各有代价** ✓✓：① **扩大名单** ✓（便宜 ✓ 但下一条不在名单里的命令照旧 ✗）· ② **把超时设为默认、名单只用于*缩短*** ✓（保护一切 ✓ 但**改变了那条注释明确选择不碰的行为** ✗✓）· ③ **只记不治** ✓✓（**让读数说出一条调用仍未返回** ✓ —— **唯一一个"是读数而不是行为"的选项** ✓，**而本轮的主题正是读数缺失** ✓✓）。
