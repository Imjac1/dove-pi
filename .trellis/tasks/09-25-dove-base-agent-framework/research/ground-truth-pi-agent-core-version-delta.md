# Ground truth: version delta - 0.84.3 (installed) vs 0.87.1 (published)

- Query: Does the "adopt a governed runtime" path exist at all, and at which version?
- Scope: official published package artifacts, fetched from unpkg by the main session
- Date: 2026-09-25
- Sources:
  - `https://unpkg.com/@earendil-works/pi-agent-core@0.87.1/dist/harness/agent-harness.js` (HTTP 200)
  - `https://unpkg.com/@earendil-works/pi-agent-core@0.87.1/dist/harness/runtime/harness.js` (HTTP 200)
  - local `node_modules/.../pi-agent-core@0.84.3/dist/harness/agent-harness.js`

## The delta

| | 0.84.3 (installed as a nested dep of `pi-coding-agent`) | 0.87.1 (published on npm) |
|---|---|---|
| `AgentHarness` shape | a **class** with 50+ methods | `export const AgentHarness = { create: createAgentHarness }` |
| Implementation | **stub**: every substantive method rejects `HarnessNotImplemented` | **implemented**: `Harness` class in `dist/harness/runtime/harness.js` (13,762 bytes) |
| `hooks` | `UnavailableRegistry` - `hooks.on()` throws | `HookRegistry` with a `handler_error` event channel |
| `events` | `UnavailableRegistry` - `events.on()` throws | `HarnessEventBus` |
| Lanes | `lane()`, `createLane()`, `lanes()` all throw | `Lane` class from `./lane.js`; `lanesByName: Map` |
| Restore / resume | `create()` throws `HarnessNotImplemented("create.restore")` | `readLaneStorage`, `restoreLaneState`, `restoreSession` from `./restore.js` |
| Error taxonomy | 13 tagged classes | adds `InvalidNavigation`, `OperationMismatch` |
| Known gaps | everything | `SliceNotImplemented` is still exported from `./runtime/types.js` |

## Verbatim, 0.87.1 `dist/harness/agent-harness.js`

```javascript
export { Closed, HarnessClosed, HarnessFault, InvalidLane, InvalidMessage, InvalidNavigation,
         LaneBusy, NoActiveOperation, NoActiveRun, NothingToCompact, NothingToResume,
         OperationMismatch, UnknownSkill, UnknownTarget, UnknownTemplate } from "./result.js";
export { SliceNotImplemented } from "./runtime/types.js";
import { createAgentHarness } from "./runtime/harness.js";
/** Runtime constructor for attaching the durable harness to one open session. */
export const AgentHarness = { create: createAgentHarness };
```

## Verbatim, 0.87.1 `dist/harness/runtime/harness.js` (head)

```javascript
import { DEFAULT_COMPACTION_SETTINGS } from "../compaction/compaction.js";
import { DEFAULT_RETRY_POLICY, validateCompactionSettings, validateRetryPolicy, validateToolNames } from "../config.js";
import { HarnessEventBus } from "../events.js";
import { HookRegistry } from "../hooks.js";
import { convertToLlm } from "../messages.js";
import { HarnessClosed, HarnessFault, InvalidLane, UnknownTarget } from "../result.js";
import { SessionInvariantError } from "../session/session.js";
import { branchTip, deleteValue, entryLabel, laneConfig, laneState, sessionName, setValue } from "../session/values.js";
import { Lane } from "./lane.js";
import { readLaneStorage, restoreLaneState, restoreSession } from "./restore.js";
import { SliceNotImplemented } from "./types.js";
/** Runtime implementation of AgentHarness. The harness manages lanes but is not itself a lane. */
export class Harness {
    session; models; hooks; events;
    lanesByName = new Map();
    seed; configStore; closePromise; closedError; faultError;
    constructor(options, seed, restored) {
        this.session = options.session;
        this.models = options.models;
        this.events = new HarnessEventBus();
        this.hooks = new HookRegistry((error, hook, lane, context) => this.events.emit({
            type: "handler_error", kind: "hook", hook, error: error.message, ... }));
        this.configStore = { value: {
            tools: options.tools ?? [],
            resources: options.resources ?? {},
            streamOptions: options.streamOptions ?? {},
            retryPolicy: options.retry ?? DEFAULT_RETRY_POLICY,
            compaction: options.compaction ?? DEFAULT_COMPACTION_SETTINGS,
            steeringMode: options.steeringMode ?? "all",
            followUpMode: options.followUpMode ?? "all",
            toolExecution: options.toolExecution ?? "parallel",
            toolContext: options.toolContext,
            systemPrompt: options.systemPrompt, ...
```

