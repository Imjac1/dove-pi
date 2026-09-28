# Implementation plan: the three answers

## Ordered checklist

- [x] **1. The answering function.**
- [x] **2. The tests, by its name.**
- [x] **3. The comment neighbourhood.**
- [x] **4. The gate.**

## The three answers, held where they live

```text
inside      harness-readings.test.ts:291   applied: <sha> inside <surface>
unresolved  harness-readings.test.ts:281   applied: 0000000 unresolved   "a commit git cannot resolve reads unresolved"
outside,    harness-surface.test.ts:37, 90, 105, 110   four cases calling unresolvedSurfaceEntries and
  offenders named                                       asserting the exact entries it returns
```

**And the reading suite documents a fourth answer it cannot reach**: `applied: <sha> surface declared` is unreachable from a valid record,
because the decoder validates a surface against the union the code carries. **The item asks for three answers and there are four**, which the
suite says in the comment rather than leaving the gap unexplained.

## The answering functions, found by asking for exports

`unresolvedSurfaceEntries` (`src/core/harness-surface.ts:165`) is the function that *names what does not resolve*, and the module error code
vocabulary includes `"unparseable"` - which is the *commit nobody could read* half of the item. **Neither word appears in the item**: the item
says *offenders named* and *nobody could read*, and both answers were found by reading what the module exports.

## And the client-account lead was a false positive, of the class this session keeps finding

**The only hit for the client-account item was the word *account* inside the comment *"an honest account of why it is not here"*** - a comment
about the *fourth surface answer*, not about a client account at all. **A word-search found a homonym and I recorded it as a neighbour.**

**So that item is still not located**, and it is named as such. **The ninth word-search failure and the fifth false positive**: the count is
now part of the record rather than a lesson to be relearned.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The request-runtime lists.**
2. **The first real turn.**