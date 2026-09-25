# Research: Local baseline - what already exists for the three verticals

- Query: What does this repository already provide for quantitative trading,
  penetration testing, and code auditing, and where is the base-framework seam?
- Scope: local (repository inspection)
- Date: 2026-09-25

## Findings

### The pentest vertical has already started

`09-06-dove-workspace-modes-context-isolation` (status `in_progress`, all 8 ACs
unchecked) already defines the pentest workspace mode.

- `src/core/workspace-policy.ts:6` - `export type WorkspaceMode = "development" | "pentest"`
  This is implemented, not planned.
- `src/extensions/catalog.ts:1` - `ExtensionProfile = "minimal" | "dev" | "research" | "security" | "max"`
- `src/extensions/catalog.ts:296` - the `security` profile resolves to
  `extension-settings, open-tui, raw-paste, caffeinate, mcp-adapter, agent-browser-native, ask-user-question`
- The task's stated policy: `development` starts with Pi-lens enabled; `pentest`
  starts Pi with `--no-lens` and must not auto-scan downloaded security tools,
  target artifacts, dependency trees, or caches.

### A real incident motivates the pentest mode

Quoted from `09-06-dove-workspace-modes-context-isolation/prd.md`:

> A September 6 authorized security-testing session admitted a 2,865,326
> character diagnostic result for a downloaded third-party tool tree. This was
> approximately 95% of tool-result text in the session and reached the model
> through a background/custom-message path not covered by Dove's ordinary
> `tool_result` compaction.

This is first-hand evidence that the pentest vertical's dominant failure mode is
context admission from untrusted tooling output, not model reasoning quality.

### The approval gap is explicitly deferred

The same task's Out of Scope section states:

> New permission or approval systems for authorized security work.

So the repo has workspace-mode selection and context isolation for pentest, but
**no permission or approval system for authorized security work**. The PRD's
requirements R1-R5 are about launch flags and context admission; none of them
gate an action.

### Where the base-framework seam already is

| Layer | Location | Pi-coupled? |
|---|---|---|
| Capability protocol, dispatch, ledger, evidence | `src/core/` (24 files) | no |
| Model budget / context accounting | `src/core/model-gateway.ts`, `context-compiler.ts` | no |
| Request lifecycle (leases, attempts, terminal reasons) | `src/core/request-lifecycle.ts` | no |
| Project provider (native goal state, legacy Trellis) | `src/project-provider/` (10 files) | no |
| Windows/PowerShell runtime | `src/windows-runtime/` (3 files) | no |
| Skill discovery | `src/skills/discovery.ts` | no |
| Host adapters | `src/adapters/local-rpc.ts`, `src/adapters/mcp.ts` | no |
| Composition root | `src/runtime.ts` - "Single composition root shared by every host adapter" | no |
| Pi host integration | `src/pi-adapter/` (13 files, 4454 lines) | 4 of 13 files import Pi |

Measured sizes: `src/` total 13,623 lines; `tests/` 6,766 lines;
`src/pi-adapter/extension.ts` alone is 2,735 lines and registers 30 Pi
commands/tools.

### No quant or code-audit work exists yet

Grep across `.trellis/tasks` for quant / trading / code-audit terms found no task,
spec, or research artifact. The only hits were incidental prose in archived
reports and the new task's own files. So of the three verticals, only pentest has
a concrete footprint.

## Implications for the base framework

1. The base framework must expose a **workspace/authority mode** as a first-class
   concept, because the repo already has one and the pentest vertical depends on
   it. A vertical is not just a prompt or a tool set; it is a mode that changes
   what may be scanned, which extensions load, and which actions are permitted.
2. The **approval gate for authorized security work is the single largest
   identified gap** and is exactly the case where an advisory gate is insufficient:
   the failure mode is an irreversible action, not a bad suggestion.
3. The Pi-free surface (`core/`, `project-provider/`, `windows-runtime/`,
   `skills/`, `adapters/`, `runtime.ts`) is already ~69 files and is the natural
   core of the base framework. The Pi-coupled surface is the part whose form the
   research must decide.
4. Context admission is a governance concern that the verticals already rely on:
   the 2.8 MB incident was a **tool-result admission** bug, which means the base
   framework needs one centralized admission boundary for tool results, extension
   messages, and background notifications.

## Caveats / Not Found

- Quantitative trading and code auditing have no local footprint, so their
  requirements cannot be derived from this repository and must come from wave 1/2
  external research.
- `09-06` is `in_progress` with unchecked ACs; this file records its stated
  requirements, not verified behavior. Whether `pentest` mode currently works
  end-to-end was not tested here.
