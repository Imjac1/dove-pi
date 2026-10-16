# Ship 0.2.4 first, so the four fixes are what users have

## Goal

把 master 上那四笔**产品代码**发成 **0.2.4** ✓，并核对**用户实际会拿到什么** ✓ —— 而不是核对我们本地造出了什么 ✓。

**用户价值** ✓：今天装的用户拿到的是 **0.2.1** ✓（2026-10-16 实测：托管安装报 `Dove Pi 0.2.1` ✓），既没有 0.2.2/0.2.3 的修复 ✓，也没有这四笔 ✓。

## Background（全部实测 ✓）

- `v0.2.3..HEAD` = **15 个提交** ✓，其中产品代码是四笔 ✓：`80e4dad`（网络轴可见性 ✓）、`f528375`（provider 读数 ✓）、`d40f9b5`（告警点名声明 ✓）、`6eaffdb`（验证后的三处修正 ✓）。
- **tag 必须等于包版本** ✓ ⇒ 版本号只动 `package.json` 与 `package-lock.json` 的两处 ✓；`modes/*/governance.yaml` 声明的是范围 `>=0.2.0 <0.3.0` ✓；`src/capabilities/code-audit.ts` 带的是**能力自己的**协议版本 ✓，不随包走 ✓。
- **发布作业**：推 `v*` tag → `windows-release` ✓（上一次 0.2.3 是 4m16s ✓ 绿 ✓）。
- **本地重演**：`release:manifest` 产出 `releaseId=<version>+<commit>` ✓ ⇒ 这个 releaseId 就是"这个构建含哪个提交"的**可核对的凭据** ✓。

## Requirements

- **R1** 0.2.4 必须**含那四笔** ✓ —— 判据是它 `release.json` 的 `releaseId` 指向的提交**包含**那四笔 ✓。
- **R2** 门按**发布作业自己的顺序**跑 ✓，不按我顺手安排的顺序 ✓。
- **R3** `release:check` 必须在 **tag 存在之前**通过 ✓ —— 发布是唯一不可回滚的一步 ✓。
- **R4** 最后的判据是**用户那条命令** ✓（`releases/latest/download/install.ps1` ✓），不是本地归档 ✓。
- **R5** 若 CI 因**那条围栏**而红 ✗（`test (locked)` 里 parallel-batch 那条 ✓），**不挪 tag** ✗✓ —— 记录它 ✓，归门那个子任务 ✓；tag 是"推了什么"的记录 ✓，挪它就把 tag 唯一的用途毁掉了 ✓。

## Acceptance Criteria

- [x] **0.2.4 是 Latest** ✓，四产物齐全 ✓（`dove-pi-windows.zip` ✓、`.sha256` ✓、`install.ps1` ✓、`release.json` ✓，非 draft ✓，2026-10-16T11:23:04Z ✓）。
- [x] 它的 `releaseId` 指向的提交**包含**那四笔 ✓ —— 四个 `git merge-base --is-ancestor` 都退 0 ✓；**且发布出来的清单自己这么说** ✓：用户 URL 取到的 `release.json` 报 `commit=25039c99…` ✓，正是 tag 所在提交 ✓，且与本地重演的 `releaseId` 一致 ✓。
- [x] `release:check` 在 tag 之前**通过** ✓（`Release ready: v0.2.4 (0.2.4+25039c9); assets=4` ✓）—— 它**先拒了两次** ✓，两次都对 ✓（见 `findings.md`：一次是我改了版本号没提交 ✓，一次是任务元数据未提交 ✓）。
- [x] 用户 URL 取到的是它 ✓：`install.ps1` **HTTP 200 / 20,623 B** ✓，与树里的同大小 ✓（须显式走代理 ✓ —— `Invoke-WebRequest` 不认环境代理 ✓）。
- [x] 那条围栏**这次没发作** ✓：tag 上与 master 上的 `Compatibility` **都绿** ✓ ⇒ "不挪 tag" 的规则**未被触发** ✓，无需记录例外 ✓。
- [x] `findings.md` 记了 releaseId ✓、两次被 readiness 拒绝的原因 ✓、以及**本子任务没证到的那一条**（祖先关系证的是提交、不是压缩包内容 ✓）。

## Out of Scope

- **改任何产品代码** ✗ —— 本子任务只动两个版本字段 ✓；发现问题就回到父任务 ✓，并可能变成 0.2.5 ✓。
- **回填 0.2.1–0.2.3** ✗ —— 用户装的是 Latest ✓。
- **修那条围栏** ✗ —— 那是 `10-16-trustworthy-gate` ✓；本子任务只在 CI 因此变红时**记录**它 ✓。
