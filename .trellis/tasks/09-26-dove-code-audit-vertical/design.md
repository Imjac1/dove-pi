# Dove Code Audit Vertical - Design

## 1. Scope

Build the first real vertical on the base agent framework: a security audit that produces findings the
existing evidence plane can diff across runs.

**In scope**: a deterministic catalog-driven seed scanner; a coverage receipt that makes "no findings"
believable; a per-category finding claim schema; and the three fixes to the frozen finding-identity
contract.

**Out of scope**: reimplementing static analysis; an LLM review pass over whole diffs (the community
evidence says it does not meet the acceptance bar); auto-fixing; scanning targets the operator does not
own; and porting the reference packages' 16-phase pipeline or its 267-366 KB orchestrator.

## 2. Architecture and boundaries

### What already exists and is not redesigned

| Module | Role |
|---|---|
| `src/core/loop.ts`, `loop-runner.ts` | the execution loop and its three enforced rules |
| `src/core/effect-ledger.ts` | effect identity and exactly-once |
| `src/core/evidence-sarif.ts` | SARIF output with fingerprints and `baselineState` |
| `src/core/checkpoint.ts`, `context-admission.ts`, `capability-scope.ts` | resume, admission, scoping |
| `modes/code-audit/` | the declarative mode (3 files) |

### What this task adds

```text
src/code-audit/                      a domain directory, mirroring src/web-access/
  catalog.ts                         load and validate the seed catalog
  seed-scanner.ts                    run every family of every category -> PENDING seeds
  receipt.ts                         build and validate the coverage receipt
  claim-schema.ts                    per-category proof obligations, status rules, and the
                                     reconciliation that enforces the seed closure
modes/code-audit/catalog/            the catalog itself, as data
src/capabilities/code-audit.ts       register the capabilities
src/core/evidence-sarif.ts           the three fixes (generic, not audit-specific)
```

**There is no `src/code-audit/diff.ts`.** The first draft of this design listed one. The tiered
baseline match turned out to be a **generic** improvement to the evidence plane - the three defects it
repairs are not audit-specific - so it lives in `src/core/evidence-sarif.ts` and the vertical only composes
it. That is the same judgement the next paragraph gives for the fixes themselves, applied to the module
that holds them.

**Why `src/code-audit/` and not `src/core/`.** The framework's binding rule is that a mode id must never
appear in executable code under `src/core` - a vertical that needs a core change is a framework defect.
The scanner, the catalog, and the claim schema are audit-specific and live outside core. The three
identity fixes are **generic improvements to the evidence plane** (an occurrence index, four baseline
states, and move detection are correct for any producer of findings), so they belong in core, with the
audit vertical as their motivation rather than their content.

**Why not wrap an engine as the seed source.** Two independent research waves agree that wrapping buys
rules and a SARIF container and **nothing else**: gosec's SARIF builder sets zero fingerprint or
baselineState fields, Trivy's report is clean of them, and Bandit's issue model has no fingerprint field
at all. No engine surveyed documents a determinism guarantee; CodeQL states the opposite. And the
licence position rules several out: CodeQL's terms forbid this integration, and `semgrep-rules` are
"internal business use" only. **The deterministic scanner is ours regardless of whether an external
engine is later added as a second seed source.**

## 3. The seed spine

### The catalog

Data, not code. One file per language, validated at load:

```json
{ "schema_version": 1,
  "categories": {
    "SQL_INJECTION": {
      "prefix": "SQL",
      "suffixes": [".php"],
      "families": [ { "id": "pdo", "patterns": ["->(?:query|exec|prepare)\\s*\\("] } ]
    }
  } }
```

A **family** is the unit of mandatory coverage. The catalog for the first language is authored from the
reference's model (11 categories, ~41 families) and is expected to grow; it is versioned so a change is
visible in the receipt.

### The scanner

Deterministic, offline, model-free:

1. Validate the catalog.
2. Resolve source roots; **error if none exist**.
3. Compile every pattern of every family, recording what was executed.
4. Walk files matching the category's suffixes; **hash every file read**.
5. For each line, for each pattern: `search`. On a hit, key by `(family, casefolded path, line)` so one
   line cannot yield the same family twice; record `family_hits[family]`.
