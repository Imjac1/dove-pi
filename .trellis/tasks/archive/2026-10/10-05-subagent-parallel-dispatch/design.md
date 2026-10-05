# Design: concurrent read-only subagent dispatch

## Boundary

One file carries the defect, so one file is changed plus its tests:

| File | Why it must change |
|---|---|
| `src/pi-adapter/extension.ts` | The dispatch state (`:714`), its four writers (`:1602`, `:1609`, `:1615`, `:1617`), its two readers (`:1243`, `:1945-1952`), and the tool description (`:1590-1594`) |
| `tests/pi-adapter.test.ts` | The concurrency case and the projection case |
| `src/cli.ts` | **Added after the review, by measurement.** The CLI's `doctor --json` already published `activeRuns` as a **count** (`:128`, from `a58ccd7`), so the rename would have left one key carrying a list in `agent_doctor` and a number in the machine form of the same payload. It publishes an empty list now, and `tests/cli-error.test.ts` holds the type |
| `.trellis/spec/backend/personal-agent-extension-runtime.md` | Its `:61` names only four `subagent` fields and is silent about the rest; the projection this task makes truthful should be stated there (Phase 3.3) |

**Not changed**: `src/core/subagent.ts` (the host-neutral contract is already correct and generic),
`src/pi-adapter/subagent-provider.ts` (the `runs` Map at `:76` is already concurrency-safe and keyed by `runId`),
the tool's parameter schema, and the read-only/`--no-session`/`--no-extensions` argv at `:91-98`.

## The defect, stated as an invariant

`subagentLastState` (`extension.ts:714`) is a single mutable binding written by every dispatch and read by two
consumers. Under Pi's parallel batch execution (`agent-loop.js:411-453`) two dispatches interleave at their
`await` points, and the binding ends up describing whichever call wrote last - a value that is not "the run" for
either reader.

**The invariant the fix must restore**: a reader of the published state must never be shown a run that has been
overwritten by a sibling, and the set of in-flight runs must be complete.

## Contract after the change

```ts
interface SubagentRunState { readonly state: string; readonly runId?: string; readonly reason?: string }

// Keyed by runId, which is unique because dispatchId embeds the tool call id (extension.ts:1613).
const activeSubagentRuns = new Map<string, SubagentRunState>();
let lastSubagentTerminal: SubagentRunState | undefined;
```

**Why a `Map` and not a counter or a single slot**: the `Map` answers both questions a reader has - "which runs
are in flight" (the keys) and "how many" (the size) - and its mutation is a single synchronous operation.
JavaScript runs one turn at a time, so a `set`/`delete` with no `await` between the read and the write cannot
interleave with a sibling. The rule the code must keep: **no `await` may sit between reading this state and
writing it back.**

**Writers** (`extension.ts`):

| Site | Today | After |
|---|---|---|
| `:1602` provider not configured | sets `subagentLastState` | sets `lastSubagentTerminal` - no run was started, so no entry in the map |
| `:1609` provider unhealthy | sets `subagentLastState` | same as above |
| `:1615` after `launch` | sets `subagentLastState` | `activeSubagentRuns.set(runId, {...})` |
| `:1617` after `collect` | sets `subagentLastState` | `activeSubagentRuns.delete(runId)` then `lastSubagentTerminal = {...}` |

**Readers**:

- `/subagent` (`:1243`) - reports the number of in-flight runs plus the last terminal, so the operator sees a
  batch rather than one slot.
- `agent_doctor` (`:1945-1952`) - `activeRun` (a single object or `undefined`) becomes
  `activeRuns` (an array), and `lastTerminal` keeps its name and meaning.

## Compatibility

- **`activeRuns` is not a new name invented here.** `.trellis/tasks/archive/2026-09/09-28-doctor-fields/implement.md:15`
  records a measurement of this very projection as
  `["provider","configured","available","reason","activeRuns"]` - the plural. The implementation carries the
  singular, and nothing recorded that change. The rename returns the field to the name the record already used.
- **Nothing else reads these fields, and one thing writes one of them.** `tests/pi-adapter.test.ts:395` types the `subagent`
  projection as `{ provider; configured; available; reason? }` and does not name either field; no other suite mentions them
  (verified by searching `tests/` for `activeRun`). **The search was too narrow, and the review found what it missed**: the
  CLI's own `doctor --json` writes `activeRuns: 0` at `src/cli.ts:128`. Reading only the tests answered "who reads this" and
  left "who already publishes a field under this name" unasked, and the rename would have given that key two types. The CLI
  now publishes an empty list, and the type is asserted in `tests/cli-error.test.ts`.
- **`personal-agent-extension-runtime.md:61` promises only four fields** (`provider`, `configured`, `available`,
  a sanitized reason). Both `activeRun` and `lastTerminal` are already outside that sentence, so the rename
  narrows no documented promise. Phase 3.3 brings the sentence up to what the projection now says.

## Tool description

`description` and `promptGuidelines` (`extension.ts:1590-1594`) currently describe one investigation and say
nothing about batching. They gain one clause: several calls in one message run concurrently, so a set of
independent investigations should be issued together rather than one per turn. This is requirement R3 and the
only mechanism that makes option (a) reliable - Pi will run a batch in parallel, but the model has to be told
that emitting a batch is the intended use.

## What this design deliberately does not do

- **No concurrency ceiling.** Under option (a) the batch size is whatever the model emits, and the provider
  already bounds each child's output (`subagent-provider.ts:7`). A ceiling becomes meaningful only if a
  `tasks` array later lets one call fan out on its own. Recorded as PRD O3.
- **No ledger record for subagent runs.** Children are not written to the execution ledger today, so
  `lastSubagentTerminal` is in-memory and dies with the process. Making it durable is a larger change about what
  a subagent run *is*; it is out of scope here and the design does not pretend otherwise.
- **No `executionMode: "sequential"` declaration.** That is the mechanism Pi offers for tools sharing mutable
  state (`extensions.md:142`), and it is the correct answer for a tool that cannot be made safe. It is the wrong
  answer here: serializing the batch would remove the parallelism this task exists to enable. The state is made
  safe instead.

## Data flow under a batch

```
main agent, one assistant message
  └─ Pi executeToolCallsParallel (agent-loop.js:411-453)
       ├─ agent_subagent.execute() ── launch ─► activeSubagentRuns.set(A)
       ├─ agent_subagent.execute() ── launch ─► activeSubagentRuns.set(B)
       ├─ … collect(A) settles ─► activeSubagentRuns.delete(A); lastSubagentTerminal = A
       └─ … collect(B) settles ─► activeSubagentRuns.delete(B); lastSubagentTerminal = B
     results returned in emission order (agent-loop.js:453)
```

`lastSubagentTerminal` is defined as **the most recently settled** run, not the most recently launched one.
That is the only definition that is true when several runs are in flight, and it is why the name is not
`lastDispatch`.

## Rollback

One commit. `git revert <commit>` restores the single binding; nothing is persisted, so no migration or
cleanup is involved.

## Verification

| Check | Command |
|---|---|
| Types | `npm run typecheck` |
| The concurrency case and the projection case | `node --import tsx --test tests/pi-adapter.test.ts` |
| The CLI publishes the same type under `activeRuns` | `node --import tsx --test tests/cli-error.test.ts` |
| Nothing else regressed | `npm test` |
| The real projection, by hand | `npm run doctor`, and `agent_doctor` inside a session |
