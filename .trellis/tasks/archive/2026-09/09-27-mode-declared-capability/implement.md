# Implementation plan

## Preconditions

- The user chose scope A on 2026-09-27: drop `09-27-trading-submission-capability` (archived) and fix the
  declared-but-unregistered hole instead. Recorded in `prd.md`.
- The gate is `npm run typecheck` clean and `npm test` green, plus the per-file runs below.

## Steps, in order

1. **`src/core/action-policy.ts` - the input.** `ActionPolicyOptions` gains
   `registeredCapabilities: readonly string[]`, **required, with no default**. There is no safe default: a policy
   that does not know what the runtime provides cannot decide whether a declared capability exists, and `[]` would
   refuse every honest caller while omitting the check would allow every missing one. Required means the compiler
   names every call site.

2. **`src/core/action-policy.ts` - the check, and its position.** Inside `evaluate`, **immediately after the
   capability scope check and before the limit gate**: `can it run at all` precedes `may it run with these
   arguments`. It is gated on `source.viaCapability` - a raw host tool's action is a tool name, and the registry is
   not what governs it.
   - The order is load-bearing and pinned by AC7: deny (a policy decision) -> scope (this agent may not reach it) ->
     registered (this deployment cannot run it) -> limits -> conformance -> ask. Reporting a deployment problem as a
     denial, or asking the operator about an action that cannot run, are the two failures this ordering prevents.
   - Label the decision `"registered"` and add it to the `gates` array in that position, so a reader sees the
     policy instead of inferring it.

3. **`src/core/action-policy.ts` - the refusal text.** Name the capability, say nothing in this runtime registers it,
   and give both ways out: install/register the capability, or correct the mode's `authority.capabilities`
   deliberately. The operator is never asked about it.

4. **`src/pi-adapter/extension.ts:1958`** - pass `registeredCapabilities: registry.list().map((c) => c.name)`.
   `registry` is built at `:654` (module top level) and the policy at `session_start`, so the order is already
   correct; `registry.list()` is already used elsewhere (`:146`, `:162`, `:1214`).

5. **Tests - the behavioural triple, which is the detector.**
   - `tests/action-policy.test.ts`: a declared-and-registered action is allowed; declared-and-unregistered is
     refused with `[registered]`; registered-and-undeclared is refused with `[scope]`; a `never_allow` action is
     refused with `[deny]`. The existing `gates` assertion at `:94` gains `"registered"` in position three.
     Because the new option is required, the file's ~12 `createActionPolicy` call sites need it - introduce one local
     `policy()` helper rather than editing twelve literals.
   - `tests/host-work-mode.test.ts` (AC1, AC2): under `modes/trading`, `agent_run_capability {name: "order.submit"}`
     and the same for `market.read` are blocked; the reason names the capability; `host.confirmCalls.length === 0`;
     and the effect store directory (`<root>/.dove/effects`) is **absent or empty** - no claim for an action that
     cannot run.
   - `tests/host-work-mode.test.ts` (AC3, AC5): code-audit's `repo.read` still runs, and `modes/trading` still
     **loads** (the mismatch is not a load rule).

6. **Verify the detector's sensitivity by hand, once, and record it.** Temporarily remove the registration check and
   confirm AC1/AC2 fail; temporarily remove the scope check and confirm AC3 fails. There is no code-mutation test -
   the three behavioural cases are the detector, and this step is how we know they are load-bearing rather than
   decorative. Record the observation in the task notes rather than in the suite.

7. **`.trellis/spec/backend/personal-agent-capability-runtime.md`** - states the rule: a mode's grant may name
   capabilities the runtime does not provide, loading does not refuse them, and the boundary does.
   **Amended 2026-09-27, after approval and after the sibling task landed.** The approved plan named
   `personal-agent-framework-core.md`. That file now has **56 bytes** of headroom against the 24 KiB budget
   (`tests/spec-context-budget.test.ts`, which CRLF-normalises before counting), because `09-27-mode-gate-no-gate`
   spent it; this file has ~6.7 KiB. The rule is the registry's contract as much as the mode format's, so the new
   home is not a compromise - but the change of home is recorded here because the approved plan named the other file,
   and the plan is what the approval was for.

