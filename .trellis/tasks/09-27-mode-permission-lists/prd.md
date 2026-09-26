# Make A Mode's Permission List Govern What The Agent Does

## Goal

A mode's `permissions.yaml` is the control that decides what the agent may do at the host's tool-call boundary. In all
three shipped modes it decides nothing: every literal entry names an action that cannot occur, and `always_allow`
changes no decision even when it does match. The modes therefore read as governed and are not - the defect class this
project keeps finding, in the one file a reviewer would look at to answer "what is this mode allowed to do?".

## Background

Three separate findings, all checked on 2026-09-27.

**1. Every literal entry names an action that cannot occur.** A permission list is matched against the *action* of a
call, and there are exactly two kinds of action: a raw host tool's name, and a capability's name (when the call goes
through `agent_run_capability`). The host's tools are `bash`, `powershell`, `read`, `edit`, `write`, `grep`,
`find`, `ls`. The registered capabilities are the `code-audit.*`, `dev.*`, `web.*`, `windows.host_info` and
`workspace.inspect` sets. Not one literal entry in any shipped mode is either:

| mode | `always_allow` | `ask_before` | `never_allow` |
|---|---|---|---|
| code-audit | `repo.read` | `report.write` | `shell.exec`, `network.*` |
| pentest | `net.scan` | `exploit.run` | `dos.*`, `social-engineering.*`, `physical.*` |
| trading | `market.read` | `order.submit` | `order.withdraw_funds`, `production.*` |

The wildcard entries (`network.*`, `dos.*`, `production.*`, …) do match a capability invocation, and a denial fires
before everything else - so they change the *reason* a call is refused. They do not change whether it is refused: the
capability under those namespaces is unregistered, so the registration check would refuse it anyway. The literal
entries change nothing at all.

**2. `always_allow` changes no decision, by construction.** `src/core/action-policy.ts` returns `allow` for both
`permission === "allow"` and the unlisted `permission === "ask"`; only `never_allow` (through `denyDecision`) and a
declared `ask_before` change the outcome. `always_allow` therefore alters the *reason* attached to an allow and
nothing else - a list that reads as a permission and grants none.

**3. The documented default is `ask`; the policy implements `allow`.** `evaluatePermission`'s contract and its test
both say an unlisted tool "defaults to ask rather than allow" (`tests/work-mode.test.ts`), and the policy then treats
that `ask` as an allow unless the action is on `ask_before`. One of the two is wrong, and which one it is decides
whether `always_allow` can ever mean anything.

