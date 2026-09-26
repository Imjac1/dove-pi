# Research: open-source code-audit and AI-code-review projects — how they shape a finding, and how they identify it across runs

- **Query**: "Survey open-source code-audit and AI-code-review projects on GitHub, reading their source rather than their READMEs."
- **Scope**: 14 projects, deliberately mixed — AI PR-review agents, SAST-agent hybrids, vulnerability-discovery agents, and the scanners themselves. For each: (1) what it wraps, (2) how a finding is produced and where its shape is defined, (3) **identity and dedup across runs** (the primary question), (4) scanner-output size handling, (5) false positives, (6) read-only vs. write, (7) health.
- **Date of survey**: 2026-09-25 (all `stars` / `pushed_at` are point-in-time from `api.github.com` on that date).
- **Method**: source read, not READMEs. Files were retrieved from `raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`, from repository tarballs via `codeload.github.com` expanded locally and grepped, and (where the API rate limit allowed) from `api.github.com/repos/<owner>/<repo>` for metadata. The exact file read is named for every claim.
- **Reader's note on epistemics**: each project section separates **[stated]** (a quotation or a direct description of code I read), **[inference]** (what I conclude from it), and **[opinion]** (my judgement). The *What is reusable for this vertical* and *Caveats* sections are mostly opinion and are labelled as such.

---

## Findings

### 1. microsoft/sarif-sdk — the reference implementation of "same finding, next run"

- **Repo**: `microsoft/sarif-sdk` · 226 stars · last push `2026-09-24` · licence `MIT` per file headers (GitHub API reports `NOASSERTION`) · default branch `main` · C#
- **Files read**: `src/Sarif/HashUtilities.cs`, `src/Sarif/Visitors/InsertOptionalDataVisitor.cs`, `src/Sarif/Baseline/ResultMatching/HeuristicMatchers/PartialFingerprintResultMatcher.cs`, `src/Sarif/Baseline/DefaultBaseline/ResultBaselineEquals.cs`, `src/Sarif.Multitool.Library/Rules/AI2011.DoNotPersistPartialFingerprints.cs`, `src/Test.UnitTests.Sarif/Visitors/InsertOptionalDataVisitorTests.cs`, `src/Test.FunctionalTests.Sarif/TestData/Multitool/BaselineOption/ExpectedOutputs/*.sarif`

**[stated]** This is the SDK behind CodeQL's SARIF and the `sarif` Multitool. It defines two distinct content-derived fingerprints:

1. `public const string ContextRegionHash = "contextRegionHash/v1";` — a **versioned key** — whose value is `HashUtilities.ComputeStringSha256Hash(contextRegionSnippet.Text)` (`InsertOptionalDataVisitor.cs:253`), i.e. **sha256 of the matched code's surrounding snippet text only**.
2. `public const string PrimaryLocationLineHash = "primaryLocationLineHash";` whose value comes from `HashUtilities.RollingHash(fileText)` keyed by line (`InsertOptionalDataVisitor.cs:282-288`). The source comment says: *"The fingerprint anchors to the primary location's startLine. A result with no region line pertains to the whole file and is fingerprinted from line 1, matching the reference implementation (github/codeql-action fingerprints.ts)."*

**[stated]** `HashUtilities.RollingHash` is a Rabin–Karp rolling hash: `BLOCK_SIZE = 100`, `MOD = 37`, emitting per line the string *hashValue* + ":" + *occurrenceCount* — i.e. **the fingerprint carries an occurrence counter so identical lines in one file stay distinguishable**.

**[stated]** Rule `AI2011.DoNotPersistPartialFingerprints` warns on any `partialFingerprints` in a producer's output, with a narrow carve-out: *"A GitHub-hosted run may persist the single rolling-hash primaryLocationLineHash: GitHub's raw code-scanning SARIF upload API does not backfill partialFingerprints, so emitting it is what keeps API-upload pipelines from raising duplicate alerts. Any other partial fingerprint, and any partial fingerprint on a non-GitHub run, is still flagged."* Rule `AI1007.DoNotPersistFingerprints` is the same warning for `fingerprints`.

**[stated]** Baseline matching: `PartialFingerprintResultMatcher` declares two results equal iff **all** partial-fingerprint key/value pairs match, and its docstring carries `TODO: Handle versioning of partial fingerprints.` `ResultBaselineEquals` compares `RuleId`, `AnalysisTarget`, `Locations`, `RelatedLocations`, `Fingerprints` **values only, ignoring keys**, `PartialFingerprints` values only, `Stacks`, `CodeFlows`.

**[stated]** The baseline artifact is itself a SARIF log, and `baselineState` takes four values in the shipped expected-output fixtures (`Test.FunctionalTests.Sarif/TestData/Multitool/BaselineOption/ExpectedOutputs/`): `"new"` x211, `"unchanged"` x22, `"updated"` x7, `"absent"` x1.

**[stated]** It is tested: `src/Test.UnitTests.Sarif/Visitors/InsertOptionalDataVisitorTests.cs:617-725` covers `PersistsPrimaryLocationLineHash`, `PrimaryLocationLineHashKeyMatchesGitHubContract` (asserting `"primaryLocationLineHash"`), `FromLineOneWhenRegionMissing`, `SkippedWhenArtifactUnresolvable`, `PreservedWhenAlreadyPresent`, `OverwrittenWhenRequested`, `ComputedPerLineForSharedFile`; plus `src/Test.UnitTests.Sarif/Baseline/**` and a whole `src/Test.EndToEnd.Baselining` project.

**[inference]** The SDK's answer to "identity across runs" is: **hash the code, not the message; version the key; keep a per-line occurrence counter; and let the consumer, not the producer, attach fingerprints.** The presence of a *versioned* key (`contextRegionHash/v1`) alongside a *stable* key (`primaryLocationLineHash`) shows both patterns coexist deliberately.

**[opinion]** The most directly transferable artefact in this survey for the `doveFinding/v1` decision. It independently validates two of the framework's choices (versioned key; content-derived identity) and contradicts one habit worth re-examining (see Caveats: the SDK says a producer should *not* persist partial fingerprints at all).

---

### 2. github/codeql-action — `primaryLocationLineHash`, the canonical cross-run fingerprint

- **Repo**: `github/codeql-action` (metadata not fetched — see *Could not verify*) · **File read**: `src/fingerprints.ts` (10,805 bytes)

**[stated]** Constants: `BLOCK_SIZE = 100`, `MOD = Long.fromInt(37)`. The docstring: *"The hash method computes a rolling hash for every line in the input. The hash is computed using the first BLOCK_SIZE non-space/tab characters counted from the start of the line. For the computation of the hash all line endings (i.e. \r, \n, and \r\n) are normalized to '\n'."*

**[stated]** The per-line output value is the hexadecimal hash joined to an occurrence counter with a colon (the source comment above the map: *"A map of hashes we've seen before and how many times, so we can disambiguate identical hashes"*).

**[stated]** Anchoring: `locationUpdateCallback` uses `location.physicalLocation?.region?.startLine`, and if undefined: *"We expect the region section to be present, but it can be absent if the alert pertains to the entire file. In this case, we compute the fingerprint using the hash of the first line of the file."*

