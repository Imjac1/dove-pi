# Design: a tool call that has not returned is a reading, not a silence

## The smallest behaviour gap

A tool call that never returns writes **nothing at all**. `tool.observed` is appended at `tool_result` only, and only
when `isError !== true` (`src/pi-adapter/extension.ts:2969`). So the ledger's last record before a hang is whatever
came before the call, and the only thing that ever names the hang is the outer watchdog. Measured twice: the event
stream stops 1 ms after the call starts and does not write again for six and a half minutes (`19:08:37.113` →
`19:15:10.744`) and for forty-five (`16:50:59.355` → the run cap).

The gap is not that the wait is unbounded. It is that **the wait is unrecorded**. The gate already knows a call is
about to run - `applyAdaptiveShellTimeout` is decided at that same point (`extension.ts:2763`) - and writes nothing.

## The route this takes, and the two it does not

The PRD left three routes open. **This design takes route 3 (record the absence), and with it the second half of R2
(an unlisted command's "no timeout" stops being implicit).**

- **Rejected: widen the whitelist.** The two measured hangs were `find / -name "dove-pi.cmd" -maxdepth 6` piped to
  `head`, and the earlier one was inferred to be a server or network command. **Neither is an aggregate verification
  command.** A whitelist that covers them covers "any command", because any command can fail to return. That route is
  a treadmill with a measured end.
- **Rejected: make a timeout the default** (the whitelist only shortening it). It would bound every ordinary command,
  which the contract at `error-handling.md:28-36` deliberately chose not to do, and it would cut off a legitimately
  long build or dependency install. R3 says a behaviour change has to carry that reason with it; this design does not
  need to pay that price to answer R1.
- **Chosen: record it.** It changes no command's behaviour, so R3 is satisfied without re-arguing anything, and R1's
  visible criterion - "the reading says a call has not returned" - is met exactly. It is also what this round's own
  subject asks for: a reading that omits a fact is what made two earlier readings wrong.

**What this design does not do, and says so**: it makes a hang *legible*, not *shorter*. A run can still sit until
the watchdog. If the operator wants the wait bounded as well, that is route 2 as a separate decision, and the price is
stated above rather than hidden here.

## Boundary

| File | Why it must change |
|---|---|
| `src/core/contracts.ts` | `ExecutionRecordKind` is a **closed set** (`:90`) and already carries `capability.started` and `capability.timed_out`; a kind the ledger writes has to be in the vocabulary, or the record is outside the contract everything else is checked against |
| `src/core/execution-ledger.ts` | `appendToolStarted` beside `appendToolObserved` (`:595`), **and** a case in the projection's switch (`:411`) - a record that is written and never read is the "mechanism nobody reads" defect this repository keeps finding |
| `src/pi-adapter/extension.ts` | One writer, at the gate where the timeout decision is already made (`:2763`), and one reader in the status line (`:1238`-`:1250`, where `workMode` and the tool surface already print) |
| `src/core/failure-reading.ts` | It already reads `tool.observed` (`:258`) and counts the absence of any (`:318`); a started-without-observed call is the stronger fact it should name |
| `.trellis/spec/backend/error-handling.md` | §"Aggregate shell timeout contract" (`:28-39`) owns this behaviour and states only the whitelist half. It gains the declared-absence half |
| `tests/execution-diagnostics.test.ts` | Holds the projection; the new relation is asserted here |
| `tests/pi-adapter.test.ts` | Holds `applyAdaptiveShellTimeout` and drives the extension's handlers off the registry |

## Contract

A new record kind, mirroring the shape `capability.started` already has:

```ts
kind: "tool.started"
correlation: { requestId, sessionId, attemptId, toolCallId, taskId }
details: {
  tool: string;                 // the tool name, as tool.observed carries it
  timeoutApplied: boolean;      // the applyAdaptiveShellTimeout decision, written down either way
  timeoutSeconds?: number;      // present exactly when applied
  timeoutReason?: string;       // "aggregate-verification" | "explicit-timeout" | "disabled" | "invalid-configuration-defaulted"
  commandDigest?: string;       // a digest, never the command
  commandLength?: number;       // a bounded counter
}
```

**The arguments are deliberately not persisted**, and this is a constraint rather than an oversight:
`quality-guidelines.md` requires that black-box evidence retain "digests, event types, and bounded counters, but never
persist raw prompts, tool arguments, credentials, or absolute local paths". The join to *what was run* is by
`toolCallId`: the host's own session transcript holds the command - this session's run proved it does, which is how the
hung `find` is now known at all - and the ledger's job is to name the call so the two records can be joined.

**The relation is the reading.** `projectExecutionDiagnostics` gains the same shape it already gives requests:

```ts
toolCallsStarted: number;
toolCallsObserved: number;
unterminatedToolCalls: readonly string[];   // started ids with no tool.observed, in order, bounded
```

`unterminatedRequests` is the precedent this copies: a request received with no terminal already has a name, a counter
and a list (`tests/execution-diagnostics-unterminated.test.ts`), and a tool call that has not returned is the same
claim one level down.

## Data flow

```
tool_call  ─ gate ─┬─ applyAdaptiveShellTimeout  (decided here, today written nowhere)
                   └─ appendToolStarted          (tool, toolCallId, the decision)   ← NEW
tool_result ──────── appendToolObserved           (unchanged, only when isError !== true)
read ─────────────── projectExecutionDiagnostics: started − observed = unterminatedToolCalls
                    /status + agent_doctor: the count, when it is non-zero
```

## What stays unchanged, and how that is shown

- **No command's behaviour changes.** `applyAdaptiveShellTimeout` is not touched. Its existing cases in
  `tests/pi-adapter.test.ts:38-64` must stay green untouched, and that is the check that this is a reading and not a
  behaviour change.
- **`tool.observed` is not touched**, so every existing consumer of it - `failure-reading`, the audit summary, the
  observable citation at `:2983` - sees exactly what it saw before.
- The change is additive: a reader that ignores `tool.started` is unaffected, and a ledger written before this change
  simply has no started records, so `unterminatedToolCalls` is empty rather than wrong.

## Verification

| Check | Command | What it settles |
|---|---|---|
| Types | `npm run typecheck` | the new kind is in the closed set and the new projection fields are typed |
| The decision is recorded | `node --import tsx --test tests/pi-adapter.test.ts` | a `tool_call` for a whitelisted command writes `timeoutApplied: true` with its seconds; an unlisted one writes `timeoutApplied: false` with its reason |
| The pairing | `node --import tsx --test tests/execution-diagnostics.test.ts` | started-without-observed appears in `unterminatedToolCalls`; a matching observed clears it |
| Nothing regressed | `npm test` | including `tests/harness-reachability.test.ts`, which requires every kind in the closed set to have a writer |
| The spec | `tests/spec-anchors.test.ts` and `document-drift` | the citations this change writes resolve |

**The reproducer needs no real provider.** R4 asks for the measured sequence without another provider run, and a
deterministic case can produce the same shape: drive the extension's `tool_call` handler for a `bash` call and never
deliver `tool_result`, then read the ledger - one started record, no observed record, one unterminated call. That is
the hang's structure without the six-minute wait.

## Rollback

One commit. The record is additive and nothing persists a migration: `git revert` restores the previous behaviour, and
the ledgers written meanwhile stay readable because a kind nothing writes is a kind nothing must handle.

## Open decision this design does not take

**Whether to bound the wait as well** (route 2). Recommended: **not in this change.** The reading is what the PRD's
own Goal names as the smaller and more accurate target, and a bound is a behaviour change that has to re-argue the
contract's deliberate choice. If the operator wants the flow to *complete* rather than *explain*, that is the next
task, and it should start from this reading rather than instead of it.
