# The Framework: a harness that improves itself with one thing it cannot improve

**Status:** design, not implemented. Written 2026-09-30 for task `09-30-substrate-choice`.
**Sources:** AHE (arXiv:2604.25850), Self-Harness (arXiv:2606.09498), RSI-Bench (github.com/sunghunkwag/rsi-bench, a framework with no paper), plus this repository's own harness contract (`.trellis/spec/backend/personal-agent-harness-loop.md`).
**Language note:** English, because the terminology is the sources' and because this document is a candidate to become a routed specification.

---

## 1. The problem, in one sentence

A harness that improves itself must have **something it cannot improve** — otherwise "improvement" and "redesign" are the same operation and no gain is attributable.

Everything below follows from that sentence. The three primary sources each answer it, and they answer it **the same way**: they hold the evaluator fixed.

## 2. What the sources actually require (quoted; nothing below is invented here)

### 2.1 Self-Harness — *Harnesses That Improve Themselves* (arXiv:2606.09498)

| What it requires | Quote |
|---|---|
| The evaluator is fixed; only the harness moves | §3.1: *"In this work, the model M and evaluator E are held fixed, while the harness is treated as the object of improvement."* |
| Evidence and judgement are split into two task sets | §4.1: *"the held-in split supplies the trajectories, verifier outcomes, and failure evidence exposed to the proposer, while the held-out split is never shown to the proposer and is used only by the automatic promotion gate."* |
| Promotion is conservative: no trading one split for another | §3.4: *"A candidate is accepted only if it improves at least one split without degrading the other: Δin(j) ≥ 0, Δho(j) ≥ 0, max(Δin(j), Δho(j)) > 0."* |
| A failure signature separates symptom from mechanism | §3.2: *"two runs may share the same verifier outcome, such as a timeout or missing artifact, while requiring different harness changes because the underlying agent behaviors differ."* Signature `φ(r_i) = (c_i, q_i, m_i)` — verifier-level cause, causal status, agent mechanism. |
| The proposer is given a bounded context, including what must not regress | §3.3: *"the editable surfaces of the current harness, the verifier-grounded failure patterns from the evaluation system, **records of passing behaviors that should be preserved**, and summaries of previously attempted edits."* |
| Every proposal is auditable, including rejections | §3.4: *"the system records the changed surfaces, split-wise outcomes, evaluation repeats, proposal summary, and accept/reject decision, making each transition in the harness lineage auditable."* |

Loop: **Weakness Mining → Harness Proposal → Proposal Validation**. Measured: every final harness improved Pass on **both** splits across nine model–benchmark combinations; largest gain +40.6 pp (AppWorld, GLM-5); *"no promoted harness degrades either split."*

### 2.2 AHE — *Agentic Harness Engineering* (arXiv:2604.25850)

| What it requires | Quote |
|---|---|
| An explicit, revertible action space | Abstract: *"component observability gives every editable harness component a file-level representation so the action space is explicit and revertible"*. |
| The action space is seven components at fixed mount points | §3.1: *"system prompt, tool description, tool implementation, middleware, skill, sub-agent configuration, and long-term memory."* |
| One logical edit = one commit | §3.1: *"Each logical edit becomes one commit on the workspace's git history, which yields file-level diffs and rollback granularity for free."* |
| **A writable workspace and a read-only outside** | §3.3: *"the Evolve Agent writes only inside the harness workspace, while the runs directory, tracer, verifier, and LLM configuration are read-only, and the seed system prompt … is marked non-deletable. These restrictions block the shortcuts an unconstrained self-modifier would take, such as disabling the verifier, swapping the model, or raising the reasoning budget, and keep every recorded gain attributable to harness edits."* |
| Every edit ships a recorded prediction, including predicted regressions | §3.3: *"a manifest entry that names the failure evidence, the inferred root cause, the targeted fix, and a predicted impact comprising both expected fixes and at-risk regressions"*; the next round intersects prediction with observed deltas to produce a per-edit verdict. |
| Attribution and rollback are steps of the loop | Algorithm 1, steps 7–8: `V_t ← Attribute(C_{t-1}, T_{t-1}, T_t)` then `H_{t-1} ← Rollback(H_{t-1}, V_t)`. |
| The self-judgement is weak, and measured | §4.4.2 + Appendix D: over the **89 tasks of Terminal-Bench 2**, 9 rounds, the evolve model issued 43 regression predictions and **5 landed** (cumulative **P 11.6%**, **R 11.1%**), against random baselines of 5.6% / 5.4% — *"so most upcoming regressions go unforeseen."* Fix predictions were better: 33.7% / 51.4%. |

### 2.3 RSI-Bench — the measuring instrument for RSI (no paper; a framework)

Six axes: SMD, ITQ, ODR, MAS, **SSM**, AGG. The relevant one:

