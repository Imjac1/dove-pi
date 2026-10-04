# 发布归档必须带上它摘要覆盖的模式定义

## Goal

发布的 zip 里没有 `modes/`，而发布摘要（digest）声称覆盖它 —— 于是"摘要相同的两次发布"可以带着不同的模式定义，而装出来的那份**一旦声明了模式就会拒绝所有工具调用**。把 `modes` 放进归档，并让就绪检查拒绝"没有模式"或"模式只复制了一半"的归档。

**用户价值**：装出来的 release 与它的清单说的是同一件事；两类发布门（摘要、就绪检查）都不再只是说法。

## Background（全部实测）

- `.github/workflows/release.yml` 的 `$include` 组装归档：`bin, installer, scripts, src, tests, .pi, dove_pi.py, package.json, package-lock.json, tsconfig.json, README.md, README.en.md` —— **没有 `modes`**。
- `scripts/release-roots.mts` 的 `RELEASE_SOURCE_ROOTS` **有** `modes`（其注释写明理由：`work-mode.ts` 会加载 `modes/<id>/MODE.md`，code-audit 还会读它下面的 catalog）—— 两份清单，没有任何东西比对过它们。
- `scripts/check_release_readiness.py` 的 `REQUIRED_ARCHIVE_FILES` 只要六个文件，`modes/` 下**一个都不要求**，所以漏了也不会在发布时红。
- 后果（读代码得出，未构建归档）：装完后选中 `modes/pentest` 会装载失败，`src/pi-adapter/extension.ts` 的 `tool_call` 拒绝随之拒绝**每一个**工具调用。
- 审计：`.trellis/tasks/10-05-pstack-reference-audit/research/dove-pi-current.md` §3 (e) **D23**；`findings.md` §四 A 级第 3 条。

## Requirements

- **R1** 归档组装必须复制 `modes`。
- **R2** 两份清单由**机制**比住，不由散文比住：`tests/release-manifest.test.ts` 新增用例从 `release.yml` 解析 `$include`，与 `RELEASE_SOURCE_ROOTS` 比对 —— 判定方式**推导而非重列**：一个 root 只要被直接复制、或落在被复制的目录里就算覆盖（这样以后新增 root 不必回来改这条用例）。
- **R3** 就绪检查必须在**归档自己身上**要求模式：`modes/` 下一个 `MODE.md` 都没有 → 拒绝；某个模式目录有文件却**没有 `MODE.md`** → 拒绝并点名该模式。判定同样推导（取自归档的条目），不引入第二份模式清单。
- **R4** 每条新规则都要有能让它红的 fixture：JS 侧的新用例改前必须红在 `modes` 上；Python 侧两条路径各有断言（另加原有的"完整归档通过"作正向对照）。

## Acceptance Criteria

- [x] `node --import tsx --test tests/release-manifest.test.ts` 全绿（4 项，比改前多 1），且改前它红在 `these roots are in the digest and not in the archive: modes`。
- [x] `python -m unittest discover -s tests -p "*installer*_test.py"` 全绿（143 项，比改前多 1）；其中就绪套件的 fixture 现在**带一个模式定义**（它原来就是"不完整的归档"，正是新规则要拒的形状）。
- [x] 新规则的两条路径都被证明能红：独立探针（`.trellis/.runtime/probe-release-modes.py`，已跑并删除保留在 runtime 目录）对同一 zip 给出三种结果 —— 无 `modes/` → "carries no mode definitions"；有模式目录无 `MODE.md` → 点名该模式；完整 → 接受。
- [x] 探针**当场发现我自己写错的一个条件**（`name.count("/") > 2` 把完整的归档也判成"没有模式"），改成 `>= 2` 后三种结果才成立 —— 这条记下来是因为：就绪检查没有单元测试覆盖，只有探针能证明它会红。随后把两条路径写成了固定用例。
- [x] 发布门顺序用例（`test_release_workflow_runs_readiness_after_gates_before_publish`）仍绿：新增的注释行没有移动它断言的三个 gate 与 readiness 的相对位置。

## Out of Scope

- 真跑一次 `release.yml`（本机无 runner）；本任务只保证组装清单、摘要根、就绪检查三者一致，以及它们各自的检查会红。
- `modes/` 之外是否还有别的"摘要覆盖、归档没带"的根 —— 新用例对**所有** `RELEASE_SOURCE_ROOTS` 都成立，所以这一问已经被覆盖，不需要再列一遍。

## Open Questions

（无。）
