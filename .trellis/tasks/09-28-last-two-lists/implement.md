# Implementation plan: the last two lists

## Ordered checklist

- [x] **1. The eleven items.**
- [x] **2. Each held against a test.**
- [x] **3. Unmatched items, named.**
- [x] **4. Holders where warranted, then the gate.**

## All eleven items, and every one of them is held

```text
s4 reworded and moved keep identity; a changed code does not   code-audit-vertical.test.ts:91,92   "a move must not read as a new finding"
s4 edit reads updated, deletion absent, addition new           code-audit-vertical.test.ts:70,117 all three states, in the spec words
s4 several findings, two edited, no invented findings          code-audit-vertical.test.ts                    the same suite
s4 two identical matches stay two results                      evidence-sarif.test.ts:49   "separates two identical matches by occurrence index"
s4 two runs over the same tree are byte-stable                 code-audit-seed.test.ts:67, evidence-sarif.test.ts:201   both literal
s4 only completed effects enter a checkpoint                   checkpoint.test.ts:30       completedEffectKeys asserted directly
s4 restore refuses a mode-version, tool-set or gate change     checkpoint.test.ts:58       "rather than continuing another mode work"
s5 the oversized background diagnostic is compacted            context-admission.test.ts:25  2.8 MB, payload kept out of model-visible content
s5 all three channels are compacted by the same boundary       context-admission.test.ts:47  "because the incident came through the one that was exempt"
s5 a dependency-tree diagnostic is non-actionable when short   context-admission.test.ts:75  "even when it is small"
s5 path classification does not over-reach on authored paths   context-admission.test.ts:82  verbatim
```

## The result is a negative, and that is worth saying plainly

**No item of these two lists is unheld.** The previous three rounds found two genuinely unheld safety promises - the CLI approval flag and
the ambiguous target - and this round found none, which is the answer the question can have and not a failure to answer it.

**Two things about how they are held are worth naming.** The context suite holds a boundary claim *with the reason the specification gives
for it*: *"applies to every channel, because the incident came through the one that was exempt"*. And the checkpoint suite holds the
destructive-restore refusal as a *failure to resume* rather than as a refusal to parse: *"rather than continuing another mode work"*.

## What this empties

**The list of things this audit has named and not done.** Six required-test lists were named as unchecked across three rounds, and all six
have now been read and held. What remains outside this environment is unchanged: the first real turn, which needs a Pi host.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Other specifications.**
2. **The first real turn.**