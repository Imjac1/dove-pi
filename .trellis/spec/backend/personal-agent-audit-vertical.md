# Code Audit Vertical

> **Scope:** The first vertical built on the framework: deterministic seed scanning, the coverage
> receipt, and the finding claim schema.
>
> **Canonical router:** [Personal Agent Runtime Contract](./personal-agent-runtime.md)

The framework owns identity, evidence, and governance; this vertical owns analysis. Both halves of the
claim are enforced: the scanner produces **candidates, never findings**, and a claim is refused unless
it asserts the preconditions of its own defect class.

## Scenario: Deterministic Seeds and the Coverage Receipt

### 1. Scope / Trigger

Trigger: adding or changing what is looked for, or making a coverage claim about a category.

### 2. Signatures

```typescript
// src/code-audit/catalog.ts
function parseCatalog(text: string): SeedCatalog;      // throws CatalogError with every problem
function validateCatalog(value: unknown): readonly string[];
function familyIdsOf(catalog: SeedCatalog, category: string): readonly string[];
// src/code-audit/seed-scanner.ts
function scanCategory(o: { catalog; category; roots; scope }): { seeds: SeedCandidate[]; receipt: CoverageReceipt };
function seedDigest(seeds: readonly SeedCandidate[]): string;
// src/code-audit/receipt.ts
function validateReceipt(r: CoverageReceipt, category: string, c: SeedCatalog): readonly string[];
function supportsCleanClaim(r: CoverageReceipt): boolean;
```

### 3. Contracts

- A catalog is **data**, versioned, per language. The unit is a **family** - a named group of
  patterns covering one way a class is reached - because a family is what the receipt proves ran.
- **Every pattern of every family is compiled and executed.** A pattern that does not compile is a
  **load error**, never a silent skip: a skipped pattern yields a clean-looking result for code that
  was never searched.
- The scanner is offline, in-process, and model-free. It reads text and hashes files and never
  executes the audited repository, so it needs `read_only` and does not require a shell.
- A hit is keyed by `(family, casefolded path, line)`, so one line yields at most one seed per
  family. One line **may** yield seeds in several families - that is the design, since each family is
  a different way of reaching a sink.
- Seeds are always `PENDING` with `authState: UNKNOWN`. The scanner knows nothing about authorization
  and says so rather than guessing.
- **Seeds are non-deletable.** A later stage may classify one, but a seed that disappears without a
  disposition is a coverage failure. The cost of a candidate is one verification pass; the cost of a
  missed sink is a missed vulnerability, and the bias is deliberate.
- The receipt records the roots, every file read **with its hash**, the mandatory families, every
  executed pattern, a hit count per family, unreadable files, gaps, and `seedSha256` - a canonical
  digest of the seed set, so receipt and seeds cannot be edited independently.
- **An unreadable file is a declared gap and is never converted into a successful zero.** A file
  nobody could read is not a file with no findings.
- **Validity and a clean claim are different questions.** A receipt can be perfectly valid and still
  not support a clean claim, because a gap is a hole in coverage rather than a defect in the
  artifact. `supportsCleanClaim` is therefore separate from `validateReceipt`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown field at any level | Rejected by name |
| Pattern does not compile | Load error, not a skipped pattern |
| Category with no family, or a duplicate family id | Rejected |
| No source root exists | Error, not an empty result |
| Receipt version, catalog version, category, or language mismatch | Rejected |
| `mandatoryFamilies` differs from the catalog's set | Rejected |
| A mandatory family has no executed pattern | Rejected: "did not execute every mandatory family" |
| A scanned file has no hash, or a family has no count | Rejected |
| Unreadable files without the declared gap | Rejected |
| Unreadable files with the gap declared | Valid, but **not** clean |

### 5. Tests Required

- The shipped catalog loads; a broken regex, an unknown field, an empty category, and a missing
  prefix are each rejected.
- Seeds are found in a vulnerable fixture and none in a clean one; suffixes are applied.
- Every mandatory family has a count, including those at zero.
- Two runs over one tree agree on every seed and on `seedSha256`.
- A missing family, an extra family, a version mismatch, a missing hash, and a missing count each
  fail the receipt.
- Dropping a seed changes the digest.
- A fixture built to contain a known shape fires the family that exists for that shape: a pattern that
  can never match is a silent coverage hole, so the catalog is tested against code it must catch.
- No pattern makes the tail of a known identifier optional, because the regex engine accepts that and it
  silently matches neither the plain form nor the suffixed one.

### 6. Wrong vs Correct

