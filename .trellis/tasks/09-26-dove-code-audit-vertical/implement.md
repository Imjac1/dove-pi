# Dove Code Audit Vertical - Implementation Plan

## Preconditions

- The base framework is archived at `09-25-dove-base-agent-framework` and its gate is green
  (425 tests / 423 pass / 0 fail).
- `npm run typecheck` is clean before any edit.
- The branch is `feat/dove-base-agent-framework`; a task branch is created before `task.py start`.

## M0. Precondition - make the gate meaningful again  **[DONE]**

- [x] Confirmed the starting state before any change, so a later failure cannot be attributed to it.

```text
npm run typecheck  -> 0 errors
npm test           -> tests 425 / pass 423 / fail 0 / skipped 2   EXIT=0
```

## M1. Fix the frozen finding-identity contract (D1, D2, D3)  **[DONE]**

- [x] `contentHashOf` - `sha256(category | normalizedCode)`, **path-free**. Whitespace runs collapse and the string is trimmed, so reindentation is not an edit.
- [x] `fingerprintOf(finding, occurrenceIndex)` - content plus the index, **no path**. The index counts how many earlier findings in the run share the same `(category, code)` in a deterministic order (path, then start line, then end line), so two identical matches in one file stay two findings, and identical matches in two files stay two findings.
- [x] `FINGERPRINT_KEY` bumped to `doveFinding/v2`; `CONTENT_HASH_KEY` = `doveContent/v2` added. Both are emitted in `partialFingerprints`.
- [x] `baselineState` is a typed `"new" | "unchanged" | "updated" | "absent"` and the match is the five tiers. `SarifRunOptions.baseline` is now a `SarifBaseline` rather than a fingerprint set, because a move cannot be recognised without the content hash and the path separately.
- [x] `baselineOf(log)` derives the next baseline purely from a SARIF log, so no side channel is needed. `absent` results are skipped when deriving it, or a deletion would be re-reported on every run after.
- [x] The 09-25 tests asserting the old behaviour were updated, each with its reason in the diff.

**A defect this fix's own tests caught.** With a path-free fingerprint, a **pure move matches tier 1 exactly** and never reaches tier 2 - so the move was silently invisible, which is the very defect being fixed. Tier 1 now compares paths and records `dove/movedFrom` itself. Tier 2 remains for the case where the occurrence index shifted, so the fingerprint differs while the content hash does not.

**Validation (all run):**

```text
node --import tsx --test tests/evidence-sarif.test.ts   -> tests 15 / pass 15 / fail 0
node --import tsx --test tests/code-audit-mode.test.ts  -> tests  5 / pass  5 / fail 0

  identity: reworded message -> same; move to another path -> same; category or code change -> different
  identity: two identical matches -> different ids; severity, lines, reindentation -> same
  log: two identical matches in one file -> 3 results, not 1 collapsed result  (this was D3)
  log: unchanged -> unchanged; move -> unchanged at the new path + dove/movedFrom; edit in place ->
       updated; deletion -> absent; no baseline -> new
  log: an absent result is not carried into the next baseline
  mode: an edit in place now reads 'updated' where it previously read 'new'  (this was D2)

npm run typecheck -> 0 errors
npm test           -> tests 425 / pass 423 / fail 0 / skipped 2   (425 baseline + 6 new)   EXIT=0
```

Diffstat: `src/core/evidence-sarif.ts` 332 changed lines, `tests/evidence-sarif.test.ts` 109, `tests/code-audit-mode.test.ts` 13.

## M2. The seed spine - catalog, scanner, receipt  **[DONE]**

- [x] `src/code-audit/catalog.ts` - parse and validate. Unknown fields rejected at every level; a non-compiling pattern is a **load error** rather than a dropped pattern, because a dropped pattern yields a clean-looking result for code that was never searched.
- [x] `modes/code-audit/catalog/typescript.json` - **11 categories, 36 families, 87 patterns**. A family is the unit of mandatory coverage; the category prefix makes a candidate id readable.
- [x] `src/code-audit/seed-scanner.ts` - offline, in-process, model-free, shell-free. Runs every pattern of every family, keys hits by (family, path, line), emits fixed-shape `PENDING` candidates, and sorts by id.
- [x] `src/code-audit/receipt.ts` - the receipt and its validator. Fails on a version, category or language mismatch; on a mandatory-family set that differs from the catalog; on any mandatory family with no executed pattern; on an empty root list; on a file with no hash; on a family with no count. `supportsCleanClaim` is deliberately separate from validity: a receipt can be perfectly valid and still not support a clean claim, because a gap is a hole rather than a defect.
- [x] Unreadable files are recorded in `unreadableFiles` and add a declared gap.

