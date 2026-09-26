# The host's hook surface, read from the installed types

Written 2026-09-26 to close the three follow-up checks `implement.md` lists before `task.py start`.
The source is the host's own extension API surface as installed in this repository, not documentation:

```text
node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts
```

Every claim below cites a line in that file, or a line in this repository. Nothing here is inferred from a
neighbouring platform.

## Check 1: is there a pre-tool-call boundary that can refuse, on arguments and not only on a tool name?

**Yes, on arguments.** `types.d.ts:922`:

```typescript
on(event: "tool_call", handler: ExtensionHandler<ToolCallEvent, ToolCallEventResult>): void;
```

`ToolCallEvent` is **typed per tool**, not a bare name plus a blob (`types.d.ts:663-709`): a discriminated
union over `bash | powershell | read | edit | write | grep | find | ls`, plus `CustomToolCallEvent` whose
`input` is `Record<string, unknown>`. `isToolCallEventType("bash", event)` narrows to
`event.input.command` (`types.d.ts:766-771`).

The refusal is a returned result, not a thrown error (`types.d.ts:803-812`):

```typescript
interface ToolCallEventResult { block?: boolean; reason?: string; terminate?: boolean; }
```

And the host already runs two handlers on this event: `src/pi-adapter/extension.ts:1975` registers a
`tool_call` handler whose body ends at `:2049`, and it already returns `{ block, terminate, reason }` for
Dove's convergence guard and progress guard. **So this repository is already enforcing an unrelated policy at
exactly this seam.** The gate is not a new integration; it is a third opinion at a seam that already has two.

## Check 2: is there any hook that could contain the host's own subprocesses?

**No. The answer is no, and C1 therefore stays a stated limitation** - which is precisely the condition
`implement.md` attaches to it ("C1 is a stated limitation only while the answer is no").

The whole blockable surface, from the `on()` overload list (`types.d.ts:898-925`):

| Event | Results accepted | Can refuse? |
|---|---|---|
| `tool_call` (:922) | `ToolCallEventResult` | **yes** |
| `tool_result` (:923) | `ToolResultEventResult` | rewrites a result already produced |
| `user_bash` (:924) | `UserBashEventResult` | substitutes *execution of a user-typed command* |
| `tool_execution_start/update/end` (:917-919) | **none** | no - observational only, they cannot block |
| `before_provider_request`, `input`, `context`, `message_end`, ... | various | not a process boundary |

Two of these deserve to be stated rather than skipped:

- `user_bash` is not a tool. `types.d.ts:629-637` defines it as firing when **the user** executes a command
  via `!` or `!!`. Its result can supply `operations` or a full replacement `result`
  (`types.d.ts:813-819`), so it can *substitute* the execution of a user-typed shell. That is a containment
  seam for the human's shell and for nothing the model does.
- `tool_execution_start` carries `args` (`types.d.ts:592-598`) and still cannot refuse: no result type is
  declared for it in the overload. It is the event that would be needed to observe a process that a tool has
  already spawned, and it is the wrong side of the decision.

There is no hook that wraps the children of a tool that has already started. The gate is necessarily
pre-dispatch. C1 is real, unfixable at this layer, and must be documented as such - see `design.md:359`.

## Finding 3 (new): a `tool_call` handler may rewrite the arguments, and nothing re-validates

`types.d.ts:703-708`, verbatim:

```text
Fired before a tool executes. Can block.

\`event.input\` is mutable. Mutate it in place to patch tool arguments before execution.
Later \`tool_call\` handlers see earlier mutations. No re-validation is performed after mutation.
```

This is a gate-relevant host property, and it is the failure this project has already named twice: **a gate
whose decision is computed once and then lets execution proceed is bypassable by whatever changes the input
after it.** A handler registered later - by a third-party plugin, of which this install has many - can mutate
`event.input` and no re-validation runs.

Consequences for M2, which must be decided before implementation rather than discovered in it:

