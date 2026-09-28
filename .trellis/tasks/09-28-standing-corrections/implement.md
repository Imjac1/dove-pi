# Implementation plan: the standing corrections

## Ordered checklist

- [x] **1. Both corrections**, restated.
- [x] **2. Each held against the repository.**
- [x] **3. Corrections, if a claim has aged.**
- [x] **4. The gate.**

## Both held, and the method mattered

```text
correction 1   .trellis/scripts/inject-workflow-state.py   does not exist          holds
               .codex/hooks/inject-workflow-state.py       exists                  holds
               workflow.md contains the full .trellis path True                    holds - the note is accurate
               workflow.md contains a .codex path          False                   holds - the note is still needed
correction 2   task.py in .trellis/.template-hashes.json   True, 181 entries       holds
               structured archived curated entries          396, of which 394 resolve, 2 broken
```

**The first check nearly went wrong the way this session keeps going wrong.** Two grep hits showed the document naming the script by bare
file name, and reading those two as the whole answer would have concluded the note inaccurate. **Asking the exact question** - does the file
contain the full path - answered True. A partial view read as a complete result is the recurring defect of this whole session, and it was one
call away from happening again.

## What changed, and it is one added paragraph

**The numbers in the standing note were framed as a measurement at a time, so they were not stale.** But "58 of 66" reads as current to
someone skimming, so the note now carries the later measurement: **394 of 396 resolving**. The two broken entries are the two files that are
genuinely gone, and every archive since has exercised the same breakage on its own task, which is why the warning is not historical.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **The managed block.**
2. **The first real turn.**