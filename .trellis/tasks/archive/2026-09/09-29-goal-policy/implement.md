# Implementation plan: the goal-tool policy

## Ordered checklist

- [x] **1. The tool response.**
- [x] **2. The repository.**
- [x] **3. The behaviour against the policy.**
- [x] **4. The gate.**

## Where the policy is, and where it is not

```text
the tool response    { goal, activation }  and activation is the string "armed" - no policy text
the repository       no goal or policy document; the only match is an unrelated ux-policy-audit.md
the policy itself    the round prompt: read the current goal, gather evidence, mark complete only if the whole
                     objective is achieved, otherwise leave it active
```

**So the configured policy is not a document to find; it is the instruction the round carries**, and this round read it deliberately for the
first time. Held against the behaviour:

```text
"read the current goal"          every round calls get_goal and prints its phase
"gather evidence"                every round records what it ran and what it saw, and gates before committing
"mark complete only if achieved" not done, and the reason is below
"leave it active"                done, 151 times
```

## The completion question, answered with a reason

**The objective is a behaviour, not a deliverable**: *plan it yourself; each time, research first, then plan, then do*. **That behaviour has
been met every round, and the work it governs is done as far as this environment reaches.** But the objective also says *complete*, and what
would complete it is the first real turn - **which needs a host this environment does not have.**

**Marking it complete would claim an achievement nothing here delivered**, and **leaving it active keeps the behaviour in force**. The tool own
limit is 256 rounds and it will decide at the end; until then the honest state is the one it is in.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The first real turn.**