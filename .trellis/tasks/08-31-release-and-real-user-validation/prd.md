# 发布并验证当前版本

## Goal

让用户通过全局入口拿到与仓库最新提交一致的可运行版本，并用真实模型完成一次可量化的用户流程回归。发布前必须先修正 token audit 的 CLI 参数兼容性，避免发布后继续产生错误统计。

## Background and Confirmed Facts

- 当前仓库 `HEAD` 与 `origin/master` 一致，最新提交为 `f8a021c`。
- 远端最新版本标签仍为 `v0.1.2`，其提交落后于当前 `master`；发布工作流按版本标签构建 Windows release assets。
- 本机全局托管安装仍运行旧构建 `0.1.2+source.850feed99747`，与当前源码关键文件不一致。
- `src/cli.ts` 的 token audit 参数解析存在兼容性缺陷：`--since 24h` 可正确过滤，而 `--since=24h` 会被静默当作无时间窗口。
- 当前源码层的 planning、project mutation、token aggregation 和 Pi adapter 回归测试已通过；本任务验证发布资产和全局入口，不重复重做既有状态机设计。
- 已完成一次当前源码入口的真实模型回放：普通聊天、只读检查、修改并运行测试均成功，隔离 session 共使用 49,940 prompt tokens，缓存读取 35,584 tokens。

## Requirements

### R1. 修复 CLI 统计参数

- `token audit` 必须同时支持 `--since=24h` 与 `--since 24h`。
- 两种写法必须进入同一解析路径，并在缺少值、非法值或负数时给出明确错误，不得静默退化为全量统计。
- 增加 CLI 层回归测试，覆盖带 `h` 和不带 `h` 的值、两种参数形式及非法输入。

### R2. 完成可重现发布

- 失败的 `v0.1.3` 标签保持不变；修复后更新版本号为下一个补丁版本 `0.1.4`，保持 Pi、Trellis 和扩展锁定版本不变。
- 生成并验证 `release.json`、Windows archive、checksum、bootstrap 和资产清单。
- 发布资产中的 commit 必须等于待发布的 `HEAD`，安装包内源码和 manifest 必须一致。
- 不修改其他活动任务目录，不把临时测试文件或本地 session 写入仓库。

### R3. 更新并验证全局入口

- 发布完成后通过托管更新流程安装新版本，不直接覆盖 managed install 目录。
- `dove-pi doctor` 必须显示 managed install healthy，当前 release commit 必须与发布 commit 一致。
- 全局入口的 `dove-pi token audit --since=24h` 与空格形式输出必须一致。

### R4. 真实用户流程回归

使用全局入口、隔离 session 和临时项目执行：

- 普通聊天：不调用工具并正常结束。
- 只读检查：不修改文件、不运行命令，能够给出结论。
- 修复任务：能读取问题、修改目标文件、运行测试并汇报结果。
- 连续请求不出现重复提问、无限工具循环或无最终答案。
- 记录每轮耗时、模型请求数、工具调用数、input、cacheRead、output、reasoning、stop reason 和最终测试结果。

## Acceptance Criteria

- [ ] `--since=24h` 与 `--since 24h` 的 CLI 结果完全一致；非法参数非零退出并说明原因。
- [ ] `npm run typecheck`、`npm test`、`npm run test:installer`、`npm run doctor`、`npm run pi:smoke` 和 `git diff --check` 全部通过。
- [ ] `v0.1.4` release manifest、archive、checksum、bootstrap 和资产清单通过 release readiness 检查。
- [ ] GitHub Release 的 commit、manifest commit、archive 内 commit 三者一致，并包含最新源码修复。
- [ ] 更新后的全局 `dove-pi` 运行新 release；doctor healthy，且版本不再指向 `0.1.2+source.850feed99747`。
- [ ] 全局入口 token audit 的明细与合计一致，reasoning 不再出现明细非零但合计为零。
- [ ] 全局真实用户回归四类场景均成功；只读场景工具调用中没有 mutation 工具，修复场景测试通过。
- [ ] 回归报告包含可复核的 token、缓存、耗时和工具调用数据，并标注任何环境限制。

## Out of Scope

- 不重做 prompt-cache 算法、请求状态机或 Trellis mutation 协议。
- 不修改其他活动任务及其未识别元数据。
- 不把旧版历史 session 重新写入或迁移。
- 不把缓存命中率作为唯一成功标准；真实流程正确完成优先于单纯提高命中率。

## Key Decisions

- 最初采用补丁版本 `0.1.3`；该标签的 CI 已失败且保持不可变。测试隔离修复改由 `v0.1.4` 发布，不改写远端历史。
- 发布使用现有 GitHub Actions 标签工作流和 managed installer；不手工复制文件到托管目录。
- 真实回归使用隔离 session/project，允许消耗真实模型 token，但不触碰真实项目任务和主仓库工作区。

## Risks and Deferred Items

- 当前 provider 凭据由本机 Pi 配置提供；若凭据失效，真实模型回归只能记录为环境阻塞，不能用 fake host 冒充通过。
- `atomicMutations=false` 仍是 Trellis 能力限制，本任务只验证现有 unknown/recovery 行为，不承诺原子事务。
- `--offline --version` 仍可能由 Pi 接管；本任务记录该兼容行为，但不把它作为 `0.1.4` 的发布阻断项，除非发布回归证明会影响普通启动。

## Open Questions

无。任务范围、版本策略、发布入口、隔离方式和验收口径已确定。
