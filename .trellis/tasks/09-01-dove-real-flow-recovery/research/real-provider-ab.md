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
| Installed candidate `0.1.5+source.659f79a5a9fd` | 4/4 | 7 | 3 | 0 | 25,417 | 145,664 | 3/4 | 1P / 0T / 7.0s | 2P / 1T / 11.0s |

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

## Installed HEAD Validation

- The previously installed `0.1.5+source.e39170049f65` was not current HEAD:
  it did not contain the latest task-selector and Provider-round-budget changes.
- Current HEAD was installed from source with `python dove_pi.py install
  --verify quick --no-extension-updates --no-font --no-path`; staging passed
  typecheck and Pi smoke. Managed state now points to
  `0.1.5+source.659f79a5a9fd`, with the former release retained as previous.
- Fixture root: `C:\Users\rebot\AppData\Local\Temp\dove-installed-ab-20260902-121659`.
  The original `C:\Users\rebot\Desktop\code` directory was not read or modified.
- The four prompts above ran through one long-lived Pi RPC process with one
  session and isolated Dove state. Every request completed without a question
  loop or malformed tool arguments. Tool calls were `read`, `write`, and
  `bash`, one each.
- Provider-visible schema stayed constant within the run: 47 tools and 70,759
  schema bytes. The tool digest was stable at
  `885168e78f9879886b07ae26`; system digest was
  `08eca4970ab55f24750c57eb`. The first request was cold; the next three first
  Provider calls reported cache reads of 23,808, 24,320, and 24,576 tokens.
- Warm goal uncached input was 800, 421, and 215 tokens for turns 2–4. The
  complete installed run used 25,417 uncached input tokens versus 41,541 for
  direct Pi + Trellis, while both completed all four goals.
- Session evidence:
  `C:\Users\rebot\AppData\Local\Temp\dove-installed-ab-20260902-121659\sessions-rpc\2026-09-02T04-30-15-960Z_installed-rpc-20260902-121659.jsonl`
- Dove ledger evidence:
  `C:\Users\rebot\AppData\Local\Temp\dove-installed-ab-20260902-121659\dove-state-rpc\execution.jsonl`

The same prompts were also probed with four separate `--print` processes. That
run completed 4/4 with 7 Provider rounds and 3 tools, but only 2/4 first-call
cache hits because each new process cold-started the first request. It is kept
as a process-restart observation, not the primary continuous-user result.

## Session Evidence

- Direct: `direct-sessions\2026-08-31T21-26-47-126Z_0b440c93-7dd6-4841-9bdb-9cfbe8d280b6.jsonl`
- Managed: `managed-sessions\2026-08-31T21-28-49-276Z_3aa56dbd-a064-4992-baa6-a3f7923f498a.jsonl`
- Source: `source-sessions\2026-08-31T21-35-38-733Z_9788bc44-9632-4aff-bba1-0dbd37d4ab19.jsonl`
