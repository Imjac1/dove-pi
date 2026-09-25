# Technical Design (draft)

> **Status: draft.** Written from the verified official wave plus the main session's own
> first-hand extractions. The community wave and the GitHub wave are still in flight and may
> overturn sections 4, 5, and 9. Open decisions are listed in section 10 rather than guessed.

## 1. Problem statement

Build one base agent framework that can host quantitative trading, penetration testing, and code
auditing, where **the agent working mode is a reusable artifact** rather than per-project code.

The three verticals differ in what they must block and what they must prove:

| Vertical | Irreversible action | Required pre-action control | Required evidence |
|---|---|---|---|
| Quant trading | order entry | pre-trade threshold/limit checks, erroneous-order rejection, authorized-person restriction (SEC 15c3-5) | immediate post-trade reports; documented review + officer certification |
| Penetration testing | any test action | conformance to a pre-established, signed, time-bounded authority contract (NIST SP 800-115 ROE; PTES Pre-engagement) | the contract, evidence handling, incident coordination |
| Code auditing | publishing a finding | none pre-action (reversible); the control is **finding identity** - a fingerprint that excludes model prose, plus a persisted baseline | SARIF-shaped results with stable fingerprints and baseline diff |

**The framework's job is to make these enforceable without three separate products.**

## 2. Architecture: three swappable seams

Anthropic's current published decomposition, adopted verbatim in spirit
(`managed-agents`, Apr 08 2026): *"a **session** (the append-only log of everything that
happened), a **harness** (the loop that calls the model and routes tool calls to the relevant
infrastructure), and a **sandbox** (an execution environment where the model can run code and edit
files)... the implementation of each can be swapped without disturbing the others."*

```text
work mode (declarative artifact)          <- reusable, versioned, inspectable
        |
        v
+----------------+   +----------------+   +----------------+
|    session     |   |    harness     |   |    sandbox     |
| append-only    |<--| loop + gates   |-->| execution env  |
| event log      |   | + context      |   | (filesystem,   |
| (durable,      |   |   admission    |   |  shell, net)   |
|  addressable)  |   | + evidence     |   |                |
+----------------+   +----------------+   +----------------+
        ^                    ^                    ^
        |                    |                    |
     one store          one loop             one policy
```

Rationale, from the same source: coupling all three into one container produced a *"pet"* -
*"if a container failed, the session was lost"* - and made failures unattributable: *"a bug in the
harness, a packet drop in the event stream, or a container going offline all presented the same."*

**Hard rule: the session must outlive any single sandbox, and a failure must be attributable to one
of the three.**

### 2.1 No single layer is a boundary: layer the controls, and make authority a capability

> **Corrected.** An earlier revision of this section said "the sandbox is the control of last
> resort". Community evidence refutes that: **the sandbox is also bypassable**, and in at least one
> documented case so was the kernel-level enforcement proposed as the fix.

Every layer has a published defeat in production coding agents:

| Layer | Published defeat |
|---|---|
| Static denylist | Claude Code *"bypassed its own denylist"* (Ona) |
| Process sandbox | Codex "Heapjack / Overpatch" sandbox escape -> RCE; Cursor DuneSlide CVE-2026-50548 **CVSS 9.8** - the attacker controls the `working_directory` *parameter* that the sandbox allow-list consumes |
| Kernel-level enforcement | Ona's own proposed fix was itself bypassed via the dynamic linker (mmap rather than execve) |
| **Human approval** | Wiz **GhostApproval** - a category-level flaw across six assistants: symlink following (CWE-61) + UI misrepresentation (CWE-451). The agent's reasoning says *"project_settings.json is actually a zsh config file"* while the prompt shown to the user says only *"Make this edit to project_settings.json?"*. Windsurf writes the payload **before** the Accept/Reject buttons render: *"the confirmation dialog isn't an authorization gate - it's an undo mechanism."* |
| **Human attention** | *"Manual approval prompts stop protecting users when coding agents ask too often"* (approval fatigue) |
| **The gate's own configuration** | GitHub Copilot CVE-2025-53773: injection writes `chat.tools.autoApprove: true` into settings - the agent disables its own permission gate |
| **Production monitors** | arXiv 2609.19587 *Red-Teaming Auto Mode*: against production blocking monitors (Claude Code Auto Mode, Codex Guardian), *"in **79%** of trials, the agent can use an injection attack ... to run arbitrary bash commands"* |

**The strongest measured lever is not a sandbox - it is capability scoping held outside the model's
context.** arXiv 2609.08371, *"Authority Is Not a String: A Capability-Scoped Harness for
Prompt-Injection-Resistant Coding Agents"* (verified verbatim by the main session):

