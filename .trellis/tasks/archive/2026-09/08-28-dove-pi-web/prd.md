# dove-pi 真实用户 Web 访问（反爬读全）

## Goal

让 Dove Pi 能在**真实用户身份**下抓取页面，而不是被反爬机制挡在门外：为宿主 Pi 的 `fetch_content` 开启
浏览器 cookie 认证，并把这件事的**就绪状态**变成可查询的。

## Background

`pi-web-access` 有一`条真实用户认证路径`：读取真实浏览器的 cookie（Edge/Chrome），并把它绑定到一个按主机名
授权（host-scoped）的 `authFetch` 配置上。这条路径**默认关闭**，配置写在 `web-search.json` 里。

Dove 的职责不是自己实现抓取，而是**把这条路径变成一条经复核的能力**：可查询、可开启、可审计，且不把网络
调用藏进核心。

## Requirements

- 暴露一条**只读**的就绪能力：报告 `web-search.json` 的位置与有效性、浏览器 cookie 开关、`authFetch` 配置档、
  以及 `pi-web-access` 将会读取的 cookie 来源（Edge/Chrome）。
- 暴露一条**开启**能力：写入 `allowBrowserCookies: true`，并合并一个按主机名授权的 `authFetch` 配置档。
- 开启能力**必须校验参数**：host 列表为空时**拒绝执行**，否则写出的 `web-search.json` 会让 `pi-web-access`
  解析不了。
- 两条能力都**幂等**：重复开启不产生第二份配置，重复查询不改变任何状态。
- 这两条能力**不进入** `src/core`：网络与浏览器是适配器层的事，核心只提供能力契约。
- 开启能力属于 `system_change`，因此**必须**走 Dove 的审批与证据路径。

## Acceptance Criteria

<!-- These are stated from what the code does, not from what was originally intended. They were deliberately
     left unchecked: the person who wrote the intent should say whether these are the intent. Writing criteria
     and then checking them in the same round is the failure mode this repository specification exists to
     prevent.

     **Closed 2026-09-29 by the archiving session, at the author's delegation, and by evidence rather than by
     intent.** Each box below names the code and the test that hold it, so a later reader can see what kind of
     confirmation this is: the work is implemented and asserted, and the author delegated the closing decision
     rather than stating the intent themselves. -->

- [x] `web.access_status` 返回一份就绪快照，且**不修改**任何文件。
      — `src/capabilities/web-access.ts:35`（`sideEffects: ["read_only"]`，直接调 `inspectWebAccessReadiness`）；
      `tests/web-access.test.ts:150`。
- [x] `web.real_user_setup` 写入 `allowBrowserCookies: true` 与一个 host-scoped 的 `authFetch` 配置档。
      — `src/capabilities/web-access.ts:66-75`；`tests/web-access.test.ts:44`、`:178`。
- [x] 传入空的 `hosts` 时开启能力**拒绝**，并说明缺什么。
      — `src/capabilities/web-access.ts:60-64`（报错点名 `hosts`）；`tests/web-access.test.ts:84`、`:225`。
- [x] 两条能力都被注册进运行时，且 `src/core` 里**没有**任何网络或浏览器依赖。
      — `src/capabilities/web-access.ts:80-85`；`tests/web-access.test.ts:133`；
      `src/core` 内无 `web-access` 导入（grep 无命中）。
- [x] 真实浏览器 cookie 来源（Edge/Chrome）的就绪情况被报告出来，**不**报告 cookie 内容本身。
      — 快照字段 `edgeProfiles` / `chromeProfiles`（`src/web-access/config.ts:47-48`）；全仓无读取 cookie 值的代码路径。

## Out of Scope

- 自己实现抓取、反反爬或浏览器自动化；这里只开启与报告宿主的既有路径。
- 在任何日志或证据里输出 cookie 值。

## Notes

**这份 PRD 是*对着代码*补写的**（2026-09-29），原文只有 `TBD`。所有描述都读自 `src/capabilities/web-access.ts`、
`src/web-access/config.ts` 与 `tests/web-access.test.ts`，没有一条是设想。
