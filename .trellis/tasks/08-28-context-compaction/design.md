# 技术设计：安装阶段的 Pi 扩展更新

## 1. 现有链路

```text
dove-pi install
  └─ dove_pi.py install(update_extensions=true)
      └─ src/cli.ts extensions install <profile>
          └─ installExtensionProfile()
              ├─ 读取 Pi settings 中已配置 packages
              ├─ 有已配置包：pi update --extensions
              └─ 按 profile 顺序 pi install 缺失包
```

这条链路已经满足主要功能。本任务只做可靠性、输出和测试收敛，不引入新的包管理器。

## 2. 更新语义

`installExtensionProfile` 返回：

```ts
type ExtensionInstallResult = {
  profile: ExtensionProfile;
  updated: boolean;
  updateError?: string;
  installed: string[];
  skipped: string[];
  failed: ExtensionInstallFailure[];
};
```

- `updated=true`：Pi 的 `update --extensions` 成功完成。
- `updated=false` 且无 `updateError`：没有 configured packages，或用户传入 `--no-update`。
- `updated=false` 且有 `updateError`：更新失败，但仍继续安装缺失 profile entries。

不把“没有已配置包”显示成失败，也不把 update failure 伪装成成功。

## 3. 性能与体验

- 首次安装不调用空 update，避免新目录出现额外网络等待。
- 更新和安装阶段只输出阶段摘要；逐扩展输出由 `verbose` 控制。
- 不在启动 Pi 前执行额外 npm registry 查询；Pi 自己决定解析和缓存。
- `--no-extension-updates` 只关闭更新，不影响 profile 补齐，便于离线恢复。

## 4. 失败处理

- update 失败：记录 `updateError`，输出 warning，继续 reconciliation。
- 单个可选扩展安装失败：保留现有 `continueOnError` 行为并汇总到 `failed`。
- `continueOnError=false`：首个安装失败立即抛错；不改变 update failure 的 fail-open 语义。
- 不删除现有插件、不回滚用户 settings、不杀进程。

## 5. 文档与兼容性

- README 说明默认更新、首次安装跳过空更新、`--no-extension-updates` 和 `--no-extensions` 的区别。
- 仍兼容 `--profile`/`--extensions`、`setup`、旧的 `--skip-checks` 别名。
- 不修改 Pi 版本、不修改 lockfile、不要求用户安装 Trellis CLI。

## 6. 后续可选项

若当前实现和测试已足够稳定，可增加 `dove-pi extensions update`，但它必须复用同一 `pi update --extensions` 函数，不复制安装逻辑，也不作为本次 MVP 的阻塞项。
