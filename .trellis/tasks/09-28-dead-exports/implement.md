# Implementation plan: the unreferenced exports

## Ordered checklist

- [x] **1. The exports**, from every module in src.
- [x] **2. The search**, across src and tests.
- [x] **3. The reading**, for each unreferenced name.
- [x] **4. Remove or record, then the gate.**

## The measurement, and the crude number that preceded it

```text
exported symbols in src:        742
  not referenced in another file: 272   <- the crude count, 97% noise
  mentioned nowhere at all:         9   <- including its own file
    re-exported by a barrel:        5   project-provider/index.ts
    genuinely dead:                 4   removed
after the removal:                738 exports, 5 mentioned nowhere, all five re-exported
```

**The crude count was noise** because a symbol exported *and used inside its own file* is an export nobody else needed, which is normal.
What is dead is a declaration nothing names anywhere - **and that criterion is strong, because any mention would count**, so a zero is a zero.

## What was removed, and what was not

Four were genuinely dead and are gone: a run-state union and an error helper in `core/subagent.ts`, a formatter in
`pi-adapter/thinking-policy.ts`, and a file reader in `windows-runtime/workspace.ts`. The removal was verified three ways: the typecheck is
clean, the suite is 741 with nothing failing, and the re-scan shows four fewer exports.

**Five were left alone**, and that is the limit of this measurement: `project-provider/index.ts` re-exports three modules with `export *`, so
a symbol reachable through a barrel is exported even though nothing *names* it. A text search cannot see that, which is the same limit the
module-graph round ran into from the other direction.

## Validation commands

```powershell
npm run typecheck
npm test
```

## Recorded, not built

1. **Unused locals**, which the compiler holds.
2. **The first real turn**, which needs a Pi host.