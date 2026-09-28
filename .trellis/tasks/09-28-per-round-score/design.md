# Design: a round becomes a record

## The shape

```typescript
appendTaskConvergenceDecision({ ..., acceptanceVector: [{ id: "AC-001", status: "passed" }], consecutiveNoProgress: 1 })
```

**Two fields, both already in the snapshot the decision path reads.** The vector is what makes a round scorable; the counter is what
makes a stagnation escapable, because "stagnation" already has a definition in this record and reusing it is cheaper than inventing a
second one.

## The axis

```text
passed per round:    2, 2, 3, 5        -> the trajectory
slope:               last - first, over the rounds between them
stagnation escapes:  rounds where the no-progress count fell after it had risen
```

**Slope as a difference rather than a fit**, because three points do not justify a regression and the contract asks for a direction,
not a prediction. **And the same shape as the SSM reading**: counts and a direction, no threshold, with the axes it cannot read named
beside it.

## What makes this a decision rather than a preference

The two candidate records were compared on what they already are: which is written at the round boundary, which one the contract owns,
and which one is written by the code holding the snapshot. The observation loses all three - and it is the resource record, where a
previous round established that resources are observation-only.
