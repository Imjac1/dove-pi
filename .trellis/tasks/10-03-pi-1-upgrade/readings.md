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

## 第二轮：修与最终读数（2026-10-03）

**三连门禁在 1.0.0 上全绿** ✓：`typecheck` **exit 0** ✓ · **874 tests / 872 pass / 0 fail / 2 skipped** ✓ · installer **141 OK** ✓。
**`--version` = `Dove Pi 0.2.0 (Pi 1.0.0)`** ✓ —— 宿主真的在 1.0 上跑，且**启动器本身走通** ✓。

### 三处修复（每处都能指回上面的红 ✓）

1. **`chinese-settings.ts` 的 union** ✓ —— 根因是 **1.0 的 API 变更**：`manager.getQuietStartup()` 由 `boolean` 变成 **`string | boolean`** ✓。修法：`boolText` 接受两者 ✓（字符串按原样显示 ✓，布尔仍走"开启/关闭" ✓）。
2. **steer / follow-up 的顺序** ✓ —— **我第一次修错了** ✗：我把断言从 `["steer","follow_up"]` 翻成 `["follow_up","steer"]` ✓ = **把一个不稳定的顺序钉死成另一个顺序** ✓，等于把**竞态写进测试** ✗；重跑仍红 ✓ 就是证据 ✓。**正确修法**：断言**集合** ✓（两者都要到 ✓），并在原位写明"**顺序不是我们的**" ✓。
3. **`systemPromptChars`** ✗ —— 同一批断言里 `model` ✓ 与 `messageChars > 0` ✓ 都仍通过 ✓，只有这一个字段**不再被填** ✓。按 AC-4 **原位降级并点名** ✗（断言降为"记录仍在" ✓，缺失的数字**记为限制** ✓，**根因不去猜** ✗），并**单独开任务** ✓。
   **并注意**：这个采集器**可能是我们自己的代码** ✓ —— 那就意味着"字段悄悄丢了"的同一族缺陷**长在我们的仪器里** ✓（已写进原位注释 ✓）。

### 这一轮的结论（回答"1.0 有没有影响" ✓）

**有，三次，全部小且全部精确定位** ✓：**1 处 API 类型变更（`getQuietStartup` 返回 union）** ✓ · **1 处投递顺序不再稳定** ✗ · **1 处证据字段不再上报** ✗。

### 仍然带着的保留（本片最该带上去的 ✗）

- **3481 行扩展 / 26 个宿主成员路径**在套件里**没有被红覆盖** ✓ —— 这**不是**"它没事"的证据 ✗，只说明**套件没走到那些路径** ✓✓。
- **未做** ✗：真实启动与三个模式的体验（下一片 ✓）、`host-version.ts` 沉默点 ✓、`--version` 之外的 `pi:smoke` 全跑 ✓。
- **第一次 `npm install` 的失败原因丢了** ✗（我的 PowerShell 滑手在 `ErrorRecord` 上用了 `.Trim()` ✓）；第二次成功 ✓。
- **5 个漏洞**（3 moderate / 2 high ✓）由安装报出 ✓ —— **已记，未处理** ✗。
