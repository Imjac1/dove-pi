# Personal Agent Mode Format

> **Scope:** The mode artifact: its three files, the fields a mode declares, the load-time contract that refuses
> what it cannot honour, and the two boundary controls (`sandbox`, `fence`) whose claims are kept at the tool
> boundary.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)

Every contract below fails closed: an unevaluable condition is a refusal at load or a block at the boundary,
never a pass.

## Scenario: Work-Mode Layout and Validation

### 1. Scope / Trigger

Trigger: adding a vertical, or changing how a mode is declared or loaded.

### 2. Signatures

```typescript
// src/core/work-mode.ts
function loadWorkMode(files: { mode: string; governance: string; permissions: string }, options: { frameworkVersion: string }): WorkMode;
function satisfiesFrameworkRange(range: string, version: string): boolean;
function evaluatePermission(p: PermissionSet, tool: string): "allow" | "ask" | "deny";
function matchesPermission(list: readonly string[], action: string): boolean;
```

### 3. Contracts

- A mode is three files: `MODE.md` (frontmatter `name` + `description`, body = instructions),
  `governance.yaml`, `permissions.yaml`. `MODE.md` stays Agent-Skills-compatible, so the portable part
  remains consumable elsewhere.
- **The body reaches the model; it is not only parsed.** The loaded body is carried into the system prompt as one labelled
  block - `[DOVE MODE INSTRUCTIONS id=<frontmatter name> governance=<version> source=modes/<dir>/MODE.md
  trust=authoritative]` - bounded by `MODE_BODY_MAX_CHARS` (8000), and a body past that ceiling is cut with the cut stated
  inside the block, because a silent cut would read as the whole method. **`trust=authoritative` is the point of the label**:
  the compiled project documents in the same request are labelled `trust=untrusted`, since a repository's files are input
  while a mode's rules are the operator's, and a model that cannot tell the two apart cannot apply either. A body that is
  empty or absent contributes **no block at all**, so a mode declaring only permissions and a sandbox leaves the prompt byte
  for byte unchanged. The citation names the **directory the loader read**, not the frontmatter `name`, because the two need
  not agree and a citation that can be false is the defect this repository keeps finding in its own declarations; when a mode
  was built from file contents alone (`loadWorkMode`), no path is named rather than a guessed one. Whether the body was
  carried, how many characters entered, and whether it was cut are reported through the strategy snapshot, computed by the
  same call that builds the block so the reading cannot describe a block that was not sent.
  **Anchors.** `src/core/prompt-policy.ts` (`workModeInstructions`), `src/core/work-mode.ts` (`WorkMode.source`),
  `src/pi-adapter/extension.ts:3318`, `src/core/strategy-snapshot.ts`; `tests/mode-body-prompt.test.ts` and the three host
  cases in `tests/host-work-mode.test.ts`.
- `governance.yaml` requires `version`, `framework`, `scope`, `authority.capabilities` and
  `gate.semantics` (`none`/`limit`/`conformance`/`both`).
- The framework range accepts only `>=X.Y.Z` and `<X.Y.Z` clauses; anything else is refused rather than
  assumed satisfied.
- `never_allow` wins over `always_allow`, over `ask_before`, and over any mode setting. An unlisted
  action gets the declared `unlisted` stance; `always_allow` outranks it.
- **`ask` has two declared causes.** `ask_before` names an action; `unlisted: ask` covers everything
  unnamed. Separate them with `matchesPermission(p.ask_before, action)` when the reason must be exact.
  The host asks through its dialog and records both answers; a host with no dialog refuses.
- **The gate reads every field a mode declares.** `excluded_techniques` is checked against the call's
  `technique`, `intensity` ceilings against the actions a phase has run, and a call that carries neither is
  simply outside both. `scope.exclusions` is checked against the target the call names, through the same
  `target_argument` the contract gate uses: a mode that states what it must not touch is not allowed to
  touch it - **and a mode that cannot say which target a call names is refused that list at load**, because
  a statement nothing can evaluate is not a boundary. `toRequest` forwards
  `technique`/`phase`/`intensity`/`requestsInLastSecond` so a grant's `constraints` fire too.
- **A declaration the runtime cannot honour is refused, by name.** That covers the blocks listed in the
  matrix below - a mode-level `expires`, `grant_graph`, `evidence`, `coordination`, `session.memory_scope`,
  the budget fields beside `turns`, and a `stop.on` reason the loop never produces. The point is not that
  they are unimplemented but that they are **unenforceable where they sit**: each message says which field
  and why, because the reason it is refused is the design point. **One limitation is recorded rather than
  fixed** ✗: the mode's `session.budget.turns` is carried, and the only loop this runtime owns that reads a
  turn bound is the reference one under `axi-turn`; the Pi host's loop is the host's, so a mode's turn
  budget does not bound it yet.
