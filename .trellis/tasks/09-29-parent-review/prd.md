# The parent integration review

## Goal

Run the umbrella last step: the four cross-child gates, then archive the tree.

## The four gates, held against what exists

```text
Preserve Pi/core/installer ownership and unrelated Pi plugins/user state
  held. The layer check asserts src/core imports nothing from the Pi side, and this span touched
  dove_pi.py and two test files - no core module, no Pi extension, no user state.

Keep logs redacted and bounded
  held. redact_maintenance_text bounds to 500 characters and masks bearer, API-key, credential,
  private-key and environment shapes; six installer cases and four ledger cases hold it.

Update runtime spec after contracts are verified
  ANSWERED BY THE CONSTRAINT, NOT BY AN EDIT. The contracts are verified and the specification
  cannot take them: personal-agent-request-runtime.md sits 37 normalized bytes under its 24 KiB
  limit, and the budget suite pins its exact second-level heading list, so a new section would
  fail twice. The contracts live in the code with their holders, which is where a reader of the
  module finds them.

Update README files only for user-visible behavior
  held, by not needing to: nothing this span did is user-visible. No command, flag or output
  changed; schema 2 is additive and a legacy reader still works.
```

## And a measurement mistake worth recording, because it is the session own class

```text
I measured the spec with statSync().size   24933 bytes   and concluded it was 24.3 KiB, over budget
the test measures                            Buffer.byteLength(content.replace(/\r\n/g, "\n"))
the same file normalized                      24539 bytes   under the 24576 limit, 37 to spare
the difference is 394 CRLF endings, which statSync counts twice
```

**I measured with my own instrument rather than the test own**, which is the same class as the count
readers, the truncated task name, the word-searches and the four wrong harness flags: **a value taken from a
view of the thing rather than from the thing.** The headroom is 37 bytes, not minus 357.

## Acceptance criteria

- [x] **AC1** All four gates are held against what exists.
- [x] **AC2** The one that cannot be met is named, with the constraint that blocks it.
- [x] **AC3** The measurement mistake is recorded.
- [x] **AC4** The parent is archived.