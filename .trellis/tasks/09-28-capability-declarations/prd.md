# What each capability declares about itself

## Goal

Read the declarations `capability list` prints for all fourteen capabilities and hold each against what the capability does.

## Background: a tenth kind of declaration, and the one with consequences

The capabilities are the surface a host calls when it wants something done, and some of them change the machine - `dev.npm_install`,
`dev.npm_build`, `code-audit.seed` - while others only read it. **A caller deciding whether to approve needs to know which is which**, and
that is what a declaration is for.

**This round does not decide policy.** It measures whether a declaration matches the thing it describes: a capability that writes files and
says it is read-only is a false statement in a place where being wrong costs something.

## Requirements

- **R1 - Read the declarations** from `capability list`, one per capability, with the fields each carries.
- **R2 - Read what each capability does**, from its implementation, and classify the effect: reads, writes, runs a process, changes
  managed state.
- **R3 - Compare** and report every capability whose declaration does not match its effect.
- **R4 - Anything false is fixed at the side that is wrong** - the declaration if it understates, the implementation if it oversteps.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every declaration is listed with its fields.
- [ ] **AC2** Every capability is classified by effect, with the evidence.
- [ ] **AC3** Any mismatch is reported and fixed at the side that is wrong.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **What the approval policy should be**, which belongs to whoever owns it.
- **Capabilities Pi provides**, which Dove does not declare.
- **The first real turn**, which needs a Pi host.
