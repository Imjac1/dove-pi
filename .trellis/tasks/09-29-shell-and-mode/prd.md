# The shell boundary and the mode change

## Goal

Hold three of the seven unheld items in the first request-runtime list.

## Background: a list of eight, one held, and three concrete enough for a round

The first request-runtime list has eight items. One is held - the provider-limit numbers. **Three of the rest are concrete**: the PowerShell
boundary (exit code, stderr, timeout, cancellation, fallback), a mode change preserving the running-step snapshot and affecting the next step,
and native state absence not preventing runtime initialization or tool execution.

**Method, in the order nine word-search failures taught**: ask the file list, then a vocabulary or an export list, and only then the tests by
name.

## Requirements

- **R1 - Ask the file list first**, and name the candidate owners before reading them.
- **R2 - Hold the shell boundary item**, naming which of its five behaviours the holder covers.
- **R3 - Hold the mode-change item**, and read what *running-step snapshot* means in the code.
- **R4 - Hold or name the native-absence item.**
- **R5 - Name the four items not checked**, rather than implying the list is done.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [x] **AC1** Candidate owners are named before their contents are read.
- [x] **AC2** The three items are held or named, with what was searched.
- [x] **AC3** The four unchecked items are named as unchecked.
- [x] **AC4** The gate passes.

## Out of scope

- **The other four items of that list**, which stay named.
- **Changing any behaviour.**
- **The first real turn**, which needs a Pi host.