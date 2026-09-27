# Design: the behaviours a fix must not regress

## The declaration

```yaml
verifiedBy:
  middleware: [tests/host-work-mode.test.ts, tests/action-policy.test.ts]
  tool-implementation: [tests/harness-corpus.test.ts, tests/harness-round.test.ts, tests/failure-reading.test.ts]
```

A second mapping in the same file, with the same discipline: a key must be a **declared component**, and a path must
**resolve** - a list of suites that do not exist verifies nothing, which is the same defect as a component whose paths are
not real. A component with no entry is allowed and means what it says: **nobody has stated what verifies it**, which is a
fact about our knowledge rather than an omission to fill with something plausible.

## The record

```typescript
readonly preserve: readonly string[];
```

The suites of the component the evidence points at, supplied by the caller as an option - `core` stays pure, and the
script pairs the declaration with the reading the way it already pairs client accounts.

**Empty when the attribution is `unattributed`.** The evidence then names no component, and a list derived from nothing
would be an invention dressed as a requirement. The record already carries `componentEvidence` saying why, so the empty
list has an explanation beside it.

## Why this is the second field Self-Harness asks for, and what it is not

Self-Harness: a failure record must carry "a record of the **passing behaviours to preserve** that a proposal must not
regress". Two things this deliberately is not:

- **It is not a test run.** It names what must stay true; running it is a person or a round, and a record that ran the
  suites would be a process rather than evidence;
- **it is not derived from the fix.** The record is written before the fix exists, so the only honest source is what the
  failure points at - and where that points nowhere, the list is empty.

## Verification and rollback

- **Unit**: the map loads with the second mapping and refuses an undeclared key and an unresolvable path; a failure
  pointing at a component with suites carries them; an `unattributed` failure carries an empty list.
- **Live**: both readings print the list for the real failure - which is `unattributed`, so the empty case is the one the
  corpus actually shows, and that is worth seeing.
- **Rollback** removes the field and the mapping; the surface declaration keeps working because the new mapping is
  optional.
