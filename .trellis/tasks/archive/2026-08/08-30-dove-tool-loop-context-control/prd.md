# Dove tool-loop and context control

## Goal

Prevent repeated observations from consuming an entire request while retaining legitimate retries, changing-state polling, and authorized mutations.

## Fresh-session evidence

The exported Pi session `01a05337-49d8-7b61-873c-57aa69d7e59c` showed one expected cold provider call followed by uneven reuse as large read-only tool results entered history. The five calls reported `(input, cacheRead)` as `(9055, 0)`, `(756, 8960)`, `(10806, 9472)`, `(401, 20224)`, and `(8211, 20480)`. The final request remained far below its context window, so the actionable gap is attribution and stable-prefix preservation rather than deleting required context or treating the first cold call as a regression.

## Requirements

- Normalize tool inputs deterministically and fingerprint calls.
- Block/coalesce exact duplicates in one assistant batch before repeat execution.
- Fingerprint bounded results and detect unchanged successful observations across turns.
- Reset stagnation when arguments or observations change.
- Add advisory checkpoint and hard-stop thresholds with structured reasons.
- Apply intent-aware tool budgets without weakening authorization.
- Improve `ls` with explicit default path, completion, and cursor metadata where Pi permits.
- Bound obsolete request guidance while preserving stable cache prefixes and ModelGateway headroom.
- Attribute cache misses using component digests, not inferred billing data.
- Report cache reuse per provider call and distinguish cold start, stable-prefix reuse, new conversation/tool history, and actual system/tool/Dove-prefix changes.
- Keep static system policy, serialized tool schemas, and derived Dove context byte-stable across attempts of one logical request unless their owning revision changes.
- Bound oversized read-only tool observations before they enter provider-visible history, while preserving explicit truncation/cursor evidence and never truncating mutation results as if they were replayable reads.

## Acceptance Criteria

- [x] Fourteen identical `ls` calls in one batch execute at most once.
- [x] Identical successful observations across turns warn and stop within a bound.
- [x] Changed directory results reset stagnation.
- [x] Intentional user retry after settlement gets a fresh progress window.
- [x] Mutation tools are never result-cached or replayed automatically.
- [x] Long sessions do not retain unbounded obsolete guidance.
- [x] A cold-first/four-follow-up fixture attributes cache reuse without flagging the cold call or cumulative cache-read counters as prefix regressions.
- [x] Unchanged system/tool/Dove components retain identical digests across all attempts of one logical request.
- [x] Large read-only results are bounded with deterministic continuation metadata before the next provider call.
- [x] Request-exact tools and provider-budget firewall tests pass.

## Out of Scope

- Semantic caching of arbitrary shell commands or blocking repeated reads when state changed.
