# Dove Adaptive Formal Workflow

## Goal

Preserve the useful engineering discipline of Trellis inside Dove without
making task creation, phase transitions, or document completeness a runtime
permission gate. Dove must improve effective model performance by giving the
model the right durable context at the right time while keeping ordinary work
direct and low-friction.

## Background

The current Native Workflow correctly makes Pi the sole model, tool, and
execution authority, but its native state is only a compact goal record. The
previous Trellis workflow had valuable PRD, design, implementation, research,
and verification artifacts, but its lifecycle encouraged repeated planning and
confirmation overhead. The September 1 real-flow regression showed that
additional workflow ceremony can increase questions, provider rounds, and
uncached input without improving task completion.

## Requirements

### R1. Two request lanes

- Simple chat, lookup, and small execution requests continue directly through
  Pi without creating a formal task.
- Complex, multi-file, cross-layer, risky, or explicitly planned work uses a
  formal Dove task with durable artifacts.
- Lane selection must organize context and persistence, never restrict Pi's
  tools or require a phase approval handshake.

### R2. Formal native artifacts

- A formal task stores `task.json`, `prd.md`, `design.md`, `implement.md`, and
  `acceptance.md` under `.dove/tasks/<task-id>/`.
- `research/` and `evidence.jsonl` are optional bounded supporting artifacts.
- `state.json` remains a compact index and current-task projection; it must not
  contain full planning documents or an unbounded history.
- Missing or stale artifacts are recorded as incomplete context and may be
  repaired during execution; they must not block a valid user request.

### R3. Non-blocking lifecycle

- Tasks expose descriptive phases: intake, planning, designed, implementing,
  verifying, completed, and archived.
- Pi may execute, test, or repair work in any phase when the user request is
  explicit enough.
- Phase changes, next steps, decisions, verification results, and failures are
  persisted from actual execution evidence rather than only initialized.
- Explicit completion remains available, while automatic completion requires
  strong acceptance evidence and never hides unresolved failures.

### R4. Task/request separation

- A formal project task may contain multiple logical user requests.
- Request-level Token, provider, tool, question, and terminal metrics remain
  associated with the logical request, not permanently with the current task.
- Unrelated requests must not inherit the current task's detailed context.
- Explicit continuation and an unambiguous task selector must always restore the
  selected formal task.

### R5. Bounded context and cache stability

- Normal turns receive only a compact task summary, current phase, next step,
  acceptance summary, and recent decisions when relevant.
- Full PRD, design, implementation, research, or acceptance documents are
  loaded only for explicit or strongly relevant requests.
- Document retrieval must use a stable version/epoch and append-only context
  behavior so formal artifacts do not cause ordinary cache churn.

### R6. Legacy compatibility

- Existing `.trellis` tasks and documents remain readable as untrusted,
  read-only compatibility data.
- Continuing a legacy task may materialize a native formal task with source
  references and writable Dove artifacts; the original `.trellis` files remain
  unchanged.
- Dove must not execute Trellis scripts, invoke the Trellis CLI, or restore the
  removed runtime dependency.

## Acceptance Criteria

- [ ] A simple edit/test request creates no formal task artifacts and asks no
      task, phase, or initialization question.
- [ ] An explicit complex request creates a native task with PRD, design,
      implement, and acceptance artifacts without a second confirmation.
- [ ] The model can implement while one or more formal documents are incomplete.
- [ ] A formal task can span at least three logical requests without merging
      their cost and completion metrics.
- [ ] An unrelated request receives no stale detailed task document.
- [ ] Explicit continuation restores the task phase, next step, decisions, and
      acceptance summary across a fresh process.
- [ ] Tool results and test outcomes append bounded evidence and update the
      acceptance projection without claiming success from an unexecuted check.
- [ ] Normal turns inject only the compact projection; explicit document reads
      do not rebuild the projection on every tool continuation.
- [ ] Native formal tasks and legacy task imports leave `.trellis` byte-for-byte
      unchanged.
- [ ] Existing cache, question-budget, tool-authority, typecheck, installer,
      and real-provider regression suites remain green.
- [ ] The real-flow matrix shows no increase in questions or uncached input per
      completed logical request versus the current baseline.

## Out Of Scope

- Restoring Trellis as a runtime dependency or executing `.trellis/scripts`.
- Adding a Dove permission system, tool allow-list, or mandatory approval gate.
- Requiring formal artifacts for ordinary chat or small edits.
- Building team ownership, remote collaboration, or a replacement for Pi's
  native extension ecosystem.
- Automatically inferring semantic task relationships from unrestricted prose
  when an explicit selector or continuation signal is absent.
