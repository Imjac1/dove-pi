# Design: the arm decides, and the refusal says which

## The change

```typescript
const arm = observable === "gate-refusals" ? "direction" : "to";
const target = movement[arm];
if (typeof target !== "string") throw invalid(path + "[" + index + "] is a " + observable + " movement and needs the field `" + arm + "`.");
```

**A refusal that names the field is the point.** The old message offered both names with an "or", so a reader could satisfy it while
still writing the wrong one - and a fixture did exactly that for two rounds, because the message never said which arm it was.

## Why the blast radius is one function

Movements reach a record through exactly two doors: `parsePredictedMovement` for the tool input, and this decoder for stored
records. The first produces canonical arms and cannot mismatch; the second is the one being tightened. **The suite is the check on
that claim** rather than the reasoning: nothing this build wrote should be refused, and if something is, then the rule is wrong about
the writer rather than the writer being wrong.

## Verification

- **Both directions of the rule are tested**, because a rule tested only where it passes is a rule nobody has seen refuse.
- **The existing fixtures are the corpus**: if a stored record anywhere in this repository carries the wrong field for its arm, the
  suite fails, and that failure is the finding.