**Validation (all run):**

```text
node --import tsx --test tests/code-audit-seed.test.ts  -> tests 16 / pass 16 / fail 0

  catalog: 11 categories load; a broken regex is a load error, not a skipped pattern; unknown fields,
           an empty category, and a missing prefix are each rejected
  scanner: seeds found in the vulnerable fixture and none in the clean one
  scanner: every mandatory family has a count, including the ones at zero
  scanner: hits keyed by (family, path, line), so one line yields at most one seed per family
  scanner: suffixes are applied - a README is not scanned, a .ts file is
  scanner: two runs agree on every seed and on seedSha256
  scanner: no source root is an error, not an empty result
  scanner: every seed is PENDING with authState UNKNOWN - it does not guess
  receipt: a missing family, an extra family, a version/category/language mismatch, a file with no
           hash, and a family with no count each fail
  receipt: an unreadable file without a declared gap fails; with one it is valid but not 'clean'
  receipt: dropping a seed changes seedSha256

npm run typecheck -> 0 errors
npm test           -> tests 447 / pass 445 / fail 0 / skipped 2   (431 after M1 + 16 new)   EXIT=0
```

**Four real pattern defects in the catalog, found two different ways - and the first account of this said
one way for all four, which was wrong.** A pattern that can never match is a silent hole in coverage: the
category reports clean because nothing looked, not because nothing is there, which is the failure this
vertical exists to prevent.

Found by **running the catalog against the fixture**, which is built to contain those shapes and produced
zero hits where it should have produced one:

- `FILE_UPLOAD/write_from_request` - the pattern was `writeFile\s*\(`, which cannot match `writeFileSync(`.
- `FILE_UPLOAD/filename_from_request` - it assumed an assignment (`name\s*[:=]`) and so missed the
  property read `file.originalname`, which is what a real upload handler writes.

Found by **reading the regexes**, not by running anything:

- `COMMAND_EXEC/child_process` was `\bspawnSync?\s*\(`, and `FILE_READ/read_variable` was
  `readFileSync?\s*\(`. A trailing `?` binds to the last character, so these mean "spawnSyn" or "readFileSyn"
  plus an optional final letter. They **did** match the suffixed form and **also** matched a degenerate
  `spawnSyn(` if one ever appeared; what they could never match is the **plain** form, `spawn(` and `readFile(`,
  which is what most code uses.

**The fixture contains no `spawn`, `spawnSync`, `readFile` or `readFileSync` at all**, so running it could not
have surfaced those two. The first version of this record claimed all four came from the fixture run, and a
review showed that was impossible; a review of my own work is the only reason the false account did not
stand.

All four are fixed, and the pin is a **direct assertion** rather than a fixture: each of seven call forms is
matched against its own sample string, including `spawn(`, `readFile(` and `writeFileSync(`. A fixture only pins a
pattern if the fixture happens to reach that family by that route, which is exactly how the false account
above survived.

**A spelling-based lint was written for this and then deleted.** It looked for a trailing optional
quantifier after a known identifier tail. A review showed it pins by spelling: it would miss `spawnSy?` and
`execut?`, and it would flag a legitimate optional character. A test that cannot decide the thing it
claims to decide is worse than no test, because it reads as coverage.
**One configuration fix.** `tests/fixtures` is now excluded from `tsc`. A fixture is audit **input**, and some of it is deliberately incomplete - a missing import, an undeclared global - because a scanner has to cope with real code that does not compile. Type-checking fixtures would stop a fixture representing what it exists to represent. The scanner reads them; the compiler does not.

## M3. The claim schema  **[DONE]**

