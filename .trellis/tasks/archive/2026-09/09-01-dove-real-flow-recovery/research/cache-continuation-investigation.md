# Cache Continuation Investigation

## Status

Implementation complete for the source-level restart defect. The strict
same-prompt old/new run is complete for context-shape attribution; Provider
warm-rate improvement is still not claimed because the aligned run stayed
Provider-cold.

## Sources Consulted

- Pi 0.84.3 local source: `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js` and `docs/extensions.md`.
- Pi provider-payload extension example: `node_modules/@earendil-works/pi-coding-agent/examples/extensions/provider-payload.ts`.
- DeepSeek Context Caching: https://api-docs.deepseek.com/guides/kv_cache
- OpenAI Prompt Caching: https://platform.openai.com/docs/guides/prompt-caching
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

## Established Protocol Facts

1. Pi builds a new turn as the current user message followed by every
   `before_agent_start` custom message. Those custom messages participate in
   the LLM context and are persisted in the session.
2. Pi sends the final system prompt, tool definitions, and serialized history
   through `before_provider_request`. A `before_agent_start` system-prompt
   replacement is applied to the agent state for that turn.
3. Pi documents that changing tool names, descriptions, schemas, ordering, or
   tool-specific prompt metadata can invalidate a provider prefix. It also
   documents that dynamic tool activation may rebuild the system prompt.
4. DeepSeek disk caching is prefix-unit based. A later request must fully reuse
   an already persisted prefix unit; a request that changes the suffix cannot
   reuse the longer previous unit, although a shorter common prefix may be
   persisted for later requests. Cache construction is asynchronous and the
   service describes the result as best effort.
5. OpenAI and Anthropic likewise define caching around stable ordered prefixes
   including tools, system instructions, and conversation content. Provider
   cache keys or session affinity improve routing but do not make a changed
   prefix reusable.

## Local Evidence And Hypothesis

The current adapter keeps `requestContextEpoch`, `requestContextText`, and the
provider-prefix comparison map in process memory. `session_start` resets the
provider comparison map but does not restore the latest v2
`personal-agent-context` message from the active session branch.

On a fresh process, the first relevant request therefore sees an empty
`requestContextEpoch`, recompiles the same project snapshot, and returns a new
custom message. The old snapshot is already in the persisted history. This
creates duplicate derived context at the next user-turn boundary and changes
the serialized history shape precisely where the provider expects an exact
prefix unit. The existing A/B result is consistent with this hypothesis: Dove
had a full miss on the first request after process restart while Native Pi had
the corresponding continuation warm.

This is a high-confidence code defect, but it is not yet sufficient to claim
that every observed miss is caused by Dove. Provider routing, cache TTL,
session-affinity headers, tool-schema changes from other Pi extensions, and
system-prompt changes must be measured in the same run.

## Controlled Experiment Matrix

Use one isolated temporary project, one provider/model, one session ID, and a
long enough prompt/history to exceed the provider cache threshold. Keep the
prompt sequence and launcher arguments identical across variants.

| Variant | Process | Dove context | Purpose |
|---|---|---|---|
| A | same process | disabled | Provider/Pi baseline |
| B | same process | enabled | Current Dove in-process behavior |
| C | restart between turns | enabled | Reproduce the reported regression |
| D | restart between turns | enabled, hydrated snapshot candidate | Verify the proposed fix |
| E | session reload/new/fork | enabled | Ensure session replacement does not leak or lose context |
| F | formal task, no artifact change | enabled | Detect formal progress writes that unnecessarily churn context |

Each variant needs at least one cold request and three subsequent logical
turns. Repeat the restart comparison twice to separate a deterministic prefix
change from a provider miss or expiry.

## Required Evidence Per Provider Request

Record only bounded digests and sizes, never prompt text or credentials:

- process ID and logical request/attempt/provider-call IDs;
- session ID digest, provider, model, and the exact session-affinity header
  names plus value digests;
- system digest and byte count;
- ordered tool-schema digest, tool count, and byte count;
- Dove context digest, schema version, epoch, revision, and count of v2 context
  messages in the outgoing history;
- ordered history digest and message count;
- provider usage: input, cache read, cache write, output, and stop reason;
- process start/restart marker and elapsed idle time.

The session JSONL and Dove ledger remain authoritative for persisted history and
usage. Any optimizer shard is supplemental and must be reconciled before
calculating results.

