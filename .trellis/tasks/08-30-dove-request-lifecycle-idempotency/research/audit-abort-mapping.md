# Audit abort mapping

## Source

- Audit root: `C:\Users\rebot\Documents\ChatGPT\audit\dove-pi-audit-20260830`
- Session: `sessions/2026-08-30T00-39-02-299Z_01a0501b-019b-75b3-b0c1-a69166df814a.jsonl`

## Initial six-abort sequence

The initial failure sequence contains six aborted assistant records, each
followed by another user delivery while the same run is still unsettled:

| JSONL line | Assistant record | Following user delivery |
|---:|---|---:|
| 6 | `37e0394d` | 7 |
| 9 | `af400bd5` | 10 |
| 12 | `64994e1e` | 13 |
| 15 | `d3b8a6cd` | 16 |
| 18 | `d3fcee68` | 19 |
| 21 | `7223e8d6` | 22 |

The sequence is followed by the successful tool-using assistant record at line
24. A later abort at line 168 belongs to a different interaction and is not
part of this fixture.

## Lifecycle interpretation

These records are repeated steer/redelivery events inside one unsettled Pi run,
not six deliberate completed requests and not six automatic provider attempts.
The lifecycle controller therefore associates the deliveries with one active
`logicalRequestId`. Steering and follow-up deliveries retain that identity but
do not increment the automatic retry attempt counter. Only low-level agent
attempts receive new `attemptId` values.

This mapping is covered by the lifecycle and Pi-adapter regression tests, which
also assert that an identical prompt submitted after `agent_settled` receives a
new logical request identity.
