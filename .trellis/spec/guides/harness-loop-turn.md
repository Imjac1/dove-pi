# Running a Turn of the Harness Loop

> **What this is**: a procedure rather than a thinking guide, filed here because this is where instructions for a person
> live and because a routed specification is budget-measured while a checklist that must be compressed loses its fields.
>
> **What is checked and what is not**: every tool operation and field below was read from the `agent_task_convergence`
> schema in `src/pi-adapter/extension.ts`, and every script invocation from that script own usage line. The parts that are
> *not* checked are the judgments - which surface to choose, what to predict, whether to keep or revert - and those are
> yours.

## Prerequisites, and how to check each

| Prerequisite | How to check it |
|---|---|
| A Pi-hosted session, not a bare shell | the extension is loaded: the banner names the mode and the protected surface |
| A formal native task with frozen criteria | `operation=status` returns a snapshot. If it says no snapshot exists, `operation=freeze` with `criteria: [{id, text}]` first |
| A workspace that can hold the record | the task has `.dove/tasks/<id>/convergence.json`. This repository does not, which is the measured reason no turn has been run here |
| The harness repository, for the scripts | they run from it and read `.trellis/harness-surface.yaml` |

## The steps

### 1. Mine

```powershell
node --import tsx scripts/harness-failures.mts [ledger] [--client-summary <run.jsonl.summary.json>]
node --import tsx scripts/harness-corpus.mts [root ...]
```

**Expected reading**: a failure record carrying a class, a mechanism, the refusals that preceded it, the component the
evidence points at, a citable `evidenceRef`, and the behaviours a fix must not regress - or an explicit `unattributed` with
the reason, plus `unseen` when the cause is upstream of every recording hook. **If the corpus reports no failures it says
why**; that is a finding about the corpus, not a broken instrument.

### 2. Choose a surface, and check that it is one

```powershell
node --import tsx scripts/harness-rounds.mts [workspace]
```

and, in the session, `operation=status` - which reports the same surface per component.

**Expected reading**: the components with their path counts. A component with no `verifiedBy` entry means **nobody has
stated what verifies it**, which is different from a component that nothing verifies.

### 3. Record the prediction first

```text
operation=change
  acceptanceId:         <the criterion this answers>
  changeId:             <a stable id you will cite in steps 5 and 7>
  surface:              <one of the seven>
  failureEvidenceRef:   ledger:<stepId>   <- the string the failure record prints as "cite:"
  rootCause:            <the inference, distinct from the verifier-level cause>
  fix:                  <what you will do>
  predictedFixes:       [<observable>:<subject>=<target>, ...]   <- at least one
  predictedRegressions: [...]                                   <- may be empty; empty is a claim of none
```

The observables are `criterion-status`, `verification-state` and `gate-refusals`. The runtime reads the baseline
itself, which is why a caller cannot supply one.

**Expected reading**: the snapshot carries the change with its `recordedAtRevision` and a baseline the runtime read. **Two
refusals mean the manifest is not yet answerable**: a `failureEvidenceRef` that resolves to nothing in this ledger, and a
prediction outside the three it names.

### 4. Make the edit as one commit

One logical edit is one commit. That is what gives step 5 a target and the revert its granularity.

```powershell
git commit -m "<what the edit does>"
```

### 5. Record the application

```text
operation=applied
  changeId: <the same id>
  commit:   <the commit that embodies the edit>
```

**Expected reading**: *Change <id> is applied by commit <sha>.* The runtime records the claim; the check that the edit
stayed inside the declared surface runs in step 7, where git is.

### 6. Let the round decide

Nothing to type: the decision is written at the **round boundary** - when a request ends and its observation lands - once
per change.

**Expected reading**, at the next `operation=status`: a `decided` list with an entry for this change. `pending` means the
round boundary has not happened; `confirmed`, `contradicted` and `unobserved` are decisions, and `contradicted` is recorded as
readily as `confirmed` because an edit that failed to do what it predicted is what the loop most needs to learn.

### 7. Print the turn, then keep or revert

```powershell
node --import tsx scripts/harness-rounds.mts [workspace]
```

```text
  applied:  <sha>   inside|outside <surface>   (and the files, when outside)
  verifier: definite|possible|none - what is at stake
  decision: <verdict> at revision <n>
```

**Keep or revert as a person, with that output in front of you**:

```powershell
git revert <the commit step 5 named>
```

## The two boundaries, at the step where they are acted on

- **A change that edits the verifier is not a turn.** If step 7 answers `definite` - or `possible`, naming the symbols - the
  edit touched the code that produces the evidence the loop is judged by. Such a change is judged by its suites and by you,
  not by the observables, and the closed set is deliberately not widened for it.
- **The record reports and a person decides.** Nothing in the loop reverts anything; the decision record carries
  `verdictOnly: true` for exactly that reason, and the revert above is yours to make.

## When a step does not produce its reading

| Missing | What it means |
|---|---|
| no `cite:` on the failure record | the reading could not attribute the failure to a record - do not cite what you cannot name |
| `operation=change` refused for evidence | the reference does not resolve in this ledger: the failure was never recorded here |
| `operation=applied` refused | a change the record does not carry, a second application for one change, or an empty commit |
| `pending` after a round | the round boundary did not happen - check that the observation was written |
| `unobserved` as the verdict | the prediction named something the record does not carry: **an answer, not a failure** |
| `possible` on the verifier line | the edit touched a file that contains verifier code; the symbols at stake are named |
