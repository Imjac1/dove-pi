# Technical Design: Dove Pi Native Subagent Dispatch

## Change Boundary

The missing behavior is not another dispatch heuristic. Core can already choose
`subagent`, but the runtime has no provider that turns that decision into an isolated
Pi child and no typed way to settle its result. The provider boundary belongs between
Core dispatch and the Pi host adapter.

Expected files:

- `src/core/subagent.ts`: bounded provider types, lifecycle state, and error normalization.
- `src/core/dispatcher.ts` and `src/core/execution-ledger.ts`: provider injection,
  explicit fallback, and one correlated completion.
- `src/pi-adapter/subagent-provider.ts`: Pi-only adapter over a fixed-argv child Pi
  runner. It may use the package's public EventBus only where the public schema is
  sufficient; it must not reach into another extension's private tool executor.
- `src/pi-adapter/extension.ts`: capability discovery, status/help, and formal-lane
  dispatch wiring.
- `tests/subagent.test.ts`, `tests/pi-subagent-provider.test.ts`, and the black-box
  harness: deterministic lifecycle and managed smoke coverage.
- `README.md` and `README.en.md`: user behavior and limitations.

Explicitly not included: hard token/time/tool budgets; automatic child writes;
worktree creation or merge; a second orchestration plugin; automatic provider/model
switching; Trellis runtime dependencies.

## Core Contract

```typescript
type SubagentCapability = "read" | "grep" | "find" | "ls";
type SubagentRunState = "launching" | "running" | "succeeded" | "failed" | "cancelled";

interface SubagentRequest {
  dispatchId: string;
  name: string;
  prompt: string;
  cwd: string;
  capabilities: readonly SubagentCapability[];
  provider?: { name?: string; model?: string; effort?: string };
}

interface SubagentLaunch { runId: string; provider: string; state: "launching" | "running"; acceptedAt: string; }
interface SubagentTerminal {
  runId: string;
  dispatchId: string;
  state: "succeeded" | "failed" | "cancelled";
  answer?: string;
  error?: { code: string; summary: string; retryable: boolean };
  usage?: { inputTokens?: number; outputTokens?: number; wallTimeMs?: number };
}

interface SubagentProvider {
  inspect(): Promise<{ available: boolean; provider: string; reason?: string }>;
  launch(request: SubagentRequest): Promise<SubagentLaunch>;
  collect(runId: string, signal?: AbortSignal): Promise<SubagentTerminal>;
  cancel(runId: string): Promise<SubagentTerminal>;
}
```

Core treats `collect` as a terminal wait owned by the provider. It does not poll
private extension files or parse raw model transcripts. A provider settles once per
dispatch; duplicate terminal frames are ignored after settlement.

## Pi Adapter Mapping

The adapter resolves the managed Pi CLI and launches one child with explicit argv:
`--mode text --print --no-session --tools read,grep,find,ls`. Provider/model hints are
passed only as validated options, and the prompt is passed as a separate argument so
shell interpolation is impossible. The child inherits user-owned auth configuration but
does not inherit ambient extensions, shell, network, write, or recursive-delegation
capabilities. `bg_run` alone is not a subagent provider because it is an arbitrary
shell boundary. A later public EventBus bridge may replace the runner without changing
the Core contract.

If the managed Pi executable or required CLI contract is unavailable, the adapter
returns unavailable with a versioned reason. It never calls a similarly named command
or fabricates success.

## Failure And Recovery

| Condition | Result |
|---|---|
| Provider unavailable before launch | Inline fallback and `provider_unavailable` detail |
| Launch accepted | `dispatch.started` with provider/run correlation |
| Child succeeds | One success completion with bounded answer reference |
| Child fails/cancels | One failed/cancelled completion preserving the reason |
| Duplicate terminal frame | Ignore after settled latch |
| Parent aborts before launch | No child; parent abort remains authoritative |
| Parent aborts after launch | Call provider cancel; never replay inline automatically |
| Malformed result | Failed completion with `malformed_result`; no partial answer |

Resource observations remain telemetry only and cannot trigger a route change,
checkpoint, or abort.
