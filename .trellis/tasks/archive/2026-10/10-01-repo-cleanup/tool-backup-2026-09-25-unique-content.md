# 工具备份里只存在于备份里的内容（2026-09-25 两份 `trellis` 备份）

**为什么有这份文件**：两份 `.trellis/.backup-2026-09-25T13-20-0*` 是工具更新前的快照，被 gitignore，**不在 git 里**。删除前逐文件核对：**180 个文件的字节已存在于 git 对象库**（`git hash-object` + `git cat-file -e`），**48 个只存在于备份里**。其中 40 个是可再生成的字节码（`.pyc`，627.8 KB）——**只登记哈希、不存内容**；剩下 8 个是真内容（149.5 KB），**全文收在这里**。

**怎么复核**：对本文件每个小节的 SHA-256 与内容对照即可；`.pyc` 一律可由 `python -m compileall` 重新生成，故只列哈希。

## 1. 清单（全部 48 个，含哈希）

| 来自哪份备份 | 路径 | 字节 | SHA-256 | 存了内容吗 |
|---|---|---|---|---|
| `.backup-2026-09-25T13-20-05` | `.trellis\.developer` | 54 | `4E96FA888DF213B0F057A4E84555184785FD48906353589ABED14822C7B1522F` | **是**（见下） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\__init__.cpython-311.pyc` | 3312 | `116C2F519197DEC497A4FBFEF853FBF512601A33ACD3088DA061D24997D12B58` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\active_task.cpython-311.pyc` | 33284 | `93FCD3651E18D8BBC8463F73B10A8B6133BCF3C3A4D557356AB8E083A929A023` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\config.cpython-311.pyc` | 20136 | `EB671C8F71ABF831287F4B436AC847D64BA13B7C8AC05DDD0F6A05454E9B6D0F` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\convergence.cpython-311.pyc` | 5513 | `739B9541EF996C02FECA3D5BEFAF1E8658F98238990DE69E78AEE3C126520EFF` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\developer.cpython-311.pyc` | 6956 | `BD71A7F98D438AF40FB47D316219679238899187056833C70F7340A8D7A10942` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\git.cpython-311.pyc` | 9484 | `ED66B1195D033738AD023E96052B8992307F9DB1F0875118DB851B573083CEE3` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\git_context.cpython-311.pyc` | 4202 | `B4389797C7D98A7CA8FE6C25B669EB16ED1E44026DC12BDCF646C36345AAD7ED` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\io.cpython-311.pyc` | 7172 | `18CAD4147B42497C33F00EE69921DE8F9A29FD3668D5641B5BC22649E69501C5` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\log.cpython-311.pyc` | 2467 | `938547CA8C2786E527A57A3377051A422FB4373B802EFCE6AB4E170287EF3DA8` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\packages_context.cpython-311.pyc` | 10376 | `5775D6AD66B58D67729686BA77D4B799B5010C914D44BECA8DF769C9AA5112C7` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\paths.cpython-311.pyc` | 17537 | `E61CB97CC63293CCC4930AAAA11C4B9BEF7437BC8E18681C60B4FE9243EFB5F5` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\safe_commit.cpython-311.pyc` | 13680 | `0B812D02D82F05FCA0F350B276C3E9CA9173AD94611FAED8ED0C71CE4CA0E4D4` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\session_context.cpython-311.pyc` | 38044 | `2E19C27BBFB650913E9EE24878921D5D1354E62DD46DF3DD44AC68B8D50B5F30` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\task_context.cpython-311.pyc` | 20468 | `4C0E7BDE4907FD75088F305081108F4690A5F094EB7416C1C3206A42C99839BE` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\task_store.cpython-311.pyc` | 77052 | `FB339E814FE6109A6BD66F968BBC2663213EBFC08E8B98AFC3F10C0BDCF662E4` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\task_utils.cpython-311.pyc` | 20923 | `DCBAEBFC56BF87C76B87F5762EF6BF13169AFC6D690DF8C8C53C0D66095026A7` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\tasks.cpython-311.pyc` | 5656 | `5C3F4783C50B764466F6C88C45F036AEEB88F065E5288BA565B5538F1C1B7D5D` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\trellis_config.cpython-311.pyc` | 10886 | `BD5A95938477C63273072684EAE731B60B1F94B506AF51D64573AF00A88906FF` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\types.cpython-311.pyc` | 4358 | `FCC5EFCBA20D7150BBD4C27D9FD674F5C2B782A2308A95F908506C3AD89EF2A0` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-05` | `.trellis\scripts\common\__pycache__\workflow_phase.cpython-311.pyc` | 9953 | `A9718E65CDE30C96999120F67C2E5627D84DD8F9EF8A9E80D145757534FBA4C9` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.agents\skills\trellis-session-insight\references\cli-quick-reference.md` | 6970 | `3F2DD664868F4B7F90B4800868BB34EAF8ED81246D1ADAF5F4DA34D1387765E3` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.agents\skills\trellis-session-insight\SKILL.md` | 6782 | `C9E58477F71987750F025EE967CA6663CCBBEDE8A352506BC2F4232A356DEB12` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.codex\hooks\inject-subagent-context.py` | 39504 | `A84240165C66A8891BF1D7EED06A3BCC26AEFA219DC98DB8192F3CB73C112C89` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.trellis\.developer` | 54 | `4E96FA888DF213B0F057A4E84555184785FD48906353589ABED14822C7B1522F` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.trellis\.template-hashes.json` | 23641 | `DEA4081179C8933C39FF7D946C52C985E520A7BFD5E0FF8FB6E7856A11919983` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.trellis\.version` | 6 | `D8AF8F3B3CF781075792BF662BA3A2D6D81DEF4B88D9E3B5160D6C99675EBDB6` | **是**（见下） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\__init__.cpython-311.pyc` | 3312 | `116C2F519197DEC497A4FBFEF853FBF512601A33ACD3088DA061D24997D12B58` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\active_task.cpython-311.pyc` | 33284 | `93FCD3651E18D8BBC8463F73B10A8B6133BCF3C3A4D557356AB8E083A929A023` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\config.cpython-311.pyc` | 20136 | `EB671C8F71ABF831287F4B436AC847D64BA13B7C8AC05DDD0F6A05454E9B6D0F` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\convergence.cpython-311.pyc` | 5513 | `739B9541EF996C02FECA3D5BEFAF1E8658F98238990DE69E78AEE3C126520EFF` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\developer.cpython-311.pyc` | 6956 | `BD71A7F98D438AF40FB47D316219679238899187056833C70F7340A8D7A10942` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\git.cpython-311.pyc` | 9484 | `ED66B1195D033738AD023E96052B8992307F9DB1F0875118DB851B573083CEE3` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\git_context.cpython-311.pyc` | 4202 | `B4389797C7D98A7CA8FE6C25B669EB16ED1E44026DC12BDCF646C36345AAD7ED` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\io.cpython-311.pyc` | 7172 | `18CAD4147B42497C33F00EE69921DE8F9A29FD3668D5641B5BC22649E69501C5` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\log.cpython-311.pyc` | 2467 | `938547CA8C2786E527A57A3377051A422FB4373B802EFCE6AB4E170287EF3DA8` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\packages_context.cpython-311.pyc` | 10376 | `5775D6AD66B58D67729686BA77D4B799B5010C914D44BECA8DF769C9AA5112C7` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\paths.cpython-311.pyc` | 17537 | `E61CB97CC63293CCC4930AAAA11C4B9BEF7437BC8E18681C60B4FE9243EFB5F5` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\safe_commit.cpython-311.pyc` | 13680 | `0B812D02D82F05FCA0F350B276C3E9CA9173AD94611FAED8ED0C71CE4CA0E4D4` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\session_context.cpython-311.pyc` | 38044 | `2E19C27BBFB650913E9EE24878921D5D1354E62DD46DF3DD44AC68B8D50B5F30` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\task_context.cpython-311.pyc` | 20468 | `4C0E7BDE4907FD75088F305081108F4690A5F094EB7416C1C3206A42C99839BE` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\task_store.cpython-311.pyc` | 77052 | `FB339E814FE6109A6BD66F968BBC2663213EBFC08E8B98AFC3F10C0BDCF662E4` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\task_utils.cpython-311.pyc` | 20923 | `DCBAEBFC56BF87C76B87F5762EF6BF13169AFC6D690DF8C8C53C0D66095026A7` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\tasks.cpython-311.pyc` | 5656 | `5C3F4783C50B764466F6C88C45F036AEEB88F065E5288BA565B5538F1C1B7D5D` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\trellis_config.cpython-311.pyc` | 10886 | `BD5A95938477C63273072684EAE731B60B1F94B506AF51D64573AF00A88906FF` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\types.cpython-311.pyc` | 4358 | `FCC5EFCBA20D7150BBD4C27D9FD674F5C2B782A2308A95F908506C3AD89EF2A0` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\__pycache__\workflow_phase.cpython-311.pyc` | 9953 | `A9718E65CDE30C96999120F67C2E5627D84DD8F9EF8A9E80D145757534FBA4C9` | 否（可再生字节码） |
| `.backup-2026-09-25T13-20-12` | `.trellis\scripts\common\task_store.py` | 76058 | `EF33B6326AFB146543538420D1E7B714BECC7A21F6E74E562C19618C7EDA4230` | **是**（见下） |

## 2. 全文（8 个真内容文件）

### `.agents\skills\trellis-session-insight\references\cli-quick-reference.md`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：6970 · SHA-256：`3F2DD664868F4B7F90B4800868BB34EAF8ED81246D1ADAF5F4DA34D1387765E3`

````markdown
# `trellis mem` CLI Reference

Full flag reference for the five subcommands. Pin this as the authoritative source — `trellis mem help` prints the same content at runtime, so anything here that drifts is a bug.

## Subcommands

| Command                | Purpose                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `list`                 | List sessions. Default subcommand when none is given.                                                                  |
| `search <keyword>`     | Find sessions whose contents match a keyword.                                                                          |
| `context <session-id>` | Drill into one session: top-N hit turns + surrounding context. Pair with `--grep` for keyword anchoring.               |
| `extract <session-id>` | Dump cleaned dialogue. Combine with `--phase` / `--grep` to slice.                                                     |
| `projects`             | List active project `cwd` values with session counts. Use this to discover which `--cwd` to pass to other subcommands. |

## Flags (apply where meaningful)

| Flag                                          | Subcommands       | Meaning                                                                                                                                                    |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--platform claude\|codex\|devin\|grok\|opencode\|pi\|zcode\|all` | all               | Default `all`. `devin` is Cognition Devin CLI (`sessions.db`), not `trellis init --devin` (Desktop). |
| `--since YYYY-MM-DD`                          | list / search     | Inclusive lower date bound.                                                                                                                                |
| `--until YYYY-MM-DD`                          | list / search     | Inclusive upper date bound.                                                                                                                                |
| `--global`                                    | list / search     | Include sessions from every project on this machine. Default is the current project `cwd`.                                                                 |
| `--cwd <path>`                                | list / search     | Force a specific project cwd instead of inferring from where you are.                                                                                      |
| `--limit N`                                   | list / search     | Cap output rows. Default `50`.                                                                                                                             |
| `--grep KW`                                   | extract / context | Filter turns by keyword. Multi-token AND when whitespace-separated.                                                                                        |
| `--phase brainstorm\|implement\|all`          | extract           | Slice session by Trellis task boundaries. `brainstorm` = `[task.py create, task.py start)`. `implement` = turns outside brainstorm windows. Default `all`. |
| `--turns N`                                   | context           | Number of hit turns to return. Default `3`.                                                                                                                |
| `--around N`                                  | context           | Surrounding turns to include per hit. Default `1`.                                                                                                         |
| `--max-chars N`                               | context           | Total character budget. Default `6000` (~1500 tokens).                                                                                                     |
| `--include-children`                          | search / context  | Merge OpenCode sub-agent sessions into their parent session.                                                                                               |
| `--json`                                      | all               | Emit machine-parseable JSON instead of human-readable output.                                                                                              |

## Common one-liners

```bash
# What past sessions discussed "deadlock" anywhere on this machine?
trellis mem search "deadlock" --global --limit 20

# Inside a specific session, surface the top 5 turns that mention "lock contention"
# plus 2 turns of surrounding context.
trellis mem context 5842592d --grep "lock contention" --turns 5 --around 2

# Recover the brainstorm window for a session — useful when continuing a task
# the user started a week ago.
trellis mem extract 5842592d --phase brainstorm

# List every project this machine has Trellis sessions for, with counts.
trellis mem projects
```

## Output shapes

- **Default human output** (no `--json`): wrapped to a terminal, with session ids highlighted and turn markers visible. Suitable to read inline but messy to paste into a markdown file.
- **`--json`**: stable schema, safe to parse and process. When piping `mem` output into a follow-up step (e.g. summarizing for a Lessons section), prefer `--json`.

## Caveats

- **OpenCode adapter is a stub on `0.6.0-beta.*`.** When `--platform` resolves to OpenCode (or `all` and OpenCode would be included), `mem` prints a one-line "reader unavailable" notice and continues with the other platforms. Don't promise OpenCode coverage in your reply until the adapter ships.
- **`--platform devin` is Cognition Devin CLI** (`~/.local/share/devin/cli/sessions.db`). It is not `trellis init --devin` (Devin Desktop / Cascade) and not Factory Droid.
- **`--phase` slicing depends on `task.py create` / `task.py start` invocations appearing in the recorded bash calls of the session.** Sessions where the user ran `task.py` from a different terminal — outside the recorded AI loop — will not have phase boundaries. `--phase all` is the safe fallback.
- **`mem` indexes platform JSONL files directly.** If the user has cleared their Claude / Codex / Pi session storage, `mem` cannot recover what is no longer on disk.
- **`mem` is read-only.** No remote sync, no edits to platform JSONL. Any write you do based on `mem` findings is your own follow-up call into the editing tools available to you.

## When you need more than this reference

Run `trellis mem help` in the user's shell. The runtime help is authoritative and will be ahead of this reference during fast-moving beta releases.
````

### `.agents\skills\trellis-session-insight\SKILL.md`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：6782 · SHA-256：`C9E58477F71987750F025EE967CA6663CCBBEDE8A352506BC2F4232A356DEB12`

````markdown
---
name: trellis-session-insight
description: "Reach into past AI conversation history through the `trellis mem` CLI. Use whenever the user asks 'how did we solve X last time', 'have we discussed this before', 'what was the decision on X', 'remind me what we did in this task', '上次怎么解的', '之前讨论过吗', '想起一段对话', or when starting a brainstorm that overlaps prior work, debugging a familiar bug, continuing a task across sessions, or doing a finish-work review. Returns raw past dialogue; decide for the moment whether to update spec, append to task notes, quote inline in the answer, or just internalize."
---

# Trellis Session Insight

This skill teaches an AI **how to call `trellis mem`** — the project's cross-session memory feedstock — and **when reaching for it is the right move**.

It is intentionally a **capability skill, not a workflow**. There is no fixed output file, no required write-back step, no "always run after finish-work" rule. What to do with what `mem` returns is a judgement call made in the moment of the conversation. The skill exists so the AI knows the capability is there and can decide.

## What `trellis mem` is

A local CLI that indexes the user's past Claude Code, Codex, Devin CLI, Grok, OpenCode, Pi Agent, and ZCode conversation logs and lets you list, search, slice by Trellis task boundaries, and dump cleaned dialogue from them. Claude and Codex use `~/.claude/projects/` and `~/.codex/sessions/`. Devin CLI (Cognition terminal agent, not `trellis init --devin` Desktop) uses `~/.local/share/devin/cli/sessions.db`. Grok uses `~/.grok/sessions/`. OpenCode uses `~/.local/share/opencode/opencode.db` (zero-dependency SQLite reader). Pi uses its default or environment-configured session root, global `~/.pi/agent/settings.json`, and the scoped project's `.pi/settings.json`; relative `sessionDir` values resolve from the settings file directory. Project-local Pi settings require project-scoped lookup through the current cwd or `--cwd`. ZCode uses `~/.zcode/cli/db/db.sqlite`.

Nothing in `mem` is uploaded. All reads are local.

## When to reach for it

The bar is "would a senior teammate ask 'didn't we already talk about this?'" — those are the moments. Some concrete patterns:

- **Brainstorm rerun risk.** Starting a new task that touches an area the user has been in before, and you want to check whether a decision was already made — before re-asking the user.
- **Familiar-bug debugging.** The current bug pattern feels like one the user reported / fixed before. Pulling the relevant past session can save a full debugging loop.
- **Cross-session continuation.** The user resumes work after a gap and says "where were we" / "继续上次的" without being specific.
- **Decision retrieval.** The user references "the decision we made about X" but the decision lives in an old brainstorm, not in any `prd.md` / `spec/`.
- **Finish-work retrospective.** When the user explicitly asks for a wrap-up of what was decided / what hurt / what surprised them in this task — not as a forced step on every finish-work.
- **Pattern-spotting across past work.** The user asks "do I keep making the same mistake on X" / "我每次都踩这个坑吗" — search across sessions answers that.

If none of these apply, don't call `mem`. It is a tool, not a ceremony.

## When NOT to reach for it

- The relevant context is already in the current turn, `prd.md`, `design.md`, recent `git log`, or the open files. `mem` is for stuff that has fallen out of immediate reach.
- The user is asking about a fact in the code, not a fact from a past conversation. `git log -p` / `grep` / reading the file directly is faster and more authoritative.
- You are in a sub-agent (`trellis-implement` / `trellis-check`) whose dispatch prompt already includes the curated `implement.jsonl` / `check.jsonl` context. Adding `mem` on top usually just clutters.
- The user has explicitly said "don't dig through history, just answer what I asked".

## What to do with what `mem` returns

Treat the output as **raw material**, not a deliverable. Once you have it, decide based on the live conversation:

- **Quote inline in your reply** if a specific past exchange answers the user's current question — and cite the session-id / phase so the user can verify.
- **Update `<task>/prd.md` or `<task>/design.md`** if `mem` surfaced a load-bearing decision that should have been written down but wasn't. Surface the proposed edit to the user first.
- **Append to a task-local notes file** (e.g. `<task>/notes.md` or extending an existing one) if the finding belongs to the current task's record but doesn't fit the PRD.
- **Update `.trellis/spec/`** if the finding is a project-wide convention or gotcha that would help future tasks. Run the `trellis-update-spec` skill for that — `session-insight` ends at the discovery.
- **Just absorb it** for the next few turns and answer better, without writing anything. This is often the right move for one-off recall.

Trellis does not prescribe a single destination. Forcing every recall into a fixed file makes the file grow into noise. Let the situation decide.

## How to call it

Full CLI reference is in `references/cli-quick-reference.md`. The 80% case is one of:

```bash
# Find sessions whose contents mention a keyword (project-scope is default;
# add --global to search every project on this machine).
trellis mem search "<keyword>"

