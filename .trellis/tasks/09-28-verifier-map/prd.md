# The verifier, declared where it can be and named where it cannot

## Goal

Turn last round limit into a check. The boundary contract said a change that edits the verifier is not a loop turn, and
that **which edits those are is a reader judgment, because `tool-implementation` is bound to the whole of `src`**. This
makes it a reading - with the part that still needs a reader named rather than hidden.

## Background: the research, and why re-declaring paths will not do

- **The verifier is four files, and the repository already says so**: the reachability allow-list carries
  `harness-axes.ts`, `failure-reading.ts`, `harness-round.ts` and `harness-corpus.ts`, each with the reason "a reading,
  consumed by scripts/...; deliberately not reached by the harness". That is a de facto verifier inventory in a list that
  has nothing to do with the declaration.
- **But the verifier is not only files.** Its read paths live inside the adapter: `unresolvedAcceptanceEvidence`
  (`extension.ts:625`, exported), `countGateRefusals` (`:657`), `changeObservables` (`:678`), `convergenceObservables`
  (`:700`). And its verification logic lives inside the record module: `parsePredictedMovement` (`task-convergence.ts:931`),
  `verificationStateOf` (`:979`), `verdictFor` (`:1040`), `decidableChanges` (`:1085`).
- So a finer map is **not** a re-declaration of paths: two of those four locations are files that are mostly harness, and
  splitting them is an extraction with its own blast radius (`unresolvedAcceptanceEvidence` is exported and used by tests).

## Requirements

- **R1 - The declaration states the verifier in two parts.** `verifier.paths` for the files that *are* verifier code, each
  of which must resolve like every other path; and `verifier.embedded` for the files that **contain** verifier code, each
  naming the file (which must resolve) and the symbols inside it. The second part is a declaration of a limit, and it is
  written as data rather than as a comment because the reading uses it.
- **R2 - The turn reading answers with three states, not two.** For a change applied commit: **`definite`** when the touched
  files include a verifier path, **`possible`** when they include a file that embeds verifier code, **`none`** otherwise.
  The middle state exists because the evidence does not support the first, and collapsing it into `none` would be the false
  assurance this whole boundary is about.
- **R3 - The reading says which symbol is at stake.** For `possible`, the file and the embedded symbols are named, so a
  reader can look rather than guess.
- **R4 - `verifier.paths` and `verifiedBy` are different relations and are not merged.** One says what *implements* the
  verification; the other says what *verifies* a component. A file can be in either, both, or neither.
- **R5 - The extraction is recorded, not done.** Moving the read paths out of the adapter is the prerequisite that would
  turn `possible` into `definite`, and it is its own change with a real blast radius.

## Acceptance Criteria

- [ ] **AC1** The declaration carries `verifier.paths` and `verifier.embedded`; every path in both resolves, and an entry
      that does not is refused when the map is loaded.
- [ ] **AC2** The reading answers `definite` for a commit touching a verifier path, `possible` for one touching an
      embedding file (naming the symbols), and `none` for one touching neither.
- [ ] **AC3** A malformed `verifier` block - an undeclared shape, an entry without symbols - is refused, naming what is
      wrong.
- [ ] **AC4** The turn reading prints the answer beside the surface fit.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC6** The boundary contract states the three states and the extraction prerequisite.

## Out of scope

- **Extracting the read paths** out of the adapter - R5 keeps it honest and separate.
- **Deciding for a `possible` edit.** It stays a judgment; the change here is that it is an informed one.
- **Reading the reachability allow-list as the declaration.** It lists readings for a different purpose, and a declaration
   that depended on a test file would be a declaration in the wrong place.