## Attribution Rules

- If system or tools differ, attribute the miss to prefix churn before
  considering Dove context.
- If system/tools are stable but a second v2 Dove message appears after
  restart, attribute the deterministic shape change to snapshot hydration.
- If all serialized components are identical and the session-affinity inputs
  are stable but cache reads still drop, label it provider miss/expiry or
  routing; do not blame Dove.
- If only formal task metadata changes and the serialized context digest also
  changes, measure it as an intentional context revision. Do not hide it as a
  warm hit.

## Smallest Fix If Reproduced

1. On `session_start`, reset session-scoped in-memory snapshot state and scan
   only the active branch for the newest valid v2 Dove context message.
2. Restore its epoch, revision, bounded segment metadata, and content digest so
   the next request does not append a duplicate snapshot when the project
   revision is unchanged.
3. On session replacement or shutdown, clear the restored snapshot so context
   from another session cannot leak into the next one.
4. Add focused tests for startup resume, `/new` or resume in the same process,
   branch-local selection, malformed metadata, and unchanged-versus-changed
   project revisions.

Do not add a permission layer, change Pi's active tools, rewrite provider
requests, or make provider-specific cache promises in this fix.

## Acceptance For This Investigation

- The restart regression is reproduced or falsified with payload evidence.
- The proposed fix removes duplicate derived context on unchanged restart
  continuation without dropping the user's history.
- Same-process, restart, and session-replacement tests agree on context count,
  epoch, revision, and history ordering.
- In a cache-reporting upstream, warm first-call cache rate is at least 70%
  after the initial cold call, with no increase in questions, provider rounds,
  tools, or uncached input versus the current source baseline.
- Provider-only misses remain visible as provider misses rather than being
  misreported as Dove prefix changes.

## Implementation Result

- `src/pi-adapter/context-snapshot.ts` restores the newest valid v2 context
  message from the active Pi branch and rejects guidance-only or malformed
  metadata.
- `session_start` clears and hydrates the in-memory snapshot; `session_shutdown`
  clears it again for new/resumed/forked sessions.
- The Provider `context` hook retains only the latest guidance-only v2 message;
  real v2 snapshots remain available and legacy entries remain filtered.
- Adapter regression coverage confirms an unchanged resumed branch emits no
  duplicate context and a replacement session compiles fresh context.
- Full local validation passed: 236 TypeScript tests, typecheck, 92 installer
  tests, doctor, Pi smoke, and Trellis task validation.
- A real Provider run is still required before claiming a measured warm-rate
  improvement; equal serialized prefixes with zero cache reads must be labeled
  Provider miss/expiry rather than Dove churn.

## Candidate Installation Run

- The source candidate was installed through `python dove_pi.py install
  --verify quick --no-extension-updates --no-font --no-path`.
- Managed state now points to `0.1.5+source.e39170049f65`, with
  `0.1.5+source.9f1bce7a0751` retained as the previous release.
- The managed release contains the snapshot helper and adapter hook changes;
  doctor reports the Dove identity as `in_sync`.

## Latest Persisted-Branch Evidence

The available isolated fixture was `C:\Users\rebot\AppData\Local\Temp\dove-cache-live-20260901`.
Credentials and raw prompts were not copied into this report.

| Probe | Provider calls | v2 context items per call | Cache reads | Result |
|---|---:|---|---|---|
| Previous managed release, four resumed turns | 4 | 1, 2, 3, 4 | 0, 22,784, 23,552, 23,808 | Reproduces duplicate growth |
| Candidate retry fixture, including tool continuations | 6 | 1, 1, 1, 1, 1, 1 | 23,040, 0, 6,400, 23,296, 23,296, 23,552 | No duplicate context |

The rows are not a strict Provider A/B because request plans and launcher
attempts differ. They prove the persisted-history shape regression and its
removal, not a provider-independent cache percentage. Equal serialized
prefixes with zero reads remain Provider miss/expiry or routing evidence.

## Strict Same-Prompt Source Run

The aligned four-turn run used the same prompt, Provider/model, fixed session
ID, isolated session directory, and read-only environment for the old managed
release and current source. The current source produced four Provider calls
with `doveContext.items=1,1,1,1`, stable system/tool/context digests, and
`cacheRead=0,0,0,0`. This confirms the context-shape fix and classifies the
zero reads as Provider cold/miss evidence rather than Dove prefix churn.