> Within the agent's sandbox, these tools often carry **ambient authority: naming a resource is
> sufficient to act on it.** ... Before repository contents or tool output are read, CapScope derives
> a **task-wide authority ceiling from trusted input**. It then assigns each agent a separate set of
> **typed capabilities, stored outside the model's context.** Every tool call is checked against the
> capabilities of the agent that issued it. **Permissions assigned to one sub-agent are therefore not
> automatically available to another.**

Measured: injected effect executes in **33-47/75 runs** under ambient-authority and global-policy
baselines, versus **3/75** under CapScope, at roughly no task cost (68/75 repairs completed vs
68-72/75 for the baselines). **It is implemented on the Pi coding agent** - see open decision 1.

Design consequences, now binding:

1. **Layered controls, no "last resort" claim.** Denylist + gate + sandbox + capability scoping +
   idempotent tool contracts. Each is necessary; none is sufficient.
2. **Authority is a typed capability, not a string the model can name.** The root vulnerability is
   *ambient authority*: if naming a resource is enough to act on it, injected text can name it. The
   authority ceiling must be derived from **trusted** input before untrusted content is read, and the
   capability set must live **outside** the model's context.
3. **The gate must be checked against the issuing agent's capabilities**, so one sub-agent's grant is
   not another's.
4. **Do not design for per-action approval as the primary control.** It is non-conformant for
   authorized pentest (NIST ROE grants authority in advance), it degrades under load, and GhostApproval
   shows the dialog can misrepresent the action even when the model understands it.
5. **Context admission is not only about tool results.** "Clinejection": a prompt injection in a
   **GitHub issue title** produced CI/CD code execution and an unauthorized package publish that
   installed a remote-access agent on ~4,000 developer machines.
6. **A gate does still measurably help** - but partly by declaration. arXiv 2605.18583: a permissive
   agent cluster performed out-of-scope actions in 5.4-27.7% of runs versus 0.2-4.5% for an
   ask-to-continue framework. **However**, removing the *consent declaration* alone raised the rate
   from 0.0% to 17.1% - much of the benefit is the agent being told the boundary, not the gate
   mechanism. So: declare the boundary *and* enforce it.

## 3. The work mode: the core abstraction

A work mode is **data, not code**. The framework owns the runtime; the mode declares intent.

### 3.1 Shape

One Markdown file per mode: YAML frontmatter + body, where the body is the mode's own instructions.
This shape is taken from the one production system that already does it
(`ground-truth-claude-code-subagent-and-skill-formats.md`), because it is inspectable, diffable,
and reviewable by a human before anything runs.

### 3.2 Field groups (consolidated from three sources)

| Group | Fields | Source of the requirement |
|---|---|---|
| Identity | `name`, `description`, version, owner | Claude Code subagent schema |
| Scope (*what*) | targets with **ownership validation**, environment class (prod / non-prod), explicit exclusions | NIST SP 800-115 App. B 1.2; PTES Pre-engagement |
| Authority (*who may*) | signed permission artifact, **grant graph** incl. third parties, external approval states | PTES Pre-engagement (permission document; cloud provider pre-approval) |
| Gate | permitted/denied actions, **gate semantics** (see §4), intensity vector, excluded technique classes, time windows | SEC 15c3-5; NIST 800-115; PTES |
| Sandbox | isolation kind (none / worktree / container / network policy) | Anthropic three-seam; Claude Code `isolation: worktree` |
| Session | memory scope, turn/step budget, checkpoint policy | Claude Code `memory`, `maxTurns` |
| Capabilities | tool set, skills, MCP servers | Claude Code `tools`, `skills`, `mcpServers` |
| Evidence | required artifacts, retention, **cross-engagement isolation** | SARIF; SEC 15c3-5; PTES evidence handling |
| Coordination | aware contact, incident definition, reporting cadence | PTES incident reporting |
| Stop conditions | budget exhaustion, scope-creep guard, emergency stop | Claude Code `maxTurns`; PTES scope creep |

### 3.3 Validation contract (deliberately stricter than the precedent)

The precedent **silently ignores unknown fields**, which means a typo in a security-relevant field
fails open and silent. This framework must do the opposite:

- **Reject unknown fields.** A mode with an unrecognised key fails to load with a named error.
- **Reject a mode whose gate is unrepresentable** rather than degrading to "allow".
- **Require the required fields explicitly**; a mode missing scope, authority, or gate semantics
  does not load.
- **Require the capability set.** See the empirical finding below.

#### Why the capability set is required, against ecosystem convention

Measured across real corpora (`ground-truth-work-mode-field-usage.md`; numbers reproduced by the
main session running the analysis itself): `name`, `description`, and `model` appear in ~100% of
real agent definitions, but **`tools` appears in only 15 of 202 (7%) in the largest corpus** and in
161/161 of another. **Tool restriction has not converged.** There is no ecosystem convention in which
an agent declares its own authority - yet the root vulnerability of prompt injection is *ambient
authority*: naming a resource is enough to act on it (arXiv 2609.08371, "Authority Is Not a String").