**[stated]** Collision policy: *"If the hash doesn't match the existing fingerprint then output a warning and don't overwrite it."* — a producer-supplied fingerprint always wins over the computed one.

**[stated]** `resolveUriToFile` refuses to fingerprint locations outside the source root, non-file schemes, directories, and non-existent files.

**[inference]** The hashed material is **file line content only** — no path, no rule id, no message, no line number. Consequently this fingerprint is stable when a finding moves within a file or to another file (as long as the line text is unchanged) and unstable when the line's text changes. That is a deliberate trade: it optimises for "the alert follows the code", not for "the alert follows the location".

**[opinion]** This is the strongest published counter-example to a path-inclusive fingerprint. A path+category+code hash and a content-only line hash disagree precisely in the "code moved between files" case; the dove contract currently cannot express that transition, and SARIF's `baselineState: "updated"` is the vocabulary for it.

---

### 3. semgrep/semgrep — five coexisting identity hashes, each answering a different question

- **Repo**: `semgrep/semgrep` · 16,760 stars · last push `2026-09-25` · licence `LGPL-2.1` · default branch `develop`
- **Files read**: `cli/src/semgrep/rule_match.py` (27,583 bytes), `cli/src/semgrep/formatter/sarif.py`, `cli/src/semgrep/formatter/json.py`, `src/engine/Match_search_mode.ml` (grepped for `fingerprint` — absent), `src/core/Core_match.ml` (same)

**[stated]** `RuleMatch` declares six derived identity attributes: `syntactic_id`, `match_based_id`, `code_hash`, `pattern_hash`, `start_line_hash`, `end_line_hash`, plus the keys `ci_unique_key` and `match_based_key`.

**[stated]** `ci_unique_key` = `(self.rule_id, str(path), self.syntactic_context, self.index)`, and:

```python
@syntactic_id.default
def get_syntactic_id(self) -> str:
    """
    A 32-character hash representation of ci_unique_key.

    This value is sent to semgrep.dev and used to track findings across branches
    """
    # Upon reviewing an old decision,
    # there's no good reason for us to use MurmurHash3 here,
    # but we need to keep consistent hashes so we cannot change this easily
    hash_int = hash128(str(self.ci_unique_key))
    hash_bytes = int.to_bytes(hash_int, byteorder="big", length=16, signed=False)
    return str(binascii.hexlify(hash_bytes), "ascii")
```

**[stated]** `match_based_id` hashes the *rule formula with metavariables substituted*, and carries the design rationale in a comment above it: *"This will supercede syntactic id, as currently that will change even if things formatting + line numbers change. By using the formula + metavariable content itself, we remain sensitive to modifications to a match, but we no longer count formatting + line number changs + other things as new findings."* Implementation: `blake2b(str(match_based_key))` normally, `sha256` when `self.fips_mode`, then the digest joined to `self.match_based_index` with an underscore.

**[stated]** `code_hash` — and this is the single most useful paragraph I read in the whole survey:

```python
@code_hash.default
def get_code_hash(self) -> str:
    """
    A 32-character hash representation of syntactic_context.

    We started collecting this in addition to syntactic_id because the syntactic_id changes
    whenever the file path or rule name or index changes, but all of those can be sent in
    plaintext, so it does not make sense to include them inside a hash.

    By sending the hash of ONLY the code contents, we can determine whether a finding
    has moved files (path changed), or moved down a file (index changed) and handle that
    logic in the app. This also gives us more flexibility for changing the definition of
    a unique finding in the future, since we can analyze things like code, file, index all
    independently of one another.
    """
    return hashlib.sha256(self.syntactic_context.encode()).hexdigest()
```

**[stated]** `pattern_hash` = `sha256(match_formula_str with metavars substituted)`; `start_line_hash`/`end_line_hash` = `sha256` of the first/last line. There is also `get_path_changed_ci_unique_key(rename_dict)` which rewrites the path through a rename map so a file rename does not create a new identity.

**[stated]** SARIF output is **not** produced in Python: `cli/src/semgrep/formatter/sarif.py` builds an `out.SarifFormat(...)` and calls `semgrep.rpc_call.sarif_format(...)`, returning `"<ERROR: no SARIF output>"` if the RPC yields nothing. `cli/src/semgrep/formatter/json.py` likewise delegates to `semgrep.rpc_call.format(out.OutputFormat(out.Json()), ctx, output)` with the comment *"Filter out some fields depending on context ctx! This filtering is implemented on the OCaml side."* A grep for `fingerprint` in `src/engine/Match_search_mode.ml` and `src/core/Core_match.ml` returned nothing.

**[inference]** Semgrep's position is that there is no single correct fingerprint: the CI/app layer holds *several* decomposable hashes and decides equivalence policy itself. The rationale for splitting is stated explicitly and is about **diagnosis**, not just dedup — you can tell "moved" from "edited" from "new".

**[opinion]** The most transferable idea in this survey after the versioned key. A monolithic `sha256(path|category|existingCode)` cannot report *why* a fingerprint changed; a decomposed one can, and `baselineState`'s `updated`/new distinction is exactly the place that reason needs to surface.

---

### 4. DefectDojo/django-DefectDojo — a system of record whose dedup is configurable per parser

- **Repo**: `DefectDojo/django-DefectDojo` · 4,959 stars · last push `2026-09-25` · licence `BSD-3-Clause` · default branch `master` · Python
- **Files read**: `dojo/finding/models.py` (96,377 bytes), `dojo/finding/deduplication.py` (74,249 bytes), `dojo/finding/helper.py` (76,548 bytes), `dojo/tools/semgrep/parser.py`, `dojo/models.py`

**[stated]** The stored identity is a column: `hash_code = models.CharField(null=True, blank=True, editable=False, max_length=64, verbose_name=_("Hash Code"), help_text=_("A hash over a configurable set of fields that is used for findings deduplication."))`.

**[stated]** The digest itself (`dojo/finding/models.py`):

```python
def hash_fields(self, fields_to_hash):
    if hasattr(settings, "HASH_CODE_FIELDS_ALWAYS"):
        for field in settings.HASH_CODE_FIELDS_ALWAYS:
            if getattr(self, field):
                fields_to_hash += str(getattr(self, field))
    return hashlib.sha256(fields_to_hash.casefold().encode("utf-8").strip()).hexdigest()
```

**[stated]** `compute_hash_code()` resolves the field list from `self.test.hash_code_fields`, refuses to run if any field is not in `settings.HASHCODE_ALLOWED_FIELDS`, refuses if `self.cwe == 0 and not self.test.hash_code_allows_null_cwe`, and otherwise concatenates the named attributes (with special handling for `endpoints`, `vulnerability_ids`, `cwes`). Every refusal path falls back to `compute_hash_code_legacy()`, which is: `self.title + str(self.cwe) + str(self.line) + str(self.file_path) + self.description`.

