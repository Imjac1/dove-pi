# The inside answer, from a commit found at runtime

## Goal

Close the last unasserted line of the turn guide: the reading own `inside` answer, against a real commit, without hard-coding a sha.

## Background: the measurement that made it possible

Round 42 rehearsed the last mile with two subjects - the root commit, which reads `outside` every surface, and a commit that does not
exist, which reads `unresolved` - and left `inside` to the unit tests, because the commits that stay within one surface are all recent
and a hard-coded sha would pass here and fail in a clone with a different history.

**Measured now**: scanning sixty commits for one whose files all fall under a single declared component takes **1.2 seconds**, and
finds:

| Surface | Subject |
|---|---|
| `tool-implementation` (`src`, `tests`) | `a2b758b`, one file |
| `long-term-memory` (`.trellis/spec`, `.trellis/workspace`, `.trellis/tasks`) | `b075b32`, two files |
| `skill` (`.agents/skills`) | none in these sixty |

**So the subject can be resolved at runtime**, which is what makes the assertion honest: it holds in any checkout that has the commit,
and a checkout that does not have one takes the fallback and says why.

**And a fourth answer was found while looking**: the reading prints `surface not declared, so inside-or-outside cannot be decided` when
the declaration lags the code. It is unreachable from a valid record, because the decoder validates a surface against `CHANGE_SURFACES`
- so it is recorded rather than tested, and the reason is that the declaration would have to be wrong for it to fire.

## Requirements

- **R1 - The rehearsal finds its `inside` subject by scanning**, bounded to thirty commits so the suite does not pay a second for it,
  and resolves the commit at runtime.
- **R2 - It degrades honestly**: when no commit stays within the surface, the assertion is skipped with a message that says so, rather
  than the test passing silently or failing for a reason about history.
- **R3 - The `inside` line is asserted for the surface the commit actually belongs to**, read from the answer rather than assumed.
- **R4 - The unreachable fourth answer is recorded**, with the reason it cannot fire from a valid record.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The scan is bounded and its cost is stated.
- [ ] **AC2** `inside` is asserted when a subject exists, and the fallback message is asserted to explain itself when none does.
- [ ] **AC3** The fourth answer is recorded in the task and in the check comment.
- [ ] **AC4** The suite passes, with the reading suite one case larger.
- [ ] **AC5** The gate passes.

## Out of scope

- **Hard-coding a sha**, which is what the runtime scan exists to avoid.
- **Committing inside a test**, which would make the suite write history.
- **The first real turn**, which needs a Pi host and a formal native task.
