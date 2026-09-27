# The behaviours a fix must not regress

## Goal

Close the second of the two fields Self-Harness requires of a failure record. The frontier decision named it
(`09-27-harness-scaffold-frontier/decisions.md:657-660`): **"a record of the passing behaviours to preserve that a
proposal must not regress"** - and it was never built. Measured: the loop specification contains **no mention of a suite
at all**, so nothing in the loop can name what a fix must not break.

## Background: what exists, and the two pieces that join

- **The attribution already exists.** A failure record names the component its evidence points at, or says it cannot
  (round 5).
- **The declaration already binds components to paths** (`.trellis/harness-surface.yaml`, round 2), and every entry must
  resolve.
- What is missing is the third relation: **which suites verify a component**. With it, the record can carry the suites
  the evidence points at, which is exactly the list a proposal must not regress - and without it, "do not regress" is a
  wish rather than a list.

## Requirements

- **R1 - The declaration gains `verifiedBy`, per component, of test paths.** Same shape as the component paths, and the
  same resolve rule: an entry that matches nothing is refused when the map is loaded, because a list of suites that do
  not exist verifies nothing.
- **R2 - The vocabulary stays closed.** A `verifiedBy` key naming a component the map does not declare is refused, and a
  component with no `verifiedBy` entry is allowed - a component whose verification nobody has stated is a fact, not an
  omission to paper over.
- **R3 - The failure record carries `preserve`.** The suites of the component the evidence points at. **Empty when the
  attribution is `unattributed`**, because then the evidence names no component and a list invented from it would be
  worse than none - and the record already says why, in `componentEvidence`.
- **R4 - It is supplied by the caller, never guessed.** The reading takes the mapping as an option, like the client
  accounts, so `core` stays pure and the script does the pairing it is already doing.
- **R5 - The readings print it.** Both scripts, because the list is what a person carries into the fix.

## Acceptance Criteria

- [ ] **AC1** The declaration carries `verifiedBy` for the components whose suites exist, every entry resolves, and the
      loading test refuses an entry that does not.
- [ ] **AC2** A failure whose evidence points at a component with suites carries them in `preserve`; a `verifiedBy`
      entry naming an undeclared component is refused.
- [ ] **AC3** A failure that is `unattributed` carries an **empty** `preserve`, and the record still explains why in
      `componentEvidence`.
- [ ] **AC4** Both readings print the list.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC6** The loop specification records the field, its source, and the empty case.

## Out of scope

- **Running the suites.** The loop names what must not regress; running them is the person or the round, and a record
   that ran tests would be a process, not evidence.
- **Deriving the list from the edit rather than from the evidence.** The record is written before the fix exists, so the
   only honest source is what the failure points at.
- **The observable boundary.** Unchanged and still open in the sense the previous round framed it: the verifier is
   outside the loop.