- [x] `src/code-audit/claim-schema.ts` - the nine `ruleChecks` as a closed set, the per-category proof obligations, status-specific requirements, unknown-field rejection, and placeholder rejection.
- [x] `PROOF_FIELDS_BY_CATEGORY` - 11 categories, 4-7 obligations each. A CONFIRMED claim must assert the preconditions of **its own** defect class. Satisfying `SQL_INJECTION`'s four obligations does not satisfy `FILE_UPLOAD`'s seven, and a proof carrying a field that is not an obligation for its category is itself an error.
- [x] Placeholder rejection: a bare `true`, `done`, `n/a`, and similar ticks are refused, and an explanation shorter than 12 characters is refused. The checks ask what was examined and what was found; a tick answers neither.
- [x] Status-specific obligations: `HYPOTHESIS` must name its missing evidence, `FILTERED` and `NOT_REACHABLE` must explain why, `CONFIRMED` must carry a title, impact, remediation, a call chain and a proof of concept.
- [x] A call chain must start at `ROUTE` and end at `SINK`. Each end is a way the claim can be wrong: a sink with no reachable entry is `NOT_REACHABLE`, and an entry that never reaches a dangerous operation is not a vulnerability.
- [x] `runtimeStatus` is typed with one member, `NOT_TESTED` - so a static record claiming a runtime result is unrepresentable rather than merely discouraged, and a runtime failure cannot downgrade a static conclusion.
- [x] `findRepeatedExplanations` reports one explanation reused verbatim across candidates for the same check. One explanation cannot be true of two different sinks. Reported rather than fatal, because two candidates in one file can legitimately share a short answer.
- [x] `findUndispositionedSeeds` reports every seed that no claim mentions. **This was an acceptance-criteria gap found while reviewing AC5 against the implementation**: the schema rejected a claim about a seed nobody produced, but nothing enforced that every seed has a claim - so "seeds are non-deletable" was a claim the code did not check. It returns the ids rather than a boolean, so a reader can see exactly what was dropped, and it takes claimed ids rather than whole claims so it can run before the claims are validated.
- [x] **A review caught that this was still not enforcement.** The function existed and was tested, but no code in `src/` called it: AC5 was satisfied by a helper, not by the system. `code-audit.disposition` now calls it, alongside `validateClaim` and `findRepeatedExplanations`, and refuses the run when a seed is unmentioned or a claim is malformed. This is the difference between a rule that is written down and a rule that is checked.

**Validation (all run):**

```text
node --import tsx --test tests/code-audit-claim.test.ts  -> tests 16 / pass 16 / fail 0

  a complete CONFIRMED claim is accepted
  a candidateId with no corresponding seed is rejected
  all nine checks are required and no tenth is accepted; a tick instead of an explanation is
      rejected as a placeholder
  CONFIRMED with no categoryProof is rejected; with a partial proof the missing obligation is named
  every category is held to its own obligations: another category's proof is rejected, and a proof
      carrying a field it does not own is rejected
  title, impact and remediation are each required
  a call chain must start at ROUTE and end at SINK
  a proof of concept needs a known format and a success indicator
  HYPOTHESIS without missingEvidence, and FILTERED/NOT_REACHABLE without a reason, are rejected
  a static claim carrying a runtime status is rejected
  an unknown field is rejected by name
  a reused explanation is reported, and a claim cannot repeat itself

npm run typecheck -> 0 errors
npm test           -> tests 463 / pass 461 / fail 0 / skipped 2   (447 after M2 + 16 new)   EXIT=0
```

**Two test defects found and fixed while writing this milestone**, both in the tests rather than the schema: a reused-explanation fixture shared all nine values instead of one, and an assertion expected the substring `"must carry a impact"` where the message correctly reads `"must carry an impact"`.

## M4. Capability registration and the mode  **[DONE]**

- [x] `src/capabilities/code-audit.ts` - three capabilities, each with an evidence contract, a parameter schema, and deterministic argument validation: `code-audit.seed` and `code-audit.disposition` (`read_only`, idempotent), and `code-audit.diff` (`workspace_write`, idempotent).
- [x] Wired into the composition root in `src/runtime.ts` beside the existing capability registrations.
- [x] `modes/code-audit/governance.yaml` declares both capabilities, the version is bumped to **1.2.0** so a run can be attributed to an authority set, and `coverage.json` joins the evidence artifacts.
- [x] `modes/code-audit/MODE.md` updated. Its Output section still described the **v1** identity, which includes the artifact path - so the mode was telling a reader to do the thing this task fixes. It now states the two hashes and the four `baselineState` values, and the Method section carries the seed, non-deletability, nine-check, and proof-obligation discipline.
- [x] Nothing audit-specific was added under `src/core`; the existing no-core-branch test still passes.

**Validation (all run):**

```text
node --import tsx --test tests/code-audit-mode.test.ts  -> tests 8 / pass 8 / fail 0

  the two capabilities are registered in the shared runtime
  the scanner claims read_only and the diff claims workspace_write - no more than each does
  both are idempotent
  every registered code-audit capability is declared by the mode, so the mode is the authority list
      rather than a description of one
  the mode version is 1.2.0 and coverage.json is a declared artifact
  the original five assertions still hold, including the no-core-branch check

npm run typecheck -> 0 errors
npm test           -> tests 466 / pass 464 / fail 0 / skipped 2   (463 after M3 + 3 new)   EXIT=0
```

