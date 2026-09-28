# Modules on the Python side that nothing imports

## Goal

Run the module graph measurement over the installer side, where it has never been run, and decide what anything unreferenced means.

## Background

The same measurement over `src` came back clean: 103 modules, none unreferenced, and it became a test. **The Python side is a different
tree with a different entry rule**, and it is the part of the product that installs everything else:

| Tree | What it is |
|---|---|
| `installer/` | the managed-install package |
| `dove_pi.py` | the public command router, run directly |
| `scripts/*.py` | commands a person or CI runs |

**A large test count is not the same as every module being wired.** 116 Python cases pass, and none of them would notice a module that
nothing imports.

## Requirements

- **R1 - Build the import graph** over `installer/**/*.py`, `dove_pi.py` and `scripts/**/*.py`, counting imports from those trees and
  from `tests`.
- **R2 - Name the entry points by hand with reasons**: a script run as a command is imported by nobody by design, and an `__init__.py`
  is a package marker rather than a module anything imports.
- **R3 - Read every module left over** rather than judging it by its name, and record the verdict for each.
- **R4 - Anything genuinely dead is removed with the Python suite passing**, and anything kept for a reason is recorded with it.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The graph exists and its method is stated.
- [ ] **AC2** The entry points are listed with reasons.
- [ ] **AC3** Every leftover module is read and its verdict recorded.
- [ ] **AC4** The Python suite still passes, 116 cases or more.
- [ ] **AC5** The gate passes.

## Out of scope

- **Unused functions inside live modules**, which is a different measurement.
- **The TypeScript side**, which is already held by a test.
- **The first real turn**, which needs a Pi host.
