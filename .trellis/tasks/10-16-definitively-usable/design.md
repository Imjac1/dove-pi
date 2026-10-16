# Design: why three children, and what only this task decides

## Why the split

The three deliverables fail differently, are checked differently, and can be archived independently - which is the
repository's stated test for a child task. Concretely: a release is a sequence with one irreversible step; a gate change
is a pair of test rewrites whose evidence is a mutation going red; and a reading is a measurement whose evidence is three
byte counts and two projects. Bundling them would force one artifact to carry three kinds of acceptance, and it would
make the first of them block on the other two for no reason.

**What this task does not do**: it is not the implementation target. It owns the requirement set, the map, the
cross-child criteria, and the final integration review. When a child needs a product decision that belongs to the whole
goal - the bar for "usable", the boundary of the claim - the answer lives here, in the PRD's requirements, not in the
child.

## The order, and the consequence it accepts

**Release - gate - reading**, chosen by the operator on 2026-10-16. The argument for it is that users are on 0.2.1 while
four defect fixes sit unreleased on master, and shipping those does not depend on the gate being trustworthy.

The consequence is stated here rather than discovered later: **the 0.2.4 release is certified by a gate that can fail for
a reason unrelated to the change** - measured on CI as a 600 ms sleep losing a race on a slower runner, in a commit that
only changed a task status. So if that job goes red, the rule is not to move the tag. The tag is a record of what was
pushed; a red run for a fence is a fact about the gate, which the gate child owns, and the release either stands or is
superseded by the next version. Moving a tag would destroy the only thing a tag is for.

There is a second-order fact that makes this order cheaper than it looks: **the gate child's changes are test-only**, so
the reading taken after it still measures the same product code as 0.2.4. The reading can therefore run last without
measuring a different build than the one users have, and no second release is needed for the reading to speak about the
release.

## The two projects, and what each one is for

| | project | mode | what it can prove | what it cannot |
|---|---|---|---|---|
| one | the graded clone (Python, `pytest`, one deliberately failing test) | `code-development` - a write-capable mode | the flow can be *completed*: the project's own suite goes from red to green, with a held-out instrument byte-identical and the source untouched | that the flow works anywhere but Python, or in a mode that may not write |
| two | a second, deliberately small project in a different ecosystem | a mode that **cannot write** | the non-writable axis: the run must **refuse or report honestly** rather than appear to have done the work | how much a long run costs, or how it behaves under compaction |

The second project's judging instrument is the analogue of the first one's: a **held-out test** that the run must not
touch, pinned by byte count, because "the project's tests pass" is not by itself evidence that the change was the right
one - the first project already taught this repository that lesson with a 1305-byte file.

**What is deliberately not claimed**: the second project is small, and smallness is a choice - it makes the pass cheap
enough to be repeated. A large run is `10-03-ten-million-token-project`'s subject, and that task stays where it is.

## The integration review, which is this task's own work

After the three children are archived, this task does the thing none of them can: read the three results **together** and
answer the goal's question once. That means:

- the release's identity (which build users have) and the reading's identity (which build was measured) must be **the same
  build**, or the difference must be explained in one sentence;
- the gate's mutation evidence must be the thing that makes the two passes believable rather than merely green;
- the boundaries must be listed where the conclusion is, not in a footnote;
- and if any child was archived with a criterion unmet, that is said first rather than folded into a summary.

## Trade-offs accepted

- **More artifacts.** Three children with their own PRD, design and implementation plan cost writing time that one task
  would not. The return is that each can be approved, started, checked and archived on its own, and that a failure in one
  does not stall the other two - which is exactly what happened to this goal when the plan was a single task.
- **The release before the gate** accepts a red CI run as a possible outcome of the shipping step. It is written down with
  its rule (do not move the tag) rather than mitigated away, because the operator's ordering is a deliberate trade.
- **The second project is narrow.** It buys the axis, not the scale, and the design says so instead of implying more.
