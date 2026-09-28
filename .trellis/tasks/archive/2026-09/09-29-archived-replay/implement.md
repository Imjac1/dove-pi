# Implementation plan: the isolated replay

## Ordered checklist

- [x] **1. Read the harness and its parameters.**
- [x] **2. Find the isolation house pattern.**
- [ ] **3. Find the ledger path the driver writes.**
- [ ] **4. Write the replay and its scenario file.**
- [ ] **5. The gate.**

## Validation commands

```powershell
npm run typecheck
npm test
```

## Next round, precisely

```text
grep the driver for where the ledger is written - it is under the scenario root, which carries a nonce
write tests/archived-scenario-replay.test.ts, modelled on the existing --scenario cases
  the scenario mirrors the four defects the audit proved: duplicate agent_* registration, a project-local
  personal-agent.ts suppressing managed Dove, one prompt persisted six times, and 63 ls calls including
  fourteen identical in one message
assert the run summary shows no duplicate registration, no repeated persistence and no duplicate tool calls
  - the last two from summarizeExecutionRecords, which is why this seam matters
```

## Recorded, not built

**The child remaining items**: the isolated replay (this one), validating repeated maintenance explanations,
and the full Node/installer/doctor/pi-smoke/diff check.
