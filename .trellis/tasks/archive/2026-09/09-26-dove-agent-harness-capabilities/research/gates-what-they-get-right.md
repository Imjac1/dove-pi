# The gates: what they already get right, and the surface they cannot see

- Date: 2026-09-26
- Method: read `src/core/gate-limit.ts` (107 lines) and `src/core/gate-conformance.ts` (62 lines) in full,
  then held them against `design-constraints-from-evidence.md` C1-C7, which was derived from CVEs and
  shipping products independently of this code.

## They are ahead of the surveyed field on the constraint that matters most

C2 says a gate that cannot evaluate must fail closed or ask, and the research found that **every shipping
product surveyed fails open** on a hook timeout or crash: Claude Code's `PreToolUse` "continues through the
normal permission flow" and a malformed hook stdout is "a non-blocking error: the action proceeds"; Cursor
fails open by default with fail-closed as per-hook opt-in.

Both of these gates already fail closed, and they state the reason in the code rather than inheriting it:

> A limit gate that passes when it cannot find the value it is supposed to check is worse than no gate,
> because it looks like one. — `gate-limit.ts`

Mechanically: an argument that is absent, non-numeric or non-finite is a **block**; a limit declared with
neither `max` nor `min` is rejected **at construction**, because it "can never decide anything"; and a
conformance mapping that cannot produce a request is a block, on the stated grounds that "'cannot tell' is
not 'allowed'". Codex's `GranularApprovalConfig` - auto-reject rather than queue - was the best shipping
precedent the research found, and this code already behaves that way.

They also satisfy **C4** by construction: `SynchronousActionGate.evaluate` returns a decision, so the check
completes before the effect. The OpenAI Agents SDK's `run_in_parallel` default, whose own docs admit the
tripwire "may fire after tools executed", is not a shape this code can take.

## The two semantics are not redundancy, and the code says why

Each maps to a real vertical's regulatory requirement, cited:

- `gate-limit.ts` - **SEC Rule 15c3-5**, pre-trade controls that "prevent the entry of orders that exceed
  appropriate pre-set credit or capital thresholds, or that appear to be erroneous". A threshold check:
  "an in-scope action can still be blocked here, and that is the point."
- `gate-conformance.ts` - **NIST SP 800-115**, where Rules of Engagement grant authority "without the need
  for additional permissions", making the gate a **contract checker rather than an approval prompt**. "What
  it stops is deviation from the agreed scope, not every action."

And the reason both must exist is written down: **"A framework offering only one of the two forces the
other vertical to bypass it."** That is the correct generalisation, and the research did not produce it -
the research only measured that products disagree about gate semantics.

## The surface they cannot see

**Every gate here is keyed on a model tool call.** The signature is the whole story:

```typescript
evaluate(invocation: GateInvocation): GateDecision      // { tool, arguments }
```

C1 was derived from six named bypasses, and **not one of them bypassed a tool call**:

| Bypass | The route |
|---|---|
| CVE-2026-55607 (Claude Code) | the harness's **own `git`**, run outside the sandbox; `.git` hardening covered only the root |
| CVE-2025-59532 (Codex <0.39.0) | a **model-generated `cwd`** consumed as the sandbox's writable root |
| Overpatch (Codex `apply_patch`) | "grants write access to the **parent folder of each path**" - `/tmp` granted `/`, no prompt |
| Heapjack (Codex `node_repl`) | trusted and untrusted JS **share one V8 heap**; read via `v8.getHeapSnapshot()` |
| Beltdown2 (Cursor CLI) | the harness's internal `git`, unsandboxed, honouring `core.fsmonitor` |

Three consequences for the design, and they are requirements rather than observations:

1. **A tool-call gate is necessary and not sufficient.** The boundary must also cover the processes the
   harness starts on its own behalf - indexing, patching, spawning.
2. **No model-influenced value may be the frame the checking happens in.** A cwd, a path list, a patch
   target are inputs to be checked. CVE-2025-59532 is what happens when one becomes configuration.
3. **A permit must not widen a scope.** The Overpatch shape - authorising a file write and thereby
   authorising its parent directory - is a scope bug that a per-call gate cannot detect, because each call
   looks in bounds.

## What this means for the plan, concretely

The existing gates are **correct and incomplete**: right semantics, right defaults, wrong coverage. That is
a different work item from "wire the gates". Wiring them today would give this project the best
fail-closed tool-call gate in the survey **and leave every published bypass open**, because the bypasses are
not tool calls.

So the design question is not "wire or rewrite". It is: **what is the boundary that contains the harness's
own subprocesses, and where does it sit relative to the loop.**

## Not established

- Whether `loop.ts` can be overridden once the gates are in it (C3). That is a `loop.ts` question and
  `loop.ts` was not read at this depth.
- Whether the harness currently starts subprocesses of its own. It has a `shell.exec` capability and the
  Pi host does the spawning, so the answer depends on the host, and the host is not in this repository.
- Whether any of these gates is correct in behaviour rather than in intent. They are read, not executed;
  their tests pass, which this project has already learned is weak evidence.
