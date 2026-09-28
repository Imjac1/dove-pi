# A help flag answered only in first position

## Goal

Make `--help` mean the same thing on every command the router advertises, because measured, it did not.

## Background: found by running the launcher, not by reading it

The round began with the question "does it actually run", applied to the release chain. The launcher runs - `--version` and `--help` both
answer at the top level, and the five read-only subcommands (`doctor`, `workspace status`, `capability list`, `skills`, `project doctor`)
all exit 0 with real output. Then the fourteen commands the router advertises were asked for their own help:

| Behaviour | Commands |
|---|---|
| argparse own help, exit 0 | `install` |
| exit 0 with **no output at all** | `rpc` |
| **usage error, exit 1** | `capability`, `project`, `session`, `task`, `web`, `workspace` |
| exit 0 | the remaining seven |

**The mechanism**, read from the code: `dove_pi.py:799` recognises help only as `arguments[0]`, so `capability --help` falls through to the
local CLI, which answers a usage error for a group that needs a subcommand.

**So asking a command for its own help failed for six of fourteen**, and for one it succeeded silently, which is worse: `rpc --help`
exits 0 and prints nothing.

## Requirements

- **R1 - A help flag is answered wherever it appears**, for the commands the local CLI owns.
- **R2 - Nothing that already worked is replaced**: `install --help` keeps its own argparse help, because a specific answer beats a
  general one.
- **R3 - A bare `--help` is never a value**, which is what makes the guard safe: the flags that take a value spell it inside `--args=...`.
- **R4 - The change is verified by running all fourteen**, not by reading the diff.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and doctor.

## Acceptance Criteria

- [ ] **AC1** All fourteen commands answer `--help` with exit 0.
- [ ] **AC2** `install --help` still prints its own usage.
- [ ] **AC3** The top-level `--version` and `--help` are unchanged.
- [ ] **AC4** The installer suite passes, since the change is in the Python launcher it tests.
- [ ] **AC5** The gate passes.

## A process note, recorded rather than backdated

**This task was created after the fix.** The round went straight from measuring to editing, which is the slip a previous round made and
wrote down; it is recorded here for the same reason: a task that hides its own sequence teaches the next reader the wrong one. The
artifacts below are what the round would have planned, and the fix itself is in `27f2a71`.

## Out of scope

- **Per-command help text**, which the router does not have: the general help is what it can honestly print.
- **`rpc --help` printing nothing**, which is the passthrough semantics and a separate decision.
- **The first real turn**, which needs a Pi host.
