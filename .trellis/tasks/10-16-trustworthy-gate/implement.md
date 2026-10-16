# Implementation: two rewrites, two mutations, one scan, one rule row

## Before `task.py start`

- [ ] Curate the manifests: `implement.jsonl` wants `.trellis/spec/backend/quality-guidelines.md` (the temporary-workspace
      and timing discipline the rewrites follow) and `check.jsonl` wants
      `.trellis/spec/backend/personal-agent-use-time-architecture.md` (the mount table, which this child does not move -
      it edits tests only - so the check is that it stays still).

## Done when

- [ ] The awaited-sleep form is gone from both sites, and **each mutation goes red**: forcing `activeRuns` to one makes the
      batch case fail; removing the lock from the second acquisition makes the lock case fail. Both red outputs are in
      `findings.md`, because "the suite passes" certified nothing here - it passed before too.
- [ ] The rewrite preserved what the assertions read: `child answer` still reaches stdout, and the injection is still an
      argv prefix.
- [ ] The scan exists, is green, and **fails when the form is added back** - verified by adding one and removing it.
- [ ] The rule row is in the front door's table with the scan case as its enforcer, and `document-drift` resolves it.
- [ ] `npm test` green, the four documentation doors green, corpus lint clean.

## Ordered checklist

1. **The lock case first** - it is smaller and its shape (signal `entered`, await `release`) is the pattern the other one
   reuses. Rewrite, run it, then run it **again with the lock removed from the second acquisition** and record the red.
2. **The batch case.** Give the child fixture its gate: write `started-<unique>`, then poll for the shared `release` with
   its own deadline. The case waits for two `started-*` files, reads the doctor, writes `release`, awaits both results.
   Run it, then run it **with `activeRuns` forced to one** and record the red.
3. **The scan**, in a small new `tests/suite-timing.test.ts`: read every `tests/**/*.ts`, fail on the awaited-sleep form
   outside an allow-list that starts empty and requires a reason per entry. Its comment carries the two legitimate sites
   and why they are not this shape.
4. **The rule row**, with a `Fails how` that names the observed damage: a case that sleeps instead of holding the state
   fails on a slower machine for a reason unrelated to the change, or passes while proving nothing.
5. Gates: `npm test`, `spec-anchors`, `document-drift`, `harness-surface`, `spec-context-budget`, corpus lint.

## Validation

- The mutations are the acceptance criteria, not the green run: a case that cannot be made to fail is not holding
  anything, and this child exists precisely because the suite was green while one of these cases proved nothing.
- The scan is validated by adding the form to a test file (it must fail) and removing it (it must pass).
- The mount table should **not** move in this child - it edits test files only. If it moves, the edit strayed into the
  adapter and the boundary was broken.

## Risky files and rollback

- `tests/pi-adapter.test.ts`, `tests/project-provider.test.ts`, and the new `tests/suite-timing.test.ts`. Each rewrite is
  its own commit with its mutation result in the message, so reverting one does not disturb the other.
- The child fixture's gate is inside a generated string, which is easy to break silently: the case's own run is the check
  that the generated child still parses and still prints `child answer`.

## Follow-up checks before `task.py start`

- [ ] Manifests curated (a verifier is dispatched for this child).
- [ ] The parent's rule stands: this child changes no product code, so the reading child's pass still measures the same
      build as 0.2.4 - that is why the reading may run after this child without needing another release.
