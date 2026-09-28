# Implementation plan: the project context list

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. The five items.**
- [x] **3. The two hand-run behaviours.**
- [x] **4. The gate.**

## All five, held, most of them verbatim

```text
clean project is healthy without writing metadata   project-provider.test.ts:11   "immediately healthy in a clean project without creating metadata"
native create/finish/start/archive round-trips      project-provider.test.ts:23   "creates, finishes, restarts, and archives compact native goals"
the CLI lifecycle without a Trellis runtime         task-cli.test.ts:79 and :133   "without requiring a Trellis runtime"
session records round-trip                          task-cli.test.ts:133
automatic goal establishment is idempotent          project-provider.test.ts:76, :88, :284
```

**Idempotence is held three ways**: one current goal established silently, initialisation serialised with goal creation without losing state,
and a legacy continuation imported *instead of creating a duplicate* goal.

## The two behaviours this session ran by hand are the ones the tests hold

```text
round 89  drove task create, start, finish, status, list and archive in a temporary project
round 101 drove session record and session list through the same interface
task-cli.test.ts:79   exposes task lifecycle, continuation, and structural verification
task-cli.test.ts:133  records and lists a session without requiring a Trellis runtime
```

**What was run by hand and what the suite asserts are the same two behaviours**, and one of the two cases says the thing the hand-run
specifically checked: *without requiring a Trellis runtime*.

## A bonus the list did not ask for

`task-cli.test.ts:152` - *"promotes the only remaining active goal after finishing the current goal"* - which is safety-shaped: finishing the
current goal must not leave the project with none.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other lists.**
2. **The first real turn.**