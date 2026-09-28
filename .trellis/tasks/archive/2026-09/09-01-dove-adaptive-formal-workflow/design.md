# Design

## Architecture Boundary

Pi remains the sole model, session, tool, and execution authority. Dove owns
request planning, bounded project persistence, context projection, execution
evidence, continuation, loop/cost controls, and diagnostics. The legacy Trellis
reader is an input adapter only.

The key separation is:

```text
FormalProjectTask  -> durable work container and artifacts
LogicalRequest     -> one user turn and its outcome/cost budget
ExecutionEvidence  -> observed tools, tests, decisions, and verification
```

`FormalProjectTask` must not be used as the request identifier in the request
ledger. A task may contain many requests, and a request may be executed without
a formal task.

## Native Storage

```text
.dove/
  state.json
  tasks/<task-id>/
    task.json
    prd.md
    design.md
    implement.md
    acceptance.md
    research/
    evidence.jsonl
```

`state.json` contains the schema version, revision, current task ID, and a
bounded summary/index of recent tasks. The task directory owns the formal
documents. All mutations use the existing project lock and atomic write path.
Each document has a bounded read projection; full files remain on disk and are
never injected by default.

`task.json` records task identity, source (`native` or `legacy-trellis`),
phase, status, timestamps, artifact presence, current next step, and bounded
acceptance counters. It is metadata, not a second prompt policy.

## Lane Selection

Use existing request intent classification as a signal, then add a narrowly
scoped formal-task decision:

- Explicit planning/architecture/PRD/design/acceptance/task language selects
  the formal lane.
- A clearly multi-file or cross-layer request may select the formal lane when
  the request itself provides enough evidence.
- Chat, lookup, and small direct edits remain fast-lane requests.
- Ambiguous requests remain direct and may be promoted when the user asks to
  plan or continue a formal task.

This decision changes persistence and context only. It never calls
`setActiveTools`, creates an approval state, or blocks a Pi tool call.

## Lifecycle

The lifecycle is a reducer over observed commands and evidence:

```text
intake -> planning -> designed -> implementing -> verifying -> completed
                                                        \-> blocked
completed -> archived
```

The phase is advisory and recoverable. A missing artifact produces a repair
obligation in `task.json` or `acceptance.md`, not a request rejection. Explicit
`continue` resolves the current task and loads the next relevant artifact.
Explicit `finish` records completion only after preserving any failed or
unknown acceptance items.

## Context Policy

The default projection is a compact native task summary. The context compiler
loads full documents only when the request asks for them or when the current
phase makes one document directly relevant. Retrieval is keyed by task ID,
artifact name, and document revision. The provider-visible base schema and
static policy remain unchanged across lane and phase changes.

Unrelated requests get no detailed formal-task document. A task summary may be
omitted entirely for chat. This prevents the current task from becoming a
permanent stale prompt prefix.

## Evidence And Acceptance

The Pi adapter records tool and provider evidence already observed by the
execution ledger. A task projection reducer converts relevant records into:

- next step: the most recent unresolved action;
- decisions: bounded explicit design decisions or accepted implementation
  choices;
- verification: command, result, and timestamp summaries;
- acceptance: criterion status with evidence references.

The reducer must distinguish `passed`, `failed`, `pending`, and `unknown`.
Only observed evidence may move a criterion to `passed`.

## Legacy Import

The existing read-only Trellis projection remains available. Selecting a legacy
task creates a native task manifest with `sourceRef` and, when formal editing
is requested, copies only public planning documents into the native task
directory. The source files are never edited, deleted, or executed.

## Rollout And Rollback

Implement the data model and projections behind the existing native provider,
then enable formal task creation for explicit requests. Keep fast-lane behavior
unchanged. A malformed native task degrades metadata and leaves Pi execution
available. Rollback is the previous managed release; no legacy data migration
is destructive.
