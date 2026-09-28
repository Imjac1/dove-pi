# Implementation plan: the archived criteria

## Ordered checklist

- [x] **1. The count**, per archived task.
- [x] **2. The quotes**, so the classification is read rather than guessed.
- [x] **3. The classification.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
archived tasks with a PRD:  113
criteria ticked:            209
criteria unticked:          497
tasks with an unticked one:  88 of 113

this session (09-28-*):      73 tasks,   0 ticked,  380 unticked
before this session:         40 tasks, 209 ticked,  117 unticked
```

**The worst share is mine.** Seventy-three archived tasks from this session carry three hundred and eighty unticked criteria and not one
ticked, while the older tasks are ticked in most places - so the practice exists here and I did not follow it: the rounds updated the
checklist in `implement.md` and left the PRD alone.

## The three classes, read rather than counted

| Class | Example |
|---|---|
| a placeholder criterion | `08-28-dove-sysprompt-reasoning-voice`, whose only criterion reads *TBD* |
| a PRD whose boxes were never used | `08-30-dove-pi-prompt-agent-e2e`, eleven unticked and none ticked |
| a box simply missed | `08-30-request-middleware-optimization`, eleven ticked and one unticked |

**A number alone could not tell those apart**, which is why the criteria were quoted.

## What was fixed, and what was not

**This task own PRD is ticked**, because its criteria are met and verified in this round. **The other seventy-two are not**, and that is a
decision rather than an omission: bulk-ticking would assert that every criterion of every round was met, and **I cannot re-verify
seventy-three rounds of criteria now** - the honest record is the one that says what is known.

**No check was added.** A check that an archived PRD has no unticked box would be red on eighty-eight tasks, and one that lists them all
would be a second place to maintain. The practice is the fix: **the PRD boxes are the record, and they are ticked when the work is done**.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Active tasks**, whose boxes are open by design.
2. **The first real turn**, which needs a Pi host.