**[stated]** Four dedup algorithms are selectable per test: `DEDUPE_ALGO_HASH_CODE`, `DEDUPE_ALGO_UNIQUE_ID_FROM_TOOL`, `DEDUPE_ALGO_UNIQUE_ID_FROM_TOOL_OR_HASH_CODE`, and legacy. `set_duplicate` writes `duplicate=True, active=False, verified=False, duplicate_finding=<existing>` and flattens transitive duplicate chains to depth 1; `DEDUPLICATION_FIELDS` on the model is an explicit allow-list of the columns loaded for dedup, with `DEDUPLICATION_DEFERRED_FIELDS` excluding large prose columns.

**[stated]** The per-parser contract is two methods. In `dojo/tools/semgrep/parser.py`, `get_dedupe_fields()` returns `["title", "cwe", "line", "file_path", "description"]` with the note *"NOTE: uses legacy dedupe: ['title', 'cwe', 'line', 'file_path', 'description']"*; and the parser reads the scanner's own fingerprint:

```python
# fingerprint detection
unique_id_from_tool = item.get("extra", {}).get("fingerprint")
# treat "requires login" as if the fingerprint is absent
if unique_id_from_tool == "requires login":
    unique_id_from_tool = None
if unique_id_from_tool:
    finding.unique_id_from_tool = unique_id_from_tool
```

**[stated]** Within a single import the parser also collapses occurrences locally: `dupe_key = finding.title + finding.file_path + str(finding.line)`, incrementing `nb_occurences`. And the model carries a scanner-supplied confidence mapped to prose: `get_scanner_confidence_text()` returns `"Certain"` for <=2, `"Firm"` for 3-5, `"Tentative"` above.

**[inference]** DefectDojo is a **consumer and system of record**, not a scanner. Its identity mechanism is the most *operationally* mature here: a persisted, queryable hash column, a per-parser field contract, a fallback chain, and a duplicate *relation* rather than a flag. But its default/legacy hash includes `description` and `title` — model prose — which is exactly the instability the dove contract exists to avoid.

**[opinion]** Worth reading as a design for the *store* (what a baseline should look like over time, how suppression and false-positive history interact) but not as a template for the *hash material*. The `HASHCODE_ALLOWED_FIELDS` allow-list is a good governance idea: it makes "what may participate in identity" an explicit, reviewable list.

---

### 5. PyCQA/bandit — a real, tested baseline whose identity is prose-bearing

- **Repo**: `PyCQA/bandit` · 8,283 stars · last push `2026-09-21` · licence `Apache-2.0` · default branch `main` · Python
- **Files read**: `bandit/core/issue.py`, `bandit/core/manager.py`, `bandit/cli/main.py`, test inventory under `tests/`

**[stated]** `Issue` carries `severity, cwe, confidence, text, ident, fname, fdata, test, test_id, lineno, col_offset, end_col_offset, linerange`. There is **no fingerprint field** — a grep for `fingerprint` in `bandit/core/issue.py` returns nothing.

**[stated]** Identity is `__eq__`, and the comment states the policy:

```python
def __eq__(self, other):
    # if the issue text, severity, confidence, and filename match, it's
    # the same issue from our perspective
    match_types = [
        "text",
        "severity",
        "cwe",
        "confidence",
        "fname",
        "test",
        "test_id",
    ]
    return all(
        getattr(self, field) == getattr(other, field)
        for field in match_types
    )
```

**[stated]** The baseline is a **file**: `--baseline` takes *"path of a baseline report to compare against"*; `cli/main.py` opens it and calls `b_mgr.populate_baseline(data)`, warning `"Could not open baseline report: %s"` on failure, and refuses unless the output format is one of `baseline_formatters`. Comparison is set difference in `manager.py`:

```python
def _compare_baseline_results(baseline, results):
    """Compare a baseline list of issues to list of results ..."""
    return [a for a in results if a not in baseline]
```

**[stated]** `_find_candidate_matches` handles the ambiguous case explicitly: *"let's say we find a new command injection issue in a file which used to have two. Bandit can't tell which of the command injection issues in the file are new, so it will show all three."*

**[stated]** It is tested: `tests/functional/test_baseline.py`, `tests/unit/cli/test_baseline.py`, `tests/unit/core/test_manager.py`, plus baseline references in `tests/unit/cli/test_main.py`, `tests/unit/formatters/test_screen.py`, `tests/unit/formatters/test_text.py`.

**[inference]** Bandit's identity is `(message text, severity, cwe, confidence, filename, test, test_id)` — **message-bearing, line-insensitive, and file-scoped**. Two issues of the same rule with the same plugin-authored message in one file are indistinguishable by design; a finding that moves down the file is still "unchanged"; a finding whose message is reworded is "new".

**[opinion]** The cleanest small example of the trap the dove contract names. Note that Bandit gets away with it because `text` comes from a plugin's static string, not a model. If a model ever wrote `text`, this identity would collapse. Also note the deliberate absence of `lineno`: Bandit optimises for "don't re-report the same class of issue in the same file", which is a *different* product goal from "diff two runs".

---

### 6. securego/gosec — SARIF output that carries no fingerprint at all

- **Repo**: `securego/gosec` · 8,953 stars · last push `2026-09-22` · licence `Apache-2.0` · default branch `master` · Go
- **Files read**: `issue/issue.go`, `report/sarif/builder.go`, `report/sarif/types.go`, `report/sarif/data.go`, `report/sarif/formatter.go`; file inventory via the git tree API (343 paths, not truncated)

**[stated]** The finding shape (`issue/issue.go`):

```go
type Issue struct {
    Severity     Score             `json:"severity"`
    Confidence   Score             `json:"confidence"`
    Cwe          *cwe.Weakness     `json:"cwe"`
    RuleID       string            `json:"rule_id"`
    What         string            `json:"details"`
    File         string            `json:"file"`
    Code         string            `json:"code"`
    Line         string            `json:"line"`
    Col          string            `json:"column"`
    NoSec        bool              `json:"nosec"`
    Suppressions []SuppressionInfo `json:"suppressions"`
    Autofix      string            `json:"autofix,omitempty"`
}
```

No fingerprint field. `SuppressionInfo{Kind, Justification}` records the kind and justification of a `#nosec` suppression.

**[stated]** `report/sarif/types.go` (a vendored copy of the SARIF 2.1.0 schema structs) defines `Fingerprints`, `PartialFingerprints`, `BaselineState`, `CorrelationGUID`, `OccurrenceCount`, `Rank`. A grep for `Fingerprint`/`BaselineState`/`CorrelationGuid` across `report/sarif/*.go` hits **only `types.go`** — never `builder.go`, `data.go`, or `formatter.go`. `builder.go` is 6,482 bytes with zero `fingerprint` occurrences.

**[inference]** gosec emits SARIF results with **no fingerprint, no `baselineState`, and no `correlationGuid`** — the schema fields exist in its type definitions but are never populated. Its JSON output is therefore not diffable across runs by identity; the only cross-run control is `#nosec` / the `Suppressions` array.

**[opinion]** An important negative result for the "wrap a scanner" plan: wrapping gosec gets you rules and a SARIF-shaped *container*, but **zero identity**. The vertical must synthesise fingerprints from `rule_id` + `file` + `code` itself. `confidence` here is a rule-author-declared constant, not a model score — useful as a static triage prior, useless as evidence.

---

