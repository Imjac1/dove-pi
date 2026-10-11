# Pre-registration for the thirteenth field run (2026-10-11)

Written and committed before the launcher starts, as the previous two were.

## 1. Why this run is different from the last two, and what it is allowed to prove

Runs 11 and 12 both did the front of the flow correctly and died on the same thing:
`provider-attempt-limit`, with three transient failures accumulated across 17 and 26 rounds. That bound is deliberate
(fail-closed, and replay is refused after a non-idempotent effect), and reading 10 recorded that changing the **contract**
needs the operator's decision rather than mine.

**It does not need one, because the knob already exists and is not the contract.** `extension.ts:929-933` reads
`DOVE_PI_MAX_REQUEST_ATTEMPTS` and falls back to 3, and that variable is published to users in `dove-pi --help` under "A user
may set these for a session". The field runner forwards the parent environment to the launcher
(`scripts/real-dove-blackbox.mjs:127-137`, `env: { ...process.env, ... }`), so a run can be given more attempts without
changing a line of the repository.

**What that does prove**: the flow can complete end to end when the provider is allowed its retries.
**What it does not prove, and this is the sentence that keeps the reading honest**: that it completes under the shipped
default of three. A run with the knob raised is a block on "the flow works", not on "the flow survives this endpoint's
default budget". Both numbers get recorded, and neither is presented as the other.

**The safety property that bound exists for is untouched.** The non-idempotent effect refusal
(`extension.ts:2638-2639`) does not consult the attempt count, so a started effect is still not replayable, whatever this
variable is set to.

## 2. The run, fixed in advance

```text
scenario  = tests/fixtures/scenarios/immutable-directive-work-as-a-task.json
            (step 0 now states both halves of the contract: freeze the criteria, then start the one being worked on)
--launcher source
--provider real
--cwd C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol
--timeout-ms 2700000   (45 minutes, as runs 5, 11 and 12)

DOVE_PI_MAX_REQUEST_ATTEMPTS=10     (default 3; the run's setting, recorded as such)

Baseline re-measured immediately before the run, as the recipe records it:
  cachecontrol/controller.py 20,090 B · tests/conftest.py 5,971 B · tests/test_immutable.py 1,305 B
  python -m pytest -q  ->  1 failed, 115 passed
```

## 3. The decision table, fixed in advance

| Observable | Reading |
|---|---|
| `agent_task_convergence` `progress` before the first `insert`/`write`/`replace`, with **no** `product_mutation.blocked` between the freeze and it | the scenario's step 0 now describes the contract: **one wasted round removed** ✓ |
| a `product_mutation.blocked` between the freeze and the first `progress` | the prompt still does not describe it, and the round is still paid ✗ |
| all four steps settling in one run, `convergenceFileCount > 0`, **task archived** | **AC#2 met**, under this run's setting ✓✓ |
| the copy's suite green (`python -m pytest -q`, baseline `1 failed, 115 passed`) with `test_immutable.py` and `conftest.py` byte-identical | the work was done and the instrument was not touched ✓ |
| `request.terminal` `attempt-limit` again | the provider's failure rate is above what 10 attempts absorbs ✗ — a reading about the endpoint |
| any `gate.refused` or `product_mutation.blocked` against a **shell command** | a false positive in the read-only grammar, and the command gets named ✓ |

## 4. What this run cannot show, stated before it starts

- **One sample.** Runs 6 and 7 disagreed about whether a good window existed at all.
- **Nothing about the default bound.** Section 1.
- **Nothing about the sentence's effect if the model never reaches a mutation.** Run 12 already answered that one
  affirmatively, so a run that fails earlier would be a reading about the provider, not a contradiction of it.