Wrong: report nothing and let the absence of findings speak for itself. Emit a count of files.
Treat a pattern that fails to compile as "no matches". Fold an unreadable file into a clean result. Or
ship a pattern that can never match - a category then reports clean because nothing looked, which is
indistinguishable from a clean category until someone checks the catalog against code.

Correct: prove the negative with a receipt that names the roots, the file hashes, the families, and
the per-family hit counts, and fail the phase when any mandatory family did not run.

## Scenario: The Finding Claim Schema

### 1. Scope / Trigger

Trigger: turning a candidate into a finding, or changing what a finding must assert.

### 2. Signatures

```typescript
// src/code-audit/claim-schema.ts
const RULE_CHECKS = ["sink_semantics", "entry_reachability", "source_controllability", "data_flow",
  "parameter_usage", "defense_effectiveness", "auth_boundary", "combination_chains", "category_requirements"];
const PROOF_FIELDS_BY_CATEGORY: Readonly<Record<AuditCategory, readonly string[]>>;
function validateClaim(claim: unknown, knownCandidateIds: ReadonlySet<string>): readonly string[];
function findRepeatedExplanations(claims: readonly FindingClaim[]): readonly string[];
function findUndispositionedSeeds(seedCandidateIds: readonly string[], claimedCandidateIds: readonly string[]): readonly string[];
function reconcileDispositions(seeds: readonly SeedCandidate[], receipt: CoverageReceipt, claims: readonly unknown[]): DispositionReport;
function describeDispositionFailure(report: DispositionReport): string;
interface DispositionReport { ok; seedCount; claimCount; seedDigestVerified; seedDigestMismatch; claimErrors; undispositioned; repeatedExplanations }
```

### 3. Contracts

- A finding is a **claim with named obligations**, not a category label. The nine `ruleChecks` are a
  **closed set**: all nine present, none extra, each a real explanation.
- **A placeholder is rejected.** A bare `true`, `done`, `n/a`, or a value under 12 characters is a
  tick rather than an explanation. The checks ask what was examined and what was found.
- **A `CONFIRMED` claim must assert the preconditions of its own defect class.** Each category has
  its own obligations (4 to 7 of them), and a proof carrying a field that is not an obligation for
  its category is itself an error. Satisfying one category's obligations satisfies no other's.
- The reason this exists in code rather than in prose: a dangerous function name, a component
  version, a comment, or a whitelist entry cannot confirm a vulnerability, because none of them is
  evidence that the defect class's preconditions hold. Making the model name each one turns that from
  an instruction into a checkable assertion.
- **Status-specific obligations**: `HYPOTHESIS` must name its missing evidence - that list is the
  record's whole value; `FILTERED` and `NOT_REACHABLE` must explain why; `CONFIRMED` must carry a
  title, an impact, a remediation, a call chain and a proof of concept.
- **A call chain runs from `ROUTE` to `SINK`.** Each end is a way the claim can be wrong: a sink
  with no reachable entry is `NOT_REACHABLE`, and an entry that never reaches a dangerous operation
  is not a vulnerability. A chain with a missing edge is a `HYPOTHESIS`.
- A proof of concept must name its format and **what success looks like**; a request with no success
  indicator cannot tell a vulnerability from a 404.
- **`runtimeStatus` is `NOT_TESTED`, and only that.** The two state machines are separate, and the
  separation is the point: a runtime failure must never delete or downgrade a statically
  well-evidenced conclusion, and a static record must never claim a runtime result it did not get.
  One-member typing makes that unrepresentable rather than discouraged.
- **Every seed must be dispositioned**, and it is checked rather than trusted. A seed may be
  `CONFIRMED`, `HYPOTHESIS`, `FILTERED` or `NOT_REACHABLE`; what it may not do is go unmentioned.
- **The ids are derived from the seeds, never supplied as a list.** `reconcileDispositions` takes the
  seeds and the receipt the scan produced, derives the ids, and requires
  `seedDigest(seeds) === receipt.seedSha256`. An earlier version took an id list from the caller, which
  made the check's ground truth something the checked party supplies: a scan that produced four seeds
  passed it by reporting none. A caller can no longer hand in a shorter list than the scan found.
- **The receipt must describe this tree.** Binding the seeds to the receipt still left both as inputs, so
  `code-audit.diff` re-derives the scan from the receipt's own roots and refuses unless the fresh digest
  and the scanned-file hashes match. Without it an artifact can **assert** verification for a tree that
  produced a different set - the same defect one level up, and the reason the assertion is worth only
  what the re-derivation is worth. `validateReceipt` alone does not close it: it never compares a seed
  set to a receipt.
