# The authority matrix, row by row

## Goal

Hold the nine rows of the authority grant graph matrix against the tests that exist, and the two other items of its list.

## Background: the row that asks for nine rows

`framework-core.md` scenario 2 ends with three required tests, and the first of them says *each row of the matrix above, with the reason naming
the specific unsatisfied condition*. **That makes one list item into nine obligations**, and the matrix is the safety-shaped one: an authority
grant graph, its scope, its targets and its windows.

**The previous round checked two lists and named this one unchecked rather than implying otherwise.** This round picks it up, and it is
expected to be the largest of the six.

## Requirements

- **R1 - Restate all nine rows** in their own words, with their lines.
- **R2 - Hold each row against a test**, searching for what the row says rather than for a name I invent.
- **R3 - Check the other two items** of the list: the example engagement pre-flights clean, and a wrongly nested key is rejected by name.
- **R4 - Add a holder only where a row is testable, unheld and safety-shaped**, and say what it asserts.
- **R5 - Say which rows could not be matched**, rather than implying all nine were held.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** All nine rows are restated.
- [x] **AC2** Each row is held or named as unmatched, with what was searched.
- [x] **AC3** The two other items are checked.
- [x] **AC4** Holders added where warranted, and nothing claimed that was not measured.
- [x] **AC5** The gate passes.

## Out of scope

- **Scenarios 4 and 5**, which remain unchecked and named as such.
- **Changing the behaviour the matrix describes.**
- **The first real turn**, which needs a Pi host.