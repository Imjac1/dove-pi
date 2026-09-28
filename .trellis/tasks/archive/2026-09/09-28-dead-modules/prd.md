# Modules in src that nothing imports

## Goal

Find source modules no other module imports, and decide for each whether it is dead or an entry point.

## Background: why the claim is precise

"This file is not tested" is a guess; **"nothing imports this file" is checkable**, and it is the same shape as the checks this repository
already holds: a declaration naming things, compared with the things. The import graph over `src` and `tests` is the whole input.

**And a round already found the trap.** `.pi/extensions/notify.ts` was referenced by nothing, and it was **live** - Pi auto-discovers every
`.ts` in that directory. So the entry points are named by hand before the graph is read, not discovered from it:

| Entry point | Why nothing imports it |
|---|---|
| `src/cli.ts` | it is what `npm run doctor` and the CLI run |
| `src/pi-adapter/extension.ts` | it is what Pi loads |
| `.pi/extensions/*.ts` | auto-discovered by Pi |
| `bin/dove-pi.cjs` | the launcher, outside `src` |

## Requirements

- **R1 - Build the import graph** over `src/**/*.ts`, counting imports from `src` and from `tests`.
- **R2 - Name the entry points by hand**, with the reason for each, before reporting anything as dead.
- **R3 - Report what is left**, with the module and what it exports, and check each one by reading it rather than by its name.
- **R4 - Anything genuinely dead is either removed or recorded as deliberately kept**, with the reason - a module kept for a reason is
  not dead code, it is an unstated one.
- **R5 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** The graph exists and its method is stated (what counts as an import, what does not).
- **AC2** The entry points are listed with reasons.
- [ ] **AC3** Every module left over is read, and the verdict for each is recorded.
- [ ] **AC4** Anything removed is removed with the suite passing.
- [ ] **AC5** The gate passes.

## Out of scope

- **Files outside `src`**, which have their own entry rules.
- **Unused exports inside a live module**, which is a different measurement.
- **The first real turn**, which needs a Pi host.
