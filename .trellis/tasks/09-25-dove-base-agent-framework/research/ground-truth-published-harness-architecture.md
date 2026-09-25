# Ground truth: published harness architecture (0.87.1)

- Query: How large and how stable is the published Pi runtime, if adopted as a base?
- Scope: official published package, measured from the unpkg file manifest
- Date: 2026-09-25
- Sources:
  - `https://unpkg.com/@earendil-works/pi-agent-core@0.87.1/dist/harness/?meta` (HTTP 200)
  - `https://unpkg.com/@earendil-works/pi-agent-core@0.87.1/dist/harness/execution/effect-gate.d.ts` (HTTP 200)

## Size

**108 `.js` files, 942,743 bytes (~921 KB)** under `dist/harness/` alone. This excludes
`dist/agent.js`, `dist/agent-loop.js`, `dist/proxy.js`, `dist/search/`, and every
transitive dependency.

By subsystem:

| Subsystem | Files | Size |
|---|---|---|
| `runtime/` | 21 | 247 KB |
| `pico3/` | 24 | 243 KB |
| `session/` | 29 | 209 KB |
| top level | 12 | 78 KB |
| `tools/` | 10 | 42 KB |
| `compaction/` | 3 | 35 KB |
| `env/` | 1 | 31 KB |
| `utils/` | 5 | 24 KB |
| `execution/` | 3 | 10 KB |

Largest single files: `runtime/lane.js` 73 KB, `pico3/session.js` 57 KB,
`session/testing/conformance/session-repo.js` 46 KB, `runtime/drive/structural.js` 42 KB,
`session/testing/conformance/storage.js` 33 KB, `env/nodejs.js` 31 KB,
`pico3/harness.js` 29 KB.

## Finding 1: two parallel harness stacks ship in the same package

- `runtime/` - 247 KB, including `lane.js` (73 KB), `harness.js`, and a `drive/`
  sub-tree (`boundary`, `checkpoint`, `deferred`, `generation`, `reconcile`,
  `recovery`, `response`, `retry`, `structural`, `terminal`, `tool-placement`,
  `tools`).
- `pico3/` - 243 KB, including `session.js` (57 KB), `harness.js` (29 KB),
  `scheduler.js` (19 KB), `view.js` (17 KB), `kinds/` (`generation`, `tool`,
  `collapse`, `job`, `chord`, `post-tools`, `plugin`, `frames`, `entries`,
  `task-api`), plus `membrane.js`, `memory.js`, `jsonl.js`, `system.js`,
  `bounded.js`, `context.js`.

The public constructor wires the `runtime/` stack:
`agent-harness.js` does `import { createAgentHarness } from "./runtime/harness.js"`.
`pico3/` is **not referenced** from that entry point.

**Unverified**: which stack is canonical, which is the newer rewrite, and whether
`pico3/` is dead code, an internal-only path, or the next public surface. Two ~250 KB
harness implementations coexisting in one pre-1.0 package is a material API-stability
risk for anyone adopting it as a base.

## Finding 2: `effect-gate` is a cancellation gate, not an approval gate

This matters because the name invites the wrong conclusion. Verbatim, in full, from
`dist/harness/execution/effect-gate.d.ts`:

```typescript
/** Expected internal control flow when cancellation wins effect admission. */
export declare class AbortRequested extends Error {
    readonly cancellation: Promise<void>;
    constructor(cancellation: Promise<void>);
}
/** Procedure-facing synchronous admission capability for one drive pass. */
export interface Gate {
    readonly signal: AbortSignal;
    admit<T>(invoke: () => T): T;
}
/** Owner-facing lifecycle controls for one drive pass. */
export interface GateControl {
    beginAbort(cancellation: Promise<void>): void;
    signalAbort(): void;
    close(error: Error): void;
}
/** Create separate procedure-facing and owner-facing views of one effect gate. */
export declare function createGate(): { gate: Gate; control: GateControl };
```

The whole module is 1,626 bytes of JavaScript. It answers "has this drive pass been
aborted, and may this effect still start?" It does **not** answer "is this effect
authorized?". There is no policy, no approval state, no deny reason.

So Pi ships:
- a **cancellation** gate (`effect-gate`), and
- a **blocking callback** the caller owns (`beforeToolCall` -> `{ block, reason }` in the
  thin loop), and
