# Implementation plan: the fence

## Before writing code

Load `trellis-before-dev` and read `.trellis/spec/backend/personal-agent-framework-core.md` - this task changes a
loader contract and a policy control, which is exactly what that spec governs. This is a DeepSeek Harness
(inline) workflow, so `implement.jsonl` / `check.jsonl` are not the context channel here; the phase index's
inline rule applies and the JSONL gate is skipped.

## Ordered checklist

Each step is verifiable on its own, and steps 1-2 land before anything reads the block.

- [x] **0. Probe the host's path argument key - DONE.** Build a `write` / `edit` / `delete` tool call against the host
      test harness and record which argument carries the target. `tests/host-work-mode.test.ts:620` shows
      `read` takes `file_path` and `:625` shows `grep` takes `path`; the mutation tools are **not** covered by
      either, and the design's candidate list (`file_path`, `path`) is a guess until this runs. Record the
      result in `design.md` and correct the candidate list if it disagrees. **Result: the key is `path`** for
      `write`, `edit` and `read` (`pi-agent-core` `dist/harness/tools/*.d.ts`), the host's core tool set is
      `{read, write, edit, bash}`, and `agent_workspace_patch` takes a **list** (`operations[].path`). The
      candidate list was wrong and design.md now carries the corrected contract - including the rule the probe
      forced: a mutation tool the effective map cannot classify is **refused**, not assumed harmless.
- [x] **1. The mode format - DONE.** `src/core/work-mode.ts`: add `FENCE_FIELDS = {paths, shell}` and
      `FENCE_SHELL_STANCES = {denied, uncovered}`; add `readonly fence?: { paths, shell }` to `WorkMode` beside
      `sandbox` (`:131-144`); add `parseFence` validation modelled on the sandbox block (`:511-540`) with three
      refusals - unknown key (via `rejectUnknown`), empty or non-string `paths`, missing/unknown `shell` - each
      naming both ways out, in the style of `permissions.unlisted`'s refusal (`:317`). Carry it on the returned
      mode beside `sandbox` (`:531-535`).
- [x] **2. Loader tests - DONE.** `tests/work-mode.test.ts`: a valid `fence` parses; each of the three refusals fires
      and its message names both ways out; **the three shipped modes still load unchanged** (this is AC8's
      regression, and it is free because those fixtures already exist).
- [x] **3. The control - DONE.** `src/core/action-policy.ts`: add `PATH_BEARING_MUTATORS` beside `FILESYSTEM_MUTATORS`
      (`:19`) as the subset of mutation tools that carry a path; add the fence check in `evaluate` immediately
      after `denyDecision` (`:252`) and before the sandbox block (`:259`); resolve the target with
      `readArgumentPath` (`src/core/gate-limit.ts:55`) over the candidate list from step 0; label the decision
      `fence` and add it to the `gates` array (`:246`). Block on: inside the globs, or unresolvable. The whole
      check is inert when `mode.fence === undefined`.
- [x] **4. Policy tests - DONE.** `tests/action-policy.test.ts`: inside -> block with the glob named; outside -> not
      blocked by the fence; unresolvable target -> block with the classification reason; `mode.fence` absent ->
      unchanged behaviour.
- [x] **5. The announcement.** `src/pi-adapter/extension.ts`: extend the `[Dove mode] ... loaded` notification
      (`:2034`) to name the fence and its shell stance, and name `uncovered` explicitly - a fence whose shell
      route is open must say so where an operator reads it. Any load-time refusal reuses the `modeRefusal` path
      (`:1975-1990`) rather than a new one.
- [x] **6. Host tests (AC2-AC5).** `tests/host-work-mode.test.ts`, following the pattern at `:603-654`:
      `writeFixtureMode` with a `fence` block, `declareMode`, `startHost`, then `callTool` a write into the
      globs (blocked, reason labelled `fence`), a write outside (not blocked by the fence), a pathless mutation
      call (blocked), and both shell stances (`denied` -> `bash` blocked; `uncovered` -> not blocked, and the
      notification says uncovered).
- [x] **7. The drift test (AC6).** Assert every tool in `PATH_BEARING_MUTATORS` is also in
      `FORMAL_PRODUCT_MUTATION_TOOLS` (`src/pi-adapter/extension.ts:103`), so the two lists cannot diverge
      silently. This is also where the *pre-existing* disagreement between `FILESYSTEM_MUTATORS` and
      `FORMAL_PRODUCT_MUTATION_TOOLS` gets recorded - as a comment naming it, not as a refactor.
- [x] **8. The contract (R6).** `.trellis/spec/backend/personal-agent-framework-core.md`: add the fence beside
      the sandbox contract (`:108-129`): what is enforced, what is refused at load, that an unresolvable target
      is blocked, and that the shell is out of the fence's sight by construction.

## Validation commands

```powershell
npm run typecheck
npm test
node --import tsx --test tests/spec-context-budget.test.ts   # the spec entry must fit the budget
```

`npm test` must be green before this task is checked. **Note the pre-existing red**: `tests/mode-behaviour-map.test.ts`
is an untracked draft that fails 2/2 and is not part of this task. It must be withdrawn from the gate separately
(Round 11 delta 1 in the frontier task's `decisions.md` judged it a reporting tool, not a gate) or the suite
cannot be read as green. Do not fix it inside this task.

## Risky files and rollback points

| File | Risk | Mitigation |
|---|---|---|
| `src/core/action-policy.ts` | Every run passes `evaluate`. A fence bug that mis-resolves a path blocks unrelated writes. | The check is inert when `mode.fence` is undefined (AC8), the outside-the-globs case is an explicit test (AC3), and the full suite runs before the task is checked. |
| `src/core/work-mode.ts` | The loader is fail-closed, so an over-strict validation refuses legitimate modes. | The three shipped modes are the fixture that must keep loading (step 2), and every refusal message names both ways out. |
| `src/pi-adapter/extension.ts` | A throw in the session-start path aborts the run. | The announcement path already exists (`:2034`); no new failure mode is added. |
| `PATH_BEARING_MUTATORS` | A third mutation list appearing where two already disagree. | Step 7 makes the disagreement a failing test rather than a comment nobody reads. |

**Rollback point** is after step 4: the format and the control are in place and tested with no host change, so
reverting that far leaves `main` exactly as it was. Rollback is a revert; nothing persists.

## Follow-up checks before `task.py start`

- [x] The probe in step 0 has run and its result is in `design.md` (§"Step 0"), and the guesses it replaced are
      recorded rather than deleted.
- [x] No shipped mode is in the diff (AC8): `git status` shows product-code changes only in `src/core/work-mode.ts`
      and `tests/work-mode.test.ts`.
- [ ] `tests/mode-behaviour-map.test.ts` is out of the gate, or `npm test` is documented as red for a stated
      reason. Neither is this task's work, but the task cannot be *checked* while the suite has an unexplained red.

## Follow-on tasks this plan assumes exist (not this task)

1. The prediction record - `contracts.ts` gains a `prediction` beside `passed`/`failed`/`waived` (`:72-76`) and
   the audit at `src/pi-adapter/extension.ts:1549` reports predictions the next round contradicted.
2. The failure record - the verifier-level cause and the causal mechanism become separate fields, in the shape
   `contracts.ts:81`'s finding does not have, plus the "passing behaviours to preserve" list Self-Harness requires.
3. The one measurement axis - adopt a named axis (D6) rather than invent a scoring function.