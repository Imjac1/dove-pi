# FIX A 调研报告：input 侧成本大头定位（08-29 观察轮实证）

## TL;DR（结论反转）

**原 PRD 假设"大工具结果导致 130–230K 单次调用"不成立。** 实测：

- 会话 JSONL 里最大单条工具结果 = **32K 字符**（read/bash，约 8K token），没有 100K+ 的工具结果。
- 真正的 130–230K 单次调用、86–91% 的 input 成本，来自**上游 prompt 缓存的长度悬崖**：单次调用前缀超过 ~40K token 后，缓存命中率从 100% 暴跌到 2-8%。

**为什么 40K 是悬崖**：provider 用 `anthropic-messages` API + `PI_CACHE_RETENTION=long`。pi 在此路径下只设置 **3 个 cache_control 断点**（Anthropic 标准模式）：

1. system prompt 块
2. 最后一个工具定义
3. 最后一条消息块

**断点之间的对话历史（累积的工具结果 + 多轮消息）从不缓存**——每次请求都以原价 input 重算。小调用（<10K）的"命中"其实是**末条消息断点之后的小尾巴**命中；一旦前缀超过断点覆盖范围（~40K），中间的整段历史全部全价。

## 数据（两个项目一致）

### pi-agent 交互会话（245 调用）

| input 范围 | 命中率 | | Desktop/code（1765 调用） | 命中率 |
| --- | --- | --- | --- | --- |
| <5K | 100% | | <10K | 99-100% |
| 10-30K | 33-60% | | 20-40K | 50-60% |
| >40K | **0%**（26/26 MISS） | | >40K | **2-8%** |

- pi-agent：input>40K 且 cacheRead=0 的 26 个调用合计 **458 万**，占总 input **91%**
- Desktop/code：同样口径 **2707 万 / 3150 万 = 86%**
- 所有全 MISS 的 miss reason 分类：29/30 为 `prefix-change`（前缀增长超过缓存覆盖），非 idle/模型切换

## 结论与影响

1. **工具结果截断（原 FIX A）无效**——最大结果才 32K，截断救不了 >40K 的悬崖。
2. **真正的问题**：`anthropic-messages` 路径的 3 断点缓存无法覆盖长会话中途。这是 provider 架构性行为，不是 pi 或 Dove 的 bug。
3. **可行的优化方向**（替换原 FIX A）：
   - **方向 1（最有效）**：给 Dove 的 append-only 上下文消息（epoch 稳定）**增加中间 cache_control 断点**——但 pi 的 `convertMessages` 会重建消息并丢弃存储里的 cache_control，需要确认能否通过扩展钩子注入（`before_provider_request` 可以改 payload）。
   - **方向 2**：**控制前缀增长**——每次 /compact 后前缀回落，把带缓存的"前段"保持在断点覆盖内；当前 260K 软阈值太宽松，需要重新定标（悬崖在 40K，不是 260K）。
   - **方向 3**：换 `openai-completions` API 路径（`prompt_cache_key` + 会话亲和，可缓存整前缀）——需验证 OpenRouter 上游是否支持 deepseek 的 key 化缓存。
   - **方向 4**：减少冗余历史——Dove 的 epoch 稳定 context 消息已做；可考虑工具结果进历史前压缩。

## 需要决策

原 FIX A（截断工具结果）**取消或降级**。任务转向"解决 40K 缓存悬崖"，四个方向里方向 1/3 是根因修复，方向 2 是快速缓解。建议下一步做**方向 1 可行性验证**（扩展能否在 before_provider_request 注入中间 cache_control），不成再评估方向 3。