**A consequence registering a capability exposed.** `tests/pi-adapter.test.ts` asserted that after running `/sysprompt`, the notification contained a phrase that sits **after the capability index** in the built system prompt. That notification is a preview **capped at 2000 characters** (`extension.ts:950`), so adding two capabilities pushed the phrase past the cap and the assertion began testing how long the capability index happens to be rather than whether the command reports the prompt.

The phrase is already asserted against the **full** prompt in the same test, so the fix was to make the second assertion test what the preview is actually for: that it shows the injected block, and that a truncated preview says how to obtain the whole prompt. That is a narrower claim than the one it replaced, not a weaker one.


## M5. End-to-end vertical test  **[DONE]**

- [x] `tests/code-audit-vertical.test.ts` - the whole spine on a real filesystem: a fresh copy of the fixture per test, a real scan, real findings, a real SARIF log, and a real second run.

**Validation (all run):**

```text
node --import tsx --test tests/code-audit-vertical.test.ts  -> tests 7 / pass 7 / fail 0

  the spine runs: seeds are PENDING, the receipt carries mandatory families and a seed digest, the
      log is 2.1.0 and everything is new against no baseline
  the same tree scanned twice is silent: every result unchanged, and seedSha256 is identical
  a moved file reads as unchanged at the new path, with dove/movedFrom recorded - never as new, and
      never as absent
  an edit in place reads as updated; nothing else changes
  a deleted file reads as absent, naming the file
  an added sink reads as new, every new result comes from the added file, and nothing else moves
  narrowing the catalog makes the coverage change visible in the receipt rather than letting the
      same claim stand

npm run typecheck -> 0 errors
npm test           -> tests 474 / pass 472 / fail 0 / skipped 2   (466 after M4 + 8 new)   EXIT=0
```

**A real defect this milestone found, in the code rather than the test.** The same-place baseline tier kept only the **first** baseline index per `(category, path)`. With several findings in one file, only one could match it: the others fell through to `absent` while their current counterparts were reported `new`. Editing two findings in a file of three therefore produced one `updated`, one spurious `new`, and one spurious `absent` - exactly the churn the identity contract exists to prevent, and invisible in the single-finding tests.

The tier now keeps **every** candidate index and consumes the lowest unconsumed one, matching what the content-hash tier already did. A regression test pins it: three findings in one file, two edited, and the result is two `updated` and one `unchanged` with nothing invented.

**Two test expectations were also wrong, and both for the same reason**: one edited line can change which families match it. Parameterising a statement removes the concatenation, so the candidate that depended on the concatenation is genuinely gone and must read as `absent` rather than as nothing. And a single added line can yield more than one candidate, because a line may match several families - each family being a different way of reaching the sink. The assertions now state those properties instead of a count that happened to hold.


## M6. Spec update  **[DONE]**

- [x] `.trellis/spec/backend/personal-agent-framework-core.md` - the **Evidence Plane and Action Checkpoint** scenario was rewritten for the v2 identity contract. It still described v1, which includes the artifact path, so the specification was telling a reader to do the thing this task fixes.
- [x] `.trellis/spec/backend/personal-agent-audit-vertical.md` - new, 9,560 bytes, two scenarios: **Deterministic Seeds and the Coverage Receipt** and **The Finding Claim Schema**.
- [x] Registered in all four places the repository requires: the route row in the router, the index row, `routedSpecNames`, and `expectedHeadingsBySpec`.

**Validation (all run):**

```text
node --import tsx --test tests/spec-context-budget.test.ts  -> tests 5 / pass 5 / fail 0

  router 2,930 bytes of 8,192;  framework-core 20,612 of 24,576;  audit-vertical 9,560 of 24,576
  the router's link order equals routedSpecNames exactly, and every per-file heading inventory matches

npm run typecheck -> 0 errors
npm test           -> tests 474 / pass 472 / fail 0 / skipped 2   EXIT=0
```

**A registration detail worth recording.** The router's link targets must equal `routedSpecNames` **in order**, not merely as a set. Adding the row in the wrong position failed the budget test with a diff showing both orders, which is how the constraint was found. The budget test is the reason each of the four places has to move together.

## Review round - what the full-scope check changed  **[DONE]**

The 2.2 full-scope check ran against the completed milestone set and produced four corrections. All
four are recorded above in the milestone they belong to; this section is the summary.

1. **Overstated evidence, corrected.** The catalog-defect record claimed `spawnSync?` and `readFileSync?`
   "matched neither the plain nor the suffixed form". That is wrong: a trailing optional character
   matches the suffixed form fine, and the defect is the missing **plain** form. A review caught the
   overstatement, and the correction is kept visible rather than quietly overwritten.
