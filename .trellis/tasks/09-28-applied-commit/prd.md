# The applied commit

## Goal

Complete the other half of AHE's requirement. The surface declaration made the action space **explicit**; nothing
makes an edit **revertible**, because nothing ties a change to the commit that embodies it. Record the claim, check it
against the declared paths, and print the turn.

## Background: what exists, and what is missing, verified

- **The prediction is pre-registered** (`change.recorded`) with its surface, its failure evidence and its predicted
  movements, and the round after it records a **decision** (`change.decided`).
- **Nothing names the edit.** A change is a claim about an edit that was never identified, so "revert what this change
  did" has no target, and "did the edit stay inside the component it claims" cannot be asked. AHE answers this with
  file-level components and **one commit per logical edit**; this repository has the components, the convention, and no
  link.
- **The rule for "inside a declared path" already exists.** `workspaceRelativeTarget` and the prefix hit live in
  `action-policy.ts:116,124` and decide the fence check at `:385`. The loop needs the same rule, and a second
  implementation of it is the drift this project keeps paying for.
- **The runtime should not reach for git.** `src/windows-runtime/powershell.ts` shows the runtime can spawn, and that is
  exactly why this task does not: the *claim* is recorded where claims are recorded, and the *check* runs in a script,
  which is where this project already reads its own evidence (`harness-axes.mts`, `harness-failures.mts`, the blackbox
  runner). A record that asserts what only a script can verify is the shape of claim this project exists to refuse.

## Requirements

- **R1 - A change is bound to the commit that embodies it.** A new operation records `change.applied` with the change
  id and the commit, as a **ledger** record: the ledger holds what happened, while the convergence record holds the
  goal state, and an application is not goal state.
- **R2 - Three refusals, each naming what is wrong.** An unknown change id (a prediction must exist first, because
  pre-registration is the whole point); a second application for the same change (one commit per logical edit is what
  gives the revert its granularity); an empty commit.
- **R3 - The check that the edit stayed inside its surface.** Given the files a commit touched and the surface the
  change declared, report the files that fall outside the declared paths - by **the fence own rule**, exported rather
  than reimplemented, and renamed for what it does now that it has a second consumer.
- **R4 - The turn is printable.** `scripts/harness-rounds.mts` prints, per change: the failure evidence, the surface,
  the fix, the applied commit and whether it resolves inside the declared paths, the prediction, and the recorded
  decision. It prints and never asserts, exit 0 in every case, like every other reading here.
- **R5 - The procedure is written where the loop is documented**, since a routed specification is what an agent reads
  before doing this work: mine, choose a surface, record the prediction, make the edit as one commit, record the
  application, let the next round decide, and keep or revert **as a person with the record in front of them**.

## Acceptance Criteria

- [ ] **AC1** `change.applied` is recorded once per change with the commit, and refuses a second application naming the
      commit already recorded.
- [ ] **AC2** An application for a change the record does not carry is refused, naming the id.
- [ ] **AC3** The inside-surface check reports the offending files, accepts a file inside a declared path, and accepts
      a file inside a declared *directory* path, with the fence keeping its own behaviour on the same rule (both
      suites pass).
- [ ] **AC4** A commit that cannot be resolved is reported as unresolved rather than as inside or outside: the check
      answers "not determinable" differently from "outside", the way every other reading here does.
- [ ] **AC5** The script prints a turn for a change with a decision and for a change without one, exits 0 with no
      ledger and with a ledger that has no changes.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.
- [ ] **AC7** The loop specification records the applied contract, the check and the procedure.

## Out of scope

- **Reverting automatically.** A decision is a person's to act on; this task gives the revert a target.
- **Reading the commit in the runtime.** The claim is the record; the check is the reading.
- **Deciding which commit the agent *should* have made**, or whether the fix text matches the diff. The check is
  about the declared surface, which is what the manifest claimed.
- **A skill.** The routed specification is where an agent reads the loop, and adding a second discoverable home for the
  same procedure would be a declaration nobody keeps in step.
