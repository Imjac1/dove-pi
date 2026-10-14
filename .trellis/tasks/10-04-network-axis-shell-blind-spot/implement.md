# Implementation: the load line says what the mode could not enforce

## Ordered checklist

1. **Write the case first, and watch it red.** In `tests/host-work-mode.test.ts`, a mode that declares
   `sandbox.network: none` and keeps a shell (`code-development`'s own combination) must, on load:
   - **load** - `activeWorkMode` is set and a tool call is answered, so nothing new refuses;
   - **say it** - the load line names the shell as outside the axis.
   Red today, because the line reports denials and not blind spots. **Do not make it green by refusing the mode**: that
   is the `unenforceable` path the design rules out, and it would take the shipped `code-development` down with it.

2. **Carry the unkept claims from where they are computed to where they are printed.** `extension.ts:2420` already
   computes `unenforceableSandboxClaims(activeWorkMode?.sandbox)` for the refusal path. The load line at `:2490` needs
   the same value for the *loading* path - the claims that are unenforceable **and did not refuse**, which is what
   remains after the refusal check has run. One derived value, read in one place, so the two paths cannot disagree.

3. **Add it to the load line as a suffix, not a rewrite.** The line keeps its existing shape - `<n> denied action(s) are
   refused, and <m> action(s) run only after you confirm them` - and gains the unkept part after it. A mode with nothing
   unkept gets the line it gets today, byte for byte: that is the control the case asserts, and it is what makes this a
   reading change rather than a behaviour change.

4. **The same fact in `/status`,** beside the existing `hashlineEditTools=` field, so the two readings a person checks
   are in the same place. The field name follows the existing shape: `unenforcedSandbox=<claims>` or `none`.

5. **One ledger record, once per request plan** - not per tool call. This is a fact about the mode, and repeating it on
   every call would bury it.

6. **The specification sentence, with a resolvable anchor.** In `personal-agent-mode-format.md`, beside the paragraph
   that already says what the network axis does not cover: where a partly enforceable mode reports the unkept part. Cite
   the load-line site so `spec-anchors` can resolve it.

7. **Run the doors and the suite.** `npm test`, `spec-anchors`, `document-drift`, `task-artifact-lint --assert-corpus`.
   The mount table will move if the edit lands above a registration - repoint its rows from the declarations, and the
   page's prose citations by reading each one back, as the last four times this happened.

## Validation

- The case is the acceptance criterion: a partly enforceable mode loads **and** says what it does not cover.
- The control in the same case: an all-enforceable mode's load line is unchanged.
- `code-development` still runs its own tests, which is the PRD's R2 and the reason the refusal path was rejected.
- The PRD's third acceptance criterion - `pentest`/`trading` are not refused by this - is held by the existing
  mode-load cases, which must stay green.

## What is deliberately left out

- Any form of enforcement (out of scope in the PRD).
- Changing what `unenforceableSandboxClaims` returns or which claims refuse a load.
- The other unenforceable axes (`isolation: container`/`worktree`, `network: allowlist`): they refuse, so they already
  have their record.
