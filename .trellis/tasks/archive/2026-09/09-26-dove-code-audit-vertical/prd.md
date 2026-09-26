# Dove Code Audit Vertical

## Goal

Build the first real vertical on the base agent framework: a security audit that finds defects in a
repository and emits findings the existing evidence plane can diff across runs, so a re-run is a change
report rather than a fresh pile of prose.

**User value**: the original intent was a reusable base framework with three verticals built on it. The
framework is complete and archived (`09-25-dove-base-agent-framework`); this is the first vertical, and
it is deliberately the one with the smallest blast radius - findings are reversible, no external target
is touched, and no money moves.

## Background

The framework owns the loop, a two-semantics gate, the work-mode artifact, the authority grant graph,
effect identity, the evidence plane, context admission, and capability scoping. What it does **not** have
is a single capability for any vertical: the 11 registered capabilities are all `dev.*`, `web.*`,
`windows.*`, or `workspace.*`.

The `code-audit` mode already exists as a declarative contract at `modes/code-audit/`: capabilities
`[repo.read, report.write]`, `gate.semantics: conformance`, `sandbox.isolation: worktree`,
`evidence.format: sarif`, and a permission policy of `read_* allow` / `report.write ask` /
`shell.exec deny`. `src/core/evidence-sarif.ts` implements the SARIF contract with
`FINGERPRINT_KEY = "doveFinding/v1"`, `partialFingerprints`, `baselineState`, `occurrenceCount`, and a
severity-derived rank, and it is tested. So the seam is proven and the output contract is real; **this
task supplies the analysis**.

## Confirmed facts (repository inspection)

| Fact | Evidence |
|---|---|
| No code-audit capability exists | `src/capabilities/` holds only `development.ts`, `runtime.ts`, `web-access.ts` |
| The mode is declarative only - no `scripts/` or `references/` | `modes/code-audit/` contains exactly three files |
| The SARIF contract exists and is tested | `src/core/evidence-sarif.ts`, `tests/evidence-sarif.test.ts` |
| The fingerprint includes the path | `src/core/evidence-sarif.ts:44` |
| `baselineState` emits only two of four values | `src/core/evidence-sarif.ts:105` |
| Duplicate fingerprints collapse into one with a count | `src/core/evidence-sarif.ts:72,106` |
| Domain directories are an existing convention | `src/web-access/`, `src/windows-runtime/`, `src/extensions/` |
| A capability registration is a fixed shape | `CapabilityDefinition` in `src/core/contracts.ts`; `src/capabilities/development.ts` as the pattern |
| Unknown fields are rejected in the authority contract already | `validateAuthorityDocument` in `src/core/authority.ts` |
| A mode id must not appear in executable code under `src/core` | `tests/code-audit-mode.test.ts`, which strips comments before checking |

## Requirements

**R1. The seed spine.** A deterministic, offline, in-process scanner driven by a versioned catalog
produces non-deletable `PENDING` candidates, and a **coverage receipt** proves what was searched.

**R2. The claim schema.** A finding is a claim with named per-category obligations, not a category
label. Unknown fields are rejected at every level; a `CONFIRMED` finding without its category proof is
rejected; the nine `rule_checks` must each carry a real, non-placeholder explanation.

**R3. The identity contract is fixed.** The three defects below are repaired so that a re-run is
readable as a change report.

**R4. No core violation.** The vertical adds no audit-specific code under `src/core`, and
`never_allow: [shell.exec]` stays intact - the scanner is in-process and needs no shell.

**R5. Read-only against the target.** Nothing in the vertical executes the audited repository. The
scanner reads text and hashes files.

**R6. Fail closed.** An unevaluable condition is a validation failure, never a default. An unreadable
file becomes a declared gap, never a clean result.

## Technical notes: the three defects

| | Defect | Location |
|---|---|---|
| **D1** | `fingerprintOf` hashes `path \| category \| code`, so **a move is indistinguishable from an edit** | `src/core/evidence-sarif.ts:44` |
| **D2** | `baselineState` emits only `new` and `unchanged`; a moved finding reads as one new finding plus one silent disappearance | `src/core/evidence-sarif.ts:105` |
| **D3** | the occurrence index is not in the identity, so two same-category findings on identical matched code in one file collapse and a real defect is lost | `src/core/evidence-sarif.ts:72,106` |

The fix - a path-free `contentHash`, an occurrence-indexed `findingId`, a key bump to
`doveFinding/v2`, and a five-tier deterministic baseline match emitting all four states - is specified
in `design.md` section 5 and `research/brief-seed-receipt-claim.md` section 5.