### 7. aquasecurity/trivy — the same gap in the most-starred scanner surveyed

- **Repo**: `aquasecurity/trivy` · 38,072 stars · last push `2026-09-25` · licence `Apache-2.0` · Go
- **File read**: `pkg/report/sarif.go` (16,659 bytes)

**[stated]** The SARIF writer imports `github.com/owenrumney/go-sarif/v2/sarif` and defines its own rule-id namespace constants (`sarifOsPackageVulnerability`, `sarifLanguageSpecificVulnerability`, `sarifConfigFiles`, `sarifSecretFiles`, `sarifLicenseFiles`, `sarifUnknownIssue`; levels `error`/`warning`/`note`). A grep of this file for `Fingerprint`/`BaselineState`/`partialFingerprints` returns **nothing**.

**[inference]** Trivy's SARIF output likewise carries no finding identity. Trivy's cross-run controls are ignore files (`.trivyignore`) and, for the dependency case, the fact that the *vulnerability id* is a natural key.

**[opinion]** For a code-audit vertical the interesting Trivy surface is dependency/secret scanning, not SAST. Its per-finding natural key (CVE id + package + version) is *stable by construction*, which is a reminder that identity is easiest when the domain supplies one and hardest when the detector is a pattern match.

---

### 8. Bearer/bearer — fingerprint-keyed suppressions, with migration

- **Repo**: `Bearer/bearer` · 2,750 stars · last push `2026-09-21` · licence `NOASSERTION` per the GitHub API · default branch `main` · Go
- **Files read**: `pkg/report/output/sarif/sarif.go`, `pkg/report/output/security/types/types.go`, `pkg/util/ignore/ignore.go`, `pkg/commands/ignore.go`; file inventory across the repo

**[stated]** The finding type carries two fingerprints, not one:

```go
Fingerprint      string       `json:"fingerprint,omitempty" yaml:"fingerprint,omitempty"`
OldFingerprint   string       `json:"old_fingerprint,omitempty" yaml:"old_fingerprint,omitempty"`
```

**[stated]** SARIF emission maps its own fingerprint onto the standard key: `PartialFingerprints: &sarif.PartialFingerprints{ PrimaryLocationLineHash: finding.Fingerprint }`.

**[stated]** Suppression is a persisted JSON store keyed by fingerprint. `const DefaultIgnoreFilepath = "bearer.ignore"`; `GetIgnoredFingerprints` unmarshals the file into `map[string]types.IgnoredFingerprint`; entries record `Author`, `Comment`, `FalsePositive`, `IgnoredAt` (RFC3339). The CLI surface is `bearer ignore add|show|remove|migrate` — the in-code help text is `bearer ignore add <fingerprint> --author Mish --comment "investigate this"`. Settings carry both `IgnoredFingerprints map[string]ignoretypes.IgnoredFingerprint` and `StaleIgnoredFingerprintIds []string`.

**[inference]** Bearer treats a fingerprint as a **user-facing identifier**: it is typed by a human on the command line, stored in a version-controlled file, and *migrated* rather than invalidated when the derivation changes (`OldFingerprint` + `bearer ignore migrate` + a stale-ids list). It also lets a suppression be classified as a false positive, which is the point where identity and triage meet.

**[opinion]** The `OldFingerprint`/`migrate` pair is the most valuable idea in this section, and it is a real alternative to the dove contract's "change the key version and start over". Versioning the key *invalidates* an old baseline; migration *carries* it. If the vertical expects users to accumulate suppressions over months, migration is the better affordance; if it expects the baseline to be regenerated each run, versioning is simpler.

---

### 9. anthropics/claude-code-security-review — a model in the loop with a confidence contract

- **Repo**: `anthropics/claude-code-security-review` · 6,270 stars · last push `2026-02-11` · licence `MIT` · default branch `main` · Python
- **Files read**: `action.yml` (14,003 bytes), `claudecode/prompts.py` (7,079 bytes), `claudecode/findings_filter.py` (15,311 bytes), `claudecode/json_parser.py`

**[stated]** The finding schema is dictated to the model in `prompts.py`:

```json
{
  "findings": [
    {
      "file": "path/to/file.py",
      "line": 42,
      "severity": "HIGH",
      "category": "sql_injection",
      "description": "User input passed to SQL query without parameterization",
      "exploit_scenario": "Attacker could extract database contents by manipulating the 'search' parameter ...",
      "recommendation": "Replace string formatting with parameterized queries ...",
      "confidence": 0.95
    }
  ],
  "analysis_summary": { "files_reviewed": 8, "high_severity": 1, "medium_severity": 0, "low_severity": 0, "review_completed": true }
}
```

with a self-limiting scale: *"0.9-1.0: Certain exploit path identified, tested if possible ... Below 0.7: Don't report (too speculative)"*, and *"MINIMIZE FALSE POSITIVES: Only flag issues where you're >80% confident of actual exploitability"*. The prompt also fixes scope: *"This is not a general code review - focus ONLY on security implications newly added by this PR. Do not comment on existing security concerns."* and *"Your final reply must contain the JSON and nothing else."*

**[stated]** There is a second, non-model filter. `findings_filter.py` defines `HardExclusionRules` — compiled regexes over `title + " " + description`, lowercased — that drop generic DoS/resource-exhaustion wording, rate-limiting recommendations, resource-leak wording, open-redirect wording, regex-injection wording, memory-safety wording *in non-C/C++ files*, and SSRF wording *in HTML files*. It also drops any finding whose path ends in `.md`. Then a **second Claude pass** (`use_claude_filtering`) scores the survivors, tracked in `FilterStats{total_findings, hard_excluded, claude_excluded, kept_findings, exclusion_breakdown, confidence_scores, runtime_seconds}`.

**[stated]** Robustness against model output drift is handled by `json_parser.py`: it tries `json.loads` directly, then fenced code blocks (json-tagged and bare), then balanced-brace scanning anywhere in the text, then returns an error object. `action.yml` then reads the file with `jq -r '.findings | if . == null then 0 else length end'`.

**[stated]** Cross-run behaviour is **run-level, not finding-level**. `action.yml` maintains `.claudecode-marker/marker.json` with fields `timestamp, repository_id, repository, pr_number, sha, status, run_id, run_number`, cached under key `claudecode-<repository_id>-pr-<pr_number>-<sha>` with a restore-key prefix for the PR. If a marker exists, the run is skipped: *"ClaudeCode has already run on PR #<n> (found marker file), forcing disable to avoid false positives"*. `run-every-commit` overrides it, with the warning that re-running *"may lead to more false positives on PRs with many commits as the AI analyzes the same code multiple times."*

**[stated]** It is not read-only: it installs `gh`, uploads artifacts, and runs `node scripts/comment-pr-findings.js` to comment on the PR. It does not patch code.

**[inference]** This project's answer to "don't let the model invent findings" is **a confidence contract plus two filter stages plus a hard dedup at the run level**. It deliberately does *not* attempt finding identity: its dedup is "don't run twice on the same commit".

