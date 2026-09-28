# The full validation, and the criteria held against it

## Goal

Do the child eighth and last plan item, and hold its acceptance criteria against what exists.

## Background: five commands, and a contradiction inside one of them

The child own Full Validation block names five commands, and this round ran all five together rather than one
at a time. **One of them contradicted a standing session conclusion**, which is the round real finding.

## The five, all green

```text
typecheck       exit 0
test            exit 0   776 pass, 0 fail, 2 skipped
test:installer  exit 0
doctor          exit 0   status healthy
pi:smoke        exit 0
```

## And the contradiction

```text
doctor   "managedInstall": { "installed": false, "root": "...\AppData\Local\DovePi" }
         "pi": { "version": "0.84.3" }

update --check (round 154)   "Pi: not installed -> 0.84.3 (update available)"
```

**Both are true and they say different things.** `update --check` was reporting the *managed release*, which is
not installed. **Pi itself is present at 0.84.3** - the version that same output called *not installed*.

**So a standing conclusion was wrong**: the session has been saying the first real turn *needs a host this
environment does not have*, and the premise came from a line about the managed release rather than about Pi.
**The host is here.** What is missing is the *managed* install, which is a different thing, and installing it is
still a change to this machine.

## The criteria, held against what exists

```text
legacy four-field logs remain readable                     held: project_maintenance_record projects them as schema 1
new logs explain repeated install/repair and duration       held: summarize_maintenance_logs, six cases
archived replay has no duplicate persistence or execution  held: the replay, one case
  - duplicate REGISTRATION is named as not ledger-visible  named, not claimed
redaction covers bearer, credentials, keys, env, args      held: 6 installer cases plus 4 in the ledger suite
full gate without touching real installation or Pi state   held: every fixture uses a temporary root
summary reports stagnation and cache-prefix changes        NOT held: named in the projection own comment, because
                                                            the vocabulary has no kind for either
```

**That last line is the one a reader should not skip**: two of the child acceptance criteria are *not* met, and
they are named rather than quietly dropped.

## Acceptance criteria

- [x] **AC1** All five commands run and recorded.
- [x] **AC2** The contradiction is measured rather than resolved by preference.
- [x] **AC3** The criteria are held against what exists, with the unmet ones named.
- [x] **AC4** The gate passes.
