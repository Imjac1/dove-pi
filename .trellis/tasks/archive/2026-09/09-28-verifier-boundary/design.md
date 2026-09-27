# Design: the boundary, and the room to state it

## The boundary, in four sentences

1. **A verdict is about what a task run does.** The closed set - a criterion status, a criterion verification state, a
   refusal count - is behaviour-shaped because that is what a harness change is for, and AHE reads the verdict against the
   next round task-level outcomes.
2. **An instrument change is a verifier change**, and self-improvement is defined by leaving the verifier alone. Judging one
   with the instrument own output would make the verifier its own judge: the only observable such a change moves is the
   instrument output.
3. **What judges it** is its suites and a person - and the suites are stated data now (`verifiedBy`, per component), not
   something a reader has to reconstruct.
4. **What the map cannot yet do**: `tool-implementation` is bound to the whole of `src`, which holds both the harness and
   the verifier, so "is this edit a verifier change?" is a judgment rather than a lookup. The prerequisite that would settle
   it is a finer map, named rather than implied.

## The split

| Moves to the records specification | Why it belongs there |
|---|---|
| The SSM axis contract (the terminal classification and its ratios) | It is a **reading of ledger records**: the records specification is where records are documented. |
| The decision contract | It is a **record** (`change.decided`) written at a round boundary; the loop uses it, the records document it. |

Each moves with its matrix rows and its test lines, because a contract without its validation and its tests is half a
contract.

**Why blocks and not line prefixes.** The previous split matched bullets by their first line and left a wrapped continuation
behind in the source. This script extracts a **range** - from a unique start marker to a unique end marker - and asserts
both markers occur exactly once, that the end follows the start, and that the line after the block does not begin as a
continuation, so a wrapped bullet cannot be split again.

**What stays in the loop specification**: the failure reading, the declared editable surface, the applied commit, the turn
procedure, the matrix, the tests - i.e. the loop own contracts. That is the subject boundary, and it is the reason to move
rather than compress.

## Verification and rollback

- **By construction**: the script refuses when a marker is missing or ambiguous, and reports what moved.
- **By measurement**: both files under their caps, and the budget test green; before this, the loop specification had 344
   bytes of headroom.
- **Rollback** is a `git checkout` of the two specification files: nothing else references their internal arrangement.