**[opinion]** The most useful thing here for the dove vertical is the *shape* of the anti-noise stack (schema-level confidence -> deterministic exclusions -> model second pass), and the sharpest warning: the hard exclusions operate on **prose regexes**. That is correct for triage and catastrophic for identity — a rewording of the description silently changes which findings survive. The dove contract's rule that the fingerprint must exclude the message is the right call precisely because this project demonstrates how much of an AI reviewer's output *is* prose.

---

### 10. Codium-ai/pr-agent — the closest analogue to the dove problem, solved explicitly

- **Repo**: `Codium-ai/pr-agent` · 13,150 stars · last push `2026-09-25` · licence `MIT` · default branch `main` · Python
- **Files read**: `pr_agent/algo/inline_comment_dedup.py`, `pr_agent/algo/review_finding_state.py`, `pr_agent/algo/comment_identity.py`, `pr_agent/algo/output_models.py` (head), `pr_agent/algo/pr_processing.py` (grepped)

**[stated]** `inline_comment_dedup.py` exists for one stated reason: *"when the agent runs more than once on the same PR/MR, it re-posts identical inline suggestions on every run, cluttering the discussion (observed in particular on GitLab)."* It computes **two** fingerprints and matches with **OR**:

```python
def _body_fingerprint(relevant_file, target_line_no, body, max_chars) -> str:
    normalised = _LEAD_RE.sub("", _strip_markers(body))
    normalised = _TAG_RE.sub("", normalised)
    normalised = _WS_RE.sub(" ", normalised).strip().lower()
    if max_chars is not None:
        normalised = normalised[:max_chars]
    key = f"{relevant_file}|{target_line_no}|{normalised}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
```

```python
def code_fingerprint(relevant_file, target_line_no, body) -> Optional[str]:
    code = extract_suggestion_code(body)
    if not code:
        return None
    # Do not lower-case: code is case-sensitive, so case-only differences
    # must produce distinct fingerprints.
    code = _WS_RE.sub(" ", code).strip()
    ...
    key = f"{relevant_file}|{target_line_no}|code|{code}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
```

and the rationale for OR is stated outright:

> *"The OR-match catches both 'same prose, different code' and 'same code, different prose' re-emissions of the same defect, which are the two ways an LLM tends to restate a finding across runs."*

**[stated]** Fingerprints are persisted **inside the posted comment**, as hidden markers — an HTML comment carrying `pr-agent-dedup: <12 hex>` and a second carrying `pr-agent-dedup-code: <12 hex>`, with a link-reference fallback (`[pr-agent-dedup: <hex>]: https://github.com/The-PR-Agent/pr-agent`) for providers that escape HTML comments. On later runs the existing comment bodies are scanned to rebuild the seen set. The module docstring says the store *"needs no external infrastructure; a different backend (database, cache) could populate the same load/seen/add interface."* It is opt-in: `config.persistent_inline_comments`, default `false`.

**[stated]** `review_finding_state.py` goes further and implements a full **baseline**:

- `STATE_SCHEMA_VERSION = 1`, `DEFAULT_MAX_RESOLVED_FINDINGS = 20`.
- Marker: an HTML comment `pr-agent-review-state:v1` followed by the JSON payload, serialized with `json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":"))` — *"Serialize state deterministically so repeated updates are diffable"* — and `-->` escaped to `--\u003e` so a finding that quotes a diff cannot close the comment.
- Finding identity: `finding_id = key_issue_fingerprint(path, _WHITESPACE_RE.sub(" ", body).lower())` -> `sha256(path + "|" + body)[:12]`, with the comment *"The fingerprint ignores whitespace so re-wrapped prose stays the same finding, but the body is what the resolved section renders, so it keeps the line breaks the reviewer used."*
- State shape: `{schema_version, findings: [{finding_id, state: "ACTIVE"|"RESOLVED", body, path, line_start?, line_end?, first_seen, last_seen, reopened_at?, reopened_count, last_seen_head_sha?, resolved_at?, resolved_head_sha?, resolution_run_id?}], last_run: {complete, kind: "full"|"partial", head_sha, excluded_files, run_id}}`.
- `parse_review_state` treats malformed state as **unsafe** (returns `valid=False`), requires exactly one marker, validates `schema_version`, requires unique non-empty `finding_id`s, and requires each finding to have `path` and `body`.
- Resolution is conservative by construction: `resolution_allowed` requires `allow_resolution` **and** a known, non-empty previous `head_sha` **and** a known, non-empty current `head_sha` **and** `previous_head_sha != head_sha`. The docstring: *"The caller must only pass allow_resolution=True for a successful, complete full review, and the previous and current reviewed HEADs must both be known and different."* A returning finding gets `state="ACTIVE"`, `reopened_at`, `reopened_count += 1`.
- `append_review_state(review_body, state, max_chars)` reserves room for the marker and truncates **only the human text** — *"The optional limit is reserved for the complete hidden marker."*

**[stated]** `comment_identity.py` solves the sibling problem — finding *its own* previous comment — with hidden identity markers (`pr-agent:review:full`, `pr-agent:review:incremental`, `pr-agent:improve:summary`, ...), matched *"only as exact lines near the top"* within `_REVIEW_IDENTITY_HEADER_LINES = 5`, with legacy visible-header prefixes retained for migration.

**[stated]** Output size: `pr_processing.py` clips the diff against a token budget (`OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD = 1500`, `OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD = 1000`, helpers `clip_tokens`, `AttemptTokenBudget`), and when files are dropped it says so in the prompt: *"Additional modified files (insufficient token budget to process):"* and *"Additional added files (insufficient token budget to process):"*.

**[inference]** PR-Agent is the only project here that has shipped *both* halves of the dove problem for LLM-produced findings: (a) a cross-run dedup fingerprint, and (b) a persisted baseline with state transitions, reopening counters, and a conservative "only resolve on a complete run against a different HEAD" rule. It stores both in the comment body, so the "database" is the review thread.

