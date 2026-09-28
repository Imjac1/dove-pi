# Implementation plan: the three subcommands

## Ordered checklist

- [x] **1. The temporary project**, with a task created and started.
- [x] **2. The three commands**, with the state read around each.
- [x] **3. A refusal, if one is available.**
- [x] **4. Clean up, then the gate.**

## The three, run with the state read before and after each

```text
with a current task:
  task current    exit 0   rev 2 active/intake -> rev 2 active/intake   returns currentTask
  task continue   exit 0   rev 2 active/intake -> rev 2 active/intake   returns continuation
  task verify     exit 0   rev 2 active/intake -> rev 2 active/intake   returns the task

after task finish:
  task verify     exit 1   "No current task."
  task continue   exit 0   returns a continuation
  task current    exit 0   returns a continuation rather than a currentTask
```

**All three are reads**: the revision, the status and the phase are identical after each, so "what does it change" has one answer and it comes
from the state rather than from the output.

## The two things worth naming

**`verify` reads where its name suggests it might write.** It reports the task and changes nothing, and that is worth having measured rather
than assumed.

**And it refuses a finished task** with the same message `archive` gave in the previous round - *No current task* - while `continue` on the
same finished task exits zero and returns a continuation. **Two commands that read the same task differ on exactly this**, which is the kind
of difference a name does not tell you.

**`current` changes its response shape**: `currentTask` while one exists, `continuation` once the task is finished.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py task current
python dove_pi.py task continue
python dove_pi.py task verify
npm run typecheck
npm test
```

## Recorded, not built

1. **Commands needing a host.**
2. **The first real turn.**