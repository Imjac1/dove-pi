# 技术设计：Dove 请求与项目流程加固

## 1. 总体结构

```text
user prompt
  -> RequestPlan（唯一意图/权限来源）
  -> tool profile + bootstrap gate
  -> provider request middleware
  -> ProjectProvider public context
       -> continuation projection（Dove Core）
  -> model/tool loop
       -> advisory ProgressGuard signal
  -> provider ledger + cache audit
```

Trellis adapter 只负责把 Trellis 的公开信息映射为 `ProjectContext`。后续判定全部使用 provider-neutral 数据；Core 和 Pi adapter 不认识 Trellis 私有路径。

## 2. 动作极性与 RequestPlan

不继续扩展跨整段文本的贪婪正则。先按标点和连接词拆分 clause，再对每个 clause 提取动作、极性和范围。最终 reducer 按权限上界合并：肯定 mutation/execution > project-work > lookup > chat；被否定的动作不贡献权限。独立后句的肯定执行动作不会被前句否定词吞掉。

`createRequestPlan()` 输出 intent、authority 和 capability tier。`tool-profile.ts`、bootstrap gate 和 middleware 只消费结果，不再重复解释 prompt。必要的明确 bootstrap 意图作为 planner 结果字段或共享 helper 输出。

## 3. Continuation projection

在 Core/ProjectProvider 公共层新增纯函数，形状示意：

```typescript
type ProjectContinuation =
  | { kind: "current"; task: ProjectTaskSummary; nextStep?: string }
  | { kind: "single_candidate"; task: ProjectTaskSummary; nextStep?: string }
  | { kind: "ambiguous"; candidates: readonly ProjectTaskSummary[] }
  | { kind: "none" };
```

候选过滤只使用公共状态和现有 normalized task fields。排序必须确定性；若不能确定唯一候选就返回 `ambiguous`，绝不猜测 current pointer。`agent_project_status` 和 `agent_project_context` 调用同一个函数。

workflow guidance 告诉模型一次读取结构化状态并按 projection 回答；`ambiguous` 时列出候选让用户选择，`none` 时说明没有可续接任务。不得进行路径考古。

## 4. Bootstrap 与 ProgressGuard

`shouldOfferProjectBootstrap` 改为接收 RequestPlan/明确 bootstrap signal，而不是扫描“项目”等宽泛词。Lookup 即使包含“项目”也不弹窗。

ProgressGuard 保留 UI 提醒，同时把紧凑 warning 附加到触发它的 tool result。warning 包含失败类型、重复次数和改变策略建议，不包含整段历史。可增加请求级总错误或连续无状态进展阈值，但只发 advisory signal，不调用 abort。

## 5. 状态目录

建立共享 `resolveDoveStateDir(cwd, env, home)`：环境变量优先；否则使用用户级 Dove/Pi 状态根目录；再对规范化 workspace real path 计算短稳定 hash 形成隔离目录。

CLI、Pi adapter 和 ledger composition root 统一调用 resolver。旧 `<workspace>/.agent-data` 只在新路径没有对应状态时兼容读取或安全迁移；不自动删除旧目录、不双写。workspace snapshot 能力的存储语义单独审查，避免把能力 artifact 与常驻运行状态混为一谈。

## 6. Provider ledger 与 cache audit

最终 `before_provider_request` payload 已包含真实 `tools`，因此在那里计算实际 tool count、`Buffer.byteLength(JSON.stringify(tools), "utf8")` 与 `cachePolicyVersion = 2`。只记录计数和字节数，不记录 schema 内容。

v2 append-only custom context snapshot 的 details 同时写显式版本。`cache audit` 先读字段，字段缺失时才对历史格式做保守兼容推断；epoch 被视为 opaque string，不用冒号段数识别版本。

## 7. Pi 启动选项

launcher 只设置 Pi 已支持的开关：跳过版本检查映射 `PI_SKIP_VERSION_CHECK=1`；完全离线映射 `PI_OFFLINE=1` 或官方 `--offline`。默认路径不设置两者，且帮助必须明确区分。

## 8. 兼容性与失败策略

| 情况 | 行为 |
|---|---|
| Trellis 未安装/未初始化 | provider 返回 unavailable/empty；Dove 正常 Chat/Lookup |
| Trellis 更新了内部目录 | 无影响；Dove 不读取私有路径 |
| provider 返回多个进行中任务 | `ambiguous`，不自动选择 |
| 旧 `.agent-data` 存在 | 兼容读取/迁移；不删除、不持续双写 |
| ledger 新字段缺失 | audit 使用 legacy fallback 并标注推断 |
| progress warning 触发 | 模型和 UI 可见；不硬 abort |
| Pi 网络检查慢 | 用户可显式选择 skip/offline；默认行为不变 |

## 9. 测试策略

- `request-plan`：中英文动作、否定范围、只读、后置肯定执行、自然语言 continue。
- `tool-profile`/Pi middleware：真实提示词对应 provider-visible tools 与 schema 体积。
- ProjectProvider：四种 continuation 结果、稳定排序、无私有路径读取。
- Bootstrap：Chat/Lookup 无弹窗，明确初始化与 Project Work/Execution 才允许。
- ProgressGuard：warning 注入 tool result、紧凑且 advisory。
- State resolver：env override、workspace hash、Windows path normalization、legacy compatibility、无 repo 污染。
- Ledger/audit：实际 tool count/schema bytes、显式 v2、带冒号 epoch、legacy fallback。
- Launcher/installer：默认在线、skip version check、offline、帮助和参数转发。
- E2E：使用原 8 条提示词做同条件前后对比，记录请求数、工具数、prompt token、cache hit 与错误路径。

## 10. 变更范围

仅修改 Dove 自有的 `src/core/**`、`src/project-provider/**`、`src/pi-adapter/**`、cache/managed install、`dove_pi.py`、对应 tests、README 和 Dove runtime spec。任何需要修改 Trellis 上游才能成立的方案都视为设计失败，回到 Provider Firewall 重新设计。
