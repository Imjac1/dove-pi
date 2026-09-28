# The keepalive whose own evidence may contradict it

## Goal

Do the review P0.3 keepalive half, and measure it before building it.

## The contradiction, which is the round first result

```text
the review proposes   a heartbeat every four to five minutes, to keep the upstream cache warm
the repository records  context-guard.ts:89-93, observed data 08-29, both projects:
                        "cache misses are time-driven (gap>60s -> 34-40% miss, independent of prefix size)"
```

**A heartbeat every four or five minutes would therefore fire after three or four expired windows**, not before
one. **The interval the review suggests is late by a factor of four to five, and the evidence against it is in
this repository, in a comment written by another guard.**

## So the interval is derived, and the module says what from

```text
OBSERVED_MISS_GAP_MS  60000   stated so the interval below can be checked against it
KEEPALIVE_IDLE_MS     45000   three quarters of the observed gap, so a heartbeat lands before the expiry
```

**The constant carries the derivation rather than the number**, which is the difference between a policy and a
magic value: a later reader can check it against the observation instead of taking it on faith.

## Off by default, because a keepalive is a request

**The review own note says to make it optional and offline-first**, and the reason is structural rather than
stylistic: a heartbeat is a provider request, so enabling it is enabling the network. **`enabled` defaults to
false, and the disabled branch is checked first**, so an installation that has not opted in never computes the
comparison at all. **Nothing in the module reaches the network** - it decides, the caller acts.

## And it is its own module rather than part of the guard

**The guard reads what has already happened to the prefix and says so. This decides whether to *make a request*,**
which is a different kind of act and the only one in this line of work with a network cost.

## Acceptance criteria

- [x] **AC1** The interval contradiction is recorded with its source.
- [x] **AC2** The interval is derived from the observation and below it.
- [x] **AC3** The policy is off by default and reaches no network.
- [x] **AC4** The gate passes.