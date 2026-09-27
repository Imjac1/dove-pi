# Design: the verifier read paths, extracted

## The new module

`src/core/harness-verifier.ts` - the verifier code that lived inside the adapter, moved verbatim:

| Function | What it does |
|---|---|
| `unresolvedAcceptanceEvidence` | Resolves evidence refs against the ledger and the effect store. |
| `countGateRefusals` | The refusal counts, per atom, with composites split. |
| `changeObservables` | The observable read, from a snapshot whose refs the caller already resolved. |
| `convergenceObservables` | The same read assembled once for both consumers, with its I/O injected. |
| `changeBaseline` | The values a verdict will compare against - **verifier code the previous round embedded list missed**. |

**Nothing about the code changes.** The functions move verbatim, the adapter imports them, and the two tests that use them
import them from the new home. Their existing assertions are the regression net, which is what makes a verbatim move
verifiable rather than hopeful.

## What the move settles on the way

- **The declaration gets more definite**: the new module joins `verifier.paths`, the five symbols leave
  `verifier.embedded` for `extension.ts`, and an edit to any of them now reads `definite` instead of `possible`.
- **An orphaned doc comment goes.** A block describing the observable read sits above the refusal counts, whose own
  documentation follows it; the function it describes documents itself 25 lines later. The move deletes it and the commit
  says so, because a doc block with no function under it is a defect however small.
- **`task-convergence.ts` stays embedded**, with its four symbols named. That extraction is a different shape: those
  functions are entangled with the record reducer, and pretending the two are one change would make the blast radius of the
  easy one and the hard one indistinguishable.

## Verification and rollback

- **By construction**: the block is taken by range from an asserted start to an asserted end, and the brace depth of both
  files is checked after the move - the tool that found last round dropped brace in one run.
- **By behaviour**: the full suite, whose two verifier-using tests did not change except for their import line.
- **Live**: the turn reading on a fixture whose commit touches the adapter and on one that touches the new module, answering
  `none`-or-`possible` for the first and `definite` for the second.
- **Rollback** is a `git checkout` of the three touched files: the functions have no new behaviour to unwind.
