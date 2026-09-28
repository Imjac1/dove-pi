# Implementation plan: the session-size fuse

## Ordered checklist

- [x] **1. Read what the diagnostics already carry.**
- [x] **2. Write the fuse as a pure function.**
- [x] **3. Hold it with tests.**
- [x] **4. The gate.**

## Validation commands

```powershell
npx tsx --test tests/session-fuse.test.ts
npm test
```

## What was read first, and what it supplied

```text
src/pi-adapter/cache-diagnostics.ts   CacheDiagnostics carries promptTokens, lastHitRate, sessionHitRate,
                                      warmHitRate, fullMisses, and lastMissReason with the four values
                                      warmup, model-change, idle and provider-miss-or-expiry
src/commands/cache-audit.ts           the diagnostics are already consumed by a command, so the plan note
                                      that they are not surfaced is about the status line rather than nowhere
src/core/context-admission.ts:60      content is compacted above a threshold; conversation is not
```

## What was written

```text
src/pi-adapter/cache-diagnostics.ts   SessionFuseState, SessionFuseReading, SESSION_FUSE_PREFIX_RATIO,
                                      evaluateSessionFuse()
tests/session-fuse.test.ts            6 cases
```

## The rule that keeps it from inventing a number

**A window of zero or less yields `ok` and a ratio of zero**, because dividing by an unknown window produces a
number that looks like a measurement and is not one - and this reading exists to prevent exactly that kind of
claim. **The cold start still reports in that case**, because a miss reason is a fact about the call rather than
about the window.

## And it recommends rather than acts

**The review asks for compaction or a suggestion.** A suggestion is what a reading can honestly produce:
compacting here would change a conversation the caller owns, and the fuse has no view of what the caller still
needs in it.
