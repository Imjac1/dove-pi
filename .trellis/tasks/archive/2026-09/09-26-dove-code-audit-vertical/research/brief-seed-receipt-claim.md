# Implementation brief: the seed, receipt, claim, and identity contracts

This brief carries the **concrete shapes** to implement. It is a distillation of
`reference-caigosec-analysis.md` (read that for the reasoning and the source anchors) plus the two
research waves that bear on identity. It exists because the full research files exceed the context
injection limit and would be truncated exactly where their most useful sections are.

## 1. The catalog (data, not code)

```json
{ "schema_version": 1,
  "categories": {
    "SQL_INJECTION": {
      "prefix": "SQL",
      "suffixes": [".php", ".phtml", ".inc"],
      "families": [
        { "id": "mysql_legacy", "patterns": ["\\bmysql_(?:query|unbuffered_query|db_query)\\s*\\("] },
        { "id": "pdo", "patterns": ["->(?:query|exec|prepare)\\s*\\(", "\\bPDO::(?:query|exec)\\s*\\("] },
        { "id": "sql_composition", "patterns": ["(?:SELECT|INSERT|UPDATE|DELETE)\\b[^;]*(?:\\.\\s*\\$|\\{\\$)", "\\$sql\\s*\\.="] }
      ]
    }
  } }
```

A **family** is the unit of mandatory coverage. The reference's catalog has 11 categories and **41
families**: SQL 5, COMMAND_EXEC 3, CODE_EXEC 3, FILE_INCLUSION 3, FILE_UPLOAD 6, FILE_READ 4, SSRF 4,
XXE 4, DESERIALIZATION 4, TEMPLATE_INJECTION 4, ZIP_EXTRACT 3. The category list is the reference's; the
patterns are ours to author and must be attributable.

**Load-time validation**: `schema_version` matches; categories is a non-empty object; each category has
a non-empty `prefix`, a non-empty `suffixes` array, and at least one family; each family has a non-empty
`id` and at least one pattern; **every pattern must compile** - an invalid regex is a load error, never a
silent skip.

## 2. The scanner

Deterministic, offline, in-process, no model, no shell.

1. Load and validate the catalog.
2. Resolve the category's source roots, deduplicate, keep existing; **error if none exist**.
3. Casefold the category's `suffixes`; collect matching files.
4. **Compile every pattern of every family**, and record `executed_patterns` as `{family, pattern}`.
5. Initialise `family_hits = {family: 0}` for **all** families, so a family with zero hits still appears.
6. For each file: read lines (utf-8, tolerant of bad bytes) and **hash the file**.
7. For each line, for each compiled pattern: `search`. On a hit:
   - key by `(familyId, path.casefold(), lineNumber)`; if seen, skip - one line yields one hit per family
   - `family_hits[familyId] += 1`
   - `excerpt = line.trim().slice(0, 1000)`
   - derive the seed id from `(prefix, category, familyId, path, lineNumber, excerpt)`
   - emit the fixed record shape below
8. Sort records by casefolded `candidateId`.

**Seed record shape** (fixed; a later stage may add fields but must not remove these):

```json
{ "candidateId": "SQL-0001", "category": "SQL_INJECTION",
  "engine": "deterministic-catalog", "sourceScope": "...",
  "route": null, "authState": "UNKNOWN", "source": null, "propagation": [],
  "sink": { "family": "pdo", "symbol": "->query(", "location": "app/Dao.php:88" },
  "sanitizers": [],
  "evidence": [{ "path": "app/Dao.php", "line": 88, "excerpt": "$rows = $db->query($sql);" }],
  "coverage": { "searched": ["..."], "gaps": [] },
  "status": "PENDING" }
```

**Seeds are non-deletable.** A seed may be classified or rejected later, but one that disappears without
a disposition is a validation failure. The reference's rule, verbatim: the model "*may add or enrich
machine seeds but cannot delete*" them.

