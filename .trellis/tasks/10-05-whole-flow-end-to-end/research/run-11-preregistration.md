# Pre-registration for the eleventh field run (2026-10-11)

**Written before the run, on purpose.** Ten runs in this task have ended five different ways, and every one of them was
explained afterwards. The readings are worth more when the question and the answer's shape are fixed first, so this file
states what is being tested, what each observable would mean, and what would count as the flow finally completing - and it
was committed before the launcher started.

## 1. What is under test

| # | Claim | Where it came from | What has been verified so far |
|---|---|---|---|
| **A** | The freeze errand, said in the per-request guidance channel only while the convergence gate would refuse a mutation, changes what the model does | readings 12 and 13 | the mechanism fires: the sentence is in run 10's session at line 7. **What it does to behaviour is unmeasured** - run 10's model never reached its first mutation |
| **B** | A provider round that ends with a bare failed-stream token is retried instead of ending the request | reading 14 | unit and handler-path cases, both observed red against the old rule. **Not measured against the real host** |

## 2. The run, fixed in advance

```text
scenario = tests/fixtures/scenarios/immutable-directive-work-as-a-task.json   (step 0 already says "freeze first")
--launcher source          (parity with runs 4-10; the installed release is the same tree and was checked separately)
--provider real
--cwd C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol
--timeout-ms 2700000       (45 minutes, as run 5)
```

## 3. The decision table, fixed in advance

Every row is a record kind this repository already writes; none of them is inferred from the summary.

| Observable | Claim A | Claim B |
|---|---|---|
| `convergence.json` exists, or a `task.convergence.decision` whose `state` is not `"missing"` | **froze before mutating** ✓ | - |
| `task.convergence.decision` `product_mutation.blocked` with `state: "missing"` | **still walked into the gate** ✗ | - |
| `request.terminal` `detail: "convergence-missing"` | the gate ended the request ✗ | - |
| no `tool.started` for a mutating tool at all | **unmeasured** - the model never reached the fork | - |
| `provider.request.completed` with `failureKind: "transient"` followed by another `provider.request.started` on the same request | - | **retried** ✓ |
| `provider.request.completed` with `failureKind: "terminal"`, `failureReason: "unknown"`, and no following round | - | **still broken** ✗ |
| `request.terminal` `detail: "attempt-limit"` | - | retried until the bound, then stopped ✓ (the bound is the designed behaviour) |

## 4. What would count as the flow completing (AC#2)

All four scenario steps reaching a settled state in **one** run, with `convergenceFileCount > 0` and the formal task
archived. Anything less is recorded as less; a run that dies early says nothing about the steps it never reached.

## 5. What this run cannot show, stated before it starts

- **It is one sample.** Run 6 and run 7 disagreed about whether a good window existed at all, so a single outcome is a
  reading about this window, not about the provider.
- **It says nothing about the work being right** unless the project's own suite runs in the copy (`python -m pytest -q`,
  baseline `1 failed, 115 passed`).
- **Claim A is only tested if the model reaches a mutation.** A run that dies while reading leaves it unmeasured for the
  second time, and that is a result about the provider rather than about the sentence.
