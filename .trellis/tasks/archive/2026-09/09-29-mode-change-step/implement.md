# Implementation plan: the step that survives a mode change

## Ordered checklist

- [x] **1. mode-controller.ts, read first.**
- [x] **2. The mode-change item.**
- [x] **3. The two shell halves, with controls.**
- [x] **4. The gate.**

## The mode-change item was already held, in one case, verbatim

```text
mode-controller.ts:3-8   ModeChange carries previous, current, effectiveFromStep and changedAt
core.test.ts:33          it("applies a change at the next step boundary")
             :35         const runningStepMode = controller.snapshot();     <- captured before the change
             :36         const change = controller.change("ultra", "step-02");
             :37         assert.equal(runningStepMode, "standard");         <- the snapshot was not lost
             :38         assert.equal(change.effectiveFromStep, "step-02"); <- the change affects the next step
             :39         assert.equal(controller.snapshot(), "ultra");      <- and the current one moved
```

**Both halves of the item, in three assertions, under a case name that is the second half.** No holder was needed; the round read the file
and found it.

## The stderr half got a case, and the control flips the field rather than the value

**The case runs a script that writes to stderr and exits 3**: it asserts the exit code is the process own, that stderr carries the complaint,
and that stdout does **not** - so the two are not merged. **The planted control moves the assertion from stderr to stdout and fails**, which is
the item own point rather than a value check.

## The fallback half is not checkable from outside, and that is the finding

**`executableCandidates()` is private and its choice depends on `process.platform`.** A test cannot stage a host where `pwsh` is missing
without mocking the module, so the honest entry is *not checkable from outside* rather than a case that would prove nothing - the distinction
the mode-format round drew.

## Validation commands

```powershell
npm test
```

## Recorded, not built

1. **The Pi registration item.**
2. **The first real turn.**