- a **screening** pattern in the vendor's own guidance (Anthropic's guardrails as
  parallelization/sectioning).

It does **not** ship an authorization gate. That remains the framework author's job -
which is exactly the gap `09-06-dove-workspace-modes-context-isolation` deferred as
"New permission or approval systems for authorized security work".

## Finding 3: the session layer is heavily specified

`session/testing/conformance/` contains 81 KB of conformance suites
(`session-repo.js` 46 KB, `storage.js` 33 KB), plus benchmark and instrumented-storage
harnesses. Whatever session semantics the framework needs, this package already defines
and tests them - and a from-scratch framework would have to rediscover those cases.

## Implications for build vs adopt

| Path | Cost | Inherited opinions |
|---|---|---|
| Thin `Agent` + own mechanics | Re-implement session, resume, compaction, lanes, telemetry | none |
| Adopt published harness (0.87.x) | Upgrade `pi-coding-agent` + `pi-tui` from 0.84.3; accept a ~921 KB subsystem with two parallel stacks | session format, skill model, system prompt construction, telemetry schema, tool set, drive semantics |

The size and the dual-stack finding argue that adopting the published harness as "my base
framework" means inheriting someone else's framework, not owning one. The user's stated
intent is to own the base and layer verticals on it.

## VERIFIED (follow-up): `effect-gate` implementation, and the two-stack resolution

The published tarball was downloaded (`npm pack @earendil-works/pi-agent-core@0.87.1`,
994,229 bytes) and read locally after CDN fetches timed out.

### `dist/harness/execution/effect-gate.js`, verbatim and complete

```javascript
/** Expected internal control flow when cancellation wins effect admission. */
export class AbortRequested extends Error {
    cancellation;
    constructor(cancellation) {
        super("Abort requested");
        this.name = "AbortRequested";
        this.cancellation = cancellation;
    }
}
/** Create separate procedure-facing and owner-facing views of one effect gate. */
export function createGate() {
    let state = { status: "open" };
    const controller = new AbortController();
    const check = () => {
        if (state.status === "aborting")
            throw new AbortRequested(state.cancellation);
        if (state.status === "closed")
            throw state.error;
    };
    return {
        gate: {
            admit(invoke) {
                check();
                return invoke();
            },
            signal: controller.signal,
        },
        control: {
            beginAbort(cancellation) {
                if (state.status !== "open")
                    return;
                state = { status: "aborting", cancellation };
            },
            signalAbort() {
                if (state.status !== "aborting" || controller.signal.aborted)
                    return;
                controller.abort(new AbortRequested(state.cancellation));
            },
            close(error) {
                if (state.status === "closed")
                    return;
                state = { status: "closed", error };
                if (!controller.signal.aborted)
                    controller.abort(error);
            },
        },
    };
}
```

**Confirmed by reading the implementation: this is a three-state cancellation gate**
(`open` -> `aborting` -> `closed`). `admit(invoke)` only checks whether the pass was
aborted or closed, then runs the callback. There is no policy evaluation, no approval
state, and no deny path. Calling it a "gate" is about *effect admission under
cancellation*, not about *authorization*.

### The two stacks: `pico3` is explicitly experimental

`package.json` exports `"./experimental/pico3"`, and `pico3/index.js` states:

> Experimental Pico3 kernel API.
>
> This subpath is intentionally separate from the package root while the kernel
> and its Chord integration are being validated.

So `runtime/` is the supported stack (wired by `createAgentHarness`) and `pico3/` is an
opt-in experimental kernel. Not dead code, not the default - but evidence that the
package is mid-rewrite.

## Caveats / Not Found

- Sizes come from the unpkg manifest and were confirmed against the extracted tarball.
  They are byte counts of compiled JavaScript, not complexity or quality measures.
- `env/nodejs.js` (31 KB) is a full Node execution environment (FileSystem/Shell). Its
  sandboxing properties were not examined, and sandboxing is decision-critical for the
  pentest vertical.
- `pico3/` internals were not read beyond its entry point. Its exported error taxonomy
  includes `Forbidden` and a `ReadAfterWrite` guard, which the supported `runtime/`
  stack does not expose - whether the experimental kernel has a real authorization
  concept is **unverified and worth a look**, because it is the one place in this
  package where a deny path may already exist.