> `| **Safety & Stability (SSM)** | Does self-modification preserve system integrity? | Crash-free ratio, Pareto preservation, sandbox violations |`

Its own methods note says of itself: *"Measurement categories described by RSI-Bench, not achieved results"*, and *"Missing is not zero."* The composite is a weighted harmonic mean, *"which penalizes systems that score zero on any dimension"*.

### 2.4 The convergence that decides the architecture

**AHE and Self-Harness both keep the evaluator out of the improver's reach**, and they are precise about it in different *kinds* of statement:

- **Self-Harness states it as a principle**: *"the model M and evaluator E are held fixed"* (§3.1) — plus the held-out split never shown to the proposer (§4.1).
- **AHE states it as a mechanism**: the read-only enumeration of runs / tracer / verifier / LLM config (§3.3), with the verifier external and never editable — *"Harbor dispatches tasks, isolates each rollout, and verifies pass/fail"* (Appendix A).

**A precision this document owes its reader:** AHE never uses the words *independence*, *separation of powers*, or *evaluator isolation*. Reading its read-only enumeration as a requirement on improver/evaluator separation is an **inference from §3.3 + Appendix A**, not a quote. The same caution applies to AHE's own §3.1: *component observability* is about making the surface explicit and revertible; it does not say who may edit what.

**Neither designs recursive self-improvement.** RSI is *measured* by RSI-Bench, not practised by these two. So this repository's stance — *"recursive self-improvement … is the axis this project explicitly declines"* (`personal-agent-harness-loop.md:20-29`) — **agrees with both primary sources**. A move toward RSI is a deviation from all three and must be argued rather than assumed.

**And AHE says so about itself** (`#Sx1`, verbatim): *"AHE bounds edits to a workspace, attributes every change in a versioned manifest, and rolls back ineffective edits at file granularity, but it **does not provide a complete guardrail stack**. Long-horizon harness cleanup and stronger misuse prevention remain incomplete, and AHE should be viewed as a **controlled research prototype rather than a fully mature autonomous self-improvement system**."*

**Which means this framework inherits an unfinished guardrail problem, not a solved one.** That is the honest status of the field as of the sources read.

### 2.5 Peer practice: Plane B already ships, in two products

The architecture is not exotic. Two shipped harnesses already do the essential thing — **confine writes to a workspace and keep the config out of it**:

| Product | The Plane-B-shaped mechanism (quoted) |
|---|---|
| **Codex** | Writes are confined to the workspace plus temp dirs — *"The workspace always includes the current directory plus temporary directories like `/tmp`"*, *"Codex requires approval for actions outside the workspace or for network access"* — which puts `~/.codex/config.toml` **outside the default writable set**. Its sandbox enum is *"read-only, workspace-write, danger-full-access"* — **the same three names this install's presets use**. And approvals can be routed away from the agent entirely: `approvals_reviewer = user \| auto_review \| guardian_subagent`. |
| **Claude Code** | The sandbox is OS-enforced for shell and children, and **repo settings specifically cannot weaken it**: *"Project settings in `.claude/settings.json` and `.claude/settings.local.json` can't [set filesystem isolation], so a checked-out project can't switch filesystem isolation off."* It also has the explicit rule *"no agent message can change a subagent's permission settings, `CLAUDE.md`, or configuration"*, a `ConfigChange` hook that *"can block configuration changes from taking effect"*, and a real revert path (`/rewind` file checkpoints, with stated limits: *"Bash command changes not tracked"*, *"Subagent edits not restored … Use git to revert them"*). |
| **Pi** | **Nothing of the kind.** No evaluator separation documented; no built-in revert (the security page defers to *"snapshots, backups, or version control"*); *"lack of a built-in sandbox"* is listed as outside its security boundary; extensions run *"inside the Pi process with the same operating-system permissions"*; plugins are experimental and **presets/subagents are not documented at all**. This is the same verdict the vendored-code pass reached from the other direction: **Plane B cannot be built on Pi.** |

Two more convergences worth noting, because this repository already arrived at them independently:

- **AHE requires registration as part of the edit** — *"Creating a file is NOT enough -- register in `code_agent.yaml`"*. This repository already enforces the same rule in both directions between `.trellis/harness-surface.yaml` and `CHANGE_SURFACES`.
- **AHE found that more machinery is not more gain**: three single-component variants beat the seed, and *"the three positive single-component gains sum to +11.1 pp against full AHE's +7.3 pp"*; the system-prompt swap alone is a **regression** (−2.3 pp), and on the Hard tier the memory-only variant **beats the full harness**. That is measured support for this repository's own conclusion that unearned density is the defect — and a warning against assuming Plane B plus everything else is additive.

---

## 3. The framework: three planes