1. The gate must **re-read the input it is about to permit**, or treat mutation as a re-validation trigger.
   Trusting its own earlier decision is exactly "an approval gate re-executes whatever sits before it".
2. C3's real form on this host is not only "deny must beat allow" - it is also **"the decision must not depend
   on handler order"**. Registration order is not contractual here.

## Finding 4: `terminate` is batch-scoped, so "blocked" is not "stopped"

`types.d.ts:807-811`: early termination "only happens when every finalized tool result in the batch sets this
to true". A gate that blocks one call does not end the run. M2's validation must not conflate the two; typed
termination is M7's, not the gate's.

## What this changes in the plan

**M2's seam, decided here: one policy, two adapters.** Evaluate the gate policy where the information is
widest - `tool_call`, which sees a `bash` command string and an `edit` path and a `write` body - and make the
capability `authorize` callback **delegate to that one policy** rather than answer separately. Two answers to
one question is the first risk the PRD names ("two implementations of one contract is the failure mode this
project keeps producing").

The two current statements are each true and each narrower than they read:

- `design.md:27` and `design.md:349` place the gate policy at the `authorize` callback
  (`extension.ts:1332`). That callback receives `{ name, version, sideEffects, args }` **of Dove's own
  capability tool** - it never sees a `bash`, `edit` or `write` call, so a policy that lives only there
  cannot cover the tools that move files.

**Coordinates are stale by one commit.** `extension.ts:1333` is now `:1332`; every coordinate in
`design.md` and `implement.md` was taken before this task's own commits. M1 and M2 must re-resolve them
before editing, and the re-resolution belongs in the diff.

## Verified in the current tree

| Claim | Command | Result |
|---|---|---|
| the dispatch line | `src/core/loop-runner.ts:135` | `const raw = await options.executeTool(call, signal);` - exact |
| the live gate | `src/pi-adapter/extension.ts:1332` | the zero-parameter `authorize` lambda, closing over `definition` and ignoring the `args` its caller passes |
| the existing `tool_call` handler | `src/pi-adapter/extension.ts:1975` | registered; returns `{ block, terminate, reason }` at `:2013`, `:2039-2043` |

## What this does not establish

- Whether the host calls `tool_call` handlers in a documented order. The types do not say; finding 3 says
  order matters, so this is the thing to probe first in M2.
- Whether the executor re-reads `event.input` after the last handler returns. The type docs say later
  *handlers* see earlier mutations; they do not say the *executor* does. One probe settles it.
- Whether a third-party plugin in this install already registers a `tool_call` handler. **Answered: none
does.** A recursive search of `node_modules` and this repository finds exactly one registration in the
  install - `src/pi-adapter/extension.ts:1975` - plus five in the host's own `examples/`, which are not
  loaded. So finding 3's mutation hazard is currently latent rather than live, and the gate is the second
  handler on this event rather than the third.

## Vendor prior art for this exact hook, already installed

The host ships two reference extensions that are the shape M2 needs, and they are in this install rather than
in documentation:

```text
node_modules/@earendil-works/pi-coding-agent/examples/extensions/permission-gate.ts    block on a bash command pattern
node_modules/@earendil-works/pi-coding-agent/examples/extensions/protected-paths.ts    block a write/edit to a path
```

Both confirm the API in practice, and both are the two policy axes M2 needs (a command and a target path):
`pi.on("tool_call", async (event, ctx) => ...)`; `event.input.command` for `bash`; `event.input.path` for
`write` and `edit`; return `{ block: true, reason }` to refuse and `undefined` to permit.

Two details worth taking rather than rediscovering:

1. `permission-gate.ts` blocks **by default when there is no UI** (`if (!ctx.hasUI) return { block: true, ... }`).
   The vendor's own gate is fail-closed, which is independent support for C2 and for this repository's
   "a gate that cannot evaluate blocks".
2. Both examples **return early on the tools they do not own** (`if (event.toolName !== "bash") return
   undefined;`). That is the delegation shape M2 should follow: the gate answers for the axes it holds and
   stays out of the rest, rather than becoming a second review of every call.
