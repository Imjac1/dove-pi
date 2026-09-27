# The verifier is outside the loop

## Goal

Close the question three rounds have carried - whether the closed observable set should be widened so an instrument
improvement can be judged by the loop - and make the room to say it. The answer is already in the recorded research; what
was missing was applying it.

## Background: the answer, in the field own terms

From `research/rsi-community-landscape.md`, the distinction the community draws and this project adopted:

- **self-improvement** - "the system changes, **the verifier does not**";
- **recursive self-improvement** - "the system **and the verifier**" change, with the verifier still honest.

And AHE reads a change verdict against "the next round **task-level outcomes**" (`frontier-anatomy.md:387`). Put together:
a prediction must be about **what a task run does**, and an **instrument change is a verifier change** - which is the axis
this project explicitly declines ("we are not at RSI"). So an instrument improvement **is not a loop turn**, and widening the
set to judge one would make the verifier its own judge: the only observable an instrument change moves is the instrument
output, and a subject that produces its own verdict is not verified.

**What does judge it**, and why this is answerable now: an instrument change is judged by **its suites and a person** - and
the suites are no longer a matter of memory, because the declaration states which suites verify each component
(`verifiedBy`, the previous round).

## Requirements

- **R1 - The boundary is written where the loop is specified**, not left implicit: why the closed set is behaviour-shaped,
  why an instrument change is not a loop turn, what judges one, and the limit that keeps the last part a judgment today.
- **R2 - The limit is named rather than glossed.** The surface declaration binds `tool-implementation` to the whole of
  `src`, which contains **both** the harness and the verifier, so "is this edit a verifier change?" cannot be answered by
  the map yet - it is a reader judgment, and the file-level map is the prerequisite that would settle it.
- **R3 - Room is made by relocating, not by compressing.** Two contract groups in the loop specification are about
  **records** rather than about the loop: the terminal classification (SSM) and the decision record. They move to the
  specification that documents the records, with their matrix rows and test lines.
- **R4 - The move is done in blocks, not by line prefix.** The previous split moved wrapped bullets by their first line and
  left an orphan fragment behind; this one asserts, in the script, that each extracted block starts and ends where it
  should and that nothing orphaned remains.
- **R5 - Both specifications stay inside their budgets**, and the loop specification ends with real headroom rather than
  the 344 bytes it has now.

## Acceptance Criteria

- [ ] **AC1** The two contract groups, their matrix rows and their test lines are in the records specification and gone
      from the loop specification, with no fragment left behind in either.
- [ ] **AC2** The loop specification states the boundary: the closed set is behaviour-shaped, an instrument change is a
      verifier change and not a loop turn, its judges are its suites and a person, and the map cannot yet decide which
      edits those are.
- [ ] **AC3** The budget test passes, both files are under their caps, and the loop specification has more than 1 KiB of
      headroom.
- [ ] **AC4** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` pass.
- [ ] **AC5** The declaration-driven readings still run, since the split touches contracts the readings are described by.

## Out of scope

- **A file-level map that separates harness code from verifier code.** It is the prerequisite R2 names, and it is a
  change to the declaration with its own consequences - not a footnote to this one.
- **Running a turn.** Unchanged: it is a Pi-hosted act.
- **Rewriting the moved contracts.** They move as they are, apart from the one sentence that says where they live.
