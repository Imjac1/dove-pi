# Implement — 实验 0 与两处引用修正

**本任务的"实施"只有两件**：跑实验 0（决定 Plane B 成不成立），以及修两处被调研查出的引用缺陷。**两者都不改产品行为。**

---

## A. 实验 0 —— Plane B 的强制力到底存不存在

### A.0 为什么它必须先跑

`design.md` §3 的整个 Plane B 只靠一条未验证的行为：**本机的 `workspace-write` 是否会阻止对 workspace 之外的写入**。DSH 那路调研明确记录它**没测**这一条（原文：*"I did not attempt a denied write to verify either the assertion or its enforcement boundary"*），而当前会话是 `danger-full-access`。**在它定论之前，Plane B 只是一个设计。**

### A.1 前置：需要由**人**起一个 `workspace-write` 会话

策略是**会话级**的，从会话内部改不了自己。配置在仓库之外：

```text
C:\Users\Macfy\.dsh\profiles\desktop\cordis.patch.yml
```

第 13–26 行现在是：

```yaml
- id: permission
  name: "@deepseek-ai/dsh-permission-presets"
  config:
    presets:
      read-only:        { sandbox: read-only,        approval: ask }
      workspace-write:  { sandbox: workspace-write,  approval: ask }
      danger-full-access: { sandbox: danger-full-access, approval: never }
    defaultPreset: danger-full-access
```

**改动只有一行**（第 26 行）：

```diff
-    defaultPreset: danger-full-access
+    defaultPreset: workspace-write
```

然后**重启会话**。

**注意 `approval: ask`**：`workspace-write` 预设带的是 `ask` 而不是 `never`。所以越界写有**两种可能的形态**——被沙箱直接拒绝，或被升级成一次审批请求。判据因此按"两种都算通过、静默通过才算失败"来写（A.3）。

### A.2 三个探针（都在重启后的会话里跑，按顺序）

**探针 1 — workspace 之外（必须是"不静默通过"）**

```powershell
Set-Content -LiteralPath "C:\Users\Macfy\Desktop\dsh\probe-outside.txt" -Value probe
Test-Path "C:\Users\Macfy\Desktop\dsh\probe-outside.txt"
```

目标选的是**仓库的上一级目录**，不是 `$env:TEMP`——因为 Codex/DSH 这一类实现常把临时目录算进允许写集合，用 temp 会把结论弄脏。

**探针 2 — workspace 之内（必须静默成功）**

```powershell
Set-Content -LiteralPath ".\probe-inside.txt" -Value probe
Test-Path ".\probe-inside.txt"
Remove-Item ".\probe-inside.txt" -Force
```

**探针 3 — 被拒之后循环是否还活着**

在被拒/被中止之后**继续完成一个回合**（例如读一个文件并回答）。拒绝不得把会话打死。

### A.3 判据（三条，全过才算通过）

| # | 判据 | 读法 |
|---|---|---|
| **C1** | workspace 之外的写**不是静默生效**——要么被拒绝（文件不存在），要么升级为审批且**未获批准前文件不存在** | `Test-Path` 返回 `False` 且命令返回拒绝/审批 | 
| **C2** | workspace 之内的写**静默成功**（不需要审批、不报错），且**删得掉** | `Test-Path` 返回 `True` 两次 | 
| **C3** | 越界被拒之后，会话**仍能完成一个回合** | 后续工具调用正常返回 | 

**判 C1 的一个陷阱**：如果审批窗弹出而我"等不到人"，那**不是失败**——那是 `approval: ask` 的正常形态。只有"没人批准但文件还是出现了"才算失败。

### A.4 若实验 0 失败（两种失败，退路不同）

| 失败形态 | 含义 | 退路 |
|---|---|---|
| C1 失败（越界写静默生效） | 本机没有可用的越界强制；Plane B 只能靠纪律，不能靠机制 | 退回现裁决：**人以纪律充当不动点**，RSI 降级为有界自我改进。**这是有效结论，照记** |
| C2 或 C3 失败（`workspace-write` 连仓库内都写不了 / 把回合打死） | 策略在本机不可用，不是安全而是坏掉 | 记录读数；Plane B 需要另一条强制路径（例如 ACL 层单独设） |