## 3. The coverage receipt

```json
{ "schemaVersion": 2, "catalogVersion": 1, "category": "SQL_INJECTION",
  "mode": "...", "scope": "...",
  "sourceRoots": ["..."], "scopeLimited": false, "requestedScopeFiles": [],
  "scannedFiles": ["..."], "scannedFileSha256": { "path": "sha256" }, "scannedFileCount": 12,
  "mandatoryFamilies": ["mysql_legacy", "pdo", "sql_composition"],
  "executedPatterns": [{ "family": "pdo", "pattern": "..." }],
  "hitCount": 3, "familyHits": { "mysql_legacy": 0, "pdo": 2, "sql_composition": 1 },
  "unreadableFiles": [], "gaps": [],
  "seedSha256": "sha256 over the canonical serialization of the seed set" }
```

**`validateReceipt` must fail the phase when:**

- `schemaVersion` does not equal the expected value
- `catalogVersion` does not equal the loaded catalog's `schema_version`
- `category` does not match the category being validated
- **`mandatoryFamilies` as a set does not equal the catalog's family set** for that category
- **the families present in `executedPatterns` as a set do not equal that same set** - reported as
  "did not execute every mandatory family"
- `sourceRoots` is missing or empty

**`seedSha256` binds the receipt to the exact seed set**, so neither can be edited without the other.
Serialize canonically (sorted keys, stable ordering) before hashing.

**Unreadable files**: a read failure is recorded in `unreadableFiles` and adds an entry to `gaps`. It
**must never be converted into a successful zero**. This is the reference design's rule, verbatim:
unreadable entries "*must never be converted into successful zero coverage*".

## 4. The claim schema

A finding is a **claim with named obligations**, not a category label.

```typescript
interface FindingClaim {
  readonly candidateId: string;      // must correspond to a seed, or be a declared addition
  readonly category: AuditCategory;
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly status: "CONFIRMED" | "HYPOTHESIS" | "FILTERED" | "NOT_REACHABLE";
  readonly ruleChecks: Readonly<Record<RuleCheck, string>>;
  readonly categoryProof?: Readonly<Record<string, string>>;
  readonly missingEvidence?: readonly string[];
  readonly rejectionReason?: string;
  readonly runtimeStatus: "NOT_TESTED";
}
```

**The nine `ruleChecks`** - all required, all non-empty strings, none extra:

`sink_semantics`, `entry_reachability`, `source_controllability`, `data_flow`, `parameter_usage`,
`defense_effectiveness`, `auth_boundary`, `combination_chains`, `category_requirements`.

**Structured obligations per category**, required when `status === "CONFIRMED"`. An empty or partial
proof is a rejection, and an unsupported category is itself an error:

| Category | Required proof fields |
|---|---|
| `SQL_INJECTION` | `sql_executed`, `syntax_influenced`, `source_controlled`, `parameterization_absent` |
| `COMMAND_EXEC` | `process_started`, `execution_semantics_controlled`, `source_controlled`, `defense_absent` |
| `CODE_EXEC` | `execution_sink_reached`, `executable_semantics_controlled`, `dangerous_target_reachable`, `defense_absent` |
| `FILE_INCLUSION` | `consumer_reached`, `path_controlled`, `boundary_crossed`, `defense_absent` |
| `FILE_UPLOAD` | `content_controlled`, `persisted`, `extension_controlled`, `script_extension_allowed`, `web_accessible`, `script_execution_mapped`, `post_upload_url_known` |
| `FILE_READ` | `read_sink_reached`, `selection_controlled`, `boundary_crossed`, `content_disclosed` |
| `SSRF` | `effective_url_fully_controlled`, `scheme_controlled`, `host_controlled`, `port_controlled`, `server_request_issued`, `destination_defense_absent` |
| `XXE` | `xml_controlled`, `parser_reached`, `external_resolution_enabled`, `external_effect_possible` |
| `DESERIALIZATION` | `payload_controlled`, `deserializer_reached`, `object_graph_or_type_controlled`, `integrity_defense_absent` |
| `TEMPLATE_INJECTION` | `template_source_controlled`, `engine_reached`, `expression_execution_possible`, `sandbox_absent` |
| `ZIP_EXTRACT` | `archive_controlled`, `extraction_reached`, `entry_path_controlled`, `destination_boundary_crossed` |