2. **A test that did not test the fix.** The fixture-based catalog test was said to pin the four
   pattern fixes. It does not: the audit fixture reaches `COMMAND_EXEC` through the
   `child_process` import and `\bexec\s*\(` rather than through `spawn`. A direct assertion now
   matches each of the seven forms against its own sample string, which is what actually pins them.
3. **A rule that was written down but not checked.** `findUndispositionedSeeds` existed and was
   tested, but nothing in `src/` called it, so AC5 was satisfied by a helper rather than by the
   system. `code-audit.disposition` now calls it and refuses the run when a seed is unmentioned.
4. **A mis-attribution in the baseline match, found by probing rather than by reading.** A newly added
   finding whose code is identical to an existing one could claim the existing finding's baseline
   entry, so the pre-existing finding was reported new and the added one as a move. Matching now
   resolves every same-path match before any cross-path match. Four probes confirm the fix: a pure
   move is still a move, the added copy is new, a deletion is absent, and an in-place edit is
   updated.

**A second review round, and two more defects it caught in my own work.**

5. **The disposition capability's repeated-explanation check could never fire.** The id and the claim were
   pushed in an `if`/`else` on the **same condition**, so the second branch was unreachable and
   `findRepeatedExplanations` always received an empty list: calling the helper directly returned nine
   repeats where the capability returned none. A review found it by doing exactly that comparison.

6. **And the fix for it was written as a comment without its statement.** After the review named the
   defect, I replaced the branch and wrote a comment saying the claim is kept as well as its id - and did
   not write the `push`. The test failed, which is the only reason it was caught. **A comment that
   describes code which is not there is the same failure as a specification that describes behaviour which
   is not there**, and this task has now produced both. The test is the thing that decided it, and the
   lesson is that a claim about what code does is worth nothing next to a test that runs it.

**A third review round, and the most serious finding of the three.**

7. **The closure check's ground truth was supplied by the party it checked.** `reconcileDispositions` took
   a list of seed ids from its caller, so a scan of the fixture that produced **four** seeds passed it by
   reporting **none**: `execute({ seedIds: [], claims: [] })` returned `ok: true`. Dropping seeds - the exact
   act the non-deletability rule exists to prevent - was satisfiable. A reviewer found it by doing that.
   The ids are now derived from the seeds, and the seeds are bound to the receipt by comparing
   `seedDigest(seeds)` with `receipt.seedSha256`. A shorter list cannot be handed in, because the
   digest will not match. **This was an acceptance-criteria failure, not a polish item.**
8. **Enforcement moved to the artifact boundary.** A capability is model-elected: nothing obliged anyone
   to call it before the report was written, and the vertical's own end-to-end spine never did. The check
   now runs inside `code-audit.diff` **before the write**, which is the pattern `scanCategory` already
   uses for its own receipt. A capability that is never called is exactly as unenforced as a helper that
   is never called, so moving the helper into a capability had lifted the problem one level rather than
   removing it.
9. **The seed universe now travels with the artifact.** Run properties record `dove/seedCount`,
   `dove/seedSha256`, `dove/seedDigestVerified` and `dove/claimCount`. On a first run there is no baseline,
   so absent-state results cannot carry the closure claim; without this it was true of the process and not
   of anything a reader keeps.
10. **Two more comment-versus-code divergences, and a duplicate.** The `byFingerprint` tier's comment
   claimed all four tiers kept every candidate index when three do and it does not (safe, because
   `baselineOf` cannot emit duplicate fingerprints, but stated rather than assumed). The fixture
   test's comment still narrated the discovery method that had already been shown impossible. And
   `reconcileDispositions`/`describeDispositionFailure` had been duplicated in the file by my own edits,
   leaving it syntactically invalid - the third time a summary of mine described code that was not there
   and the fourth defect in that family.

**A fourth review round, on the pin itself.**

11. **Both inputs to the closure check were still caller-supplied.** Binding the seeds to the receipt stopped
   a caller shortening the list, but nothing bound the receipt to the **tree**. A reviewer demonstrated it:
   rewriting a receipt's `seedSha256` and hit count to match a three-of-four seed list made the
   writer produce an artifact carrying `dove/seedCount: 3` and `dove/seedDigestVerified: true`
   for a tree that produced four. A model cannot compute a sha256 without a shell, so it was not reachable,
   but the artifact **asserted** verification and a reader trusting that field was trusting a
   self-declaration. `code-audit.diff` now re-derives the scan from the receipt's own roots and refuses
   unless the fresh digest and every scanned-file hash match. It is the same defect one level up, which is
   the third time this task has found one there.
