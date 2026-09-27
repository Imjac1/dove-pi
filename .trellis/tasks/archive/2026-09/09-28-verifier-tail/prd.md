# The verifier tail leaves the record module

## Goal

Finish the verifier declaration: move the verification tail out of the record module so that **no verifier code remains
embedded** in a file that is otherwise something else.

## Background: the measurement, and the claim it corrects

The previous round recorded that these functions are "entangled with the record reducer", and treated that as the reason to
stop. Measured, that is **wrong**:

- **The record side never calls them.** Searching the first 930 lines of `task-convergence.ts` for the four names finds
  only two **doc-comment** mentions and the definition of `movementKey` - no call sites at all.
- **The tail is self-contained.** From `movementKey` (919) to the end (1,098) the module holds the verification vocabulary
  and arithmetic: `parsePredictedMovement`, `movementFromParts`, `verificationStateOf`, `ChangeVerdict`,
  `ChangeObservables`, `ChangeVerdictResult`, `readObservable`, `movementHeld`, `verdictFor`, `DecidedChange`,
  `decidableChanges`.
- **And `movementKey` belongs to the verifier**: nothing in the record side calls it - its only callers are `verdictFor`
  and the baseline read, both verifier code.

So the honest reason the second half was not done is that it had not been measured, and once measured it is the same shape
as the first half: one block, verbatim, with the imports updated.

## Requirements

- **R1 - The tail moves verbatim into the verifier module**, from the `movementKey` documentation to the end of the file, and
  `task-convergence.ts` keeps the record: the types, the patterns, the decoders, the reducer and its helpers.
- **R2 - The dependency direction stays one way.** The verifier imports the record types it needs; the record module
  imports nothing from the verifier. That is what makes the two separable rather than merely co-located, and it is checked
  rather than assumed.
- **R3 - The declaration empties `verifier.embedded`.** After this move no verifier code lives inside a file that is
  otherwise something else, so the list has nothing to declare - and an empty list that says so is better than a list with
  stale entries.
- **R4 - The consumers follow.** The adapter and any test that imported the moved names import them from the verifier
  module, and nothing else about them changes.
- **R5 - The move is by range with asserted boundaries**, and both files are checked for brace balance after it, because
  the last two moves each needed a second attempt.

## Acceptance Criteria

- [ ] **AC1** The verifier module holds the tail; the record module no longer defines any of it; the full suite passes
      unchanged.
- [ ] **AC2** No import in `task-convergence.ts` resolves to the verifier module, asserted rather than eyeballed.
- [ ] **AC3** `verifier.embedded` is empty and says why, with `verifier.paths` naming both modules - and every path resolves.
- [ ] **AC4** The turn reading still answers `definite` for a commit touching the record module and for one touching the
      verifier module, and `none` for one touching neither.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC6** The boundary contract records that the verifier is now declared entirely by path, and the correction to what
      the previous round said about the tail.

## Out of scope

- **Splitting the verifier module further.** It is a module of readings and verification; if it grows, that is its own
   decision.
- **Moving the record types.** They are the vocabulary both sides share, and they belong where the record is written.
- **The Pi-hosted turn.**
