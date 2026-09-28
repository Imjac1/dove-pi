# Implementation plan: the capability declarations

## Ordered checklist

- [x] **1. The declarations**, from `capability list`.
- [x] **2. The effects**, read from each implementation.
- [x] **3. The comparison.**
- [x] **4. Fix or record, then the gate.**

## The measurement

```text
declared sideEffects      capabilities
read_only  (9)            dev.git_status, dev.node_version, dev.python_version, dev.typecheck, web.access_status,
                          windows.host_info, workspace.inspect, code-audit.seed, code-audit.disposition
workspace_write (4)       dev.project_test, dev.npm_install, dev.npm_build, code-audit.diff
system_change (1)         web.real_user_setup
```

**Every declaration matches its implementation.** The only write in `src/capabilities` is in `code-audit.diff`, which declares
`workspace_write` - written to a temporary file and renamed, with the reason in a comment. `code-audit.seed` declares `read_only` and
genuinely does not write: the scanner reads and hashes, and the caller writes.

**The vocabulary is a closed union** (`contracts.ts:19`), so a misspelled effect fails the compiler, and the two most
safety-relevant declarations are held by assertions that carry their reasons - `code-audit-mode.test.ts:208` says *"the scanner reads text
and hashes files; classifying it as a write would be a lie"*.

## The extraction that was too narrow, caught before it became a finding

**I concluded `system_change` was held by nothing, and it is held** - `web-access.test.ts:145` asserts it and `:178` tests the behaviour.
The searches that missed it were mine: I grepped for `sideEffects` and `read_only` and not for the value. **This is the third time this
session an extraction of mine produced a false finding, and the first where reading the result before writing anything stopped it.**

## Validation commands

```powershell
python dove_pi.py capability list
npm run typecheck
npm test
```

## Recorded, not built

1. **The approval policy**, which belongs to whoever owns it.
2. **The first real turn**, which needs a Pi host.