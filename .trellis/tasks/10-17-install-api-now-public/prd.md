# The host has a public persistent install API, and this installer still serializes its own writes

## Goal

`src/extensions/install.ts` keeps its writes to the shared Pi/npm root serialized and its progress bounded, and the
comment that justified that shape used to say the host had **no public persistent multi-source install API**. Measured
2026-10-17 against Pi 1.0: it does. `PackageManager` declares `installAndPersist`, `removeAndPersist`, `install`,
`remove`, `update`, `addSourceToSettings`, `removeSourceFromSettings` and `setProgressCallback` over
`install | remove | update | clone | pull` progress events (`pi-coding-agent/dist/core/package-manager.d.ts`). The
comment was corrected to say so, and this task owns the question that correction left open: **should the installer use
that path?**

## Background (measured 2026-10-17)

- **The declaration above**, read from the installed package rather than from the comment.
- **What is not measured, and is the whole of this task's risk**: whether the public path serializes concurrent writes
  to the shared root the way this code does; whether it persists settings in the shape this installer expects; and what
  it does with a source that is already installed. The old comment's other claims - a private npm batch helper,
  `resolveExtensionSources` being serial and not persisting - were about the version this code was written against and
  have **not** been re-measured either.
- **Nothing holds the question**: no file under `tests/` or `scripts/` names `installAndPersist`.

## Requirements

- **R1** The questions in Background are answered **by measurement** before any code changes: what the public path does
  with concurrent sources, with an already-installed source, and with settings.
- **R2** If it does what the hand-rolled path does, the installer adopts it and the hand-rolled serialization goes; if it
  does not, the reason is recorded where the comment is and this task closes with **no behaviour change**.
- **R3** The safety question is about concurrent installs, so any adoption carries a case that runs two installs at once
  rather than a case that runs one.

## Acceptance Criteria

- [ ] **AC-1** Each question in Background is answered with a measurement, or explicitly marked unverified.
- [ ] **AC-2** The decision - adopt, or keep the hand-rolled path - is recorded with the measurement behind it.
- [ ] **AC-3** If adopted: a case holds the concurrent case, and the gates are green.
- [ ] **AC-4** If not adopted: the comment states the measured reason, and the gates are green.

## Out of Scope

- The extension catalog's contents.
- Changing which host version this repository pins to.
- Any change to how a source is uninstalled.
