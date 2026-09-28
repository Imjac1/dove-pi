# Implementation plan: the CLI chain

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. The chain**, one step at a time with its output.
- [x] **3. The written state**, read back.
- [x] **4. Remove the fixture, then the gate.**

## The chain, run

```text
in a temporary directory, with the repository launcher by absolute path:
  project init                                   exit 0   initialized true, provider native, status healthy
  task create probe-title --description probe-desc  exit 0   operation create, a real stableId
  task status                                    exit 0
  task list                                      exit 0   the created task appears
  task create second --description d2            exit 0

what it wrote:  .dove/project.json, .dove/state.json, and per task
                acceptance.md, design.md, implement.md, prd.md, task.json
```

**It works end to end**, and the paths the earlier rounds could only *read* about are now *observed*: `.dove/state.json`,
`.dove/project.json` and `.dove/tasks/<id>/` are written by a real run, with the artifact set the mode documentation describes.

## The state, read back

```text
state.json   schemaVersion 1, revision 2 after two creates, currentGoalId set, two goals with
             id, title, description, status active, timestamps, formal true, phase intake
project.json provider native, projectRoot, adapterContract "1.0"
```

**The revision increments per mutation**, which is a declared behaviour seen for the first time rather than read.

## The one failure was mine

The first `task create` exited 1 with *Unexpected task argument: probe*, and the CLI was right: PowerShell had eaten the quotes, so
`"a probe"` arrived as two arguments and the extra one was refused. **A refusal that names the argument it did not expect is what a good
CLI error looks like**, and this one was pointing at my plumbing rather than at itself.

The fixture was removed afterwards and this repository is untouched - the only untracked path is this task.

## Validation commands

```powershell
python dove_pi.py project init
python dove_pi.py task create "probe" --description "probe"
npm run typecheck
npm test
```

## Recorded, not built

1. **Commands needing a Pi host.**
2. **The first real turn.**