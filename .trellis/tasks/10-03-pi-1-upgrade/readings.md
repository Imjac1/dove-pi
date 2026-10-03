# 读数：宿主升到 1.0.0 之后（2026-10-03，本机实测）

**方法** ✓：只改 `package.json` 的三条钉点 → `npm install` → **三连门禁原样跑** ✓ → **这一片不修任何东西** ✗。红就是读数 ✓。

## 实装

五个宿主包**全部 1.0.0** ✓：`pi-agent-core` ✓ · `pi-coding-agent` ✓ · `pi-tui` ✓ · `pi-ai` ✓ · `pi-telemetry` ✓。
（`npm install` 报 `added 46 / removed 44 / changed 63` ✓，并报 **5 个漏洞（3 moderate / 2 high）** ✗ —— 另记 ✓，本片不处理 ✗。）

## 三连门禁

| 门 | 读数 |
|---|---|
| `typecheck` | **1 个错误** ✗ —— `src/pi-adapter/chinese-settings.ts(90,91)`：`Argument of type 'string \| boolean' is not assignable to parameter of type 'boolean'` ✓（exit 2 ✓） |
| `npm test` | **874 tests / 143 suites / 870 pass / 2 fail / 2 skipped** ✗（exit 1 ✓） |
| `test:installer` | **141 OK** ✓（exit 0 ✓ —— 它不碰宿主 ✓） |

## 两条失败（都在 `tests/real-dove-blackbox.test.ts` ✓）

1. **"runs a deterministic provider through the public launcher and records context evidence"** ✗ —— 断言形态：`AssertionError … The expression evaluated to a falsy value` ✓ / `actual: false, expected: true` ✓。**根因尚未定位** ✗（本片不修 ✗）。它落在**真启动器**那条路径上 ✓ —— 正是要体验的那条 ✓。
2. **"injects steer and follow-up through RPC while a tool is running"** ✗✓ —— **顺序变了**：
   `actual: [ 'follow_up', 'steer' ]` ✓ vs `expected: [ 'steer', 'follow_up' ]` ✗。
   → **1.0 改变了 steer / follow-up 的投递顺序** ✓。这是**行为变更** ✓，小 ✓，但**只有黑盒抓得到** ✓✓（单测不会碰到它 ✓）。

## 这次读数回答了那个问题 ✓（"1.0 有没有影响"）

**有，而且小得具体** ✓：**1 处编译期（1 行）+ 2 处运行期（1 条是顺序、1 条待定位）** ✓。
-> **已知影响面里最大的那个（3481 行的扩展、26 个宿主成员路径）没有红** ✓ —— 但**不能据此说它没事** ✗：本片的红只覆盖了**测试跑到的地方** ✓，而扩展的许多宿主路径（命令注册、快捷键、`ctx.*` 判定）在套件里未必有覆盖 ✗✓。**这是本片最该带上去的保留** ✓。

## 保留与未尽

- **第一次 `npm install` 的失败原因丢了** ✗ —— 我的取输出代码在 `ErrorRecord` 上用了 `.Trim()` ✓（PowerShell 滑手 ✓），把它遮住了 ✓；第二次成功 ✓。**这是读数的一部分** ✓，照实记 ✓。
- **未做** ✗：修复（下一片 ✓）、`--version` 是否报 1.0.0（下一片 ✓，`pi:smoke` ✓）、真实启动与三模式 ✓、`host-version.ts` 的沉默点 ✓。
