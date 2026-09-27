# Fixtures are built from the writer types, not from memory

## Goal

Make a hand-written ledger fixture carry a kind the ledger actually declares, by typing it as `ExecutionRecordKind` - because a
probe of mine invented a kind, and the conclusion it produced was about the fixture rather than about the code.

## Background: the correction, and the mistake behind it

**A previous round recorded that no reading reads the resource record.** That was wrong, and it was wrong because of how it was
measured. The probe wrote

```text
kind: "task.resource.observed"    <- invented
```

while the appender writes `task.convergence.observed` (`execution-ledger.ts:398`), which the failure reading reads
(`failure-reading.ts:252`) into its `resources` field, and the ledger itself reads for repair (`execution-ledger.ts:64`). One
writer, two readers: **the record was read all along, and my fixture asked about a kind nothing defines.**

**The shape of the mistake is the point.** A hand-written literal is not checked against the union that owns it, so a fixture can
describe a record the harness cannot produce and still run - and every reading will be silent about it, correctly, because an
unknown kind is ignored by design. **A test can make the same mistake**: `tests/harness-readings.test.ts` builds ledger lines with
hand-written kinds, and a typo there would make a test pass against a record nothing reads.

## Requirements

- **R1 - Fixture writers take the kind union.** The helper that builds a ledger line in the readings suite types `kind` as
  `ExecutionRecordKind`, so an invented kind is a compile error rather than a silent no-op.
- **R2 - Every hand-written kind in the suite is checked** the same way, wherever a ledger line is built.
- **R3 - Whatever the typing reveals is fixed or reported**, because the point of typing it is to find out whether the suite has
  been asserting against records nothing reads.
- **R4 - The correction is recorded where the wrong claim is**: the task of the previous round and the contract, so a reader
  following it is not misled about who reads the resource record.
- **R5 - The method lesson is written down**, in the guide a person follows: build a fixture from the writer type, and do not
  invent a record kind.

## Acceptance Criteria

- [ ] **AC1** The readings suite helper types `kind` as `ExecutionRecordKind`, and the suite still passes.
- [ ] **AC2** Every other place in the suite that hand-writes a ledger kind is typed the same way, or the round says why not.
- [ ] **AC3** The previous round task records the correction, and the contract states who reads the resource record.
- [ ] **AC4** The guide states the method lesson.
- [ ] **AC5** The gate passes: typecheck, the suite, the installer tests, doctor and the spec budget test.

## Out of scope

- **Renaming `task.convergence.observed`.** It names a resource observation and reads oddly, but renaming a recorded kind is a
  migration, and the round has no evidence that the name costs anything.
- **Refusing an unknown kind at read time.** The ledger additive-kinds rule says readers ignore what they do not know, and that
  rule is what makes an additive record safe.
