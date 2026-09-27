# The turn, executable

## Goal

Turn the seven-step procedure into something a person can run: a guide where each step is a command or a tool call, the
fields are exact, and **the reading it should produce** is stated - so the turn can be checked rather than believed.

## Background: what exists, and what the guide has to be built from

- **The procedure** is in the loop contract ("The Turn, in Order", seven steps). It says what to do; it does not say what to
  type or what to expect.
- **The tools have exact shapes**, read from the schema rather than remembered: `agent_task_convergence` takes
  `operation` in a closed set (`status`, `freeze`, `progress`, `finding`, `update_finding`, `resolve_finding`, `decide`,
  `checkpoint`, `resume`, `change`, `applied`) plus the fields a turn uses - `acceptanceId`, `status`, `evidenceRefs` for a
  pass, and `changeId`, `surface`, `failureEvidenceRef`, `rootCause`, `fix`, `predictedFixes`, `predictedRegressions`,
  `commit` for a change and its application.
- **The readings have usage** verified from their own headers: `scripts/harness-corpus.mts [root ...]`,
  `scripts/harness-failures.mts [ledger] [--client-summary <file>]`, `scripts/harness-axes.mts [ledger]`,
  `scripts/harness-rounds.mts [workspace]`.
- **And one prerequisite that cannot be waived**: the turn happens in a **Pi-hosted session with a formal native task**,
  because the manifest is recorded into that task convergence record. This workspace has no `.dove` directory, which is the
  measured reason the turn has not been run here.

## Requirements

- **R1 - Each of the seven steps gets its command or tool call, with the exact fields** it needs - not a paraphrase.
- **R2 - Each step says what the reading should be afterwards**, so a person can tell a step that worked from one that
  silently did nothing. Where the reading is a script, the guide says what to look for in its output.
- **R3 - The prerequisites are stated first**, including the one this environment cannot satisfy and how to tell.
- **R4 - The two boundaries are stated where they are acted on**: the verifier is outside the loop, so a change that edits
  it is not a turn; and a **person** keeps or reverts, with the applied commit as the target.
- **R5 - Every command and field in the guide is verified against the schema or the script header**, and the guide says
  which is which, because a guide that is right by memory is a guide that rots.
- **R6 - The guide lives where guides live** (`.trellis/spec/guides/`), not in a routed specification: it is instructions
  for a person, not a contract the harness enforces, and routing it would put it under a budget it does not need.

## Acceptance Criteria

- [ ] **AC1** The guide exists under `.trellis/spec/guides/`, indexed from that directory index.
- [ ] **AC2** All seven steps have a command or tool call, exact fields, and an expected reading.
- [ ] **AC3** Every tool operation named exists in the schema and every field is spelled as the schema spells it.
- [ ] **AC4** Every script invocation exists and takes the arguments the guide shows.
- [ ] **AC5** The prerequisite about the Pi host and the formal native task is stated with how to check it.
- [ ] **AC6** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass, with no source or routed-specification change.

## Out of scope

- **Running the turn.** It needs the host.
- **A new script that wraps the steps.** The steps are a procedure with a person in it; wrapping them would hide the
  judgments the guide is meant to keep visible.
- **Changing any contract.** This is instructions for using what exists.
