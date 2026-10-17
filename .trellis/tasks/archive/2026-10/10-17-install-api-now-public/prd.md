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

## The decision (2026-10-17): keep the hand-rolled path, and say why

Measured in the order the decision needed it, from `pi-coding-agent/dist/core/package-manager.js` at 1.0.0:

1. **What the public path is.** `installAndPersist(source, options)` is `await this.install(source, options)` followed by
   `this.addSourceToSettings(source, options)`. So it **does** persist settings, and it reports progress through the
   callback.
2. **It has no serialization primitive.** Searching the manager for `mutex | lock | queue | serial | inFlight | pending`
   returns **one** match, and it is a comment about stale auto-installed peers. Nothing serializes concurrent installs.
3. **It has no already-installed check.** `installNpm` computes the install root and runs
   `runNpmCommand(this.getNpmInstallArgs([source.spec], installRoot))` unconditionally.
4. **This installer has both.** `src/extensions/install.ts` loops the profile, **skips** what `configuredPackages`
   already holds, reports `current` / `total` per package, and sequences its own writes.

**Decision: keep the hand-rolled path**, for three measured reasons, with **no behaviour change in this task**:

- adopting would **reinstall every already-configured package on every pass**, because the public path has no skip;
- the public path takes **one source per call**, so a profile becomes one npm invocation per source on a shared root;
- its progress events carry an action and a source but **no counters**, while this loop reports current/total.

**What would change the decision.** A public path that skipped an installed source and reported counters would make this
a straight comparison. Nothing measured this round shows that, and rewriting a tested installer on the strength of an
interface declaration is the premise error this repository keeps finding - so the reason is now recorded where the
comment is, and the comment says it is a choice rather than a workaround.

## Acceptance Criteria

- [x] **AC-1** Each question is answered by measurement: **concurrency** - no lock or queue in the manager (one match,
      a comment); **an already-installed source** - `installNpm` runs `npm install` unconditionally; **settings** - it does
      persist them, `installAndPersist` composes `addSourceToSettings`. Nothing was left unverified.
- [x] **AC-2** The decision is recorded with the measurement behind it: **keep the hand-rolled path**, with three
      measured reasons, above.
- [x] **AC-3** Not adopted, so no concurrency case is owed - and that is stated rather than skipped, because it was the
      condition under which a case would have been required.
- [x] **AC-4** Not adopted, and the comment now carries the three measured reasons instead of "a missing API". Gates:
      `npm run typecheck` exit 0, `npm test` **1001 pass / 0 fail**, `npm run test:installer` OK, the task-artifact corpus
      at 0 problems, and both citation doors green - **no citation moved**, because the edit replaced fifteen comment
      lines with fifteen.

## Out of Scope

- The extension catalog's contents.
- Changing which host version this repository pins to.
- Any change to how a source is uninstalled.
