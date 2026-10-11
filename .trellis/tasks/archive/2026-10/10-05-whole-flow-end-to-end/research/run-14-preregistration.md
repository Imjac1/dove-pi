# Pre-registration for the fourteenth field run: the default budget (2026-10-11)

Written and committed before the launcher starts. This file is added to the task after it was archived, on purpose: the
seventeen readings below it are the same line of work, the requirement below is the same acceptance criterion, and the
specification pages cite this directory by its archive path - so a reading written anywhere else would be a second copy
that no page reads.

## 1. The one question

The thirteenth run completed the whole flow and needed **four** attempts in its first request, against a shipped default
of **three**. So it answered "can the flow complete" and left "does it complete under the default budget" open, and the
specification was corrected to say exactly that. This run closes it.

```text
DOVE_PI_MAX_REQUEST_ATTEMPTS is NOT set     (absent in the shell that starts the runner; the extension falls back to 3)
scenario  = tests/fixtures/scenarios/immutable-directive-work-as-a-task.json
--launcher source
--provider real
--cwd C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol
--timeout-ms 2700000   (45 minutes, as runs 5, 11, 12 and 13)

Baseline re-measured immediately before the run, as the recipe records it:
  cachecontrol/controller.py 20,090 B · tests/conftest.py 5,971 B · tests/test_immutable.py 1,305 B
  python -m pytest -q  ->  1 failed, 115 passed
```

## 2. The decision table, fixed in advance

| Observable | Reading |
|---|---|
| all four steps settled, `scenarioFailed: false`, **task archived**, suite `116 passed` with the judging test byte-identical | **the flow completes under the shipped default** - the open item closes ✓✓ |
| `request.terminal` `attempt-limit`, work already done, steps 1-3 never sent | **the default is the binding constraint**, and it is not a defect: three attempts across a request of this length is what the contract says. The reading is about the provider's failure rate in this window, and the honest conclusion is that a good window is required rather than that anything is broken |
| the same, with the work **not** done | the budget took the request before the work - a reading about this window, not about the mechanism |
| a `product_mutation.blocked`, or a `gate.refused` against a shell command | a regression in one of the three fixes, and whichever one it is gets named |
| fewer than three transient failures and still no completion | something other than the budget stopped it, and that is the finding |

## 3. What this run cannot show, stated before it starts

- **One sample.** A failure here says this window was not good enough; it does not say no window is. The number to reach
  is that the request must survive its whole length within three attempts, and the same command on another day is another
  experiment - the field-run contract's own words.
- **Nothing new about the fixes.** They are held by cases observed red first; this run can only show a regression in them,
  not their correctness.
- **Nothing about the rule no run has exercised.** This endpoint has sent text with every provider error across four
  runs, so the bare-token classification stays held by its cases alone unless this window happens to differ.
