# Implementation plan

## Preconditions

- The user chose option A on 2026-09-27: `gate.semantics` gains `none`; `limit`/`both` with zero limits refuses to
  load. Recorded in `prd.md` under *Key decision*.
- The gate is `npm run typecheck` clean and `npm test` green, plus the per-file runs below.

## Steps, in order

1. **`src/core/work-mode.ts` - the vocabulary.** Add `"none"` to `GATE_SEMANTICS` (`:112`), to the
   `WorkMode.gateSemantics` union (`:77`) and to the cast at `:377`. The validation message at `:353` lists the set
   from the constant, so it updates itself.

2. **`src/core/work-mode.ts:542` - the loader's early return. This is the trap.** It reads
   `if (mode.gateSemantics === "limit") return { mode };` and must become `=== "limit" || === "none"`. Left alone, a
   `none` mode falls through to the conformance path and is refused with a message about conformance documents - the
   value would appear implemented and not be. AC2 is the detector; step 3's tests are what make it fail loudly.

3. **`src/core/work-mode.ts` - two new load rules, next to `parseLimits` so the file-level loader enforces them too.**
   The conformance rule stays in `loadWorkModeFromDirectory` because it needs a workspace root; these need only the
   parsed mode.
   - `limit` or `both` with zero `gate.limits` -> `WorkModeError` naming the mode, the field, and both ways out
     (declare the limits, or declare `none`). Zero means absent **or** an empty list.
   - `none` with any `gate.limits` -> `WorkModeError` naming the contradiction: thresholds that would never be
     consulted.

4. **`src/core/work-mode.ts:548,555` - the conformance refusals.** Both currently end by offering only
   `gate.semantics: limit`. Offer `none` as well, and keep the two distinct: `limit` is for a mode with thresholds
   and no external grantor, `none` for one with neither.

5. **`modes/code-audit/governance.yaml`** - `semantics: limit` -> `none`; version `1.5.0` -> `1.6.0` (the
   declaration is part of what the mode authorizes, which is the convention `code-audit-mode.test.ts` asserts); reword
   the comment block above it, which currently explains why `limit` was chosen.

6. **`modes/code-audit/MODE.md`** - the `compatibility` frontmatter line says "declares gate.semantics limit with no
   thresholds"; it must say `none`. Quote the value: an unquoted YAML scalar containing `": "` is parsed as a nested
   mapping and the mode stops loading (this happened once already).

7. **Tests.**
   - `tests/work-mode.test.ts` - `none` is accepted; `limit` and `both` with no limits are refused and the message
     names both ways out; `none` with limits is refused; an unrecognised value is still refused and the message lists
     four values.
   - `tests/code-audit-mode.test.ts` - the semantics assertion becomes `none`; the version assertion becomes
     `1.6.0`.
   - `tests/action-policy.test.ts` - a `none` mode's `gates` is `["deny", "scope", "ask"]` (AC2), beside the
     existing conformance-mode assertion at `:94`.
   - `tests/host-work-mode.test.ts` - the code-audit host case still loads and still gates by permission list; add an
     operator-visible case that a mode declaring `limit` with no limits **refuses to load through the host** and names
     both ways out. Force the declaration in the throwaway copy, the way `forceConformance` already does for the
     conformance case, so no shipped mode has to carry a shape that refuses.

8. **`modes/trading` and `modes/pentest` are not touched** (AC5, AC6). Assert that rather than assuming it: the
   trading test already loads the mode and builds its gate from the loaded limits, and the pentest host case already
   asserts the conformance refusal.