## Evidence and constraints from research

Four research files and one distilled brief exist under `research/`. Full detail is there; what follows
is only what constrains the design.

**Identity and diffing.** Semgrep's `code_hash` docstring states that hashing **only** the code
contents is what lets it tell a move from an edit, and Semgrep ships **six** identity hashes because one
is not enough. `github/codeql-action/src/fingerprints.ts` emits `hash:occurrenceIndex` and hashes
**content only** - no path, no rule, no message. The SARIF SDK's shipped baseline fixtures use all four
`baselineState` values (`new` 211, `unchanged` 22, `updated` 7, `absent` 1) and declares a versioned
key `contextRegionHash/v1`. GitHub documents the two duplicate-alert failure modes as a `ruleId` that
changes between runs, and inconsistent artifact paths.

**Engines.** Licence, not output format, is the binding constraint. CodeQL's terms forbid this
integration. `semgrep-rules` are "internal business use" only. Opengrep's engine is LGPL-2.1 but its
**rule-set licence was not verifiable**. Only gosec and ESLint expose a documented programmatic API.
**No engine documents a determinism guarantee**; CodeQL states the opposite. And no wrapped scanner
supplies finding identity: gosec's SARIF builder sets zero fingerprint fields, Trivy's report is clean of
them, and Bandit's issue model has none.

**The acceptance bar.** Google's *Software Engineering at Google* caps a code-review-surfaced check at
**<10% effective false positives** ("effective" = the developer took no action), <5% measured
fleet-wide. A standalone LLM reviewer does not meet it (CASTLE best P=63% / R=78%; a 31,073-review field
study found **36.4% accepted, 56.3% rejected**). The model's reproducible win is **triage over a
scanner** (94-98% of false positives eliminated at high recall). Google's FindBugs "Fixit" week reviewed
3,954 warnings and **only 16% were fixed** - which is why the identity contract matters more than
detection breadth.

**The reference packages.** Three manifest-driven audit agents (PHP, Java, .NET), the same 16-phase DAG,
orchestrators of 267-366 KB. They supply the working model for the seed catalog and family granularity,
the coverage receipt and its validator, the per-category proof obligations, and the nine `rule_checks`.
They are a **reference, not an engine**: none of their code was executed, and none is being ported.

**One honest gap.** No study was found that measures fingerprint stability across runs or the quality of
a re-run's diff. The vertical's central acceptance criterion has **no external evidence base**; it is a
contract we define and test, and it must be described that way.

## What the review rounds changed

Planning produced a design; eight rounds of adversarial review of the implementation changed six things
about it that are worth knowing before reading `design.md`:

1. **The findings are derived, not supplied.** A `findingsPath` argument existed and was believed. A probe
   showed an artifact asserting a verified seed set next to a finding for a file that does not exist. The
   argument is gone; the location and matched code come from the seed.
2. **The ids come from the seeds, not from the caller.** `reconcileDispositions` took a list of seed ids,
   so a scan of four seeds passed it by reporting none.
3. **The receipt must reproduce from the tree.** Binding seeds to receipt left both as inputs; a rewritten
   receipt produced an artifact claiming verification for a different tree.
4. **The rulebook is compared too.** A narrowed catalog over the same tree produced one seed where the
   shipped one produces four, with `dove/seedDigestVerified: true`.
5. **`absent` is emitted from identity alone.** Copying the baseline's location, level and message into the
   result put caller-supplied content in the deliverable, and a fabricated entry made a new finding read
   `unchanged`.
6. **One claim per candidate is enforced.** Only the superset direction was checked, so a duplicate was
   accepted and the disposition count could not support the closure claim it exists for.

The shape of all six is the same: **the claim travelled one link further than the evidence**. Each was
found by following the artifact rather than by reading the code, and each cost a round to find after the
one before it was closed.

## Key decisions

- **The vertical's job is security auditing** in a fixed catalogue of exploitable classes - the reference
  packages' domain - with a **scanner-first** architecture and the model as a staged validator. A broad
  LLM review pass is out of scope, because the evidence says it does not meet the acceptance bar.
  *Decided on the evidence; the planning summary asks the user to ratify.*
- **The seed source is our own deterministic catalog scanner**, not a wrapped engine. Two research waves
  agree that wrapping buys rules and a SARIF container and nothing else, the licence position rules
  several engines out, and no engine documents determinism. An external engine remains possible later as
  a **second seed source** without changing the receipt, the identity scheme, or the claim schema.
  *Decided on the evidence; the planning summary asks the user to ratify.*
