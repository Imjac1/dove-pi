# Implementation Plan

## 1. Native Provider

- Generalize provider/task type names.
- Add atomic `.dove/state.json` storage and a native provider.
- Make native the default; expose Trellis only through read-only compatibility.
- Add lifecycle, reconciliation, corruption, and migration tests.

## 2. Remove Workflow Ceremony

- Remove PlanningSession from the Pi adapter.
- Keep task tracking explicit and optional.
- Replace Trellis-specific commands, tool descriptions, status, and guidance.
- Ensure ordinary execution never asks to initialize or create a task.

## 3. Remove Runtime Dependency

- Remove Trellis CLI imports, implementation, package dependency, and release
  component metadata.
- Update CLI and managed installer behavior.
- Update English/Chinese README and runtime specs.

## 4. Validate Experience

- Unit-test clean, legacy, and migrated projects.
- Measure context projection size against the Trellis baseline.
- Run full repository/installer/doctor/Pi gates.
- Install the managed source release and run a real-provider edit/test flow.

## Rollback

- Never modify legacy `.trellis` data.
- Roll back by selecting the retained previous managed release.
