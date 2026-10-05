# Implement: record a tool call that has not returned

## The one ordering constraint that decides the whole change

**The writer goes after the last blocking return in the `tool_call` handler, not where the timeout is decided.** That
handler refuses calls in several places (`extension.ts:2681`, `:2800`, `:2847`, `:2865`, and the policy gate after
`normalizeLsToolInput`). A `tool.started` record written before those returns would leave an "unterminated" call behind
for every *refused* call - a reading that counts refusals as hangs, which is worse than the silence it replaces. The
timeout decision is computed at `:2763` and is needed by the record, so pass it forward to the writer rather than
writing twice.

## Ordered checklist

- [x] **1. The vocabulary.** `src/core/contracts.ts:90` - add `"tool.started"` to `ExecutionRecordKind`. Run
      `npm test` and **expect `tests/harness-reachability.test.ts` to go red**: a kind in the closed set with no writer
      is exactly what that door exists to catch. Keep the red observed, then proceed.
- [x] **2. The writer.** `src/core/execution-ledger.ts` - `appendToolStarted` beside `appendToolObserved` (`:595`),
      same correlation shape, with `details` as `design.md` specifies. **No command, no path** - a digest and a bounded
      length only.
- [x] **3. The call site.** `src/pi-adapter/extension.ts` - one write, after the last blocking return, carrying
      `tool`, `toolCallId`, and the `applyAdaptiveShellTimeout` decision computed at `:2763`. A refused call writes
      nothing.
- [x] **4. The projection.** `src/core/execution-ledger.ts:411` - a `tool.started` case beside `tool.observed`,
      collecting started ids; then `toolCallsStarted`, `toolCallsObserved` and `unterminatedToolCalls` on the
      projection, copying the `unterminatedRequests` shape (bounded list, in ledger order). **A record nothing reads is
      not a reading** - this step is not optional.
- [x] **5. The readers.** `src/pi-adapter/extension.ts` - the `/status` line (`:1238`-`:1250`, where `workMode` and
      the tool surface already print) and `agent_doctor` (`:1959`-`1960`). Print the count **only when it is
      non-zero**, so a normal session's line does not grow a field that is always zero.
- [x] **6. The failure reading.** `src/core/failure-reading.ts` (`:258`, `:318`) - an outstanding call is a stronger
      fact than "no tool.observed record", and the reading should name it before falling back to the weaker sentence.
- [x] **7. The spec.** `.trellis/spec/backend/error-handling.md:28-39` - §"Aggregate shell timeout contract" gains the
      declared-absence half: every shell call now states whether a timeout was applied, and the reading names a call
      that has not returned. Do not restate the whitelist as a count of its members (`quality-guidelines.md`, "a count
      of something the code declares").
- [x] **8. The cases.** `tests/pi-adapter.test.ts` - a whitelisted `tool_call` records `timeoutApplied: true` with its
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

## Where the plan was wrong, and what the code found instead

**Step 1's red never happened.** The plan said `tests/harness-reachability.test.ts` would fail once the kind was in
the closed set and before the writer landed. It was measured: with nothing producing `tool.started` - the appending
writer's `kind:` temporarily changed to another existing kind - that door stayed **green**, because the kind string
also appears in comparison sites (`record.kind === "tool.started"`), which the walk counts as reaching it. So the
door cannot tell "written" from "compared against", and the row in `AGENTS.md` reading "has a writer" is stronger
than what it holds. Not fixed here - changing that walk touches every other row, which is its own decision.

**The writer sits behind a lease, which the first version of the case did not open.** Measured while debugging an
empty ledger slice with no error: `tool_call` returns at the `activeLease` guard unless a request is active, so a
case has to stage `before_agent_start` and `agent_start` first. That is always true in production - the host only
calls tools inside a turn - but a case that skips it writes nothing and the writer's own `catch` hides why.

**One assertion was moved into an existing case rather than built from nothing.** "A refused call writes no
`tool.started`" is asserted in the case that already drives a real refusal, because constructing one would have
been checking the fixture rather than the ordering.

## Outcome

`npm run typecheck` 0; `npm test` **949 / 949 pass, 0 fail** (the two new cases included); `npm run test:installer`
untouched. The citations this change moved in `personal-agent-use-time-architecture.md` were corrected by
measurement - eighteen mount rows and seven inline positions - because the insertion sits in two places, so the
shift is not one number.

## Before `task.py start`

- [x] `prd.md`, `design.md` and this file reviewed, and the route decision (route 3, route 2 deferred) accepted.
- [x] Repo green: `npm run typecheck` 0 and `npm test` all passing.
- [x] The two red-first observations are planned rather than assumed: `harness-reachability` red at step 1, and the
      pairing case red before step 4 lands.
- [x] The citation shift is expected, not discovered: this change inserts lines above the mount points in
      `extension.ts`, so `personal-agent-use-time-architecture.md` moves by the number of lines inserted. Measure it,
      do not assume the delta.
