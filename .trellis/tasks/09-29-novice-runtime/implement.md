# Implementation plan: the novice project and initialization

## Ordered checklist

- [x] **1. The owning file.**
- [x] **2. The clean-project cases, placed.**
- [x] **3. The execution half.**
- [ ] **4. The gate.**

## The placement, answered

```text
the item        native state absence does not prevent runtime initialization or tool execution
the neighbour   project-provider.test.ts:11  "immediately healthy in a clean project without creating metadata"
                - it is a *neighbour*: it holds the health half and says nothing about execution
the runtime     src/runtime.ts is 36 lines and its own comment calls it "single composition root shared by every host adapter"
                - it exposes registries, not an invocation service, so *executing* is not its job
initialization  structural: createDoveRuntime() takes no arguments, so there is no way to hand it state
the repository  has no .dove/ at all, so *every* test that calls createDoveRuntime() already runs in a novice project
execution       exercised by real-dove-blackbox.test.ts in fourteen cases, which keeps concurrent scenarios on disjoint runtime roots
                - exercised everywhere and *named nowhere*
```

## What this round did not produce, and why

**It set out to add a named holder and did not.** Two attempts failed on the *fixture shape*: the first used an `invoke` that the runtime does
not have, and the second read `protocolVersion` off a capability definition when it is a field of the *request*. **Both were guesses about an
API I could have read**, which is the same defect as the three typecheck runs two rounds ago - and the shape was one file away, in
`capability-protocol.test.ts`: a `request(name, overrides)` helper at line 12 that builds the whole invocation.

**The file that asserted nothing was removed and the tree is clean.** The finding stands on its own: the item is *held by architecture* - the
composition root cannot be handed state - and *named nowhere*, and the next round has the shape it needs.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other items.**
2. **The first real turn.**