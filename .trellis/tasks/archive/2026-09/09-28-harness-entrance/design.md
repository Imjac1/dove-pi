# Design: an entrance of one screen, and links that are checked

## What the index says

```text
what this harness is                     one paragraph, pointing at the domain paper and the surface declaration
what it measures                         the four readings, one line each, with the script that runs them
where the contracts are                  the router (backend/personal-agent-runtime.md), named as the specs index
how a turn runs                          the guide, named as a procedure rather than a contract
what was decided                         the boundary decisions, with where each is stated in full
```

**Five answers, one screen, and no restating.** The router already routes the coding specifications, so the index names it and stops;
the three things a newcomer cannot find today - the guide, the readings and the boundary decisions - get the space instead.

## The check

A case in `tests/document-drift.test.ts`: every path-shaped backtick in the index resolves to a file that exists. **What it does not
check** is stated there too: that the sentence around a link is true. A link that resolves into the wrong document is not something a
checksum can see, and an entrance that read as verified would be the defect this file exists against.

## Why the pointer in AGENTS.md is outside the block

The Trellis block says edits inside it may be overwritten by a future update, and edits outside are preserved. An entrance that a tool
update can delete is not an entrance, so the pointer lives in the two lines the block leaves intact - and the test does not care which
line it is on, only that a newcomer reading AGENTS.md arrives somewhere.