6. Emit a seed whose shape is fixed: `candidateId`, `category`, `engine: "deterministic-catalog"`,
   `sink: {family, symbol, location}`, `evidence: [{path, line, excerpt}]`, `status: "PENDING"`.
7. Sort by casefolded `candidateId`.

**Seeds are non-deletable.** A later stage may add candidates and may classify a seed, but a seed that
disappears without a disposition is a validation failure. This is the anti-false-negative mechanism, and
the reference states it plainly: the model "*may add or enrich ... but cannot delete machine seeds*".

### The receipt - why "no findings" becomes believable

```text
{ schema_version, catalog_version, category, scope,
  source_roots[], scanned_files[], scanned_file_sha256{}, scanned_file_count,
  mandatory_families[], executed_patterns[{family, pattern}], hit_count,
  family_hits{family: n}, unreadable_files[], gaps[], seed_sha256 }
```

Validation **fails the phase** when the schema or catalog version differs, when the category differs,
when `mandatory_families` does not equal the catalog's family set, when the families seen in
`executed_patterns` do not equal that set, or when `source_roots` is empty.

**The receipt proves the negative.** "This category produced no findings" is believable only because the
receipt shows which roots were searched, which files were read and their hashes, which families ran, and
the hit count per family. `seed_sha256` binds the receipt to the exact seed set, so neither can be
edited without the other.

**Unreadable files become a declared gap, never a successful zero.** A read failure is recorded in
`unreadable_files` and adds to `gaps`. The reference design states the rule and the implementation
enforces it: unreadable entries "*must never be converted into successful zero coverage*".

## 4. The claim schema

Our framework has an evidence plane and **no schema for what a finding must assert**. The reference has
the opposite. This task adds the missing half.

A finding is not "a vulnerability"; it is **a claim with named, category-specific obligations**:

```typescript
interface FindingClaim {
  readonly candidateId: string;              // must be a seed this run produced; see below
  readonly category: AuditCategory;
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly status: "CONFIRMED" | "HYPOTHESIS" | "FILTERED" | "NOT_REACHABLE";
  readonly ruleChecks: Readonly<Record<RuleCheck, string>>;   // nine, each non-empty
  readonly categoryProof?: Readonly<Record<string, string>>;  // required when CONFIRMED
  readonly missingEvidence?: readonly string[];  // required when HYPOTHESIS
  readonly rejectionReason?: string;             // required when FILTERED or NOT_REACHABLE
  readonly runtimeStatus: "NOT_TESTED";          // static records only
}
```

**A claim names a seed, and only a seed.** An earlier draft said "a seed or a declared addition",
which the schema forbids: `validateClaim` rejects any `candidateId` outside the scanned set, and nothing
defines an addition, so the alternative was unimplementable as written. The consequence is real and worth
stating rather than discovering: **a defect found by reading code, with no catalog hit, cannot become a
result** - it can only be prose in an appendix. That is accepted, because the alternative is a
caller-supplied location, which is the class of defect this vertical spent five rounds removing. If it ever
bites, the fix is to extend the seed contract with a manual engine whose evidence is a scanned
file, line and excerpt - not to reintroduce a findings file.

**The nine `ruleChecks`**: `sink_semantics`, `entry_reachability`, `source_controllability`,
`data_flow`, `parameter_usage`, `defense_effectiveness`, `auth_boundary`, `combination_chains`,
`category_requirements`. Each is a non-empty explanation; a placeholder such as `true`, `done`, or a
copied conclusion is rejected.

**Per-category proof obligations** make the shortcut impossible. To mark a `SQL_INJECTION` finding
`CONFIRMED`, the claim must assert `sql_executed`, `syntax_influenced`, `source_controlled`, and
`parameterization_absent`. `FILE_UPLOAD` requires seven: `content_controlled`, `persisted`,
`extension_controlled`, `script_extension_allowed`, `web_accessible`, `script_execution_mapped`,
`post_upload_url_known`. **A dangerous function name cannot satisfy any of them**, which is how
"a function-name hit only produces a candidate" becomes mechanical rather than advisory.

