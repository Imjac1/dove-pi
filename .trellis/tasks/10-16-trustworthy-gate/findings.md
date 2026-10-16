# Findings: the gate, its two rewrites, and what it caught on the way

## The two rewrites, and the red each one produced

**The parallel-batch case** (`tests/pi-adapter.test.ts`). The child fixture now writes its own `started-<pid>` marker
and waits for a shared `release` gate; the case waits until two markers exist, reads `agent_doctor` while both children
are provably in flight, then opens the gate. The 600 ms sleep is gone.

- **Mutation**: `activeRuns: [...activeSubagentRuns.values()].slice(-1)` in `extension.ts` - the single-slot defect the
  case exists for. Result: **red**, `AssertionError: a batch in flight must be reported as two runs, not one overwritten
  slot`, `actual: 1`.
- **Timing**: the case used to take ~2800 ms, and that was the shape of its failure on CI (`0 !== 2` in 2807 ms). It now
  takes **1663 ms**, because nothing waits on a duration - it waits for two files to appear and then proceeds.

**The lock case** (`tests/project-provider.test.ts`). The first action signals `entered` and awaits `release`; the case
awaits `entered`, launches the second, and then releases. The 50 ms and 5 ms sleeps are gone, and the case gained the
assertion that makes its subject real: while the lock is held, `events` is still `["first-start"]`.

- **Mutation**: the guard `if (acquired)` in `src/project-provider/lock.ts` changed to `if (true)`, so the lock no longer
  serialises. Result: **red**, `AssertionError: the second action waits for the lock rather than running beside it`.
- **Timing**: 122 ms, where the old form spent 50 ms sleeping by design.

## The scan, and the first thing it caught was itself

`tests/suite-timing.test.ts` reads every `tests/**/*.ts` and fails on the awaited-sleep form, printing `file:line`. It is
green on the suite as it stands and goes red when a fence is added back - verified by adding one to
`tests/temporary-directory.ts`, watching it name `temporary-directory.ts:34`, and removing it.

**On its first run it flagged its own documentation.** The comment describing the forbidden shape contains that shape
with a placeholder (`N`), and the original pattern matched it. The repair is the narrower pattern rather than an
allow-list entry: **the pattern demands a digit**, because the harm is the number - a duration where a state should be -
and a comment naming the shape cannot have one. That is a better outcome than an exception would have been, and it is the
reason the rule can be written down inside the file that enforces it.

Two legitimate uses are documented in the case rather than excepted from it: a `setTimeout` written **into a generated
child script** (the slowness is the behaviour under test) and a timeout handle stored so an abort listener can clear it.
Neither matches the form. Product code is out of scope on purpose, and the clearest argument is that
`src/project-provider/lock.ts` uses the same text in a bounded retry loop where it is not a fence at all.

## Two things I got wrong, written down rather than smoothed

1. **My first lock mutation was not surgical.** It replaced `if (acquired) {` across the file and reported five
   replacements; a later line-precise search found **one** occurrence of that guard. I did not chase the difference, so
   the evidence this child relies on is the surgical run - mutate exactly one line, watch it go red, restore - and the
   five-replacement count stands as an observation I could not explain rather than as evidence.
2. **The children's own deadline is a tail, not a guarantee.** If the case fails before opening the gate, the two child
   processes are not awaited, so they sit until their own 30-second deadline expires and exit 3. The suite still fails
   for the right reason, but a reader on a slow machine may see a delay after the red. The design claimed the deadline
   meant "fails loudly instead of hanging"; the honest version is that it fails, and may leave a tail.

## What this child did not prove

- **That no other timing assumption exists.** The scan is narrow by design and is defeated by respacing the fence. What
  this child establishes is that the one form that actually hurt is gone and cannot return by habit.
- **That the rewritten batch case still covers everything it did.** The mutations show it bites; they do not show it
  asserts everything the old one did. The `child answer` assertions and the settled half are unchanged and still run,
  which the green suite confirms, but a reader should treat the two halves of that case as separately evidenced.
- **That the suite is now fast.** Two fences were replaced by waits, not by parallelism; the file's cost is now the work
  it measures rather than the sleeps it took.
