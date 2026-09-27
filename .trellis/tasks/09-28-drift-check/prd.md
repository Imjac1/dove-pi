# Two documents that name things, and the drift check

## Goal

Make the two documents that name things carry a check: the turn guide names tool operations and fields, and the
declaration `embedded` list names symbols inside a file. Nothing keeps either true today.

## Background: what can be checked by executing, and what cannot

**By executing, verified while planning**:

- **The declaration `embedded` symbols are exported functions.** `task-convergence.ts` exports
  `parsePredictedMovement`, `verificationStateOf`, `verdictFor` and `decidableChanges`, so an import and a `typeof` check
  asserts the names rather than grepping the file.
- **The fields the guide tells a person to send are the fields the mapper accepts.**
  `convergenceOperationFromPiInput` is exported and takes exactly the change fields the guide lists; calling it with those
  fields and a baseline yields a `change` operation, and calling it with `criteria` yields `freeze`.
- **`status` is read-only by design**: the mapper throws for it, which is a claim the guide makes and this can assert.

**Not by executing, and therefore recorded rather than pretended**:

- **`operation=applied` is not mapped.** The mapper union has ten operations and `applied` is not among them: the tool
  execute handles it before the mapper, which is where its refusals live and where `tests/pi-adapter.test.ts` exercises
  them. A drift test cannot call the mapper for it, so it does not claim to.
- **The guide prose is not checked.** Which surface to choose, what to predict, whether to keep or revert - those are the
  judgments the guide exists to leave visible, and a test that "checked" them would be checking nothing.

## Requirements

- **R1 - The declaration symbols are asserted as exported functions**, read from the real declaration file and imported
  from the module the entry names - so a rename fails the test instead of making the reading name something that is gone.
- **R2 - The guide fields are asserted by calling the mapper**: `freeze` with `criteria`, `change` with the eight fields the
  guide lists plus a runtime baseline, and `status` refusing as read-only.
- **R3 - The scripts the guide quotes exist**, by path, because a guide whose commands do not exist is a guide that wastes
  the reader first attempt.
- **R4 - The test states what it does not check**, in its own doc comment: the `applied` operation and the guide prose.
  A drift test that reads as complete is worse than one with a stated edge.
- **R5 - It follows the house shape**: it imports the real structures rather than reading source text where a typed check
  is possible, which is what `tests/fence-drift.test.ts` does and what the withdrawn behaviour map did not.

## Acceptance Criteria

- [ ] **AC1** `tests/document-drift.test.ts` asserts every `verifier.embedded` symbol is an exported function of its file.
- [ ] **AC2** It calls the mapper for the guide `freeze` and `change` steps and asserts the operations they produce, with
      the exact field names the guide shows.
- [ ] **AC3** It asserts `status` refuses as read-only, which is what the guide tells the reader to run for a status read.
- [ ] **AC4** It asserts the four quoted scripts exist.
- [ ] **AC5** Its doc comment states the two things it does not check.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass, with no change to the documents it checks.

## Out of scope

- **Checking the guide prose.** Stated in the test rather than attempted.
- **A schema text scan.** Reading the source for field names would check what the pattern can match rather than what is
  true, which is the failure the withdrawn behaviour map had; calling the mapper is the typed form of the same question.
- **Running the turn.** It needs a Pi host.