```
┌─ Plane B — held out, not writable by the improver ───────────────────────┐
│  the held-out task split          (Self-Harness §4.1)                    │
│  the verifier + runs dir + model config   (AHE §3.3, read-only)          │
│  the promotion gate               (Self-Harness §3.4)                    │
│  the human keep/revert            (this repository's rule: nothing acts) │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ verdict + promotion decision
┌─ Plane C — the loop ──────────┴──────────────────────────────────────────┐
│  mine → propose → validate           (Self-Harness)                      │
│  manifest: evidence / root cause / fix / predicted fixes + regressions   │
│  next round: Attribute, then Rollback if the verdict says so (AHE)       │
│  invariant: Plane A never writes Plane B                                 │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ one logical edit = one commit
┌─ Plane A — writable: the harness workspace ──────────────────────────────┐
│  the seven components at fixed mount points (AHE §3.1)                    │
│  = this repository, behind `.trellis/harness-surface.yaml`                │
│  apply = one commit; revert = `git revert`                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**The one relationship that makes it bounded:** the improver's power is exactly *Plane A minus Plane B*. Plane A is where recursion is allowed to happen — including edits to the **inner** instruments (the axis reading, the failure reading, the ledger schema). Plane B is what decides whether those edits were improvements, and it is not Plane A's to write.

**What "RSI" means here, decided rather than assumed:** the *inner* verifier may rise with the system (that is what a recursive loop needs); the *outer* evaluator may not. A loop that raises both is not bounded by anything and is not what any of the three sources designs. If the outer evaluator is to rise too, that becomes a separate proposal whose subject is Plane B — and it has no fixed point left to judge it, which is the definition of the axis this project declines.

## 4. The turn (this repository's seven steps, now with named counterparts)

| Step (`.trellis/spec/guides/harness-loop-turn.md`) | Counterpart in the sources |
|---|---|
| 1. Mine the ledger for a failure | Self-Harness **Weakness Mining** |
| 2. Choose a surface and check it is one | AHE §3.1 seven components; this repo's `harness-surface.yaml` + `CHANGE_SURFACES` |
| 3. Record the prediction **first**, root cause distinct from the verifier cause | AHE §3.3 manifest; Self-Harness §3.2 `φ = (c, q, m)` |
| 4. Make the edit as one commit | AHE §3.1 *"one commit … rollback granularity for free"* |
| 5. Record the application | AHE lineage; this repo's `change.applied` |
| 6. Let the next round decide | AHE §3.3 *"falsifiable by the next evaluation"*; Self-Harness **Proposal Validation** |
| 7. Print the turn; a person keeps or reverts | AHE Algorithm 1 step 8 `Rollback`; this repo's *"the record reports and never acts"* |

The repository already implements steps 1–7 as **reporting instruments**; what it lacks is Plane B.

## 5. The instruments, and the three that are missing

**Present:** the failure reading (class beside mechanism), the change manifest and its next-round verdict, `change.applied` bound to a commit, the surface declaration with `verifiedBy`, the SSM axis.

**Missing, and already named by the repository itself:**

1. **A file-level harness/verifier split.** `tool-implementation` is bound to all of `src`, which holds both, so *"is this edit a verifier change?" is a reader judgment today"* (`harness-loop.md:33-36`). The literature expects Plane A and Plane B to be separable by path; AHE's whole controllability argument assumes it.
2. **Pareto preservation is declared uncomputable** (`harness-axes.ts:208-214`) — *"no ledger record carries a second measured objective"*. One of SSM's three metrics is therefore not read.
3. **"Sandbox violations" is currently read from this repository's own gate refusals**, not from an OS-level denial. That is a different quantity: it counts Dove's decisions, not the boundary holding.

Gap 3 is where the two substrate findings meet the framework — see §6.

## 6. The substrate requirement (measured, both candidates)

| Requirement | Pi 0.84.3 | DSH (this install) |
|---|---|---|
| Plane A exists as files | PROVIDED — extensions and skills are ordinary files | PROVIDED — but only `AGENTS.md` and `.agents/skills/**` of the seven components are read from this repository |
| Plane A's evidence is readable | PROVIDED (raw records) | **written, no consumer** — `session.v4.jsonl.zstd`, *"not readable by hook scripts"*, search mounted `openAt: never`, and no reader in this repository |
| Plane C can reach the loop | PROVIDED, with `shouldStopAfterTurn` / `prepareNextTurn` unreachable | **MUST BUILD** — the hook seams are documented and the bridge is installed, but no composition row mounts it, and the registered `SubagentStart` is silently dropped |
| Apply + revert | apply only; **no file-revert API found** | via git, not via the substrate |
| **Plane B (the outside)** | **CANNOT** — a hook is itself a file on disk, so a file-editing agent can edit its own gate; no permission hook; no path-restriction primitive; allow/deny lists are session-construction config | **MUST BUILD** — an outside exists, but this session is `danger-full-access` with approvals off, and `dsh-sandbox-policy` bounds one workspace root rather than a path set |

**Conclusion:** the substrate question is not "Pi or DSH". Dove's loop interface (`AgentLoop`, resolved 2026-09-26) already makes the loop substrate swappable, and Pi remains the product host. **What the framework needs is a Plane B, and Pi structurally cannot provide one while DSH can.**

## 7. Experiment 0 — the premise that must be tested, not assumed

Plane B's entire force rests on one unverified behaviour: **does `workspace-write` actually deny writes outside the workspace root?** The DSH substrate pass recorded that it did not test this, and this session runs `danger-full-access`. Corroborating evidence that the mechanism is real: the install ships a `diagnose-windows-sandbox-acl` skill whose purpose is diagnosing unexpected denials, and the mechanism packages (`dsh-fs-sandbox`, `dsh-pwsh-sandbox`, `dsh-sandbox-windows-acl`) are present.

**Acceptance (all three, or the premise fails):**
1. Under `workspace-write`, a write to a path outside the workspace root is **denied**.
2. Under the same mode, a write inside the workspace root **succeeds** (a policy that refuses everything is broken, not safe).
3. After a denial, the session **still completes a turn** (a denial must not kill the loop).

**If it fails:** Plane B as an *enforced* boundary does not exist in this install, and the framework degrades to the repository's current position — a person is the fixed point, and the boundary is discipline. That is a finding, not a failure, and it is exactly the kind of reading this project records.

### 7.1 A configuration detail that decides the *shape* of the boundary

This install's three shipped presets pair a sandbox mode with an approval policy, and they are not free to mix:

```yaml
# C:\Users\Macfy\.dsh\profiles\desktop\cordis.patch.yml:13-26
read-only:          { sandbox: read-only,          approval: ask   }
workspace-write:    { sandbox: workspace-write,    approval: ask   }
danger-full-access: { sandbox: danger-full-access, approval: never }
defaultPreset: danger-full-access
```

So `workspace-write` carries **`ask`**, not `never`. That has three consequences the framework has to state rather than discover later:

1. **A boundary write may be *denied by the sandbox* or *escalated to a person*.** Both are acceptable for Plane B — the requirement is that the improver cannot write it *silently*. Experiment 0's criteria are written to accept either shape (§`implement.md` A.3).
2. **The unattended form of Plane B is a combination the presets do not ship**: `sandbox: workspace-write` + `approval: never`. The preset map is user-editable, so this is a configuration addition rather than a missing capability — but it should be added deliberately and named, not achieved by flipping `defaultPreset` and hoping.
3. **A supervised loop and an unattended loop need different Plane B configurations**, and the difference is a *product decision about whether a person is in the loop per write* — not a technical default.

## 8. Citation corrections this research produced

Both are in the repository today and neither is a behaviour change:

1. **`.trellis/harness-surface.yaml:4`** attributes the file-level-representation sentence to **AHE §3.3**. In the paper that sentence is the **abstract / §1 (component observability)**, and the seven components are enumerated in **§3.1 (NexAU)**; §3.3 is controllability + the manifest. The content is right, the section number is wrong. The same wrong number appears in `task-convergence.ts:842`.
2. **`.trellis/tasks/archive/2026-09/09-28-preserve-behaviours/design.md:31`** quotes Self-Harness as *"a record of the passing behaviours to preserve that a proposal must not regress"*. **That string is not in the paper.** The paper's words are *"records of passing behaviors that should be preserved"*, and in the paper it is an element of the **proposer's context** — not a field of a failure record. The repository implements it as a field on the failure record (`preserve`), which is a defensible design choice, but the quotation mark makes a paraphrase look like a citation.

## 9. Deployment shape

- **Unchanged:** `AgentLoop` as the interface; Pi as a product host with its gate, effect claims and ledger; this repository as **Plane A**.
- **New:** **Plane B** as a component — a held-out task split, a read-only verifier tree, a promotion gate, and the policy that makes them unwritable. **Plane C** may be orchestrated by whatever can run a turn and write files (its host is deliberately deferred; it does not change the A/B boundary).
- **Not in scope:** migrating hosts; turning the workflow gate into a security boundary; a third-party sandbox on native Windows (no such thing exists for this platform).

## 10. What would falsify this framework

- Experiment 0 fails → Plane B is not enforceable here (§7).
- A file-level harness/verifier split proves impossible without splitting the record module (§5 gap 1) → the boundary stays a declaration.
- The held-out split proves unmeasurable at this project's scale: AHE needed **89 tasks and 9 rounds** to read its P/R; one task's run is *"not a benchmark"* (`personal-agent-convergence-record.md:127-130`). **This is the framework's real cost**, and it should be stated before anyone builds it.
