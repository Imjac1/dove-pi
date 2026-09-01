# Real Provider A/B

## Setup

- Timestamp: 2026-09-01 05:26 Asia/Shanghai
- Model: `12321/deepseek-ai/DeepSeek-V4-Flash`, thinking `max`
- Fixture root: `C:\Users\rebot\AppData\Local\Temp\dove-flow-ab-20260901-052619`
- Source project was copied into isolated `direct`, `managed`, and `source`
  directories. `C:\Users\rebot\Desktop\code` was not modified.
- Every variant used one persistent four-turn Pi session.

Prompts:

1. Inspect and list unfinished Trellis tasks without modifying files.
2. Read `package.json` and report only name/version.
3. Create `audit-note.txt` containing `cache-flow-ok`, directly and without a question.
4. Check whether `audit-note.txt` exists and answer only yes/no.

## Results

| Variant | Completed | Provider | Tools | Questions | Uncached input | Cache read | Warm first calls | Turn 1 | Turn 4 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Direct Pi + Trellis | 4/4 | 10 | 8 | 0 | 41,541 | 330,752 | 3/3 | 4P / 5T / 37.1s | 2P / 1T / 8.3s |
| Managed `0.1.5+dea33bf` | 3/4 | 56 | 66 | 0 | 93,439 | 880,384 | 0/3 | 6P / 15T / 70.1s | 46P / 49T / 256.1s, interrupted |
| Source candidate | 4/4 | 8 | 4 | 0 | 17,129 | 101,376 | 3/3 | 2P / 1T / 15.9s | 2P / 1T / 3.9s |
| Installed candidate | pending | | | | | | | | |

`P` is Provider rounds and `T` is tool calls. A warm first call is a user turn
after the first whose first Provider response reports `cacheRead > 0`.

## Findings

- The managed baseline missed the cache on the first Provider call of all four
  turns. Direct Pi and the source candidate both hit 3/3 warm first calls.
- The baseline's fourth turn repeatedly emitted malformed nested DSML arguments
  such as `arguments.arguments.path`. It made 46 Provider calls and 49 tools,
  mostly repeated `ls`, before manual interruption after 256.1 seconds.
- The source candidate used one normal `read` in turn four and completed in 3.9
  seconds. Across the complete matrix it used 58.8% fewer Provider rounds than
  direct Pi and 58.8% fewer uncached input tokens while completing every goal.
- The source candidate did not achieve the earlier zero-tool inventory ideal:
  it used one `agent_project_status` call. This is consistent with preserving
  Pi's native tool authority after rejecting the proposed per-request firewall.
  It still cut the inventory turn from direct Pi's 4P/5T/37.1s to 2P/1T/15.9s.

## Session Evidence

- Direct: `direct-sessions\2026-08-31T21-26-47-126Z_0b440c93-7dd6-4841-9bdb-9cfbe8d280b6.jsonl`
- Managed: `managed-sessions\2026-08-31T21-28-49-276Z_3aa56dbd-a064-4992-baa6-a3f7923f498a.jsonl`
- Source: `source-sessions\2026-08-31T21-35-38-733Z_9788bc44-9632-4aff-bba1-0dbd37d4ab19.jsonl`
