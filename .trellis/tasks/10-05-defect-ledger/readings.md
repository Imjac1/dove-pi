# 读数：缺陷台账（2026-10-05）

## 分诊判据（两条，都可查）

**判据一 · 这个缺陷还在不在**（可静态查的查代码）：

| task | 读数 | 处置 |
|---|---|---|
| `10-03-dead-enforceable-constant` | `ENFORCEABLE_SANDBOX` 已被**一张表**取代（`src/core/work-mode.ts:237-238` 的注释写明"hand-written pair that nothing read"；`tests/work-mode.test.ts:662` 两向覆盖） | **归档** |
| `10-03-host-tool-surface-sources` | `tests/work-mode.test.ts` 里那份硬编码清单**已不存在**；网络工具只剩一处声明（`src/core/invocation-disposition.ts`，被 `src/core/action-policy.ts:625` 读），并有 AGENTS.md 规则行 + 测试 | **归档** |
| `10-04-empty-effect-classes-pentest-trading` | `modes/pentest/governance.yaml` 与 `modes/trading/governance.yaml` 里 `effects` / `classes` **一行都没有** | **仍在** → 进台账 |

**判据二 · 从未规划** = prd 里还有 `TBD`。实测未归档 task 里命中 **10** 个：

```
09-29-report-blocker · 10-03-bare-line-anchors · 10-03-capability-preconditions · 10-03-day-two-walk
10-03-mode-prerequisites · 10-03-unlocated-engine-crash · 10-03-unproducible-action-names
10-04-empty-effect-classes-pentest-trading · 10-05-divergent-records-unreconciled · 10-05-missing-hashline-edit-tool
```

其中 **3 个被 spec 页点名**（`day-two-walk`、`mode-prerequisites`、`missing-hashline-edit-tool`）——归档会让页面说谎 ⇒ 台账只收**其余 7 个**。

## 落地

| 项 | 结果 |
|---|---|
| 新页 | `.trellis/spec/guides/defect-ledger.md`（七条，每条：题名 · 逐字实测 · 出处 · 拿什么才算结） |
| 索引 | `guides/index.md` 加一行；**顺手修掉那处断掉的表行**（Cross-Layer 行被截断、尾巴跑到下一行） |
| 归档 | 7 个 task → `.trellis/tasks/archive/2026-10/` |
| 未归档 task | **28 → 20**（7 个本次 + 1 个判据一退役） |
| 归档税 | **0**（七份清单没有一个指向自己目录） |
| 坏指针 | 仍 **3**（与 AGENTS.md 的第五次测量一致） |
| 三道文档门 | **21 / 21**（台账的七条出处**全部可解析**，这正是"先归档、后跑门"的原因） |
| `npm test` | **937 / 934 pass / 1 fail / 2 skip**（同一条既有 fail）；`typecheck` 0；installer 143 OK |

## 台账里两条带 2026-10-05 复查的

- `10-03-bare-line-anchors`：门**现在**会从仓库根解析每条 `path:line`，且**把裸文件名也算作一条引用**（我今天写页时被它拦下 20 条）——比这条缺陷当初假设的更严。
- `10-03-unproducible-action-names`：那四个名字**仍不在 `dove-pi capability list`** 里；但模式文件现在把它们写成"模式自己的动作名"并给了效果类别 ⇒ **是答案还是问题的另一种拼法**，需要一句人的决定。

## 报告里要点出的两件事（不在本轮范围）

1. **`10-03-unlocated-engine-crash` 是记录、不是任务**：不可复现、没有可指认的修法。台账里如实这么写。
2. **两个仍 TBD 的 task 被页面引用**：`day-two-walk` 与 `mode-prerequisites`。页面说"gap owned by X"，而 **X 是个未规划的壳**——"owned"比它读起来要弱。要么把它们也规划掉，要么把页面的指向改成台账。
