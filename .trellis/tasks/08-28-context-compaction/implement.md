# 实施计划：Dove Pi 安装时自动更新插件

## 步骤

1. [x] 确认当前 `dove_pi.py`、`src/cli.ts`、`src/extensions/install.ts` 的默认值和参数转发。
2. [x] 补齐阶段级输出，让用户能看出 update 成功、首次安装跳过或显式跳过。
3. [x] 检查并补充 update/安装失败结果的稳定结构和错误摘要。
4. [x] 增加或调整 TypeScript/Python 测试：已有包更新、空安装跳过、显式跳过、更新失败继续、缺失包失败。
5. [x] 更新中英文 README 的安装选项说明；不再描述尚未实现的上下文压缩/插件治理功能。
6. [x] 运行全量验证并检查首次安装耗时路径没有新增联网步骤。

## 验证命令

```text
node --import tsx --test tests/extensions.test.ts
python -m unittest tests/installer_test.py -v
npm run typecheck
npm test
npm run test:installer
npm run pi:smoke
```

## 风险与回滚

| 风险 | 处理 |
|---|---|
| Pi update 网络失败 | fail-open，继续 profile reconciliation，并在结果中保留错误 |
| 新目录安装变慢 | 保持 `configuredPackages.length === 0` 时跳过 update |
| 用户需要离线/锁版本 | 保留 `--no-extension-updates` |
| 输出过于嘈杂 | 默认阶段摘要，verbose 才逐包输出 |
| 现有逻辑已经满足需求 | 只补测试/文档，不做无意义重构 |

## 开始实施前 review gate

- [x] 只保留插件更新范围，删除上下文压缩和第三方 context engine 的实现计划。
- [x] 用户确认按此最小方案实施后，再运行 `task.py start`。
