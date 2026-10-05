# Implementation plan: concurrent read-only subagent dispatch

## Ordered checklist

- [x] **1. The state.** In `src/pi-adapter/extension.ts`, replace the single binding at `:714` with a
      `Map<string, SubagentRunState>` keyed by `runId` plus a `lastSubagentTerminal`. Keep both in the same
      scope that `:714` occupies today so no reader changes shape unexpectedly.
- [x] **2. The four writers.** `:1602` and `:1609` (provider unavailable - no run was started, so they set only
      `lastSubagentTerminal`); `:1615` (after `launch` - `set`); `:1617` (after `collect` - `delete`, then set
      the terminal). **No `await` may sit between reading and writing this state.**
- [x] **3. The two readers.** `/subagent` at `:1243` reports the in-flight count plus the last terminal;
      `agent_doctor` at `:1945-1952` emits `activeRuns` (array) in place of `activeRun` (single object) and keeps
      `lastTerminal`.
- [x] **4. The description.** `:1590-1594` - one clause in `description` and one in `promptGuidelines` saying
      that several calls in one message run concurrently, and that independent investigations should be issued
      together.
- [x] **5. The case, red first.** Add the concurrency case to `tests/pi-adapter.test.ts`, run it against the
      unmodified implementation, and confirm it **fails** before step 1 lands. A case written after the fix and
      never seen red proves nothing.
- [x] **6. Spec.** `.trellis/spec/backend/personal-agent-extension-runtime.md:61` currently promises four
      `subagent` fields and is silent about the rest. Extend that sentence to what the projection now emits.
      This is Phase 3.3, in the same commit batch as the code.

## The case, concretely

`tests/pi-adapter.test.ts` builds a fake `ExtensionAPI`, calls `extension(api)`, and drives tools straight off
the registry (`:215-228`, `:246-247`). The new case follows the same shape in its own `it`:

1. Write a throwaway child into a temp dir - a `.mjs` that waits ~2 s, writes `child answer`, exits 0. It
   ignores argv, which is what makes it usable as a stand-in for the Pi CLI.
2. Point the provider at it with `DOVE_PI_SUBAGENT_EXECUTABLE = process.execPath` and
   `DOVE_PI_SUBAGENT_PREFIX_ARGS = '["<temp>/fake-pi-child.mjs"]'`. The provider spawns without an `env` option
   (`subagent-provider.ts:105`), so the child inherits the parent environment.
3. `extension(api)` **after** the environment is set - the provider is constructed once, at registration
   (`extension.ts:713`).
4. Start two dispatches without awaiting:
   `const first = subagent.execute("call-1", {...}); const second = subagent.execute("call-2", {...});`
5. Wait ~400 ms so both have launched and neither has settled, then call
   `doctor.execute("doctor-call", {}, undefined, undefined, context)` - the same call the existing case makes at
   `:396`.
6. Assert `details.subagent.activeRuns.length === 2`. **This is the assertion that fails today**: there is no
   `activeRuns` field, and the single `activeRun` slot can only ever describe one of the two.
7. Await both dispatches; assert each returned its own `child answer` and its own `runId` (AC-1 - already true
   today, kept as a regression guard), and that `lastTerminal.state === "succeeded"`.
8. Restore both environment variables in a `finally`, and remove the temp dir.

Timing precedent exists in this suite: `project-provider.test.ts:426-427` interleaves two async operations with
a `setTimeout`. The child's ~2 s lifetime against a ~400 ms observation leaves ample margin.

## Validation commands

```powershell
npm run typecheck
node --import tsx --test tests/pi-adapter.test.ts
npm test
npm run doctor
```

`npm run doctor` is the CLI form of the same projection; `agent_doctor` inside a live session is the other
reader, and a batch there is what the change is for.

## Risky files and rollback points

- **`tests/pi-adapter.test.ts` is 1617 lines and its first big `it` registers the extension at `:228`.** A new
  `it` must not disturb that registration or the environment it observes - hence the env set/restore scoped to
  the new case's own `finally`. The existing assertion at `:403-406` (`configured: false`, `available: false`)
  depends on the provider being unconfigured, so the new case must leave no env behind.
- **`extension.ts` is 3644 lines** and its line numbers are cited by `.trellis/spec/backend/personal-agent-use-time-architecture.md`'s
  18-row mount table, which `tests/spec-anchors.test.ts` checks **by content** (`pi.on("<name>"`). The edits
  here are all in the tool-registration region and shift no `pi.on(...)` line; re-run that suite to be sure
  rather than trusting the reasoning.
- **Rollback**: one commit, `git revert`. Nothing is persisted, so there is no migration.

## What the plan did not foresee, and what the readings settled

- **The case as first written proved half of AC-3.** Step 7 asked for the settled `lastTerminal` to be asserted, and
  the case that landed asserted only the in-flight half. Reading the in-flight set alone passes for a map that is
  never emptied, so the second half is now there too: a settled batch leaves `activeRuns` empty, and `lastTerminal`
  names one of the two children with state `succeeded`.
- **`activeRuns` was already published, as a number, by the CLI.** `src/cli.ts:128` writes `activeRuns: 0` (commit
  `a58ccd7`), so the rename would have left one key carrying a list in `agent_doctor` and a count in the machine
  form of the same payload. Found at review, fixed in this task, and held by `tests/cli-error.test.ts`. The design's
  boundary table and its "nothing else reads these fields" claim were corrected by the same measurement - a search
  of `tests/` answers "who reads this", and the question that mattered was "who already writes a field under this
  name".
- **`sourceDrift` on this machine cannot be read as evidence about the previous commit's fix.** The install's
  `release.json` records `sourcePath` as this checkout and a digest from a tree that is not in this repository's
  object database (`commit a5b0e17e2318` does not resolve), so `drifted` here is a true positive under either root
  list. What was measured instead, over two trees: the old runtime list and the builder's list produce different
  digests over the same tree (`6c617581…` vs `c17c3011…` on the working tree, `ce8739e6…` vs `5f6b245c…` on
  `HEAD`), and the added roots are not empty (`bin` 1 file, `modes` 13). A subset of roots can therefore never
  reproduce the builder's digest, which is the claim the comment makes.

## Before `task.py start`

- `prd.md`, `design.md`, and `implement.md` exist and have been reviewed.
- Inline workflow (DeepSeek Harness): `implement.jsonl` / `check.jsonl` curation is skipped; Phase 2 loads
  context through `trellis-before-dev`.
- The five uncommitted files from the previous task (doctor `[object Object]` and `sourceDrift`) are **not**
  part of this task. They should be committed or explicitly set aside before this task's work begins, so the
  two changes do not land in one commit. **Done first**: they landed as `24fe516`, with `typecheck` at 0 and
  the full suite green, leaving this task's three files as the only working-tree changes.
