# Design: make the hole visible, and use the decoder that already exists

## The axis

```text
  requests (request.terminal records)............. 1
    clean (completed)............................. 0
    ...
    unclassified (a reason this build does not carry).. 1
  crash-free ratio (clean / clean + failure)...... no data
```

**One extra line, and it makes the sum an invariant a reader can check.** The alternative - adding a fifth class - would say the
run belongs to a category, and it does not: it belongs to *no* category this build knows, which is different information and
the reason the count belongs beside the classes rather than inside them.

**Why not widen the vocabulary**: a reason from a future version is not a new kind of ending, it is evidence that this build and
the ledger disagree about the vocabulary - and that disagreement is the thing worth printing.

## The turn reading

```typescript
// before: a cast that a string satisfies, because a string is iterable
const parsed = JSON.parse(readFileSync(file, "utf8")) as { changes?: readonly TaskChange[] };
// after: the decoder that already owns this format
const snapshot = decodeTaskConvergenceSnapshot(JSON.parse(readFileSync(file, "utf8")));
```

**The count of skipped records is printed**, because a turn reading that silently drops a task is a reading whose output cannot be
trusted to be complete - and the round-25 lesson is that the *reader* is where that honesty belongs.

## Verification

- **Both fixtures are already built**, and both are regression tests: the axis one asserts the sum invariant, the reading one
  asserts exit 0 and the absence of a fabricated count.
- **The axis change is additive**: a complete ledger prints the same numbers plus a zero line, which the existing suite checks.
