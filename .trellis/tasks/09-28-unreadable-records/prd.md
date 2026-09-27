# A ruler and a reading must not swallow or invent what they do not understand

## Goal

Make the two failures this round measured impossible: a terminal the vocabulary does not carry disappearing from the axis, and a
convergence record the decoder would refuse being cast into one and counted as four characters.

## Correction: the first of the two findings was mine, not the code

**The axis finding is withdrawn.** The core reading already carries `unclassifiedTerminals` (`harness-axes.ts:91`, whose own comment
says "counted and surfaced"), the printer prints it (`harness-axes.mts:42`), and the axis suite asserts it. My measurement called it
a hole because **my own output filter searched for "unclassifiable"** and the line says "unclassified" - so the one line that made the
arithmetic add up was the line I hid from myself. That is the second measurement mistake in two rounds and both were mine: a pipeline
that killed the process last round, a filter that hid a line this round. **The code was right; the ruler was right; I was wrong.**

## Background: the measurement that stands

**The turn reading casts a record instead of decoding it.** `harness-rounds.mts:43` asserted the parsed JSON into a shape with
`changes?: readonly TaskChange[]`, and a record carrying `changes: "none"` satisfied the assertion because a **string is
iterable**: it produced four characters, the script printed `changes recorded: 4`, and then died on `change.id` with exit 1.

(For the record, the withdrawn probe read:)

```text
requests (request.terminal records)............. 1
  clean (completed)............................. 0
  recovered..................................... 0
  interrupted................................... 0
  failure....................................... 0
crash-free ratio (clean / clean + failure)...... no data
```

One equals zero plus zero plus zero plus zero. The guard at `harness-axes.ts:115` keeps a future reason from crashing the reading
and then drops it: **a run that ended in a way we do not understand is invisible in the ruler built to expose exactly that**.

**2. The turn reading casts a record instead of decoding it.** `harness-rounds.mts:43` asserts the parsed JSON into a shape with
`changes?: readonly TaskChange[]`, and a record carrying `changes: "none"` satisfies the assertion because a **string is
iterable**: it produces four characters, the script prints `changes recorded: 4`, and then dies on `change.id` with exit 1.

Both are the class this repository keeps finding: a second, weaker implementation of a rule that already has one. The axis has
`TERMINAL_CLASSES` and the guard beside it; the record has `decodeTaskConvergenceSnapshot`, which is total and typed, and the
script reached past it with a cast.

## Requirements

- **R1 - The axis counts what it cannot classify**, in its own line, so that the classes plus that count equal the terminal
  total - and a reader can see that one run ended in a way this vocabulary does not name.
- **R2 - The invariant gets a test**: for a ledger with an unknown reason, the four classes plus the unclassifiable count equal
  the terminal count, and the ratio is still over what it could classify.
- **R3 - The turn reading decodes through the shared decoder.** The cast goes, and a record the decoder refuses is skipped with
  **a sentence saying how many were skipped**, because a reading that silently drops a record is the round-25 problem in another
  file.
- **R4 - A fixture with `changes` that is not an array**: the reading exits 0, prints no fabricated count, and says it could not
  read the record.
- **R5 - The contract states both rules**, in the two documents that own the subjects: the ruler completeness where the axis is
  documented, and one decoder where the record format is.

## Acceptance Criteria

- [ ] **AC1** The axis prints the unclassifiable count, and the four classes plus it equal the terminal count.
- [ ] **AC2** The test asserts that invariant and the unknown-reason case.
- [ ] **AC3** `harness-rounds.mts` decodes instead of casting, says how many records it skipped, and exits 0 on the bad fixture.
- [ ] **AC4** The regression test covers the bad `changes` value, asserting no fabricated count is printed.
- [ ] **AC5** Both contracts state their rule, and the gate passes: typecheck, the suite, the installer tests, doctor and the
      spec budget test.

## Out of scope

- **Widening the terminal vocabulary.** An unknown reason is a fact about a version, not a reason to add a class.
- **Refusing to print anything when a record is unreadable.** The reading reports what it could read and says what it could not.
- **The other four readings**, which do not decode convergence records.