# The Defect Ledger

**What this page is**: the defects that were **measured** by a real walk and then **never planned**. Each entry is the measurement itself,
kept verbatim from the task that recorded it, with its anchors and the path to its provenance. **Nothing on this page is being worked on.**

**Why a page instead of the seven tasks it replaces.** Each of those tasks held a real measurement and nothing else: its `Requirements` and
`Acceptance Criteria` were still the template's `TBD`, so it could be neither done nor read as a plan. The measurement is the valuable part,
and it survives here - on a page the citation door walks, so a `file:line` in an entry that stops resolving is reported rather than
remembered. Taking one up means opening a task and **removing the entry from this page**, so a settled defect cannot be left looking open.

**Marks**: the same three the other pages use - `[demonstrated]` (the entry carries a measurement or a reading),
`[not yet demonstrated]` (a reading exists showing it has not been shown), `[unverified]` (no instrument). Every entry here is
`[demonstrated]` at the moment it was measured; **whether it is still true was not re-measured**, and that is what a reader has to check first.

## 1. Reporting a blocker the way the policy means

**As measured**: every round prompt says to follow the goal-tool policy before reporting a blocker, and the policy tool set carries
`update_goal`, which this session has never called. Report the boundary as a goal update rather than as prose in a report.

**Provenance**: `.trellis/tasks/archive/2026-10/09-29-report-blocker/prd.md`

**Settled by**: a run in which a boundary is reported through the goal tool, and a reading showing the report reached the policy's carrier.

## 2. Bare line numbers in the specifications are invisible to the doors

**As measured**: measured while repairing an anchor by hand: pages cite positions as bare `:NNNN` without naming the file, and both
citation doors only recognise a path with an extension and a line, so these anchors can rot unobserved. Count them first, then teach the
door to see them.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-bare-line-anchors/prd.md`

**Settled by**: a count of the bare positions, then either a door that sees them or a page set that names its files. **Partial reading**:
the citation door now resolves every `path:line` from the repository root and counts a bare filename as a citation - which is stricter than
the entry assumed, and which was walked on 2026-10-05 when a page of this repository was corrected by it.

## 3. Capability preconditions and follow-ups, discoverable only by attempting

**As measured**: measured three times in real runs. A mode that cannot pre-flight stops every tool until the engagement is fixed.
`agent_task_convergence` refuses unless a native formal task exists, and the refusal is the first place that is stated. `agent_project_task`
creates a task whose `acceptance.md` is a placeholder, which the agent had to discover by reading the file. `windows.host_info` already
declares preconditions in the registry, so the field exists and the native project capabilities do not use it; the fix is to declare them
where the agent reads before it attempts.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-capability-preconditions/prd.md`

**Settled by**: the preconditions declared on the native project capabilities, where a reader meets them before the attempt.

## 4. A host engine crash nobody can explain

**As measured**: measured during the real-project walk: the first non-interactive turn under a declared mode exited 1 with
`EngineCore encountered an issue, See stack trace above`, and the stack was not captured. Two further runs with a narrower prompt did not
reproduce it. Root cause unlocated - recorded rather than explained, which is the point of the task.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-unlocated-engine-crash/prd.md`

**Settled by**: a reproduction, or a capture that survives the crash. Until then this entry is a **record, not a task**: there is nothing to
fix that anyone can point at.

## 5. Action names a mode declares that nothing can produce

**As measured**: measured: `code-development`'s `source.read`/`source.write` and `code-audit`'s `repo.read`/`report.write` appear only in
their own files, are not in the capability registry and are not host tools, so they grant nothing; a capability call using them is refused by
the registered check. The spec documents the mode-authorizes-versus-build-implements gap, so this is shared doctrine - the open question is
whether a mode's own action names should be declared somewhere the loader resolves.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-unproducible-action-names/prd.md`

**Settled by**: an answer to the question the entry ends on - declared where the loader resolves them, or struck from the mode files. **Kept
reading**: on 2026-10-05 the four names were still absent from what `dove-pi capability list` prints, while the mode files had begun
describing them as the mode's own action names with effect classes; whether that is the answer or a spelling of the question is the decision.

## 6. Two shipped modes declare no effect classes, so every tool in them is non-idempotent

**As measured**: measured while planning the twelve-session fixes: `pentest` and `trading` have no `effects.classes` at all, so under them
every tool - including read-only ones - is the non-idempotent default, and a retry of any of them is refused. `code-development` had the same
omission for its four read-only project tools and was fixed there; this belongs in its own task because the scope is every tool in two modes
rather than four names in one.

**Provenance**: `.trellis/tasks/archive/2026-10/10-04-empty-effect-classes-pentest-trading/prd.md`

**Settled by**: an `effects.classes` block in both modes' governance documents. **Re-measured 2026-10-05**: still absent from both - the
defect stands.

## 7. Two records of one event disagree, and nothing reconciles them

**As measured**: three instances measured in one round: a field run's summary block reports zero tokens and zero tool calls while its
transcript and its ledger show sixteen provider rounds and fifteen tool observations; project bind prints status healthy and exits minus one;
and the same verify command reports minus one, one and zero depending on how it is invoked, with a control proving the method. Each is a
record that would let a reader conclude something false, which is the class this project keeps finding in its own declarations.

**Provenance**: `.trellis/tasks/archive/2026-10/10-05-divergent-records-unreconciled/prd.md`

**Settled by**: one reconciled number per event, or a stated reason why two records may differ.

## How to check this page

- **One door walks it.** `tests/spec-anchors.test.ts` resolves every `path:line` on this page from the repository root and refuses a
  citation whose path is missing or whose line is past the end of the file. `tests/document-drift.test.ts` holds this directory's index
  equal to its contents.
- **What the doors do not check**: whether an entry is still true. Every entry's first question for a reader is whether its measurement still
  holds, and the entry that has one says so in its own words.
- **When an entry is taken up**: it leaves this page and becomes a task, and the page shrinks. An entry removed while the defect remains is
  the only failure this page can have that no door would catch.
