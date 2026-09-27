# The loop first step cites into its third

## Goal

Connect mining to prediction. The failure reading produces records, and **a manifest cannot cite one**: the record carries
no reference, and the manifest never resolves the reference it is given. Both halves are fixed here, with the rule the
pass path already applies.

## Background: the gap, measured

- **The resolver grammar is already right.** `unresolvedAcceptanceEvidence` (`extension.ts:625-641`) resolves
  `ledger:<stepId>` by step-id equality and `effect:<id>` by file existence, and rejects any other kind. A failure record
  comes from a `request.terminal` whose step id is `request:<requestId>`, so `ledger:request:<requestId>` **would
  resolve today** - if anything produced it.
- **Nothing produces it.** `FailureRecord` carries the request id and not the step id, so a consumer would have to
  reconstruct the ledger writer naming convention - which is a convention, not a contract, and the kind of assumption
  that drifts.
- **And the manifest never checks.** `failureEvidenceRef` is validated for **shape** only
  (`task-convergence.ts:644`), and the change branch reads no ledger. So a manifest can cite a failure that the harness
  never recorded - while a criterion pass with the same ref is refused (`:1849`, with the comment saying exactly why).
  The rule exists one path over and is missing here.
- **And this workspace cannot record a manifest at all**: there is no `.dove/` here, so no formal native task, and the
  tool refuses without one. The turn is a Pi-hosted act; what this environment can do is make the two instruments
  agree, and prove it in the host harness.

## Requirements

- **R1 - A failure record carries the reference that resolves it.** `FailureRecord.evidenceRef`, built from the terminal
  record actual step id, so the reference is what the resolver matches rather than what the naming convention suggests.
- **R2 - The readings print it**, because a person copying it into a manifest is the consumer the loop actually has.
- **R3 - The manifest resolves the reference and refuses an unresolved one**, naming it - the same rule, and the same
  resolver, as the criterion pass path. One rule, two callers.
- **R4 - The refusal is a refusal, not a warning**: a manifest whose failure evidence does not exist is an assertion in
  the right costume, and the whole point of the evidence rule is that the layer which can read the ledger says so.
- **R5 - Nothing else about the manifest changes**: the shape rule stays where it is, and the baseline read is
  untouched.

## Acceptance Criteria

- [ ] **AC1** A failure record carries `ledger:` plus the step id of the record it came from, and that string resolves
      through `unresolvedAcceptanceEvidence` against the same ledger.
- [ ] **AC2** The failure script and the corpus reading print the reference.
- [ ] **AC3** A manifest whose `failureEvidenceRef` names no record in the ledger is refused, and the message names the
      reference.
- [ ] **AC4** A manifest whose failure evidence exists is still recorded as before, with its baseline read from the
      runtime.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC6** The loop specification records the reference form and the resolve rule.

## Out of scope

- **Creating a formal task in this workspace so a turn can be recorded here.** That is what a Pi-hosted session does,
   and `.dove` is its state; adding one so a test could record a manifest would be inventing the host.
- **Widening the observable set**, still open.
- **Making the failure reading part of the runtime.** It stays a reading; what it produces is now citable, which is what
   the loop needed from it.