So the framework **cannot inherit authority scoping from the prevailing format.** It must make the
capability set a required field, and accept that this makes its modes **non-portable** to harnesses
that do not understand it. That is the correct trade: a mode that cannot declare its authority cannot
be reviewed before it runs.

### 3.4 Mode layout and schema (resolved)

**Decision (closes open decision 10.3): a mode is a directory of three files.** One interop
artifact that stays portable, plus two governance artifacts that are separately versioned and
separately reviewable.

```text
modes/<mode-id>/
  MODE.md            # Agent-Skills-compatible: name + description + body instructions
  governance.yaml    # scope, authority, gate, sandbox, session, evidence, coordination, stop
  permissions.yaml   # always_allow / ask_before / never_allow
  scripts/           # optional, referenced by the body
  references/        # optional
```

**Why this layout, from the survey:**

| Choice | Precedent |
|---|---|
| Directory with `MODE.md` + `scripts/` + `references/` | The **Agent Skills** directory shape is the only cross-vendor standard, and four independently surveyed repos (crewAI, agno, mastra, strands) adopted it in the same window. It has a validator. One surveyed repo compiles a single such source into **six** harness formats, including a Pi adapter. |
| Core frontmatter limited to what the ecosystem converged on | Measured across four corpora: `name` and `description` at ~100%, `model` near-universal, `tools` inconsistent (15/202 in one corpus, 161/161 in another). Keep the portable core to that set. |
| **Governance in a separate file** | Nothing in the surveyed ecosystem carries an evidence contract or stop conditions. Putting them in the same file as the prompt would either be ignored by other harnesses or break the portable core. Separating them keeps `MODE.md` a valid skill. |
| **Permissions in a third file** | goose's `Recipe` + `permission.yaml` split. It keeps a fail-closed deny list out of prompt text and lets a reviewer diff the permission set on its own. |

#### `MODE.md` (portable core)

```markdown
---
name: <mode-id>              # R  matches the directory
description: <when to use>   # R  the delegation trigger; keep short (catalogue budget)
license: <spdx>              # optional
compatibility: <note>        # optional
metadata: { ... }            # optional
---
<body: the mode's own instructions>
```

#### `governance.yaml` (required, validated, versioned)

```yaml
version: semver               # R  of this governance document
framework: ">=x.y <z"         # R  compatibility range

scope:                        # R  WHAT may be touched
  targets: [ ... ]
  environment: production | non-production | test
  exclusions: [ ... ]
  ownership_evidence: ref     # R for pentest-class modes

authority:                    # R  WHO may act, and under what grant
  grant: ref                  # R  e.g. a signed permission artifact
  grant_graph: [ ... ]        # R  client -> third-party providers; permission is a graph
  capabilities: [ ... ]       # R  typed; stored OUTSIDE the model's context
  expires: timestamp

gate:                         # R  HOW each proposed action is judged
  semantics: limit | conformance | both
  limits: { ... }             # limit semantics (SEC 15c3-5 pre-trade thresholds)
  intensity: { phase: level } # per-phase vector, not a scalar
  excluded_techniques: [ ... ]
  windows: [ ... ]
  approval: none | contract | per-action

sandbox:                      # R
  isolation: none | worktree | container | vm
  network: policy
  filesystem: policy

session:
  memory_scope: user | project | local | none
  budget: { turns, model, tokens, cost_multiplier, exploration }

evidence:
  format: native | sarif
  artifacts: [ ... ]
  retention: duration
  isolation: per-engagement   # R

coordination:
  aware_contact: ref
  incident_reporting: ref
  cadence: { plans: bool, progress: bool, problems: bool }

stop:
  on: [ ... ]
  emergency_stop: ref
```

#### `permissions.yaml` (required)

```yaml
always_allow: [ <tool or tool(pattern)> ]
ask_before:   [ ... ]
never_allow:  [ ... ]         # deny wins over every other list and over every mode
```

#### Validation rules (all fail-closed)

- **Reject unknown fields** with a named error. The precedent silently ignores them, so a typo in a
  security field fails open and silent.
- **Require** `MODE.md`, `governance.yaml`, and `permissions.yaml`. A mode missing any of them does
  not load.
- **Require** `scope`, `authority.capabilities`, and `gate.semantics`. An absent authority boundary
  is a load-time failure, not a permissive default (section 4.4.1).
- **Refuse** a mode whose `framework` range excludes the running version, rather than partially
  applying it.
- **`never_allow` wins** over `always_allow`, over `ask_before`, and over any mode setting.

