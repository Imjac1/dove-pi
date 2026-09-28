# Implementation plan: the pattern and the list

## Ordered checklist

- [x] **1. The count.**
- [x] **2. The remaining conclusions.**
- [x] **3. The cheap untested one.**
- [x] **4. The gate.**

## The count runs, and the count is meaningless

```text
journal-1   0 lines match
journal-2  53 lines match, and they are varied: needs a Pi host, no check can judge,
           prose cannot be checked, the remaining ones are typed or are free text
journal-3  37 lines match, and almost all of them are the same sentence:
           "The first real turn, which needs a Pi host and a formal native task."
```

**The journal `next-step` field repeats a standing conclusion every round**, so thirty-seven matches are one conclusion restated thirty-five
times. **A count over that field measures the field, not the pattern** - which is the session own rule about counts arrived at from the other
side: *a count of what something declares is a claim with no reader*, and **here even the count is unreadable**.

**So the measurement failed, and saying so is the result.** Counting a pattern in prose needs the prose to vary; the journal boilerplate is
exactly what a count cannot use.

## What the record does support

**The pattern itself is real and it is documented case by case, not by count**: three falsifications in four rounds.

```text
round 134   the timeout firing: made checkable rather than declared unreachable
round 142   the fallback: declared not checkable from outside, falsified in round 152
round 154   update --check: declined for a network that exists
```

## And the list is one item, whose reason has now been tested

**The remaining can-not-be-done conclusion is the first real turn**, and its reason changed shape two rounds ago: it is not that the turn is
unreachable, because `update --check` shows Pi is installable from here. **It is that installing it changes this machine**, and the line this
environment stops at is *may this machine be changed* rather than *can this task be done*. **That reason was tested; the list is otherwise
empty.**

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **Anything that changes the machine.**