# A holder for the status command

## Goal

Close the gap two rounds named: the `/status` command had no holder, and neither did the fuse wiring.

## Background: a command four rounds pointed at and no test ever invoked

The review says the cache diagnostics should appear in the status line. The round before last made them appear by
default. **The round before that named the gap**: holding `/status` would need the fake extension host the
adapter tests build. **A search for `commands.get("status")` across the whole suite returned nothing**: the
command had never been exercised.

## What was read first

```text
tests/pi-adapter.test.ts:80    const commands = new Map<...>(...)   the harness already captures commands
tests/pi-adapter.test.ts:86    const notifications: string[] = []    and already collects notify calls
tests/pi-adapter.test.ts:145   const context: FakeContext = {...}    with sessionManager and notify wired
tests/pi-adapter.test.ts:259   await commands.get("mode")?.handler("fast", context)   how a command is driven
```

**The seam already existed.** The harness captures commands into a map and collects notifications into an array,
and another case already drives a command through it. **So the holder is assertions inside an existing case rather
than a new harness**, which is why the suite count is unchanged and the coverage is not.

## What the case asserts

```text
status ""      matches /Cache: /                        the cache line shows without asking for full
               does not match /Goals: /                the goal line costs a ledger read
               does not match /Use \/status full for cache diagnostics/   the hint is gone because untrue
status "full"  matches /Cache: / and /Goals: /        full keeps one and adds the other
control        the two calls are not the same string  so the assertions are about the flag
```

## Acceptance criteria

- [x] **AC1** The existing harness was read rather than replaced.
- [x] **AC2** The command is driven the way another case drives one.
- [x] **AC3** Both halves are asserted separately, with a control that the flag changes the line.
- [x] **AC4** The gate passes.