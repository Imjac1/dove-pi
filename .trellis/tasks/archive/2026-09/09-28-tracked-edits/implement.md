# Implementation plan: the tracked edits

## Ordered checklist

- [x] **1. The tracked list**, from the hash file.
- [x] **2. The changed files**, from the history.
- [x] **3. The overlap.**
- [x] **4. Record, then the gate.**

## The measurement

```text
tracked files:   181
identical:        73
different:        34   (17 are __pycache__ bytecode, 17 are files)
absent:           74

by prefix: .trellis/scripts=68, .agents/skills=46, .claude/skills=43, .codex/*=8,
           .trellis/agents=2, .trellis/.runtime=2, AGENTS.md=1, and a few config files
```

**The numbers reproduce the earlier round exactly**, which is worth having on its own: a measurement that repeats is a measurement.

## The answer to the question this round asked

**Everything this session has edited is outside the tracked list** - the launcher, the installer, the typecheck config, the mode files, the
specifications, `src`, `tests`. A `trellis update` cannot revert any of it.

**`AGENTS.md` is the one file that is both tracked and edited here**, and it is safe for the reason its own comment gives: the managed block
may be overwritten and everything outside it is preserved, and the notes this session added are outside it. Its hash differs because the
block itself was updated by the tool, not because of the notes.

## And the evidence the last round wanted

**`.trellis/scripts/task.py` is tracked and already differs from its recorded hash**, which means the tool has updated it since those hashes
were written. That is the concrete evidence behind the previous round conclusion that the archive fix is not this repository to make - it
was argued from the hash list then, and it is visible on disk now.

**One premise of this round was wrong**: I wrote that the earlier conclusion sits in `AGENTS.md` and is now out of date. It does not sit
there; it was in a task. Nothing needed correcting, and saying so is the honest half of a re-verification.

## Validation commands

```powershell
git log --name-only --format= --since="30 days ago"
npm run typecheck
npm test
```

## Recorded, not built

1. **Reverting**, which is not the question.
2. **The first real turn**, which needs a Pi host.