**[opinion]** Two things to take and one to argue with. Take: the deterministic JSON serialization with `sort_keys`/`separators` (so a re-run's marker is byte-diffable), and the `append_review_state(..., max_chars)` discipline of reserving marker space before truncating prose — both map directly onto a SARIF `partialFingerprints` + baseline design. Argue with: the finding identity is `sha256(path|body)` — **prose-bearing**. The OR-of-two-fingerprints trick is a genuine mitigation, but it means the identity's stability depends on the model's phrasing in at least one branch. The dove contract's path+category+code fingerprint is strictly more stable; PR-Agent's OR design exists because it has no `category` and its "code" is a *suggestion* rather than the matched source.

---

### 11. protectai/vulnhuntr — a discovery agent with no finding artifact at all

- **Repo**: `protectai/vulnhuntr` · 2,776 stars · last push `2025-02-06` (about 19 months stale at survey date) · licence `AGPL-3.0` · Python
- **Files read**: `vulnhuntr/__main__.py` (21,252 bytes); inventory of the whole repo (11 files under `vulnhuntr/`, `prompts.py` 16,986 bytes, `LLMs.py`, `symbol_finder.py`)

**[stated]** The model's response contract is a Pydantic model:

```python
class Response(BaseModel):
    scratchpad: str = Field(description="Your step-by-step analysis process. Output in plaintext with no line breaks.")
    analysis: str = Field(description="Your final analysis. Output in plaintext with no line breaks.")
    poc: str = Field(description="Proof-of-concept exploit, if applicable.")
    confidence_score: int = Field(description="0-10, where 0 is no confidence and 10 is absolute certainty because you have the entire user input to server output code path.")
    vulnerability_types: List[VulnType] = Field(description="The types of identified vulnerabilities")
    context_code: List[ContextCode] = Field(description="List of context code items requested for analysis, one function or class name per item. No standard library or third-party package code.")
```

with `VulnType` in `{LFI, RCE, SSRF, AFO, SQLI, XSS, IDOR}`.

**[stated]** The control flow is two-stage with a bounded context-fetching loop. Stage 1: send the file, get a `Response`. Only if `confidence_score > 0 and len(vulnerability_types)` does stage 2 run — once per reported vulnerability type, for `for i in range(7)` iterations, feeding back `previous_analysis` and the *actual source* of the functions/classes the model asked for, resolved by `SymbolExtractor.extract(name, code_line, files)`. The loop breaks when no new context is requested, with an explicit one-retry allowance (`if same_context: break`).

**[stated]** There is **no structured finding output**. The two `json.dump` calls in the module serialize `Response.model_json_schema()` *into the prompt*; results are written to stdout via `print_readable` and to a structlog JSON log (`vulnhuntr.log`). A grep for `fingerprint`/`hash` in `__main__.py` returns zero; a grep for `findings` returns zero.

**[inference]** vulnhuntr is a *scanner-shaped prompt loop*, not a findings producer. It has no fingerprint, no baseline, no dedup, and no machine-readable output — a re-run produces a fresh pile of prose, which is precisely the failure mode the dove PRD names. Its only anti-false-positive control is the model's own `confidence_score` plus the discipline of requiring the model to fetch real source before concluding.

**[opinion]** Useful as a **negative** datapoint and as a pattern for context chaining (the 7-iteration "request named symbols, get real source back" loop is a clean, bounded way to let a model pull context without letting it invent it). Its AGPL-3.0 licence and 19-month staleness rule it out as something to wrap.

---

### 12. google/oss-fuzz-gen — validation by execution, which is the strongest anti-invention control found

- **Repo**: `google/oss-fuzz-gen` · 1,438 stars · last push `2026-03-17` · licence `Apache-2.0` · Python
- **Files read**: `results.py`, `experiment/evaluator.py`; inventory of `agent/`, `experiment/`, `llm_toolkit/`, `report/`, `data_prep/`

**[stated]** The result of a run is a crash, and its shape is explicit:

```python
class RunResult(BuildResult):
  """The fuzzing run-time result info."""
  crashes: bool
  run_error: str
  crash_func: dict
  run_log: str
  coverage_summary: dict
  coverage: float
  line_coverage_diff: float
  reproducer_path: str
  artifact_path: str
  sanitizer: str
  textcov_diff: Optional[textcov.Textcov]
  log_path: str
  corpus_path: str
  coverage_report_path: str
  cov_pcs: int
  total_pcs: int
  err_type: str
  crash_sypmtom: str
  crash_stacks: Optional[list[list[str]]]
```

**[stated]** Even *build* success is a conjunction, not a model claim: `BuildResult.success` is `self.compiles and self.binary_exists and self.is_function_referenced`.

**[stated]** False positives are defined by coverage, not by prose — `evaluator.Result.is_semantic_error` carries the comment *"Grammatically correct but has false positive or no cov increase at all."* alongside `semantic_error`, `triage`, and `line_coverage_diff`. The pipeline includes `llm_toolkit/crash_triager.py` and `experiment/fuzz_target_error.py` (`SemanticCheckResult`).

**[inference]** The invariant is: a model may *propose* a fuzz target, but a finding exists only if the target builds, a binary is produced, the fuzzer runs, and a crash with a reproducer path is observed. Nothing the model writes is reported as a finding.

**[opinion]** This is the gold standard for "keep a model in the loop without letting it invent findings", and it is worth naming as the third option in the dove PRD's open question 2 — *not* "SAST engine or LLM pass" but "LLM proposes, a deterministic engine adjudicates". It is also the only project here whose output is inherently reproducible: a reproducer file is a finding's proof, and identity is a property of the crash, not of the report. The cost is that it only works where an oracle (a fuzzer, a test, a PoC) exists.

---

### 13. trailofbits/buttercup — an LLM CRS that grounds every SARIF finding in a real crash

- **Repo**: `trailofbits/buttercup` · 1,708 stars · last push `2026-09-25` · licence `AGPL-3.0` · default branch `main` · Python
- **Files read**: `orchestrator/src/buttercup/orchestrator/scheduler/sarif_matcher.py`, `common/src/buttercup/common/sarif_store.py`; inventory across `orchestrator/`, `common/`, `fuzzing/`

**[stated]** Findings arrive as SARIF broadcasts. `sarif_matcher.py` exists to decide whether a broadcast SARIF result corresponds to a crash the fuzzer actually observed (`TracedCrash`). It extracts `SarifInfo{file, lines: (start_line, end_line), function, cwe}` from each result — CWE is scraped from `ruleId` or from `message.text` by string search for `"CWE-"` — then matches against parsed crash stack frames:

```python
# Either match lines and filename (or full path) or function name
location_match = matches_lines and (matches_filename or matches_full_path)
if location_match or matches_function or stripped_matches_function:
    return SarifMatch(...)
```

with `stripped_function_match` handling an `OSS_FUZZ_` prefix on the crash-side function name.

**[stated]** Storage is `SARIFStore` over Redis: key `"sarif:" + task_id.lower()`, a Redis list of JSON-serialized `SARIFBroadcastDetail{metadata, sarif, sarif_id, task_id}`. A grep for `fingerprint`/`dedup`/`hash` in `common/src/buttercup/common/sarif_utility.py` returns nothing.

**[inference]** Buttercup's identity is **`task_id`** (a competition task), not a content fingerprint, and its anti-invention control is *corroboration*: an LLM-reported SARIF result is only interesting once it can be matched, by location or function name, to a crash that a fuzzer produced.

**[opinion]** The matching logic is deliberately loose (basename OR full path, inclusive line range, OR function name) and that looseness is the honest part: it is a *correlation heuristic between two independent detectors*, not an identity mechanism. For the dove vertical the transferable idea is the **two-source rule** — a model-sourced finding should not enter the evidence plane until a deterministic source corroborates it at the same location.

---

### 14. reviewdog/reviewdog — diff-scoped reporting, the de-facto noise control

- **Repo**: `reviewdog/reviewdog` · 9,623 stars · last push `2026-09-25` · licence `MIT` · default branch `master` · Go
- **Files read**: `filter/diff_filter.go`, `filter/diff_filter_test.go` (inventory); `filter/filter.go` (inventory)

**[stated]** `DiffFilter` indexes a parsed diff into `difflines map[string]map[int]*diff.Line` and `difffiles map[string]*diff.FileDiff`, then answers `ShouldReport(path, lnum)` under a mode:

```go
const (
    ModeDefault Mode = iota
    ModeAdded          // filtering by added/changed diff lines
    ModeDiffContext    // changed lines +-N lines
    ModeFile           // filtering by changed files
    ModeNoFilter       // doesn't filter out any results
)
```

with `isSignificantLine` returning `line.Type == diff.LineAdded` for `ModeAdded`/`ModeDefault`.

**[stated]** There is no fingerprint, no baseline, and no dedup across runs anywhere in the filter package. It is a *reporter*: it consumes a diff plus a scanner's output and decides which findings are in scope for the change.

**[inference]** reviewdog's answer to "the second run is a wall of findings" is not identity at all — it is **scope reduction**: only report findings on lines the change touched. That is a different, cheaper, and very widely deployed control.

**[opinion]** This is the control a code-audit vertical should consider *in addition to* fingerprints, not instead of. It is the practical reason most CI security noise is tolerable, and it maps cleanly onto the dove framework's existing gate: "the diff is the authority boundary for what may be reported".

---

## What is reusable for this vertical

> This whole section is **[opinion]** with **[stated]** support where cited above.

1. **Do not wrap a scanner expecting identity to come with it.** gosec's `builder.go` and Trivy's `pkg/report/sarif.go` populate no fingerprint and no `baselineState`; Bandit has no fingerprint field at all. Wrapping any of them buys rules and a SARIF-shaped container, and leaves identity entirely to the vertical. That is a point in favour of the PRD's "analysis quality is not the differentiator" position, but it means the identity work is 100% ours.

2. **Decompose the fingerprint rather than monolithic-hashing it.** Semgrep's `code_hash` docstring is the argument: *"By sending the hash of ONLY the code contents, we can determine whether a finding has moved files (path changed), or moved down a file (index changed) and handle that logic in the app."* The current `sha256(path|category|existingCode)` cannot distinguish "moved" from "edited". Consider emitting `doveFinding/v1` (the composite, for compatibility) **plus** a small set of named components — e.g. `doveCode/v1` = `sha256(existingCode)`, `doveRule/v1` = `category` — as extra `partialFingerprints` entries. SARIF permits multiple keys, and `ResultBaselineEquals` already ignores keys and compares values.

3. **Use `baselineState`'s full vocabulary.** The reference fixtures use `new`/`unchanged`/`updated`/`absent`. The current module emits only `new`/`unchanged`. `updated` is exactly the transition for "same code, different location" or "same location, different code"; without it a moved finding reads as one `new` plus one silently vanished.

4. **Steal the baseline *storage* shape from `review_finding_state.py`, not its hash.** PR-Agent's state object — `schema_version`, per-finding `state`/`first_seen`/`last_seen`/`reopened_count`/`resolved_at`, and a `last_run{complete, kind, head_sha, run_id, excluded_files}` — is a better model than a bare `Set<string>` of fingerprints, because it can say *why* a finding disappeared (the run was partial, or a path was excluded) instead of implying it was fixed. The conservative resolution rule (only resolve on a complete run against a different known HEAD) is directly portable.

5. **Versioning vs. migration is a real fork in the road.** `doveFinding/v1` invalidates an old baseline when the derivation changes; Bearer's `OldFingerprint` + `bearer ignore migrate` + `StaleIgnoredFingerprintIds` *carries* it. The SARIF SDK's own matcher still has `TODO: Handle versioning of partial fingerprints`, so dove is already ahead of the reference implementation — but "ahead" here means "has an opinion", and the opinion costs users their accumulated state unless a migration path exists.

6. **Take the SARIF SDK's split of responsibilities seriously — and then argue with it.** `AI2011` says a *producer* should not persist `partialFingerprints`; the *consumer* (Multitool / code scanning) computes them. Dove is a producer that also owns its baseline, so it must violate the letter of the rule; the compliant variant is to emit fingerprints under the recognised keys (`primaryLocationLineHash`, `contextRegionHash/v1`) and let the existing tooling do the matching. Note the SDK's escape hatch: a GitHub-hosted run *may* persist the single rolling-hash `primaryLocationLineHash` because *"GitHub's raw code-scanning SARIF upload API does not backfill partialFingerprints"*.

7. **The cheapest large noise reduction is scope, not identity.** reviewdog's `ModeAdded` (only report on added lines) and claude-code-security-review's *"focus ONLY on security implications newly added by this PR. Do not comment on existing security concerns"* are the same insight from two directions. For a whole-repository audit this is unavailable, which is the strongest argument that the vertical's identity contract has to carry the whole burden.

8. **Model-in-the-loop pattern to copy: propose, then adjudicate.** Three variants observed, in increasing strength: (a) schema-level confidence with a floor and a deterministic pre-filter (claude-code-security-review: `confidence` + "below 0.7 don't report" + regex hard exclusions + a second model pass); (b) bounded context chaining so the model must fetch real source before concluding (vulnhuntr: up to 7 iterations, `SymbolExtractor.extract`); (c) execution as the oracle (oss-fuzz-gen: `compiles and binary_exists and is_function_referenced`, then `crashes` + `reproducer_path`; buttercup: match the model's SARIF against a fuzzer-traced crash stack). If the vertical ships an LLM pass, (a) is the minimum and (b) is the reasonable target.

9. **Wrap vs. reimplement, ranked.**
   - **Worth wrapping**: Semgrep/Opengrep (rules + SARIF + a JSON output that already carries fingerprints, LGPL-2.1); Bandit (Python, Apache-2.0, tiny, baseline already implemented and tested — and its `Issue` shape is nearly a dove `Finding`); `microsoft/sarif-sdk`'s `Baseline` + `Multitool --baseline` for the matching algorithm rather than as a runtime dependency; `github/codeql-action`'s `fingerprints.ts` as the *specification* for a content-only line hash.
   - **Worth wrapping for the store, not the hash**: DefectDojo (BSD-3-Clause) as a reference design for persisted identity, duplicate relations, and suppression lifecycle — not as an embedded component.
   - **Worth reading, not wrapping**: pr-agent's `review_finding_state.py` (MIT — the code is liftable, but the identity is prose-based); claude-code-security-review's filter stack (MIT).
   - **Do not wrap**: vulnhuntr (AGPL-3.0, stale, no artifact), buttercup (AGPL-3.0, competition-specific), Trivy for SAST (no identity; its strength is dependencies).
   - **Caveat on licences**: Bearer's GitHub-reported licence is `NOASSERTION`; semgrep and opengrep are LGPL-2.1 (dynamic linking / process invocation is the safe shape); buttercup and vulnhuntr are AGPL-3.0.

---

## Could not verify

These are things I looked for and did not find, or looked at and could not read. **I make no claim about any of them.**

1. **The mapping from Semgrep's Python identity hashes to the JSON key `extra.fingerprint`.** I read the definitions of `syntactic_id`/`match_based_id`/`code_hash` in `cli/src/semgrep/rule_match.py` and I read DefectDojo's Semgrep parser reading `item["extra"]["fingerprint"]`, but the JSON formatter delegates to `semgrep.rpc_call.format(out.OutputFormat(out.Json()), ...)` and the comment says *"This filtering is implemented on the OCaml side."* I did not read the OCaml side, so I cannot say which of the six hashes is published as `extra.fingerprint`.
2. **opengrep/opengrep.** Every path I probed 404'd (`cli/src/semgrep/rule_match.py`, `src/osemgrep/reporting/Sarif.ml`, `libs/ojsonnet/src/out.ml`) and both tree pages I scraped rendered no file list. I read no opengrep source and make **no** claim about whether it inherits, changes, or drops Semgrep's fingerprinting.
3. **github/codeql (the engine repository).** I read `github/codeql-action`, which is the CLI/uploader side, not the engine. The CodeQL query engine is not open source. I also did not fetch `api.github.com` metadata for `github/codeql-action` (only for `github/codeql`, which is MIT / 10,126 stars / last push 2026-09-25), so I am **not** asserting codeql-action's stars, last commit, or licence.
4. **Trivy beyond `pkg/report/sarif.go`.** I read that one file and grepped it; I did not search the rest of the repository, so my claim is scoped to "this writer sets no fingerprint fields", not "Trivy never fingerprints anything".
5. **vulnhuntr beyond `__main__.py`.** I did not read `prompts.py`, `LLMs.py`, or `symbol_finder.py` in full, so I cannot describe its prompt-level false-positive instructions.
6. **oss-fuzz-gen's benchmark numbers.** I read the result dataclasses and the evaluator's `Result` shape. I did **not** execute the harness or read the `benchmark/` fixtures, so I have no reproducible measurement to cite — only the claim that the harness validates by compiling and fuzzing.
7. **Team-Atlanta/aixcc-afc-atlantis.** Metadata was retrieved (644 stars, last push 2025-11-25, `NOASSERTION`), but the tarball download timed out twice and I read none of its source. It is excluded from Findings.
8. **semgrep/semgrep-agent.** `api.github.com/repos/semgrep/semgrep-agent` returned **HTTP 404** on the survey date — the repository has been removed or renamed. I did not locate its successor.
9. **Any claim about a project's behaviour under a re-run that I did not read tests for.** The only projects where I confirmed *tests* of the identity mechanism are `microsoft/sarif-sdk` (unit + functional + end-to-end baselining projects) and `PyCQA/bandit` (`tests/functional/test_baseline.py`, `tests/unit/cli/test_baseline.py`, `tests/unit/core/test_manager.py`). For Bearer, pr-agent, DefectDojo, claude-code-security-review and buttercup I read implementations and in some cases confirmed test *files exist*, but I did not read those tests.

---

## Caveats / Not Found

- **The framework's fingerprint and the field's best practice disagree in one specific way.** The dove contract hashes `path|category|existingCode`. Semgrep, the SARIF SDK and codeql-action all keep the *code* hash free of the path so that "moved" is observable. This is not a defect in the contract; it is a limitation that only shows up on the second run, which is the one case the contract exists for. **[opinion]**
- **A producer that persists `partialFingerprints` is doing something the SARIF SDK explicitly warns against** (`AI2011.DoNotPersistPartialFingerprints`). Dove should know it is violating that rule on purpose and be able to say why (it owns the baseline and cannot rely on a backfilling consumer). **[opinion]**
- **The reference SDK has not solved fingerprint versioning** (`PartialFingerprintResultMatcher`: `TODO: Handle versioning of partial fingerprints`). Dove's `doveFinding/v1` is therefore not "matching the ecosystem" — it is ahead of it, which means no downstream tool will understand a v1-to-v2 transition automatically. **[inference]**
- **Three of the surveyed identity mechanisms hash prose, and all three are widely deployed.** Bandit's `__eq__` includes `text`; DefectDojo's legacy hash includes `title` and `description`; pr-agent's `finding_id` is `sha256(path|body)`. In each case the prose is either authored by a rule plugin (stable) or mitigated by a second, code-based fingerprint. The dove rule is still the right one for LLM-authored findings; it is worth knowing it is stricter than the field, not the norm. **[inference]**
- **A quirk worth noting, not exploiting**: DefectDojo's `hash_fields` calls `.strip()` on the *encoded bytes* (`fields_to_hash.casefold().encode("utf-8").strip()`) rather than on the string, so only ASCII whitespace bytes at the two ends of the encoded buffer are removed. It also `casefold()`s, making the hash case-insensitive. Any reimplementation that claims to "match DefectDojo" must reproduce both. **[stated]** + **[inference]**
- **Health, as of 2026-09-25** (stars / last push / licence / archived, from `api.github.com/repos/...`): `aquasecurity/trivy` 38,072 / 2026-09-25 / Apache-2.0 / no; `semgrep/semgrep` 16,760 / 2026-09-25 / LGPL-2.1 / no; `Codium-ai/pr-agent` 13,150 / 2026-09-25 / MIT / no; `github/codeql` 10,126 / 2026-09-25 / MIT / no; `reviewdog/reviewdog` 9,623 / 2026-09-25 / MIT / no; `securego/gosec` 8,953 / 2026-09-22 / Apache-2.0 / no; `PyCQA/bandit` 8,283 / 2026-09-21 / Apache-2.0 / no; `anthropics/claude-code-security-review` 6,270 / 2026-02-11 / MIT / no; `DefectDojo/django-DefectDojo` 4,959 / 2026-09-25 / BSD-3-Clause / no; `opengrep/opengrep` 3,111 / 2026-09-25 / LGPL-2.1 / no; `protectai/vulnhuntr` 2,776 / 2025-02-06 / AGPL-3.0 / no; `Bearer/bearer` 2,750 / 2026-09-21 / NOASSERTION / no; `trailofbits/buttercup` 1,708 / 2026-09-25 / AGPL-3.0 / no; `google/oss-fuzz-gen` 1,438 / 2026-03-17 / Apache-2.0 / no; `microsoft/sarif-sdk` 226 / 2026-09-24 / NOASSERTION (MIT per headers) / no; `Team-Atlanta/aixcc-afc-atlantis` 644 / 2025-11-25 / NOASSERTION / no. `semgrep/semgrep-agent` 404s. **[stated]**
- **Maintenance signal worth weighing**: `vulnhuntr` last pushed 2025-02-06 and `claude-code-security-review` last pushed 2026-02-11, against a survey date of 2026-09-25 — roughly 19 and 7 months of silence respectively. Everything else was pushed within four days of the survey. **[stated]**
- **Nothing was found** for two things I looked for specifically: (a) an open-source code-audit tool that persists a *versioned, migratable* fingerprint-keyed baseline in a file with the discipline of Bearer's `bearer ignore migrate` **and** a SARIF `baselineState` diff — the closest two are pr-agent (comment-embedded state, prose identity) and the SARIF SDK (SARIF baseline, no migration story); (b) an open-source AI reviewer that derives its finding identity from *matched source code* rather than prose. Semgrep does it for pattern matches; no LLM reviewer in this survey does. **[inference]**
- **Not surveyed at all, and deliberately**: closed-source AI reviewers (CodeRabbit, Qodo SaaS, ZeroPath, XBOW) — unreadable source; the AIxCC CRSs other than buttercup and (attempted) atlantis; `github/codeql`'s query libraries; and `semgrep/semgrep`'s OCaml engine beyond the two files I grepped.