**Unknown fields are rejected**, at every level. Three independent implementations now agree on this
rule (this framework's work-mode loader and authority validator, and the reference's evidence schema,
whose source comment reads: unknown fields are rejected "*so a model cannot smuggle ad-hoc fields that
downstream systems might silently trust*").

## 5. Finding identity - fixing D1, D2, and D3

### The three defects, precisely located

| | Defect | Location | Evidence |
|---|---|---|---|
| **D1** | `fingerprintOf` hashes `path \| category \| code`, so **a move is indistinguishable from an edit** | `src/core/evidence-sarif.ts:44` | Semgrep's `code_hash` docstring: hashing **only** the code contents is what lets it tell "moved files (path changed)" from "moved down a file (index changed)" |
| **D2** | `baselineState` emits only `new` and `unchanged` | `src/core/evidence-sarif.ts:105` | The SARIF SDK's shipped baseline fixtures use four: `new`, `unchanged`, `updated`, `absent` |
| **D3** | The occurrence index is not in the identity, so identical matches collapse | `src/core/evidence-sarif.ts:72,106` | `github/codeql-action/src/fingerprints.ts` emits `hash:occurrenceIndex`; Semgrep puts `index` inside `syntactic_id` |

### The fix

**Carry two hashes, not one** - which is what Semgrep does, and the reason it does:

```typescript
// Content-derived only: no path. This is what makes a move visible as a move.
contentHash = sha256(category | normalizedMatchedCode)

// Disambiguates identical matches. Index is counted within (category, code, path),
// ordered by line, so inserting an unrelated finding does not renumber others.
findingId   = sha256(category | normalizedMatchedCode | occurrenceIndex)
```

`FINGERPRINT_KEY` becomes `doveFinding/v2`; `v1` values are not comparable and the version change makes
that visible rather than silently producing a wall of new findings.

**Baseline matching becomes tiered and deterministic** - no model call, mirroring the reference's
insight that identity decisions belong to the reducer:

| Tier | Rule | Result |
|---|---|---|
| 1 | exact `findingId` present in the baseline | `unchanged` |
| 2 | no exact match, but a baseline entry with the same `contentHash` at a **different** path | `unchanged` at the new location, **and the move is recorded** |
| 3 | no match above, but a baseline entry with the same `(category, path)` | `updated` |
| 4 | a baseline entry matched by no tier | `absent` |
| 5 | a finding matched by no baseline entry | `new` |

Every tier is a cheap deterministic rule. **A moved finding now reads as unchanged-at-a-new-location, an
edited one as `updated`, a deleted one as `absent`, and only genuinely new ones as `new`** - which is
the whole point of the evidence plane.

### Why not simply drop the path from the existing hash

Because then two findings of the same category with identical matched code in **one file** would collide,
silently losing a real defect. The occurrence index is what keeps them distinct, and Semgrep, CodeQL, and
SARIF's own `occurrenceCount` all independently carry one.

## 6. Data flow

```text
repository
   |
   v
[capability] code-audit.seed        catalog -> scan -> PENDING seeds + receipt
   |                                                  |
   |                                                  +--> receipt validated; phase fails on a
   |                                                       missing family or an unread file
   v
[the run]    verify                 the agent writes one FindingClaim per seed (nine ruleChecks,
   |                                 category proof). There is no stage construct in this framework,
   |                                 so this is the model's work, checked by the next step rather
   |                                 than scheduled by one - which is why AC5 says the check is
   |                                 enforced at the writer and not here.
   |                                       |
   |                                       +--> unknown fields rejected; CONFIRMED without its
   |                                            category proof is rejected
   v
[capability] code-audit.diff        seeds + claims + baseline -> derives the findings from the seeds
   |                                 -> evidence-sarif.ts -> SARIF. One capability, because the emit
   |                                 and the diff cannot be separated without leaving an artifact that
   |                                 was never reconciled.
   |                                                          |
   |                                                          +--> findingId + contentHash
   v
reports/findings.sarif
```

**The gate.** Every action still passes the loop's pre-execution gate. The mode's permission policy keeps
`read_* allow` / `report.write ask` / `shell.exec deny`, and the scanner needs no shell because it is
in-process - so **the frozen `never_allow: [shell.exec]` stays intact**.

## 7. Compatibility and migration

| Change | Compatibility |
|---|---|
| `FINGERPRINT_KEY` `doveFinding/v1` -> `v2` | **Breaking by design.** v1 and v2 are not comparable, and the key version is how that is made visible. An existing v1 baseline must be regenerated; the alternative - Bearer's approach - is a migration command that carries an old baseline forward. **Deferred**: the reference packages show migration is the real alternative to versioning, but no baseline exists in the wild yet. |
| `baselineState` gains `updated` and `absent` | Additive. Existing consumers see the same two values plus two more. |
| `contentHash` added to `partialFingerprints` | Additive; a second key. |
| Per-category claim schema is new | No existing producer, so nothing breaks. |
| The mode's governance gains the new capability | Additive; the mode version increments so a run can be attributed. |
| The 09-25 tests asserting two baseline states | **Will fail and must be updated** - they assert the current behaviour deliberately. |

**Two contract rules to keep deliberately.** This framework persists `partialFingerprints` even though
SARIF SDK rule `AI2011.DoNotPersistPartialFingerprints` says a producer should not - because no consumer
exists in the loop and the baseline is the product; the design records why rather than drifting. And the
SDK's own matcher still carries `TODO: Handle versioning of partial fingerprints`, so the versioned key
is ahead of the reference SDK, not misaligned with it.

## 8. Trade-offs

- **Depth vs breadth.** A catalog of ~41 regex families finds far less than CodeQL. Accepted: analysis
  quality is delegated and grows over time; identity, evidence, and governance are what this project
  contributes. A shallow scanner with a trustworthy diff beats a deep scanner whose re-run is noise.
- **Deterministic seeds produce false positives by construction.** A regex hit is not a finding; it is a
  candidate. This is deliberate - the cost of a candidate is one verification pass, and the cost of a
  missed sink is a missed vulnerability. The bias is stated, not hidden.
- **No engine means no engine-grade rules.** Accepted for the MVP; an external engine can later be added
  as a **second seed source** without changing the receipt, the identity scheme, or the claim schema.
- **A schema can be satisfied performatively.** A model can fill nine fields with plausible text.
  Mitigated, not solved: the per-category proof fields are specific enough that a shortcut has to be
  argued, and 07b's derived evidence can be cross-checked. **The measured bar is Google's <10% effective
  false-positive rate**, and nothing here claims to meet it yet.

## 9. Rollback

- The identity change is confined to `src/core/evidence-sarif.ts` and its test. Reverting that file
  restores v1 behaviour with no other change.
- The new modules under `src/code-audit/` are additive; removing them and the capability registration
  returns the framework to its 09-25 state.
- The catalog is data; deleting it makes the capability fail loudly rather than silently produce nothing.
- No migrated state, no schema migration, no external service.

## 10. Deferred decisions

- **An external engine as a second seed source** (Opengrep is the only survey candidate with a real
  unauthenticated SARIF fingerprint and a clean engine licence, but its **rule-set licence was not
  verifiable** and needs a legal read before any bundling). **Does not change MVP behaviour.**
- **Baseline migration instead of key versioning** (Bearer's `ignore migrate` plus
  `StaleIgnoredFingerprintIds`). Relevant only once a baseline exists that is worth carrying forward.
- **The runtime-validation half of the reference** (stages 11-12, structured success indicators,
  same-origin request planning, the "approving a target URL does not authorize state-changing probes"
  rule). Deliberately out of scope for the first vertical.
- **Cross-category root-cause clustering** (the reference's `07c`). Our diffing is across runs; theirs is
  within a run. Both are needed eventually; this task does the across-run half, which is what
  `baselineState` requires.
