# Implementation plan: the manifest and the verdict

## Ordered checklist

- [x] **1. The shape and the location.**
- [x] **2. The writer and the reader.**
- [x] **3. The decision.**
- [x] **4. The read, if it is written, then the gate.**

## What a manifest is, read before anything was written

```text
task-convergence.ts:919   export interface TaskChange          <- the shape a manifest satisfies
task-convergence.ts:1069  verdictFor(change, current)           <- the comparison
extension.ts:389          changeManifestFromPiInput(input)      <- the tool that assembles one
harness-rounds.mts:108    "No change manifest in this workspace" <- the reading, when the ledger holds none
```

## The decision, on the evidence: not written

**A manifest is not a file. It is what the agent tool submits, and where it lands is the ledger**, as a `change.applied` record carrying a
`TaskChange` with the revision it was recorded at.

**So a manifest written by hand is a ledger record written by hand - and that is exactly what the tests already do.** The readings suite builds
a fixture ledger with `change.applied` and runs `harness-rounds.mts` against it, asserting the `applied:` line and the outside list. **The
downstream half is covered**; writing one here would be the fourth round this session to find the thing already exercised.

## What a by-hand manifest could not test, stated because it is the point

**It could not test the tool that writes one.** `changeManifestFromPiInput` is assembled from what the agent sends through a tool call, and
there is no agent here. **That is the half this environment cannot reach**, and it is the same boundary every functional check in this session
has met: the writing side of anything the model drives.

**And what the round did produce is the boundary stated precisely**: the verdict machinery is reachable and exercised, and the manifest
production is not.

## Validation commands

```powershell
node --import tsx scripts/harness-rounds.mts <workspace>
npm run typecheck
npm test
```

## Recorded, not built

1. **The writing tool**, which needs an agent.
2. **The first real turn.**