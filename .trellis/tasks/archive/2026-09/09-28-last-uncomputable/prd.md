# The last uncomputable entry contradicts a test that already exists

## Goal

Correct the reason on the one axis still declared unreadable, because the reason is false and a test in this repository proves it.

## Background: the measurement

The entry reads:

```text
axis:      Safety & Stability (SSM)
metric:    Pareto preservation
reason:    it is a multi-objective property and no second objective is recorded, so there is nothing to preserve against.
evidence:  no ledger record carries a second measured objective; the fields a request terminal does carry are its reason and its
           terminal envelope.
wouldNeed: a second objective the harness measures per round, and a decision about what its frontier is.
```

**And the same module reports two objectives**:

| Field | Line | What it is |
|---|---|---|
| `crashFreeRatio` | `harness-axes.ts:88` | stability: clean over decided endings |
| `isolationRefusalsPerRequest` | `harness-axes.ts:95` | safety: sandbox and fence refusals per request |

Both are computed from the same records - `request.terminal` and `gate.refused` - and every record carries a `requestId`, so both are
derivable per round as well as in aggregate. **`tests/harness-axes.test.ts` already asserts both numbers**, which means the entry is
contradicted by a test that passes.

## What is actually missing

**Not a measurement, and not a per-round reading - a frontier.** Preservation asks whether a run that is stable but hits isolation
refusals is better or worse than one that is safe but crashes, and that is a value judgment. The module own rule about thresholds says
exactly this: a threshold "needs a decision about what a good rate is, and that decision belongs to whoever makes it, with its own
evidence".

## Requirements

- **R1 - The reason and the evidence say what is true**: the two objectives are reported by this module, and both are derivable per
  request; what the axis lacks is a frontier.
- **R2 - The entry stays in the list**, because preservation genuinely cannot be read without a frontier - what changes is why.
- **R3 - The list keeps one entry and says what it is for**: an axis nobody can read is declared rather than approximated, and this one
  is declared for a decision rather than for a missing measurement.
- **R4 - A test ties the two together**: the assertion that the module reports both objectives sits beside the assertion about the
  entry, so the next person editing either sees the other.
- **R5 - The gate passes**: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The entry no longer claims that no second objective is recorded.
- [ ] **AC2** It names the two fields this module reports, and says that the frontier is the missing piece.
- [ ] **AC3** The axes test asserts the two objectives and the entry in one place, with the reason they belong together.
- [ ] **AC4** The list holds exactly one entry.
- [ ] **AC5** The gate passes.

## Out of scope

- **Drawing a frontier**, which is the decision this round identifies rather than makes.
- **A per-round pair reading**, which is derivable and not asked for by anything yet.
- **The first real turn**, which needs a Pi host.