**Status-specific requirements**: `HYPOTHESIS` requires a non-empty `missingEvidence`; `FILTERED` and
`NOT_REACHABLE` require a non-empty `rejectionReason`; `CONFIRMED` requires its category proof.
`runtimeStatus` is fixed to `NOT_TESTED` on every static record - a static record carrying a runtime
status is rejected. Runtime statuses (`VALIDATED`/`FAILED`/`INCONCLUSIVE`/`BLOCKED`) belong to a
separate state machine that this task does not build.

**Reject unknown fields at every level**, in the same style as `src/core/authority.ts`'s
`validateAuthorityDocument`. The reference's source comment states the reason: unknown fields are
rejected "*so a model cannot smuggle ad-hoc fields that downstream systems might silently trust*".

**Reject placeholder text** in a `ruleCheck`: a bare `true`, `done`, `n/a`, or a value identical to
another claim's for the same check. The reference forbids exactly this: "*filling in `true`, `done`,
template sentences, or copying another candidate's conclusion is forbidden*".

## 5. The identity contract (D1, D2, D3)

### Current state, precisely

```text
src/core/evidence-sarif.ts:41   FINGERPRINT_KEY = "doveFinding/v1"
src/core/evidence-sarif.ts:44   fingerprintOf(finding: Pick<Finding, "path" | "category" | "existingCode">)
src/core/evidence-sarif.ts:105  baselineState: options.baseline === undefined ? "new"
                                  : options.baseline.has(fingerprint) ? "unchanged" : "new"
src/core/evidence-sarif.ts:106  occurrenceCount: count
```

### Required change

```typescript
// Path-free. This is what makes a move observable as a move rather than as an edit.
contentHash = sha256(category | normalize(matchedCode))

// The disambiguated identity. occurrenceIndex counts within (category, code, path),
// ordered by line, so an unrelated insertion does not renumber existing findings.
findingId   = sha256(category | normalize(matchedCode) | occurrenceIndex)
```

Bump `FINGERPRINT_KEY` to `doveFinding/v2`. Emit **both** hashes under `partialFingerprints`.
`normalize` should collapse whitespace runs and trim, so indentation changes do not alter identity.

### Tiered baseline match, applied in order

| Tier | Rule | Emitted `baselineState` |
|---|---|---|
| 1 | exact `findingId` present in the baseline | `unchanged` |
| 2 | no exact match, but a baseline entry with the same `contentHash` at a **different** path | `unchanged`, reported at the new location, **with the move recorded** |
| 3 | no match above, but a baseline entry with the same `(category, path)` | `updated` |
| 4 | a baseline entry matched by no tier above | `absent` |
| 5 | a finding matched by no baseline entry | `new` |

Every tier is deterministic and cheap; **no model call decides identity.** Ties within a tier must be
resolved by a stated, deterministic rule (lowest path, then lowest line) so two runs agree.

### Evidence for each part

- **Occurrence index in the identity.** `github/codeql-action/src/fingerprints.ts` emits
  `hash:occurrenceIndex`; Semgrep places `index` inside `syntactic_id`; SARIF 2.1.0 defines
  `occurrenceCount`. Without it, two findings of one category on identical matched code in **one file**
  collapse and a real defect is lost.
- **A path-free hash as well.** Semgrep's `code_hash` docstring, verbatim: "*By sending the hash of ONLY
  the code contents, we can determine whether a finding has moved files (path changed), or moved down a
  file (index changed) and handle that logic in the app.*" Semgrep ships six identity hashes precisely
  because one is not enough.