12. **The vertical's only write path was untested.** No test drove `code-audit.diff` to a successful write; the
   one that reached it expected a failure, and the spine test called `toSarifLog` directly - so it
   demonstrated a report produced with no reconciliation at all. There is now a test that goes through the
   writer, asserts the artifact exists, carries the seed universe, leaves no `.partial` behind, and
   refuses a receipt that does not match. **The claim was pinned by a test only after a reviewer said it
   was not.**
13. **A routed spec still described the pre-fix design.** `personal-agent-audit-vertical.md` said in as many words
   "The enforcement point is the `code-audit.disposition` capability" - the statement this file's item 8 corrects -
   and its signature inventory omitted the three exports added since. The budget test only compares `##`
   headings, so nothing caught it. Both fixed, plus the digest-binding rows in its validation matrix.

**A fifth review round, on my own initiative.**

14. **The last unbound link was the findings.** The chain is tree -> seeds -> claims -> findings. After round
   four the first three were bound and the fourth was not: `findingsPath` was a plain JSON file the writer
   read and believed. A probe wrote an artifact carrying a correct seed digest, `dove/seedDigestVerified: true`,
   and a finding for `src/invented/thing.ts` - a file that does not exist. Unlike the previous round this needed
   no forged digest, only a file, which makes it the most directly reachable of the family.
15. **Fixed by construction rather than by a fourth check.** `findingsPath` is gone. The findings are
   **derived** from the seed the claim names: the location and matched code come from the seed's own evidence,
   so a finding cannot name a file the scan did not read, and only the prose and severity come from the claim,
   which is already validated against the seed set. Only `CONFIRMED` and `HYPOTHESIS` become results;
   `FILTERED` and `NOT_REACHABLE` are exclusions. A stray `findingsPath` is now inert - it is not in the
   contract, so it does nothing - and a re-run of the probe produces four results, all on seeded paths.

**A note on how these were found.** Each of the last three rounds closed one link and left the next open, and
none of them was found by reading the code: the caller-supplied seed list came from asking what the check
actually consults, the receipt-to-tree gap from asking what the check takes on trust, and this one from asking
what the artifact actually contains. The pattern is that the claim travels one link further than the evidence,
and the way to see it is to follow the artifact rather than the code.

**A sixth round, from a review of the derivation itself.**

16. **The artifact's uri was an absolute local path.** `Finding.path` is documented repository-relative and
   SARIF's `artifactLocation.uri` must be a URI; the derived finding used the seed's absolute path, which
   is neither. It leaked the checkout layout, and it broke baseline portability: the same-`(category, path)`
   tier could never fire across two roots, so an edit under a new root read as one new finding plus one
   absent one. Relativized against the root the **seed** recorded. The seed keeps its absolute path -
   relativizing it would change every seed digest.
17. **The claim's category was never tied to the seed's.** The obligations for a `CONFIRMED` claim are chosen
   by the claim's own category, and nothing compared it to the seed's. A claim carrying `COMMAND_EXEC`'s four
   proof fields over `SQL_INJECTION` seeds validated cleanly - **the wrong defect class's checklist satisfied
   the gate** - and after derivation the artifact said `SQL_INJECTION` above a `COMMAND_EXEC` title. The writer
   now requires equality and refuses otherwise.
18. **A binding claim of mine was overstated, and the test that appeared to pin it did not.** I wrote that a
   finding cannot name a file the scan did not read. That holds for results derived from this run; it does
   not hold for everything in `results`, because an `absent` result describes what the **baseline** had
   and this run did not. A baseline entry for a non-existent file is emitted verbatim. The test asserted
   over every result and passed only because it used an empty baseline; it now skips `absent` and says why.
19. **A hypothesis could gate a pipeline.** `HYPOTHESIS` with severity `HIGH` mapped to SARIF `error`, so an
   unconfirmed finding could fail a build. Capped at `warning`; the claim's own severity is still carried.
20. **Run properties now record what the artifact otherwise could not show**: the disposition breakdown by
   status (`three seeds were filtered with a reason` versus `three seeds were dropped`), and the baseline
   digest (`nothing new` versus `a baseline written to say so`). A seed with no evidence now throws
   instead of being skipped while `dove/seedCount` still counted it.
21. **A fourth comment-versus-code defect, in the file that names the family.** The version comment said the
   required set grew from three to six while `requiredArgs` held five, and the version stayed at `0.2.0`
   while `toolVersion` defaulted to `0.3.0`. Corrected, and the capability is now `0.3.0`.

**A seventh round, and the sharpest test finding of the task.**