- **D1, D2, and D3 are fixed inside this task.** Decided by the user. They are small, they are evidenced
  by four independent sources, and the vertical's central acceptance criterion is unachievable with them
  standing.
- **The claim schema is added here**, because the framework has an evidence plane with no schema for what
  a finding must assert, and the reference has the opposite.
- **The 16-phase DAG and the reference orchestrator are not ported.** They reimplement, in Python, the
  ledger, evidence, resumption, and tool authority this framework already has.

## Acceptance criteria

- [ ] **AC1** One mode runs end to end over a fixture repository and emits a SARIF log through
      `src/core/evidence-sarif.ts`.
- [ ] **AC2** Two runs over the same tree produce identical identities; a reworded message does not
      create a new finding.
- [ ] **AC3** A moved finding reads `unchanged` at a new location; an edited one `updated`; a deleted one
      `absent`; only a genuinely new one `new`.
- [ ] **AC4** Two same-category findings on identical matched code in one file remain two findings.
- [ ] **AC5** Every seed is verified or explicitly dispositioned, **once**; none disappears and none is
      claimed twice. A disposition may be any of the four statuses; what a seed may not do is go
      unmentioned. **The enforcement point is the artifact writer, not a capability** - a check the model
      elects to call is as unenforced as a helper nobody calls, which is what this criterion first
      asserted and did not have. `code-audit.disposition` remains as the operator-facing exposure.
- [ ] **AC11** Nothing reaches the report on the caller's word alone. The writer refuses a seed set that
      does not match the scan receipt, a receipt that does not reproduce from its own roots, a receipt
      produced by a different rulebook, and a claim whose category is not its seed's; and the findings are
      **derived** from the seeds rather than read from a file, so every location in the artifact names a
      file the scan read.
- [ ] **AC12** An `absent` result is emitted from identity alone and carries no location, so no location
      in the artifact comes from a baseline the caller supplied.
- [ ] **AC13** A baseline written by an unrecognised fingerprint version is refused by name rather than
      read as empty, because an empty baseline makes every finding read `new`.
- [ ] **AC14** The severity distinction survives the artifact: `dove/severity` carries the claim's own
      value, and a `HYPOTHESIS` is capped at `warning` so an unconfirmed finding cannot gate a pipeline.
- [ ] **AC6** The receipt fails validation when any mandatory family did not run.
- [ ] **AC7** An unreadable file produces a declared gap, never a clean result.
- [ ] **AC8** A `CONFIRMED` claim missing any required proof field for its category is rejected, naming
      the field.
- [ ] **AC9** No audit-specific code under `src/core`; `never_allow: [shell.exec]` is unchanged.
- [ ] **AC10** `npm run typecheck` is clean and `npm test` is green.

## Out of scope

- Reimplementing static analysis, or the reference's 16-phase pipeline and its orchestrator.
- A broad LLM review pass over a whole diff.
- Writing fixes: this vertical reports, it does not patch.
- Scanning a target the operator does not own.
- The runtime-validation half of the reference (stages 11-12, structured success indicators, request
  planning) - a separate concern with its own consent rules.
- Cross-category root-cause clustering within one run (the reference's `07c`). This task does the
  **across-run** half, which is what `baselineState` requires.

## Risks and deferred items

- **The analysis is shallow by construction.** A catalog of ~41 regex families finds far less than a real
  SAST engine. This is accepted: analysis quality is delegated and grows over time, while identity,
  evidence, and governance are what this project contributes.
- **Deterministic seeds produce false positives by construction.** A regex hit is a candidate, not a
  finding. The cost of a candidate is one verification pass; the cost of a missed sink is a missed
  vulnerability. The bias is deliberate and stated.
- **A schema can be satisfied performatively.** Nine proof fields can be filled with plausible text.
  Mitigated, not solved. Nothing here claims to meet the <10% bar yet.
- **Deferred: an external engine as a second seed source.** Opengrep is the only surveyed candidate with
  a real unauthenticated SARIF fingerprint and a clean engine licence, but its **rule-set licence needs a
  legal read before any bundling**. This does not change MVP behaviour.
- **Deferred: baseline migration instead of key versioning.** Bearer's `ignore migrate` carries an
  accumulated baseline forward where versioning invalidates it. Relevant only once a baseline exists
  that is worth carrying.

## Open questions

None blocking planning.
