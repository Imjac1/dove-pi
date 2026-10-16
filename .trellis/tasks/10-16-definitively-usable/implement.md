# Implementation: the gate, the reading, the release

## Before `task.py start`

- [ ] Curate the two manifests with real entries, because this round dispatches a verifier rather than doing everything
      inline. `implement.jsonl`: `.trellis/spec/backend/quality-guidelines.md` (the temporary-workspace and timing
      discipline the two rewritten cases must follow), `.trellis/spec/backend/personal-agent-field-run.md` (what a field
      run is allowed to claim). `check.jsonl`: `.trellis/spec/backend/personal-agent-use-time-architecture.md` (the mount
      table that moves when the adapter is edited) and
      `.trellis/tasks/archive/2026-10/10-05-whole-flow-end-to-end/research/graded-project-recipe.md` (the pass's recipe and
      its three pins).
      `python ./.trellis/scripts/task.py add-context 10-16-definitively-usable implement <path> "<why>"` for each.

## Done when

- [ ] The two fences are gone and both cases still prove what they proved: a mutation makes each one **red** (see Validation).
- [ ] The awaited-sleep scan exists, is green on the suite as it stands, and fails when the form is added back.
- [ ] The rule row is in the front door's table, and `tests/document-drift.test.ts` resolves its enforcer.
- [ ] A fresh end-to-end pass on the **installed current tree** ends with the copy's suite at `116 passed`, the instrument
      at 1305 / 5971 bytes, and the source clone at 20090 bytes.
- [ ] 0.2.4 is Latest with four assets, and the user's install URL serves it.
- [ ] The conclusion carries the boundaries verbatim from the PRD, including the ones this round did not widen.

## Workstream 1: the gate

1. **`tests/project-provider.test.ts`, `serializes concurrent native mutations` first** - it is the smaller of the two and
   its shape is the pattern the other one reuses: the first action signals `entered` and then awaits `release`; the case
   awaits `entered`, launches the second, awaits a tick that proves the second is queued (not a duration - the second's
   own body records that it started, and the assertion is that it started **after** `first-end`), then releases.
   Delete the 5 ms and the 50 ms.
2. **`tests/pi-adapter.test.ts`, the parallel-batch case.** The fixture script at `:2163` gains two files per child: it
   writes `<name>.started` and then polls for `<name>.release`, bounded by its own deadline so a mistake fails loudly
   instead of hanging the suite. The case waits for **both** started markers with a deadline, then reads `agent_doctor`
   and asserts two `activeRuns`, then writes both releases and awaits the two results.
   Delete the 600 ms.
3. **The two mutations that prove the cases still bite**, run once by hand (and recorded in the task's findings):
   - make `activeRuns` report one run - the batch case must go **red** where it is green today;
   - make the second mutation skip the lock - the serialisation case must go **red** where it can pass vacuously today.
4. **The scan case**, in a small new `tests/suite-timing.test.ts`: read every `tests/**/*.ts`, find
   `await new Promise((resolve) => setTimeout(resolve,` and fail on any occurrence outside an allow-list that starts
   empty and, if it ever gains an entry, requires a reason in the row. Its own comment carries the two legitimate sites
   and why they are not this shape.
5. **The rule row** in the front door's table, with `test:tests/suite-timing.test.ts#<the case name>` as its enforcer and
   a `Fails how` that names the observed damage: a case that sleeps instead of holding the state fails on a slower
   machine for a reason unrelated to the change, or passes while proving nothing.

## Workstream 2: the reading

6. **Install the current tree** with the managed launcher, and record what the install reports it is.
7. **Fresh copy of the graded clone**, caches removed after the baseline measurement; verify the three pins on the copy
   and on the source before starting.
8. **One pass** through the launcher with the customer's own words, the runner's own harness budget, the scenario the
   previous passes used (`.trellis/tasks/archive/2026-10/10-05-whole-flow-end-to-end/research/three-customer-passes.md`).
9. **Read the three pins and the task's own state**; write `findings.md` with the pass's readings, the attempts that did
   not count and why each did not, and anything the pass revealed that the suites do not.

## Workstream 3: the release

10. Bump `package.json` plus the two version fields in `package-lock.json`; nothing else.
11. Gates in the release job's order: `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run pi:smoke`,
    `node scripts/task-artifact-lint.mjs --assert-corpus`, the four documentation doors.
12. Assemble the archive exactly as the job does, then `release:check` locally with the tag name, the commit, the
    manifest, the archive, the checksum and the four assets. **A failure here stops the release**; the tag does not exist
    yet, which is the whole reason this step is before it.
13. Tag `v0.2.4`, push the commit and the tag, watch `windows-release` to success, then read `gh release list` and fetch
    the user-facing URL - the last reading is the only one that speaks for what a customer gets.

## Validation

- The two fences: the mutations in steps 3 are the assertion - a case that cannot go red is not holding anything.
- The scan: add `await new Promise((resolve) => setTimeout(resolve, 1000));` to any test file and watch it fail; remove it.
- The whole suite: `npm test` green, and the four documentation doors green (`spec-anchors`, `document-drift`,
  `harness-surface`, `spec-context-budget`).
- The mount table moves again if the adapter is edited above a registration; repoint from the declarations, not from a
  computed delta, and read the page's prose citations back one by one.
- The release: only the CI job's green and the fetched URL count, not the local replay alone.

## Risky files and rollback

- `tests/pi-adapter.test.ts` and `tests/project-provider.test.ts` are rewritten in place; `git checkout` restores them, so
  each rewrite is its own commit with the mutation result in the message.
- The release is the one step with no rollback: `release:check` runs before the tag, and a failure after the tag means a
  new version rather than a moved tag.
- The graded clone and the install are outside the repository; the clone's recipe is pinned by three byte counts and the
  install is disposable.

## Follow-up checks before `task.py start`

- [ ] Both manifests curated (this round dispatches a verifier).
- [ ] This plan and `design.md` reviewed by the operator, and the final planning summary approved in a later message.
