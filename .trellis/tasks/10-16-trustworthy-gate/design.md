# Design: hold the state, do not sleep hoping for it

## The one idea

Both fences are the same defect wearing a different number: a fixed duration standing where a state should be, and the
repair is never a larger number - that only decides which machine loses. A case that needs something to be in flight must
**create** that state and therefore know it.

## The two rewrites

### The parallel-batch case (`tests/pi-adapter.test.ts`)

Today: two `agent_subagent` dispatches, a 600 ms sleep, then `agent_doctor` must report two `activeRuns`.

The replacement gives the child fixture a **gate**: on start it writes its own `started-<unique>` file under the case's
root, then polls for **one shared** `release` file, bounded by its own deadline so a mistake fails loudly instead of
hanging the suite. The case waits until two `started-*` files exist, reads `agent_doctor` while both are provably in
flight, then writes the single `release` and awaits both results.

**Why the gate is shared rather than per child** - measured 2026-10-16, and it corrects the design's own first version:
the fixture is injected through `DOVE_PI_SUBAGENT_PREFIX_ARGS`, a **process-wide** environment variable, so both
dispatches receive the same argv and neither can be told its own marker name. A shared gate removes the question, and
counting `started-*` files is how the case learns that both have arrived.

**Two things the rewrite must preserve**, because assertions read them: the child still writes `child answer` to stdout
(`:2197`, `:2198`), and the injection stays an argv prefix rather than becoming a different mechanism.
`tests/pi-subagent-provider.test.ts` has its own fixture and is untouched.

### The lock case (`tests/project-provider.test.ts`)

Today: the first action sleeps 50 ms, the case sleeps 5 ms and launches the second, and the assertion is about **order** -
so a late second launch still passes while the serialisation the case exists to prove is never exercised.

The replacement makes the overlap **constructed**: the first action signals an `entered` promise and then awaits a
`release` promise; the case awaits `entered`, launches the second, and only then releases. The second's own body records
when it ran, so "it was blocked" is a fact about the record rather than a hope about timing, and the existing order
assertion keeps working.

## The enforcer, and how narrow it is on purpose

The mechanism has to catch a **shape**. The shape is exact enough to be worth checking, and the audit is what makes it
exact: both wrong sites are the awaited-promise form

```typescript
await new Promise((resolve) => setTimeout(resolve, 600));
```

and **neither** legitimate site is - `pi-adapter.test.ts:2163` writes `setTimeout(() => …)` into a generated string, and
`capability-protocol.test.ts:43` stores the handle so it can be cleared on abort. So the scan looks for the awaited form
in `tests/**/*.ts` and fails on any occurrence outside a declared, reasoned allow-list that starts empty.

It is a door, not a behavioural case, and it is deliberately narrow: it enforces the one shape that has actually hurt
rather than pretending to detect every possible timing assumption. A fence written with different spacing would get past
it; that is accepted, because the goal is to make the wrong thing require a deliberate act instead of being a habit.

## Trade-offs

- **A constructed overlap is more code than a sleep.** It is also the only version of these two cases that can fail when
  the behaviour breaks, which is the entire point of having them.
- **The child fixture gets slower paperwork** (two files and a poll) inside a case that is already the slowest in the
  file. The poll is bounded, so the cost is a few milliseconds and the failure mode is loud.
- **The scan can be defeated.** Stated above rather than mitigated away.

## Rollback

Two test files and one new case. Reverting the commits restores exactly today's suite, which is why each rewrite is its
own commit with its own mutation result in the message - a reader can see what the case proved before and after without
reading a diff.
