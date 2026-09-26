# Implementation plan

## Preconditions

- The user chose option A on 2026-09-27: two lists that decide, the default stays `allow`, `always_allow` leaves the
  format. Recorded in `prd.md` under *Key decision*, with the costs and the rejected alternative in `design.md`.
- The gate is `npm run typecheck` clean, `npm test` green, and `tests/spec-context-budget.test.ts` green - the last one
  because the spec edit is budget-bound.

## Steps, in order

1. **`src/core/work-mode.ts` - the format.** Remove `always_allow` from `PERMISSION_FIELDS` and from
   `PermissionSet`, and drop the line that parses it. Nothing else: the unknown-field rule already refuses a mode that
   writes it, by name.

2. **`src/core/work-mode.ts` - `evaluatePermission`.** Narrow the return to `"ask" | "deny"` and reword the contract to
   say what the function now answers: does this action need consent, or is it refused outright. The precedence rule
   (`never_allow` > `ask_before` > the default) does not move.

3. **`src/core/action-policy.ts` - the tail.** Replace the two-input branch with one `matchesPermission` call on
   `ask_before` and the default allow. The allow reason stops claiming the mode "neither allows nor denies" it - with
   `always_allow` gone, the honest sentence is that the mode neither asks about it nor denies it.

4. **The three `permissions.yaml` files**, per the table in `design.md`: drop `always_allow`; code-audit's
   `never_allow` becomes `[bash, powershell, network.*]` and its `ask_before` becomes `[write, edit]`. Bump each
   `governance.yaml` version (code-audit 1.6.0 -> 1.7.0, pentest 1.1.0 -> 1.2.0, trading 1.1.0 -> 1.2.0).

5. **The two comments that depend on the rule.** `src/capabilities/code-audit.ts:19-22` and
   `src/code-audit/seed-scanner.ts:10-12` both name `never_allow: [shell.exec]`; after step 4 the rule is
   `[bash, powershell]`. Update the names, and say in one clause **why** the rule now holds, so the next reader does not
   have to check the matcher to believe it.

6. **Tests.**
   - `tests/work-mode.test.ts`: `always_allow` is now an unknown field and is refused by name; the precedence cases
     drop the arm they no longer have; `evaluatePermission` returns only `"ask"` or `"deny"`.
   - `tests/host-work-mode.test.ts`: **AC1** - under code-audit, a `bash` call is refused and the reason names the rule.
     This is the case that fails today, and it is the whole point of the task.
   - `tests/code-audit-mode.test.ts`, `tests/trading-mode.test.ts`: the permission assertions move off
     `always_allow`; the code-audit version assertion becomes `1.7.0`.
   - **AC3**, a new assertion: every entry in the three shipped modes' permission lists is a host tool name or a
     capability-shaped name. The host tool names come from the host's own event types, so the list is checked against
     the host rather than against a copy of it.

7. **`.trellis/spec/backend/personal-agent-framework-core.md`** - the Work-Mode scenario: the field list, the
   precedence line, the matrix, and the tests bullet. Written to be **net negative** in bytes (56 of headroom), and the
   budget test runs in step 8.

8. **Validation commands**, all of them:

```bash
node --import tsx --test tests/work-mode.test.ts
node --import tsx --test tests/code-audit-mode.test.ts
node --import tsx --test tests/trading-mode.test.ts
node --import tsx --test tests/action-policy.test.ts
node --import tsx --test tests/host-work-mode.test.ts
node --import tsx --test tests/spec-context-budget.test.ts
npm run typecheck
npm test
```

## Risky files and rollback

| File | Risk | Rollback |
|---|---|---|
| `src/core/work-mode.ts` | the loader every mode goes through; removing a field makes a mode that writes it refuse to start | return the field to `PERMISSION_FIELDS` and `PermissionSet` |
| `src/core/action-policy.ts` | the one policy; the tail decides whether an action runs | restore the two-input branch - the behaviour is identical, which is the point |
| `modes/*/permissions.yaml` | shipped modes; a wrong entry is a control that does nothing | revert the entries; the old ones are recorded in `design.md` |
| `.trellis/spec/backend/personal-agent-framework-core.md` | budget-bound with 56 bytes of headroom | trim, or revert the edit |

## Follow-up checks before `task.py start`

- Nothing outside the policy and the tests compares against `"allow"` from `evaluatePermission`. **Checked**: the
  function's only consumers are `src/core/action-policy.ts` and the tests.
- The host tool names used in the shipped modes exist. **Checked** against the host's event types: `bash`,
  `powershell`, `read`, `edit`, `write`, `grep`, `find`, `ls`.
- `modes/code-audit`'s declared `never_allow` does not conflict with what its capabilities need. **Checked**: the two
  code-audit capabilities are in-process and never shell out (`src/capabilities/code-audit.ts:17-24`), which is exactly
  why the mode can forbid the shell.
- `modes/pentest` needs the shell, so no shell prohibition is added to it. **Checked**: its `MODE.md` describes an
  engagement run against a target, and nothing in it forbids local tooling.
