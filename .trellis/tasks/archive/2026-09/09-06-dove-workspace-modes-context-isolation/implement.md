# Implementation Plan

## Phase A: Policy contract

- [x] Add a typed workspace-mode contract and bounded `.dove/workspace.json`
      reader/writer with development fallback and atomic persistence.
- [x] Add CLI support for `workspace status|set` if needed by the existing
      command routing, plus the one-launch `--workspace-mode` override.
- [x] Keep the existing project lock/state ownership boundaries and add focused
      policy tests before wiring runtime behavior.

## Phase B: Launcher and interactive control

- [x] Update `bin/dove-pi.cjs` and `dove_pi.py` together so effective mode is
      resolved identically and `--no-lens` is added only for `pentest`.
- [x] Update the Pi extension with `/dove-workspace development|pentest`,
      persisted status, restart-required messaging, and full `/status` output.
- [x] Ensure startup mode and current process state are distinguishable; do not
      claim that changing the file unloads an already-loaded extension.
- [x] Preserve `/mode fast|standard|ultra`, `/dove-mode auto|chat|work`, and
      all existing tool behavior.

## Phase C: Context isolation

- [x] Add a reusable model-message projection helper at the Pi adapter boundary.
- [x] Register the helper on Pi's `context` event and cover every custom message
      regardless of producer, with special handling for background-task
      notifications.
- [x] Retain bounded metadata/artifact references and remove oversized raw
      payloads from provider-facing messages. Ensure original session artifacts
      remain available for deliberate inspection.
- [x] Add third-party/vendor/download-tree path classification for diagnostic
      delivery without changing external workspace files.

## Phase D: Failure normalization and documentation

- [x] Add bounded shell/cwd/exit/stderr projection and equivalent-failure
      coalescing for background task results.
- [x] Update Chinese and English README command/help/status documentation.
- [x] Update the relevant backend specs with the final contract and migration
      behavior.

## Validation and rollback points

1. Run focused workspace policy, launcher, context projection, and Pi adapter
   tests.
2. Run `npm run typecheck` and `npm test`.
3. Run `npm run test:installer`, `npm run doctor`, and `npm run pi:smoke`.
4. Run one isolated fresh-process smoke using temporary project, Pi state, and
   session directories. Assert `development` omits `--no-lens` and `pentest`
   includes it.
5. Replay the synthetic oversized notification and assert provider-facing
   message size stays bounded and raw payload is absent.

Implementation result: all focused and full validation commands pass. The
deferred dedicated pentest workflow remains out of scope; pentest currently
only selects the next-launch Pi-lens policy.

Rollback checkpoints:

- Policy persistence can be disabled by ignoring the optional file; missing
  policy must still mean development.
- Launcher support can fall back to development if the policy is malformed.
- Context projection is additive and can be disabled at the adapter boundary
  only for diagnosis; built-in tool compaction remains intact.
