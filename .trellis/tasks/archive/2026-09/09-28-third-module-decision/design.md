# Design: the decision, and why it is the deliverable

## The decision

**Extracting the verification tail is not worth doing now.** The numbers: 74 use sites of the refusal constructor in the
record module, nine more names with three to ten sites each, and a movement vocabulary that cannot be lifted without a
value-level cycle against its own types. The payoff: `verifier.embedded` becomes empty - a tidier list - while the reading
already answers `possible` with the symbols named, and the declaration already carries the measured reason.

**What would reopen it**: splitting the record module for a reason of its own. If the record is ever divided - its decoders,
say, from its reducer - then the vocabulary comes apart as part of that work, with its own motivation, rather than being
torn out of a module that is not otherwise changing.

## Why this is written in two places and not one

| Place | Reader | What it says |
|---|---|---|
| The boundary contract | someone deciding whether the verifier can be fully declared | the decision, the numbers, and the reopening condition |
| The declaration comment | someone looking at the map and wondering why one file is still embedded | one sentence: measured, and not worth its cost yet |

A decision recorded only in a task archive is a decision the next person re-derives. The declaration is where the question
arises, and the contract is where the question is answered at length.

## Verification

- **The diff is specifications and comments**: no source file changes, which the round can assert by looking at `git status`
  rather than promising.
- **The suite and the three readings are unchanged**, which is what "we decided not to change the code" means when it is
  verified rather than stated.
- **The numbers are recorded with their method** (non-comment lines matching the name, per module), because a count without
  a method is a count nobody can check.
