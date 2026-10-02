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
  touch it. `toRequest` forwards `technique`/`phase`/`intensity`/`requestsInLastSecond` so a grant's
  `constraints` fire too.
- **A declaration the runtime cannot honour is refused, by name.** That covers the blocks listed in the
  matrix below - a mode-level `expires`, `grant_graph`, `evidence`, `coordination`, `session.memory_scope`,
  the budget fields beside `turns`, and a `stop.on` reason the loop never produces. The point is not that
  they are unimplemented but that they are **unenforceable where they sit**: each message says which field
  and why, because the reason it is refused is the design point. **One limitation is recorded rather than
  fixed** ✗: the mode's `session.budget.turns` is carried, and the only loop this runtime owns that reads a
  turn bound is the reference one under `axi-turn`; the Pi host's loop is the host's, so a mode's turn
  budget does not bound it yet.
- **`sandbox` and `fence` are honoured or refused, never ignored.** `network: none` and `filesystem:
  read-only-source` are enforced at the boundary; `isolation: container`/`worktree` and `network:
  allowlist` refuse to load. A `fence` refuses writes into the harness's `paths`, which is how `authority`'s
  no-self-authored-authority rule (below) is enforced, and requires a `shell` stance because it cannot see
  through the shell; an unclassifiable mutation is refused. Absent axes mean a mode says nothing.
- **A vertical adds no core code.** A mode id appearing in executable code under `src/core` is a
  framework defect.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown field, any level | Rejected with a named error; never ignored |
| Missing fence, `name`, or `description` | Rejected |
| Missing `scope`, `authority.capabilities`, or `gate.semantics` | Rejected |
| Unrecognised `gate.semantics` | Rejected, naming the four values |
| `limit`/`both` with no limits, or `none` with any | Refused at load, naming both ways out |
| `unlisted` absent or unrecognised | Refused, naming `allow` and `ask` |
| `unlisted: allow` with a non-empty `always_allow` | Refused, naming both ways out |
| `gate.intensity` not a map of finite ≥1 | Refused at load, naming the phase |
| `gate.excluded_techniques` not a string list | Refused at load |
| `gate.excluded_techniques` naming a technique the runtime cannot witness | Refused at load, naming the technique |
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

- A well-formed three-file mode loads; body and permission set are exposed.
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

### 6. Wrong vs Correct

Wrong: ignore an unrecognised key, so a typo in `permissionMode` fails open and silent.

Correct: reject it by name, and require the fields whose absence makes a mode unreviewable.
