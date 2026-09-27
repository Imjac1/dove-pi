# Design: a pointer list, and the rule that stays

## The rewrite

```text
kept:     only blocking and regression findings are fixed in the current scope - stated as this repository rule,
          because no specification states it and it governs what a formal task fixes versus records
pointed:  findings tied to an AC-*            -> the convergence record
          two no-progress reviews, one check  -> the convergence record
          ready_to_finish stops mutation      -> the convergence record
          resources are observation-only      -> the loop specification, whose closed observable set has no resource observable
```

**Why pointers rather than deletion**: the file is a checklist a reviewer runs down, so the rules have to be visible there - what they
must not be is a second copy that can drift from the first. Naming the owner costs a clause and gives a reader the place to argue with.

**And why the scope rule is not a pointer**: it has no owner. A rule stated in one place because that is the only place is a rule; a
rule stated twice is a rule with a maintenance debt, and this round pays one of them off.
