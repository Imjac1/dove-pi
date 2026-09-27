# A test file header that stopped describing the file

## Goal

Bring the two headers back in line with what their files hold - and state the convention, so the next person adding a case knows what
a header is for.

## Background: the measurement, and the decision it settled first

**The question this round started with**: does the drift suite need splitting? Measured: `tests/document-drift.test.ts` is 375 lines
and the eighth largest test file in the suite, behind two of 1376 and 1189. Its nine cases are one shape - **a document names
something, and the name is checked against reality** - and its four helpers are the four rules. Splitting by subject would produce four
files of two cases each: more surface for no gain. **Keep it**, and the measurement is the reason.

**The measurement found something else.** The header of that file still reads:

```text
**Two documents that name things, and the check that executes the names.**
... and then four checks, which is what the file held when it was written.
```

It holds nine cases across five kinds of naming now - declaration symbols, mapper fields, specification indexes, the managed-block
boundary, paths, and citations - and the file whose whole subject is a declaration that stopped being true **had one in its own
header**. The same is true of `tests/harness-readings.test.ts`: its header frames the file as the script layer nobody had exercised,
which is still true, and does not mention that it now also holds four failure modes of the readings.

## Requirements

- **R1 - Both headers say what the file holds**, by kind, in a form a reader can skim: what is checked, and what is not.
- **R2 - The limits stay** where they are stated - and the header points at them rather than repeating the file.
- **R3 - The convention is written where conventions live**: a test file header says **what class of defect the file holds and what
  it does not**, because a reader deciding whether a defect is caught needs both.
- **R4 - No case changes.** This round edits prose about tests, and the suite passing unchanged is the evidence.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** `document-drift.test.ts` names its five kinds of naming and keeps its stated limits.
- [ ] **AC2** `harness-readings.test.ts` says it holds the readings failure modes as well as the script layer.
- [ ] **AC3** The convention is in `quality-guidelines.md`, with the reason.
- [ ] **AC4** The suite passes with no case changed: the same 731 tests, the same pass count.
- [ ] **AC5** The gate passes.

## Out of scope

- **Splitting the drift suite**, which the measurement declined.
- **Headers in files no round has changed**, which are neither stale nor this round subject.
- **The first real turn**, which needs a Pi host.
