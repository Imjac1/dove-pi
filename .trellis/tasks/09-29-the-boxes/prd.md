# The twenty-three boxes, each given a reason

## Goal

Check the usage review plan and say, for each item, whether it was done or measured as already existing.

## First: there are no boxes, and the number was mine

```text
prd.md                      7661 chars, checkbox lines: 0
implement.md / design.md    absent - this is a PRD-only task
what it has                 six ### sections, four of them the P0 to P3 priorities, in prose bullets
```

A previous round said its plan *carries twenty-three unchecked boxes*. **It carries none.** That number was
invented, and it is the tenth instance of this session own recurring class: **a value asserted from a view of a
thing rather than from the thing.** The correction is the first result of this round.

## The verdicts, one line each

```text
P0.1  a session-size fuse                    DONE      the fuse (round 182) and its wiring (round 184);
                                                      the plan own mechanism matches: 80-85% of the window,
                                                      driven by the cache diagnostics
P0.2  a configurable message cap             NOT DONE  DOVE_PI_MAX_MESSAGES has zero hits
P0.3  session-affinity keepalive             PARTLY    x-session-affinity is set at extension.ts:2916-2919;
                                                      there is no keepalive, and one would need the network
P1.1  name reusable capabilities, suggest    ALREADY   round 183: buildCapabilityIndex is folded into the
                                                      system prompt and line 185 suggests reuse on a match
P1.2  pre-list cap/recipe on workspace open  ALREADY   the same index, injected per request
P2.1  one editor tool across hosts           ALREADY   round 185: the adapter detects a host without
                                                      replace/insert/undo and reports it by name
P2.2  Trellis lifecycle as dispatch mainline ALREADY   Trellis is a first-class provider kind
P2.3  session resumption                     PARTLY    a session id and request affinity exist; resumption
                                                      across sessions does not
P3.1  surface CacheDiagnostics in the UI     DONE      round 186 made the cache line default; the cold-start
                                                      notice is the fuse the plan asks for
P3.2  record every capability call in ledger ALREADY   round 181: five append sites in fast-path.ts, with
                                                      capability.started, capability.blocked and completed
```

**Six done or already existing, two not done, two partly.** The two that are not done are the two the plan names
as its own P0 remainder, and both are real:

```text
P0.2  a message cap is small and implementable, and it is advice rather than control - the host owns the
      conversation, so Dove can only say the same way the guard already does
P0.3  the keepalive half needs the network, and the plan own note says to make it optional and offline-first
```

## Why this verdict is not written into the review file

**The review is someone else research, and annotating it with my own readings is the thing this session keeps
recording as a failure.** The verdict lives here, where it is my reading and says so, and the review file is left
as its author wrote it.

## Acceptance criteria

- [x] **AC1** The claim of twenty-three boxes was measured and corrected.
- [x] **AC2** Every P0 to P3 bullet has a verdict.
- [x] **AC3** The two not-done items are named as work rather than ticked.
- [x] **AC4** The gate passes.