Note also a **default change**: `steeringMode` and `followUpMode` default to `"all"` here,
whereas the 0.84.3 stub constructor defaulted both to `"one-at-a-time"`.

## What this settles

1. **The installed version cannot be the base.** `AgentHarness` in 0.84.3 is a facade, and
   `pi-coding-agent` 0.84.3 is what this repository depends on. Any plan that assumes
   sessions, lanes, resume, compaction, or hooks come from the harness is wrong today.
2. **The thin path is available now and is verified implemented** (`Agent`,
   `runAgentLoop`, with `beforeToolCall` -> `{ block: true }` producing an error tool
   result carrying `reason`). See `ground-truth-pi-agent-core.md`.
3. **The adopt path requires an upgrade to 0.87.1** (a 3-minor jump) and still has
   `SliceNotImplemented` gaps whose scope was not determined.
4. The two paths are therefore **not equivalent effort at the same time**: thin is
   available and verified; fat is available only after a dependency upgrade and an
   unknown-gap audit.

## Caveats / Not Found

## VERIFIED (follow-up): only ONE slice is unimplemented in 0.87.1

CDN fetches kept timing out, so the published tarball was downloaded and read locally
instead:

```powershell
npm pack @earendil-works/pi-agent-core@0.87.1   # 994,229 bytes
tar -xzf earendil-works-pi-agent-core-0.87.1.tgz
```

Grepping the whole extracted package for `SliceNotImplemented` yields exactly three
occurrences:

```
dist/harness/agent-harness.js:2:   export { SliceNotImplemented } from "./runtime/types.js";
dist/harness/runtime/harness.js:11:  import { SliceNotImplemented } from "./types.js";
dist/harness/runtime/harness.js:229: throw new SliceNotImplemented("watchSession");
dist/harness/runtime/types.js:3:     export class SliceNotImplemented extends Error {
```

**Exactly one operation is unimplemented in 0.87.1: `watchSession`.** Verbatim from
`runtime/harness.js`:

```javascript
async watchSession(_context) {
    throw new SliceNotImplemented("watchSession");
}
```

Everything else in the runtime harness - sessions, lanes, drive, hooks, events,
compaction, restore, resume, config - is implemented. So the upgrade path is
**feature-complete except for a session-level watch/snapshot API**; per-lane `watch()`
is present separately.

### The two-stack question is also resolved: `pico3` is explicitly experimental

`package.json` exports:

```json
"./experimental/pico3": {
  "types": "./dist/harness/pico3/index.d.ts",
  "import": "./dist/harness/pico3/index.js"
}
```

and `dist/harness/pico3/index.js` opens with:

> Experimental Pico3 kernel API.
>
> This subpath is intentionally separate from the package root while the kernel
> and its Chord integration are being validated.

So the supported stack is `runtime/` (wired by `createAgentHarness`); `pico3/` is an
opt-in experimental kernel. The API-stability risk is therefore narrower than the raw
file listing suggested - but it does confirm Pi is mid-rewrite, and the experimental
kernel carries concepts the supported stack does not expose, including a `Forbidden`
error and a `ReadAfterWrite` guard.
- `hooks.js`, `lane.js`, `restore.js`, and `config.js` were not read. The hook names
  in 0.87.1 may differ from the 12 declared in 0.84.3.
- `pi-coding-agent` 0.87.1 was not checked for compatibility with this repository, and
  `pi-tui` is pinned to 0.84.3 alongside it. An upgrade is a coordinated change, not a
  single-package bump.
- Fetched from a CDN mirror of the published tarball, not from a local install of 0.87.1.
