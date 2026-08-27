# Dove Pi 安装时自动更新插件

## Goal

让 `dove-pi install` 在补齐所选扩展 profile 的同时，自动更新已经配置的 Pi 扩展；首次安装保持快速，不因为没有已安装插件而增加无意义的更新等待。

## User value

- 不需要先手动执行 `pi update --extensions`。
- 已安装的 Pi 扩展会在重新安装 Dove 时进入最新可解析版本。
- 更新失败不会阻塞剩余扩展安装，也不会破坏已有可用配置。
- 需要离线或稳定版本时可以显式跳过更新。

## Confirmed repository facts

- `dove_pi.py install` 已将 `update_extensions` 默认设为 `true`，并把 `--no-extension-updates` 转换为 `extensions install <profile> --no-update`。
- `src/extensions/install.ts` 在 `configuredPackages.length > 0` 时先调用 Pi 官方 `update --extensions`，再按 catalog 顺序安装缺失扩展。
- 更新失败目前会输出 warning 并继续 profile reconciliation；已有测试覆盖成功和失败路径。
- 空白机器没有已配置扩展时不会调用 update，避免新目录增加无意义的网络等待。
- Pi 仍负责扩展版本解析、settings 写入和 package 安装；Dove 不复制 Pi 的包管理器。

## Requirements

R1. `dove-pi install` 和 `dove-pi setup` 默认更新已配置 Pi 扩展，然后补齐目标 profile 中缺失扩展。

R2. 首次安装（没有已配置包）跳过空更新步骤；profile 安装仍使用 Pi 官方命令并解析到最新可用版本。

R3. `--no-extension-updates` 保持有效，跳过更新但不跳过缺失扩展安装；`--no-extensions` 跳过整个第三方扩展阶段。

R4. 更新失败必须显示清晰 warning，并继续安装缺失扩展；只有缺失扩展安装失败才按现有 `continueOnError` 语义处理。

R5. 安装输出应明确显示“更新已配置扩展 / 无已配置扩展跳过 / 用户显式跳过更新”三种状态，不逐包刷屏，除非启用 verbose 调试路径。

R6. 不在安装流程中联网查询 npm latest、执行第二套依赖解析或强制升级 Pi 本体；更新权威是 `pi update --extensions`。

## In scope

- `dove_pi.py` 安装参数、阶段文案和错误摘要。
- `src/extensions/install.ts` 更新阶段的结果结构与输出。
- 相关 TypeScript/Python 安装测试和中英文 README 安装说明。
- 可选的 `dove-pi extensions update` 便捷命令，若实现成本低且复用同一更新函数。

## Out of scope

- 上下文压缩协调、checkpoint、第二套 memory/context engine。
- 自动安装或默认启用 `context-mode`、`pi-memory`、`pi-subagents` 等第三方包。
- 修改 Pi 核心、npm lockfile 或 provider cache 行为。
- 强制更新用户没有配置的插件、自动切换 profile、自动卸载冲突插件。

## Acceptance criteria

AC1. 已有 configured packages 时，`dove-pi install` 调用一次 `pi update --extensions`，再安装缺失 profile entries。

AC2. 没有 configured packages 时，不调用 `pi update --extensions`，直接完成 profile 安装。

AC3. `--no-extension-updates` 不调用 update，但仍安装缺失扩展；`--no-extensions` 不调用扩展安装和更新。

AC4. update 命令失败时返回 `updated=false` 和可读 warning，profile reconciliation 仍继续；安装失败仍按现有可选扩展容错语义处理。

AC5. 默认安装输出只显示阶段级摘要；失败时列出扩展 id、命令和下一步建议。

AC6. `node --import tsx --test tests/extensions.test.ts`、`python -m unittest tests/installer_test.py -v`、`npm run typecheck`、`npm test`、`npm run test:installer`、`npm run pi:smoke` 通过。

## Key decisions

- 更新已配置插件是 `dove-pi install` 的默认行为。
- 首次安装跳过空更新是有意的性能优化，不是漏更新。
- 通过 Pi 官方 `update --extensions` 保持版本和 settings 的单一权威。
- 保留 `--no-extension-updates` 作为离线、回归和锁版本场景的显式开关。
