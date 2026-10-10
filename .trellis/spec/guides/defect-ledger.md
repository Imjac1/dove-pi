# The Defect Ledger

**What this page is**: the defects that were **measured** by a real walk and then **never planned**. Each entry is the measurement itself,
kept verbatim from the task that recorded it, with its anchors and the path to its provenance. **Nothing on this page is being worked on.**

**Why a page instead of the eight tasks it replaces.** Seven of those tasks held a real measurement and nothing else: its `Requirements` and
`Acceptance Criteria` were still the template's `TBD`, so it could be neither done nor read as a plan. The measurement is the valuable part,
and it survives here - on a page the citation door walks, so a `file:line` in an entry that stops resolving is reported rather than
remembered. Taking one up means opening a task and **removing the entry from this page**, so a settled defect cannot be left looking open.

**Two entries left this page on 2026-10-05**, when a batch took them up. The first asked for a precondition to be declared where the agent meets
it rather than at the failure: `agent_task_convergence` refuses without a native formal task and that refusal was the first place the
requirement was stated, and `agent_project_task` creates a goal whose `acceptance.md` is a placeholder the agent had to discover by reading -
both now say so in their own guidelines, and the shipped `dev.*` and `code-audit.seed` capabilities carry `preconditions`, which
`dove-pi capability list` prints (measured, not assumed). The second: `modes/pentest` and `modes/trading` now carry an `effects.classes`
block. Neither defect remains, so neither entry can stay here looking open.

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

## 3. A host engine crash nobody can explain

**As measured**: measured during the real-project walk: the first non-interactive turn under a declared mode exited 1 with
`EngineCore encountered an issue, See stack trace above`, and the stack was not captured. Two further runs with a narrower prompt did not
reproduce it. Root cause unlocated - recorded rather than explained, which is the point of the task.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-unlocated-engine-crash/prd.md`

**Settled by**: a reproduction, or a capture that survives the crash. Until then this entry is a **record, not a task**: there is nothing to
fix that anyone can point at.

## 4. Action names a mode declares that nothing can produce

**As measured**: measured: `code-development`'s `source.read`/`source.write` and `code-audit`'s `repo.read`/`report.write` appear only in
their own files, are not in the capability registry and are not host tools, so they grant nothing; a capability call using them is refused by
the registered check. The spec documents the mode-authorizes-versus-build-implements gap, so this is shared doctrine - the open question is
whether a mode's own action names should be declared somewhere the loader resolves.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-unproducible-action-names/prd.md`

**Settled by**: an answer to the question the entry ends on - declared where the loader resolves them, or struck from the mode files. **Kept
reading**: on 2026-10-05 the four names were still absent from what `dove-pi capability list` prints, while the mode files had begun
describing them as the mode's own action names with effect classes; whether that is the answer or a spelling of the question is the decision.
**Measured again on 2026-10-05, and two shipped modes now disagree with each other**: the `effects.classes` blocks added to `modes/pentest` and
`modes/trading` deliberately **omit** those modes' own unresolvable names (`net.scan`, `exploit.run`, `market.read`), each saying a class
declared for a name nothing reads would be a grant that is never consulted - while `modes/code-development/governance.yaml` still lists
`source.read` and `source.write`, the two names this entry measured as granting nothing. One file family, opposite rules: the decision this
entry waits for is now also what makes the shipped modes consistent with each other.

## 5. Two records of one event disagree, and nothing reconciles them

**As measured**: three instances measured in one round: a field run's summary block reports zero tokens and zero tool calls while its
transcript and its ledger show sixteen provider rounds and fifteen tool observations; project bind prints status healthy and exits minus one;
and the same verify command reports minus one, one and zero depending on how it is invoked, with a control proving the method. Each is a
record that would let a reader conclude something false, which is the class this project keeps finding in its own declarations.

**Provenance**: `.trellis/tasks/archive/2026-10/10-05-divergent-records-unreconciled/prd.md`

**Settled by**: one reconciled number per event, or a stated reason why two records may differ.

## 6. The resume flag shares the session root, and its name said it continued the conversation

**As measured** (2026-10-05): with `--reuse-session` and one `--session-dir` on both runs - the condition the repository's own case asserts,
and that case holds only that the two runs share `sessionDir` and that the second request is not a redelivery of the first
(`tests/real-dove-blackbox.test.ts:543`) - the second run had **no trace of the first**: asked what it had done, the model answered that it
did not know, and the session root held **two** session files rather than one continued conversation. Continuing the same conversation with
the host's own `--session <file>`, through the launcher, answered with the real function, the real test count and the real commit id in
**15 seconds**.

**Provenance**: `.trellis/tasks/archive/2026-10/10-03-day-two-walk/readings.md` (third round) carries all four runs, their timings and their
exit codes.

**Already repaired, and that is the misleading half**: the claim was narrowed on 2026-10-05 - `README.md`, `README.en.md` and
`tests/fixtures/scenarios/resume-across-runs.json` now say the flag **shares the root and does not carry the conversation**, which is what
the doors and the fixture hold.

**Settled by**: isolating whether the host's RPC mode refuses to continue or the script never passes a continuation flag, then either making
the flag carry the conversation or renaming it to what it does. **Not isolated, and not guessed here.**

**This entry's own history, because the page's rule is the interesting part**: it left this page on 2026-10-05 when a task took it up, and
returned the same day when the owner judged that task not worth doing now - what remains is the repository's own **walk instrument**, the
misleading half is already repaired, and the question upstream of it (the second day is designed by the host, not by Dove) is still open.

## How to check this page

- **One door walks it.** `tests/spec-anchors.test.ts` resolves every `path:line` on this page from the repository root and refuses a
  citation whose path is missing or whose line is past the end of the file. `tests/document-drift.test.ts` holds this directory's index
  equal to its contents.
- **What the doors do not check**: whether an entry is still true. Every entry's first question for a reader is whether its measurement still
  holds, and the entry that has one says so in its own words.
- **When an entry is taken up**: it leaves this page and becomes a task, and the page shrinks. An entry removed while the defect remains is
  the only failure this page can have that no door would catch.
