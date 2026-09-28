# Implementation plan: the mode format list

## Ordered checklist

- [x] **1. The file list.**
- [x] **2. Each item, held or named.**
- [x] **3. The checkability answer per item.**
- [x] **4. The gate.**

## All eight items, and the checkability answer for each

```text
item                                            held by                        checkable?
a well-formed three-file mode loads             work-mode.test.ts:69           yes, verbatim in the case name
unknown fields in five places                   :78, :84, :165, :197, :487      yes, five cases for five places
each required field when absent                 :89, :95, :388, :477            yes, four cases
a YAML block scalar description                 :119                           yes - and the case cites the round-trip it broke
the mode id that must not appear in core        nothing                        NO - qualified last round, and not checkable as written
a gate declared and not supplied; none          :216, :222, :228, :233, :239    yes, the whole gate matrix
an excluded technique, an over-ceiling phase    :354, gates.test.ts:164,        yes, three cases across two suites
                                                action-policy.test.ts:318
ask_before, and an unlisted action              :361, :383, action-policy:210  yes, :361 is verbatim
```

## The checkability question, answered per item

**Seven of eight are checkable, and they are checkable because they are behavioural**: a load, a refusal, a parse. **One is not**, and it is the
one the last round qualified - and the difference is the same one that round drew: **a *behaviour* can be exercised, and a *statement about
the shape of a codebase* can only be approximated.**

**A case name that carries the item own words is the strongest form here**: *"loads a well-formed three-file mode"*, *"handles a YAML block
scalar description, the shape that broke a real adapter round-trip"*, and *"answers an unlisted action with the stance the mode declared, and
with nothing else"*.

## The list is finished, and what that means

**Every item of the mode-format list is now accounted for**: seven held, one qualified as unholdable. **No item was left as a count.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Checks that cannot exist.**
2. **The first real turn.**