# Implementation plan: the applied commit

## Before writing code

Load `trellis-before-dev`; read `.trellis/spec/backend/personal-agent-harness-loop.md` (the loop contracts, and where
the procedure goes - it is the routed file an agent reads, 13.8 KiB of headroom) and
`.trellis/spec/backend/quality-guidelines.md`. Curate `implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [x] **1. Export the rule, neutrally named.** `action-policy.ts`: export `workspaceRelativeTarget` and rename
      `fencePrefixHit` to `declaredPrefixHit`, updating its call site. Run the fence suite immediately: it is the
      regression net for the rule, and it must pass unchanged.
- [x] **2. The record.** `contracts.ts` gains the kind; `execution-ledger.ts` gains `appendChangeApplied` writing
      `stepId: applied:<changeId>` and `{ changeId, commit }`.
- [x] **3. The operation.** `extension.ts`: the convergence tool gains `applied` with `changeId` and `commit`, and
      three refusals - unknown change, already applied (naming the commit), empty commit. It reads the snapshot for the
      first and the ledger for the second, and writes only the ledger record.
- [x] **4. The check.** `src/core/harness-round.ts` (new, pure): `surfaceFit` with the three answers, reusing the
      exported rule rather than reimplementing it.
- [x] **5. The reading.** `scripts/harness-rounds.mts`: read the changes from the convergence records, the applications
      and decisions from the ledger, the file list from git, and print the turn - exit 0 in every case.
- [x] **6. The status read** reports the applied commit per change, so a loop turn sees it without the script.
- [x] **7. Tests**: the check, the refusals, and the host assertion that an application is recorded once.
- [x] **8. The specification**: the applied contract, the check, and the procedure - the steps a turn is made of.

## What the check found on its first real run

The demonstration used a fixture manifest claiming `tool-implementation`, applied to a real commit from this
repository, and the check had teeth immediately:

```text
  chg-1   surface tool-implementation
    applied:    4b45f99   outside tool-implementation
    outside:    .trellis/harness-surface.yaml, tests/harness-surface.test.ts, tests/pi-adapter.test.ts
    decision:   contradicted at revision 7
                gate-refusals:fence: 3 -> 4 (prediction not met)
```

Three files outside the declared surface, and **two of them were the map's own defect**: a component implementation
surface that excludes its tests makes **every real edit** read `outside`, which would have made the check useless in
practice. The declaration was refined (`tool-implementation: [src, tests]`, and the middleware test files named), and
the same demonstration then reported one offender: `.trellis/harness-surface.yaml` itself. That one is honest and is
left alone - the map is not one of the seven components, so an edit to it is outside every surface, and a reader seeing
that is seeing something true.

**That is the loop working on itself for the first time**: the instrument found a defect in the declaration that the
instrument depends on.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
node --import tsx scripts/harness-rounds.mts
```

## Two defects this round produced, and what they cost

1. **The specification split from the previous round moved bullets by line prefix, and a wrapped bullet lost its
   continuation lines.** Reading the assembled file found three defects - two truncated lines and one garbled sentence
   replacement - and the source file kept an orphaned fragment (`do not determine a component.`). All four are fixed,
   but the lesson is recorded rather than the fix alone: **move blocks, not lines, and assert no orphan remains.**
2. **A rename of an exported helper**, `fencePrefixHit` becoming `declaredPrefixHit`, was done with the fence suite run
   immediately as the regression net: 59 tests across three suites, all green before anything was built on the rule.

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| `action-policy.ts` | Renaming a helper the fence depends on could change what the fence refuses. | The rename is mechanical, the call site is one line, and the fence suite runs before anything else is built on it. |
| The `applied` operation | An operation that records a claim without checking it could become a way to make a false claim look recorded. | The record is a claim **and the script is the check**; where the claim cannot be checked the reading says `unresolved` rather than agreeing. |

**Rollback** removes the operation, the kind and the script; applications already recorded stay readable and harmless.

## Recorded, not built

1. **Reverting**, which now has a target (`git revert <applied commit>`) and still needs a person.
2. **Checking the diff against the fix text**, which the manifest claims in prose and nothing compares.
3. **The mining gap**: three rounds have now built the loop instruments while the corpus still contains no failure, no
   refusal and no manifest, so the first real turn has to be made rather than found.