# Design: the tail, moved

## The range

From the `/**` above `export function movementKey(` (line 919) to the end of `task-convergence.ts`, moved verbatim into
`src/core/harness-verifier.ts`. What stays in the record module is the record: the types, the patterns, the event and
snapshot decoders, the reducer and its helpers - about 900 lines of a module whose subject is now single.

**Why the start is the `movementKey` doc rather than the first verification function**: `movementKey` is called only by the
verifier - `verdictFor` and the baseline read - so leaving it behind would create exactly the entangling this move removes.

## The dependency direction

```text
harness-verifier.ts  ->  task-convergence.ts     (types: TaskChange, PredictedMovement, TaskConvergenceSnapshot, ...)
task-convergence.ts  ->  harness-verifier.ts     (nothing)
```

One way, and **asserted**: a check on the record module for any import of the verifier, rather than a sentence claiming it.
A bidirectional dependency would mean the two are one module wearing two names, which is what the previous round assumed
without measuring.

## The declaration

`verifier.embedded` goes away entirely rather than being left empty: the loader already refuses an empty list ("remove it
if the verifier is fully separable"), and that refusal was written for exactly this moment. Both modules are then
`verifier.paths`, and a comment in the declaration records that nothing embeds the verifier any more.

## Verification and rollback

- **By construction**: range extraction with asserted markers, then brace balance on both files - the check that found the
  dropped brace two rounds ago and caught the wrong boundary last round.
- **By the suite**: the adapter and tests that import the moved names are the regression net, and only their import lines
  change.
- **Live**: the turn reading on three commits - one touching the record module, one the verifier module, one neither.
- **Rollback** is a checkout of the four touched files.
