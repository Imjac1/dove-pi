# The commits the journal names

## Goal

Check that every commit the journal names is a commit that exists.

## Background: the record that outlives the session

The journal is the project memory: each session records a title, a summary and the commits it produced. **An entry naming a commit that
does not resolve reads perfectly and leads nowhere** - and unlike the code, nothing runs it, so nothing notices.

**This session has made the mistake itself**: a placeholder where a sha belonged, and shas taken before an archive moved the commits they
named. Both were caught by hand. **A trail that is only checked by hand is a trail that is checked when somebody remembers.**

**The measurement is a set comparison against the object store**, which is the one authority on whether a commit exists.

## Requirements

- **R1 - Read every commit the journal names**, across the journal files, with the entry it belongs to.
- **R2 - Resolve each against the object store**, and not against a log listing, because a shallow clone has fewer commits than the
  repository has objects.
- **R3 - Report every name that does not resolve**, with the entry and the date.
- **R4 - A name that cannot resolve is either fixed or recorded with the reason it cannot be** - a commit from another clone, or one that
  was never made.
- **R5 - A check is added only if it is not a weaker duplicate** of the ones holding the surfaces above, and only if it can run in a
  checkout that is not this one.
- **R6 - The gate passes**: typecheck, the suite, the installer tests and the spec budget test.

## Acceptance Criteria

- [ ] **AC1** Every named commit is listed with its entry.
- [ ] **AC2** Each is resolved against the object store.
- [ ] **AC3** Anything unresolvable is fixed or recorded with its reason.
- [ ] **AC4** Any check added is justified, and works outside this checkout.
- [ ] **AC5** The gate passes.

## Out of scope

- **The journal own prose**, which is a record and not a claim.
- **Commits no entry names**, which is the normal case for work outside a session.
- **The first real turn**, which needs a Pi host.
