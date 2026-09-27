# Design: widen the gate, fix what it finds, hold the fix with a test

## The widening

```jsonc
"include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.mts", ".pi/**/*.ts"],
// `scripts/` is included on purpose: these are the commands a person runs and the readings the loop is judged by.
// Leaving them out meant a reading could print `undefined` for the observable the verdict machinery was built around -
// and the type system knew, in a file nobody had asked it about.
```

**Two errors, and the round names both.** A widening that reported "a few fixes" would hide whether the scripts were nearly
clean or a swamp; the number is the interesting part, and it is two.

## The printer

A movement is printed by its arm rather than by property access on the union:

```typescript
function movementText(movement: PredictedMovement): string {
	const target = movement.observable === "gate-refusals" ? movement.direction : movement.to;
	return movement.observable + ":" + movement.subject + "=" + target;
}
```

**Why not unify the field name instead**: `to` reads right for a status and wrong for a direction, and renaming a field on a
recorded vocabulary is a migration - a decision for a round that has a reason to make it, not a side effect of adding a file to a
tsconfig.

## Verification

- **The gate found it, and the test holds it**: the widened tsconfig proves the class is closed, the assertion proves this
  instance stays fixed.
- **The second error is a typing gap, not a defect**: an implicit `any` in a trellis helper, fixed by naming the parameter type.
