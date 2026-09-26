# Refuse An Action A Mode Declares But Nothing Registers

## Goal

An action a mode grants authority for, but that nothing in the runtime registers, must be refused **where the mismatch
is decidable and before the operator is asked** - not approved and then thrown. Today the operator confirms an order
and only then learns the capability does not exist.

## Background

`modes/trading/governance.yaml` declares `authority.capabilities: [market.read, order.submit]` and **nothing registers
either**. The mode-versus-registry agreement is only ever checked in one direction:

```
registered -> declared      asserted by tests/code-audit-mode.test.ts:222
declared   -> registered    asserted nowhere
```

So the mode loads, every control fires in order, and the action fails last. Observed sequence for a trading-mode order:

```
tool_call hook
  -> denyDecision (not on never_allow)          allow
  -> capability scope (mode declares it)        allow
  -> limit gate (inside the declared bounds)    allow
  -> ask_before: [order.submit]                 ASK -> operator confirms
  -> effect claim taken at the dispatch line    claimed
  -> registry.require("order.submit")           THROW Unknown capability: order.submit
```

Fail-closed - no order is submitted - but the operator was asked about an action that cannot run, and an effect claim
was taken for it. This became visible only once `ask_before` was consumed (2026-09-26); before that the action was
silently allowed and then threw.

## Confirmed facts (repository inspection, 2026-09-27)

- `modes/trading/governance.yaml` — `authority.capabilities: [market.read, order.submit]`; neither is registered.
- `src/capabilities/runtime.ts:46-48` registers exactly `hostInfoCapability` and `workspaceInspectCapability`.
  `src/capabilities/code-audit.ts` registers the code-audit set; there is no trading registration and no
  `src/trading/` module.
- `src/core/capability-registry.ts:21-23` — `require(name)` throws `Unknown capability: ${name}`.
- `src/pi-adapter/extension.ts:1474` — the capability tool's `execute` calls `registry.require(typedParams.name)`,
  which is where the throw happens, i.e. **after** the gate and the claim.
- `src/pi-adapter/extension.ts:2246` — the `tool_call` handler already reads the registry
  (`registry.get(event.input.name)?.sideEffects`), so a pre-ask check needs no new plumbing.
- `src/core/action-policy.ts` — the policy returns `ask` **last**, after deny, scope, limits and conformance, and the
  host resolves it with a confirmation. Anything refused earlier never reaches the prompt.
- `src/core/loop-runner.ts:135` — the effect claim is taken at the dispatch line, which is after the ask.
- `tests/code-audit-mode.test.ts:213-222` — the one-directional assertion, and its comment states the intended rule:
  *"A capability that is registered but not declared by the mode is authority the mode never granted. The two lists
  have to agree, and the mode is the one that governs."* The converse is the same disagreement and has no check.
- `modes/*/MODE.md` `compatibility` lines and the Agent-Skills-compatible frontmatter mean a mode file is a
  **portable document**; the capability registry is a property of the installed runtime.

## Requirements

- **R1** A capability invocation whose action the mode declares but the runtime does not register is refused at the
  host's `tool_call` boundary, **before** the `ask_before` confirmation and before any effect claim.
- **R2** The refusal names the capability and gives both ways out: install/register the capability, or correct the
  mode's `authority.capabilities` deliberately.
- **R3** A capability that is registered but not declared keeps its current behaviour - refused by the capability
  scope - so the two directions of the agreement both hold and are distinguishable in the reason.
- **R4** An action on the mode's `never_allow` is still refused **as a denial**, not as a missing registration: the
  deny list is a policy decision and must not be reported as a deployment problem.
- **R5** **No load-time refusal.** A mode naming a capability this runtime lacks still loads. A mode file is a portable
  document and the registry is a deployment; coupling them would make every mode file depend on what happens to be
  installed, which is the portability the mode format exists to keep.
- **R6** The rule has a detector in **both directions**, asserted behaviourally rather than as an inventory:
  declared-and-registered runs; declared-and-unregistered is refused by the registration check;
  registered-and-undeclared is refused by the capability scope. **Deliberately not a static rule over the shipped
  modes** - see *Not a rule* below.

## Not a rule, deliberately

