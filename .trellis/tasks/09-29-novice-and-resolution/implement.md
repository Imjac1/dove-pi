# Implementation plan: the novice project and the exact resolution

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. The native-absence item, and whether the clean-project case is it.
- [x] **3. The resolution item, both halves.
- [x] **4. The gate.**

## The resolution item: one half held, the other unheld and observed by hand

```text
required-argument validation   capability-protocol.ts:85 and :104 carry requiredArguments
                               held by capability-protocol.test.ts:109 - "enforces each capability advertised parameter schema before execution"
exact resolution               CapabilityRegistry.require at capability-registry.ts:21
                               throws "Unknown capability: <name>" at :23
                               no test asserts it: the seventeen uses of require are calls, not assertions about it
```

**The registry is twenty-six lines and all four of its behaviours are visible**: `register` refuses a duplicate, `get` returns undefined,
`list` enumerates, and `require` throws for a name it does not hold. **Only the last of those is about resolution, and nothing holds it.**

## And this session ran that refusal by hand, four rounds into the audit

**Round 88 drove `capability run no.such_capability` through the rpc interface and recorded the answer**: *Unknown capability:
no.such_capability*. **So the behaviour is not merely implemented - it was observed, by a round that was not looking for it, and no test
asserts it.** That makes it the fourth candidate unheld promise this audit has found, and the first one with a *recorded observation* beside
it rather than only a reading.

## The two items not reached, named

**The native-absence item was not reached, and neither was the question of whether the clean-project case is the item or a neighbour.** The
round found a fourth unheld promise instead and spent its calls there. Both are named rather than left to look done.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The other items.**
2. **The first real turn.**