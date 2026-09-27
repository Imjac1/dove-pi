# Design: correct it on our side, and let the check notice

## Where the correction goes, and why not in the file

```text
.trellis/workflow.md            tracked, no managed block  ->  an update may overwrite a local edit
AGENTS.md, after TRELLIS:END    ours, position held by a test  ->  an update preserves it
```

**The asymmetry is the whole point of the previous round work.** A file the tool tracks without a managed region is one the tool may
replace; the section this repository added to `AGENTS.md` is on the safe side of markers, and a test says so. Correcting the wrong
document would feel tidier and would be undone.

## The check that notices

```typescript
assert.deepEqual(missing, [
	".trellis/workflow.md: .trellis/scripts/inject-workflow-state.py",
	".trellis/workflow.md: .trellis/spec/cli/backend/workflow-state-contract.md",
], "the tool document paths changed, so the note in AGENTS.md can be revisited");
```

**An exact set, rather than a filter that ignores the tool file.** A check that skipped the broken document would never tell anyone
the day it stopped being broken - and the note in `AGENTS.md` exists for exactly as long as the document is wrong.