**The consequence that matters most.** `modes/code-audit` declares `never_allow: [shell.exec]` to mean "no shell", and
**two comments in the code depend on that rule holding**: `src/capabilities/code-audit.ts:19-22` ("**No shell.** The
scanner is in-process, so the mode rule `never_allow: [shell.exec]` stays intact") and
`src/code-audit/seed-scanner.ts:10-12` ("does not disturb the mode's `never_allow: [shell.exec]` rule"). A `bash`
call's action is `bash`, so the rule never fires. `src/pi-adapter/action-identity.ts:5-7` states the refutation as a
finding in one file while the two files above rely on the claim.

## Confirmed facts (repository inspection, 2026-09-27)

- Host tool names, from the host's own event types: `bash`, `powershell`, `read`, `edit`, `write`, `grep`,
  `find`, `ls` (plus the tools Dove registers).
- `src/pi-adapter/action-identity.ts` is the one mapping: a capability invocation resolves to its capability name, any
  other tool to its tool name. There is no table mapping a host tool onto a Dove action, and
  `09-26-dove-agent-harness-capabilities` recorded that table as **not built**.
- `src/core/action-policy.ts`: `denyDecision` refuses `never_allow`; the scope check refuses a capability the mode
  does not grant; the registration check refuses one nothing implements; the limit and conformance gates read
  arguments; a declared `ask_before` asks. The final `allow` is the same for a listed and an unlisted action.
- `tests/host-work-mode.test.ts` asserts the permission list only where it *is* observable today: the deny list
  refuses by name, and an unlisted host tool is not refused.

## Requirements

- **R1** A mode's permission list must name actions that can occur, and a list that names one that cannot must not read
  as a control.
- **R2** `modes/code-audit`'s "no shell" must be enforced, or the two code comments that depend on it must be
  corrected. A stated guarantee that no rule implements is worse than no guarantee.
- **R3** `always_allow` either changes a decision or is removed from the format. A third list that cannot affect
  anything is a declaration that reads as a control and is not one.
- **R4** The documented default for an unlisted action must be the implemented one. `evaluatePermission`'s contract,
  its test and the policy cannot keep disagreeing.
- **R5** Whatever a mode can express, the three shipped modes use it, and the mode files say what they mean.

## Acceptance Criteria

- [ ] **AC1** Under `modes/code-audit`, a shell call is refused at the host boundary, and the refusal names the rule.
      Observed through the host, not through a unit test of the matcher.
- [ ] **AC2** The reason a capability is refused for a name nothing implements is not silently attributed to a deny
      list that never matched it.
- [ ] **AC3** Every entry in the three shipped modes' permission lists is either a **host tool name** or a
      **capability-shaped name** (a dotted name or a namespace wildcard), asserted by test. The host-tool half is also
      asserted **behaviourally** - a shell call is refused under code-audit - because that is the half that was inert.
      The capability half can only be a shape check: a mode may legitimately declare authority for a capability its
      deployment will provide (`09-27-mode-declared-capability`), so "is registered" is not the test.
- [ ] **AC4** `always_allow` either changes an outcome (asserted by a case that fails if it is ignored) or is absent
      from the format and the shipped modes.
- [ ] **AC5** `evaluatePermission`'s documented default and the policy's implemented default agree, and the test says
      which one it is asserting.
- [ ] **AC6** The two comments in `src/capabilities/code-audit.ts` and `src/code-audit/seed-scanner.ts` are true as
      written, or corrected.
- [ ] **AC7** `npm run typecheck` is clean and `npm test` is green.

## Key decision (user, 2026-09-27): option A

**Two lists that decide, and the default stays `allow`.** `always_allow` leaves the format; the shipped modes' entries
are rewritten to name actions that can occur. Chosen over the alternative of making the documented default real (an
unlisted action asks, so `always_allow` means "do not ask"): that makes every mode prompt for every tool it does not
list, which is the reason the policy chose `allow` in the first place, and it is the same reasoning already recorded
for `ask` - do not spend the operator's attention on a question whose answer cannot change what happens.

**Accepted costs, stated rather than discovered later:**

- A mode can no longer *declare* that an action is fine. Under default-allow, silence already means that, so the
declaration could never change a decision - but a reviewer reading `permissions.yaml` loses the explicit list of what
the mode expects to use.
- `always_allow` is removed from `PERMISSION_FIELDS`, so a mode that writes it becomes an **unknown field** and is
  refused by name. That is the loader's existing rule ("Unknown field, any level: rejected with a named error; never
  ignored") applied to a field that stopped existing, and it is the fail-loud direction: a third-party mode writing it
  learns at load rather than running with a field nothing reads.
- `modes/code-audit`'s "ask before writing the report" becomes `ask_before: [write, edit]`, which is coarser - it asks
  on every write, not only on the report. Stricter than intended, which is the safe direction, and the finer rule is
  not expressible: the list is name-based and the condition is about the argument. Recorded in *Out of scope*.

**Not chosen, and why (recorded so it is not re-litigated):** a per-tool binding table (`bash: shell.exec`) keeps the
mode's Dove-action vocabulary and makes it live, but it **moves** the host coupling rather than removing it - the table
names Pi's tools - and adds a silent fallback for a tool the table omits. `src/pi-adapter/action-identity.ts` already
*is* the one mapping, and a second one beside it is the failure this project keeps producing.

## Out of scope

- The verticals' form. The user has stated it is undecided; this task fixes whether the *control* works, not what the
  verticals should be.
- Building any missing capability. `09-27-trading-submission-capability` was dropped as unnecessary, and
  `09-27-mode-declared-capability` made the absence honest.
- Argument-scoped rules (for example "ask before writing *the report*"). The list is name-based; if a mode needs a
  condition on the arguments, that is a new control and its own task. Recorded here so the gap is stated rather than
  implied.

## Notes

- Found while planning the follow-ups to `09-27-mode-gate-no-gate` and `09-27-mode-declared-capability`, and larger
  than either: those two fixed declarations that could not decide anything, in the mode format and in the registry. This
  is the third one, in the file that decides what the agent may do.
- `modes/code-audit/permissions.yaml` was already touched once on 2026-09-27 (`read_*` -> `repo.read`), and the
  replacement was as dead as the original: the earlier fix matched the mode's *declaration* instead of the actions that
  can occur. That is the same mistake this task exists to stop making.
