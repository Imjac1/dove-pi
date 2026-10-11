# The provider stream that ended early, and the rule written for a word nothing delivers

**This file exists because a fix that reads as a control is worse than no fix.** The tenth whole-flow run (2026-10-11) died on
a provider round that lasted **176 s** and was classified `unknown`. The rule that was supposed to cover exactly this event
had been added five days earlier, and it could never be reached.

## 1. What the run recorded

| Record | Value |
|---|---|
| `provider.request.completed` (last) | `stopReason: "error"`, `durationMs: 176041`, `usage` all zero |
| the same record's failure half | `failureKind: "terminal"`, `failureReason: "unknown"` |
| `request.attempt.completed` | `outcome: "failed"`, `failureReason: "unknown"` |
| `request.terminal` | `failed`/`unknown`, `code: provider-unknown`, `retryable: false`, `policyAbort: true` |
| the terminal's `nextAction` | *"Inspect the provider error and adjust the request."* |
| the session's last assistant message | `stopReason: "aborted"`, `errorMessage: "terminated"`, `usage` all zero |

**The terminal tells the operator to inspect a provider error the ledger does not hold.** That sentence was written five days
earlier, in the same task, as the reason for a fix.

## 2. Which writer produced that record, argued from the record itself

`appendProviderRequestCompleted` has exactly two call sites (`extension.ts:2573`, `:3095`), and the record discriminates
between them without reading either:

- `:2573` passes `usage: call.httpStatus === undefined ? undefined : { httpStatus }` and `failure: lastProviderFailure`;
- `:3095` passes `usage: observed.usage` and `failure: the classification`.

The record's `usage` is a **token object of zeros** and it carries a `failure`, so it came from `:3095` - the `message_end`
handler. And there, `stopReason` is `normalizeStopReason(observed.stopReason)`.

⇒ The host's raw token was from `normalizeStopReason`'s failed set (`error`, `failed`, `failure`) - **not** `aborted`, which that
normalizer maps to `cancelled`.

## 3. The line, and why it could not be reached

```ts
// extension.ts, before the change
const stopReason = String(value.stopReason ?? "").trim().toLowerCase();
if (stopReason === "aborted") return { kind: "transient", reason: "reviewed-provider-message" };
return classifyProviderFailure({ category: "unknown" });
```

Both call sites reach the classifier only when the **normalized** reason is `error` (`:2429`, `:3091`), and the normalizer maps
`aborted` to `cancelled` (`model-gateway.ts:61`). So the raw token handed over is always from the failed set, and the
comparison the fix added **was never true**. It read as a control while nothing reached it.

Measured against the real function before the change:

```text
{"stopReason":"error"}                      -> {"kind":"terminal","reason":"unknown"}   ← the run's own values
{"stopReason":"failed"}                     -> {"kind":"terminal","reason":"unknown"}
{"stopReason":"aborted","errorMessage":"terminated"} -> {"kind":"transient","reason":"reviewed-provider-message"}
{"stopReason":"error","errorMessage":"HTTP 502"}     -> {"kind":"transient","reason":"http_502"}
```

The first line reproduces the ledger's two fields exactly, which is what closes the chain: the diagnosis is the function's own
output, not an inference about it.

## 4. The shape, stated plainly

**The same host event is classified two ways depending on which of its words arrives.** When the provider sends nothing usable
in `errorMessage`, a stream that ended before its response is `terminal/unknown` if the token is `error`, and `transient` if it
is `aborted` - and only the second was covered.

## 5. What was changed, and what that changes in behaviour

The rule now reads the whole failed set (`aborted`, `error`, `failed`, `failure`), still **after** the text rules, so a message
that says `429`, `Connection error.` or `aborted by the user` is classified above it and never reaches it.

**Behaviour that changes, stated so it can be reversed deliberately:** a provider round that fails with a bare failed-stream
token now counts as a transient failure and is retried, up to the attempt limit, instead of ending the request. Bounded and
fail-closed, by the two guards that already exist and are untouched:

- `RequestLifecycleController.retryDecision` (`request-lifecycle.ts:295-300`): a transient is retried only while
  `attemptCount < maxAttempts`, and the terminal at the limit is `provider-attempt-limit` with `retryable: true` and a next
  action that can be followed;
- the non-idempotent effect guard (`extension.ts:2626-2627`) refuses the replay independently of the classification, so this
  does not make a started effect replayable.

**What is not claimed**: that every bare failed-stream token is a transport fault. With no text, the cause is unknown; what is
known is that the request cannot be answered either way, and the contract's own stance for that case is a bounded retry, not a
terminal pointing at nothing.

## 6. The tax this round paid

The change sits above every mount point, so all 18 rows of the mount table moved by **+12**, and
`tests/spec-anchors.test.ts` caught it - **the third time that door has paid for an edit of this file**. The rest of the page's
citations moved with them, and one did not merely shift: the §3 range `:2797`-`:2801` was cited for "the half that reads
arguments", and it holds the end of the gate block plus the shell-timeout lines. It is `:2734` now, which is where
`classifyInvocation` actually reads `event.input`.
