---
name: code-audit
description: Audit a repository for exploitable defects, seeding candidates deterministically and emitting findings as SARIF with a diffable baseline.
license: MIT
compatibility: "Requires the code-audit capabilities and a deterministic sink catalog. This mode declares gate.semantics none, so what contains it is the permission list and the scope block rather than a gate: an internal review has no third-party grantor to write an authority document with, and it declares no thresholds either. A mode whose gate declaration and content disagree refuses to load."
---

Audit the repository in scope for defects that a reviewer would act on. Report findings; do not patch.

## Method

1. **Seed deterministically.** The catalog scan produces candidates. A regex hit is a place worth
   looking, not a conclusion, and it is always `PENDING`.
2. **Seeds are non-deletable.** A seed may be confirmed, filtered or marked not reachable, but it may
   never simply disappear. A seed with no disposition is a coverage failure, and it is the failure
   that matters most: a missed sink is a missed vulnerability, while a candidate that turns out to be
   nothing costs one pass.
3. **Answer the nine rule checks for every candidate.** Each is an explanation of what was examined
   and what was found. A tick is not an explanation, and one candidate does not inherit another
   conclusion.
4. **To confirm a defect, assert its preconditions.** Each category has its own obligations - a SQL
   injection claim must establish that the query executes, that the syntax is influenced, that the
   source is controlled, and that parameterization is absent. A dangerous function name, a component
   version, a comment, or a whitelist entry satisfies none of them. If an obligation cannot be met,
   say so as a `HYPOTHESIS` and name the missing evidence; that record is more useful than a
   confirmation that is not one.
5. **A proof of concept must say what success looks like.** A request with no success indicator
   cannot tell a vulnerability from a 404.
6. **Disclose the gaps.** If a file could not be read, the category is not clean, and the coverage
   receipt says so.
7. **Meet an obligation by running something, and keep what it printed.** A precondition asserted in
   prose is not asserted; the command or script that shows it belongs in the record. Write that script
   to be reusable - the second candidate is where its parameters earn the pass it cost, and a script
   that can only examine the first one spends that pass for nothing.

## Output

Emit SARIF 2.1.0. Identity is derived from the category and the matched code, **never from the
finding message**, which is prose and varies between runs, and **never from the artifact path**, so
that a finding which moves keeps its identity. A second, path-free content hash is emitted alongside
it, which is what lets a baseline recognise a move.

`baselineState` carries all four of the schema values:

- `new` - no counterpart in the baseline.
- `unchanged` - the same finding, including at a new location, in which case the move is recorded.
- `updated` - the matched code changed where the finding already was.
- `absent` - the finding was in the baseline and is gone. A deletion must be visible, not silent.

Severity is yours to set and it survives: `dove/severity` carries your value even though SARIF has only
three levels, and a `HYPOTHESIS` is capped at `warning` however high you rate it, so an unconfirmed
finding cannot fail a build.

Two runs over the same tree must produce identical identities. A reworded message, an inserted line,
and a moved file must not create new findings.

Locations and matched code in the artifact come from the scan, never from your prose about the scan; your
contribution to a result is the title and the severity. **The claims file is the report** - it carries the
impact, the remediation, the proof of concept, the call chain and the missing evidence, and the SARIF is
the change report over it. A reader handed only the SARIF can see what changed and where, not what to do
about it, so do not put in a title what belongs in the claim.

## Stop

Stop when the budget is exhausted or a re-run produces no new identities. Do not expand scope to keep
looking; ask for the scope to be widened in the mode's `scope` block instead.