**"Every capability a mode declares must be registered" is not asserted over shipped modes, and must not be.**
`modes/trading` declares `market.read` and `order.submit`, and nothing ships either; that is the mode stating what its
*deployment* must provide (`MODE.md`'s `compatibility` line says exactly that: "Requires ... a venue that honours
client order ids"). A static assertion would either fail on arrival or force the mode to stop declaring the
capabilities it exists to grant. The mismatch is a deployment fact, so it is decided at the boundary where the
deployment is known - which is R1, not a load rule.

## Falsified premise, found during implementation 2026-09-27

The plan assumed the mismatch was trading-specific and that code-audit's capabilities were registered. Neither holds:

| mode | declares | registered |
|---|---|---|
| code-audit | `repo.read`, `report.write`, `code-audit.seed`, `code-audit.disposition`, `code-audit.diff` | only the three `code-audit.*` |
| pentest | `net.scan`, `exploit.run` | none |
| trading | `market.read`, `order.submit` | none |

**Six of the nine declared capabilities have no implementation** (grepped 2026-09-27). `authority.capabilities` is a
grant list, not a mirror of the registry, so a mode naming an unimplemented action is stating what its *deployment*
must provide - which is why the check is right, and why its blast radius is this wide.

**What it invalidated.** Five host cases in `tests/host-work-mode.test.ts` demonstrated a mode control by invoking a
capability nothing implements, so the check refuses them before the control is reached: code-audit's permission lists,
the `ask_before` confirmation, the no-dialog refusal, the conformance refusal, and the effect claim. All five now run
against a **fixture mode over a registered capability** (`writeFixtureMode` / `writeFixtureEngagement`), which is what
makes them evidence about a control rather than about a call that would have thrown.

**One more declaration is dead, and it is the one the sibling task fixed.** `modes/code-audit/permissions.yaml`'s
`always_allow: [repo.read]` and `ask_before: [report.write]` name actions that cannot be invoked: no capability is
registered under either name, and a raw host tool's action is the tool's own name (`read`, `write`). Changing `read_*`
to `repo.read` replaced one dead value with another, because the earlier fix matched the mode's declaration instead of
the registry. **Recorded, not fixed**: what code-audit's permission list should say is a decision about that vertical.

## Acceptance Criteria

- [x] **AC1** Through the host: under `modes/trading`, `agent_run_capability {name: "order.submit"}` is blocked, the
      reason names `order.submit` and says nothing registers it, the operator is **not** prompted, and **no effect
      claim file is created**.
- [x] **AC2** The same for `market.read` - the rule is generic, not a trading special case.
- [x] **AC3 - amended 2026-09-27, because the original was not achievable.** It said "a declared-and-registered
      capability still runs (code-audit's `repo.read`)". **`repo.read` is registered nowhere** - the mode declares it
      and nothing implements it - so it is refused, correctly, by this check. What AC3 now asserts: a
      declared-and-registered capability runs (a fixture mode over `workspace.inspect`), and a capability the mode
      does **not** declare is refused with the scope reason, so AC1's reason cannot be confused with AC3's. The
      original claim was derived from the mode's own declaration rather than from the registry, which is the same
      mistake that made `always_allow: [read_*]` look live.
- [x] **AC4** A capability on the mode's `never_allow` is refused with the denial reason, before the registration
      check can speak.
- [x] **AC5** A mode naming a capability nothing registers still loads (R5), asserted through the host on the shipped
      mode: `trading` loads and announces itself, and the refusal comes at the action rather than at startup.
- [x] **AC6** Verified by removing each check by hand and watching the right case fail: without the registration
      check, three cases fail (the policy-level one and both host-level ones); without the scope check, the `[scope]`
      assertion fails. Recorded in `implement.md`, because the suite cannot test its own sensitivity.
- [x] **AC7** The registration check is the **third** check in `ActionPolicy.gates` order and not the first: a
      `never_allow` action reports the denial (AC4) and an undeclared capability reports the scope (AC3), because
      otherwise a deployment problem would be reported as a policy decision.
- [x] **AC8** `npm run typecheck` is clean and `npm test` is green.

## Key decisions (no user-owned question remains; these are mine and are overridable)

1. **The refusal point is the boundary, not the loader.** Decided by the ordering the policy already documents: the
   prompt is last, so a check placed before it never spends the operator's attention, and the effect claim is taken at
   the dispatch line, so a check before it leaves no claim behind.
2. **The check is the third one in the order, after the scope.** For an action that is neither declared nor
   registered, the policy fact (this mode never granted it) is the more useful refusal, and it is true regardless of
   what is installed.
3. **No load-time refusal.** A mode file is a portable document and the capability registry is a deployment; coupling
   them would make every mode file depend on what happens to be installed.
4. **No static "every declared capability must be registered" assertion over shipped modes** - see *Not a rule*.
5. **`registeredCapabilities` is required on `ActionPolicyOptions`, with no default.** Neither default is safe: `[]`
   refuses honest callers, omission allows every missing capability.

## Out of scope

- **Building any missing capability.** That was `09-27-trading-submission-capability`, dropped 2026-09-27 as
  unnecessary; this task makes its absence honest rather than filling it.
- Refusing at load time (R5), and any change to how capabilities are registered.
- Raw host tools. The rule is about `authority.capabilities`, which is a mode's grant list; which tools the host
  offers is the host's business and is already governed by the permission lists.
- `toClientOrderId`'s lack of a runtime caller. Recorded in the dropped task's PRD; if the capability is never built,
  the honest alternatives are to delete the export or to mark it as an API awaiting a caller.

## Notes

- Lightweight task: `prd.md` plus an ordered `implement.md`. The change is a boundary check plus a test home.
- Found while evaluating the necessity of `09-27-trading-submission-capability`; it is the part of that investigation
  that was worth keeping.
- Sibling: `09-27-mode-gate-no-gate` (a declaration that reads as a control and is not one). Same defect class, a
  different field, no shared code.