#### Every run records which mode version it used

The survey found that **no surveyed project records which mode version a given run used** - versions
pin content, and only evals pin behaviour. The evidence record therefore carries **mode id + mode
version + governance version** on every action. This is the only way to answer "what was this agent
allowed to do when it did that?" after the fact, and it is required by the acceptance criterion that
100% of executions have a terminal evidence record.

### 3.5 The authority grant graph (resolves open decision 10.4)

**This was the largest genuinely unsolved piece of the design.** No standard defines a
machine-readable form: NIST SP 800-115, PTES, and the SEC material all describe authority as
*documents*. The survey found exactly two working implementations in the wild (both pentest), and
neither carries a time window or named personnel. The design below is therefore new work, derived
from those two implementations plus the standards' field lists.

#### The binding constraint first: the agent must not be able to write its own authority

GitHub Copilot CVE-2025-53773 is the precedent: a prompt injection wrote
`chat.tools.autoApprove: true` into settings, and **the agent disabled its own permission gate**. Any
authority representation is worthless if the thing being governed can edit it.

> **Requirement:** the authority documents live outside every capability granted to the agent. No
> mode, tool, or capability may write them. A run whose authority file changed mid-run is
> **terminated**, not continued.

#### Shape

```yaml
# authority.yaml - the grant graph for one engagement
version: 1
engagement: <id>

principals:                   # R  who is who
  - { id: client,           kind: grantor }      # commissions the work
  - { id: operator,         kind: operator }     # runs the agent
  - { id: cloud-provider-x, kind: third-party }  # hosts a target we do not own

grants:                       # R  the edges. Permission is a graph, not a boolean
  - id: g-client-scope
    from: client              # R  MUST NOT be the operator
    to: operator
    authorizes:
      actions:  [scan, exploit]                 # NIST: scope is actions...
      outcomes: [findings-report]               # ...AND expected outcomes
    targets:  [t-web-1, t-api-2]
    window:   { from: <ts>, to: <ts> }          # temporal scope is part of the contract
    evidence:                                   # R  documentary precondition
      - { kind: signed-permission, ref: <uri>, sha256: <digest>, signed_by: client }
    constraints:
      intensity: { discovery: 2, exploitation: 1 }   # per-phase vector, not a scalar
      excluded_techniques: [dos, social-engineering]
      max_requests_per_second: 5
    risk_acceptance:
      - { risk: service-disruption, mitigation: outside-business-hours, accepted_by: client }

  - id: g-provider-approval
    from: cloud-provider-x      # a third party's permission is required separately
    to: operator
    authorizes: { actions: [scan], targets: [t-web-1] }
    external_state:             # PTES: some providers require their own approval
      { kind: provider-approval-form, ref: <uri>, state: approved|pending|expired, checked_at: <ts> }

targets:                      # R
  - id: t-web-1
    address: <cidr-or-host>
    owner: client
    ownership_evidence:         # R  PTES: validate ownership BEFORE acting
      { kind: asset-inventory-attestation, ref: <uri>, sha256: <digest> }
    requires_grants: [g-client-scope, g-provider-approval]   # ALL must resolve
```

#### Resolution rule (fail-closed, and it is the whole point)

An action `A` against target `T` is admitted **iff every** condition holds:

1. `T` resolves to exactly one entry in `targets`.
2. `T.ownership_evidence` is present and its digest matches.
3. **Every** grant in `T.requires_grants` is present, unexpired, and covers `A`'s action.
4. Each such grant's `evidence` is present and its digest matches.
5. Where a grant has `external_state`, that state is `approved` and `checked_at` is fresh.
6. `A` is inside the grant's `window`, `intensity`, and not in `excluded_techniques`.
7. No `never_allow` entry in `permissions.yaml` matches `A`.

**If any condition cannot be evaluated, the action is blocked.** An empty `targets` list, an unknown
target, a missing grant, or an unresolvable chain are all **blocks with a named reason** - never
"unrestricted by design". This is the direct fix for the survey's cleanest fail-open pair
(`redcell` returns `True` for an empty scope; `Armur` returns a violation error in the same state).

#### The document is diffable, and a change invalidates

