# The scripts the hook configurations name

## Goal

Check that every script the platform hook configurations name is a script that exists.

## Background: a failure that makes no sound

Hooks run at events - a session start, a tool call, a finish - and each is configured to run a script. **A hook pointing at a script that is
not there does nothing and says nothing**: no error reaches the session, and the work the hook was for simply does not happen. That is the
quietest failure this repository can have.

**The same shape as the front-door and curated paths**, in the one place where a broken path is invisible by construction.

## Requirements

- **R1 - Read every platform configuration** under `.claude` and `.codex`, and extract the paths each names.
- **R2 - Resolve each path** against the tree.
- **R3 - Report every path that does not resolve**, with the config and the event it belongs to.
- **R4 - Anything broken is fixed at the side that is wrong**, and a path that is deliberately absent is recorded with the reason.
- **R5 - The check, if one earns its place, must not be a weaker duplicate** of the ones holding the paths above.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every configuration is read and the paths are listed.
- [ ] **AC2** Each path is resolved.
- [ ] **AC3** Anything unresolvable is fixed or recorded with its reason.
- [ ] **AC4** Any check added is justified against the ones that exist.
- [ ] **AC5** The gate passes.

## Out of scope

- **Whether the hooks fire**, which needs a host that runs them.
- **Scripts the configs do not name**, which nothing points at.
- **The first real turn**, which needs a Pi host.