### A.5 记录什么

`implement.md` 里追加一段读数，含：探针命令、每条命令的原始输出（或明确写"审批窗出现且未批准"）、C1/C2/C3 的判定、以及**用的是哪种形态**（拒绝 vs 审批）。读数不可复现，但要可追溯。

### A.6 回退

```powershell
# 把第 26 行改回
defaultPreset: danger-full-access
```

并删除 `probe-outside.txt`（若它奇迹般存在）。**实验 0 本身不产生仓库内改动**，所以工作树应当保持干净。

---

## B. 两处引用修正（有界、零行为变化）

调研查出仓库里有两处**引用失真**。都不改行为，但都在"可被引用的证据"这条线上，所以值得修。

### B.1 `invocation-disposition.ts` 的 `replaySafe` 注释（**我上一轮引入的**）

现状说 `replaySafe` "named after what `pi-agent-core` calls it (`HarnessTool.replay: "never" | "safe"`)"。
实测（vendored 0.84.3）：`HarnessTool.replay` 只在 **stub** 的 `harness/agent-harness.d.ts:312-314` 里**被声明**；`harness/agent-harness.js` 全文无 `replay` 字符串；两个包都没有 `replaySafe`。

**改法**：把"pi-agent-core 这么叫"改为"**在 pi-agent-core 的 stub harness 里被声明**"，并写明那个 harness 尚不可用（每个方法抛 `HarnessNotImplemented`）。**2 行，零行为变化。**

### B.2 `harness-surface.yaml:4` 的 AHE 节号

现状把"文件级表示"那句归给 **AHE §3.3**。调研核对原文（v4）：该句**逐字出自摘要的 pillar ❶**（§1 复述），其机制在 **§3.1**；§3.3 是可控性 + manifest。
另：项目写成 *"requires that …"*，而**论文从未用 "requires"**——那是项目对该设计的转述。

**改法**：节号改为 `abstract ❶ / §1`（并注明七组件在 §3.1），并把 "requires" 标为转述而非引文。同行还有 `src/core/task-convergence.ts:842` 同错，一并改。

### B.3 与之相关的既有事实（**不改**，只记录）

`.trellis/tasks/archive/2026-09/09-28-preserve-behaviours/design.md:31` 用引号引了 Self-Harness 里**并不存在**的一句（真实原文是 *"records of passing behaviors that should be preserved"*，且在**提议者上下文**里，不是失败记录字段）。
**已归档工件不改写**——改归档等于篡改当时的记录。这里只登记这个事实。

---

## C. 验证命令

```powershell
npm run typecheck
npm test
```

基线：`816 tests / 814 pass / 0 fail / 2 skipped`。B 段是注释与一个节号字符串，**通过数不得变化**；若变化，说明改到了行为，回退。

---

## D. 风险与回滚点

| 改动 | 风险 | 回滚 |
|---|---|---|
| `cordis.patch.yml` 的 `defaultPreset` | **会话行为改变**（审批窗会开始弹出） | 改回 `danger-full-access` |
| 探针 1 的越界写 | 若策略不生效，会在仓库外**真的创建一个文件** | 删掉它；这是实验的预期最坏情况 |
| `invocation-disposition.ts` 注释 | 无（注释） | 恢复原文 |
| `harness-surface.yaml` 节号 + `task-convergence.ts:842` | 无（字符串） | 恢复原文；`tests/harness-surface.test.ts` 会看住它 |

## E. `task.py start` 之前的自检

- [ ] 实验 0 在一个**真的** `workspace-write` 会话里跑过，读数已记。
- [ ] C1/C2/C3 三条**逐条**判定，且写明是"拒绝"还是"审批"形态。
- [ ] B.1/B.2 的改动各自零行为变化，`npm test` 通过数不变。
- [ ] 实验 0 的外溢文件已删除，工作树干净。
- [ ] **不改**已归档工件（B.3）。