- **The enforcement point is the artifact writer**, not a capability the model elects to call. A
  capability that is never called is exactly as unenforced as a helper that is never called, and this
  rule was briefly both. `code-audit.disposition` remains as the **operator-facing exposure** - the only
  refusal that needs nothing on disk - and both callers share `reconcileDispositions`, so they cannot
  disagree about the rule itself.
- **The claim category must be the seed category.** `validateClaim` checks membership in the category list, and the `CONFIRMED` obligations are then chosen by the **claim's** category - so a claim carrying one defect class's four proof fields over another class's seeds passed validation, and after derivation the record and the artifact disagreed silently. The writer now requires equality.
- **Locations are relative and come from the seed.** SARIF's `artifactLocation.uri` is a URI and `Finding.path` is documented repository-relative, so an absolute drive path is neither; it also leaks the checkout layout and stops a baseline being portable, because the same-`(category, path)` tier could never fire across two roots. The derivation relativizes against the root the seed recorded. The seed keeps its absolute path - relativizing it would change every digest.
- **A hypothesis cannot gate a pipeline.** Severity maps as below, but a `HYPOTHESIS` is capped at `warning` however high its severity, so an unconfirmed finding cannot fail a build. The claim's own severity is still carried in `dove/severity`.
- **Run properties record what the artifact cannot otherwise show**: the seed count and digest, whether the seeds matched the receipt, the claim count, the disposition breakdown by status, and the baseline digest. The breakdown is what distinguishes "three seeds were filtered with a reason" from "three seeds were dropped"; the baseline digest is what distinguishes "nothing new" from a baseline written to say so.
- **Severity is carried, not just mapped.** SARIF's `level` has three values (`error`, `warning`,
  `note`) and the claim schema has four severities, so the writer maps `CRITICAL`/`HIGH` -> `error`,
  `MEDIUM` -> `warning`, `LOW` -> `note` - and that mapping **collapses CRITICAL and HIGH**, which the
  artifact alone could no longer distinguish. The result therefore also carries `dove/severity` with the
  claim's own value and `dove/status` with `CONFIRMED` or `HYPOTHESIS`. A reader of the artifact is not
  expected to reconstruct a distinction the mapping threw away.
- **Only the two result-producing statuses become results.** `FILTERED` and `NOT_REACHABLE` are exclusions
  and belong in the appendices; a seed with either still counts as dispositioned.
- **Unknown fields are rejected at every level**, so a field nobody validates cannot be used to
  smuggle an assertion past the schema.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `candidateId` with no corresponding seed | Rejected |
| Fewer or more than the nine `ruleChecks` | Rejected, naming them |
| A `ruleCheck` that is a placeholder or under 12 characters | Rejected |
| `CONFIRMED` with no `categoryProof` | Rejected |
| `CONFIRMED` with a partial proof | Rejected, naming the missing obligation |
| `categoryProof` without a required field, or with an extra one | Rejected |
| Unsupported category | Rejected |
| Call chain not starting at `ROUTE` or not ending at `SINK` | Rejected |
| Proof of concept with an unknown format or no success indicator | Rejected |
| `HYPOTHESIS` without `missingEvidence` | Rejected |
| `FILTERED` or `NOT_REACHABLE` without `rejectionReason` | Rejected |
| A static claim carrying a runtime status | Rejected |
| Unknown field | Rejected by name |
| One explanation reused verbatim across candidates for a check | Reported, not fatal |
| Seed digest does not match the receipt | Refused, with the mismatch leading the message |
| Receipt does not reproduce from its own roots | Refused before anything is written |
| Scanned-file hashes differ from the receipt | Refused |
| Same seeds, different order | Refused: the digest is over the canonical order |

### 5. Tests Required

- A complete `CONFIRMED` claim is accepted.
- Every row of the matrix above.
- Each category rejects another category's proof, so the obligations are not a shared checklist.
- A claim cannot repeat itself.
- A seed set that does not match the receipt is refused, on its own line rather than as one claim error
  per claim, and claim validation is skipped while the seed set is untrustworthy.
- The writer refuses a receipt that does not reproduce from its own roots, and re-hashes every scanned
  file - so an artifact cannot assert verification for a tree that produced a different seed set.

### 6. Wrong vs Correct

Wrong: a boolean confidence field, a checkbox per category, or a free-text summary. All three can be
satisfied by plausible text, and none of them distinguishes a defect from a mention of one.

Correct: name the obligations per category, require an explanation for each of the nine checks, and
make a `HYPOTHESIS` with named missing evidence a respectable output rather than a failure.