- **`sandbox` and `fence` are honoured or refused, never ignored.** `network: none` and `filesystem:
  read-only-source` are enforced at the **tool** boundary: the network axis by tool name, the filesystem axis
  by the fence's declared targets. **What the network axis does not cover is anything a shell command
  reaches.** `bash` and `powershell` are not among the eight names it matches
  (`src/core/action-policy.ts:21`), so a mode declaring `network: none` can still fetch over the network, and
  that is measured rather than inferred: in a twelve-session run a mode declaring exactly that ran
  `npm install`, which resolved and installed a new package version
  (`.trellis/tasks/10-03-ten-million-token-project/findings.md`, finding A). The axis is a claim about the
  tools this runtime dispatches, not about egress; a mode that needs the latter needs a host that provides it.
  `isolation: container`/`worktree` and `network: allowlist` refuse to load. A `fence` refuses writes into the
  harness's `paths`, which is how `authority`'s
  no-self-authored-authority rule (below) is enforced, and requires a `shell` stance because it cannot see
  through the shell; an unclassifiable mutation is refused. Absent axes mean a mode says nothing.
  **Anchors.** Enforced at `src/core/action-policy.ts:626`; refused at load at `src/pi-adapter/extension.ts:2253`.
- **A `fence` entry reaches the whole filesystem, not only the workspace.** Both sides are canonicalised
  and compared as locations: inside the workspace the relative form is produced first and wins, and a
  target with no relative form falls back to the canonical absolute one. So an entry may name a path
  outside the workspace (verified by a controlled revert: reverting only that fallback turns the case red
  with the fence-not-refusing reason), and an absolute entry can neither widen nor narrow what the
  relative entries already match. Before this, a target outside the workspace reduced to nothing and the
  fence passed it - which is what made a channel stored outside the workspace writable anyway.
  **Anchor.** `tests/a3-trace-independence.test.ts:186`, and the wall it protects is
  `tests/a3-trace-independence.test.ts:179`.
- **The runtime holds its own state root, and no mode can reach it.** The harness protects the parent of
  the per-workspace state directory unconditionally: it is not a mode's declaration, needs nothing in
  `governance.yaml`, cannot be widened by any mode, and cannot be forgotten by a new one. It covers the
  mutating tools whose target the built-in map can read (`write`, `edit`). It reached this shape because
  three of four shipped modes allowed a write into the trace channel's own directory, and the mode
  flagged read-only was the only one that refused - a control every mode must restate is a control that
  goes missing. **Anchors.** `src/core/action-policy.ts:593`; `tests/a3-trace-independence.test.ts:94`
  is the case that a mode declaring no fence at all still fails.
- **What that protection cannot see is recorded, not assumed closed.** Two blind spots, both measured:
  **the shell** - a `bash` or `powershell` command writes wherever it likes and no check can see which
  path it names, so the only control covering it is a mode giving up the shell (`fence.shell: denied`),
  which a mode whose work is running the project's tests cannot do; and **the mutators outside the built-in
  target map** (`replace`, `insert`, `notebook_edit`), which a mode can cover by declaring
  `fence.targets`, because a mode's declaration wins over the built-in map. The map is deliberately tiny -
  the installed catalog carries 57 tool names whose schemas this repository cannot read - so "which other
  tools mutate, and where is their path" is a claim it does not make. **Anchors.** The map and its reason
  are `src/core/work-mode.ts:217`; the shell gap is held open on purpose by
  `tests/a3-trace-independence.test.ts:137`, which asserts the write is still allowed so that closing it
  fails loudly.
- **A vertical adds no core code.** A mode id appearing in executable code under `src/core` is a
  framework defect.
- **What a control refuses is a name, not an intent.** Every control in this format is a name match:
  `effects.classes` matches the tool's name at the effect boundary (`src/core/effect-boundary.ts:122`),
  `never_allow` matches the action's name (`src/core/action-policy.ts:431`, and `src/core/action-policy.ts:611`
  says as much in its own words - `never_allow` *names actions*), and the sandbox's network axis is membership in a
  fixed set of tool names (`src/core/action-policy.ts:21`). So a control refuses **an action, not an intent**,
  and the same effect reached under another name is not refused. This is measured rather than argued: in one
  twelve-session run a `bash` command was refused as a non-idempotent undeclared effect, and the model did the
  same work another way and said so - *"That blocked a re-run of `npm test`; I substituted a direct runtime
  check of the shipped `index.js` instead, which covered the same behavior"* (`.trellis/tasks/10-03-ten-million-token-project`,
  segment 8). Neither the refusal nor the substitution was wrong; what would be wrong is reading the refusal as
  containment of the effect. A mode that needs the effect covered has to close the name, or say plainly that it
  has closed one route to it.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown field, any level | Rejected with a named error; never ignored |
