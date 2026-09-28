# The fallback, and whether it can be observed

## Goal

Re-examine whether the executable fallback can be checked, rather than accepting an earlier conclusion.

## Background: a conclusion from two rounds ago, and a field it may have missed

The shell module has five behaviours and four are now asserted: the exit code, stderr, the timeout and cancellation. **The fifth is the
fallback** - `pwsh` first, then `powershell` - and a previous round concluded it is *not checkable from outside* because the candidate list is
private and depends on `process.platform`.

**But `PowerShellResult` carries an `executable` field**, so which one ran is observable from a test. **That does not make the fallback
checkable** - forcing the second candidate would need the first to be missing - **but it does make the earlier conclusion worth re-testing**
rather than quoting.

## Requirements

- **R1 - Measure which executable runs here**, from the result field rather than from the source.
- **R2 - Check whether both candidates exist on this machine**, and say what that means for the fallback.
- **R3 - Say whether the fallback can be checked deterministically**, and if not, why not - in terms of what a test could stage.
- **R4 - Add a case that holds whatever *is* observable**, if that is more than a restatement.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** The executable actually used is recorded.
- [x] **AC2** Both candidates existence is checked on this machine.
- [x] **AC3** The determinism question is answered in terms of what a test could stage.
- [x] **AC4** A case is added only if it holds more than a restatement.
- [x] **AC5** The gate passes.

## Out of scope

- **A conditional check that only runs on machines without pwsh.**
- **Changing the module.**
- **The first real turn**, which needs a Pi host.