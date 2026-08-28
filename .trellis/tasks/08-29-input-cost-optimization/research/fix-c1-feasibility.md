# FIX-C1 可行性验证报告（08-29）

## 结论

**技术上可行，效果需真实交互会话验证（headless 无法复现 40K 悬崖）。**

## 已验证的事实

1. **payload 可变**: `before_provider_request` 事件的 `payload.messages[i].content[j]` 是可修改对象，注入 `cache_control` 后随请求发出，provider（OpenRouter anthropic 兼容端点）**完整接受、无报错**。
2. **注入生效日志实测**: 会话历史 2→4→6→8 条消息时，注入断点数 1→3→5→7（每中途消息一个断点），证明注入逻辑按预期工作。
3. **生产路径原本只有 3 个断点**（实测 payload 结构确认）:
   - system prompt 块: `cache_control={"type":"ephemeral","ttl":"1h"}` ✅
   - 最后一个工具定义 (bg_result): 同上 ✅
   - 最后一条消息: 同上 ✅
   - **所有中途消息: `none`** ← 这就是 40K 悬崖的来源
4. **跨会话缓存共享**: 对照实验中，后跑的 control 会话复用了前一个 injection 会话遗留的热前缀（call 0: in=243, cr=16,128, hit=99%）。说明提供方缓存按内容寻址、会话无关——**进一步坐实"断点结构是唯一限制因素"**。

## 未验证 / 风险

- **headless 会话上下文停在 ~23K，无法复现 40K 悬崖**，因此"中途断点能收回悬崖处的命中"在本次探测中**没有直接数据证明**。
- 唯一相关单点证据: INJ2 会话 call 1（23K 前缀、注入 3 断点）cr=0——不够理想，但它发生在工具结果刚改变前缀的调用（新增内容本来就无法命中同一轮）。
- 中途断点数量: provider 对单个请求的 cache_control 断点数有限制（Anthropic 官方 4 个，beta 8 个）。OpenRouter 中转可能更严——需要真实会话 + 长历史场景实测是否会 400。

## 落地建议

把"中途断点注入"作为 **env 开关（默认关）** 实现：

- `DOVE_PI_INJECT_CACHE_BREAKPOINTS=1` 时，`before_provider_request` 给每条非末位 user/tool_result 消息的首个文本块注入 `cache_control: {type:"ephemeral", ttl:"1h"}`。
- 限制断点总数（如最多 3-4 个，避免超 provider 上限），只给**最大的中间块**注入以最小化风险。
- 用户在自己的真实交互会话里开开关跑一轮，用 `token audit --since` 对比 >40K 调用的命中率。**这是唯一可靠的验证路径。**
- 若真实会话出现 400（断点过多），日志会暴露，届时降级为仅 FIX-C2（阈值定标）。

## 结论

FIX-C1 从"根因修复"降级为"候选修复 + 需真实会话验证"。**FIX-C2（前缀增长定标到 40K 附近）是确定有效、改动最小、立刻能做的缓解**——建议先落地 FIX-C2，FIX-C1 以开关形式附带。
