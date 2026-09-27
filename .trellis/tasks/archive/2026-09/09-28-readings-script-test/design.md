# Design: one fixture, four scripts, one process each

## The fixture

```text
<tmp>/state/execution.jsonl          request.received, gate.refused, request.terminal (failed),
                                     change.applied, change.decided       <- one request, one failure, one turn
<tmp>/project/.dove/tasks/t1/
              convergence.json       one change, its prediction, its baseline, and the application
```

**Why the ledger holds a refusal before the failure**: it is what makes the failure reading attribute a component, and the
component is what makes the declaration `verifiedBy` reach the record as the behaviours to preserve. A fixture without it
would assert a weaker reading and quietly stop testing the link between the declaration and the mining half.

## The invocations

| Script | Argument | What is asserted |
|---|---|---|
| `harness-failures.mts` | the ledger | the mechanism, the `cite:` reference, and the `preserve:` list |
| `harness-axes.mts` | the ledger | the SSM heading, the ratio, and the isolation refusal count |
| `harness-corpus.mts` | the temp root | the ledger count for the root it walked, and the failure count |
| `harness-rounds.mts` | the fixture project | the change, the applied commit, the verifier answer, the decision |

**Each is spawned as a process** (`execFileSync` with `--import tsx`), which is the shape `tests/harness-effect-claim.test.ts`
already uses. In-process imports would test the modules, and the modules are the layer that already has tests: what was
untested is the script around them.

## The second case, which is about the failure mode

Four paths that do not exist, one per script, asserting **exit 0 and a sentence saying what was not found**. The scripts were
written that way on purpose - a reading that dies on a missing ledger is a reading nobody runs twice - and until this file that
property was a sentence in a comment.

## Verification

- **The test is the verification**, and it is the first to reach this layer: it passed on its first run against the scripts
  as they stand, which is the outcome to want from a test written after the code.
- **No script changes.** AC4 says so, and a test that needed one would mean the test was wrong about the interface.
