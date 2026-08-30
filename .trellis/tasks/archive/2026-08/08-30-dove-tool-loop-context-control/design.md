# Design: Dove tool-loop and context control

## Progress Model

Extend the error-only `ProgressGuard` into a host-independent controller with batch and request scopes. It records call fingerprints, bounded result digests, repeat counts, and decisions: `allow`, `coalesce`, `checkpoint`, or `terminate`.

Same-batch duplicates are blocked before execution. Cross-turn success stagnation requires identical normalized call and result digest. Errors retain existing behavior. Mutation calls participate in detection but never share cached results.

## Context Model

Static policy remains stable. Project snapshots stay revision-scoped. Request guidance becomes logical-request-scoped and is retired/compacted at a safe host boundary. Component digests identify whether system, tools, history, or Dove context changed.

Cache diagnostics operate on individual provider calls. They record bounded component digests and byte/token estimates for system policy, serialized tools, derived Dove context, and provider-visible history. Provider-reported `cacheRead` remains evidence, not the source of component identity. The first call is classified as cold; later calls compare component digests with the preceding call and attribute new uncached input to changed components or appended history.

Read-only tool output compaction happens at the existing Pi adapter boundary before the result is persisted into the next model request. The compacted representation carries original-size, retained-size, digest, truncation reason, and continuation/cursor metadata. Mutation and unknown tools are not semantically result-cached or silently compacted under this policy.

## Host Limitations

If Pi cannot share one result across duplicate tool-call IDs, duplicates receive structured coalesced results referencing the primary call. Cursor-aware `ls` should prefer Pi's host API; Dove should not create a second incompatible filesystem tool unless necessary.
