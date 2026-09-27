# Extracting the verifier read paths

## Goal

Turn `possible` into `definite` for the verifier code that lives inside the adapter, by moving it into a module of its
own - and fix the two things the move exposed.

## Background: measured before moving

- **The code is one contiguous region.** `extension.ts:618-729` holds the verifier read paths in order:
  `unresolvedAcceptanceEvidence` (625), the refusal counts (657), the observable read (678), the assembled observables
  (700), and **the baseline a verdict compares against** (715). Only the first and the third are used outside the adapter
  (`tests/host-work-mode.test.ts` and `tests/harness-round.test.ts`), and nothing else in the adapter depends on the region
  beyond its own call sites.
- **The embedded list from the previous round was incomplete**, and the move found it: `changeBaseline` is verifier code
  - it reads the values a verdict is judged against - and it was not in `verifier.embedded`. It was written from names that
  were grepped, which is one step better than memory and still not a reading.
- **And an orphaned doc comment sits above the refusal counts**: "The harness own read of the closed observable set..."
  describes the observable read, which has its own documentation 25 lines later. A doc block with no function under it is
  the kind of thing this project keeps finding, and moving the region is the natural moment to settle it.

## Requirements

- **R1 - The region moves as one block.** From the doc comment that opens `unresolvedAcceptanceEvidence` to the end of
  `changeBaseline`, into a module whose name says what it holds. The move is by range with asserted boundaries, and the
  brace depth is checked after it.
- **R2 - No behaviour changes.** The functions move verbatim; the adapter imports them; the two tests import them from
  their new home. Their existing assertions are the regression net, and they must pass unchanged.
- **R3 - The declaration follows the code.** The four - now **five** - symbols leave `verifier.embedded` for
  `extension.ts` and the new module joins `verifier.paths`, so the reading answers `definite` for an edit to it.
- **R4 - The orphaned doc comment is resolved rather than carried.** It documents the function that already documents
  itself; the move deletes it and says so.
- **R5 - `task-convergence.ts` stays embedded**, with its four symbols still named: that half of the extraction is a
  different change, because those functions are entangled with the record reducer rather than sitting in a block.

## Acceptance Criteria

- [ ] **AC1** The new module holds the region; the adapter no longer defines any of it; the two tests import from the new
      module; the full suite passes unchanged.
- [ ] **AC2** The declaration lists the new module in `verifier.paths` and no longer names those symbols under
      `extension.ts`, and every path still resolves.
- [ ] **AC3** The turn reading answers **`definite`** for an edit to the new module and **no longer answers `possible`**
      for a commit that only touches the adapter outside the named symbols - demonstrated on a real commit.
- [ ] **AC4** The orphaned doc comment is gone, and the three remaining doc blocks each sit above the function they
      describe.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC6** The specification records the extraction, what it makes definite, and what stays embedded.

## Out of scope

- **Extracting the record module verification functions.** R5 keeps it separate and honest: it is a different shape of
  change with a different risk.
- **Moving anything else out of the adapter.** The region is the verifier read paths and nothing else was measured.
- **The Pi-hosted turn.** Unchanged.
