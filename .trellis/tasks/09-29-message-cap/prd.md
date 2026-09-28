# The configurable message cap

## Goal

Do the review P0.2: a configurable conversation cap that advises compaction or a new session when reached.

## Background: the guard already had the pattern, and this is one more branch

`context-guard.ts` already carried everything this needed: an env-var-with-validated-default reader, a disable
switch, a strictly-advisory contract, and a hint the adapter already notifies. **So the item is a third branch
rather than a new mechanism** - which is the distinction that keeps this from repeating the failure this session
keeps recording.

## What was added

```text
the reader      envMaxMessages(): DOVE_PI_MAX_MESSAGES, floored, default 150
                the review names 120 to 150 and the upper end is taken, so the hint arrives before the cliff
the input       messages?: number - how many conversation entries the host holds, when the caller knows
the interface   messagesAdvised, messageCount
the branch      fires above the cap, sets compactAdvised so the adapter surfaces it through the field it already
                reads, and the hint names both ways out
```

## And what the hint says, because advice is the whole point

**It names `/compact` and starting a new session, and says that neither drops anything** - because the host owns
the conversation and the guard is advisory-only. **A cap that deleted or rewrote history would be control, and
this adapter does not have it.**

**The absence is also a fact rather than a silence**: a caller that supplies no count gets `messagesAdvised:
false` and `messageCount: undefined`, and a control holds that with the cap set to `1`, where a supplied count of
`2` *does* fire. **Silence means the absence of the number, not the size of it.**

## The holder, and the one the existing test needed

```text
tests/context-guard.test.ts   a deepEqual on the whole guard object asserted its exact shape, so the two new
                              fields had to be added there - the suite would have caught it, and did not have to
                              because it was read first
                              two new cases: the cap at its boundary, and the absent count with its control
guard suite                   10 cases, up from 8
```

## Acceptance criteria

- [x] **AC1** The cap is configurable and defaults per the review own range.
- [x] **AC2** The hint names both ways out and claims neither.
- [x] **AC3** An unsupplied count is reported absent rather than invented.
- [x] **AC4** The gate passes.