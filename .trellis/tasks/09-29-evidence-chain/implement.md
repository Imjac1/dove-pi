# Implementation plan: the evidence chain

## Ordered checklist

- [x] **1. The commits the index names.**
- [x] **2. Each resolved or named.**
- [x] **3. The index against the archive.**
- [x] **4. The gate.**

## The chain, verified

```text
index rows                     176   one per session
distinct commits named         346   and every one resolves - none is unresolved
archived tasks on disk         182   and the previous round counted 181 task.json files, before this round archived one more
```

**Every commit the record names exists in this repository.** That is the one claim about the session own work that this environment can check,
and it holds: the index, the journal and the archive agree with each other and with `git`.

## What is left, said plainly

**Reachable work is done.** Over this span the session read every behaviour table and required-test section in the specifications, ran every
command and subcommand, drove both headless interfaces, measured the approval boundary and the read-only switch, ran every script in
`package.json`, and held or qualified every claim it read. **It found and fixed one defect** - a kill that raised `EINVAL` on Windows -
**closed four unheld promises with cases**, and **recorded two claims that cannot be checked and two script entries that do not work**.

**What remains is not work this environment can do**: the first real turn, which needs a Pi host. **And the honest form of that statement is
not a task** - there is nothing here to read, run, measure or fix that has not been - **which is why this round changed no file but its own
record.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Anything unresolved.**
2. **The first real turn.**