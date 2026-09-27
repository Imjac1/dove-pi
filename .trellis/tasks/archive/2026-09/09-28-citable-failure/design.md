# Design: a citable failure, and a manifest that resolves it

## Boundaries

| Piece | File | Why there |
|---|---|---|
| The reference | `src/core/failure-reading.ts` | The record comes from a ledger record; the reference is that record identity, and the reading is what has it. |
| The resolve | `src/pi-adapter/extension.ts`, the change branch | The adapter is the layer that can read the ledger - the same layer the pass path refuses in, and the reason the rule exists there. |
| The print | both reading scripts | A person copying the reference into a manifest is the consumer the loop actually has. |

## The reference, and why it is taken rather than built

```typescript
readonly evidenceRef: string;   // "ledger:" + the step id of the record the failure came from
```

**Taken from the record, not reconstructed.** The ledger writer names a terminal `request:<requestId>`, so
`ledger:request:<requestId>` would resolve today - but that is the writer naming convention, and a reader that depends on
it has a second copy of a rule the writer owns. The reading carries the actual step id, and the reference is that string
with the `ledger:` prefix the resolver already looks for.

## The resolve, and the rule it reuses

The change branch resolves `failureEvidenceRef` through `unresolvedAcceptanceEvidence` - **the same function the pass
path uses** - and refuses when it comes back unresolved, naming the reference. Reasons this is the right shape:

- the pass path already says it in a comment: *"a well-shaped ref to a record the harness never wrote is the same
  assertion in the right costume, and only the layer that can read the ledger can tell the difference"*. A manifest
  naming a failure that does not exist is that assertion, one operation over;
- one resolver, two callers: a second implementation of "does this ref resolve" is exactly the drift this record keeps
  paying for;
- and it stays a **shape** rule in `core` plus a **resolution** rule in the adapter, which is where the ledger is.

## What this does not do

It does not let this environment record a manifest: there is no `.dove/` here, so no formal native task, and the tool
refuses without one. What it does is make the two instruments agree, and the host harness proves the agreement the same
way it proves everything else - by driving the tool with a ledger in front of it.

## Verification and rollback

- **Unit**: the reference is the record step id with the prefix, and a failure carries it.
- **Host**: a manifest citing a failure the ledger does not hold is refused with the reference named; the existing
  manifest assertions still pass, which is the regression net for the resolve.
- **Rollback** removes the field and the resolve: the shape rule is untouched, so a manifest records exactly as it did
  before. The one behavioural change is that an unresolvable reference now fails, which is the point.
