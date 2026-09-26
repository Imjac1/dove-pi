# The live gate: what it actually is, and the seam that already exists

- Date: 2026-09-26
- Method: `grep` + targeted reads. **`tools.read` truncates a large file** - it returned 805 lines for
  `src/pi-adapter/extension.ts`, which is 2736 lines and 168,852 bytes. Every claim below was confirmed by
  a second method after that error.

## Two corrections I made to myself while writing this

**First**: I claimed the live layer had *no* entry gate. It has one.
**Second**: I then claimed `approval: "granted"` at `extension.ts:1351` made the gate a no-op, because the
caller writes its own approval. **That is false**, and the code says so at `fast-path.ts:51`:

```typescript
const approved = authorization.authorize
    ? await authorization.authorize({ name, version: capability.version, sideEffects: capability.sideEffects, args })
    : false;                       // <-- absent callback means NOT approved
if (!approved) { ... outcome: "approval_denied" ... }
```

The same default is in `capability-invocation.ts`: `return this.options.authorize ? await this.options.authorize(request) : false`.

So the live path is **fail-closed**, and it **does** gate side-effecting capabilities
(`if (authorization.required && hasSideEffects)` at `fast-path.ts:46`). `request.approval` is a
precondition, not the decision. I nearly reported the opposite twice, from a rendering artefact and from a
truncated read.

## What the live gate is

`src/pi-adapter/extension.ts:1328-1334` builds the invocation service with:

```typescript
authorize: async () => !(runtimeReadOnly() && definition.sideEffects.some((effect) => effect !== "read_only")),
```

and the comment above it states the intent:

> The Pi tool call is the host execution decision. Dove adds no second prompt; explicit read-only mode
> remains a user-owned switch.

**That is a defensible design**, and it is better than it first looks: the host's own permission UI is the
approval, and Dove declines to prompt twice. The gate cannot *fail open* because the callback is always
present on this path and is always consulted.

## But it can only answer one question

The callback receives `{ name, version, sideEffects, args }` and its implementation ignores everything but
`sideEffects`. So the only question the live gate can answer is:

> **Is this capability read-only?**

It cannot answer:

- is this order inside its declared notional limit? (that is `gate-limit.ts`, unwired)
- is this target inside the engagement's scope? (that is `gate-conformance.ts`, unwired)
- does this caller hold a grant for this action on this target? (that is `authority.ts`, unwired)
- is this action inside the agent's declared capability set? (that is `capability-scope.ts`, unwired)

## And the seam already receives what those questions need

```typescript
authorization.authorize({ name, version, sideEffects, args })
```

**`args` is passed.** The limit gate's whole input is a dotted path into an action's arguments; the
conformance gate's is an action and a target derived from the invocation. Both can be computed from what the
callback is already handed.

So the wiring is not a new boundary - it is a different implementation behind an existing callback that:

- is already on the path of every capability invocation,
- already fails closed when absent,
- already runs before the effect (`fast-path.ts:46-67` precedes `started` at `:72`),
- already records its decision to the ledger (`capability.blocked` with `reason: "approval_required"`,
  and `appendCapabilityApproved`),
- and already has a protocol status for refusal (`approval_denied`).

That is a better starting position than the research found in any shipping product: **Claude Code's hooks
fail open on timeout, Cursor's fail open by default, and OpenHands' analyzer is the model grading itself.**
This gate is structurally sound and semantically empty.

## What it still does not cover

From `design-constraints-from-evidence.md` C1, and this path does not change it: the gate is invoked
**per capability call**. The published bypasses (CVE-2026-55607, CVE-2025-59532, Overpatch, Heapjack,
Beltdown) went around the harness's own subprocesses - git indexing, patch application, a REPL parent. A
callback on the capability path cannot see those. So C1 remains open work, and it is about the process
boundary rather than about this callback.

## Also confirmed here

- `cli.ts:388`: `...(trustedCliApproval ? { authorize: () => true } : {})` - a trusted-CLI flag replaces the
  callback with a constant. It is opt-in and named, but it is a path where the gate becomes a constant, and
  it should be recorded as one.
- `adapters/mcp.ts:85`: `approval: needsApproval ? "unavailable" : "not_required"` - MCP never sends
  `"granted"`, so a side-effecting capability over MCP is refused by the precondition. Fail-closed by
  construction rather than by decision; worth stating so nobody "fixes" it.
- `extension.ts:1414`: `new CapabilityInvocationService(registry, ledger).discover()` builds a service with
  **no options at all** for discovery. Harmless for `discover()`, and a hazard if that instance is ever
  reused for `invoke()` - with no `authorize`, every side-effecting call is blocked, so the failure is
  safe.

## Not established

- Whether Pi's own tool-approval UI can express anything per-argument. If it can, the design question
  changes: the fine-grained check might belong there rather than in Dove.
- Whether `gate-limit` and `gate-conformance` are correct in behaviour. They are read, not executed.