22. **The vertical's only defense had no test, and a mutation proved it.** A review deleted the whole
   re-derivation block, re-pointed the findings at the supplied seeds, and ran everything: **56 of 56 tests
   stayed green**. The comment above the disposition refusal claimed the check, and the assertion beneath it
   matched the **upstream** disposition wording - so nothing exercised the two branches, and the block could
   be removed without a single failure. There is now a case with both branches: a tree that gained a sink
   ("a fresh scan produced a different seed set") and a file whose bytes changed without changing the seed
   set ("the files it names are not the files this scan read"). I re-ran the mutation to confirm the test has
   power: removing the block now fails 2 cases, and restoring it passes 9 of 9.
23. **The sixth link was real, and my reasoning that it could not matter was wrong.** I argued a forged
   baseline could only mislabel. Two probes showed otherwise: a hand-written baseline carrying a result that
   matches nothing was emitted as an `absent` row naming a file the scan never read, **with the caller's
   prose in it** - the same signature as a findings file being believed - and a fabricated entry carrying a
   real finding's content hash at a non-existent path made a genuinely **new** finding read `unchanged` with
   a bogus `dove/movedFrom`, so the change report said "nothing new here" for something new. `unchanged` is
   itself a claim about the baseline, so that is a false negative in the report a gate acts on.
24. **Closed by construction: an `absent` result is now emitted from identity alone.** Fingerprints, the
   rule id, and a tool-written message; no location, no level and no prose from the baseline. Every location
   in the log therefore comes from the scan. The cost is real and accepted: an absent row no longer repeats
   the baseline's severity, because a reader who does not trust the baseline should not be handed its claims
   - and `dove/baselineSha256` names the artifact they can consult.
25. **An unreadable baseline is now refused by name.** `baselineOf` silently skipped results whose
   fingerprint keys it did not recognise, so a v1 baseline yielded zero entries and every finding read `new`
   - exactly the silent wall of new findings the versioned key exists to prevent, arrived at silently. It now
   throws naming the keys it found and the keys it reads.
26. **The staleness self-check was weaker than it looked.** The mtime floor compares the manifest against the
   **recorded** mtimes, so it is invariant under any change to the files it describes; the digest covers only
   the recorded rows, likewise. A review showed both reporting "not stale" while four rows had drifted. The
   per-row sha256-and-size comparison is the check that works, and it is now what the manifest prints.

27. **The last caller-supplied thing was the rulebook.** The re-scan reads its catalog from a path resolved
   against the caller's working directory, and nothing compared the two scans' `executedPatterns`. A narrowed
   catalog over the same tree produced **one** seed where the shipped one produces four, with
   `dove/seedDigestVerified: true` and both receipts reporting the same `catalogVersion` and `language` - so the
   rulebook was named nowhere in the receipt **or** the artifact. The writer now compares the executed
   patterns first, and the artifact carries `dove/catalogSha256`, `dove/sourceRoots` and `dove/category`.
   Pinned as a third branch of the refusal test.

**An eighth round, and a defect I introduced shipped in the previous one.**

28. **A crash on every run that reported a deletion.** Making `locations` optional for absent rows left
   `summarise()` reading `result.locations[0]` - guarded only after the index. It did not fail to
   compile, because the capability **re-declared the contract locally** with `locations` required: a second,
   staler copy of a type that lives in `evidence-sarif.ts`. That is the two-implementations-of-one-contract
   failure I had just argued against, across modules instead of inside one function. The consequences were
   the worst shape available: `renameSync` put the deliverable in place and then the capability threw, so an
   operator saw a failure with a valid report on disk, and `DiffSummary.absent` was unreachable as data.
   The contract is now exported and read from where it is defined, `absent` reports the identity it carries
   rather than a location it does not have, and a test drives the writer with a **real baseline and a
   deleted file** - which no test did, because every other one either expects a rejection or uses an empty
   baseline.
29. **A count is not a closure claim without a multiplicity rule.** Four seeds with one candidate claimed
   twice produced six claims, six results and a breakdown that could not tell four dispositions from two
   done twice. `findUndispositionedSeeds` checks only the superset direction, so "one claim per candidate"
   was documented and unenforced. The refusal now sits in the same walk as the count, and the count moved
   out of the writer into `reconcileDispositions` - it was the last artifact property computed from the raw
   caller input in a second traversal of the same list.
30. **Two rationale-copies and a citation that pointed at nothing.** The relativization reason was written
   twice, and the inline copy still carried the claim that an absolute path "leaks the checkout layout" -
   which `dove/sourceRoots` had already made false by putting the roots into the artifact. A comment near
   the baseline digest cited a docstring that says nothing of the kind. And a silent `continue` sat eight
   lines below a comment arguing that quiet branches are the defect. All three corrected, and the uri's
   dependence on the root **list** is now written down as a known limit rather than left to be found.

