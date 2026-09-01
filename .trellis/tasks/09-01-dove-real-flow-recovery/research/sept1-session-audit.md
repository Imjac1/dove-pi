# September 1 Real Session Audit

## Sources

- Pi session: `C:\Users\rebot\.pi\agent\sessions\--C--Users-rebot-Desktop-code--\2026-08-31T16-24-16-869Z_01a058a2-c2e5-7aa5-a03b-c712bf8c6e20.jsonl`
- Dove ledger: `C:\Users\rebot\.pi\agent\dove\workspaces\83500118cf3884bc\execution.jsonl`
- Managed release: `0.1.5+dea33bf`
- Project: `C:\Users\rebot\Desktop\code` (read-only forensic source)

The session timestamp is UTC. Its local wall-clock date is September 1, 2026.

## Per-Turn Results

| Turn | Prompt summary | Intent | Provider calls | Tools | Questions | Input | Cache read | Cache share | Provider time | Outcome |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | unfinished task inventory | lookup | 31 | 66 | 1 | 101,574 | 1,481,472 | 93.58% | 1,561,739 ms | over-explored |
| 2 | save current context | chat | 8 | 7 | 7 | 106,825 | 731,392 | 87.26% | 122,139 ms | no file |
| 3 | need dialogue log file | project-work | 4 | 3 | 1 | 115,363 | 341,504 | 74.75% | 69,533 ms | task skeleton only |
| 4 | affirmative `可以` | chat | 16 | 15 | 15 | 120,072 | 1,726,720 | 93.50% | 123,922 ms | cancelled |

Totals: 59 provider calls, 91 tools, 24 questions, 443,834 uncached
input, 4,281,088 cache read, 47,079 output, and 90.61% cumulative token
cache share. Provider processing time was 1,877,333 ms.

## Prefix Evidence

The first provider calls exposed 10, 1, 20, and 1 tools, with serialized schema
sizes 8,162, 3,850, 27,441, and 3,850 bytes. Every turn's first call reported
`cacheRead=0`. The four first calls contributed 332,212 uncached input tokens,
74.9% of the session's uncached total. Their prefix classifications were cold,
then three `multiple-prefix-change` events involving system/tools and once Dove
context.

## Question Guard Replay

The 15 Turn 4 `ask_user_question` calls were replayed against current HEAD's
`ProgressGuard`. All 15 returned `allow`. Calls 1-5 did not match the narrow
affirmative-plus-negative confirmation shape. Calls 6-15 never exceeded a
repeat count of 1 because changing prose defeated token-overlap equivalence.

## Extension Conflict

Auto Chat selects zero tools in Dove, but
`@juicesharp/rpiv-ask-user-question/reconcile.ts` registers a later
`before_agent_start` reconciliation that re-adds `ask_user_question` whenever
the UI is available. Turn 4 therefore exposed one tool, the question tool,
despite Dove's Chat policy.

## Metric Finding

The cache optimizer shard recorded 57 requests and omitted the final two while
the process remained active. Session JSONL and the Dove ledger both recorded
59. Cumulative cache share is not a goal-efficiency measure: the 15-question
loop repeatedly reused a 115K-token prefix and raised its own cache percentage
while making no progress.
