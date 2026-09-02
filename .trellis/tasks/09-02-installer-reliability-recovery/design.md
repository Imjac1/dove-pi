# Technical Design: Installer Reliability and Recovery

## Change Boundary

Expected implementation surfaces:

- `installer/state.py`: strict state parsing, backup/recovery metadata, and
  schema-compatible migration behavior.
- `installer/manager.py`: cache identity, bounded cache retention, repair/update
  transaction sharing, launcher runtime selection, and diagnostics.
- `installer/transaction.py`: safe recovery/prune boundaries and archive
  preparation invariants.
- `installer/release.py`: exact cache asset validation and complete ZIP entry
  validation.
- `install.ps1`: proxy/timeout/redirect handling, cleanup, and launcher bootstrap
  compatibility.
- `dove_pi.py`: only the command-boundary diagnostics needed to expose recovery
  errors consistently.
- `tests/*installer*_test.py`, bootstrap fixtures, and isolated E2E coverage.
- README/spec documents only where behavior or recovery instructions change.

Explicitly untouched: request middleware, capability/tool authority, project
state, extension catalog semantics, and user-owned Trellis data.

## State Model

Keep schema 2 readable. Add a small internal read result that distinguishes:

1. `missing`: first install may create an empty state;
2. `valid`: use the parsed state;
3. `corrupt`: preserve the file and stop normal mutation;
4. `recoverable`: repair may use a verified backup or directory scan.

Every atomic state replacement writes a temporary file, flushes it, replaces
the primary state, and retains one bounded backup containing the previous valid
state. A corrupt primary is never overwritten as part of ordinary update.

`repair` recovery order is: valid primary, valid backup, then validated release
directories ordered by durable metadata. A directory becomes a candidate only
after manifest identity, required files, and locked component versions pass
verification. Recovery writes a new state only after the candidate set is
known. If the scan is ambiguous, repair fails with the candidate list rather
than guessing.

## Cache Model

Cache descriptors become the source of truth for reuse. The cache directory key
must include a stable hash of release ID plus version/tag, and `asset.json` must
contain the release identity, manifest digest, archive checksum, and schema.

Download flow:

1. Read the exact requested descriptor and verify the archive checksum.
2. Extract and compare the embedded manifest to the requested manifest.
3. If either identity check fails, quarantine/delete only that cache entry and
   download to a new `.part` path.
4. Verify checksum and manifest again, then atomically publish the cache entry.

`_cached_asset` accepts the expected release identity when known and ignores
ambiguous entries. Retention runs after successful activation and never removes
current/previous release assets or the newest recovery candidate.

## Transaction Boundary

Factor the mutating update body into a private `_update_locked(asset, state,
...)`. Public update acquires the lock and calls it. Repair keeps its existing
lock while trying current, previous, cache, and stable fallback; stable
metadata fetch may occur under this lock only after local candidates fail.

Activation remains the only point that changes current/previous. Reconciliation,
launcher rewrite, final state write, and prune stay after activation and before
unlock. A component failure updates the degraded ledger under the same lock.

## Launcher and Runtime

The generated PowerShell launcher resolves `python` and then `py -3` at run
time, verifies that the command can execute, and reports the public bootstrap
URL when neither is usable. It continues to validate the release path below
`app\\versions` before execution. The `.cmd` wrapper selects the available
PowerShell host rather than assuming only `powershell.exe`.

The installer may still use the freshly resolved Python executable for the
initial packaged install, but the generated launcher does not persist that
absolute path as its only runtime option.

## Bootstrap Network and Archive

Add one testable request helper in `install.ps1` that applies a fixed timeout,
maximum redirects, and a sanitized proxy URI from an explicit parameter or the
standard proxy environment variables. It passes proxy credentials only to the
request object and never prints them. All release requests use the helper.

Both archive implementations normalize entry names, reject duplicates and
link-like attributes, validate the managed root, then extract. Release
readiness remains an upstream gate; installer validation remains defense in
depth and is tested independently.

## Compatibility and Rollback

- Existing `install.json` schema 2 parses unchanged.
- Missing backups are valid for old installations; repair falls back to
  verified directory recovery or reports that a fresh install is required.
- Existing cache entries are accepted only after descriptor/manifest validation;
  invalid entries are disposable.
- No migration touches Pi credentials, sessions, settings, extensions, project
  directories, or global runtimes.
- If any new recovery step fails, current state and current release remain
  unchanged; the previous implementation can be restored without changing the
  release format.

## Failure and Diagnostic Contract

Errors carry a stage (`state`, `cache`, `release`, `dependencies`, `verify`,
`activate`, or `launcher`) and one recovery action. JSON output keeps one
document on stdout; detailed subprocess and cleanup diagnostics go to stderr or
the bounded maintenance log.

## Deferred Risks

- A disk-full event during state backup or cache publication may prevent a
  repair even though current files remain runnable; tests should verify that
  the error does not prune current.
- Windows file locks held by Pi/npm can still delay cleanup; bounded retries
  and a clear "close Pi/Node and retry" message are sufficient for this task.
