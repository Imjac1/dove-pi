# Installer Reliability and Recovery

## Goal

Make the Windows Dove Pi installer recoverable in realistic failure conditions
without asking users to understand managed-release internals. An interrupted,
corrupt, concurrent, or partially migrated installation must either keep a
runnable release or provide one deterministic repair action.

## User Value

- Re-running install or update must not destroy the last known-good release.
- A changed Python installation, stale cache, proxy, or interrupted download
  must be repairable without manually editing state files.
- The normal path remains one release-backed command with no permission system,
  Trellis runtime dependency, or new approval ceremony.

## Evidence

- Existing installer suite passes 92 tests, but does not cover corrupt state
  followed by prune or same-tag asset replacement.
- `installer/state.py:97-109` converts unreadable or incompatible state into an
  empty state. An isolated reproduction showed `oldReleasePreserved=false`
  after prune was called with the resulting empty state.
- `installer/manager.py:360-391` keys the cache by tag and version only. An
  isolated replacement test produced metadata mismatch with zero redownload
  attempts.
- `installer/manager.py:304-330` releases the repair lock before its stable
  update fallback.
- `installer/manager.py:158-199` writes the installation-time Python path into
  the long-lived launcher.
- `install.ps1:332` and `install.ps1:366-367` have no explicit request timeout
  or environment-proxy forwarding.
- The real read-only check through `127.0.0.1:10808` reports current
  `0.1.6+f5df94e`, latest `v0.1.6`, and no available update.

## Requirements

### R1. Fail-closed state handling

- Distinguish a missing state file from malformed, unsupported, or structurally
  invalid state.
- Never treat a corrupt state file as a clean install for a mutating command.
- Do not activate, overwrite recovery metadata, or prune releases while the
  managed state is uncertain.
- Preserve enough state history for `repair` to recover automatically; if no
  history is available, inspect only validated managed release directories and
  report the selected recovery explicitly.

### R2. Identity-aware release cache

- A cache entry must identify the exact release tag, version, release ID,
  manifest identity, and archive checksum it contains.
- A valid old archive with a changed remote release identity must be discarded
  or bypassed and downloaded again into a temporary file before replacement.
- Offline repair must select a cache entry matching the requested release, not
  merely a matching version.
- Cache cleanup must retain current/previous recovery material and apply a
  bounded retention policy to older assets.

### R3. Atomic maintenance recovery

- `install`, `update`, `repair`, `rollback`, component reconciliation, launcher
  rewrite, state persistence, and prune must remain under one maintenance lock
  for one operation.
- Repair fallback to the stable release must not release and reacquire the lock.
- Any failure before activation leaves current and previous unchanged.
- Optional extension failure remains degraded state and must not roll back a
  verified application release.

### R4. Runtime-independent launcher recovery

- The managed launcher must resolve a usable Python runtime at invocation time,
  rather than requiring the exact executable path used during installation.
- Missing or unusable Python must produce the public bootstrap/repair action,
  not an opaque process-not-found error.
- `.cmd` and `.ps1` launch paths must work with the supported Windows PowerShell
  fallback behavior.

### R5. Deterministic bootstrap networking and archive validation

- Bootstrap requests have bounded timeouts and bounded redirect behavior.
- `HTTPS_PROXY`, `HTTP_PROXY`, and `ALL_PROXY` are honored when usable by the
  host PowerShell; an explicit proxy option may override environment discovery.
- Temporary downloads and extraction directories are cleaned up without
  masking the primary failure.
- Python and PowerShell extraction reject path escape, duplicate entry, and
  link-like archive entries before extraction.

### R6. Diagnostics and compatibility

- Human output identifies the failed stage and gives one next action.
- JSON maintenance commands still emit exactly one JSON document on stdout.
- Existing schema-2 installations, profiles, release URLs, flags, user Pi
  state, project state, and development checkouts remain compatible.
- No permission/authority gate, global Trellis update, or project data rewrite
  is added.

## Acceptance Criteria

- [x] A malformed, truncated, unsupported, or structurally invalid
      `install.json` causes update/install to stop without deleting or replacing
      any existing release; the error points to `dove-pi repair`.
- [x] `dove-pi repair` recovers from a state backup or validated release scan,
      keeps the last two usable release identities, and records the recovery.
- [x] A same tag/version cache entry with a changed release ID causes exactly
      one fresh download and succeeds when the new assets are valid.
- [x] Offline repair never selects a cache entry whose release identity differs
      from the damaged installation when an exact entry exists.
- [x] A concurrent maintenance process cannot enter between repair fallback,
      activation, reconciliation, launcher rewrite, state write, and prune.
- [x] A launcher generated under Python A still starts repair under compatible
      Python B after Python A is removed or moved.
- [x] Bootstrap requests honor the configured HTTP proxy, time out, and clean
      temporary files in success and failure simulations.
- [x] Malicious archive fixtures with traversal, duplicate, or link-like
      entries are rejected before managed activation.
- [x] Focused tests, full Node tests, installer tests, typecheck, doctor, Pi
      smoke, release readiness, and isolated real Release E2E all pass.

## Out of Scope

- Adding a permissions model, tool allow-list, or mandatory approval step.
- Changing Pi tool authority, request routing, cache policy, or Trellis/Dove
  workflow semantics outside installer integration.
- Updating global Pi extensions, Python, Node.js, fonts, project `.dove`, or
  legacy `.trellis` data during application repair.
- Replacing GitHub Releases or adding a mutable branch update fallback.
- Supporting non-Windows managed installation in this task.

## Open Questions

None blocking for planning. The implementation should prefer the smallest
backward-compatible state migration and keep recovery evidence local.
