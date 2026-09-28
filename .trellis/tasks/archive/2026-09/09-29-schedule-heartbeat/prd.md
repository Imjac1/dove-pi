# Scheduling the heartbeat, and what the callback may do

## Goal

Wire the keepalive timer to the session events, which is what the allow-list entry named as what would reach it.

## The measurement that decided the callback shape

```text
the host API the adapter may call is ten verbs:
  setThinkingLevel, setActiveTools, getThinkingLevel, getActiveTools, appendEntry,
  registerCommand, getAllTools, registerShortcut, registerTool, on

**and none of them reaches the provider.**
```

**So the adapter cannot make the unsolicited request a heartbeat exists for.** That is not a limitation to work
around, it is the architecture: the host owns the provider. **The callback therefore reports**, through whatever
context the last request supplied - which is exactly what `observe()` is for, and the same shape the guard and the
fuse already have.

## The wiring, on three hooks that already existed

```text
session_start         at 2093   disarm any previous timer, construct one with a real unref’d clock, arm it
session_shutdown      at 2477   disarm and drop it, because the timer documents that as the caller obligation
before_provider_request at 2922 observe, and store the context a due callback will report through
```

**The clock is real and unref’d**, so a pending heartbeat never holds the process open. **And the notice says
what it is**: the session has been idle past the window the upstream cache holds, Dove will not send anything
itself because the upstream belongs to the host, and continuing or starting a new session are both fine.

## And the repository told me when this module was done

```text
the check          has no stale allow-list entry - a reachable module must be removed from the list
what it said       these allow-list entries are now reachable. Removing the entry is the definition of done
                   for that module
```

**That sentence is the repository own definition of done**, and the check asserts it in both directions: an
unreachable module that is not listed is new dead code, and a reachable one still listed is a list that rotted.
**The entry is gone, and the comment left in its place records the seventh shrink.**

## Acceptance criteria

- [x] **AC1** The timer is armed, observed and disarmed on the events that mean those things.
- [x] **AC2** The callback reports rather than acting, and the API surface is why.
- [x] **AC3** The allow-list entry is removed, which the check states is the definition of done.
- [x] **AC4** The gate passes.