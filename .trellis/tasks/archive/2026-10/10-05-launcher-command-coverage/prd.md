# 启动器的命令表必须覆盖 CLI 实现的命令

## Goal

`dove-pi axi-turn` 是帮助里写着的入口，而它到不了 CLI 的实现分支 —— 启动器把它当成 Pi 的普通参数，于是"跑一遍参考 loop"变成了"开一个 Pi 会话"。修好这一处，并加一条能防止同类漏项的检查。

**用户价值**：参考 loop 的唯一产品入口，在**文档给出的那条命令上**重新可达；并且第三个"同一份命令清单各说一套"的漏点被一个机制关掉（前两个已在 `10-05-pstack-reference-audit` 里关掉）。

## Background（全部实测）

- `bin/dove-pi.cjs:19-46` 的 `pythonCommands` 决定一个命令是否交给 Python CLI；不在其中的一律 `spawnPi`（`:48-66` 的 `shouldUsePiFastPath`，`:168-169`）。
- **`axi-turn` 不在那张表里**，而 `dove_pi.py:73` 的 `LOCAL_CLI_COMMANDS` 有它、`dove_pi.py:962-963` 的 `--help` 把它当命令列出、`src/cli.ts:182` 也有对应分支。
- 两类门都看不见它：启动器在 `tsconfig.json:22` 的 `include` 之外；`tests/installer_test.py:209-213` 只断言源码里**存在**三个标识符（删掉表里任何一条、或把 `axi-turn` 加进去，它都照样通过）。
- 审计：`.trellis/tasks/10-05-pstack-reference-audit/research/dove-pi-current.md` §3 (a) **D5**；`findings.md` §四 A 级第 2 条。

## Requirements

- **R1** `axi-turn` 必须到达 CLI：`pythonCommands` 覆盖 `dove_pi.LOCAL_CLI_COMMANDS`。
- **R2** 这条覆盖关系由**机制**保住，不由散文保住：新增的检查从 `bin/dove-pi.cjs` 解析那张表、与 `dove_pi.LOCAL_CLI_COMMANDS` 比对，缺谁就点名谁。
- **R3** 检查必须**先红后绿**：改之前它必须红在 `['axi-turn']` 上。
- **R4** 不改 `tsconfig.json` 的 `include`（把 `bin` 拉进类型门是另一个决定，属 `10-03-*` 的记录，本任务不重开）。

## Acceptance Criteria

- [x] `python -m unittest discover -s tests -p "*installer*_test.py"` 全绿（142 项，比改前多 1）。
- [x] 新用例在改 `bin/dove-pi.cjs` 之前红，且失败信息点名 `axi-turn` 与后果（"starts a Pi session"）。
- [x] 端到端：`node bin/dove-pi.cjs --skip-version-check axi-turn` 真的跑出参考 loop 的一轮（`mode: code-audit · provider calls: 2 · stop: completed · exit 0`），而改前同一条命令会去启动 Pi 会话。
- [x] `pythonCommands` 里原有每条命令都仍在（只增了一条），启动器自身的横幅与帮助路径未动。

## Out of Scope

- **发布归档漏 `modes/`**（`findings.md` A 级第 3 条）与**缓存 0% / 提示词大小读数**（D 级）——各自另开任务。
- 把 `bin/` 纳入类型门（`tsconfig.json:22` 记录了十三条 TS2339 的理由）。

## Open Questions

（无。）