# Dump dialogue from one session, optionally filtered by phase or keyword.
trellis mem extract <session-id> --phase brainstorm
trellis mem extract <session-id> --grep "<keyword>"

# Drill into a session: top-N hit turns + surrounding context.
trellis mem context <session-id> --turns 3 --around 2

# When you do not know the session id yet, start with list + filter.
trellis mem list --cwd <project-path>
trellis mem projects   # → list active project cwds, then narrow
```

Phase slicing (`--phase brainstorm|implement|all`) cuts the session at `task.py create` and `task.py start` boundaries. For a finish-work review of the current task, `--phase brainstorm` recovers the planning discussion and `--phase implement` recovers the execution loop. Default is `all`.

## Triggering patterns

`references/triggering-patterns.md` lists more verbatim user phrasings (English + Chinese) that should make you think "reach for `mem`" — keep that handy when training instinct.

## Out of scope

- `mem` does not edit code or update files. Any write-back is your decision in the moment.
- `mem` is read-only on the platform JSONL stores. It does not push or sync to remote.
- This skill does not replace `trellis-update-spec` (which is the right tool for promoting a finding into project-wide guidance) or the platform-native task / spec workflow.
````

### `.codex\hooks\inject-subagent-context.py`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：39504 · SHA-256：`A84240165C66A8891BF1D7EED06A3BCC26AEFA219DC98DB8192F3CB73C112C89`

````markdown
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Platform Sub-Agent Context Injection Hook

Injects task-specific context when sub-agents (implement, check, research) are spawned.

Core Design Philosophy:
- Hook is responsible for injecting all context, subagent works autonomously with complete info
- Each agent has a dedicated jsonl file defining its context
- No resume needed, no segmentation, behavior controlled by code not prompt

Trigger: PreToolUse (before Task tool call)

Context Source: Trellis active task resolver points to task directory
- implement.jsonl - Implement agent dedicated context
- check.jsonl     - Check agent dedicated context
- prd.md          - Requirements document
- design.md       - Technical design for complex tasks
- implement.md    - Execution plan for complex tasks
- codex-review-output.txt - Code Review results
"""
from __future__ import annotations

# IMPORTANT: Suppress all warnings FIRST
import warnings
warnings.filterwarnings("ignore")

import json
import os
import sys
from pathlib import Path
from typing import Any

# Hook hosts send UTF-8 JSON regardless of the process locale.
_stdin_reconfigure = getattr(sys.stdin, "reconfigure", None)
if callable(_stdin_reconfigure):
    try:
        _stdin_reconfigure(encoding="utf-8", errors="replace")
    except (OSError, ValueError):
        pass

# IMPORTANT: Force stdout to use UTF-8 on Windows
# This fixes UnicodeEncodeError when outputting non-ASCII characters
if sys.platform.startswith("win"):
    import io as _io
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")  # type: ignore[union-attr]


# =============================================================================
# Path Constants (change here to rename directories)
# =============================================================================

DIR_WORKFLOW = ".trellis"
DIR_SPEC = "spec"
FILE_TASK_JSON = "task.json"

# =============================================================================
# Subagent Constants (change here to rename subagent types)
# =============================================================================

AGENT_IMPLEMENT = "trellis-implement"
AGENT_CHECK = "trellis-check"
AGENT_RESEARCH = "trellis-research"

# Agents that require a task directory
AGENTS_REQUIRE_TASK = (AGENT_IMPLEMENT, AGENT_CHECK)
# All supported agents
AGENTS_ALL = (AGENT_IMPLEMENT, AGENT_CHECK, AGENT_RESEARCH)


def find_repo_root(start_path: str) -> str | None:
    """
    Find git repo root from start_path upwards

    Returns:
        Repo root path, or None if not found
    """
    current = Path(start_path).resolve()
    while current != current.parent:
        if (current / ".git").exists():
            return str(current)
        current = current.parent
    return None


def _detect_platform(input_data: dict) -> str | None:
    if _hook_event_name(input_data) == "SubagentStart":
        return "codex"
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    # CLAUDE_PROJECT_DIR is a compatibility alias that several hosts set
    # alongside their own variable — CodeBuddy, ZCode and Trae all do. It must
    # therefore be checked LAST, or every one of them is detected as claude and
    # the context key becomes `claude_<their-session-id>`. That key does not
    # match the session file `task.py start` wrote under the host's real name,
    # so the sub-agent starts with no task context while the pointer exists on
    # disk. Same fix as inject-workflow-state.py and session-start.py; this
    # third copy was missed when those two were corrected.
    env_map = {
        "ZCODE_PROJECT_DIR": "zcode",
        "CURSOR_PROJECT_DIR": "cursor",
        "CODEBUDDY_PROJECT_DIR": "codebuddy",
        "FACTORY_PROJECT_DIR": "droid",
        "GEMINI_PROJECT_DIR": "gemini",
        "QODER_PROJECT_DIR": "qoder",
        "KIRO_PROJECT_DIR": "kiro",
        "COPILOT_PROJECT_DIR": "copilot",
        "TRAE_PROJECT_DIR": "trae",
        # Last: the shared alias, only meaningful once no vendor key matched.
        "CLAUDE_PROJECT_DIR": "claude",
    }
    for env_name, platform in env_map.items():
        if os.environ.get(env_name):
            return platform
    script_parts = set(Path(sys.argv[0]).parts)
    if ".claude" in script_parts:
        return "claude"
    if ".cursor" in script_parts:
        return "cursor"
    if ".gemini" in script_parts:
        return "gemini"
    if ".qoder" in script_parts:
        return "qoder"
    if ".codebuddy" in script_parts:
        return "codebuddy"
    if ".factory" in script_parts:
        return "droid"
    if ".kiro" in script_parts:
        return "kiro"
    if ".zcode" in script_parts:
        return "zcode"
    return None


def get_current_task(
    repo_root: str,
    input_data: dict,
    *,
    platform: str | None = None,
    allow_single_session_fallback: bool = True,
    allow_environment_context: bool = True,
    require_existing: bool = False,
) -> str | None:
    """Resolve current task directory through the unified active task resolver."""
    scripts_dir = Path(repo_root) / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from common.active_task import resolve_active_task  # type: ignore[import-not-found]
    except Exception:
        return None

    active = resolve_active_task(
        Path(repo_root),
        input_data,
        platform=platform or _detect_platform(input_data),
        allow_single_session_fallback=allow_single_session_fallback,
        allow_environment_context=allow_environment_context,
    )
    if require_existing and active.stale:
        return None
    return active.task_path


# =============================================================================
# Context Injection Limits (issue #441)
#
# Notice text and behavior mirrored byte-for-byte in the Pi TS extension
# (templates/pi/extensions/trellis/index.ts.txt). Changing wording here
# requires changing it there too.
# =============================================================================

DEFAULT_MAX_FILE_BYTES = 32768
DEFAULT_MAX_ARTIFACT_BYTES = 65536
DEFAULT_MAX_TOTAL_BYTES = 131072

DEFAULT_LIMITS: dict[str, int] = {
    "max_file_bytes": DEFAULT_MAX_FILE_BYTES,
    "max_artifact_bytes": DEFAULT_MAX_ARTIFACT_BYTES,
    "max_total_bytes": DEFAULT_MAX_TOTAL_BYTES,
}


def _get_limits(repo_root: str) -> dict[str, int]:
    """Load context-injection byte limits from config.yaml, with safe fallback."""
    scripts_dir = Path(repo_root) / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from common.config import get_context_injection_limits  # type: ignore[import-not-found]

        return get_context_injection_limits(Path(repo_root))
    except Exception:
        return dict(DEFAULT_LIMITS)


def truncate_utf8(data: bytes, cap: int) -> bytes:
    """Truncate ``data`` to at most ``cap`` bytes without splitting a UTF-8
    multi-byte sequence.

    ``cap <= 0`` means "no limit" — returns ``data`` unchanged.
    """
    if cap <= 0 or len(data) <= cap:
        return data

    truncated = data[:cap]
    i = len(truncated)
    # Back off over continuation bytes (10xxxxxx) to find the lead byte.
    while i > 0 and (truncated[i - 1] & 0xC0) == 0x80:
        i -= 1
    if i == 0:
        return b""

    lead = truncated[i - 1]
    if lead & 0x80:
        if (lead & 0xE0) == 0xC0:
            seq_len = 2
        elif (lead & 0xF0) == 0xE0:
            seq_len = 3
        elif (lead & 0xF8) == 0xF0:
            seq_len = 4
        else:
            seq_len = 1
        # Drop the lead byte too if its full sequence didn't fit.
        if (i - 1) + seq_len > len(truncated):
            i -= 1

    return truncated[:i]


class _Budget:
    """Tracks the running total of bytes emitted into the sub-agent context."""

    def __init__(self, max_total_bytes: int) -> None:
        self.max_total_bytes = max_total_bytes
        self.used = 0

    def has_room(self, size: int) -> bool:
        if self.max_total_bytes <= 0:
            return True
        return self.used + size <= self.max_total_bytes

    def add(self, size: int) -> None:
        self.used += size


def _real_path_contained(base_real: str, target_real: str) -> bool:
    """Whether an already-realpath'd target sits under an already-realpath'd base.

    ValueError on Windows when the two sit on different drives; that is
    outside the base by definition, so it fails closed.
    """
    try:
        return os.path.commonpath([base_real, target_real]) == base_real
    except ValueError:
        return False


def _read_file_bytes(base_path: str, file_path: str) -> bytes | None:
    """Read raw file bytes, return None if file doesn't exist."""
    full_path = os.path.join(base_path, file_path)
    try:
        root_real = os.path.realpath(base_path)
        # `.trellis` may itself be a symlink into a store outside the repo
        # (#567); its real location is a second legitimate containment base.
        workflow_real = os.path.realpath(os.path.join(base_path, ".trellis"))
        full_real = os.path.realpath(full_path)
        if not _real_path_contained(root_real, full_real) and not (
            _real_path_contained(workflow_real, full_real)
        ):
            return None
    except OSError:
        return None
    if os.path.exists(full_path) and os.path.isfile(full_path):
        try:
            with open(full_path, "rb") as f:
                return f.read()
        except Exception:
            return None
    return None


def _truncate_notice(path: str, cap: int) -> str:
    return f"\n[Trellis: truncated at {cap} bytes — read {path} for the full content]"


def _is_binary_content(data: bytes) -> bool:
    """Return True when raw bytes should not be decoded into model context."""
    if b"\x00" in data:
        return True
    try:
        data.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return True
    return False


def _binary_notice(path: str, size: int, reason: str) -> str:
    return (
        f"[Trellis: not inlined (binary file) — "
        f"{path} ({size} bytes): {reason}]"
    )


def _index_notice(path: str, size: int, reason: str) -> str:
    return (
        f"[Trellis: not inlined (total context limit reached) — "
        f"{path} ({size} bytes): {reason}]"
    )


def _budgeted_block(
    budget: _Budget,
    header: str,
    plain_path: str,
    content: str,
    reason: str,
    size_for_index: int,
) -> str:
    """Return an inlined ``=== header ===`` block, or degrade to an index
    notice once the total context budget is exhausted."""
    block = f"=== {header} ===\n{content}"
    block_bytes = len(block.encode("utf-8"))
    if not budget.has_room(block_bytes):
        notice = _index_notice(plain_path, size_for_index, reason)
        budget.add(len(notice.encode("utf-8")))
        return notice
    budget.add(block_bytes)
    return block


def _materialize_file(
    base_path: str,
    file_path: str,
    reason: str,
    limits: dict[str, int],
    budget: _Budget,
) -> str | None:
    """Read a JSONL-referenced file, apply the per-file cap, then budget it."""
    data = _read_file_bytes(base_path, file_path)
    if data is None:
        return None

    size = len(data)
    if _is_binary_content(data):
        notice = _binary_notice(file_path, size, reason)
        budget.add(len(notice.encode("utf-8")))
        return notice

    cap = limits["max_file_bytes"]
    truncated_bytes = truncate_utf8(data, cap)
    content = truncated_bytes.decode("utf-8", errors="replace")
    if len(truncated_bytes) < size:
        content += _truncate_notice(file_path, cap)

    return _budgeted_block(budget, file_path, file_path, content, reason, size)


def _materialize_directory(
    base_path: str,
    dir_path: str,
    reason: str,
    limits: dict[str, int],
    budget: _Budget,
    max_files: int = 20,
) -> list[str]:
    """Read all .md files in a directory, applying the same per-file and
    total caps as a single-file JSONL entry."""
    full_path = os.path.join(base_path, dir_path)
    if not os.path.exists(full_path) or not os.path.isdir(full_path):
        return []

    blocks: list[str] = []
    try:
        md_files = sorted(
            f
            for f in os.listdir(full_path)
            if f.endswith(".md") and os.path.isfile(os.path.join(full_path, f))
        )
        for filename in md_files[:max_files]:
            relative_path = os.path.join(dir_path, filename)
            block = _materialize_file(base_path, relative_path, reason, limits, budget)
            if block:
                blocks.append(block)
    except Exception:
        pass

    return blocks


def read_jsonl_entries(base_path: str, jsonl_path: str) -> list[dict]:
    """
    Parse all file/directory entries referenced in a jsonl context file.

    Schema:
        {"file": "path/to/file.md", "reason": "..."}
        {"file": "path/to/dir/", "type": "directory", "reason": "..."}
        {"_example": "..."}          # legacy placeholder — skipped (no `file` field)

    Rows without a ``file`` field (e.g. the placeholder line older Trellis
    versions wrote at ``task.py create`` time) are skipped silently. If the
    resulting entry list is empty, a stderr warning is emitted so the operator
    can debug missing context.

    Returns:
        [{"file": path, "type": "file" | "directory", "reason": reason}, ...]
    """
    full_path = os.path.join(base_path, jsonl_path)
    if not os.path.exists(full_path):
        print(
            f"[inject-subagent-context] WARN: {jsonl_path} not found — "
            f"sub-agent will receive only task artifacts",
            file=sys.stderr,
        )
        return []

    entries: list[dict] = []
    saw_real_entry = False
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                    file_path = item.get("file") or item.get("path")

                    if not file_path:
                        # Seed / comment row — skip silently
                        continue

                    saw_real_entry = True
                    entries.append(
                        {
                            "file": file_path,
                            "type": item.get("type", "file"),
                            "reason": item.get("reason") or "-",
                        }
                    )
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass

    if not saw_real_entry:
        print(
            f"[inject-subagent-context] WARN: {jsonl_path} has no curated "
            f"entries (only seed / empty) — sub-agent will receive only "
            f"task artifacts. See workflow.md planning artifact guidance.",
            file=sys.stderr,
        )

    return entries


def _materialize_jsonl_entries(
    base_path: str, jsonl_path: str, limits: dict[str, int], budget: _Budget
) -> list[str]:
    """Materialize every entry in a jsonl context file into context blocks,
    applying per-file and total budget caps."""
    blocks: list[str] = []
    for entry in read_jsonl_entries(base_path, jsonl_path):
        if entry["type"] == "directory":
            blocks.extend(
                _materialize_directory(
                    base_path, entry["file"], entry["reason"], limits, budget
                )
            )
        else:
            block = _materialize_file(
                base_path, entry["file"], entry["reason"], limits, budget
            )
            if block:
                blocks.append(block)
    return blocks


def get_agent_context(
    repo_root: str,
    task_dir: str,
    agent_type: str,
    limits: dict[str, int],
    budget: _Budget,
) -> str:
    """
    Get context from {agent_type}.jsonl for the specified agent.
    Only reads implement.jsonl or check.jsonl (the two JSONL files the task system creates).
    """
    agent_jsonl = f"{task_dir}/{agent_type}.jsonl"
    blocks = _materialize_jsonl_entries(repo_root, agent_jsonl, limits, budget)
    if not blocks:
        # Zero curated context reaches the model silently otherwise — the
        # stderr WARN above never enters any session (#573). Put the fact in
        # the prompt itself so the sub-agent compensates instead of assuming
        # the spec context was complete.
        return (
            f"[Trellis] {agent_jsonl} has no curated entries, so no spec/research "
            "context was injected. Before working, read the guidelines relevant "
            "to the code you will touch under .trellis/spec/, and treat the task "
            "artifacts below as the only prepared context."
        )
    return "\n\n".join(blocks)


def _materialize_artifact(
    base_path: str,
    file_path: str,
    header_label: str,
    reason: str,
    limits: dict[str, int],
    budget: _Budget,
) -> str | None:
    """Read a task artifact (prd/design/implement.md), apply the per-artifact
    cap, then budget it."""
    data = _read_file_bytes(base_path, file_path)
    if data is None:
        return None

    size = len(data)
    cap = limits["max_artifact_bytes"]
    truncated_bytes = truncate_utf8(data, cap)
    content = truncated_bytes.decode("utf-8", errors="replace")
    if len(truncated_bytes) < size:
        content += _truncate_notice(file_path, cap)

    return _budgeted_block(budget, header_label, file_path, content, reason, size)


def get_implement_context(repo_root: str, task_dir: str) -> str:
    """
    Complete context for Implement Agent

    Read order:
    1. All files in implement.jsonl (spec/research manifests)
    2. prd.md (requirements)
    3. design.md if present (technical design)
    4. implement.md if present (execution plan)
    """
    limits = _get_limits(repo_root)
    budget = _Budget(limits["max_total_bytes"])
    context_parts = []

    # 1. Read implement.jsonl
    base_context = get_agent_context(repo_root, task_dir, "implement", limits, budget)
    if base_context:
        context_parts.append(base_context)

    # 2. Requirements document
    prd_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/prd.md",
        f"{task_dir}/prd.md (Requirements)",
        "Requirements document",
        limits,
        budget,
    )
    if prd_block:
        context_parts.append(prd_block)

    # 3. Technical design for complex tasks
    design_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/design.md",
        f"{task_dir}/design.md (Technical Design)",
        "Technical design document",
        limits,
        budget,
    )
    if design_block:
        context_parts.append(design_block)

    # 4. Execution plan for complex tasks
    implement_plan_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/implement.md",
        f"{task_dir}/implement.md (Execution Plan)",
        "Execution plan document",
        limits,
        budget,
    )
    if implement_plan_block:
        context_parts.append(implement_plan_block)

    return "\n\n".join(context_parts)


def get_check_context(repo_root: str, task_dir: str) -> str:
    """
    Context for Check Agent: check.jsonl + task artifacts.
    """
    limits = _get_limits(repo_root)
    budget = _Budget(limits["max_total_bytes"])
    context_parts = []

    base_context = get_agent_context(repo_root, task_dir, "check", limits, budget)
    if base_context:
        context_parts.append(base_context)

    prd_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/prd.md",
        f"{task_dir}/prd.md (Requirements)",
        "Requirements document",
        limits,
        budget,
    )
    if prd_block:
        context_parts.append(prd_block)

    design_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/design.md",
        f"{task_dir}/design.md (Technical Design)",
        "Technical design document",
        limits,
        budget,
    )
    if design_block:
        context_parts.append(design_block)

    implement_plan_block = _materialize_artifact(
        repo_root,
        f"{task_dir}/implement.md",
        f"{task_dir}/implement.md (Execution Plan)",
        "Execution plan document",
        limits,
        budget,
    )
    if implement_plan_block:
        context_parts.append(implement_plan_block)

    return "\n\n".join(context_parts)


def get_finish_context(repo_root: str, task_dir: str) -> str:
    """
    Context for Finish phase: reuses check.jsonl + prd.md
    (Finish is a final check, same context source.)
    """
    return get_check_context(repo_root, task_dir)



def build_implement_prompt(original_prompt: str, context: str) -> str:
    """Build complete prompt for Implement"""
    return f"""<!-- trellis-hook-injected -->
# Implement Agent Task

You are the Implement Agent in the Multi-Agent Pipeline.

## Your Context

All the information you need has been prepared for you:

{context}

---

## Your Task

{original_prompt}

---

## Workflow

1. **Understand specs** - All dev specs are injected above, understand them
    2. **Understand task artifacts** - Read requirements, technical design if present, and execution plan if present
    3. **Implement feature** - Implement following specs and task artifacts
4. **Self-check** - Ensure code quality against check specs

## Important Constraints

- Do NOT execute git commit, only code modifications
- Follow all dev specs injected above
- Report list of modified/created files when done"""


def build_check_prompt(original_prompt: str, context: str) -> str:
    """Build complete prompt for Check"""
    return f"""<!-- trellis-hook-injected -->
# Check Agent Task

You are the Check Agent in the Multi-Agent Pipeline (code and cross-layer checker).

## Your Context

All check specs and dev specs you need:

{context}

---

## Your Task

{original_prompt}

---

## Workflow

1. **Get changes** - Run `git diff --name-only` and `git diff` to get code changes
2. **Check against specs** - Check item by item against specs above
3. **Self-fix** - Fix issues directly, don't just report
4. **Run verification** - Run project's lint and typecheck commands

## Important Constraints

- Fix issues yourself, don't just report
- Must execute complete checklist in check specs
- Pay special attention to impact radius analysis (L1-L5)"""


def build_finish_prompt(original_prompt: str, context: str) -> str:
    """Build complete prompt for Finish (final check before PR)"""
    return f"""<!-- trellis-hook-injected -->
# Finish Agent Task

You are performing the final check before creating a PR.

## Your Context

Finish checklist and requirements:

{context}

---

## Your Task

{original_prompt}

---

## Workflow

1. **Review changes** - Run `git diff --name-only` to see all changed files
	2. **Verify task artifacts** - Check requirements in prd.md and, when present, design.md / implement.md
3. **Spec sync** - Analyze whether changes introduce new patterns, contracts, or conventions
   - If new pattern/convention found: read target spec file → update it → update index.md if needed
   - If infra/cross-layer change: follow the 7-section mandatory template from update-spec.md
   - If pure code fix with no new patterns: skip this step
4. **Run final checks** - Execute lint and typecheck
5. **Confirm ready** - Ensure code is ready for PR

## Important Constraints

- You MAY update spec files when gaps are detected (use update-spec.md as guide)
- MUST read the target spec file BEFORE editing (avoid duplicating existing content)
- Do NOT update specs for trivial changes (typos, formatting, obvious fixes)
- If critical CODE issues found, report them clearly (fix specs, not code)
- Verify all acceptance criteria in prd.md are met
- Verify design.md and implement.md constraints when those files are present"""



def get_research_context(repo_root: str, task_dir: str | None) -> str:
    """
    Context for Research Agent — project structure overview for spec directories.

    `task_dir` kept for signature parity with get_implement_context / get_check_context
    so the dispatcher can call them uniformly.
    """
    _ = task_dir
    context_parts = []

    # 1. Project structure overview (dynamically discover spec directories)
    spec_path = f"{DIR_WORKFLOW}/{DIR_SPEC}"
    spec_root = Path(repo_root) / DIR_WORKFLOW / DIR_SPEC

    # Build spec tree dynamically
    tree_lines = [f"{spec_path}/"]
    if spec_root.is_dir():
        pkg_dirs = sorted(d for d in spec_root.iterdir() if d.is_dir())
        for i, pkg_dir in enumerate(pkg_dirs):
            is_last = i == len(pkg_dirs) - 1
            prefix = "└── " if is_last else "├── "
            layers = sorted(d.name for d in pkg_dir.iterdir() if d.is_dir())
            layer_info = f" ({', '.join(layers)})" if layers else ""
            tree_lines.append(f"{prefix}{pkg_dir.name}/{layer_info}")

    spec_tree = "\n".join(tree_lines)

    project_structure = f"""## Project Spec Directory Structure

```
{spec_tree}
```

To get structured package info, run: `python ./{DIR_WORKFLOW}/scripts/get_context.py --mode packages`

## Search Tips

- Spec files: `{spec_path}/**/*.md`
- Code search: Use Glob and Grep tools
- Tech solutions: Use mcp__exa__web_search_exa or mcp__exa__get_code_context_exa"""

    context_parts.append(project_structure)

    return "\n\n".join(context_parts)


def build_research_prompt(original_prompt: str, context: str) -> str:
    """Build complete prompt for Research"""
    return f"""# Research Agent Task

You are the Research Agent in the Multi-Agent Pipeline (search researcher).

## Core Principle

**You do one thing: find and explain information.**

You are a documenter, not a reviewer.

## Project Info

{context}

---

## Your Task

{original_prompt}

---

## Workflow

1. **Understand query** - Determine search type (internal/external) and scope
2. **Plan search** - List search steps for complex queries
3. **Execute search** - Execute multiple independent searches in parallel
4. **Organize results** - Output structured report

## Search Tools

| Tool | Purpose |
|------|---------|
| Glob | Search by filename pattern |
| Grep | Search by content |
| Read | Read file content |
| mcp__exa__web_search_exa | External web search |
| mcp__exa__get_code_context_exa | External code/doc search |

## Strict Boundaries

**Only allowed**: Describe what exists, where it is, how it works

**Forbidden** (unless explicitly asked):
- Suggest improvements
- Criticize implementation
- Recommend refactoring
- Modify any files

## Report Format

Provide structured search results including:
- List of files found (with paths)
- Code pattern analysis (if applicable)
- Related spec documents
- External references (if any)"""


def _string_value(value: Any) -> str:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped
    return ""


def _hook_event_name(input_data: dict) -> str:
    """Return a hook event name from the documented snake/camel-case fields."""
    return _string_value(
        input_data.get("hook_event_name") or input_data.get("hookEventName")
    )


def _codex_subagent_type(input_data: dict) -> str:
    """Return a Trellis Codex agent type only for a native start event."""
    if _hook_event_name(input_data) != "SubagentStart":
        return ""
    agent_type = _string_value(
        input_data.get("agent_type") or input_data.get("agentType")
    )
    return agent_type if agent_type in AGENTS_ALL else ""


def build_codex_subagent_context(
    subagent_type: str,
    task_dir: str,
    context: str,
) -> str:
    """Build developer context for a native, already-dispatched Codex role."""
    role = subagent_type.removeprefix("trellis-")
    return f"""<!-- trellis-hook-injected -->
# Trellis Native {role.title()} Subagent

You are the dispatched `{subagent_type}` role for this task. Perform that role
directly; do not follow main-session dispatch or wait instructions, and do not
spawn another Trellis subagent.

Active task: {task_dir}

## Curated Context

{context}"""


def _handle_codex_subagent_start(input_data: dict) -> None:
    """Emit Codex developer context for a recognised native Trellis subagent.

    The event supplies the parent session id. Disabling the generic
    single-session fallback is essential here: native starts must never borrow
    a task from another Codex window when that parent id is absent or stale.
    """
    subagent_type = _codex_subagent_type(input_data)
    parent_session_id = _string_value(input_data.get("session_id"))
    if not subagent_type or not parent_session_id:
        return

    # Payload cwd first, then our own — some hosts (CodeBuddy IDE 4.10.4)
    # report "/" for every hook event. See inject-workflow-state.py.
    repo_root = None
    for candidate in (_string_value(input_data.get("cwd")), os.getcwd()):
        if not candidate:
            continue
        repo_root = find_repo_root(candidate)
        if repo_root:
            break
    if not repo_root:
        return

    task_dir = get_current_task(
        repo_root,
        {"session_id": parent_session_id},
        platform="codex",
        allow_single_session_fallback=False,
        allow_environment_context=False,
        require_existing=True,
    )
    if not task_dir:
        return

    if subagent_type in AGENTS_REQUIRE_TASK:
        task_dir_full = Path(repo_root) / task_dir
        if not task_dir_full.is_dir():
            return

    if subagent_type == AGENT_IMPLEMENT:
        context = get_implement_context(repo_root, task_dir)
    elif subagent_type == AGENT_CHECK:
        context = get_check_context(repo_root, task_dir)
    else:
        context = get_research_context(repo_root, task_dir)

    if not context:
        return

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": build_codex_subagent_context(
                subagent_type, task_dir, context
            ),
        }
    }
    print(json.dumps(output, ensure_ascii=False))


def _extract_subagent_name(value: Any) -> str:
    """Extract a sub-agent name from common platform encodings.

    Cursor's native Task args encode custom sub-agents as a protobuf oneof,
    which can appear in hook JSON as either ``{"custom": {"name": "..."}}``
    or ``{"type": {"case": "custom", "value": {"name": "..."}}}``.
    """
    direct = _string_value(value)
    if direct:
        return direct

    if not isinstance(value, dict):
        return ""

    for key in ("name", "subagent_type_name", "subagentTypeName"):
        direct = _string_value(value.get(key))
        if direct:
            return direct

    custom = value.get("custom")
    if isinstance(custom, dict):
        custom_name = _string_value(custom.get("name"))
        if custom_name:
            return custom_name

    oneof = value.get("type")
    if isinstance(oneof, dict):
        case_name = _string_value(oneof.get("case"))
        if case_name == "custom":
            nested_value = oneof.get("value")
            if isinstance(nested_value, dict):
                custom_name = _string_value(nested_value.get("name"))
                if custom_name:
                    return custom_name
        if case_name:
            return case_name

    case_name = _string_value(value.get("case"))
    if case_name == "custom":
        nested_value = value.get("value")
        if isinstance(nested_value, dict):
            custom_name = _string_value(nested_value.get("name"))
            if custom_name:
                return custom_name
    if case_name:
        return case_name

    for agent_name in AGENTS_ALL:
        if agent_name in value:
            return agent_name

    return ""


def _extract_subagent_type(tool_input: dict) -> str:
    for key in (
        "subagent_type",
        "subagentType",
        "subagent_type_name",
        "subagentTypeName",
        "subagent_name",
        "subagentName",
        "agent_type",
        "agentType",
        "name",
    ):
        agent_name = _extract_subagent_name(tool_input.get(key))
        if agent_name:
            return agent_name
    return ""


def _parse_hook_input(input_data: dict) -> tuple[str, str, dict]:
    """Parse hook input across different platform formats.

    Returns (subagent_type, original_prompt, tool_input).
    Handles:
    - Claude Code / Qoder / Droid: tool_name=Task|Agent, tool_input.subagent_type
    - CodeBuddy: tool_name=task (IDE) or Task (CLI), tool_input.subagent_name
    - Cursor: tool_name=Task|Subagent, tool_input.subagent_type
    - Copilot CLI: toolName=task (camelCase key, lowercase value)
    - ZCode: toolName=Agent, toolInput/tool_input.subagent_type
    - Gemini CLI: tool_name IS the agent name (BeforeTool matcher already filtered)
    - Kiro: agentSpawn hook, agent_name field at top level
    """
    tool_input = input_data.get("tool_input", {})
    if not isinstance(tool_input, dict):
        tool_input = input_data.get("toolInput", {})
    if not isinstance(tool_input, dict):
        tool_input = {}

    # Standard format: Task/Agent tool with subagent_type
    tool_name = input_data.get("tool_name", "") or input_data.get("toolName", "")
    if tool_name.lower() in ("task", "agent", "subagent"):
        return (
            _extract_subagent_type(tool_input),
            tool_input.get("prompt", ""),
            tool_input,
        )

    # Kiro: agentSpawn hook passes agent_name at top level
    agent_name = input_data.get("agent_name", "")
    if agent_name:
        return agent_name, tool_input.get("prompt", input_data.get("prompt", "")), tool_input

    # Gemini CLI: BeforeTool where tool_name IS the agent name
    # (matcher already ensured it's one of our agents)
    if tool_name in AGENTS_ALL:
        return tool_name, tool_input.get("prompt", ""), tool_input

    # Copilot CLI: toolName field (camelCase), value might be the agent name
    tool_name_camel = input_data.get("toolName", "")
    if tool_name_camel in AGENTS_ALL:
        return tool_name_camel, input_data.get("toolArgs", ""), tool_input

    return "", "", tool_input


def main():
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get("TRELLIS_DISABLE_HOOKS") == "1":
        sys.exit(0)

    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)
    if not isinstance(input_data, dict):
        sys.exit(0)

    if _hook_event_name(input_data) == "SubagentStart":
        try:
            _handle_codex_subagent_start(input_data)
        except Exception:
            # A native context hook must never prevent Codex from spawning the
            # requested child when its runtime state is unavailable or stale.
            pass
        sys.exit(0)

    subagent_type, original_prompt, tool_input = _parse_hook_input(input_data)
    cwd = input_data.get("cwd", os.getcwd())

    # Only handle subagent types we care about
    if subagent_type not in AGENTS_ALL:
        sys.exit(0)

    # Find repo root
    repo_root = find_repo_root(cwd)
    if not repo_root:
        sys.exit(0)

    # Get current task directory (research doesn't require it)
    task_dir = get_current_task(
        repo_root,
        input_data,
        allow_single_session_fallback=True,
    )

    # implement/check need task directory
    if subagent_type in AGENTS_REQUIRE_TASK:
        if not task_dir:
            sys.exit(0)
        # Contain the pointer before reading anything through it. `task.py` now
        # refuses to store a ref that leaves the repo, but a session file
        # written before that fix can still hold one, and `trellis update`
        # does not rewrite session files — so a poisoned pointer outlives the
        # upgrade that closed the writer. This is the last hop before the
        # task's prd.md/design.md reach the model prompt, so it checks again.
        try:
            root_real = os.path.realpath(repo_root)
            # `.trellis` may itself be a symlink into a store outside the
            # repo (#567); its real location is a second legitimate base.
            workflow_real = os.path.realpath(os.path.join(repo_root, ".trellis"))
            task_dir_full = os.path.realpath(os.path.join(repo_root, task_dir))
            if not _real_path_contained(root_real, task_dir_full) and not (
                _real_path_contained(workflow_real, task_dir_full)
            ):
                sys.exit(0)
        except OSError:
            sys.exit(0)
        if not os.path.exists(task_dir_full):
            sys.exit(0)

    # Check for [finish] marker in prompt (check agent with finish context)
    is_finish_phase = "[finish]" in original_prompt.lower()

    # Get context and build prompt based on subagent type
    if subagent_type == AGENT_IMPLEMENT:
        assert task_dir is not None  # validated above
        context = get_implement_context(repo_root, task_dir)
        new_prompt = build_implement_prompt(original_prompt, context)
    elif subagent_type == AGENT_CHECK:
        assert task_dir is not None  # validated above
        if is_finish_phase:
            # Finish phase: use finish context (lighter, focused on final verification)
            context = get_finish_context(repo_root, task_dir)
            new_prompt = build_finish_prompt(original_prompt, context)
        else:
            # Regular check phase: use check context (full specs for self-fix loop)
            context = get_check_context(repo_root, task_dir)
            new_prompt = build_check_prompt(original_prompt, context)
    elif subagent_type == AGENT_RESEARCH:
        # Research can work without task directory
        context = get_research_context(repo_root, task_dir)
        new_prompt = build_research_prompt(original_prompt, context)
    else:
        sys.exit(0)

    if not context:
        sys.exit(0)

    # Return updated input. Most platforms ignore unrecognized fields, so we
    # include multiple formats. ZCode is stricter; live probing confirmed the
    # nested Claude-compatible shape below reaches the sub-agent prompt.
    updated = {**tool_input, "prompt": new_prompt}
    if _detect_platform(input_data) == "zcode":
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "updatedInput": updated,
            }
        }
    else:
        output = {
            # Claude Code / Qoder / CodeBuddy / Droid format
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "updatedInput": updated,
            },
            # Cursor format
            "permission": "allow",
            "updated_input": updated,
            # Gemini format
            "updatedInput": updated,
        }

    print(json.dumps(output, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
````

### `.trellis\.developer`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：54 · SHA-256：`4E96FA888DF213B0F057A4E84555184785FD48906353589ABED14822C7B1522F`

````markdown
name=aixi
initialized_at=2026-09-25T20:34:28.882359
````

### `.trellis\.developer`

- 来自：`.backup-2026-09-25T13-20-05` · 字节：54 · SHA-256：`4E96FA888DF213B0F057A4E84555184785FD48906353589ABED14822C7B1522F`

````markdown
name=aixi
initialized_at=2026-09-25T20:34:28.882359
````

### `.trellis\.template-hashes.json`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：23641 · SHA-256：`DEA4081179C8933C39FF7D946C52C985E520A7BFD5E0FF8FB6E7856A11919983`

````markdown
{
  "__version": 2,
  "hashes": {
    ".agents/skills/trellis-continue/SKILL.md": "e6565b8b971c9fe169112210fe49322b23f2495216bb2fc12913a78978885963",
    ".agents/skills/trellis-finish-work/SKILL.md": "79e6d165358253a7379cae647bbd50b6bf174a1107f451b768a2bb4ba7cc0b87",
    ".agents/skills/trellis-start/SKILL.md": "ddcb643c43e967dc7e435cb815c9eb00ddab8913190d837d8b9504424f47a81a",
    ".agents/skills/trellis-before-dev/SKILL.md": "02a88bae9ee5c8d56e1cf278699dd713b6b081dd9fe919f66a9ada6040eb99e0",
    ".agents/skills/trellis-brainstorm/SKILL.md": "dfed2c1038dcf0720657c444b3ff8f3c8a6e4253d2c39a5166a8adcf55535e20",
    ".agents/skills/trellis-break-loop/SKILL.md": "f5a93699832f29dee443b53c135a7459519b371f689af191d15c29e8ee5c7bde",
    ".agents/skills/trellis-check/SKILL.md": "8971b14e130988197c788d5acff26830e099acaabdec5edea32083237a9714a8",
    ".agents/skills/trellis-update-spec/SKILL.md": "003ce08a3404aeb50998029392c4d4e57b626edf526d3ebd585032bb92dcbb96",
    ".agents/skills/trellis-channel/references/command-reference.md": "c4df3d940d89814310bfdaded20e84dd1d6b96786f6772688de7a123338d3c8e",
    ".agents/skills/trellis-channel/references/forum.md": "407db39e8ebde47cea8637e3069bdb3d76ba42b43ed1d08ba97a56f26dbcfcb4",
    ".agents/skills/trellis-channel/references/progress-debugging.md": "fe59afd4c0a558cbefc49cc5ef8a7e0e3916d6718cb3255dc6da1b698c850ff7",
    ".agents/skills/trellis-channel/references/workers.md": "d4481b2858bca82050cb8d131916da8a2ccc3857f199cdb9ced8bb41d592e2a7",
    ".agents/skills/trellis-channel/references/workflows.md": "0782d602efde6e94a7d7d7950fd605eedc9a1f5a523908284e76b628fd618fd4",
    ".agents/skills/trellis-channel/SKILL.md": "ff84801c511a736da018b4b1149348ebc9a16b7fc18d905ec10cfa7acbf269a3",
    ".agents/skills/trellis-meta/references/customize-local/add-project-local-conventions.md": "ef3380e71aa9f5103d37b467b1f725a8033ac516e4de31e4d790be02ec2c39e8",
    ".agents/skills/trellis-meta/references/customize-local/change-agents.md": "4216ac3cc570038fd8ce3319a85932bb537fea9e0a7f4d11fa315cfa645c9c85",
    ".agents/skills/trellis-meta/references/customize-local/change-context-loading.md": "e6aa7d938741c08b864f54e9bda8e4e68e04bc60cb46682f6acabaf37f9b2da2",
    ".agents/skills/trellis-meta/references/customize-local/change-hooks.md": "b3b1ed51cfa436a98fad8dda3ec75d997bd8f8cabbad04f101fd9e3d0e1a9e35",
    ".agents/skills/trellis-meta/references/customize-local/change-skills-or-commands.md": "5b942e9f512e049a75e8dd9e8cc4d49786f6da61b22afc82bb447acf808f9fe2",
    ".agents/skills/trellis-meta/references/customize-local/change-spec-structure.md": "1a712408217ee9cc6a916d874e3d6ed1ba7a3bdc1b9dc4bb1c64393f0df1eb98",
    ".agents/skills/trellis-meta/references/customize-local/change-task-lifecycle.md": "148b7442ef8106de907afd06f9d1ca96f7ec074caedced3dd4175b3a26698ca2",
    ".agents/skills/trellis-meta/references/customize-local/change-workflow.md": "43fa780a2ca580de121b10893d49b99f978873deebbf45008c466e5ac6651519",
    ".agents/skills/trellis-meta/references/customize-local/overview.md": "a0e4cbc3fcc521c0c0f481ade796d31d19c2a5ba697d93856c890fbcc6171d71",
    ".agents/skills/trellis-meta/references/local-architecture/bundled-skills.md": "aa6a0bf83060205ee4ea621c467fb900a7db06b4476a4ad472cc4e248c887389",
    ".agents/skills/trellis-meta/references/local-architecture/context-injection.md": "b1ebaac467bf0195e2a21f2f8492a8b7c91ff3e0f9312f853468cda0255df1c7",
    ".agents/skills/trellis-meta/references/local-architecture/generated-files.md": "7eb2d452eddb4f4226f7578c2ec6d5ee0434ed172ba4c36107cc8bdff7554dc6",
    ".agents/skills/trellis-meta/references/local-architecture/multi-agent-channel.md": "56e5070474aeca872e2d70c46feea5aaafecd3d3ec052c3f7b1877358dca62e9",
    ".agents/skills/trellis-meta/references/local-architecture/overview.md": "50638fd9eaaba2e0edf2f2a84d920578d5b2fb7934031b174e417d3dc510b2a6",
    ".agents/skills/trellis-meta/references/local-architecture/spec-system.md": "55f3c95033a3cbed6c06e225187071502d7dcf3f153f4becbec6aa79acc782f5",
    ".agents/skills/trellis-meta/references/local-architecture/task-system.md": "dba202340b5c6268925969a4bb628e26077d469bfc5dfb7913eec2402450ba72",
    ".agents/skills/trellis-meta/references/local-architecture/workflow.md": "cfcdc6e4468a5d9c816e929fcca01640cd41cfdaaa4824118b40a8e460c927b6",
    ".agents/skills/trellis-meta/references/local-architecture/workspace-memory.md": "79786a1ca2980b1785a36aba8142f9d879459c47dc000c999f638e5c864d04d3",
    ".agents/skills/trellis-meta/references/platform-files/agents.md": "d911602ab5f302a1499f164696b556c4d54f55be9f28b6eb9b7201941a9f490d",
    ".agents/skills/trellis-meta/references/platform-files/hooks-and-settings.md": "91e9855e418673bcd7770411e24e28390738b123532eef000beba0a29cf154e1",
    ".agents/skills/trellis-meta/references/platform-files/overview.md": "1aec9087ccedd56a213af877b5db474131aa4b4789b6ac0e8da73b058aa43bd4",
    ".agents/skills/trellis-meta/references/platform-files/platform-map.md": "3c0d4546461c06d1aaf006276e34e250e0ca7bbb5b853fb45c58114cebca4042",
    ".agents/skills/trellis-meta/references/platform-files/skills-and-commands.md": "e39831d860bd27a04e7757f7bd941ab83b3c5b11ad4460cec03975b655f26cc3",
    ".agents/skills/trellis-meta/SKILL.md": "ee7bcfd0023def62688339c4b63c50f2fbeea12a34eb89e8bb63a992b58cb168",
    ".agents/skills/trellis-session-insight/references/cli-quick-reference.md": "3f2dd664868f4b7f90b4800868bb34eaf8ed81246d1adaf5f4da34d1387765e3",
    ".agents/skills/trellis-session-insight/references/triggering-patterns.md": "121ecd23be83d1567e8ce15c366a81073d7a2b1d3ad616fce235c07ca1f1cc20",
    ".agents/skills/trellis-session-insight/SKILL.md": "c9e58477f71987750f025ee967ca6663ccbbede8a352506bc2f4232a356deb12",
    ".agents/skills/trellis-spec-bootstrap/references/mcp-setup.md": "df542fc8f279edd38046d26a7c8151804b708f57b24d4aa2733cea587a88c65e",
    ".agents/skills/trellis-spec-bootstrap/references/repository-analysis.md": "0dae98d774f6e34559b9f3442888ac43e3a8af110c37cbefc49ce256986858b6",
    ".agents/skills/trellis-spec-bootstrap/references/spec-task-planning.md": "ef493d028c3b0807a8a534bb71fb92a68129f273db763ad27ceb464a522e799d",
    ".agents/skills/trellis-spec-bootstrap/references/spec-writing.md": "e9800fe9ed4a4cd87062ea1829cf2caa8d170ec15e141678a6a30e74c497f47d",
    ".agents/skills/trellis-spec-bootstrap/SKILL.md": "97bfa68c06cebb558eb4464bc1b81f7d2d56040d75baa8de1ee5ad90cca0196a",
    ".codex/agents/trellis-check.toml": "206fd96a8aa17e95ed344cc435661d597093ece571671f298ca64490422fffe0",
    ".codex/agents/trellis-implement.toml": "388fb8f39797e0ee6cf4db447c859c79b4ac15f531f7e1e3c68c1d1d71a1c188",
    ".codex/agents/trellis-research.toml": "4435ce73197ba1d29d40359a3279b6423f7e4f559a449f934c016808090066c4",
    ".codex/hooks/session-start.py": "c02780474c6f2dc174b66a19150210c6a4ac60872256ff9546966a7fb31a287e",
    ".codex/hooks/inject-subagent-context.py": "a84240165c66a8891bf1d7eed06a3bcc26aefa219dc98db8192f3cb73c112c89",
    ".codex/hooks/inject-workflow-state.py": "71ef1aa1ed1051a697cae3c9ebffa518958a3bbd4d147434f382348829915f8c",
    ".codex/hooks.json": "c7c638e0982599b0692ad97bc835651c9fa83af5310be5d86a58c59132eb2dec",
    ".codex/config.toml": "9f2d20e28f0bc9c886312eca3ad3bba41533ef4615aaaafe25e98152302267bb",
    "AGENTS.md": "6cacfe99748b435d0660c2463c697bc323d53798aecf3492283ca8eac1b29682",
    ".trellis/agents/check.md": "edb4f57361407249a53bf5998ebf91c40d2b969e826a2c5e1b4e813a08bcb175",
    ".trellis/agents/implement.md": "66e25ad046c94869442834bc3cdfbd5a9a7412d3ff54561d64d2886552c27e87",
    ".trellis/config.yaml": "a966e6d374e9e6ff283cf761ccd99631323ee1754856cef51ad154ca0afb9dfa",
    ".trellis/scripts/add_session.py": "e2f46af58a6c8f651d45347467182bf622f0fd8c6cac9e0f36744393055ebb96",
    ".trellis/scripts/common/active_task.py": "f52715bbcc0677607055903e799674d7d50d6fcbab413a8f453c4e4efc954726",
    ".trellis/scripts/common/cli_adapter.py": "5d6bd9d6f5c631e7e792db7dd343351317f9643bc87b73a9a98abd51cefb4307",
    ".trellis/scripts/common/config.py": "9a042d6f0e25a33a567510760e87c1e389af14a41faf1daeb1190a00f3df7f5e",
    ".trellis/scripts/common/developer.py": "be6c0a37e80684441607f39bab0e8acbbd1e18da5f0849cf7e49beca309adc57",
    ".trellis/scripts/common/git.py": "5605b71662e524b47632030d9db9245121a5cba85b5521eeb524ed464d840ff5",
    ".trellis/scripts/common/git_context.py": "fa30ced454f1a91ffc9f8b2abeb32225e3447cbdc90bad783797374eba07265d",
    ".trellis/scripts/common/io.py": "041f5f05d6af020a910995d027bcaa14cded1e465957e29aed0e457ca19da837",
    ".trellis/scripts/common/log.py": "471df6895cfac80f995edebbf9974f6b7440634b7a688f28b8331c868bc0f3cf",
    ".trellis/scripts/common/packages_context.py": "efe158d7c99c2268851d0216fbb08de22836e418a8dbeb73575b8cc249eed7b7",
    ".trellis/scripts/common/paths.py": "d8586d4d3f9bb2dd46b7f11b0f038b5340d283f41b6fa2c76bb8235c13bbb0b7",
    ".trellis/scripts/common/safe_commit.py": "262ad740552279fe6ec6a2a9865b2965ce2448577cf973a4d702dfe2f5f91f04",
    ".trellis/scripts/common/session_context.py": "a6550aa11cb543f7195f66a1ab1f09572d1cf94be5505cfb23edd928ff2ba836",
    ".trellis/scripts/common/tasks.py": "87aca6b73ec4524450cfff8e2ae561b1f2e53bd62a185f036a7a2d484d90c8a2",
    ".trellis/scripts/common/task_context.py": "9a2c9f81a2c57b0bb6bb15065a44970a33a18f55411a32dc6a7634b83ad46e56",
    ".trellis/scripts/common/task_queue.py": "0be61f713462b1fe4574927c82fc4704e678afe72dcb9813543aedf2f9e9e0c5",
    ".trellis/scripts/common/task_store.py": "ef33b6326afb146543538420d1e7b714becc7a21f6e74e562c19618c7eda4230",
    ".trellis/scripts/common/task_utils.py": "35f544317a95e98d05fe089794071482175739e8c1f3b3b0228dae48602ffe90",
    ".trellis/scripts/common/trellis_config.py": "f1fc705ec463b0b9c163672dc9e50f10d29da967775a1900429205f7c4fcb51c",
    ".trellis/scripts/common/types.py": "9962081cc2608fb9d1deb32c6880e336f62cdca6b338e7ae813304701e155ee9",
    ".trellis/scripts/common/workflow_phase.py": "146b69c1ec0e628aeb720d3e34d8333f16050225037fe4233da9bbc4d4ac99c1",
    ".trellis/scripts/common/__init__.py": "f258cd873681dc5a4d71db0dd71d10fd78656de55bec96418d6702503c16e87d",
    ".trellis/scripts/get_context.py": "af3ea7cd563a453227cf2cb4ab04d667390046b7febfac2217348d0892781f4b",
    ".trellis/scripts/get_developer.py": "84c27076323c3e0f2c9c8ed16e8aa865e225d902a187c37e20ee1a46e7142d8f",
    ".trellis/scripts/hooks/linear_sync.py": "cfc270b7ff775caa5b2434823c45414a3b37f9ba2aa1e293a26daef9fd2e577a",
    ".trellis/scripts/init_developer.py": "0943f1c240993649ab89b91a2c5b379e84daa8c53b35f0490774bff05a552873",
    ".trellis/scripts/task.py": "7c2aa32f74fd645ed29b6c53d197fb512ba9f2e219f73c85ff6c368498d447f9",
    ".trellis/scripts/__init__.py": "1242be5b972094c2e141aecbe81a4efd478f6534e3d5e28306374e6a18fcf46c",
    ".trellis/workflow.md": "31e86b9b0a188efbdbcc4c82810bb5addf98bc5b2221272c8770e5cdfdb6fad2",
    ".trellis/.runtime/sessions/codex_01a053a0-6d28-79c3-9981-e3b85f029272.json": "479640c776a9dc86aa8886f1121b629ba5dd26fca6114a4f7af8524691b7a4f9",
    ".trellis/.runtime/sessions/codex_01a061cb-90ec-7c81-86ee-ec1a7a05384d.json": "f8f41dbc6dd5441307060100e88c7ce636b81fd3f75350581d859b7e5ef03a0d",
    ".trellis/scripts/common/convergence.py": "05d3d453c9ce3fb3e0dd9ab83b693123cdcee558d7e56c05c42bfa54e285fa9a",
    ".trellis/scripts/common/__pycache__/active_task.cpython-311.pyc": "b538cd7bafbf5dae350eab34a9b0f8d27eb0fdee58daa24e2c6244b51565246d",
    ".trellis/scripts/common/__pycache__/active_task.cpython-312.pyc": "a5faccc6a04a3752327248fa1a384b65c38858636967fb38b3ae1d14ffce113a",
    ".trellis/scripts/common/__pycache__/config.cpython-311.pyc": "d73c4c41e9d4ad49a4d71f762612649b1f37a191f62850c344d30e11223d7f44",
    ".trellis/scripts/common/__pycache__/config.cpython-312.pyc": "2a51742879d32dc58d0ddab7b62aadcbe3b7fc497e399c1c3438f9b925eecd7c",
    ".trellis/scripts/common/__pycache__/convergence.cpython-312.pyc": "c3ea47763ed65331db80c2332079be6891d6f760a83b4b6dab583d6d0cc0ed10",
    ".trellis/scripts/common/__pycache__/developer.cpython-311.pyc": "ec24d4e87c10b8fa01370a97676eb5894fddd2ca3ca6ffa80c5602096bd41616",
    ".trellis/scripts/common/__pycache__/developer.cpython-312.pyc": "06fd49a5e9084ce7cdff926dd351cb8802ea543115e5b43c7c1e8ddc084f3c31",
    ".trellis/scripts/common/__pycache__/git.cpython-311.pyc": "ab3a18d05004918afdb62328d6a52687c996c53068b6396b2881e8224c2e3fbb",
    ".trellis/scripts/common/__pycache__/git.cpython-312.pyc": "2ce1d7d176a9d1d1a03075e70e6fb794c979c51a18949f14fc47cb0a44d5518d",
    ".trellis/scripts/common/__pycache__/git_context.cpython-311.pyc": "e259c9e4ed50ca710b39c823b6bc15987e1fc1503cc0ca7b06bdcfd23ccc97fe",
    ".trellis/scripts/common/__pycache__/git_context.cpython-312.pyc": "2c59c4538ab89704a0e0fafa47c44d59f39121c99b09fbb3af6a183dcf50eca2",
    ".trellis/scripts/common/__pycache__/io.cpython-311.pyc": "c3bc566fe8023f94d98bf1b3b5842832e5ea0f1ebe57cfe3a1cae54051180e6b",
    ".trellis/scripts/common/__pycache__/io.cpython-312.pyc": "982b82834910bb010b00562548739d8e8045f064c9ea8f83abb6c869da83e782",
    ".trellis/scripts/common/__pycache__/log.cpython-311.pyc": "5b348dda704dc51ff55aa709b9bcf38957be2be3e58d8afe583872a45c4506fd",
    ".trellis/scripts/common/__pycache__/log.cpython-312.pyc": "38bd4ebaaeda79f7b41b7313a37d379b622fa7caa852e05b63cc80d8ce067627",
    ".trellis/scripts/common/__pycache__/packages_context.cpython-311.pyc": "1a084bcfa86ab0c31a7d73466ebd2caa37cb1a90ca3952292cab6d5b16eadd6e",
    ".trellis/scripts/common/__pycache__/packages_context.cpython-312.pyc": "6fd9d35a716c4bc3035a9bb6c38ead095e6ace032af385cde2538b97b39cd0d8",
    ".trellis/scripts/common/__pycache__/paths.cpython-311.pyc": "2c4f79a2f1f38d69b11d7659407713db0b9439bce4fe44e2061e512dd35da699",
    ".trellis/scripts/common/__pycache__/paths.cpython-312.pyc": "8f981897b9a3fb6d78ef025d94837a41a9d62e77e64e4c601e6d2ae64eeaed67",
    ".trellis/scripts/common/__pycache__/safe_commit.cpython-311.pyc": "5e1adbafc2909f280272746cc52579e53f7a2cb3f3988e6b2b80da4c4a911dc3",
    ".trellis/scripts/common/__pycache__/safe_commit.cpython-312.pyc": "b5aaf664f44ee187f1b67d141c66fe478501c4ceda665dcde632020fbf1c9a67",
    ".trellis/scripts/common/__pycache__/session_context.cpython-311.pyc": "05f36045c042aac105bdac89e1e561451b33e562015e74875889e883171959ee",
    ".trellis/scripts/common/__pycache__/session_context.cpython-312.pyc": "606a5ac93b52b6e5c1591fdd12ecaa1ad012a937d0007076c520f8c0d28a4395",
    ".trellis/scripts/common/__pycache__/tasks.cpython-311.pyc": "66642116505df967f000b11a5de6f629b43ac07b463639e3a3ec52971c4e5ffb",
    ".trellis/scripts/common/__pycache__/tasks.cpython-312.pyc": "ac10c0800eb34baaa9f1ed3f0934f072195ebad0993628c10934b628f5bc0133",
    ".trellis/scripts/common/__pycache__/task_context.cpython-311.pyc": "2c9bdc97c8572ba0d984411d0ffeb71f1defa1028296e9a30e3f83c85c69958c",
    ".trellis/scripts/common/__pycache__/task_context.cpython-312.pyc": "74307621be0c7ed13e3389ff82af95a8df7e816a8b25cc4788615e35d58e5320",
    ".trellis/scripts/common/__pycache__/task_store.cpython-311.pyc": "22914c9422f8ee350595956d159b1053c4d1273fdb432087f647c48ea04c0f92",
    ".trellis/scripts/common/__pycache__/task_store.cpython-312.pyc": "b9b4dafab71304dacf46cb964ae403c17ff2ce8e9ba3601bab75a2f559492483",
    ".trellis/scripts/common/__pycache__/task_utils.cpython-311.pyc": "13ea914e5a58a7f886b3227e96502c090608ebefdd104cd5ab478017f4a97ee2",
    ".trellis/scripts/common/__pycache__/task_utils.cpython-312.pyc": "74f6bd4a669d362025fadfd0b4bd4634248d2157d83e568f1f42027e249ec9de",
    ".trellis/scripts/common/__pycache__/trellis_config.cpython-311.pyc": "656f9e37795f7610c155fbaadfcbac2bbe4634ecb8017b53e395835952a1b172",
    ".trellis/scripts/common/__pycache__/trellis_config.cpython-312.pyc": "78a8c72fca572f6170c5ba25cf94fc72602d8ff74001fe9d5d62122019cb23db",
    ".trellis/scripts/common/__pycache__/types.cpython-311.pyc": "dff57fe83e76f0b316e8ef881172f03d50fe0ccae9cc3db027af85b80143aaed",
    ".trellis/scripts/common/__pycache__/types.cpython-312.pyc": "3abf020af8fa64242975bd7ced0ec90a9eba48bd86dd0a6b2a7ed4fa531493cf",
    ".trellis/scripts/common/__pycache__/workflow_phase.cpython-311.pyc": "641bbd94cf423050a798ab67c9697aa4bfa277d017c9d29905cb47aa5a929af2",
    ".trellis/scripts/common/__pycache__/workflow_phase.cpython-312.pyc": "5b98058a9301b441a4baa6e71c689c7e551fd78c271486e83c27fda1591cc5f1",
    ".trellis/scripts/common/__pycache__/__init__.cpython-311.pyc": "767411cbe9567d059c968e9be3fecaff50d34092dff5c263d0c66bb6a236293a",
    ".trellis/scripts/common/__pycache__/__init__.cpython-312.pyc": "a701b26c182296a29989ef2f7bd728a4303205b4bfdfe1615a6945bb9bdfe1fb",
    ".claude/agents/trellis-check.md": "9e48342243f311d55386f8fb42933945e87aba73d5ade547133aa98345a06128",
    ".claude/agents/trellis-implement.md": "73b56b3047c0e852382c4630aa181fb847d1e5ea1f63459dac4bf728f43fd097",
    ".claude/agents/trellis-research.md": "10aecdd3d0777746a516e23cd2a55c9e9c8a015dc98c63ffbac36be21b7a7bb0",
    ".claude/settings.json": "c9a2dfd351d7e340eeb04476cdca65abc24c343a904a85034c986558fa1fe222",
    ".claude/commands/trellis/continue.md": "a28eb1e2f407b44298bbab0c8a6ecdc910983c04b6bac891c92d0862e0d334ea",
    ".claude/commands/trellis/finish-work.md": "f11f661cff6d5d26dccb5e9574c3d2c7873a9dfaed7962d471ff5ea2fd48d691",
    ".claude/skills/trellis-before-dev/SKILL.md": "02a88bae9ee5c8d56e1cf278699dd713b6b081dd9fe919f66a9ada6040eb99e0",
    ".claude/skills/trellis-brainstorm/SKILL.md": "dfed2c1038dcf0720657c444b3ff8f3c8a6e4253d2c39a5166a8adcf55535e20",
    ".claude/skills/trellis-break-loop/SKILL.md": "f5a93699832f29dee443b53c135a7459519b371f689af191d15c29e8ee5c7bde",
    ".claude/skills/trellis-check/SKILL.md": "8971b14e130988197c788d5acff26830e099acaabdec5edea32083237a9714a8",
    ".claude/skills/trellis-update-spec/SKILL.md": "d975db7af166578488958751ae2c56edb827a68bddb569aa27acc3453f64e610",
    ".claude/skills/trellis-channel/references/command-reference.md": "c4df3d940d89814310bfdaded20e84dd1d6b96786f6772688de7a123338d3c8e",
    ".claude/skills/trellis-channel/references/forum.md": "407db39e8ebde47cea8637e3069bdb3d76ba42b43ed1d08ba97a56f26dbcfcb4",
    ".claude/skills/trellis-channel/references/progress-debugging.md": "fe59afd4c0a558cbefc49cc5ef8a7e0e3916d6718cb3255dc6da1b698c850ff7",
    ".claude/skills/trellis-channel/references/workers.md": "d4481b2858bca82050cb8d131916da8a2ccc3857f199cdb9ced8bb41d592e2a7",
    ".claude/skills/trellis-channel/references/workflows.md": "0782d602efde6e94a7d7d7950fd605eedc9a1f5a523908284e76b628fd618fd4",
    ".claude/skills/trellis-channel/SKILL.md": "ff84801c511a736da018b4b1149348ebc9a16b7fc18d905ec10cfa7acbf269a3",
    ".claude/skills/trellis-meta/references/customize-local/add-project-local-conventions.md": "ef3380e71aa9f5103d37b467b1f725a8033ac516e4de31e4d790be02ec2c39e8",
    ".claude/skills/trellis-meta/references/customize-local/change-agents.md": "4216ac3cc570038fd8ce3319a85932bb537fea9e0a7f4d11fa315cfa645c9c85",
    ".claude/skills/trellis-meta/references/customize-local/change-context-loading.md": "e6aa7d938741c08b864f54e9bda8e4e68e04bc60cb46682f6acabaf37f9b2da2",
    ".claude/skills/trellis-meta/references/customize-local/change-hooks.md": "b3b1ed51cfa436a98fad8dda3ec75d997bd8f8cabbad04f101fd9e3d0e1a9e35",
    ".claude/skills/trellis-meta/references/customize-local/change-skills-or-commands.md": "5b942e9f512e049a75e8dd9e8cc4d49786f6da61b22afc82bb447acf808f9fe2",
    ".claude/skills/trellis-meta/references/customize-local/change-spec-structure.md": "1a712408217ee9cc6a916d874e3d6ed1ba7a3bdc1b9dc4bb1c64393f0df1eb98",
    ".claude/skills/trellis-meta/references/customize-local/change-task-lifecycle.md": "148b7442ef8106de907afd06f9d1ca96f7ec074caedced3dd4175b3a26698ca2",
    ".claude/skills/trellis-meta/references/customize-local/change-workflow.md": "43fa780a2ca580de121b10893d49b99f978873deebbf45008c466e5ac6651519",
    ".claude/skills/trellis-meta/references/customize-local/overview.md": "a0e4cbc3fcc521c0c0f481ade796d31d19c2a5ba697d93856c890fbcc6171d71",
    ".claude/skills/trellis-meta/references/local-architecture/bundled-skills.md": "aa6a0bf83060205ee4ea621c467fb900a7db06b4476a4ad472cc4e248c887389",
    ".claude/skills/trellis-meta/references/local-architecture/context-injection.md": "b1ebaac467bf0195e2a21f2f8492a8b7c91ff3e0f9312f853468cda0255df1c7",
    ".claude/skills/trellis-meta/references/local-architecture/generated-files.md": "7eb2d452eddb4f4226f7578c2ec6d5ee0434ed172ba4c36107cc8bdff7554dc6",
    ".claude/skills/trellis-meta/references/local-architecture/multi-agent-channel.md": "56e5070474aeca872e2d70c46feea5aaafecd3d3ec052c3f7b1877358dca62e9",
    ".claude/skills/trellis-meta/references/local-architecture/overview.md": "50638fd9eaaba2e0edf2f2a84d920578d5b2fb7934031b174e417d3dc510b2a6",
    ".claude/skills/trellis-meta/references/local-architecture/spec-system.md": "55f3c95033a3cbed6c06e225187071502d7dcf3f153f4becbec6aa79acc782f5",
    ".claude/skills/trellis-meta/references/local-architecture/task-system.md": "dba202340b5c6268925969a4bb628e26077d469bfc5dfb7913eec2402450ba72",
    ".claude/skills/trellis-meta/references/local-architecture/workflow.md": "cfcdc6e4468a5d9c816e929fcca01640cd41cfdaaa4824118b40a8e460c927b6",
    ".claude/skills/trellis-meta/references/local-architecture/workspace-memory.md": "79786a1ca2980b1785a36aba8142f9d879459c47dc000c999f638e5c864d04d3",
    ".claude/skills/trellis-meta/references/platform-files/agents.md": "d911602ab5f302a1499f164696b556c4d54f55be9f28b6eb9b7201941a9f490d",
    ".claude/skills/trellis-meta/references/platform-files/hooks-and-settings.md": "91e9855e418673bcd7770411e24e28390738b123532eef000beba0a29cf154e1",
    ".claude/skills/trellis-meta/references/platform-files/overview.md": "1aec9087ccedd56a213af877b5db474131aa4b4789b6ac0e8da73b058aa43bd4",
    ".claude/skills/trellis-meta/references/platform-files/platform-map.md": "3c0d4546461c06d1aaf006276e34e250e0ca7bbb5b853fb45c58114cebca4042",
    ".claude/skills/trellis-meta/references/platform-files/skills-and-commands.md": "e39831d860bd27a04e7757f7bd941ab83b3c5b11ad4460cec03975b655f26cc3",
    ".claude/skills/trellis-meta/SKILL.md": "ee7bcfd0023def62688339c4b63c50f2fbeea12a34eb89e8bb63a992b58cb168",
    ".claude/skills/trellis-session-insight/references/cli-quick-reference.md": "c520353fe3fc00b9702ed4f780647c8fbd6d342e66527a03647f533a9fe09779",
    ".claude/skills/trellis-session-insight/references/triggering-patterns.md": "121ecd23be83d1567e8ce15c366a81073d7a2b1d3ad616fce235c07ca1f1cc20",
    ".claude/skills/trellis-session-insight/SKILL.md": "d20f1d20c6946e26ba6f848b9a016d9a16c803d87501462e5b11a2ced6f56643",
    ".claude/skills/trellis-spec-bootstrap/references/mcp-setup.md": "df542fc8f279edd38046d26a7c8151804b708f57b24d4aa2733cea587a88c65e",
    ".claude/skills/trellis-spec-bootstrap/references/repository-analysis.md": "0dae98d774f6e34559b9f3442888ac43e3a8af110c37cbefc49ce256986858b6",
    ".claude/skills/trellis-spec-bootstrap/references/spec-task-planning.md": "ef493d028c3b0807a8a534bb71fb92a68129f273db763ad27ceb464a522e799d",
    ".claude/skills/trellis-spec-bootstrap/references/spec-writing.md": "e9800fe9ed4a4cd87062ea1829cf2caa8d170ec15e141678a6a30e74c497f47d",
    ".claude/skills/trellis-spec-bootstrap/SKILL.md": "97bfa68c06cebb558eb4464bc1b81f7d2d56040d75baa8de1ee5ad90cca0196a",
    ".claude/hooks/inject-subagent-context.py": "f91b89c55dd74dbd9359fba3b8e2eb63d1370ad97c1a36d3b736ac15a6fa949f",
    ".claude/hooks/inject-workflow-state.py": "71ef1aa1ed1051a697cae3c9ebffa518958a3bbd4d147434f382348829915f8c",
    ".claude/hooks/session-start.py": "e6fe97ea392cb3cf150f5924dda3b2209d77c35578d6e45cb14c4877a502e010"
  }
}
````

### `.trellis\.version`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：6 · SHA-256：`D8AF8F3B3CF781075792BF662BA3A2D6D81DEF4B88D9E3B5160D6C99675EBDB6`

````markdown
0.6.17
````

### `.trellis\scripts\common\task_store.py`

- 来自：`.backup-2026-09-25T13-20-12` · 字节：76058 · SHA-256：`EF33B6326AFB146543538420D1E7B714BECC7A21F6E74E562C19618C7EDA4230`

````markdown
#!/usr/bin/env python3
"""
Task CRUD operations.

Provides:
    ensure_tasks_dir   - Ensure tasks directory exists
    cmd_create         - Create a new task
    cmd_rename         - Rename a task and every reference to it
    cmd_archive        - Archive completed task
    cmd_set_branch     - Set git branch for task
    cmd_set_base_branch - Set PR target branch
    cmd_set_scope      - Set scope for PR title
    cmd_set_meta       - Set/overwrite a task metadata key
    cmd_add_subtask    - Link child task to parent
    cmd_remove_subtask - Unlink child task from parent
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .config import (
    get_codex_dispatch_mode,
    get_packages,
    get_session_auto_commit,
    is_monorepo,
    resolve_package,
    validate_package,
)
from .git import (
    INDEX_LOCK_RETRY_ATTEMPTS,
    branch_exists_locally,
    has_git_remote,
    index_lock_path,
    resolve_default_branch,
    run_git,
    run_git_retry_index_lock,
    stderr_indicates_index_lock,
)
from .io import describe_json_read_failure, read_json_checked, write_json
from .log import Colors, colored
from .paths import (
    DEVELOPER_HINT,
    DIR_ARCHIVE,
    DIR_TASKS,
    DIR_WORKFLOW,
    FILE_TASK_JSON,
    generate_task_date_prefix,
    get_developer,
    get_repo_root,
    get_tasks_dir,
)
from .safe_commit import (
    print_gitignore_warning,
    safe_archive_paths_to_add,
    safe_git_add,
)
from .task_utils import (
    archive_destination_for,
    archive_task_complete,
    find_task_by_name,
    is_within_tasks_dir,
    resolve_task_dir,
    run_task_hooks,
)


# =============================================================================
# Helper Functions
# =============================================================================

# Characters stripped before deciding whether a title / description is empty.
# This is deliberately the *union* of Python's str.strip() default set and
# ECMAScript's String.trim() set, because the two disagree: Python strips
# U+0085 (NEL) and U+001C-U+001F, which JS keeps; JS strips U+FEFF (BOM),
# which Python keeps. Stripping the union means anything create accepts is
# still non-empty after either side trims it, so a record cannot pass here and
# then be refused as empty by a JS pre-archive validator.
BLANK_CHARS = (
    "\t\n\v\f\r"                              # U+0009-U+000D
    "\x1c\x1d\x1e\x1f"                        # U+001C-U+001F separators (Python only)
    " "                                       # U+0020 space
    "\x85"                                    # U+0085 next line (Python only)
    "\xa0"                                    # U+00A0 no-break space
    "\u1680"                                  # ogham space mark
    "\u2000\u2001\u2002\u2003\u2004\u2005"    # en/em quad, en/em/three/four-per-em
    "\u2006\u2007\u2008\u2009\u200a"          # six-per-em .. hair space
    "\u2028\u2029"                            # line / paragraph separator
    "\u202f\u205f\u3000"                      # narrow nbsp, math space, ideographic space
    "\ufeff"                                  # zero-width no-break space / BOM (JS only)
)


def strip_blank(value: str | None) -> str:
    """Return ``value`` with :data:`BLANK_CHARS` trimmed from both ends."""
    return (value or "").strip(BLANK_CHARS)


def _slugify(title: str) -> str:
    """Convert title to slug (only works with ASCII)."""
    result = title.lower()
    result = re.sub(r"[^a-z0-9]", "-", result)
    result = re.sub(r"-+", "-", result)
    result = result.strip("-")
    return result


def ensure_tasks_dir(repo_root: Path) -> Path:
    """Ensure tasks directory exists."""
    tasks_dir = get_tasks_dir(repo_root)
    archive_dir = tasks_dir / "archive"

    if not tasks_dir.exists():
        tasks_dir.mkdir(parents=True)
        print(colored(f"Created tasks directory: {tasks_dir}", Colors.GREEN), file=sys.stderr)

    if not archive_dir.exists():
        archive_dir.mkdir(parents=True)

    return tasks_dir


def _find_archived_task_by_dir_name(tasks_dir: Path, dir_name: str) -> Path | None:
    """Find an archived task directory with the exact active-task dir name."""
    archive_dir = tasks_dir / DIR_ARCHIVE
    if not archive_dir.is_dir():
        return None

    for month_dir in sorted(archive_dir.iterdir()):
        if not month_dir.is_dir():
            continue
        candidate = month_dir / dir_name
        if candidate.is_dir():
            return candidate

    return None


def _repo_relative_path(path: Path, repo_root: Path) -> str:
    """Format a path relative to the repo root when possible."""
    try:
        return path.relative_to(repo_root).as_posix()
    except ValueError:
        return str(path)


def _report_read_failure(path: Path, reason: str | None) -> None:
    """Print why a JSON file could not be loaded, and what to do about it.

    These commands are about to rewrite the file they just failed to read, so
    this message is the last warning the user gets. Exiting non-zero with no
    output at all leaves a parse error, a permissions error and an empty file
    indistinguishable.
    """
    problem, hint = describe_json_read_failure(path, reason)
    print(colored(f"Error: {problem}", Colors.RED), file=sys.stderr)
    print(hint, file=sys.stderr)


def _ensure_children_list(data: dict) -> list:
    """The task's `children` as a list, repaired in place if it is not one.

    `.get(key, default)` returns the default only when the key is *absent*. A
    task.json carrying `"children": null` — older format, or hand-edited —
    yields None, and every caller below goes on to use the result as a list.
    In `cmd_create` that raise lands *after* the new task.json is written,
    leaving a task on disk its parent does not reference.

    The repair is written into `data` rather than only returned, because the
    unlink path removes a name it may not find and would otherwise persist the
    malformed value untouched — no crash, but the next caller inherits it.

    Anything that is not a list is discarded rather than coerced: a string
    would iterate per character and a dict per key, each producing a plausible
    child set that is not one.
    """
    children = data.get("children")
    if not isinstance(children, list):
        children = []
        data["children"] = children
    return children


def _report_write_failure(path: Path) -> None:
    """Print that a JSON write failed. Writes are atomic, so nothing changed."""
    print(colored(f"Error: Failed to write {path}", Colors.RED), file=sys.stderr)
    print(
        "The existing file is unchanged (writes are atomic). "
        "Check permissions and free disk space, then retry.",
        file=sys.stderr,
    )


def _restore_child_links(unlinked: dict[Path, str | None]) -> None:
    """Put back the parent links this archive attempt already removed.

    The unlink loop below walks a parent's children one at a time, so a
    failure part-way through leaves the earlier children carrying
    ``parent: null`` while their parent is still in the active tree. That is
    the mirror image of the dangling reference the same loop already refuses
    to create, and nothing repairs it later either, so undo it before the
    failure is reported.

    Restoring is best-effort: if a child cannot be written back, name it so
    the caller can re-link it by hand instead of guessing which one broke.
    """
    broken: list[str] = []
    for child_json, original_parent in unlinked.items():
        child_data, _ = read_json_checked(child_json)
        if child_data is None:
            broken.append(child_json.parent.name)
            continue
        child_data["parent"] = original_parent
        if not write_json(child_json, child_data):
            broken.append(child_json.parent.name)
    if broken:
        print(
            colored(
                f"Warning: could not restore the parent link on: {', '.join(broken)}. "
                "Re-link each one with `python .trellis/scripts/task.py "
                "add-subtask <parent> <child>`.",
                Colors.RED,
            ),
            file=sys.stderr,
        )


