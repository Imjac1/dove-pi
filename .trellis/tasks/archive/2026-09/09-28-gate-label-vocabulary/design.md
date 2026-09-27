# Design: one declaration, and the two directions a type cannot cover

## The shape

```typescript
export const GATE_LABEL_NAMES = ["deny", ..., "effect-claim", "intensity"] as const;   // the declaration
export type GateLabel = (typeof GATE_LABEL_NAMES)[number];                            // derived
export const GATE_LABELS: ReadonlySet<string> = new Set(GATE_LABEL_NAMES);            // derived, for the existing callers
```

One source, so the union and the set cannot disagree; the parser that validates `gate-refusals` predictions keeps taking the
set, and the producers take the union.

## Which direction each check covers

| Direction | Covered by |
|---|---|
| a producer writes a label outside the vocabulary | **the typecheck**: the label a refusal carries is a `GateLabel` |
| the policy gate list names a label outside it | **a test**, because the list is data whose entries come from gate objects with wider ids |
| the vocabulary names a label no producer writes | **neither** - the type rejects new labels rather than unused ones, and a text scan for the strings is the weak form this repository withdrew once |

**The third row is the honest one.** Three earlier rounds verified the ten labels by hand; the eleventh was found the moment a
producer was typed against the set, and no check would have found a **twelfth that nobody writes**. The contract says so.

## What was tried and reverted

`ActionGate.id` was typed as `GateLabel` first, and the typecheck refused: the loop gate is a general abstraction whose ids are
test doubles (`test-gate`, `throwing`, `broken`), while the policy gates are the ones whose ids reach the ledger. Typing the
interface would have coupled a general abstraction to a record vocabulary to catch nothing. It was reverted, the label stayed
typed, and the two policy call sites now pass the literal they were already passing through a gate object.

## Verification

- **The typecheck found a live drift**, which is the verification: `intensity` was refused by the compiler before any test ran.
- **The affected suites** (action policy, loop gate, change verdict: 50 tests) pass with the two literal substitutions, which is
  the evidence that the behaviour is identical.