8. **Not touched, deliberately:** `modes/trading/*` (the mode keeps declaring what its deployment must provide - see
   *Not a rule* in `prd.md`), and `toClientOrderId` (recorded in the dropped task's PRD as a known dead export).

## Validation commands

```bash
node --import tsx --test tests/action-policy.test.ts
node --import tsx --test tests/host-work-mode.test.ts
node --import tsx --test tests/code-audit-mode.test.ts
node --import tsx --test tests/spec-context-budget.test.ts
npm run typecheck
npm test
```

## Risky files and rollback

| File | Risk | Rollback |
|---|---|---|
| `src/core/action-policy.ts` | the one policy every mode goes through; a wrong position changes which reason the operator sees | remove the check and the option; the vocabulary is unchanged |
| `src/pi-adapter/extension.ts` | the only running entry point; the option is required, so the two edits go together | revert both |
| `.trellis/spec/backend/personal-agent-framework-core.md` | budget-bound, and shared with `09-27-mode-gate-no-gate` | trim, or revert the edit |

## Follow-up checks before `task.py start`

- `registry.list()` returns capability names and is already used in production code. **Checked**: `:146`, `:162`,
  `:1214`, and `tests/code-audit-mode.test.ts:218`.
- The registry exists before the policy is built. **Checked**: `extension.ts:654` is module top level; the policy is
  built in `session_start` (~`:1958`).
- `createActionPolicy` has exactly one production call site. **Checked**: `extension.ts:1958`; the rest are in
  `tests/action-policy.test.ts`, which step 5 handles.
- `modes/trading` still loads after the change, so the rule is a boundary rule and not an accidental load rule.
  **Checked by design** (nothing added to `work-mode.ts`), asserted by AC5.

---

## Outcome, 2026-09-27  **[DONE]**

Implemented, but **the premise was falsified mid-flight and the plan changed**. Reported to the user, who chose to keep
the check and re-point the evidence (option A).

**What landed.** `ActionPolicyOptions.registeredCapabilities` (required, no default); a check inside `evaluate`
immediately after the capability scope and before the limit gate, labelled `registered` and placed third in `gates`;
the extension passing `registry.list().map((c) => c.name)`; and the rule recorded in
`personal-agent-capability-runtime.md` (its planned home moved there from `personal-agent-framework-core.md`, which had
56 bytes of headroom - see the amendment above).

**The premise that did not hold.** The plan assumed the mismatch was trading-specific. It is not: **six of the nine
capabilities the shipped modes declare have no implementation** - code-audit's `repo.read` and `report.write`,
pentest's `net.scan` and `exploit.run`, trading's `market.read` and `order.submit`. `authority.capabilities` is a grant
list, not a mirror of the registry. Consequences:

- **AC3 as written was unachievable** and is amended in the PRD: `repo.read` is registered nowhere, so it is refused,
  correctly, rather than running.
- **Five host cases lost their subject**, because each demonstrated a mode control by invoking a capability nothing
  implements: code-audit's permission lists, the `ask_before` confirmation, the no-dialog refusal, the conformance
  refusal, and the effect claim. All five now run against a fixture mode over a **registered** capability, via
  `writeFixtureMode` and `writeFixtureEngagement`. That is a stronger test than it was: the control is now exercised on
  an action that can actually run, instead of on one that would have thrown.
- The code-audit case now asserts what is true: the mode loads, its unimplemented declarations are refused as
  `[registered]`, its deny list still refuses by name, and a raw host tool is still governed by the permission list.

**The detector's sensitivity, checked by hand (step 6) rather than assumed.** The suite cannot test its own
sensitivity, so each check was removed in turn and the right case observed to fail:

- registration check disabled -> **three** cases fail: the policy-level one, and both host-level ones.
- scope check disabled -> the `[scope]` assertion fails, plus the pre-existing scope case.

Both probes were reverted immediately and the suite confirmed green afterwards. Recorded here because it is the only
evidence that the three cases are load-bearing rather than decorative.

**Three schema facts the fixture work turned up**, each of which cost a red run and is worth knowing:

1. **A fixture mode must not write `semantics: limit` with no limits** - the sibling task's new rule refuses it. The
   helper now emits `none` when it declares neither a limit nor a contract. The rule caught its own fixtures, which is
   the rule working.
2. **A grant's targets go at the grant level, not under `authorizes`.** `authorizes` accepts exactly `actions` and
   `outcomes`; `targets` beside them is an unknown field and refuses the load.
3. **A grant a principal issues to itself authorizes nothing**, and the conformance gate says so by name ("Grant
   'g-workspace' is issued by the operator itself"). The fixture needs a separate grantor, and signed evidence on the
   grant, or the pre-flight refuses the engagement before any action is reached.

**Acceptance criteria, each with its evidence.**

| AC | Evidence |
|---|---|
| AC1 | `tests/host-work-mode.test.ts`: under trading, `order.submit` (also over its declared notional) and `market.read` are refused with `[registered]`, `confirmCalls` is empty, and `.dove/effects` holds no claim |
| AC2 | The same case, second name in the loop |
| AC3 (amended) | `tests/action-policy.test.ts`: a registered action is allowed; `nope.nope` is refused with `[scope]` |
| AC4 | `tests/action-policy.test.ts`: `dos.syn` is refused with `[deny]`, and the host case asserts `network.fetch` is refused by `never_allow` |
| AC5 | `tests/host-work-mode.test.ts`: trading loads and announces itself; the refusal is at the action, not at startup |
| AC6 | The two hand probes above |
| AC7 | `tests/action-policy.test.ts`: `gates` is `["deny", "scope", "registered", ...]`, and the ordering case asserts both `[deny]` and `[scope]` come first |
| AC8 | typecheck 0 errors; `npm test` 594 / pass 592 / fail 0 / skipped 2 |

**Validation (all run):**

```text
node --import tsx --test tests/action-policy.test.ts   -> tests 16 / pass 16 / fail 0   (12 before, +4)
node --import tsx --test tests/host-work-mode.test.ts   -> tests 20 / pass 20 / fail 0   (19 before, +1; five re-pointed)
node --import tsx --test tests/spec-context-budget.test.ts -> tests  5 / pass  5 / fail 0

npm run typecheck -> 0 errors
npm test          -> tests 594 / pass 592 / fail 0 / skipped 2   (589 before, +5)
```

**Not done, on purpose:** `modes/trading/*` is untouched (the mode keeps declaring what its deployment must provide),
`toClientOrderId` still has no runtime caller (recorded in the dropped task's PRD), and the dead permission entries in
`modes/code-audit/permissions.yaml` are recorded in the PRD rather than fixed - what that vertical's permission list
should say is a decision about the vertical.

