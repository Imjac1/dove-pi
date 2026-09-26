# Refuse A Mode Whose Gate Declares No Gate

## Goal

A mode's `gate.semantics` must not be able to declare a control that cannot exist. Today a mode can write
`semantics: limit` and declare no thresholds, and it loads as if it were bounded by thresholds. The mode file then
reads as a control while the run has none — the defect class the harness task spent its budget removing, still live
in the mode vocabulary itself.

## Background

`modes/code-audit/governance.yaml:23` declares `semantics: limit` and no `gate.limits`. That was a deliberate choice
on 2026-09-26: the mode had declared `conformance` with a bare-name grant, which made it **refuse to load at all**,
and `limit` was the way out the loader's own refusal message offered ("declare gate.semantics: limit if this mode has
no external grantor"). The escape hatch works, but it leaves the mode declaring a threshold semantics with no
thresholds: an internal review has no third-party grantor, and it also has no pre-trade limits.

## Confirmed facts (repository inspection, 2026-09-27)

- `src/core/work-mode.ts:112` — `GATE_SEMANTICS = new Set(["limit", "conformance", "both"])`; `:352` refuses any
  other value by name. There is no value meaning "no gate".
- `src/core/work-mode.ts:548,555` — the conformance rule **is** a load refusal, and its message offers
  `gate.semantics: limit` as the alternative for a mode with no external grantor. So the vocabulary's escape hatch
  for "no contract" is `limit`, which also means "thresholds".
- `src/core/action-policy.ts` — `const limitGate = mode.limits.length > 0 ? createLimitGate(mode.limits) : undefined`.
  Zero limits therefore means no threshold check, and `gates` collapses to `["deny", "scope", "ask"]`.
- `src/core/gate-limit.ts:74-78` — the analogous rule **one level down** already exists and is a hard error: a limit
  declaring neither `max` nor `min` throws `LimitSpecError`, "since it can never decide anything". The same argument
  applies one level up and has no rule.
- Shipped modes: `modes/code-audit` = `limit` with **zero** limits (the live vacuous case);
  `modes/trading` = `limit` with `notional` + `quantity` (the case that must keep loading);
  `modes/pentest` = `conformance` with a resolvable document (unaffected). **No shipped mode uses `both`.**
- `modes/code-audit/MODE.md` and `governance.yaml` both already state, in prose, that no thresholds are declared
  and that containment comes from the permission list and the scope block. The prose is honest; the field is not.

## Requirements

- **R1** `gate.semantics` gains `none`, meaning "this mode declares no gate". The vocabulary becomes
  `none | limit | conformance | both`, and an unrecognised value is still refused by name - now listing four.
- **R2** A mode declaring `limit` (or `both`) and no `gate.limits` does not load. The refusal names the field and both
  ways out: declare the limits, or declare `none`.
- **R3** A mode declaring `none` and any `gate.limits` does not load: declaring no gate while declaring thresholds
  is a contradiction, and the thresholds would never be consulted.
- **R4** A mode declaring `none` loads **without resolving `authority.grant`**. The loader's early return is hardcoded
  to `limit` (`src/core/work-mode.ts:542`), so a value that does not extend it falls through to the conformance path
  and is refused with a message about conformance - the value would look implemented and not be.
- **R5** `modes/code-audit/governance.yaml` declares `none`, and its governance version moves because the declaration
  is part of what the mode authorizes.
- **R6** A `both` mode satisfies both halves: a resolvable document **and** at least one limit.
- **R7** Every refusal that offers a way out names both: the conformance refusals (`src/core/work-mode.ts:548,555`)
  currently offer only `limit`, and must also offer `none`, because "no external grantor" and "no gate at all" are
  different modes.
- **R8** The three shipped modes still load or refuse exactly as their declarations say, asserted by test.

## Acceptance Criteria

- [ ] **AC1** A mode declaring `limit` (or `both`) with no `gate.limits` does not load, and the refusal names the
      field and both ways out. Observed through the loader and, for the operator-visible case, through the host.
- [ ] **AC2** A mode declaring `none` loads, and its action policy builds neither a threshold gate nor a conformance
      gate — asserted on `ActionPolicy.gates`, which is the list a reader uses to see the policy instead of inferring
      it.
- [ ] **AC3** A mode declaring `none` **and** limits does not load, and the refusal names the contradiction.
- [ ] **AC4** `modes/code-audit` loads through the host with `none`, and its permission lists decide what runs (the
      case `tests/host-work-mode.test.ts` already asserts, unchanged in substance).
- [ ] **AC5** `modes/trading` still loads with its two limits, and an over-limit order is still refused by the
      `limit` gate.
- [ ] **AC6** `modes/pentest` is unchanged: conformance with a resolvable document loads, and a grant that is not a
      document is still refused.
- [ ] **AC7** The conformance refusal offers `none` as well as `limit`, so an author whose mode has neither a grantor
      nor thresholds is not sent to a value that does not fit.
- [ ] **AC8** `npm run typecheck` is clean and `npm test` is green.

## Key decision (user, 2026-09-27)

**`gate.semantics` gains `none`, and the vocabulary is `none | limit | conformance | both`.** A mode declaring
`limit` or `both` with zero limits refuses to load; a mode declaring `none` with limits refuses to load; code-audit
declares `none`. Chosen over two alternatives: a load *warning* instead of a refusal (a warning is not enforcement,
and the field would still read as a control), and making `gate.semantics` optional so that its absence means no gate
(an absent required field cannot be told from a typo, which is what the loader's "a missing field is refused, never
ignored" rule exists to prevent).

**Accepted cost:** `none` is a new value in a portable contract, so a mode declaring it is refused by a framework
that predates it - guarded by the `framework` range check the loader already performs. And any mode anywhere that
writes `limit` with no limits stops loading; among the shipped modes that is only `modes/code-audit`, corrected in the
same change.

**Not a rule, deliberately:** `none` alongside a resolvable `authority.grant` document is allowed. The mode has said
it has no gate, so the document is not being claimed as a control, and refusing it would be a rule with no defect
behind it.

## Out of scope

- Giving `modes/code-audit` thresholds it does not need, in order to satisfy a rule. Inventing a limit to make a
  declaration true is the same defect pointing the other way.
- Any change to how limits themselves are declared or evaluated (`src/core/gate-limit.ts`), beyond the existing rule.
- The conformance side of the vocabulary, which already refuses a mode it cannot check.

## Notes

- Lightweight task: `prd.md` plus an ordered `implement.md`. The change is small and the risk is a mode file that
  stops loading, which is why AC5 pins the untouched mode.
- Follows `09-26-dove-agent-harness-capabilities`, which recorded this as a known, deliberately-unfixed gap.
