# The skills beside the manual steps

## Goal

Read `trellis-finish-work` and `trellis-check`, and judge whether the manual steps were a failure to inspect the environment.

## Background: a mechanism that exists and was not used, again

`AGENTS.md` says to prefer a Trellis command over manual steps, and the skill catalog names `trellis-finish-work` and `trellis-check`. **This
session has done both by hand, 186 times**: `task.py create`, the gate commands, `task.py archive`, `add_session.py`.

**The last round found the toolset was fifty-six members wide and six were used.** So the question is not whether the skills differ, but
whether the manual path *misses* something the skill does - **and that is answered by reading them, not by assuming.**

## Requirements

- **R1 - Read both skills** by calling them, as the catalog instructs.
- **R2 - List what each does that the manual path does not.**
- **R3 - Say whether anything the session has done by hand is missing from the manual path**, or whether the manual path is complete.
- **R4 - Record the answer rather than adopting a skill mid-round.**
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Both skills are read by calling them.
- [x] **AC2** What each adds is listed.
- [x] **AC3** Whether the manual path is complete is stated.
- [x] **AC4** The gate passes.

## Out of scope

- **Adopting a skill in the middle of a round.**
- **The install**, which needs authorisation.