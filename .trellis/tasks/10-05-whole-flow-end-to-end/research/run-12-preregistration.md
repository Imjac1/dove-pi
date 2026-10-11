# Pre-registration for the twelfth field run (2026-10-11)

Same discipline as `run-11-preregistration.md`: the question and the shape of the answer are written and committed before
the launcher starts.

## 1. What changed since the eleventh run, and why that makes this a new question

Run 11's gate refused **the project's own test command**, because the read-only shell grammar admitted `go test` and had no
Python entry. The model froze only **after** being blocked: the block taught it, then it found the convergence tool, and it
got there on its third attempt.

The grammar now admits `python -m pytest`. So the crutch is gone, and the thing under test is the **errand by itself**:

> With nothing standing in its way, does the sentence in the per-request guidance channel make the model freeze the
> acceptance criteria **before** its first product edit?

That is the question run 10 could not answer and run 11 answered only with help.

## 2. The run, fixed in advance

```text
scenario = tests/fixtures/scenarios/immutable-directive-work-as-a-task.json
--launcher source          (carries the grammar fix; the installed release is the same tree and was checked separately)
--provider real
--cwd C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol
--timeout-ms 2700000       (45 minutes, as runs 5 and 11)

Baseline re-measured immediately before the run, byte-for-byte as the recipe records it:
  cachecontrol/controller.py 20,090 B · tests/conftest.py 5,971 B · tests/test_immutable.py 1,305 B
  python -m pytest -q  ->  1 failed, 115 passed
```

## 3. The decision table, fixed in advance

| Observable | Reading |
|---|---|
| the project's own test command runs with **no** `task.convergence.decision` against it | the grammar fix holds in a real run ✓ |
| a `product_mutation.blocked` whose call is a **shell command** | the grammar still has a false positive — **name the command**, do not call it a mutation ✓ |
| `task.convergence.decision freeze` **before** the first `write`/`edit`/`replace`/`insert` | **the errand works unaided** ✓✓ — the claim runs 10 and 11 left open |
| a `product_mutation.blocked / state: missing` whose call is a **mutating tool** | the model edited first: the gate did its job, the errand alone did not ✗ |
| no mutating tool call at all before the run ends | **unmeasured** again — a reading about the provider or the model's route, not about the sentence |

**AC#2**, unchanged from the first pre-registration: all four scenario steps settling in one run, with
`convergenceFileCount > 0` **and** the formal task archived.

## 4. What this run cannot show, stated before it starts

- One sample of a flaky provider. Runs 6 and 7 disagreed about whether a good window existed at all.
- Nothing about the work being right unless the copy's own suite runs (`python -m pytest -q`, baseline `1 failed, 115
  passed`) **and the judging instrument is byte-identical** — run 11 satisfied both, and that is the comparison.
- **The likely failure mode is not ours**: run 11 died at 20.5 minutes on `attempt-limit`, three transient failures
  exhausted across 26 rounds, with the work already done. That bound is deliberate and fail-closed, and reading 10 recorded
  that changing it needs the operator's decision rather than mine.