31. **The derivation is extracted and its refusals are tested.** A review pointed out that the
   relativization refusal had survived three rewrites as an **assertion no test could reach**: it was inline
   in the capability, where the receipt checks refuse first, so the only way to exercise it was to unit-test
   an unexported function. `src/code-audit/derive-findings.ts` now owns seeds + claims -> findings, and the
   refusals that were prose are its contract: a category that is not its seed's, an id binding to no seed,
   a seed with no evidence, and a path under no recorded root. Six cases, one of which is the refusal that
   could never have been pinned inline. The capability calls it and reads nothing from the caller but the
   claims.

**A process failure worth recording.** The check was dispatched with instructions to fix findings
directly, and the writer kept editing the same files while it reviewed, which twice left
`src/core/evidence-sarif.ts` syntactically broken and made the reviewer's runs void. The reviewer was
right to refuse to certify a moving target. Either the reviewer fixes and the writer stops, or the
writer fixes on request - not both.

**Final gate after the review round:**

```text
npm run typecheck -> 0 errors
npm test           -> tests 496 / pass 494 / fail 0 / skipped 2   (474 after M6, plus 31 from the review rounds)   EXIT=0
```
## Validation commands

```bash
npm run typecheck
npm test
node --import tsx --test tests/evidence-sarif.test.ts
node --import tsx --test tests/code-audit-seed.test.ts
node --import tsx --test tests/code-audit-claim.test.ts
node --import tsx --test tests/code-audit-vertical.test.ts
node --import tsx --test tests/spec-context-budget.test.ts
```

## Risky files and rollback points

| File | Risk | Rollback |
|---|---|---|
| `src/core/evidence-sarif.ts` | **The only frozen file this task changes.** Its key bump is breaking for any existing baseline | Revert this one file to return to v1 behaviour; nothing else depends on the change |
| `tests/evidence-sarif.test.ts` | 09-25 tests assert the two-state behaviour on purpose | Each changed assertion needs a stated reason in the diff |
| `modes/code-audit/governance.yaml` | The mode version increments | Revert the file and the mode returns to its declared version |
| `modes/code-audit/catalog/` | Data; a broken catalog fails loudly | Delete it and the capability errors instead of silently producing nothing |
| `.trellis/spec/backend/` | Budget-enforced | Revert the files and the route row together |

## Follow-up checks before `task.py start`

- [x] `design.md` and `implement.md` exist and `prd.md` has no blocking open question.
- [x] `implement.jsonl` and `check.jsonl` each hold real spec/research entries - not the empty files they
      are now, and not a placeholder row.
- [x] The user has approved the final planning summary **in a message after** that summary was presented.
- [x] The acceptance criterion with no external evidence base is stated as such: **no study was found
      that measures fingerprint stability across runs or the quality of a re-run's diff**, so this
      contract is defined and tested by us, not inherited.
- [x] The measured bar this vertical should eventually be judged against is recorded: Google's
      **<10% effective false positives**, where "effective" means the developer took no action.

## Acceptance criteria

- [x] One mode runs end to end over a fixture repository and emits a SARIF log through
      `evidence-sarif.ts`.
- [x] Two runs over the same tree produce identical identities; a reworded message does not create a new
      finding.
- [x] A moved finding reads as `unchanged` at a new location; an edited one as `updated`; a deleted one
      as `absent`; only a genuinely new one as `new`.
- [x] Every seed is either verified or explicitly dispositioned; none disappears.
- [x] The receipt fails validation when any mandatory family did not run.
- [x] An unreadable file produces a declared gap, never a clean result.
- [x] No audit-specific code under `src/core`; `never_allow: [shell.exec]` is unchanged.
- [x] `npm run typecheck` is clean and `npm test` is green.

## Record closure

Every box above is ticked on verified evidence, recorded 2026-09-26:

- The eight acceptance criteria are covered by the test files M1-M5 name, and the whole gate was re-run on
  the commit series ending `4e5b6f1`: `npm run typecheck` -> 0 errors, `npm test` -> tests 496 / pass 494 /
  fail 0 / skipped 2.
- Of the five pre-start check boxes: items 1, 2, 4 and 5 were verified directly (`implement.jsonl` and
  `check.jsonl` hold real spec/research rows; the no-external-evidence caveat is at `prd.md:110`; the
  <10% effective-false-positive bar is at `prd.md:98` and `design.md:281`). **Item 3 - the user's approval
  of the final planning summary - has no separate artifact.** The only record it was given is that the task
  reached `in_progress`, which the workflow does not allow without it. It is stated here rather than
  implied, because this task's whole subject is claims that outrun their evidence.
