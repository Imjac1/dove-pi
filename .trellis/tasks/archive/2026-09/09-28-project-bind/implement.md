# Implementation plan: the last two project subcommands

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. Both commands**, with the state read around each.
- [x] **3. A refusal, if available.**
- [x] **4. Clean up, then the gate.**

## Both, run with the state read around them

```text
after project init:  2 files   project.json, state.json
project bind native  exit 0   still 2 files   provider native, projectRoot, restartRequired false
project update       exit 0   still 2 files   updated false, reason "no project template update step"
project bind pi      exit 1   still 2 files   Usage: dove-pi project bind native
```

## Three things worth naming

**`bind native` declares a binding without writing a new file.** It exits zero, reports the provider and the root, and the file set is
unchanged - so what it binds is expressed in the state files that already exist rather than in one of its own.

**`update` does nothing and says why**: *Dove Native Workflow has no project template update step.* **A no-op that names itself** is worth
more than a command that silently succeeds, and this is the shape a command should have when there is nothing for it to do.

**`bind pi` refuses and names the only value it accepts**, which is the same precise-refusal shape the capability runs had.

## The closure

**Every subcommand of every command has now been executed here**, across this round and the two before it, except the ones that need a Pi
host and the managed-install commands, which would change this machine. That is the edge of what this environment can run.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py project bind native
python dove_pi.py project update
npm run typecheck
npm test
```

## Recorded, not built

1. **Commands needing a host.**
2. **The first real turn.**