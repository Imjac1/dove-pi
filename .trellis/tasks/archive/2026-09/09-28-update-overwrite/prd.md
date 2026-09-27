# What an update may overwrite

## Goal

Record and check the arrangement a previous round guessed at, now that the tool own bookkeeping answers it: which files a `trellis
update` may overwrite, and which are this repository own to edit.

## Background: the bookkeeping, measured

`.trellis/.template-hashes.json` tracks **181** files. By prefix:

| Prefix | Tracked |
|---|---|
| `.trellis/` | 74 - of which `scripts` 68, `.runtime` 2, `agents` 2, `config.yaml`, `workflow.md` |
| `.claude/` | 52 |
| `.agents/` | 46 |
| `.codex/` | 8 |
| `AGENTS.md` | 1 |

**And not one `.trellis/spec/**` file.** Two rounds ago the claim "nothing regenerates the specification files" rested on a search
for a generator inside this repository, which is a weaker thing than it sounded. The tool own hash file says it directly: the
specifications are project content, and the files with a managed region are `AGENTS.md`, `workflow.md` and the tool directories.

**What that means for the marker block.** `AGENTS.md` is tracked, so a tool update knows the file - and its footer says edits
**outside** the block are preserved. This repository put its own pointer there in a previous round, which is only safe if it stays
outside: an edit that drifts into the block is an edit a future update may delete, and nothing would say so.

## Requirements

- **R1 - A check holds the marker rule**: everything this repository adds to `AGENTS.md` is **after** `<!-- TRELLIS:END -->`, because
  the block own footer says edits inside it may be overwritten.
- **R2 - A check holds the ownership rule**: if the tool bookkeeping file is present, it tracks no `.trellis/spec/**` path - so a
  future tool version that starts tracking the specifications is noticed rather than discovered by losing an edit.
- **R3 - Both checks state what they cannot see.** R1 cannot see whether the tool updates the block correctly, only that our content
  is outside it. R2 cannot see anything when the bookkeeping file is absent, which is a fresh clone.
- **R4 - The arrangement is recorded where a reader meets it**, in the pointer section of `AGENTS.md` and in the task.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The marker check fails if content appears between the markers that is not this repository own, proven by seeding.
- [ ] **AC2** The ownership check passes, and passes vacuously with a stated reason when the bookkeeping file is absent.
- [ ] **AC3** `AGENTS.md` says, in its own section, that its content sits outside the managed block and that a test checks it.
- [ ] **AC4** The measured table is in the task, with the two prefixes that matter named.
- [ ] **AC5** The gate passes.

## Out of scope

- **Editing the managed block**, which a tool update owns.
- **Editing `workflow.md` or `config.yaml`**, tracked tool files whose content is not this round subject.
- **The first real turn**, which needs a Pi host.
