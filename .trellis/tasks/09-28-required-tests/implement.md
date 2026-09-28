# Implementation plan: the required-test lists

## Ordered checklist

- [x] **1. All six lists**, read.
- [x] **2. The adapter parity question.**
- [x] **3. The items held against tests.**
- [x] **4. Holders where needed, then the gate.**

## All six lists, and what was checked

```text
scenario 1  the gate                 6 items   CHECKED  all six held
scenario 2  authority grant graph    3 items   NOT CHECKED
scenario 3  effects                  5 items   PARTLY  one read and held literally, four not checked
scenario 4  identity                 7 items   NOT CHECKED
scenario 5  context                  4 items   NOT CHECKED
scenario 6  capability scope         5 items   CHECKED  all five held
```

## The adapter parity question, answered: it is held

**The previous round said the item *the external adapter satisfies the same cases* had no holder by that name.** It does, and the name is the
specification own wording:

```text
tests/pi-agent-core-adapter.test.ts:63   executes an action when the gate allows it
                                :69   blocks the action in Pi own pre-execution hook, and the reason reaches the transcript
                                :76   records the invocation for allowed actions too, so an off-path gate stays detectable
                                :85   applies the framework own guards, so the guarantees do not depend on which loop is running
```

**Four cases, two of them the paired halves and one the parity claim itself.** The previous round searched for the phrase *external adapter*
and found nothing, which is the fourth time this session has confused *no match for my pattern* with *no holder*.

## The two lists that were checked are held in the specification own words

**Scenario 6, all five**: *"denies an action the issuing agent does not hold, however plausible the name"*, *"which is the delegation case"*,
*"including by claiming a broader resource"*, *"stops honouring an expired capability"*, and *"exposes no path that renders the capability set
into model-visible text"*. **Scenario 1 item 6** is held by practice rather than by name: the host suite opens a request with
`before_agent_start` in eleven cases, *the way the host does*, and `:674` enforces a mode sandbox claim at the tool boundary.

**Scenario 3 item 3 is held literally**: `effect-ledger.test.ts:86`, *"executes exactly once when several resumers race for the same
effect"*.

## What was not checked, named rather than implied

**Scenarios 2, 4 and 5 in full, and four items of scenario 3.** Their keyword searches returned 34 to 124 candidates each, and a wide count is
a candidate list rather than an answer - so the honest report is that they are unchecked, not that they are held.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Judging a holder.**
2. **The first real turn.**