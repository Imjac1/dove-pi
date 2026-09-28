# Implementation plan: the seven lists

## Ordered checklist

- [x] **1. All seven lists.**
- [x] **2. The file list.**
- [x] **3. Each item held.**
- [x] **4. The gate.**

## All seven read, and the four most specific ones held

```text
a mode declaring a gate it does not supply is refused   work-mode.test.ts and action-policy.test.ts   "names both ways out"
malformed native state is never overwritten             project-provider.test.ts:297   verbatim, plus two neighbours
a manifest citing an unknown reference is refused       harness-readings.test.ts:89    the reference is named in the failure
the provider limit numbers                              request-plan-model-gateway.test.ts:62, :283, :290
```

**Three of those four are safety-shaped**, and each is held with the property the item asks for rather than a neighbour: the refusal names
both ways out, the state is *reported but not overwritten*, and the missing reference appears in the failure message.

## The provider limits, which are claims about numbers

`request-plan-model-gateway.test.ts` holds them as numbers: `outputBudget === 4096` for the plan, a large-window request that *must not
inherit* the static 4096, and a case that **fails closed when a provider limit needs clamping but has no writable field**. **A claim with a
number in it is the easiest kind to hold**, and this list makes three.

## What was not held, named rather than implied

```text
extension-runtime 1   4 items   read, not held
extension-runtime 2   4 items   read, not held - each packs two to four claims in one line
request-runtime 1     8 items   partly: the provider-limit item held, seven not
request-runtime 2     4 items   read, not held
harness-loop          4 items   one held, three not
project-context       6 items   one held, five not
```

**Two of the remaining items point at the *Pi tool boundary*** - the fail-closed one in the convergence list and the adapter-contract one in
`request-runtime` - which is the same boundary every functional check in this session has met. **They are named, not skipped quietly.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The Pi tool boundary items.**
2. **The first real turn.**