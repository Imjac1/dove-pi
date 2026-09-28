# Implementation plan: the authority matrix

## Ordered checklist

- [x] **1. The nine rows**, read.
- [x] **2. Each held against a test.**
- [x] **3. The two other items.**
- [x] **4. Holders where warranted, then the gate.**

## The nine rows and what holds them

```text
unknown target                  gates.test.ts:116  pi.test.ts:p   "blocks a target that is not in the document"
ambiguous target                NOTHING            authority.ts:321 blocks with "matches N entries"
ownership evidence              gates.test.ts:122  "blocks when ownership evidence cannot be verified"
required grant missing          gates.test.ts:135  "blocks when the required grant is missing from the document"
grant issued by the operator    gates.test.ts:143  "blocks a grant issued by the operator itself"
action not authorized           gates.test.ts:129  "blocks an action the grant does not authorize"
window / technique / intensity  gates.test.ts:151,164
external state stale            gates.test.ts:157  "blocks when an external approval is pending or stale"
unknown key, naming the key     work-mode.test.ts:487  "refuses ... an unknown key", :189 "by name"
```

## The row that nothing held, and it is the second this audit has found

**`authority.ts:321` implements it** - *"Target X is ambiguous: it matches N entries"* - and no test reached it. A holder was added to the
pentest suite, which is where the other authority cases live: it twins an entry onto the shipped document so a request naming that address
matches both, and asserts the block and the count.

## The control ran before the test was right, by accident

**The first version of the test twinned the entry but renamed its id, so only one entry matched and the test failed.** That is exactly what a
control is - the behaviour removed and the test going red - and it happened while the test was being got wrong rather than after it was
believed. The second version keeps the id and the address of the thing being matched, which is the condition the row describes.

## The other two items

**The example engagement pre-flights clean** is held by `pentest-mode.test.ts` and `host-work-mode.test.ts:325`, which load the real
`engagements/example-engagement/authority.yaml`. **The wrongly nested key is rejected by name** is held by `work-mode.test.ts:487` and
`:189`, which refuses an unrecognised class *by name rather than defaulting it*.

## What was not checked

**Scenarios 4 and 5**, unchanged from the last round, which named them unchecked.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Scenarios 4 and 5.**
2. **The first real turn.**