# Design: make the gate hold the state, then take the reading, then ship it

## The one idea

**A case that needs a state to be in flight must hold that state, not sleep hoping for it.** Every fence in this design is
the same defect wearing a different number: a fixed duration standing where a state should be. The repair is never a
larger number - that only moves which machine loses - it is to make the state something the case creates and therefore
knows.

## Boundary

Three workstreams, in this order, and the order is the argument:

1. **The gate** (`tests/pi-adapter.test.ts`, `tests/project-provider.test.ts`, one new case, one rule row) - because a pass
   certified by a gate that fails for reasons unrelated to the change is not certified.
2. **The reading** (`scripts/real-dove-blackbox.mjs` over the graded clone, against the **installed current tree**) -
   because the three passes already on record were taken before the four product commits this tree now carries.
3. **The release** (`package.json`, the version fields, the tag) - last, because a reading you do not yet trust must not
   be the thing you ship.

Not in this design: a second project or a second mode combination (that is `10-03-ten-million-token-project`'s ground),
the interactive affordances, and any change to the shape where the wrap-up is the request after the work.

## Workstream 1: the two fences, and the reason the numbers differ

| site | today | why it is wrong | the shape that replaces it |
|---|---|---|---|
| `tests/pi-adapter.test.ts:2193` | two `agent_subagent` dispatches, `await new Promise(r => setTimeout(r, 600))`, then `agent_doctor` must report two `activeRuns` | **fails** on a slower machine: measured on CI (`38811790771`, `test (locked)`) as `0 !== 2` in 2807 ms - the dispatches had not registered yet, and nothing made them. It passed here 5 times out of 5, which is the same defect seen from the lucky side | the child fixture (`:2163`) writes a `started` marker and then **waits for a `release` marker** (bounded by its own deadline); the case waits for **both started markers**, reads the doctor while both are provably in flight, then writes both releases |
| `tests/project-provider.test.ts:427` | the first action sleeps 50 ms; the case sleeps 5 ms and launches the second; the assertion is about **order** | **passes vacuously**: if the second launch lands after the first has finished, the expected order still holds, and the serialisation the case exists to prove was never exercised | the first action signals an `entered` promise and then awaits a `release` promise; the case awaits `entered`, launches the second, and only then releases - so the overlap is constructed, and "the second was blocked" is a fact rather than a hope |

**`tests/pi-adapter.test.ts:2163` and `tests/capability-protocol.test.ts:43` stay as they are**, and the design says why
rather than leaving them to look like oversights: the first is a `setTimeout` inside a **generated child script** - the
slowness is the behaviour under test, not the case's timing - and the second is a 10-second **timeout guard** with an
abort listener, which is the opposite of a fence: it fails loudly instead of passing quietly.

## Workstream 1b: the enforcer, so the class cannot grow back

A rule row with no mechanism is a rule nobody keeps, and the mechanism here has to catch a *shape*, not a case. The shape
is exact enough to be worth checking: the two wrong sites are both the awaited-promise form

```typescript
await new Promise((resolve) => setTimeout(resolve, 600));
```

and neither legitimate site is - `:2163` writes `setTimeout(() => …)` into a string, and `:43` stores the handle so it can
be cleared. So the new case scans `tests/**/*.ts` for the awaited form and fails on any occurrence outside a declared,
reasoned allow-list, which starts empty. It is a door rather than a case about behaviour, and it is deliberately narrow:
it enforces the one shape that has actually hurt, instead of pretending to detect every possible timing assumption.

## Workstream 2: the reading, taken on the tree that ships

The recipe that produced the three recorded passes, restated because the readings are only comparable if the steps are:

1. **Install the current tree** through the managed launcher, so the pass measures what a customer would get, not the
   source checkout. The previous passes were run this way; the four commits since the last one make it necessary again.
2. **A fresh copy of the graded clone** (`.trellis/tasks/archive/2026-10/10-05-whole-flow-end-to-end/research/graded-project-recipe.md`),
   with the caches removed after the baseline measurement - the recipe's step, learned when a `__pycache__` in the copy
   told an agent where the original lived.
3. **The customer's own words**, one scenario, through the launcher, on the runner's own harness budget rather than a
   relaxed one.
4. **Three readings decide it**: the copy's own suite must reach `116 passed`; the judging instrument must stay
   byte-identical at 1305 and 5971 bytes; the **source clone** must stay untouched at 20090 bytes for
   `cachecontrol/controller.py`. A pass that moves any of the three is a failed pass, not a good run with a footnote.
5. **Account for the attempts honestly** if any do not count - a dead provider window, a budget exhausted after the work,
   a process that will not shut down - and say which reading made each one not count.

## Workstream 3: the release

The shape the previous three releases used, unchanged: bump `package.json` and the two version fields in
`package-lock.json` and **nothing else** (mode governance declares the range `>=0.2.0 <0.3.0`, and
`src/capabilities/code-audit.ts` carries the capability protocol version, which is not the package's); run the gates in
the order the release job runs them; assemble the archive and pass `release:check` locally **before** the tag; tag, push,
watch the job; then verify what a user's command actually serves, which is the only reading that speaks for the user.

## Trade-offs, stated

- **A constructed overlap is more code than a sleep.** It is also the only version of these two cases that can fail when
  the behaviour breaks, which is the entire point of having them.
- **The enforcer is a source scan**, so it can be defeated by writing the same fence with different spacing. It is not
  meant to be tamper-proof; it is meant to make the wrong thing require a deliberate act rather than a habit.
- **One pass is one sample.** The design does not claim more for it than it is, and R5 keeps the boundaries in the
  conclusion rather than in a footnote.

## Rollback

Workstream 1 is two test files and one new case: revert the commits and the suite is exactly what it is now. Workstream 2
writes nothing into the repository but a findings file, and its copy is disposable. Workstream 3 is the only irreversible
step, which is why `release:check` runs before the tag exists and why the tag is pushed only after the local assembly
passes - and if the job fails, the fix rides a new version rather than a moved tag.