| Missing fence, `name`, or `description` | Rejected |
| `fence` without a `shell` stance | Refused at load: the fence cannot see through the shell, so it cannot judge a write that goes through it |
| Missing `scope`, `authority.capabilities`, or `gate.semantics` | Rejected |
| Unrecognised `gate.semantics` | Rejected, naming the four values |
| `limit`/`both` with no limits, or `none` with any | Refused at load, naming both ways out |
| `unlisted` absent or unrecognised | Refused, naming `allow` and `ask` |
| `unlisted: allow` with a non-empty `always_allow` | Refused, naming both ways out |
| `gate.intensity` not a map of finite ≥1 | Refused at load, naming the phase |
| `gate.excluded_techniques` not a string list | Refused at load |
| `gate.excluded_techniques` naming a technique the runtime cannot witness | Refused at load, naming the technique |
| `scope.exclusions` on a mode that cannot check one (no `gate.target_argument`, or a `semantics` that never resolves the document) | Refused: the list could only match a spelling |
| `scope.exclusions` that is not a list of non-empty strings | Refused by name: a scalar or a mapping would otherwise become no exclusions at all, silently |
| `stop` naming a key other than `on` | Refused, naming the key: what the loop has is the reasons it stops, and `on` names them |
| `gate.windows` declared | Refused: the grant carries the window |
| `authority.expires` declared | Refused: the grant carries the window the expiry would repeat |
| `authority.grant_graph` declared | Refused: the document's `targets[].requires_grants` is the binding, checked per action |
| `evidence` / `coordination` declared | Refused: retention, isolation and a coordination cadence are machinery this runtime does not have |
| `session.memory_scope` declared | Refused: nothing here scopes memory by mode |
| `session.budget` naming anything but `turns` | Refused, naming the field: `turns` is carried to the turn bound, and a budget metering one of four things is not a budget |
| `stop.on` naming a reason the loop never produces | Refused, naming the value and the loop's own set (`completed`, `maxTurns`, `stopped`, `providerError`) |
| `authority.grant` naming no document | Refused under **every** semantics, naming the field and the name - the early return for `limit`/`none` skips loading a document, not resolving a name |
| `sandbox` axis unrecognised, or `isolation: none` with `filesystem: ephemeral` | Refused, naming the axis or the contradiction |
| `framework` excludes the running version | Refused, naming the version |
| Unparseable `framework` clause | Refused |

### 5. Tests Required

- A well-formed three-file mode loads; the body is carried into the prompt and the permission set is enforced.
- Unknown fields rejected in frontmatter, governance, permissions, and the nested `scope` /
  `authority` / `gate` mappings.
- Each required field, when absent, is rejected.
- A YAML block-scalar description parses correctly.
- A vertical adds no core code: **adding one changes no file under `src/core`**. 
  *(The principle, not a string search: a workspace mode is also called `pentest`, so the word appears in `src/core` for a reason that has
  nothing to do with a vertical needing core code. A test cannot hold this one - what it can hold is that the mode directory is loaded from
  `modes/` rather than built in, which is covered where the loader is tested.)*
- A mode declaring a gate it does not supply is refused; `none` builds no gate.
- An excluded technique is refused at the boundary, including on a call that names no target; a phase over
  its `gate.intensity` ceiling is refused, and the ceiling counts actions actually run.
- An `ask_before` action returns `ask`; an unlisted one returns the declared stance; a host with a dialog
  runs the first on consent and refuses it without. A limit without `tools` evaluates against every action,
  so a mode names the action its threshold belongs to.
- The fence reaches a path outside the workspace: an entry naming one refuses a write into it, and the
  same case with the absolute fallback reverted fails for the fence-not-refusing reason rather than any
  other. A mode that declares **no** fence at all still refuses a write into the runtime's state root,
  which is what makes the property independent of what a mode remembers to say.
- The shell blind spot is pinned by a case that asserts the write is still **allowed**, so closing the gap
  turns it red and the limitation cannot go stale in silence. A skipped case would not do that.
- Every test that writes a mode fixture keeps Windows paths out of double-quoted YAML scalars: `\U` in one
  is an escape and the document is unparseable, which fails as a fixture error wearing the fence's name.

### 6. Wrong vs Correct

Wrong: ignore an unrecognised key, so a typo in `permissionMode` fails open and silent.

Correct: reject it by name, and require the fields whose absence makes a mode unreviewable.

Wrong: treat a fence as a workspace-relative control and store evidence outside the workspace on that
assumption. The path is outside `cwd`, the fence cannot name it, the comparison yields nothing, and the
write passes - which reads as "the channel is protected" while it is not.

Correct: state the claim against the **policy**, not against where the file happens to live, and have the
runtime hold the path itself. `outside the workspace` is a fact about a path; `no policy may write it` is
a property of a control, and only the second one survives a session whose permissions change.

Wrong: read a red case's summary and build on it, or grep for its reason through a filter.

Correct: read the failure's own words first. In one run a case was red because a fixture's YAML had a
Windows path in a double-quoted scalar, not because of the control it was written to test - and the greps
that looked for the expected reason hid it twice. A verification command can lie too: reading a UTF-8 file
with the platform default encoding turned its text into mojibake and reported a section missing that was
present. State the encoding when the answer depends on text.
