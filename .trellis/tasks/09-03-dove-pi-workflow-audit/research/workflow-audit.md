# Dove Pi workflow audit evidence

## Repository map

| Boundary | Evidence | Responsibility |
| --- | --- | --- |
| launcher | `dove_pi.py:709-735` | classify maintenance, local CLI, or Pi launch |
| local CLI | `src/cli.ts` | project/task/session/extensions/capability/RPC/MCP/diagnostics |
| Pi host | `src/pi-adapter/extension.ts` | lifecycle, request planning, tools, convergence, ledger |
| project provider | `src/project-provider/*` | `.dove/state.json`, native goals and read-only legacy projection |
| transports | `src/adapters/local-rpc.ts`, `src/adapters/mcp.ts` | stdio protocol boundaries |
| managed install | `installer/*`, `dove_pi.py` | staging, verification, activation, repair, rollback, uninstall |

## Real-user command matrix (isolated temp project)

Commands were run with temporary `DOVE_PI_HOME` and `PI_CODING_AGENT_DIR` values and a fresh project directory.

- `dove-pi --version` returned `Dove Pi 0.1.6 (Pi 0.84.3)` without launching Pi.
- `dove-pi --offline doctor`, `project doctor`, `task list`, and `session list` reached the TypeScript CLI and returned JSON.
- `project init`, `task create`, `task list/current/status/verify`, `session record/list`, `capability list`, and `web status` completed in the isolated project.
- `dove-pi --offline task convergence status` with no current task failed safely with `No current task`, and did not create a task.
- Before the fix, `dove-pi --skip-version-check task list` attempted a Pi launch and failed for missing credentials. After the classifier fix, the same command reaches the CLI and returns task JSON.
- `dove-pi project bogus` silently returned normal project status instead of rejecting the unknown subcommand.
- Invalid CLI commands (`task bogus`, missing session title, unknown capability, invalid extension profile) exited non-zero but exposed a Node stack trace. The contract requires a stable error object for CLI callers.
- `cache audit --min-requests=bad` currently normalizes invalid input to the default instead of rejecting it; this is recorded as a follow-up because changing audit option semantics needs a separate product decision.

## External references

- Pi coding-agent README: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md>. It documents interactive, print/JSON, RPC, and SDK modes, and says Pi owns the native tool host.
- Pi extensions guide: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md>. Extensions can register tools/commands and intercept lifecycle events; extensions run with full system permissions and should be trusted.
- MCP transports: <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>. Stdio transports require protocol messages on stdout, so human diagnostics must use stderr.

## Findings and disposition

### Fixed in this task

1. Prefix `--skip-version-check` did not route known local commands and could launch Pi unexpectedly; now covered by launcher routing regression tests.
2. Unknown `project` subcommands were silently accepted; now rejected with a usage error.
3. CLI errors leaked runtime stack traces instead of stable machine-readable errors; now normalized by the CLI error boundary.
4. In large legacy projects, the workflow document could be evicted by the 100-document projection bound; workflow is now prioritized before bulk task/spec documents.

### Already fixed before this task

- `--offline` local-command routing regression.
- Parent-directory `.dove` discovery, evidence append, `nextAction` persistence, read-only convergence status, and empty finding-update validation.

### Deferred

- `cache --min-requests` invalid-value rejection (needs option compatibility decision).
- Tool/time/token hard ceilings (explicitly out of scope; observation only).
- x25519 harness linker blocker (belongs to the independent convergence task).
