# Design: two projects, two modes, one build

## What each pass is for

| | project | mode | what it can prove | what it cannot |
|---|---|---|---|---|
| one | the graded clone (Python, `pytest`, one deliberately failing test) | `code-development` - write-capable, `network: none` with the shell still open | the flow **completes**: the project's own suite goes red to green, with the held-out instrument byte-identical and the source untouched | that anything works outside Python, or in a mode that may not write |
| two | a generated Node project (`node --test`, no framework dependency) | `code-audit` - `filesystem: read-only-source`, and it refuses bash and powershell with them | the **non-writable axis**: the run must report honestly, and the project must be measurably untouched | how much a long run costs, or how the flow behaves under compaction |

Neither pass is evidence for the other, which is the reason for having two: one is about doing the work, one is about
**not** doing it while saying so.

## The second project is generated, not checked in

A generator script writes the project at pass time: a small module with one failing test, plus a held-out test file that
the pass must not touch - the analogue of the first project's 1305-byte instrument. Two reasons for generating rather than
committing fixture files:

- a task-owned fixture would be moved by an archive and would become another payer of the archive tax this repository
  documents; a generator has no directory to move;
- the pins become **recomputable** - the generator prints the byte counts it wrote, so "the instrument is unchanged" is a
  comparison against a number produced in the same run rather than against a number someone once typed.

## How the non-writable pass is judged

Not by expecting green: the project's suite starts at `1 failed` and **must still be** `1 failed`, because a mode that
cannot write must not fix it. Three readings together, and none of them alone:

1. the project's own suite, unchanged;
2. the held-out instrument's byte count, unchanged;
3. the run's **own record** of what it did - the mutation tools either never ran, or were decided against, and a record
   that shows a mutation having run would be the defect this pass exists to catch.

Reading only (1) and (2) would pass for a run that never tried anything; reading only (3) would pass for a run whose
record is honest about a write that happened anyway. This is the same reasoning the first project's three pins use.

## The build identity, which is the point of ordering the release first

Every pass records **which build it measured** - the version the install reported back, and the release identifier when
there is one. That is the sentence the parent's integration review reads, and it is why this child runs last: the release
child's `releaseId` and this child's recorded identity must be the same build, or the difference must be explained in one
sentence. A pass without that identity is a reading of nothing in particular.

## Attempt accounting

A run that does not count is not a failure, but it is not a pass either, and the difference must be legible: a dead
provider window, a run that finished the work and then burned its budget, a process that will not shut down. Each one
gets a line saying which reading made it not count, so the next reader can tell "the flow is broken" from "the sample did
not happen".

## Trade-offs

- **The second project is small and Node-shaped.** It buys the mode axis, not generalisation, and the PRD says so.
- **Two generated fixtures** (the project, the instrument) mean the pass has more moving parts than a single clone run.
  The generator printing its own byte counts is what keeps that from becoming a source of doubt.
- **One pass per project.** The design does not claim more for them than one sample each.

## Rollback

This child writes nothing into the repository except `findings.md`, and its install and its copies are disposable. If a
pass reveals a product defect, the repair belongs to the parent's map, not to this child - which is what keeps a reading
from quietly turning into an unplanned change.
