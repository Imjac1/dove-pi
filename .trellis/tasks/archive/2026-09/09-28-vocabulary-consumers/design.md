# Design: three small typings and one stated exception

## The changes

| Site | From | To | What it catches |
|---|---|---|---|
| `execution-ledger.ts`, `appendChangeDecided` | `verdict: string` | the verdict union | a caller writing a verdict the vocabulary does not carry |
| `harness-axes.ts`, `ISOLATION_CONTROLS` | `ReadonlySet<string>` | `ReadonlySet<GateLabel>` | a label renamed in the vocabulary while the axis keeps its own two |
| the *reader* of the decision record (the adapter) | `String(details.verdict ?? "")` | unchanged | old records hold what they hold; a reader that insists is a reader that breaks on history |

**The reader staying a string is the point, not an oversight.** The writer is the party that must not invent a value; the
reader of an append-only ledger must survive whatever is already there. Typing both ends would make a historical record
unreadable by a build that tightened the vocabulary, which is the opposite of what a record is for.

## The channel that cannot be typed

A refusal gate may be a **composite**: `extension.ts` falls back to `gates.join("+")` when a reason carries no `[label]`
prefix, and `deny+scope+registered+ask` is a legal ledger value that the axis splits into atoms. So the channel is `string`,
and **a typo in a computed label is covered by nothing** - not the typecheck, and not the reader, which will happily count a
label nobody else has heard of. A template-literal type would need a recursive definition to cover a composite of any length,
and it would check a value the reader already decomposes; the contract says so instead of implying coverage.

## Verification

- **The isolation typing is verified by making the mistake**: rename `fence` in the vocabulary, watch the typecheck fail at the
  axis, revert. A check nobody has seen fire is a check whose wiring is unproven.
- **The decision channel is verified by the suite**, whose assertions on the recorded verdict would fail if the adapter and the
  record disagreed about the value.
