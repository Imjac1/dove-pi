# Dove Pi V2 托管安装与更新 — Implementation Plan

## Status

Planning complete; implementation must not start until the user explicitly approves the final planning summary presented after this document.

Implementation will be inline in the main task unless the user later explicitly requests sub-agent dispatch. `implement.jsonl`/`check.jsonl` are therefore not the execution gate for this run.

## Phase 0 — Lock current defects with tests

1. Add CLI-level regression tests for `--no-extensions` versus stored profile inheritance.
2. Add malformed manifest/schema tests.
3. Assert smoke launches exactly one Dove extension.
4. Add tests documenting current V1 launcher/manifest migration inputs.
5. Fix only the deterministic defects needed to make these tests green; do not add more V1 git branch logic.

Rollback point: this phase is independently shippable and preserves the existing installer model.

## Phase 1 — Managed state and transaction primitives

1. Introduce a small Python installer package under `installer/`:
   - `layout.py`: resolved/validated managed paths;
   - `state.py`: schema validation and atomic state writes;
   - `lock.py`: cross-process maintenance lock;
   - `release.py`: release manifest, download and SHA verification;
   - `transaction.py`: plan/stage/activate/prune orchestration;
   - `components.py`: bundled and external component reconciliation.
2. Keep `dove_pi.py` as the thin public command/launch compatibility boundary.
3. Add zip-slip prevention and checked path helpers before implementing cleanup.
4. Add local fixture releases so tests never modify the real `%LOCALAPPDATA%`, Pi settings or GitHub.

Validation:

```powershell
python -m unittest discover -s tests -p "installer*_test.py"
```

Rollback point: primitives are unused by the current launcher until Phase 3 activation.

## Phase 2 — Deterministic release and components

1. Add exact `@mindfoldhq/trellis` dependency and invoke its bundled CLI from the project provider.
2. Extend the extension catalog/build step to resolve exact package versions into `release.json` while keeping catalog metadata as the authoring source.
3. Replace broad `pi update --extensions` maintenance with targeted Pi official exact-spec install for Dove-managed identities.
4. Preserve non-Dove packages and Pi settings object metadata; add fixtures for mixed user/Dove packages.
5. Separate font, extensions and application stages; compute progress from a plan array.
6. Add release manifest validation against package-lock Pi/TUI/Trellis versions.

Validation:

```powershell
npm run typecheck
node --import tsx --test tests/extensions.test.ts
npm test
```

Risk checkpoint: confirm exact-spec replacement against the locked Pi version before changing real settings logic.

## Phase 3 — Bootstrap, launcher and commands

1. Add `install.ps1` with runtime checks, latest stable release resolution, asset/checksum download and safe temp cleanup.
2. Generate stable `.cmd`/`.ps1` launchers that resolve only validated managed state.
3. Implement `dove-pi update`, `update --check`, `repair`, `rollback` and `uninstall` on the shared planner/executor.
4. Add explicit `--json`; make human output the default and capture verbose child logs.
5. Remove `--force` from managed update; retain a clear compatibility error if old scripts pass it.
6. Ensure launch/doctor paths contain no updater/network import side effects.

Validation:

```powershell
python -m unittest discover -s tests -p "installer*_test.py"
npm run typecheck
npm test
npm run pi:smoke
```

Rollback point: do not replace the machine's real launcher during development; test against temporary managed roots.

## Phase 4 — V1 migration

1. Detect checkout-backed launchers and valid legacy profile manifests.
2. Install and directly smoke the managed release before switching launchers.
3. Prove the source checkout status/hash/branch are unchanged before and after migration.
4. Preserve the old launcher until the atomic activation step; inject failures before every step.
5. Make `python dove_pi.py install` delegate to managed install for compatibility.

Required migration fixture cases:

- current real layout shape;
- Unicode checkout and username paths;
- missing/corrupt legacy manifest;
- dirty checkout and local-ahead checkout;
- launcher missing or partially written;
- no Git installed.

## Phase 5 — Release automation and documentation

1. Add a Windows GitHub Actions release workflow triggered only by matching `v*` tags.
2. Build zip, `release.json`, checksum and release `install.ps1`; fail on version/lock/catalog drift.
3. Update README.md and README.en.md together:
   - one-line install and inspect-before-run alternative;
   - shortest daily usage;
   - update/repair/rollback behavior;
   - managed/user/project data boundaries;
   - migration and uninstall safety;
   - advanced reference separated from normal flow.
4. Do not publish a release or push a tag as part of local implementation unless the user explicitly requests release publication.

## Phase 6 — End-to-end quality gate

Run the normal project gates:

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
git diff --check
```

Run isolated Windows E2E on PowerShell 5.1 and 7:

1. Fresh install without Git/source checkout.
2. Launch from an unrelated target project cwd.
3. No-op update.
4. Upgrade to a second fixture release.
5. Rollback.
6. Repair from cache with network disabled.
7. Failure injection at download/hash/npm/verify/activate.
8. Concurrent update lock.
9. V1 checkout migration with dirty/local-ahead repository.
10. Uninstall preservation of Pi/project/dev data.

## Risky files and review focus

- `dove_pi.py`: compatibility routing and launcher semantics.
- `install.ps1`: remote bootstrap, quoting, encoding and safe cleanup.
- `installer/layout.py` and `installer/transaction.py`: destructive path boundaries and activation ordering.
- `src/extensions/install.ts`: user package ownership and settings preservation.
- `src/project-provider/trellis-cli.ts`: bundled Trellis lookup without changing target project cwd.
- `.github/workflows/*release*`: version drift and asset integrity.
- README.md / README.en.md: commands must match actual parser behavior.

## Completion checklist

- All PRD acceptance criteria have direct automated or documented manual evidence.
- No test touches the user's real Pi settings, `%LOCALAPPDATA%\DovePi`, global npm root or projects.
- No recursive delete/move accepts an unresolved or out-of-root path.
- Default startup/doctor network-block tests pass.
- Chinese and English docs are behaviorally identical.
- Trellis specs are updated after implementation evidence, then `trellis-check` is run before commit.
