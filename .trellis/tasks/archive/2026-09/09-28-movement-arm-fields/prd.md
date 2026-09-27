# Each arm names its target its own way

## Goal

Make the decoder enforce the arm a movement declares, because accepting either field name for either arm is what let a wrong
fixture look right.

## Background: the measurement

```typescript
// task-convergence.ts, decoding a stored movement
const target = movement.to ?? movement.direction;
if (typeof target !== "string") throw invalid(path + "[" + index + "] needs `to` or `direction`.");
```

So a `gate-refusals` movement carrying `to: "down"` is accepted and normalised, and a `criterion-status` movement carrying
`direction: "passed"` would be accepted too - whatever the value happens to be, as long as *some* target is present.

**That tolerance is not theoretical.** A test fixture written for the turn reading carried
`{ observable: "gate-refusals", subject: "fence", to: "down" }` for two rounds. The decoder accepted it, the reading normalised
it, and the fixture looked correct because the printer was reading the same wrong field. The arm vocabulary is the one thing that
would have disagreed.

## Requirements

- **R1 - The arm decides the field.** A `criterion-status` or `verification-state` movement carries `to`; a `gate-refusals`
  movement carries `direction`. Anything else is refused.
- **R2 - The refusal names the field that observable needs**, because a message offering both names with an "or" is a message
  that lets the reader satisfy it while still writing the wrong one.
- **R3 - Nothing the host writes becomes invalid.** Movements are written by `parsePredictedMovement`, which produces exactly one
  arm, so no record this build wrote can be refused by the stricter rule - and the suite is the evidence.
- **R4 - The rule is tested by its cases**: the right field per arm passes, the wrong field per arm is refused with a message that
  names the right one.
- **R5 - The contract records the rule** where the movement union is documented, so the next person to add an observable knows the
  arm carries the rule.

## Acceptance Criteria

- [ ] **AC1** The decoder refuses a movement whose arm does not match its field, naming the field the arm needs.
- [ ] **AC2** Both arms still decode correctly for their own field, and the existing suite passes unchanged.
- [ ] **AC3** A test asserts each direction of the rule.
- [ ] **AC4** The union comment states that the field name belongs to the arm.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **Renaming a field to unify the arms.** `to` reads right for a status and wrong for a direction, and renaming a recorded
  vocabulary is a migration rather than a fix.
- **Refusing extra fields beyond the target.** The arm rule is the one that failed; a general strictness pass is a different
  decision with its own blast radius.
- **The tool input path**, which parses text and cannot express an arm mismatch.
