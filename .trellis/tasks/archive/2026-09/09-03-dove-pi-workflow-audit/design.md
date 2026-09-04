# Design: Dove Pi 全工作流审计与使用指南

## Boundary

Keep the fix at the actual boundaries: `dove_pi.py` owns argument classification, `src/cli.ts` owns CLI dispatch/error serialization, `src/core/request-plan.ts` owns intent/lane/workflow classification, `src/pi-adapter/extension.ts` owns request-context lifecycle and interactive policy diagnostics, `src/managed-install-status.ts` plus CLI doctor own installed/source drift reporting, `src/project-provider/native-provider.ts` owns Legacy document prioritization, tests own isolated subprocess evidence, and README owns user-facing workflow documentation. No Pi permission, provider ownership, or policy-threshold changes.

## Data flow

```text
dove-pi arguments
  ├─ version/help → Python metadata/help
  ├─ install/update/repair/rollback/uninstall → ManagedInstaller
  ├─ known CLI (+ optional startup prefix) → node + tsx + src/cli.ts
  │   ├─ JSON CLI result/error on stdout
  │   └─ diagnostics/protocol errors on stderr where stdout is a stream
  └─ remaining Pi arguments → node Pi entry + managed extension
```

The CLI wrapper will be an async `main()` with one terminal catch. Errors are normalized to `{ok:false,error:{code,message}}`, with the command name included when useful; stack traces are not emitted. `rpc` and `mcp` retain stdout for protocol frames and send wrapper errors to stderr.

Request classification uses ordered semantic ownership: explicit read-only task inventory first, explicit workflow lifecycle action second, formal complexity third, and execution intent for tool/accounting last. Formal lane and execution intent may coexist, but lifecycle metadata must not be discarded when the action is explicit. Policy termination stays enforced at the current thresholds; the adapter adds one user-visible explanation and exposes the current plan/budget split in `/status full`.

Context omission is a per-request budget outcome, not a durable project snapshot. Only a successfully emitted snapshot may own `requestContextEpoch`; empty or budget-omitted attempts leave the epoch retryable for the next logical request while preserving message ordering within one request.

## Operation-abort attribution

Introduce one adapter-owned terminal envelope before any host abort:

```typescript
type AbortOrigin = "user" | "provider" | "model-budget" | "provider-round" | "progress-guard" | "convergence" | "session";

interface RequestTerminalEnvelope {
  origin: AbortOrigin;
  code: string;
  summary: string;
  retryable: boolean;
  nextAction?: string;
  requestId?: string;
  attemptId?: string;
}
```

One helper owns the sequence: retain the first/specific terminal reason, append the ledger event, publish a TUI/RPC-visible diagnostic, then call `ctx.abort()` only when the host transport must be stopped. `message_end` may normalize Pi's retry stop reason but must not erase the envelope. `agent_end` finalizes the attempt and calls host abort only if the same terminal has not already crossed that boundary. `agent_settled` is state-only and clears the request after persisting exactly one terminal record.

Mapping is explicit: user cancellation is `user/cancelled`; 401/403 and terminal provider errors are `provider/authorization-denied` or `provider/http-*`; exhausted transient retries are `provider/attempt-limit`; context rejection is `model-budget/MODEL_CONTEXT_*`; provider rounds are `provider-round/provider-round-budget`; tool-loop stops are `progress-guard/<decision>`; formal mutation blocks are `convergence/<state>`. A bare Pi `Operation aborted` is treated as transport rendering, never as the diagnostic source of truth.

## Compatibility and rollout

- Preserve existing command spellings and the documented `--offline` behavior.
- Add `--skip-version-check` prefix routing only when the next token is a known local CLI family; otherwise preserve Pi argument passthrough.
- Keep local CLI child environment and working directory unchanged.
- README Chinese and English sections are parallel and must be updated together.
- Source drift remains diagnostic: show an actionable update/source-install instruction but never mutate the managed installation from doctor or session startup.
- Preserve all existing retry, provider-round, progress, and model-budget thresholds. The change is attribution and delivery, not relaxed safety.
- RPC/SDK blackbox tests use temporary project/session directories and a fake/local provider where possible; real-provider A/B remains a separate credentialed check.

## Risks and rollback

- Refactoring top-level CLI dispatch can change process exit behavior; cover success and failure in subprocess tests before broader validation.
- Protocol stdout contamination would break MCP/RPC clients; test an invalid protocol invocation and assert diagnostics stay off stdout.
- Existing dirty worktree contains unrelated changes; only files listed in `implement.md` are in this task's implementation set.