# =============================================================================
# Sub-agent platform detection + JSONL context files
# =============================================================================

# Config directories of platforms that consume implement.jsonl / check.jsonl.
# Keep in sync with src/types/ai-tools.ts AI_TOOLS entries — these are the
# platforms listed in workflow.md's "agent-capable" Skill Routing block.
# Codex is checked separately because explicit inline mode does not consume
# JSONL. Kilo / Antigravity / Devin are NOT in this list either: they load
# specs through skills instead of JSONL.
_SUBAGENT_CONFIG_DIRS: tuple[str, ...] = (
    ".claude",
    ".cursor",
    ".kiro",
    ".gemini",
    ".opencode",
    ".qoder",
    ".codebuddy",
    ".factory",   # Factory Droid
    ".github/copilot",
    ".pi",        # Pi Agent
    ".trae",      # Trae IDE
    ".omp",       # Oh My Pi
    ".zcode",     # ZCode
    ".grok",      # Grok Build
    ".kimi-code", # Kimi Code
)
_CODEX_CONFIG_DIR = ".codex"


def _has_subagent_platform(repo_root: Path) -> bool:
    """Return True if any sub-agent-capable platform is configured.

    Detected by probing well-known config directories at the repo root. Codex
    counts by default through ``codex.dispatch_mode: auto`` (including the
    legacy ``sub-agent`` alias); explicit inline mode loads context through
    skills, not JSONL.
    """
    for config_dir in _SUBAGENT_CONFIG_DIRS:
        if (repo_root / config_dir).is_dir():
            return True
    if (repo_root / _CODEX_CONFIG_DIR).is_dir():
        return get_codex_dispatch_mode(repo_root) == "auto"
    return False


