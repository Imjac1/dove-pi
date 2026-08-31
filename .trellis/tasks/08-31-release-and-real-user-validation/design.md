# Technical Design: Release and Real-User Validation

## Change Boundary

The smallest product gap is a mismatch between the source checkout, the managed global release, and the CLI's two documented forms of the `--since` option. The fix belongs at the CLI argument boundary, while release identity belongs to the existing managed installer and GitHub tag workflow. Real-user evidence belongs in an isolated external test project and session directory.

Expected product files:

- `src/cli.ts`: normalize `--since` values through one parser and reject malformed values.
- `tests/token-audit-cli.test.ts` or the nearest existing CLI test owner: verify both option forms and failure behavior.
- `package.json` / lock metadata: bump the patch release only if required by the existing release workflow.
- Release metadata and task artifacts: generated or updated only as part of the release workflow; no checked-in generated archive.

The test harness may create files below a temporary directory, but must not write into the repository or any unrelated Trellis task.

## Data Flow

```text
argv (--since=24h | --since 24h)
  -> shared CLI value parser
  -> runTokenAudit({ sinceHours })
  -> filtered project rows + aggregate
  -> formatted output

HEAD + version tag
  -> release workflow
  -> manifest/archive/checksum/bootstrap
  -> managed installer update
  -> global doctor/version/audit checks

global launcher + isolated project/session
  -> real provider request
  -> Pi session JSONL
  -> usage/tool/stop metrics
  -> reproducible regression report
```

## Contracts

- CLI parser returns a finite non-negative hour value or a user-visible error.
- The parser must not interpret a missing option value as `undefined`.
- Release manifest commit, archive embedded manifest, and installed release identity are exact-match checks.
- Real-model tests are evidence only when the process reaches the provider and records assistant usage; startup/auth failures are reported separately.
- Read-only scenario acceptance is based on actual tool calls and filesystem diff, not only the model's final statement.

## Release and Rollback

- Create the release tag only after local quality gates and release readiness checks pass.
- Let the existing workflow build and publish the immutable assets.
- Update through `dove-pi update`; preserve the prior managed release for rollback.
- If install or global regression fails, retain the previous release and use the existing repair/rollback path. Do not overwrite the managed state manually.

## Compatibility

- Preserve `--since` semantics and existing `--since=Nh` documentation.
- Keep current token aggregation and cache-hit definitions unchanged.
- Keep Pi and Trellis dependency versions locked unless the release workflow rejects the current manifest.
