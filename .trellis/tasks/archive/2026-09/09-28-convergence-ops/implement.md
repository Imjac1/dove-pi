# Implementation plan: the convergence operations

## Ordered checklist

- [x] **1. The operations**, read first.
- [x] **2. Each one run**, with the record read after.
- [x] **3. The transitions.**
- [x] **4. An out-of-order attempt, then the gate.**

## The chain, run with the record read after each step

```text
freeze --criterion AC-001=probe-text      exit 0   state=working          rev=1  [AC-001=pending]
progress --status started                 exit 0   state=working          rev=2  [AC-001=in_progress]
progress --status passed --evidence ev-1  exit 0   state=ready_to_finish  rev=3  [AC-001=passed]

finding --kind defect                     exit 1   convergence finding --kind is invalid.
resolve-finding --finding-id F-1          exit 1   Cannot apply finding.resolved after ready_to_finish
decide --next-action probe-next           exit 1   Cannot apply task.progress_reviewed after ready_to_finish
resume --revision 1                       exit 1   event.acceptanceRevision has an invalid format
```

## What the transitions say

**The state machine is real and it is enforced.** `freeze` creates the record in `working` with the criterion `pending`; `started` moves the
criterion to `in_progress` without moving the state; `passed` moves the criterion **and** the state, to `ready_to_finish`. Each one increments
the revision, which the earlier rounds observed on the task record and see again here.

**And the refusals prove the machine is enforced rather than advisory**: once the state is `ready_to_finish`, the operations that are not legal
there are refused with the event they could not apply - *Cannot apply finding.resolved*, *Cannot apply task.progress_reviewed* - which names
the transition rather than the command.

## The mistake I made and did not chase

**I guessed the finding kind and guessed wrong**: `--kind defect` was refused, and the vocabulary is `blocking`, `regression`, `follow_up`,
`scope_change` and `serious_unexpected_risk` (`extension.ts:432`). **The refusal is what the round was measuring**, and it was correct - so
the guess cost one line of output rather than a wrong conclusion, and the vocabulary is read after the fact rather than assumed before it.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py task convergence <operation>
npm run typecheck
npm test
```

## Recorded, not built

1. **The verdict machinery.**
2. **The first real turn.**