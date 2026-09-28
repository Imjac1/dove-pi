# Implementation plan: the task lifecycle

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. The lifecycle**, step by step with the state read after each.
- [x] **3. The transitions.**
- [x] **4. A refusal, then the gate.**

## The lifecycle, run with the state read after each step

```text
task create probe-title --description probe-desc  exit 0   rev 1   active     intake
task start                                        exit 0   rev 2   active     intake
task finish                                       exit 0   rev 3   completed  completed
task status                                       exit 0   rev 3   completed  completed
task archive                                      exit 1   rev 3   completed  completed   "No current task."
```

## Four things observed rather than read

**The revision increments per mutation and not per read.** `create`, `start` and `finish` each add one; `status` leaves it at three. A previous
round saw the same counter reach two after two creates and called it a declared behaviour seen for the first time - here it is seen holding
across a read as well.

**`start` records an operation without moving the phase.** The status and phase after it are identical to before it, and the record still
carries the operation, so what it changes is which task is current - not the task state.

**`finish` moves both**: status and phase become `completed` together.

**`archive` refuses a finished task with "No current task."** That is the refusal this round was going to provoke, and the lifecycle produced
it on its own: a completed task is no longer current, and the message says which thing is missing rather than which command failed.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py task start <task>
python dove_pi.py task finish
python dove_pi.py task archive <task>
npm run typecheck
npm test
```

## Recorded, not built

1. **Commands needing a host.**
2. **The first real turn.**