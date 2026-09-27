# The instruments enter the type gate

## Goal

Bring `scripts/` into the type check, because the four readings and every command the guide tells a person to run live there -
and the gate the project trusts its types to immediately found a live defect the moment it could see them.

## Background: how this was found, and what it found

A probe of three interruption forms printed the same line in all three outputs:

```text
    predicted:  gate-refusals:fence=undefined
```

The movement union has three arms, and the third names its target differently:

```typescript
| { readonly observable: "criterion-status"; ... readonly to: AcceptanceStatus }
| { readonly observable: "verification-state"; ... readonly to: VerificationState }
| { readonly observable: "gate-refusals"; ... readonly direction: "down" | "up" }
```

and the printer read `movement.to` for every arm - so a `gate-refusals` prediction, which is the observable the whole verdict
machinery was built around, printed as **`undefined`** in every turn output since the printer was written.

**Why the typecheck never said so**: `tsconfig.json` includes `src`, `tests` and `.pi`. It does **not** include `scripts`. Widening
it to include `scripts/**/*.mts` reports exactly two errors, and the first is that line:

```text
scripts/harness-rounds.mts(120,137): error TS2339: Property 'to' does not exist on type 'PredictedMovement'.
scripts/trellis-convergence.mts(111,42): error TS7006: Parameter 'step' implicitly has an 'any' type.
```

**The type system already knew.** The gate was pointed everywhere except at the instruments.

## Requirements

- **R1 - `scripts/` is inside the type gate**, for the reason the tsconfig comment will state: these are the commands a person
  runs and the readings the loop is judged by, and a reading that prints `undefined` is worse than one that does not run.
- **R2 - Both errors are fixed**, not excluded: the printer formats a movement by its arm, and the implicit `any` gets its type.
- **R3 - The printer fix is verified where it matters**: a turn output asserts the direction for a `gate-refusals` prediction,
  so the regression is held by a test rather than by the gate alone.
- **R4 - The widening is checked for blast radius**: the round reports what the gate found, which is two errors and no more, and
  says so rather than implying the scripts were perfect.
- **R5 - The contract records the arrangement**: the instruments are inside the gate, and a new script is expected to be too.

## Acceptance Criteria

- [ ] **AC1** `scripts/**/*.mts` is in `tsconfig.json` include, with a comment stating why.
- [ ] **AC2** `npm run typecheck` passes with the scripts included; no error is silenced with a cast or an exclusion.
- [ ] **AC3** The turn reading prints the movement target correctly for all three arms, and a test asserts the
      `gate-refusals` case.
- [ ] **AC4** The round reports the two errors it found and what they were.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **`scripts/**/*.mjs`**, the blackbox harness: it is plain JavaScript and has no types to check. Recorded rather than
  silently omitted.
- **The other probe findings**, which were the reading behaving correctly on out-of-order and twice-decided streams.
- **Moving the printer into core**, which is a question about where formatting lives rather than about types.
