# Implementation plan: the remaining writers

## Ordered checklist

- [x] **1. The temporary project**, initialised the same way as last round.
- [x] **2. The convergence chain**, step by step.
- [x] **3. The session chain.**
- [x] **4. Read the state, remove the fixture, then the gate.**

## Both chains, run

```text
project init                                       exit 0
task create probe-title --description probe-desc    exit 0   a real stableId
task convergence status                             exit 0   the created task resolved
session record --title my-session --test not-run    exit 0   schemaVersion 1, a real session id
session list                                        exit 0   the session appears

.dove/sessions.jsonl:  one JSON object per line, schemaVersion 1, id, recordedAt, title, changes
```

**Every state-writing chain in the CLI has now been run**, not read: the task chain last round, the convergence chain and the session chain
here, all in a temporary project and all exiting zero. The path `.dove/sessions.jsonl` was found by reading `native-sessions.ts` in an earlier
round, and it is written here by the command the file declares.

## What this does not prove

**That the chain works against a Pi host.** Every step here ran without one, which is exactly the part this environment can exercise; the
steps that need the host are the ones that remain unrun, and they are the first real turn.

The fixture was removed afterwards and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py session record --title probe --test "not run"
python dove_pi.py task convergence status
npm run typecheck
npm test
```

## Recorded, not built

1. **Commands needing a host.**
2. **The first real turn.**