9. **`.trellis/spec/backend/personal-agent-framework-core.md`** - the Work-Mode section's `governance.yaml requires
   ...` line and the validation matrix need the four values and the two new refusals.
   **This file is budget-bound**: `tests/spec-context-budget.test.ts` holds it to 24 KiB and the current headroom is
   ~206 bytes, so the addition has to be paid for by trimming. Run that test as part of the change, not after.

10. **`README.md` / `README.en.md`** - check whether either enumerates the gate semantics. If it does, it changes
    with the vocabulary; if not, leave them.

## Validation commands

```bash
node --import tsx --test tests/work-mode.test.ts
node --import tsx --test tests/code-audit-mode.test.ts
node --import tsx --test tests/action-policy.test.ts
node --import tsx --test tests/host-work-mode.test.ts
node --import tsx --test tests/spec-context-budget.test.ts
npm run typecheck
npm test
```

## Risky files and rollback

| File | Risk | Rollback |
|---|---|---|
| `src/core/work-mode.ts` | the loader every mode goes through; a wrong rule makes a shipped mode refuse to start | remove the new rules; `none` is additive and can stay |
| `modes/code-audit/governance.yaml` | the live mode; reverting to `limit` restores the vacuous declaration it is here to remove | one-line revert |
| `.trellis/spec/backend/personal-agent-framework-core.md` | budget-bound; an over-budget edit fails a test | trim, or revert the edit |

## Follow-up checks before `task.py start`

- No shipped mode or example engagement declares `limit`/`both` with zero limits. **Checked 2026-09-27**: shipped
  modes are `code-audit` (`limit`, zero limits - the case this task fixes), `trading` (`limit`, two limits),
  `pentest` (`conformance`). `engagements/` holds only `example-engagement`, which is a document, not a mode.
- Every consumer of `gateSemantics` tolerates a fourth value. **Checked**: nine sites, all enumerated - the type, the
  constant, the validation, the cast, the loader's early return, two refusal strings, and two strings in
  `action-policy.ts`/`extension.ts` that only interpolate the value. None switches without a default.
- `code-audit`'s version bump is authority-relevant, so it is a minor bump to `1.6.0`, matching the convention
  `code-audit-mode.test.ts` already asserts for 1.2.0 - 1.5.0.

---

## Outcome, 2026-09-27  **[DONE]**

Implemented as planned. `gate.semantics` is now `none | limit | conformance | both`; `limit`/`both` with no
`gate.limits` and `none` with any both refuse to load, each naming both ways out; `modes/code-audit` declares `none`
and moves 1.5.0 -> 1.6.0.

**The planned trap was real, and is now pinned by a test.** `src/core/work-mode.ts:542`'s early return was hardcoded
to `limit`. Left alone, a `none` mode falls through to the conformance path and is refused with a message about grant
documents - the value would have looked implemented and not been. The host case in `tests/host-work-mode.test.ts` is
what fails if that line is narrowed again.

**Four things found while doing it.**

1. **The spec budget is effectively exhausted, and the measurement has a trap.** `personal-agent-framework-core.md`
   had 206 bytes of headroom before this change and 56 after; `personal-agent-request-runtime.md` sits at 37. Two of
   the largest agent specs are within ~50 bytes of the 24 KiB ceiling, so the next one-line addition to either fails
   `tests/spec-context-budget.test.ts`. **And a raw byte count is not the measurement the test makes**: it normalises
   CRLF to LF first, so `personal-agent-request-runtime.md` reads 24,933 raw against a 24,576 budget and passes
   because its working-tree line endings are CRLF (24,539 normalised). Checking with `Get-Item Length` reports a false
   failure. Recorded rather than fixed: raising or splitting the budget is its own decision, and prose surgery on a
   spec this change is not about is how a nuance gets lost.
2. **A fixture helper silently rewrote nothing.** `forceConformance` replaced the literal `"  semantics: limit"`, and
   after the mode file moved to `none` that replace was a no-op - so the case failed because code-audit *loaded*, not
   because the refusal it was testing had regressed. It is now `forceSemantics(root, name, value)`, and it **throws**
   when no `semantics:` line was rewritten, because a fixture that quietly does nothing is a test that proves nothing.
3. **No new `WorkModeErrorCode`.** `missing-field` for `limit`/`both` with no limits (the companion field is absent)
   and `invalid-type` for `none` with limits (a combination the format does not allow). `invalid-type` is already used
   this way for the `target_argument` value constraint, and nothing switches on the code, so adding a value for one
   case would be an API expansion with no consumer.
4. **The rule needed no new mechanism.** Both rules live in `loadWorkMode`, beside `parseLimits`, so the file-level
   loader enforces them too; the conformance rule stays in `loadWorkModeFromDirectory` because only it needs a
   workspace root. Nothing was added to the action policy: `wantsConformance` and `mode.limits.length > 0` already
   decide what gets built, so `none` needed no branch there.

**Deliberately not a rule**, recorded in the PRD: `none` alongside a resolvable `authority.grant` document is allowed.
The mode has said it has no gate, so the document is not claimed as a control.

**Acceptance criteria, each with its evidence.**

| AC | Evidence |
|---|---|
| AC1 | `tests/work-mode.test.ts` (vocabulary: `limit` and `both` refused, naming both ways out) + the new host case, which observes the refusal through `session_start` and the blocked tool call |
| AC2 | `tests/action-policy.test.ts`: a `none` mode's `gates` is `["deny", "scope", "ask"]` - no threshold gate, no conformance gate |
| AC3 | `tests/work-mode.test.ts`: `none` with limits is refused as `invalid-type`, naming the contradiction |
| AC4 | `tests/host-work-mode.test.ts`: code-audit loads through the host and its permission lists decide what runs |
| AC5 | `tests/trading-mode.test.ts`: trading still loads with both limits, and the over-limit order is still refused |
| AC6 | `tests/host-work-mode.test.ts`: the pentest pre-flight case and the forced-conformance case are unchanged |
| AC7 | The forced-conformance case asserts the refusal also offers `none` |
| AC8 | typecheck 0 errors; `npm test` 589 / pass 587 / fail 0 / skipped 2 |

**Validation (all run):**

```text
node --import tsx --test tests/work-mode.test.ts        -> tests 35 / pass 35 / fail 0   (30 before, +5)
node --import tsx --test tests/action-policy.test.ts    -> tests 12 / pass 12 / fail 0   (11 before, +1)
node --import tsx --test tests/code-audit-mode.test.ts  -> tests 16 / pass 16 / fail 0
node --import tsx --test tests/host-work-mode.test.ts   -> tests 19 / pass 19 / fail 0   (18 before, +1)
node --import tsx --test tests/spec-context-budget.test.ts -> tests  5 / pass  5 / fail 0

npm run typecheck -> 0 errors
npm test          -> tests 589 / pass 587 / fail 0 / skipped 2   (582 before, +7)
```

**Not done, on purpose:** the READMEs do not enumerate the gate semantics, so neither changed. And the budget
tightness in finding 1 is recorded, not fixed.