- **Four `baselineState` values.** The SARIF SDK's shipped baseline fixtures use `new` (211),
  `unchanged` (22), `updated` (7), `absent` (1). Emitting two of four is why a moved finding currently
  reads as one new finding plus one silent disappearance.
- **Path and rule id must be byte-stable.** GitHub documents the two duplicate-alert failure modes as a
  `ruleId` that changes between runs and inconsistent artifact paths.

### The bar this is measured against

Google's *Software Engineering at Google* caps a code-review-surfaced check at **<10% effective false
positives** ("effective" = the developer took no action), with <5% measured fleet-wide. **No study was
found that measures fingerprint stability across runs or the quality of a re-run's diff** - so the
vertical's central acceptance criterion is a contract we define and test ourselves, not one we inherit.
Do not present it as externally validated.

## 6. Binding constraints

- **No audit-specific code under `src/core`.** `tests/code-audit-mode.test.ts` reads every file in
  `src/core`, strips comments, and fails if the mode id appears in executable code. The identity fixes
  are generic; nothing else in core may mention the vertical.
- **`never_allow: [shell.exec]` stays intact.** The scanner is in-process; no shell is needed. If a
  later change wants a CLI engine, that is a separate decision with a licence read attached.
- **No network, no execution of target code.** The scanner reads text and hashes files. Nothing in the
  vertical executes the audited repository.
- **Fail closed.** An unevaluable condition is a validation failure, never a default.
- **Seeds are non-deletable**; a seed without a disposition fails validation.

## 7. The measure this is judged against

The community wave produced the only large-scale operational threshold in the public record, and it is
what this vertical should eventually be measured against. **Google's *Software Engineering at Google*
caps a check surfaced in code review at "<10% effective false positives", with "<5%" measured
fleet-wide** across more than 50k review changes per day. "Effective" means the developer took no
action; it is deliberately not the same as a raw false-positive rate.

Four findings that shaped the design rather than the implementation:

- **A standalone LLM reviewer does not meet that bar.** CASTLE (250 C programs, 25 CWEs): the best model
  reached P=63% / R=78% - roughly 37% of its findings are false - against CodeQL's P=48% / R=29%. In the
  field, a study of 31,073 reviews found **36.4% accepted, 7.3% discussed, 56.3% rejected**.
- **The LLM's reproducible win is triage over a scanner.** An industrial study over 433 scanner alarms
  found that combining a model with static analysis **eliminates 94-98% of false positives at high
  recall**. This is why the design is scanner-first with the model as a staged validator, and why a broad
  review pass is out of scope.
- **General-purpose LLM review is not security review.** A study of Copilot code review across seven
  labelled vulnerable datasets produced fewer than 20 comments in total, mostly typos; 878 of 898
  Wireshark files produced zero comments, and no SQL injection or XSS was flagged.
- **The bottleneck is triage capacity, not detection.** Google's FindBugs "Fixit" week reviewed 3,954
  warnings and **only 16% were actually fixed**. This is the argument for the identity contract: its job
  is not to find more, it is to **stop re-presenting the same finding**.

**Do not cite as evidence**: vendor figures such as Graphite's "5-15% false positives", CodeRabbit's
leaderboard post, AISLE's blog, and Augment's guide. They publish no methodology. Several of the measured
sources are arXiv pre-prints and unreplicated; CASTLE's model rows are from early 2025 and must not be
projected onto later models. And the three quantities in circulation - CASTLE's precision, "percentage
acted on", and Google's "effective false-positive rate" - are **different measurements and must not be
placed on one axis**.

**The honest gap.** No study was found that measures fingerprint stability across runs or the quality of
a re-run's diff. The vertical's central acceptance criterion therefore has **no external evidence base**.
It is a contract defined and tested here, and it must be described that way rather than as validated.

