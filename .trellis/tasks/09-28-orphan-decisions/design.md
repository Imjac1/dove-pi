# Design: report what cannot be placed, in the reading that is about decisions

## The line

```text
  decisions the record does not carry: chg-9   (a bounded record drops a pending verdict; the ledger keeps what happened)
```

**Printed once, near the decided list rather than inside a change block**, because an orphan belongs to no change block - and because
the point of the line is that the reader should look at the ledger, not at this change.

## Why not fold it into the change line it sits beside

Because that change is **not** the one the decision belongs to. The reading already prints "(none yet) - the next round has not been
observed" for a change with no decision, and that sentence is true; putting an orphan under it would make a true sentence read as a
false one.

## Verification

- **The fixture is the probe**, turned into a test: an orphan decision beside a change with none.
- **A second assertion holds the ordinary case**: a ledger with no orphans prints no such line, so the addition is additive.
