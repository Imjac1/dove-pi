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

7. **`.trellis/spec/backend/personal-agent-framework-core.md`** - the Work-Mode section states the rule: a mode's
   grant may name capabilities the runtime does not provide, loading does not refuse them, and the boundary does.
   **Budget-bound**: `tests/spec-context-budget.test.ts` holds the file to 24 KiB with ~206 bytes of headroom, and
   `09-27-mode-gate-no-gate` also edits this file. Whichever lands second pays more; run the budget test as part of
   the change.

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