The graph carries a content hash. Any change to a grant, a target, or an evidence digest is surfaced
as a **diff with a non-zero status before the next action**, and prior authorization for the changed
entries is void until re-approved. This is taken from the one implementation in the wild that does it
(`Armur`'s `scope diff`).

#### What the gate returns

A block names the specific unsatisfied condition - which grant is missing, which evidence digest
mismatched, which window closed - **and what to do instead**. The survey found that a bare refusal
causes the model to retry the identical action, so remediation is part of the contract, not a nicety.

#### Why a graph and not a list

Three concrete cases a flat allowlist cannot express, all sourced:

- **A third party's permission is required separately.** PTES: *"permission may have been granted by
  the client, they do not speak for their third party providers."*
- **Some providers gate on their own external approval** (the Amazon request-form case), which has a
  state that must be re-checked.
- **Ownership must be validated, not assumed.** PTES: attacking a host that turns out to belong to a
  hospital or government agency is the failure this prevents.

## 4. Control model: gates, implementation patterns, and orchestration

The survey found exactly one structural conclusion that all systems agree on: **a blocking gate is a
pre-execution, parameter-level check at the tool-dispatch boundary, owned by the caller.** Every
verified blocking gate (Pi `beforeToolCall`, dsh `ctx.approval.request`) is caller-supplied; MCP
has none by design; OpenAI's guardrails default to running in parallel with execution.

So the framework provides **one** boundary and **two** built-in semantics:

| Semantics | Decision rule | Required by |
|---|---|---|
| **Limit gate** | allow iff the proposed action is within declared numeric/structural limits; otherwise block, always | SEC 15c3-5 (pre-trade thresholds, erroneous orders) |
| **Conformance gate** | allow iff the proposed action is inside the pre-established authority contract; otherwise block | NIST SP 800-115 ROE (scope is *actions and expected outcomes*) |

Both are **fail-closed**: an unevaluable action is blocked, not allowed.

### 4.1 Why not per-action approval as the primary model

NIST defines ROE as granting authority *"without the need for additional permissions."* A framework
that only offers per-action prompting is not a conformant implementation of authorized testing. Per
action approval remains available as an *additional* gate, not the only one.

### 4.2 Gate inputs

The gate must see: the resolved tool, the validated arguments, the current mode, the resolved
authority chain for the target, the elapsed window, and the accumulated intensity. A gate that only
sees the tool name cannot implement either semantics.

**Canonicalisation requirement (from GhostApproval and DuneSlide).** The gate must canonicalise
**both** the string it decides on **and** the string shown to a human - resolving symlinks, `..`,
and pseudo-paths such as `/proc/self/root` - and **fail closed if the two differ**. GhostApproval is
precisely this failure: the model's reasoning identified the real target while the confirmation
prompt displayed a benign name. DuneSlide is the same class from the other side: the attacker
controlled the `working_directory` *parameter* that the allow-list consumed. A gate that decides on
one representation while a human approves another is not a gate.

### 4.3 Gate implementation patterns taken from real systems

The GitHub survey read the actual control code in 17 vertical implementations and 22 frameworks. Six
patterns are worth adopting directly, because each was learned from a failure.

| Pattern | Source | Why |
|---|---|---|
| **Split the artifact in two**: the mode file says *what to do*; a separate, separately-versioned permissions file says *what is allowed* | goose `Recipe` + `permission.yaml` (`always_allow` / `ask_before` / `never_allow`) | Keeps a fail-closed deny list out of prompt text, and lets the permission file be reviewed and diffed on its own |
| **Declare the policy externally, enforce it inside the loop, deliver the reason as a typed result, and make it inheritable** | strands `interventions` - a `.cedar` policy file or a natural-language rubric, resolved in a library-owned loop; **a subagent inherits the policy and cannot bypass it** | Verticals will spawn subagents; a gate a delegate can escape is not a gate |
| **Log the gate's INVOCATION, not only its decision** | Armur's `ValidateAndLog` emits DEBUG on allow and WARN on deny, explicitly *"so that a future bug where a caller silently eats the error still shows up in the log stream"* | This is the only defence against a gate that exists but is **off the path** - the failure mode the survey found most often |
| **A block carries remediation, not only refusal** | Dark-Moon returns the reason plus "DO THIS INSTEAD" | Otherwise the model retries the identical command |
| **Finding identity must exclude model prose, and the key must be versioned** | open-code-review fingerprints `sha256(Path\|Category\|ExistingCode)` with the comment *"not message.text, which is LLM prose that varies across runs"*, key `ocrFinding/v1`; pr-agent uses `STATE_SCHEMA_VERSION=1` and OR-matches a body fingerprint against a code fingerprint because an LLM restates one defect two ways | A prose-derived identity is not stable across runs, so the baseline diff is meaningless |
| **Idempotency is a separate control from scope, and the framework owns the key** | None of the surveyed pentest repos has one; closest is nautilus (`client_order_id` + `cache.order_exists` + venue duplicate rejection) | Corroborates §5.2 from a second direction: the guarantee belongs in the contract, and the identity must be framework-generated |

### 4.3.1 Fail-open is the observed default, and it is the thing to design against

The survey's single most common finding: **the control lives in the model's context rather than at the
execution boundary - and where it IS at the boundary, the default is fail-open.** The cleanest
evidence is a matched pair:

- `redcell`: `in_scope` returns `True` for an empty scope (*"An empty scope is unrestricted by
  design"*), and `_command_scope_block` returns `None` when no scope is set. **A campaign started
  without a scope has no gate at all.**
- `Armur-Ai/Pentest-Swarm-AI`: returns `ScopeViolationError` in the same state.

Also observed: a single bypass flag defeats the gate (`nautilus`: `if self.config.bypass { ... }`).

**Binding rule:** an absent or unrepresentable authority boundary is a **load-time failure**, not a
permissive default. A mode with no scope, no capability set, or an unparseable permission file does
not load. This is already in §3.3; the survey shows it is the single highest-value rule in the design.

### 4.4 Orchestration shapes: support three, refuse two, and budget the multiplier

The community wave measured which orchestration shapes survive production. The framework should make
the supported set explicit rather than offering a topology menu.

### Supported (with the evidence)

| Shape | Evidence |
|---|---|
| **Sectioning** - independent subtasks, isolated contexts, fan-out/fan-in | The **only** pattern with unanimous production support; Anthropic reports up to 90% wall-clock reduction from 3-5 parallel subagents |
| **Prompt chaining** as a fixed pipeline | Agentless (arXiv 2407.01489, verified verbatim): a three-phase localize/repair/validate pipeline with *no* agent loop achieves *"both the highest performance (32.00%, 96 correct fixes) and low cost ($0.70) compared with all existing open-source software agents"* on SWE-bench Lite |
| **Heterogeneous adversarial verification** - a critic from a *different* model family or a *different* context | Debate beats consultancy across tasks (arXiv 2407.04622); the practitioner form is cross-vendor review |

### Refused as defaults (with the evidence)

| Shape | Why |
|---|---|
| **Voting / tournament with correlated agents** | Anthropic's own Frontier Red Team (verified verbatim): *"Individual agents are 'low variance'... **when one agent makes a bad decision, it is likely that many agents will make that same bad decision. What would have been isolated problems can quickly become systemic failures.**"* Observed: **18 of 30 agents chose the identical git branch name**; multiple agents independently titled fiction *"The Cartographer's Last Commission"*; over half built ray tracers or self-hosting compilers; pricing agents colluded by round 3. Corroborated by *Artificial Hivemind* (arXiv 2510.22954) on inter-model homogeneity. **Repetition of the same model on the same context buys correlated error at N times the cost.** |
| **Unconstrained orchestrator-workers / loop-until-done** | τ-bench: SOTA below 50% success with **pass^8 < 25%** - reliability dies on repetition, which is exactly what "loop until done" does. Practitioner report: *"Letting agents talk to each other directly was a mess. Define the task graph yourself: agents only handle the leaf nodes."* |

### Consequences

1. **Diversity must be structural, not statistical.** If a mode wants N opinions, they must differ by
   model family, by retrieved context, or by task decomposition - never by resampling one context.
2. **The framework owns the task graph; workers own leaves.** Exploration beyond the pre-assigned
   space is the one measured case where a fixed workflow loses real value (266 vulnerabilities found
   by a coordinating swarm versus 21 by a fixed workflow, only 12 overlapping) - but equalize the
   search space and *"the two methods seem comparable in terms of tokens per vulnerability found"*.
   So an **exploration budget** is a first-class mode field, not a topology choice.
3. **Token multiplier is a first-class budget.** Anthropic states roughly 4x tokens for an agent and
   ~15x for multi-agent. Cost is a top-three cited bottleneck and every published multi-agent win is
   reported without it. A mode must declare its multiplier budget and the framework must enforce it.
4. **Evaluation is the differentiator, not orchestration.** Every serious community source lands on
   evaluation as the #1 bottleneck - *"I lack the time and motivation to thoroughly evaluate all my
   created workflows. This prevents me from gaining confidence in their value"* - and the recommended
   remedy is small-sample evaluation starting immediately. A framework that makes evaluation cheap
   contributes more than one that adds topologies.

## 5. Execution and resume model

### 5.1 Own the loop, thinly

Verified: `@earendil-works/pi-agent-core`'s `Agent` takes a **required caller-supplied
`streamFn`** and exposes `beforeToolCall`, `transformContext`, `afterToolCall`,
`shouldStopAfterTurn`, `prepareNextTurn`. That is a sufficient seam to own the loop without owning
the model transport. The framework should target this shape: **the loop is ours, the provider is
pluggable, and a scripted offline provider must be a first-class citizen** (Pi's `faux` provider is
the existence proof).

### 5.2 Exactly-once belongs in the tool contract, not only in the loop

> **Corrected.** An earlier revision framed this as "effect idempotency is a framework
> responsibility". Measurement says the harness **barely matters** and the **tool contract is the
> lever** - which is good news, because the contract is portable across harnesses.

Verified framework semantics (the problem is real):

- ADK: tools *"are run **at least once**, and may run more than once when resuming"*.
- LangGraph: *"the runtime restarts the entire node from the beginning."*
- arXiv 2608.03836 *"Resume Means Resume"*: five widely deployed frameworks, *"none exposes a
  machine-checkable contract, and measured behavior violates even the fragments they state"* -
  LangGraph 1.2.9 is *"exactly-once across interrupts, **at-least-once across crashes**, on one API"*.

And the measurement, arXiv 2609.29095 *"Where Does Exactly-Once Live?"* (LIMBO; 25,930 episodes,
nine models, three production harnesses, twelve fault modes, graded against a committed-effects
ledger - verified verbatim):

> When an immediate read-back can reveal what happened, the model decides: frontier models instructed
> to act exactly once almost never duplicate a write whose acknowledgement was lost (**0.5%**) ...
> When it cannot - the request is still in flight, or the transport delivered it twice - the same
> frontier models duplicate in **56% and 74%** of episodes, and **the contract explains 81%**. We
> prove that **no verification-only policy is exactly-once under late commits** without a bound on
> in-flight time.

Therefore, binding:

- Every action carries a **framework-generated effect identity** before dispatch, **and that identity
  is used as an idempotency key the backend/tool actually honours.** Loop-level deduplication alone
  cannot be exactly-once under late commits or double delivery.
- **Consume-once must happen in a shared store on the read path**, not in process memory:
  *"k processes resuming one parked interrupt fire the gated effect k times, saturation 1.0 in 36 of
  40 cells, and the failure crosses hosts"* (arXiv 2608.03836).
- A mode declares, per effect, whether the effect is idempotent, key-idempotent, or
  non-idempotent. A **non-idempotent** effect requires explicit confirmation on first execution and
  is never auto-retried.
- Agents report success while having duplicated: *"agents reported success in 90% of the episodes in
  which they had duplicated an effect."* So a self-reported success is not evidence of
  single execution; the ledger is.

### 5.3 Checkpoint unit

Checkpoint at the **action** boundary, not the model turn: the unit that matters for evidence and
for non-replay is "an effect was admitted and completed", not "a model turn ended".

## 6. Evidence plane

- One append-only, per-engagement log; the session log is the source of truth.
- Each action records: effect identity, mode id + version, resolved authority reference, decision
  (allowed/blocked), gate reason, start/end, outcome, and artifact references.
- **Cross-engagement isolation is a hard requirement** (PTES: *"don't re-use a report from another
  customer engagement as a template"*). Evidence is partitioned by engagement, and an artifact from
  one engagement is never readable as a template for another.
- Where a vertical has a standard output format, the evidence plane emits it: SARIF for code
  auditing (`fingerprints`, `partialFingerprints`, `correlationGuid`, `baselineState`,
  `occurrenceCount`, `rank`).

## 7. Context admission

One centralized admission boundary, applied to tool results, extension messages, and background
notifications - not only to `tool_result`. Motivated by a first-hand incident recorded in this repo
(`09-06-dove-workspace-modes-context-isolation`): a **2,865,326-character** diagnostic result
(~95% of a session's tool-result text) reached the model through a background path that bypassed the
existing compaction. Verified additionally that Pi's own compaction truncation
(`TOOL_RESULT_MAX_CHARS = 2000`) applies **only** when serializing for a summary prompt, i.e. it is
not an admission bound.

## 8. Extension seam: how a vertical plugs in

A vertical ships **work modes**, not code:

1. A mode file (declarative, §3).
2. Optionally, capability implementations the mode references.
3. Optionally, gate predicates beyond the two built-ins.

No core code changes. If a vertical needs a core change, that is a framework defect, not a vertical
feature.

## 9. Compatibility, rollout, rollback

- **Rollout**: one vertical at a time, starting with code auditing (reversible actions, SARIF output
  contract, lowest blast radius), then penetration testing (contract gate), then trading (limit gate,
  highest blast radius).
- **Rollback**: disabling a mode must not require a framework change; disabling the framework must
  leave the session log readable and the evidence intact.
- **Compatibility**: a mode declares the framework version range it targets; an out-of-range mode is
  refused rather than partially applied.

## 10. Decisions

### 10.1 RESOLVED - loop ownership: we define the interface, Pi is an adapter

**Decision: the framework defines its own minimal loop interface. `@earendil-works/pi-agent-core`'s
thin `Agent` becomes one adapter behind it, never the foundation.**

Reasoning (each point verified earlier in this task):

- **Owning the interface makes the adapter choice reversible** - which is the property that matters
  given the substrate's state. The package is a **nested** dependency rather than a direct one, the
  installed version is 0.84.3 against 0.87.1 published, and it ships **two parallel harness stacks**
  with one marked `./experimental/pico3`.
- **The thin path is verified working.** `streamFn` is required and caller-supplied, so the model
  transport is already pluggable; `beforeToolCall` blocks in compiled code
  (`agent-loop.js:419-429`, executed to confirm).
- **Adopting it behind our interface costs nothing**, because Pi's own shape already matches what we
  need: caller-supplied transport plus a pre-execution hook.
- **Independent corroboration that owning the loop is the right default.** 12-Factor Agents Factor 8
  asks for exactly this interrupt, *"especially between the moment of tool selection and the moment
  of tool invocation"*; Anthropic's own production guidance is *"don't hesitate to reduce abstraction
  layers and build with basic components as you move to production"*; and the 22-framework empirical
  study found failures were *"mainly caused by orchestration problems rather than reasoning limits"* -
  so the loop and its state handling is precisely the part not to outsource.
- **Direct prior art on this substrate.** CapScope (arXiv 2609.08371) is implemented on the Pi coding
  agent and evaluated over 300 runs in the orchestrator-delegates-to-sub-agents shape. **Caveat: the
  paper does not say whether it targets `AgentSession` (the product path) or the stub
  `AgentHarness`. It does not validate the stub.**

**Consequence:** the first adapter targets `pi-agent-core`'s thin `Agent`. The GitHub wave can still
change **which adapter ships first**; it cannot change the interface decision, and that is the point.

### 10.2 RESOLVED - the sandbox is not a single last resort

See section 2.1. Published defeats exist for denylists, process sandboxes, kernel enforcement, human
approval, the gate's own configuration, and production blocking monitors. The framework layers
controls, with **capability scoping stored outside the model's context** as the strongest measured
lever (3/75 versus 33-47/75 injected effects, at roughly no task cost).

### 10.3 RESOLVED - work-mode layout and field names

A mode is a three-file directory: a portable `MODE.md` (Agent Skills shape), a `governance.yaml`
carrying the fields nothing else in the ecosystem has, and a `permissions.yaml` carrying the
fail-closed deny list. See section 3.4 for the layout, the schema, and the validation rules.

The **shape** is frozen (section 3.4); the **names** are not. Waiting on the GitHub wave's survey of
existing declarative formats, so that we adopt names people already know where that is free.

### 10.4 RESOLVED - authority grant graph representation

See section 3.5: principals / grants / targets, an all-grants-must-resolve rule that fails closed
on anything unevaluable, a content hash that makes the document diffable and invalidates on change,
and the binding requirement that the agent cannot write its own authority.

No standard defines one - NIST, PTES, and the SEC material all describe these as *documents*. This is
design work, not a lookup. It is the largest genuinely unsolved piece of the design.

### 10.5 RESOLVED - first adapter is `pi-agent-core`'s thin `Agent`

The GitHub survey settled this by elimination. Its finding, verbatim: **"The '200-line loop + real
gate' combination does not exist in this survey."** Everything with a real gate is a full harness;
everything thin has no gate.

So the design's shape - own the loop interface, adopt a thin loop as an adapter, put **our** gate at
the dispatch boundary - is the only available path to a thin loop with a real gate. Within that
shape, `pi-agent-core`'s `Agent` is the best candidate because it is the only thin loop verified to
block in compiled code, and because CapScope demonstrates capability scoping on that same substrate
over 300 runs.

**Reversal cost is one adapter implementation**, which is why this is safe to decide before
implementation. If the adapter proves unsuitable, nothing else in the design moves.

Whether the first shipped adapter is `pi-agent-core`'s `Agent`, or a direct provider-interface
implementation, pending the GitHub wave's comparison of thin runtimes. This is reversible by
construction (10.1).

## 11. Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Adopt a full agent framework (LangGraph / AutoGen / MS Agent Framework / AgentHarness) as the base | Inherits another project's opinions about sessions, skills, prompts, telemetry. Anthropic's own guidance: *"don't hesitate to reduce abstraction layers and build with basic components as you move to production."* And the installed Pi harness is a verified stub. |
| Build the gate on "guardrails" | Guardrails are screening, not enforcement. Anthropic files them under parallelization; OpenAI's default runs them in parallel with execution. |
| Delegate enforcement to MCP | MCP states it cannot enforce at the protocol level; approval is explicitly a host concern. |
| Rely on the runtime for exactly-once effects | Two independent vendors document at-least-once / node-restart semantics. |
| Per-action human approval as the only gate | Contradicts the definition of an authorized engagement (ROE grants authority in advance). |
| One monolithic "agent" object | Coupling session, loop, and execution environment made failures unattributable in the vendor's own post-mortem. |
