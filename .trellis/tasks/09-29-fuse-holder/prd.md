# A holder for the fuse wiring

## Goal

Hold the fuse wiring line through the adapter harness, the way the status line was held.

## What happened instead, and why the tree is unchanged

**Four accidents, all self-inflicted, none of them the code.** The round ends with the tree restored to HEAD and
nothing added - which is the honest outcome, not a partial one.

```text
1  a string splice left the test file truncated at a comment line
2  a second splice truncated it again, after a restore
3  a failiing assertion, correctly: the notices are one-shot per extension() call, so a long case that already
   ran many turns cannot see a notice again
4  a third operation refused because git checkout had changed the file under the edit tool
```

## The cause, which is worth more than the attempt

**`tools.read` truncates long lines, and writing that content back with `tools.write` writes the truncation.**
That is the cause of both truncations, and it is the same trap as the round that read a spec line ending in an
ellipsis and treated the ellipsis as content. **The rule it earns**: never round-trip a file through read and
write; use the edit tool with an anchor, which matches against the real file rather than a view of it.

## What the attempt did establish, and it is real

**The notices are one-shot per `extension(api)` call.** The flags are closure state in the handler, so a case that
asserts a notice has to own the handler that raises it. **That is exactly why the fuse needs a case of its own**
rather than assertions appended to the long case - which is what round 184 meant by *a different harness*.

**And the cold start is stageable through the real path**: two assistant messages, the second with `cacheRead: 0`
and more than five minutes after the first, yields `lastMissReason: "idle"`, which the fuse reports as a cold
start. The entries shape and the derivation were read, not guessed.

## Acceptance criteria

- [ ] **AC1** A case of its own for the fuse, with its own `extension(api)`.
- [ ] **AC2** Both states asserted, with the one-shot flag as the control.
- [x] **AC3** The cause of the accidents is recorded, and the tree is restored to HEAD.
- [x] **AC4** The gate passes with the suite unchanged.