def _parse_meta_pairs(pairs: list[str] | None) -> dict[str, str] | None:
    """Parse repeatable ``--meta key=value`` pairs into a dict.

    Returns ``None`` (after printing an error naming the bad value) on the
    first malformed pair: missing ``=`` or an empty key. Values are stored
    as-is (strings, no nesting, no type coercion).
    """
    meta: dict[str, str] = {}
    for pair in pairs or []:
        key, sep, value = pair.partition("=")
        if not sep or not key:
            print(
                colored(f"Error: malformed --meta value '{pair}' (expected key=value)", Colors.RED),
                file=sys.stderr,
            )
            return None
        meta[key] = value
    return meta


def _default_prd_content(title: str, description: str | None = None) -> str:
    """Return the default PRD skeleton created with every task."""
    goal = (description or "").strip() or "TBD."
    heading = title.strip() or "Untitled task"
    return f"""# {heading}

## Goal

{goal}

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
"""


# =============================================================================
# Command: create
# =============================================================================

def cmd_create(args: argparse.Namespace) -> int:
    """Create a new task."""
    repo_root = get_repo_root()

    # Title and description are checked first, before ensure_tasks_dir and any
    # other write, so a rejected create leaves the tree untouched. Both are
    # required non-empty by pre-archive validation; catching that here costs
    # one retyped command instead of blocking a PR hours later.
    if not strip_blank(args.title):
        print(colored("Error: title is required", Colors.RED), file=sys.stderr)
        print(
            'Pass a non-empty <title> (whitespace only does not count): a task '
            "with an empty title is refused at archive.",
            file=sys.stderr,
        )
        return 1

    description = strip_blank(getattr(args, "description", None))
    if not description:
        print(colored("Error: --description is required", Colors.RED), file=sys.stderr)
        print(
            'Pass --description "<what this task delivers>" (whitespace only does '
            "not count): a task with an empty description is refused at archive.",
            file=sys.stderr,
        )
        return 1

    # Validate --meta (CLI source: fail-fast, before any directory is created)
    meta = _parse_meta_pairs(getattr(args, "meta", None))
    if meta is None:
        return 1

    # Validate --package (CLI source: fail-fast)
    package: str | None = getattr(args, "package", None)
    if not is_monorepo(repo_root):
        # Single-repo: ignore --package, no package prefix
        if package:
            print(colored(f"Warning: --package ignored in single-repo project", Colors.YELLOW), file=sys.stderr)
        package = None
    elif package:
        if not validate_package(package, repo_root):
            packages = get_packages(repo_root)
            available = ", ".join(sorted(packages.keys())) if packages else "(none)"
            print(colored(f"Error: unknown package '{package}'. Available: {available}", Colors.RED), file=sys.stderr)
            return 1
    else:
        # Inferred: default_package → None (no task.json yet for create)
        package = resolve_package(repo_root=repo_root)

    # Default assignee to current developer
    assignee = args.assignee
    if not assignee:
        assignee = get_developer(repo_root)
        if not assignee:
            print(colored("Error: No developer set. Run init_developer.py first or use --assignee", Colors.RED), file=sys.stderr)
            print(DEVELOPER_HINT, file=sys.stderr)
            return 1

    ensure_tasks_dir(repo_root)

    # Get current developer as creator
    creator = get_developer(repo_root) or assignee

    # Generate slug if not provided. A title-derived slug is sanitized by
    # _slugify; an explicit --slug is not, so reject the characters that would
    # let it escape the tasks directory once joined into the dir name.
    slug = args.slug or _slugify(args.title)
    if not slug:
        print(colored("Error: could not generate slug from title", Colors.RED), file=sys.stderr)
        return 1

    if args.slug and ("/" in slug or "\\" in slug or ".." in slug):
        print(
            colored(
                f"Error: --slug must be a plain name without path separators or '..': {slug}",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return 1

    # Create task directory with MM-DD-slug format
    tasks_dir = get_tasks_dir(repo_root)
    date_prefix = generate_task_date_prefix()

    # Guard against date-prefixed --slug (e.g. a full task dir name pasted in),
    # which would otherwise produce MM-DD-MM-DD-slug (issue #377). Only an
    # explicit --slug is guarded; title-derived slugs are left untouched.
    if args.slug:
        m = re.match(r"^(\d{2})-(\d{2})-(.+)$", slug)
        if m and 1 <= int(m.group(1)) <= 12 and 1 <= int(m.group(2)) <= 31:
            slug_prefix = f"{m.group(1)}-{m.group(2)}"
            if slug_prefix == date_prefix:
                slug = m.group(3)
                print(
                    colored(
                        f'warning: --slug should not include the MM-DD prefix; normalized to "{slug}"',
                        Colors.YELLOW,
                    ),
                    file=sys.stderr,
                )
            else:
                print(
                    colored(
                        f"Error: --slug starts with a date prefix ({slug_prefix}-), but task.py create always uses today's date ({date_prefix}).",
                        Colors.RED,
                    ),
                    file=sys.stderr,
                )
                print(f"Pass only the slug body, e.g. --slug {m.group(3)}", file=sys.stderr)
                return 1

    # Resolve --parent before anything is created. An explicit --parent that
    # cannot be linked is a failed request, not a warning: creating the task
    # anyway leaves a half-specified relationship that reads as success.
    parent_dir: Path | None = None
    parent_data: dict | None = None
    if args.parent:
        parent_dir = resolve_task_dir(args.parent, repo_root)
        if parent_dir is None:
            print(colored(f"Error: Parent task not resolved: {args.parent}", Colors.RED), file=sys.stderr)
            print("No task was created. Pass an existing task directory to --parent.", file=sys.stderr)
            return 1
        parent_json_path = parent_dir / FILE_TASK_JSON
        if not parent_json_path.is_file():
            print(colored(f"Error: Parent task.json not found: {args.parent}", Colors.RED), file=sys.stderr)
            print("No task was created. Pass an existing task directory to --parent.", file=sys.stderr)
            return 1
        parent_data, parent_reason = read_json_checked(parent_json_path)
        if parent_data is None:
            _report_read_failure(parent_json_path, parent_reason)
            print("No task was created. Fix the parent task.json, then retry.", file=sys.stderr)
            return 1

    dir_name = f"{date_prefix}-{slug}"
    task_dir = tasks_dir / dir_name
    task_json_path = task_dir / FILE_TASK_JSON

    archived_task_dir = _find_archived_task_by_dir_name(tasks_dir, dir_name)
    if archived_task_dir:
        print(colored(f"Error: Task already archived: {dir_name}", Colors.RED), file=sys.stderr)
        print(f"Archived at: {_repo_relative_path(archived_task_dir, repo_root)}", file=sys.stderr)
        print("Use a new slug if you intend to create a new task.", file=sys.stderr)
        return 1

    # Reusing a slug on the same day is an ordinary accident, and continuing
    # would rewrite the existing task.json below — resetting status, children,
    # parent, branch and meta, which nothing else can reconstruct. Fail like
    # the archived-name collision above unless the caller asks for it.
    if task_dir.exists():
        if not getattr(args, "force", False):
            print(colored(f"Error: Task already exists: {dir_name}", Colors.RED), file=sys.stderr)
            print(f"Existing task at: {_repo_relative_path(task_dir, repo_root)}", file=sys.stderr)
            print(
                "Use a different --slug, or pass --force to overwrite its task.json.",
                file=sys.stderr,
            )
            return 1
        print(
            colored(
                f"Warning: --force: overwriting task.json in existing task: {dir_name}",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
        created_dir = False
    else:
        task_dir.mkdir(parents=True)
        created_dir = True

    today = datetime.now().strftime("%Y-%m-%d")

    # Record the PR target branch. Prefer the repo's actual default branch
    # (origin/HEAD) so creating a task from a feature branch doesn't
    # mis-stamp that feature branch as the PR target (#399 item 1). Falls
    # back to the checked-out branch when the default can't be resolved
    # (no remote configured, offline, etc.) — the pre-existing behavior.
    # --base-branch lets the caller override both when neither is correct.
    _, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
    current_branch = branch_out.strip() or "main"
    explicit_base_branch: str | None = getattr(args, "base_branch", None)
    if explicit_base_branch:
        base_branch = explicit_base_branch
    else:
        resolved_base_branch = resolve_default_branch(repo_root)
        if resolved_base_branch:
            base_branch = resolved_base_branch
        else:
            base_branch = current_branch
            print(
                colored(
                    f"warning: could not resolve the repository's default branch "
                    f"(no remote configured, offline, etc.); stamping base_branch as "
                    f"the checked-out branch '{base_branch}'. Pass --base-branch to override.",
                    Colors.YELLOW,
                ),
                file=sys.stderr,
            )

    task_data = {
        "id": slug,
        "name": slug,
        "title": args.title,
        "description": description,
        "status": "planning",
        "dev_type": None,
        "scope": None,
        "package": package,
        "priority": args.priority,
        "creator": creator,
        "assignee": assignee,
        "createdAt": today,
        "completedAt": None,
        "branch": None,
        "base_branch": base_branch,
        "worktree_path": None,
        "commit": None,
        "pr_url": None,
        "subtasks": [],
        "children": [],
        "parent": None,
        "relatedFiles": [],
        "notes": "",
        "meta": meta,
    }

    # A directory without task.json is not a task: `list` hides it and every
    # lifecycle command refuses it. Fail here rather than printing "Created
    # task" and emitting the path for script chaining.
    if not write_json(task_json_path, task_data):
        _report_write_failure(task_json_path)
        print(colored(f"No task was created: {dir_name}", Colors.RED), file=sys.stderr)
        if created_dir:
            try:
                task_dir.rmdir()
            except OSError:
                print(
                    f"Leftover empty directory: {_repo_relative_path(task_dir, repo_root)}",
                    file=sys.stderr,
                )
        return 1

    prd_path = task_dir / "prd.md"
    if not prd_path.exists():
        prd_path.write_text(
            _default_prd_content(args.title, description),
            encoding="utf-8",
        )

    # Create empty implement.jsonl / check.jsonl for sub-agent-capable
    # platforms. They stay empty until the agent curates real entries during
    # planning — a placeholder row would read as unresolved scaffolding to
    # `task.py validate` and to PR preflight, so the curation instructions go
    # to the console below instead of into the files. Agent-less platforms
    # (Kilo / Antigravity / Devin) skip this — they load specs via the
    # trellis-before-dev skill instead of JSONL.
    created_jsonl = False
    if _has_subagent_platform(repo_root):
        for jsonl_name in ("implement.jsonl", "check.jsonl"):
            jsonl_path = task_dir / jsonl_name
            if not jsonl_path.exists():
                jsonl_path.write_text("", encoding="utf-8")
        created_jsonl = True

    # Establish the bidirectional link. Both sides were validated above, so a
    # failure here is a write failure, not a bad argument.
    if parent_dir is not None and parent_data is not None:
        parent_json_path = parent_dir / FILE_TASK_JSON

        # Add child to parent's children list
        parent_children = _ensure_children_list(parent_data)
        if dir_name not in parent_children:
            parent_children.append(dir_name)
            parent_data["children"] = parent_children
            if not write_json(parent_json_path, parent_data):
                _report_write_failure(parent_json_path)
                print(
                    f"The task exists at {_repo_relative_path(task_dir, repo_root)} but is NOT "
                    f"linked to {parent_dir.name}. Re-link with: task.py add-subtask "
                    f"{parent_dir.name} {dir_name}",
                    file=sys.stderr,
                )
                return 1

        # Set parent in child's task.json
        task_data["parent"] = parent_dir.name
        if not write_json(task_json_path, task_data):
            _report_write_failure(task_json_path)
            print(
                f"Link is half-written: {parent_dir.name} now lists '{dir_name}' as a child, "
                f"but the new task does not record its parent.",
                file=sys.stderr,
            )
            return 1

        print(colored(f"Linked as child of: {parent_dir.name}", Colors.GREEN), file=sys.stderr)

    # Auto-activate the new task so the per-turn breadcrumb fires planning
    # state. Best-effort: gracefully degrade if no session identity (CLI run
    # outside an AI session) — the task is still created, the user can run
    # task.py start later. Pointer is session-scoped so this never affects
    # other AI sessions.
    if getattr(args, "no_start", False):
        print(
            colored(
                "Skipped session activation (--no-start); run task.py start when ready.",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
    else:
        try:
            from .active_task import resolve_context_key, set_active_task
        except Exception as exc:
            print(
                colored(f"Warning: session activation unavailable (import failed: {exc})", Colors.YELLOW),
                file=sys.stderr,
            )
        else:
            try:
                context_key = resolve_context_key()
            except Exception as exc:
                print(
                    colored(f"Warning: session activation failed (context resolution: {exc})", Colors.YELLOW),
                    file=sys.stderr,
                )
            else:
                # No session identity is the normal CLI-outside-an-AI-session
                # case (see comment above) — stay silent, not a failure.
                if context_key:
                    try:
                        rel_dir = task_dir.relative_to(repo_root).as_posix()
                    except ValueError:
                        rel_dir = str(task_dir)
                    try:
                        active = set_active_task(rel_dir, repo_root)
                    except Exception as exc:
                        print(
                            colored(f"Warning: session activation failed (pointer persistence: {exc})", Colors.YELLOW),
                            file=sys.stderr,
                        )
                    else:
                        if active:
                            print(
                                colored(f"Activated task for this session: {active.task_path}", Colors.GREEN),
                                file=sys.stderr,
                            )
                            print(f"Source: {active.source}", file=sys.stderr)
                        else:
                            print(
                                colored("Warning: session activation failed (no pointer returned)", Colors.YELLOW),
                                file=sys.stderr,
                            )

    print(colored(f"Created task: {dir_name}", Colors.GREEN), file=sys.stderr)
    print("", file=sys.stderr)
    print(colored("Next steps:", Colors.BLUE), file=sys.stderr)
    print("  - Fill prd.md with requirements and acceptance criteria", file=sys.stderr)
    print("  - Lightweight task: PRD-only is valid", file=sys.stderr)
    print("  - Complex task: add design.md and implement.md before task.py start", file=sys.stderr)
    if created_jsonl:
        print(
            "  - Curate implement.jsonl / check.jsonl (created empty) as spec/research "
            "manifests before task.py start when sub-agents need context:",
            file=sys.stderr,
        )
        print(
            '      one JSON object per line — {"file": "<path>", "reason": "<why>"}; '
            "spec/research docs only, no code paths",
            file=sys.stderr,
        )
        print(
            "      list available specs: python .trellis/scripts/get_context.py --mode packages",
            file=sys.stderr,
        )
    print("  - Use /trellis:continue or phase context to decide the next step", file=sys.stderr)
    print("", file=sys.stderr)

    # Output relative path for script chaining
    print(f"{DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}")

    run_task_hooks("after_create", task_json_path, repo_root)
    return 0


# =============================================================================
# Command: rename
# =============================================================================

# task.json fields that carry the task's own slug. The directory name carries
# it too, prefixed with the creation date; everything else that names the task
# (parent / children / subtasks in *other* tasks, jsonl paths) stores the full
# directory name instead.
RENAME_IDENTITY_FIELDS: tuple[str, ...] = ("id", "name")

_JSONL_NAMES: tuple[str, ...] = ("implement.jsonl", "check.jsonl")


@dataclass
class _RenamePlan:
    """Every change a rename would make, computed before anything is written.

    ``--dry-run`` and the real run render their output from this one structure,
    so the printed change set cannot drift from the applied one.
    """

    task_dir: Path
    new_dir: Path
    old_name: str
    new_name: str
    old_rel: str
    new_rel: str
    task_json_path: Path
    task_data: dict
    # (field, current value, new value) for each identity field that changes.
    identity: list[tuple[str, object, str]] = field(default_factory=list)
    # (jsonl path, changed line numbers, full new file text)
    jsonl: list[tuple[Path, list[int], str]] = field(default_factory=list)
    # (other task's task.json, rewritten data, labels of the changed refs)
    backrefs: list[tuple[Path, dict, list[str]]] = field(default_factory=list)
    # (file, line number) of old-name mentions elsewhere under .trellis/
    reported: list[tuple[Path, int]] = field(default_factory=list)
    # Task dirs whose task.json could not be read, so back-refs in them are
    # neither rewritten nor ruled out.
    unreadable: list[Path] = field(default_factory=list)


def _split_date_prefix(dir_name: str) -> tuple[str, str]:
    """Split ``MM-DD-slug`` into ``("MM-DD", "slug")``.

    Returns ``("", dir_name)`` when there is no plausible date prefix, so a
    hand-made directory name without one is renamed to the bare slug.
    """
    m = re.match(r"^(\d{2})-(\d{2})-(.+)$", dir_name)
    if m and 1 <= int(m.group(1)) <= 12 and 1 <= int(m.group(2)) <= 31:
        return f"{m.group(1)}-{m.group(2)}", m.group(3)
    return "", dir_name


def _validate_rename_slug(slug: str, date_prefix: str) -> str | None:
    """Return the slug body to rename to, or None after reporting the refusal.

    Mirrors ``create``'s ``--slug`` handling: no path separators or ``..`` (the
    slug is joined into a directory name), and a pasted-in date prefix is
    normalized away rather than doubled — but a rename keeps the task's
    *original* creation date, not today's.
    """
    if not slug:
        print(colored("Error: new slug is required", Colors.RED), file=sys.stderr)
        return None

    if "/" in slug or "\\" in slug or ".." in slug:
        print(
            colored(
                f"Error: <new-slug> must be a plain name without path separators or '..': {slug}",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return None

    slug_prefix, body = _split_date_prefix(slug)
    if not slug_prefix:
        return slug
    if slug_prefix == date_prefix:
        print(
            colored(
                f'warning: <new-slug> should not include the MM-DD prefix; normalized to "{body}"',
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
        return body
    print(
        colored(
            f"Error: <new-slug> starts with a date prefix ({slug_prefix}-), but rename keeps "
            f"the task's own creation date ({date_prefix}).",
            Colors.RED,
        ),
        file=sys.stderr,
    )
    print(f"Pass only the slug body, e.g. {body}", file=sys.stderr)
    return None


def _plan_jsonl_rewrites(
    task_dir: Path, old_rel: str, new_rel: str
) -> list[tuple[Path, list[int], str]]:
    """Plan rewrites of context entries pointing under the old task directory.

    Matching on ``<old path>/`` rather than the bare path keeps a sibling task
    whose name merely starts with this one's out of the rewrite.
    """
    rewrites: list[tuple[Path, list[int], str]] = []
    needle = f"{old_rel}/"
    replacement = f"{new_rel}/"

    for jsonl_name in _JSONL_NAMES:
        jsonl_path = task_dir / jsonl_name
        if not jsonl_path.is_file():
            continue
        try:
            lines = jsonl_path.read_text(encoding="utf-8").splitlines(keepends=True)
        except (OSError, UnicodeDecodeError):
            continue

        changed: list[int] = []
        for index, line in enumerate(lines):
            if needle in line:
                lines[index] = line.replace(needle, replacement)
                changed.append(index + 1)
        if changed:
            rewrites.append((jsonl_path, changed, "".join(lines)))

    return rewrites


def _plan_backrefs(
    tasks_dir: Path, task_dir: Path, old_name: str, new_name: str
) -> tuple[list[tuple[Path, dict, list[str]]], list[Path]]:
    """Plan back-reference rewrites in the other active tasks.

    Returns ``(changes, unreadable)``. ``subtasks`` is the legacy spelling of
    ``children`` and is still carried in older task.json files, so both lists
    are rewritten.
    """
    changes: list[tuple[Path, dict, list[str]]] = []
    unreadable: list[Path] = []

    for candidate in sorted(tasks_dir.iterdir()):
        if not candidate.is_dir() or candidate.name == DIR_ARCHIVE:
            continue
        if candidate == task_dir:
            continue
        json_path = candidate / FILE_TASK_JSON
        if not json_path.is_file():
            continue

        data, _reason = read_json_checked(json_path)
        if data is None:
            unreadable.append(json_path)
            continue

        labels: list[str] = []
        if data.get("parent") == old_name:
            data["parent"] = new_name
            labels.append("parent")
        for list_field in ("children", "subtasks"):
            values = data.get(list_field)
            if not isinstance(values, list):
                continue
            for index, value in enumerate(values):
                if value == old_name:
                    values[index] = new_name
                    labels.append(f"{list_field}[{index}]")

        if labels:
            changes.append((json_path, data, labels))

    return changes, unreadable


def _plan_reported_refs(
    repo_root: Path, task_dir: Path, rewritten: set[Path], old_name: str
) -> list[tuple[Path, int]]:
    """Find remaining mentions of the old task name elsewhere under .trellis/.

    These are reported, never rewritten: journal entries and workflow prose
    cite tasks in free text, and a blind substitution there is how a rename
    turns into a diff nobody asked for. The boundary-anchored pattern keeps a
    longer task name that merely contains this one out.

    Runtime session pointers are excluded because they are not prose and they
    *are* rewritten — see ``repoint_task_in_sessions``. Listing them here as
    "not rewritten" would be a false statement about the one file whose
    staleness actually breaks the next command.
    """
    from .active_task import _runtime_sessions_dir

    pattern = re.compile(
        r"(?<![0-9A-Za-z_-])" + re.escape(old_name) + r"(?![0-9A-Za-z_-])"
    )
    hits: list[tuple[Path, int]] = []
    trellis_dir = repo_root / DIR_WORKFLOW
    sessions_dir = _runtime_sessions_dir(repo_root)
    if not trellis_dir.is_dir():
        return hits

    for path in sorted(trellis_dir.rglob("*")):
        if not path.is_file() or path in rewritten:
            continue
        if path == task_dir or task_dir in path.parents:
            continue
        if path.parent == sessions_dir:
            continue
        if any(
            part == "__pycache__" or part.startswith(".backup-")
            for part in path.relative_to(trellis_dir).parts[:-1]
        ):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if pattern.search(line):
                hits.append((path, lineno))

    return hits


def _render_rename_plan(plan: _RenamePlan, repo_root: Path) -> list[str]:
    """Render the change set. Identical for --dry-run and the real run."""
    lines = [
        f"rename: {plan.old_name} -> {plan.new_name}",
        f"  dir: {plan.old_rel} -> {plan.new_rel}",
    ]
    for field_name, old_value, new_value in plan.identity:
        lines.append(f"  task.json: {field_name}: {old_value} -> {new_value}")
    for json_path, _data, labels in plan.backrefs:
        rel = _repo_relative_path(json_path, repo_root)
        for label in labels:
            lines.append(
                f"  backref: {rel}: {label}: {plan.old_name} -> {plan.new_name}"
            )
    for jsonl_path, linenos, _text in plan.jsonl:
        rel = _repo_relative_path(jsonl_path, repo_root)
        for lineno in linenos:
            lines.append(
                f"  jsonl: {rel}:{lineno}: {plan.old_rel}/ -> {plan.new_rel}/"
            )
    for path, lineno in plan.reported:
        lines.append(
            f"  reported (not rewritten): {_repo_relative_path(path, repo_root)}:{lineno}"
        )
    lines.append(
        f"  sessions: any active-task pointer at {plan.old_rel} is repointed to {plan.new_rel}"
    )
    return lines


def _rename_interrupted(plan: _RenamePlan) -> None:
    """Explain how to finish a rename that stopped part-way through."""
    print(
        f"The task is still at {plan.old_rel} and was NOT moved. Every step up to "
        f"this one is idempotent: fix the write failure, then run the same rename "
        f"again to finish it.",
        file=sys.stderr,
    )


def _apply_rename(plan: _RenamePlan, repo_root: Path) -> int:
    """Write the planned change set.

    The directory move goes last on purpose. Everything before it is an
    in-place edit that re-running the identical command recomputes as
    already-done, so an interruption leaves a tree that the same command
    finishes; a move-first ordering would instead leave the old name
    unresolvable and the remaining edits to be made by hand.
    """
    if plan.identity:
        data = dict(plan.task_data)
        for field_name, _old_value, new_value in plan.identity:
            data[field_name] = new_value
        if not write_json(plan.task_json_path, data):
            _report_write_failure(plan.task_json_path)
            print("Nothing was renamed.", file=sys.stderr)
            return 1

    for jsonl_path, _linenos, text in plan.jsonl:
        try:
            jsonl_path.write_text(text, encoding="utf-8")
        except OSError as exc:
            print(
                colored(f"Error: Failed to write {jsonl_path}: {exc}", Colors.RED),
                file=sys.stderr,
            )
            _rename_interrupted(plan)
            return 1

    for json_path, data, _labels in plan.backrefs:
        if not write_json(json_path, data):
            _report_write_failure(json_path)
            _rename_interrupted(plan)
            return 1

    try:
        plan.task_dir.rename(plan.new_dir)
    except OSError as exc:
        print(
            colored(f"Error: Failed to move {plan.old_rel} -> {plan.new_rel}: {exc}", Colors.RED),
            file=sys.stderr,
        )
        _rename_interrupted(plan)
        return 1

    # Last, and after the move: a session pointing at the old path would now
    # resolve to a missing directory, so `current` would report the task stale
    # and the context hook would inject nothing until the user ran `start`
    # again. Archive clears these pointers because the task is leaving; rename
    # moves them, because the task is still the one being worked on.
    from .active_task import repoint_task_in_sessions

    repoint_task_in_sessions(str(plan.task_dir), str(plan.new_dir), repo_root)

    return 0


def cmd_rename(args: argparse.Namespace) -> int:
    """Rename a task and every reference to it."""
    repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)

    task_dir = resolve_task_dir(args.name, repo_root)
    if task_dir is None or not task_dir.is_dir():
        if task_dir is not None:
            print(colored(f"Error: Task not found: {args.name}", Colors.RED), file=sys.stderr)
        return 1

    # Narrower than resolve_task_dir's containment: an archived task has left
    # the active set, so its back-references are no longer maintained here.
    if not is_within_tasks_dir(task_dir, repo_root):
        print(
            colored(
                f"Error: refusing to rename '{args.name}': "
                f"{task_dir} is not an active task under {tasks_dir}",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return 1

    old_name = task_dir.name
    date_prefix, _old_slug = _split_date_prefix(old_name)

    slug = _validate_rename_slug(args.new_slug, date_prefix)
    if slug is None:
        return 1

    new_name = f"{date_prefix}-{slug}" if date_prefix else slug
    if new_name == old_name:
        print(
            colored(f"Error: '{new_name}' is the task's current name", Colors.RED),
            file=sys.stderr,
        )
        return 1

    new_dir = task_dir.parent / new_name
    if new_dir.exists():
        print(
            colored(f"Error: Task already exists: {new_name}", Colors.RED),
            file=sys.stderr,
        )
        print(f"Existing task at: {_repo_relative_path(new_dir, repo_root)}", file=sys.stderr)
        print("Pick a different slug.", file=sys.stderr)
        return 1

    archived_task_dir = _find_archived_task_by_dir_name(tasks_dir, new_name)
    if archived_task_dir:
        print(
            colored(f"Error: Task already archived: {new_name}", Colors.RED),
            file=sys.stderr,
        )
        print(f"Archived at: {_repo_relative_path(archived_task_dir, repo_root)}", file=sys.stderr)
        print("Pick a different slug.", file=sys.stderr)
        return 1

    task_json_path = task_dir / FILE_TASK_JSON
    if not task_json_path.is_file():
        print(
            colored(f"Error: task.json not found at {task_dir}", Colors.RED),
            file=sys.stderr,
        )
        return 1

    task_data, reason = read_json_checked(task_json_path)
    if task_data is None:
        _report_read_failure(task_json_path, reason)
        print("Nothing was renamed.", file=sys.stderr)
        return 1

    plan = _RenamePlan(
        task_dir=task_dir,
        new_dir=new_dir,
        old_name=old_name,
        new_name=new_name,
        old_rel=_repo_relative_path(task_dir, repo_root),
        new_rel=_repo_relative_path(new_dir, repo_root),
        task_json_path=task_json_path,
        task_data=task_data,
    )
    plan.identity = [
        (name, task_data.get(name), slug)
        for name in RENAME_IDENTITY_FIELDS
        if task_data.get(name) != slug
    ]
    plan.jsonl = _plan_jsonl_rewrites(task_dir, plan.old_rel, plan.new_rel)
    plan.backrefs, plan.unreadable = _plan_backrefs(
        tasks_dir, task_dir, old_name, new_name
    )
    rewritten = {path for path, _linenos, _text in plan.jsonl}
    rewritten.update(path for path, _data, _labels in plan.backrefs)
    plan.reported = _plan_reported_refs(repo_root, task_dir, rewritten, old_name)

    for line in _render_rename_plan(plan, repo_root):
        print(line)

    for json_path in plan.unreadable:
        print(
            colored(
                f"Warning: {_repo_relative_path(json_path, repo_root)} could not be read; "
                "any back-reference in it is left as-is.",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )

    if getattr(args, "dry_run", False):
        print(colored("Dry run: nothing was written.", Colors.YELLOW), file=sys.stderr)
        return 0

    rc = _apply_rename(plan, repo_root)
    if rc != 0:
        return rc

    print(colored(f"Renamed: {old_name} -> {new_name}", Colors.GREEN), file=sys.stderr)
    if plan.reported:
        print(
            colored(
                f"{len(plan.reported)} reference(s) elsewhere under {DIR_WORKFLOW}/ "
                "still name the old task; they are listed above and were not rewritten.",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
    return 0


# =============================================================================
# Command: archive
# =============================================================================

def _task_branch_field(data: dict, key: str) -> str:
    """Read a branch field as a trimmed string ("" when unset or not a string)."""
    value = data.get(key)
    return strip_blank(value) if isinstance(value, str) else ""


def _validate_branch_metadata(
    data: dict,
    task_name: str,
    repo_root: Path,
    skip: bool,
) -> bool:
    """Check branch metadata before the task leaves the active tree.

    Returns False when archiving must stop. Archive is the last gate that sees
    a task, so metadata nobody can reconstruct afterwards is refused here
    rather than repaired by hand later (#399 follow-up).

    "PR-backed" is deliberately pragmatic: a task carrying a base_branch in a
    repo that has a remote was created expecting a PR, so a missing `branch`
    means the metadata was never recorded — not that the work had no branch.
    Local-only repos and tasks without a base_branch are left alone.

    A recorded branch that no longer exists locally stays a warning: after a
    merge the feature branch is normally deleted, and refusing to archive then
    would be backwards.
    """
    branch = _task_branch_field(data, "branch")
    base_branch = _task_branch_field(data, "base_branch")
    task_py = f"python {DIR_WORKFLOW}/scripts/task.py"

    if branch and not branch_exists_locally(branch, repo_root):
        print(
            colored(
                f"Warning: recorded branch '{branch}' no longer exists locally "
                "(likely merged and deleted).",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )

    if skip:
        return True

    if branch and base_branch and branch == base_branch:
        print(
            colored(
                f"Error: refusing to archive '{task_name}': branch and base_branch "
                f"are both '{branch}'. A PR cannot target its own branch, so this "
                "metadata cannot describe the work that was merged.",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        print("Repair whichever field is wrong:", file=sys.stderr)
        print(f"  {task_py} set-branch {task_name} <feature-branch>", file=sys.stderr)
        print(f"  {task_py} set-base-branch {task_name} <target-branch>", file=sys.stderr)
        print(
            f"  {task_py} archive {task_name} --skip-branch-validation"
            "   # only if this task was never PR-backed",
            file=sys.stderr,
        )
        return False

    if not branch and base_branch and has_git_remote(repo_root):
        print(
            colored(
                f"Error: refusing to archive '{task_name}': no branch is recorded, "
                f"but the task targets base_branch '{base_branch}' in a repo with a "
                "remote — the branch it was built on was never written down.",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        print("Repair with:", file=sys.stderr)
        print(f"  {task_py} set-branch {task_name} <branch>", file=sys.stderr)
        print(
            f"  {task_py} archive {task_name} --skip-branch-validation"
            "   # only if the work landed without a branch of its own",
            file=sys.stderr,
        )
        return False

    return True


def cmd_archive(args: argparse.Namespace) -> int:
    """Archive completed task."""
    repo_root = get_repo_root()
    task_name = args.name

    if not task_name:
        print(colored("Error: Task name is required", Colors.RED), file=sys.stderr)
        return 1

    tasks_dir = get_tasks_dir(repo_root)

    # Resolve task directory (supports task name, relative path, or absolute path)
    task_dir = resolve_task_dir(task_name, repo_root)

    if task_dir is None or not task_dir.is_dir():
        if task_dir is None:
            # resolve_task_dir already reported why; keep the archive-specific
            # refusal so it reads the same as the is_within_tasks_dir guard.
            print(colored(
                f"Error: refusing to archive '{task_name}': "
                f"it does not resolve to a task under {tasks_dir}",
                Colors.RED), file=sys.stderr)
        else:
            print(colored(f"Error: Task not found: {task_name}", Colors.RED), file=sys.stderr)
        print("Active tasks:", file=sys.stderr)
        # Import lazily to avoid circular dependency
        from .tasks import iter_active_tasks
        for t in iter_active_tasks(tasks_dir):
            print(f"  - {t.dir_name}/", file=sys.stderr)
        return 1

    # Refuse to archive anything that isn't a real task directly under
    # .trellis/tasks/. resolve_task_dir keeps the target inside the tasks dir;
    # this narrows it further to a direct child, so an already-archived task
    # (.trellis/tasks/archive/<month>/<task>) is not archived a second time.
    if not is_within_tasks_dir(task_dir, repo_root):
        print(colored(
            f"Error: refusing to archive '{task_name}': "
            f"{task_dir} is not a task under {tasks_dir}",
            Colors.RED), file=sys.stderr)
        return 1

    # Check the destination before anything below mutates task state. The
    # mover refuses a collision too, but by then this command has already
    # marked the task completed, re-parented its children and cleared the
    # sessions pointing at it — all of which would have to be undone by hand.
    archive_dest_check = archive_destination_for(task_dir)
    if archive_dest_check.exists():
        print(colored(
            f"Error: refusing to archive '{task_name}': "
            f"archive destination already exists: "
            f"{_repo_relative_path(archive_dest_check, repo_root)}",
            Colors.RED), file=sys.stderr)
        print(f"Task remains at: {_repo_relative_path(task_dir, repo_root)}", file=sys.stderr)
        print("Move or rename the existing archived task, then retry.", file=sys.stderr)
        return 1

    dir_name = task_dir.name
    task_json_path = task_dir / FILE_TASK_JSON

    # Update status before archiving
    today = datetime.now().strftime("%Y-%m-%d")
    # Names of child task dirs whose task.json gets modified below; passed
    # into safe_archive_paths_to_add so they're staged in this commit.
    modified_children: list[str] = []
    if task_json_path.is_file():
        data, read_reason = read_json_checked(task_json_path)
        if data is None:
            # Archiving is still the right outcome for a task whose task.json
            # is broken — but say so, or the missing "completed" status looks
            # like the archive silently did half its job.
            problem, _ = describe_json_read_failure(task_json_path, read_reason)
            print(
                colored(
                    f"Warning: {problem}; archiving without updating status/children.",
                    Colors.YELLOW,
                ),
                file=sys.stderr,
            )
        else:
            # Before any mutation: branch metadata is unrecoverable once the
            # task leaves the active tree. Stale branches only warn.
            if not _validate_branch_metadata(
                data,
                task_name,
                repo_root,
                getattr(args, "skip_branch_validation", False),
            ):
                print(
                    f"Not archived: {_repo_relative_path(task_dir, repo_root)} is unchanged.",
                    file=sys.stderr,
                )
                return 1

            data["status"] = "completed"
            data["completedAt"] = today
            if not write_json(task_json_path, data):
                _report_write_failure(task_json_path)
                print(
                    f"Not archived: {_repo_relative_path(task_dir, repo_root)} is unchanged. "
                    "Archiving a task still marked in progress would hide it from `list` "
                    "with the wrong status.",
                    file=sys.stderr,
                )
                return 1

            # Handle subtask relationships on archive.
            # Keep this task in its parent's children list so progress
            # counters (children_progress) stay consistent — children
            # missing from the active set are treated as completed.
            task_children = data.get("children", [])

            # If this is a parent, clear parent field in all children.
            # Remember each link removed so a later failure in this loop can
            # put it back (see _restore_child_links). Keyed by the child's
            # task.json: a `children` list that names the same child twice
            # would otherwise record a second, already-cleared snapshot and
            # the restore would write that `null` back over the real parent.
            unlinked_children: dict[Path, str | None] = {}
            if task_children:
                for child_name in task_children:
                    child_dir_path = find_task_by_name(child_name, tasks_dir)
                    if child_dir_path:
                        child_json = child_dir_path / FILE_TASK_JSON
                        if child_json.is_file():
                            child_data, child_reason = read_json_checked(child_json)
                            if child_data is None:
                                problem, _ = describe_json_read_failure(child_json, child_reason)
                                print(
                                    colored(
                                        f"Warning: {problem}; child '{child_dir_path.name}' "
                                        "keeps its parent reference.",
                                        Colors.YELLOW,
                                    ),
                                    file=sys.stderr,
                                )
                                continue
                            # Only the first visit to a child records its original
                            # parent: a `children` list naming the same child twice
                            # would otherwise snapshot the already-cleared value and
                            # the restore would write that `null` back over the link.
                            first_visit = child_json not in unlinked_children
                            original_parent = child_data.get("parent")
                            if first_visit:
                                unlinked_children[child_json] = original_parent
                            child_data["parent"] = None
                            if not write_json(child_json, child_data):
                                # Stop before the move: a child pointing at a
                                # parent that has left .trellis/tasks/ is a
                                # dangling reference nothing repairs later.
                                # Put back the children already unlinked above —
                                # their parent is staying, so losing the link the
                                # other way round is just as unrecoverable.
                                # Retrying is safe — every step so far is
                                # idempotent.
                                if first_visit:
                                    # The link never came off, so there is nothing
                                    # to put back for this child.
                                    del unlinked_children[child_json]
                                _restore_child_links(unlinked_children)
                                _report_write_failure(child_json)
                                print(
                                    f"Not archived: {_repo_relative_path(task_dir, repo_root)} is "
                                    f"marked completed but stays in place because child "
                                    f"'{child_dir_path.name}' could not be unlinked. "
                                    "Fix the child, then run archive again.",
                                    file=sys.stderr,
                                )
                                return 1
                            modified_children.append(child_dir_path.name)

    # Clear any session that still points at this task before the path moves.
    from .active_task import clear_task_from_sessions
    clear_task_from_sessions(str(task_dir), repo_root)

    # Archive
    result = archive_task_complete(task_dir, repo_root)
    if "archived_to" in result:
        archive_dest = Path(result["archived_to"])
        year_month = archive_dest.parent.name
        print(colored(f"Archived: {dir_name} -> archive/{year_month}/", Colors.GREEN), file=sys.stderr)

        # Auto-commit unless --no-commit
        if not getattr(args, "no_commit", False):
            if not _auto_commit_archive(dir_name, repo_root, modified_children):
                print(
                    colored(
                        "Archive moved on disk, but git auto-commit did not complete. "
                        "Resolve `git status` before continuing.",
                        Colors.RED,
                    ),
                    file=sys.stderr,
                )
                return 1

        # Return the archive path
        print(f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}/{year_month}/{dir_name}")

        # Run hooks with the archived path
        archived_json = archive_dest / FILE_TASK_JSON
        run_task_hooks("after_archive", archived_json, repo_root)
        return 0

    return 1


def _auto_commit_archive(
    task_name: str,
    repo_root: Path,
    modified_children: list[str] | None = None,
) -> bool:
    """Stage Trellis-owned task paths and commit after archive.

    Scoped narrowly to the archived task's source + destination paths
    plus any child task dirs whose ``task.json`` was edited (parent →
    children relationship update). Dirty changes in OTHER active task
    dirs are NOT bundled into the archive commit.

    If ``.gitignore`` blocks the paths, we warn + skip — we do NOT
    retry with ``git add -f``. The warning explicitly forbids
    ``git add -f .trellis/`` (which would fan out to caches/backups)
    and points users at ``session_auto_commit: false``.

    Honors ``session_auto_commit`` in ``.trellis/config.yaml``: when
    set to ``false``, this function returns immediately without
    touching git (the archive directory move on disk is unaffected).
    """
    if not get_session_auto_commit(repo_root):
        print(
            "[OK] session_auto_commit: false — skipping git stage/commit.",
            file=sys.stderr,
        )
        return True

    source_rel = f"{DIR_WORKFLOW}/{DIR_TASKS}/{task_name}"
    rc, tracked_out, _ = run_git(
        ["ls-files", "--", source_rel],
        cwd=repo_root,
    )
    source_was_tracked = rc == 0 and bool(tracked_out.strip())

    paths = safe_archive_paths_to_add(
        repo_root, task_name=task_name, modified_children=modified_children
    )
    if not paths:
        print("[OK] No task changes to commit.", file=sys.stderr)
        return True

    success, _, err = safe_git_add(paths, repo_root, retry_on_index_lock=True)
    if not success:
        if err and "ignored by" in err.lower():
            print_gitignore_warning(paths)
        elif stderr_indicates_index_lock(err):
            _print_index_lock_warning(
                "git add", task_name, repo_root, [*paths, source_rel]
            )
        else:
            print(
                f"[WARN] git add failed: {err.strip() if err else 'unknown error'}",
                file=sys.stderr,
            )
        return not source_was_tracked

    # Belt-and-suspenders for the phantom-delete bug: `safe_git_add` uses
    # `git add` (no -A) which only stages additions/modifications. The
    # source task directory was moved away by `shutil.move`, so its files
    # need an explicit `git rm --cached` to stage the deletions in this
    # same commit — otherwise they sit as uncommitted "phantom deletes"
    # against HEAD until something later picks them up.
    #
    # `--ignore-unmatch` makes this a no-op when the task was never tracked
    # (e.g. archiving a task that lived only in working tree).
    rc, _, err = run_git_retry_index_lock(
        ["rm", "-r", "--cached", "--ignore-unmatch", "--", source_rel],
        cwd=repo_root,
    )
    if rc != 0 and stderr_indicates_index_lock(err):
        # Committing now would record the archived copy without the
        # source-side deletes — a half-archived tree in history.
        _print_index_lock_warning(
            "git rm --cached", task_name, repo_root, [*paths, source_rel]
        )
        return not source_was_tracked

    rc, _, _ = run_git(
        ["diff", "--cached", "--quiet", "--", *paths, source_rel],
        cwd=repo_root,
    )
    if rc == 0:
        print("[OK] No task changes to commit.", file=sys.stderr)
        return True

    commit_msg = f"chore(task): archive {task_name}"
    # Commit with an explicit pathspec: a bare `git commit` would sweep any
    # unrelated entries the developer had staged before archiving into the
    # chore commit (#579). `source_rel` is included so the source-side
    # deletions staged above land in the same commit.
    rc, _, err = run_git_retry_index_lock(
        ["commit", "-m", commit_msg, "--", *paths, source_rel], cwd=repo_root
    )
    if rc == 0:
        print(f"[OK] Auto-committed: {commit_msg}", file=sys.stderr)
        return True
    elif stderr_indicates_index_lock(err):
        _print_index_lock_warning(
            "git commit", task_name, repo_root, [*paths, source_rel]
        )
        return not source_was_tracked
    else:
        print(f"[WARN] Auto-commit failed: {err.strip()}", file=sys.stderr)
        return not source_was_tracked


def _print_index_lock_warning(
    action: str, task_name: str, repo_root: Path, paths: list[str]
) -> None:
    """Report an archive auto-commit that gave up on a held index.lock.

    The move itself already succeeded, so the state is consistent — the task
    lives in archive/ and its changes are staged-or-not but never half of
    both in a commit. Only the commit is outstanding, which the user (or an
    agent reading the log) has to finish by hand.

    ``paths`` are the paths the auto-commit would have staged, so the manual
    command keeps the same narrow scope — a blanket ``git add -A -- .trellis/``
    would sweep dirty changes from other active tasks into the archive commit.
    """
    lock = index_lock_path(repo_root)
    print(
        f"[WARN] {action} gave up after {INDEX_LOCK_RETRY_ATTEMPTS} attempts: "
        f"another process is holding {lock}",
        file=sys.stderr,
    )
    print(
        "[WARN] The task was moved into archive/ on disk; only the commit is pending.",
        file=sys.stderr,
    )
    print(
        "[WARN] Close whatever holds the lock (an IDE git integration, a status",
        file=sys.stderr,
    )
    print(
        f"[WARN] daemon, another session), or delete {lock} if it is stale, then",
        file=sys.stderr,
    )
    print(
        f'[WARN] commit manually: git add -A -- {" ".join(paths)} && '
        f'git commit -m "chore(task): archive {task_name}"',
        file=sys.stderr,
    )


# =============================================================================
# Command: add-subtask
# =============================================================================

def cmd_add_subtask(args: argparse.Namespace) -> int:
    """Link a child task to a parent task."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)
    if parent_dir is None or child_dir is None:
        return 1

    if not parent_dir:
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_dir:
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data, parent_reason = read_json_checked(parent_json_path)
    if parent_data is None:
        _report_read_failure(parent_json_path, parent_reason)
        return 1
    child_data, child_reason = read_json_checked(child_json_path)
    if child_data is None:
        _report_read_failure(child_json_path, child_reason)
        return 1

    # Check if child already has a parent
    existing_parent = child_data.get("parent")
    if existing_parent:
        print(colored(f"Error: Child task already has a parent: {existing_parent}", Colors.RED), file=sys.stderr)
        return 1

    # Add child to parent's children list
    parent_children = _ensure_children_list(parent_data)
    child_dir_name = child_dir.name
    if child_dir_name not in parent_children:
        parent_children.append(child_dir_name)
        parent_data["children"] = parent_children

    # Set parent in child's task.json
    child_data["parent"] = parent_dir.name

    # Write both. A link is two files; if the second write fails silently the
    # two sides disagree with no error, so check each and name the side that
    # did land so the user knows what to undo.
    if not write_json(parent_json_path, parent_data):
        print(colored(f"Error: Failed to write parent task.json: {parent_json_path}", Colors.RED), file=sys.stderr)
        print("No link was written.", file=sys.stderr)
        return 1
    if not write_json(child_json_path, child_data):
        print(colored(f"Error: Failed to write child task.json: {child_json_path}", Colors.RED), file=sys.stderr)
        print(
            f"Link is half-written: {parent_json_path} now lists "
            f"'{child_dir.name}' as a child, but the child does not record the parent.",
            file=sys.stderr,
        )
        return 1

    print(colored(f"Linked: {child_dir.name} -> {parent_dir.name}", Colors.GREEN), file=sys.stderr)
    return 0


# =============================================================================
# Command: remove-subtask
# =============================================================================

def cmd_remove_subtask(args: argparse.Namespace) -> int:
    """Unlink a child task from a parent task."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)
    if parent_dir is None or child_dir is None:
        return 1

    if not parent_dir:
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_dir:
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data, parent_reason = read_json_checked(parent_json_path)
    if parent_data is None:
        _report_read_failure(parent_json_path, parent_reason)
        return 1
    child_data, child_reason = read_json_checked(child_json_path)
    if child_data is None:
        _report_read_failure(child_json_path, child_reason)
        return 1

    # Remove child from parent's children list
    parent_children = _ensure_children_list(parent_data)
    child_dir_name = child_dir.name
    if child_dir_name in parent_children:
        parent_children.remove(child_dir_name)
        parent_data["children"] = parent_children

    # Clear parent in child's task.json
    child_data["parent"] = None

    # Write both — see cmd_add_subtask: an unchecked second write leaves the
    # two sides disagreeing with no error.
    if not write_json(parent_json_path, parent_data):
        print(colored(f"Error: Failed to write parent task.json: {parent_json_path}", Colors.RED), file=sys.stderr)
        print("Nothing was unlinked.", file=sys.stderr)
        return 1
    if not write_json(child_json_path, child_data):
        print(colored(f"Error: Failed to write child task.json: {child_json_path}", Colors.RED), file=sys.stderr)
        print(
            f"Unlink is half-written: {parent_json_path} no longer lists "
            f"'{child_dir.name}', but the child still records the parent.",
            file=sys.stderr,
        )
        return 1

    print(colored(f"Unlinked: {child_dir.name} from {parent_dir.name}", Colors.GREEN), file=sys.stderr)
    return 0


# =============================================================================
# Command: set-branch
# =============================================================================

def cmd_set_branch(args: argparse.Namespace) -> int:
    """Set git branch for task."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    if target_dir is None:
        return 1
    branch = args.branch

    if not branch:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-branch <task-dir> <branch-name>")
        return 1

    if not target_dir:
        # target_dir is None here, so it must not appear in the message. This
        # is also the branch a ref pointing outside the repo lands in.
        print(colored(f"Error: Task not found: {args.dir}", Colors.RED))
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data, reason = read_json_checked(task_json)
    if data is None:
        _report_read_failure(task_json, reason)
        return 1

    data["branch"] = branch
    if not write_json(task_json, data):
        _report_write_failure(task_json)
        return 1

    print(colored(f"✓ Branch set to: {branch}", Colors.GREEN))
    return 0


# =============================================================================
# Command: set-base-branch
# =============================================================================

def cmd_set_base_branch(args: argparse.Namespace) -> int:
    """Set the base branch (PR target) for task."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    if target_dir is None:
        return 1
    base_branch = args.base_branch

    if not base_branch:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-base-branch <task-dir> <base-branch>")
        print("Example: python task.py set-base-branch <dir> develop")
        print()
        print("This sets the target branch for PR (the branch your feature will merge into).")
        return 1

    if not target_dir:
        # target_dir is None here, so it must not appear in the message. This
        # is also the branch a ref pointing outside the repo lands in.
        print(colored(f"Error: Task not found: {args.dir}", Colors.RED))
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data, reason = read_json_checked(task_json)
    if data is None:
        _report_read_failure(task_json, reason)
        return 1

    data["base_branch"] = base_branch
    if not write_json(task_json, data):
        _report_write_failure(task_json)
        return 1

    print(colored(f"✓ Base branch set to: {base_branch}", Colors.GREEN))
    print(f"  PR will target: {base_branch}")
    return 0


# =============================================================================
# Command: set-scope
# =============================================================================

def cmd_set_scope(args: argparse.Namespace) -> int:
    """Set scope for PR title."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    if target_dir is None:
        return 1
    scope = args.scope

    if not scope:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-scope <task-dir> <scope>")
        return 1

    if not target_dir:
        # target_dir is None here, so it must not appear in the message. This
        # is also the branch a ref pointing outside the repo lands in.
        print(colored(f"Error: Task not found: {args.dir}", Colors.RED))
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data, reason = read_json_checked(task_json)
    if data is None:
        _report_read_failure(task_json, reason)
        return 1

    data["scope"] = scope
    if not write_json(task_json, data):
        _report_write_failure(task_json)
        return 1

    print(colored(f"✓ Scope set to: {scope}", Colors.GREEN))
    return 0


# =============================================================================
# Command: set-meta
# =============================================================================

def cmd_set_meta(args: argparse.Namespace) -> int:
    """Set/overwrite one metadata key on an existing task."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    if target_dir is None:
        return 1
    key = args.key
    value = args.value

    if not key:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-meta <task-dir> <key> <value>")
        return 1

    if not target_dir:
        # target_dir is None here, so it must not appear in the message. This
        # is also the branch a ref pointing outside the repo lands in.
        print(colored(f"Error: Task not found: {args.dir}", Colors.RED))
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data, reason = read_json_checked(task_json)
    if data is None:
        _report_read_failure(task_json, reason)
        return 1

    meta = data.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    meta[key] = value
    data["meta"] = meta
    if not write_json(task_json, data):
        _report_write_failure(task_json)
        return 1

    print(colored(f"✓ Meta set: {key} = {value}", Colors.GREEN))
    return 0
````

