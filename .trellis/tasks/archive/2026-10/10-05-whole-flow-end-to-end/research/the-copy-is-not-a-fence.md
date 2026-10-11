# The copy is not a fence, and a cache was the way out

Measured 2026-10-11, on the first of three customer-path passes. The finding is about the **harness**, not about the
customer's own use — a customer runs `dove-pi` in their project and writing there is the point. What follows is that the
field runner's copy is not the boundary it reads as.

## What happened

The pass ran the whole flow through the installed release and reported success: `116 passed`, the judging instrument
byte-identical, the task archived, `completed`. Then the next pass's pre-flight measured the **source** clone and found it
modified — `cachecontrol/controller.py` at **21,168 B** where the recipe pins **20,090**, and its own suite at `116 passed`
where the baseline is `1 failed, 115 passed`. The run had written into the project it was supposed to have copied.

The session file says how. Of 26 mentions of the clone's absolute path, **25 are the agent's own commands** and one is a
tool result — and the agent ran **23 commands against the source tree**, including `git stash`, a patch script taking a
`path = "..."`, and `task verify` / `task finish` / `task archive` against the source's own `.dove/`.

## Where the path came from

Not from the scenario: `immutable-directive-work-as-a-task.json` names no path. From the copy's own bytes:

```
\cachecontrol\__pycache__\*.cpython-311.pyc     ← Python bytecode embeds the source file's absolute path
```

Six caches were in the clone — `__pycache__` (`cachecontrol/`, `cachecontrol/caches/`, `tests/`), `.mypy_cache`,
`.pytest_cache`, `.ruff_cache` — and every one of them carried the clone's absolute path, because they were written by
**running the clone's own suite in place**. Which is exactly how the baseline is measured. So the leak is not an accident
of one clone: **the recipe's own instruction recreates it**, and `cpSync` carries it into the run.

## Why it is worth a record rather than a retry

- **The copy is a convenience, not a fence.** Nothing stops an agent that learns an absolute path from using it. Cleaning
  the six caches removes the carrier that was measured here; it does not make the copy safe. Anyone treating `--cwd` as
  isolation should read this paragraph instead.
- **The fixture needs a step, and it is a step the recipe already implies.** Clean the caches **after** any baseline
  measurement, or the next run escapes the copy.
- **What is not being fixed here, stated so it is not mistaken for fixed:** the runner still copies whatever the project
  has. Excluding the known carriers is a real fix and a small one, and it is not this task's; fencing an agent inside its
  workspace is the A0/A2 question and is larger.

## What was done about it, in order

1. Restored `cachecontrol/controller.py` to **20,090 B** from a copy that was made before any agent edited anything — the
   `status-line-only` scenario, which calls no tool. Seven such copies agreed on the byte count.
2. Verified the recipe's other two files were untouched: `tests/conftest.py` **5,971 B**, `tests/test_immutable.py`
   **1,305 B**.
3. Removed the six caches, re-verified the baseline as `1 failed, 115 passed`, and re-cleaned the caches that measuring
   the baseline had just written.
4. Re-scan: **no file left in the clone names its own absolute path.**
5. Re-ran the three passes from that state, because a pass whose source tree was written to is not a measurement of the
   installed release.

**One thing worth naming about the near miss**: the modified clone still had a *passing* suite, so the next pass's
pre-flight would have reported a healthy project and the passes would have looked like three successes. What caught it
was measuring the three byte counts the recipe pins, before each pass rather than once.
