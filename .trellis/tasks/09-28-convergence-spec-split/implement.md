# Implementation plan: the convergence record, as its own specification

## Before writing code

Load `trellis-before-dev`; read the records specification tail (the block being moved) and the loop specification (the
shape the result should have). Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [ ] **1. The move**, by range: the block out of the records specification, into the new file under a `## Scenario:`
      heading, with a short head above it.
- [x] **2. The router**: a link in the right position, a selection rule, and the budget test entry with its heading.
- [x] **3. The cross-references**: every specification named in the moved text still carries what the sentence claims.
- [x] **4. Measure**: both files, the budget test, the full suite, and the readings.

## Measured, and one prediction that was wrong in a small way

```text
personal-agent-project-context.md       24,245 -> 10,578
personal-agent-convergence-record.md     (new)     14,118
personal-agent-harness-loop.md                      22,964
personal-agent-runtime.md (router)                   4,039  (cap 8 KiB)

moved: 187 lines, verbatim apart from one heading level
```

The design expected the moved text to name other specifications and said they would be checked. Measured, **it names none**
- the body has no cross-references at all, so nothing in it could have gone stale. The only two that exist are in the head
this task wrote, and they point at the file the state stayed in and at the loop that reads the records.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| The records specification | Removing the tail could take a line that belonged to the sections above. | The boundary is a heading at column zero followed by a blank line, and the line before it is checked. |
| The budget test | A new routed specification has three places to register. | The test asserts all three: link order, the name, and the headings. |

**Rollback** is a checkout plus a file deletion.

## Recorded, not built

1. **A third specification**, if either file fills up again - which is a decision for then.
2. **The Pi-hosted turn.**