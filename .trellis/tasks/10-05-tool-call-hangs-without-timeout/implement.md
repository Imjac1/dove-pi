# Implement: record a tool call that has not returned

## The one ordering constraint that decides the whole change

**The writer goes after the last blocking return in the `tool_call` handler, not where the timeout is decided.** That
handler refuses calls in several places (`extension.ts:2681`, `:2800`, `:2847`, `:2865`, and the policy gate after
`normalizeLsToolInput`). A `tool.started` record written before those returns would leave an "unterminated" call behind
for every *refused* call - a reading that counts refusals as hangs, which is worse than the silence it replaces. The
timeout decision is computed at `:2763` and is needed by the record, so pass it forward to the writer rather than
writing twice.

## Ordered checklist

- [ ] **1. The vocabulary.** `src/core/contracts.ts:90` - add `"tool.started"` to `ExecutionRecordKind`. Run
      `npm test` and **expect `tests/harness-reachability.test.ts` to go red**: a kind in the closed set with no writer
      is exactly what that door exists to catch. Keep the red observed, then proceed.
- [ ] **2. The writer.** `src/core/execution-ledger.ts` - `appendToolStarted` beside `appendToolObserved` (`:595`),
      same correlation shape, with `details` as `design.md` specifies. **No command, no path** - a digest and a bounded
      length only.
- [ ] **3. The call site.** `src/pi-adapter/extension.ts` - one write, after the last blocking return, carrying
      `tool`, `toolCallId`, and the `applyAdaptiveShellTimeout` decision computed at `:2763`. A refused call writes
      nothing.
- [ ] **4. The projection.** `src/core/execution-ledger.ts:411` - a `tool.started` case beside `tool.observed`,
      collecting started ids; then `toolCallsStarted`, `toolCallsObserved` and `unterminatedToolCalls` on the
      projection, copying the `unterminatedRequests` shape (bounded list, in ledger order). **A record nothing reads is
      not a reading** - this step is not optional.
- [ ] **5. The readers.** `src/pi-adapter/extension.ts` - the `/status` line (`:1238`-`:1250`, where `workMode` and
      the tool surface already print) and `agent_doctor` (`:1959`-`1960`). Print the count **only when it is
      non-zero**, so a normal session's line does not grow a field that is always zero.
- [ ] **6. The failure reading.** `src/core/failure-reading.ts` (`:258`, `:318`) - an outstanding call is a stronger
      fact than "no tool.observed record", and the reading should name it before falling back to the weaker sentence.
- [ ] **7. The spec.** `.trellis/spec/backend/error-handling.md:28-39` - §"Aggregate shell timeout contract" gains the
      declared-absence half: every shell call now states whether a timeout was applied, and the reading names a call
      that has not returned. Do not restate the whitelist as a count of its members (`quality-guidelines.md`, "a count
      of something the code declares").
- [ ] **8. The cases.** `tests/pi-adapter.test.ts` - a whitelisted `tool_call` records `timeoutApplied: true` with its
      seconds; an unlisted one records `timeoutApplied: false` with its reason; **a refused call records nothing**.
      `tests/execution-diagnostics.test.ts` - a started record with no matching observed appears in
      `unterminatedToolCalls`, and a matching observed clears it.

## The reproducer, without a provider

Drive the extension's `tool_call` handler for a `bash` call and **never deliver `tool_result`**, then read the ledger:
one `tool.started`, no `tool.observed`, one unterminated call. That is the shape measured twice in the field
(`19:08:37.113` and `16:50:59.355`) without waiting six minutes or calling a provider. The existing suite already
builds a fake `ExtensionAPI` and drives tools off the registry, so this needs no new harness.

## Validation commands

```powershell
npm run typecheck
node --import tsx --test tests/pi-adapter.test.ts
node --import tsx --test tests/execution-diagnostics.test.ts
npm test
```

## Risky files and rollback points

| File | Why it is risky | Rollback |
|---|---|---|
| `src/pi-adapter/extension.ts` | The `tool_call` handler is the gate; a writer placed before a blocking return counts refusals as hangs. Its line numbers are cited by `personal-agent-use-time-architecture.md`, whose mount table `tests/spec-anchors.test.ts` checks **by content** - so that page's citations move with this change and must be shifted in the same commit | single point, `git revert` |
| `src/core/execution-ledger.ts` | The projection is consumed by `/status`, `doctor` and the audit summary; the new fields are additive, and `failure-reading.ts:318` reads the *absence* of `tool.observed`, which this change does not alter | single point |
| `src/core/contracts.ts` | The kind set is checked in both directions by `harness-reachability` | one line |

## Before `task.py start`

- [ ] `prd.md`, `design.md` and this file reviewed, and the route decision (route 3, route 2 deferred) accepted.
- [ ] Repo green: `npm run typecheck` 0 and `npm test` all passing.
- [ ] The two red-first observations are planned rather than assumed: `harness-reachability` red at step 1, and the
      pairing case red before step 4 lands.
- [ ] The citation shift is expected, not discovered: this change inserts lines above the mount points in
      `extension.ts`, so `personal-agent-use-time-architecture.md` moves by the number of lines inserted. Measure it,
      do not assume the delta.
