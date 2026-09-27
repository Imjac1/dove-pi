# The inventory: every declaration this harness ships that does not do what it says

- Date: 2026-09-27
- Why this exists: the frontier's own framing is that a harness should **document its absences** rather than let a
  partial control be mistaken for a boundary - Pi's security documentation does exactly that ("would be easy to
  misunderstand as a security boundary"), and Cursor's calls its modes "best-effort guardrails rather than a hard
  security boundary". This project ships fourteen declarations that read as controls and are not. They are listed
  here with the evidence that says so, **so that none of them is a surprise and none is mistaken for enforcement**.
- Evidence types, weakest to strongest: **static** (a reader scan over `src/`, no behaviour to observe) ·
  **behavioural** (a test that runs the path and asserts the gap) · **withdrawn** (a claim this session made and
  disproved).

## The inventory

| # | Declaration | Who ships it | Evidence | Decision |
|---|---|---|---|---|
| 1 | Every literal entry in the permission lists names an action that cannot occur | all three modes | **behavioural** - `tests/host-work-mode.test.ts`, "refuses a capability the mode grants and nothing registers" | D2 |
| 2 | `always_allow` cannot change a decision, even when it matches | the format, all three modes | **behavioural** - `tests/action-policy.test.ts`, "builds neither a threshold nor a contract gate..."; the policy returns `allow` for a listed and an unlisted action alike | D2 |
| 3 | `gate.intensity`, `gate.windows`, `gate.excluded_techniques` | the format | **static** - no reader in `src/` outside the parser | D4 |
| 4 | The authority document's `constraints` (intensity ceiling, excluded techniques, `max_requests_per_second`) | `engagements/example-engagement` | **behavioural** - `[KNOWN GAP: D4]`: a technique forbidden in **both** places is allowed | D4 |
| 5 | `accumulatedIntensity` - part of the gate contract, always `{}` | `extension.ts:2316`, `loop-runner.ts:116` | **static** | D4 |
| 6 | `governance.sandbox` - `isolation: container` / `worktree`, `network: allowlist` / `none`, `filesystem: ephemeral` / `read-only-source` | **all three modes** | **static** - the only `sandbox` mentions in `src/` are a code-audit finding category (`sandbox_absent`) and the parser's field list. **There is nothing behavioural to observe, which is the point.** | D1 |
| 7 | `scope.exclusions` - `[t-payments]`, `[production-venue]`, `[]` | all three modes | **behavioural** - `[KNOWN GAP]`: a target the mode excludes is allowed, even when the exclusion names the target its own document authorizes | D2/D4 |
| 8 | `authority.expires` - `2026-10-01`, `2026-12-31`, `2027-01-01` | all three modes | **behavioural** - `[KNOWN GAP]`: an expired mode loads | D2/D4 |
| 9 | `authority.grant_graph` | the format accepts it | **static** - no reader | - (unimplemented feature, harmless) |
| 10 | `mode.license` | all three modes (`MIT`) | **static** - no reader | - (Agent-Skills compatibility, harmless) |
| 11 | `toClientOrderId` | `src/core/effect-ledger.ts:231` | **static** - no runtime caller (recorded in the dropped trading task's PRD) | - (either a caller or deletion) |
| 12 | `appendCapabilityApprovalPending` / `appendCapabilityApproved` | `src/core/execution-ledger.ts:308,312` | **static** - no caller | - |
| 13 | The acceptance contract of `09-03-task-convergence-control`: ten criteria, all `pending`, `evidenceRefs: []`, frozen at `revision: 1` and archived | that task | **behavioural** - the file itself; and `tests/task-convergence.test.ts` has ten cases that cover the criteria but are linked to them nowhere | D3 |
| 14 | `read_*` in `modes/code-audit/permissions.yaml`, replaced by `repo.read` on 2026-09-27 | this session | **withdrawn** - the replacement was as dead as the original: it matched the mode's *declaration* rather than the actions that can occur | fixed as #1 |

## What is *not* on this list, and that is the point

Things this session checked and found genuinely live: the effect claim at the dispatch line; the capability scope;
the registration check; the limit gate; the conformance gate and its pre-flight; the mode loader's refusals
(`semantics`, `limits`, framework range, unknown fields); `ask_before`'s confirmation and its no-dialog refusal;
the evidence-resolution rule for a `passed` criterion (`unresolvedAcceptanceEvidence` reads the ledger and the
effects directory); the spec size budget; the reachability allow-list.

**Two of those were briefly believed to be inert and were not** - the evidence-resolution rule (#13's neighbour) and
`gate.intensity`'s sibling in the document. Both hypotheses were withdrawn with the code that disproved them
recorded. **A list like this is only worth reading if its author also records what they got wrong.**

## The one structural observation

Every entry above is the same defect: **a declaration whose reader does not exist, or whose reader exists but
cannot see the fact the declaration is about.** The first kind is findable mechanically (the field-level reader
scan, ~30 lines). The second kind is not: #4 needed a behavioural test, because the reader exists and reads the
wrong thing. That distinction is the useful output of D5's experiment, and it is why "populate an allow-list with
reasons" - the reachability test's shape - is the right form for the first kind and not for the second.
