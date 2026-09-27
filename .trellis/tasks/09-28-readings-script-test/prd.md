# The readings, exercised as scripts

## Goal

Close the layer that only a hand has run: the four reading scripts have unit tests over constructed records, and **no test
has ever spawned them** against a ledger on disk - which is exactly what the turn guide tells a person to do.

## Background: the gap, measured

- **Each reading has a unit test** over constructed records (`harness-axes`, `failure-reading`, `harness-corpus`,
  `harness-round`), and those tests are thorough.
- **None of them exercises the script**: the walk over roots, the load of the declaration from the harness own root, the
  `DOVE_PI_STATE_DIR` resolution, the printing, or the exit code. Every one of those has been exercised **by hand, by me, in
  this session** - which is the definition of a layer with no test.
- **And the guide quotes these scripts as the first and last steps of a turn**, so the layer is not incidental: it is the
  interface a person actually types.
- **The precedent for spawning exists**: `tests/harness-effect-claim.test.ts:69` runs
  `execFileSync(process.execPath, ["--import", "tsx", script, ...])`, so a test that runs a script is a shape this suite
  already uses.

## Requirements

- **R1 - A fixture that is enough to exercise all four readings**: a state directory with a ledger holding a request, a
  terminal, a refusal and an observation; and a workspace with a convergence record carrying one change and its application.
- **R2 - Each script runs and its output is asserted**, not merely its exit code: the axes reading prints the classes, the
  failure reading prints the record with its `cite:` reference, the corpus reading counts the ledgers it walked, and the turn
  reading prints the applied commit, the verifier answer and the decision.
- **R3 - A bad path is asserted too.** Each script must exit 0 and say what it did not find: a reading that dies on a missing
  ledger is a reading nobody runs, which is why the scripts were written that way - and this is the test that keeps it that
  way.
- **R4 - The declaration is read from the harness root, so the fixture workspace does not need one.** That is the behaviour
  the surface reading established, and the test asserts it by using a workspace with no declaration of its own.
- **R5 - The test stays cheap**: no network, bounded timeouts, one spawn per script, and temporary directories removed in a
  `finally`.

## Acceptance Criteria

- [ ] **AC1** `tests/harness-readings.test.ts` runs all four scripts against one fixture and asserts each reading output.
- [ ] **AC2** Each script is also run with a path that does not exist, asserting exit 0 and a sentence saying so.
- [ ] **AC3** The turn reading asserts the applied commit, the verifier answer and the decision line from the fixture.
- [ ] **AC4** No reading script changes: this is the layer below them being tested, and a change here would be the test
      fitting the code rather than the code being verified.
- [ ] **AC5** `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor` and
      `tests/spec-context-budget.test.ts` pass.

## Out of scope

- **Rehearsing the seven steps through the host tools.** Those mechanics are exercised in `tests/pi-adapter.test.ts`, and
  replaying them would duplicate a large harness for no new coverage.
- **A drift test for the guide.** Checking that the guide names only operations the schema has is a real idea and a
  different one; recorded rather than bundled.
- **Running the turn.** It needs a Pi host.
