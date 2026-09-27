# Implementation plan: the tail, moved

## Before writing code

Load `trellis-before-dev`; read the record module tail and the verifier module (both are edited). Curate
`implement.jsonl` / `check.jsonl`.

## Ordered checklist

- [ ] **1. The move**: one range, asserted at both ends, brace-counted after. The row of the file that ends the record is
      checked to be a closing brace.
- [ ] **2. The imports in the verifier module**: the record types it needs, and nothing else.
- [ ] **3. The consumers**: the adapter and the tests that imported the moved names.
- [ ] **4. The direction check**: no import in the record module resolves to the verifier, asserted in a test rather than
      written in a comment.
- [ ] **5. The declaration**: `embedded` removed, both modules as paths.
- [ ] **6. Tests, typecheck, the three-commit reading.**

## What this task turned into, and why that is the honest record

**The plan was refuted by measurement, twice, and the deliverable changed.**

1. **The first measurement was too narrow.** Searching the record module for the four verification function *names* found no
   call sites, and the plan was written on that: "the tail is self-contained, so move it". The move then failed on
   identifiers - the tail does not call the record functions, it calls the record **vocabulary**: the id patterns, the
   closed sets, and the refusal constructor. Those could have been exported, and that alone would not have stopped it.
2. **The second measurement found the real wall.** `movementFromParts` - which parses a movement from its parts - is
   called by the **record own decoders** as well as by the parser. That makes the sharing bidirectional, and it means the
   separation needs a **third module** holding the movement vocabulary, imported by both sides. That is a different change
   from moving one block, and it is the thing a plan has to be written about.
3. **So the move was reverted**, and the two things worth keeping were written where they belong: the declaration embedded
   entry now carries the measured reason, and the boundary contract carries it too - including a note that its earlier
   sentence ("entangled with the record reducer") was **a guess that pointed at the right answer for the wrong reason**, and
   that the wrong reason is what made this attempt look cheap.

**A task that ends by improving the record instead of the code is still a task done**, and the alternative - forcing the
extraction by exporting record internals until it compiles - would have made the dependency direction bidirectional in
practice while the contract claimed it was one-way.

## Validation commands

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files

| File | Risk | Mitigation |
|---|---|---|
| `task-convergence.ts` | Cutting a block from the end can take a brace, or leave a type the record still needs. | Asserted start, brace balance after, and the suite - the decoders exercise the record types. |
| The adapter | Its import of the moved names is one line; the suite is the net. | Only that line changes. |

**Rollback** is a checkout of the touched files.

## Recorded, not built

1. **A direction check as a permanent gate** - this round asserts it in a test; making it part of the reachability walk
   would be a change to that gate.
2. **The Pi-hosted turn.**