# Research: Official contracts of embeddable static-analysis engines (Semgrep, CodeQL, Opengrep, Bandit, gosec, ESLint, Infer)

- **Query**: rule format, machine-readable output (SARIF or not), finding identity/fingerprints,
  determinism, embedding licence, programmatic API, cost of a scan, and diff-only support — for each
  engine, from first-party sources only.
- **Scope**: Semgrep CE + Semgrep AppSec Platform; GitHub CodeQL CLI; Opengrep; Bandit; gosec;
  ESLint + a security config; Infer (as the explicit incremental/diff-only exemplar). First-party docs
  and first-party source only. No third-party blogs, no forums, no post-mortems were needed or used.
- **Date**: 2026-09-26.
- **Method**: `docs.semgrep.dev` serves Markdown at `<url>.md`; `docs.github.com` serves article
  Markdown at `https://docs.github.com/api/article/body?pathname=<path>`; repo files were read at a
  named ref and are cited with the exact path. Repository metadata came from `api.github.com`, which
  rate-limited partway through (unauthenticated), so a few repos have licence and file content verified
  but not stars/last-commit. Where a claim comes from source rather than docs, the file and ref are named.

---

## Findings

### 1. Semgrep (semgrep.dev)

**The licence is split in two, and the split is the decision-relevant fact.**

(a) Source states — `https://docs.semgrep.dev/licensing.md`:
- "The Semgrep CE engine is an open source project licensed under LGPL 2.1".
- "All rules, which includes both Community and Pro rules, listed in the semgrep-rules repository are
  licensed under Semgrep Rules License v.1.0. They are available only for internal business use.
  Vendors cannot use Semgrep-maintained rules in competing products or SaaS offerings. Individuals,
  security consultants, and companies are welcome to use the rules internally."
- FAQ (`https://docs.semgrep.dev/faq.md`): "If your service delivers code scanning, meaning a service
  that includes static application security testing (SAST) ... and you want to charge for scanning that
  includes rules in the semgrep-rules repository, **you must purchase a license**."

Repo metadata (`https://api.github.com/repos/semgrep/semgrep`): `semgrep/semgrep`, 16,760 stars,
SPDX `LGPL-2.1`, default branch `develop`, last push 2026-09-25T00:03:12Z. Rules repo
`semgrep/semgrep-rules`: 1,255 stars, SPDX `NOASSERTION` (custom licence), last push 2026-09-23.

**Rule format** — `https://docs.semgrep.dev/writing-rules/rule-syntax.md`: a top-level `rules:` list.
Required per rule: `id`, `message`, `severity` (`LOW|MEDIUM|HIGH|CRITICAL`; legacy `ERROR`,
`WARNING`, `INFO` "match HIGH, MEDIUM, and LOW"), `languages`, and **exactly one** of `pattern`,
`patterns`, `pattern-either`, `pattern-regex`.

**Output format: SARIF is native, not converted.** `https://docs.semgrep.dev/cli-reference.md`:
- `--sarif` — "Output results in SARIF format."
- `--sarif-output=VAL` — "Write a copy of the SARIF output to a file or post to URL."
- `--json` / `--json-output=VAL` likewise.

**Finding identity — the important one.** `https://docs.semgrep.dev/semgrep-ci/findings-ci.md` defines a
Semgrep finding in CI as a 4-tuple:

```text
(rule ID, file path, syntactic context, index)
```

where "`index`: An index into identical findings within a file. This is used to disambiguate findings if
the same `syntactic context` occurs multiple times in the same file." **The message is not part of the
identity.** This is the same rule the code-audit mode states, arrived at independently by the vendor.

**But the engine does not hand that identity to an unauthenticated embedder.** Read from source,
`src/osemgrep/reporting/Sarif_output.ml` in `semgrep/semgrep` @ `develop`
(blob sha `d71973e92151100c997ec33ab4da6130a48d20fa`):

```ocaml
let fingerprints =
  if ctx.is_logged_in then
    [ ("matchBasedId/v1", cli_match.extra.fingerprint) ]
  else [ ("matchBasedId/v1", Gated_data.msg) ]
```

and `src/osemgrep/reporting/Gated_data.ml` is, in full: `let msg = "requires login"`.

So in Semgrep CE every SARIF result carries `fingerprints["matchBasedId/v1"] = "requires login"` — a
constant. The vendor's own field table is consistent but blunter
(`https://docs.semgrep.dev/semgrep-appsec-platform/json-and-sarif.md`): SARIF
`results.fingerprints` is "❌ Semgrep CE / ✅ Semgrep AppSec Platform"; JSON `extra.fingerprint`
likewise.

(b) Inference: an embedder that shells out to Semgrep CE and consumes `matchBasedId/v1` gets one
identical fingerprint for every finding. Baseline/diff logic must be computed by the embedder, not read
from the tool — which is exactly the seam `src/core/evidence-sarif.ts` already occupies.

**Determinism**: I found no first-party statement promising identical output for identical input. The
only determinism-adjacent text is the finding-identity definition above. Not documented ≠
nondeterministic, but nothing is promised.

**Embedding / programmatic API**: none documented. The docs describe CLI subcommands (`semgrep scan`,
`semgrep ci`) and an LSP server (`semgrep lsp`). There is no documented Python or RPC embedding API on
docs.semgrep.dev. Inference: the supported integration surface is the CLI.

**Diff-only: yes.** `--baseline-commit=VAL` (also `SEMGREP_BASELINE_COMMIT`): "Only show results that
are not found in this commit hash. Aborts run if not currently in a git directory, there are unstaged
changes, or given baseline hash doesn't exist." `semgrep ci` is documented as "Run Semgrep on a git diff
(for use in CI)".

**Cost of a scan**: no runtime/memory/index-size figures published in the pages I read.

---

### 2. GitHub CodeQL

**Licence is the hard blocker for embedding.** Source: `github/codeql-cli-binaries` `LICENSE.md` —
the "GitHub CodeQL Terms and Conditions". Repo metadata: 1,019 stars, SPDX `NOASSERTION`, last push
2026-09-22T18:05:07Z.

What the Terms permit:
- Without a paid licence: "Use the Software to perform academic research"; "Use the Software to
  demonstrate the Software"; "Test CodeQL queries that are released under an OSI-approved License".
- "only with an Open Source Codebase": "Perform analysis on the Open Source Codebase"; "If the Open
  Source Codebase is hosted and maintained on GitHub.com, generate CodeQL databases for or during
  automated analysis, CI, or CD."

What they forbid:
- "To otherwise or in any other context generate any CodeQL database for or during automated analysis,
  CI or CD, whether as part of normal engineering processes or another context."
- "To otherwise or in any other context use the Software in connection with any codebase that is not an
  Open Source Codebase (e.g., code in a private repo in GitHub)."
- "you will not ... share, publish, distribute or lend the Software, **provide or make available the
  Software as a hosted solution (whether on a standalone basis or combined, incorporated or integrated
  with other software or services) for others to use**, or transfer the Software or these Terms to any
  third party."
- "if your use of the Software is under a paid customer license for GitHub Advanced Security, the
  restrictions with respect to automated analysis, CI, and CD and use in connection with non-Open Source
  Codebases do not apply."

Corroborated by `https://docs.github.com/en/code-security/codeql-cli/getting-started-with-the-codeql-cli/about-the-codeql-cli`:
"The CodeQL CLI is free to use on public repositories. The CodeQL CLI is also available in private
repositories owned by organizations that use GitHub Team or GitHub Enterprise Cloud and have a license
for GitHub Code Security."

(c) Opinion: the "incorporated or integrated with other software or services" clause is the one that
disqualifies CodeQL as a component of a code-audit product that is itself distributed or hosted. This is
not a grey area I would want to litigate.

**Output format: SARIF native.** From `.../analyzing-databases-with-the-codeql-cli` and the CLI manual
`codeql-cli-manual/database-analyze`:
```shell
codeql database analyze <database> --format=sarif-latest --sarif-category=<lang> --output=<file>.sarif <query-specifiers>...
```
- `--format` is required; values include `sarif-latest`, `sarifv2.1.0`, CSV, graph.
- Manual warning: `sarif-latest` "will produce different versions of SARIF between different CodeQL
  versions" — i.e. the format itself is not pinned across CLI versions.
- `--sarif-category` is required when you analyze more than one database for a single commit,
  "otherwise each upload overwrites the previous results."
- Other SARIF knobs: `--sarif-add-file-contents`, `--sarif-add-snippets`,
  `--sarif-include-query-help=<mode>`, `--sarif-group-rules-by-pack`, `--sarif-run-property`,
  `--no-sarif-minify`, `--no-sarif-include-alert-provenance`.

**Database creation**: `codeql database create <db> --language=<lang>[,<lang>...]
--source-root=<dir> [--command=<build>] [--db-cluster] [--threads=<num>] [--ram=<MB>]`
(`codeql-cli-manual/database-create`). Compiled languages need a build; dynamic ones do not.

**Query packs**: `.../publishing-and-using-codeql-packs`; query suites via
`.../tutorials/customize-code-scanning/create-query-suites`; `codeql resolve queries` lists bundled suites.

**Finding identity: yes, documented and implemented in the open.** SARIF support page
(`.../reference/code-scanning/sarif-files/sarif-support`):
- "The `ruleId` for a result has to be the same across analysis."
- "The filepath has to be consistent across the runs to enable a computation of a stable fingerprint."
- "Code scanning only uses the `primaryLocationLineHash`."
- "SARIF files created by the CodeQL analysis workflow, or using the CodeQL CLI include fingerprint data."

The reference implementation is public and small:
`github/codeql-action/src/fingerprints.ts` (read in full, 10,805 bytes) — a base-37 rolling hash
(`MOD = Long.fromInt(37)`), window `BLOCK_SIZE = 100`, over the first 100 **non-space/tab** characters
of each line, with `\r`, `\n`, `\r\n` normalized to `\n` and a `-1` sentinel plus `\0` padding at
EOF. Emitted as `${hashValue}:${hashCounts[hashValue]}` — an occurrence index that disambiguates
identical line hashes within one file. **The alert message is not an input to the hash.**

**Determinism**: not documented as a guarantee. The only explicit statement about variability points the
other way (`sarif-latest` differs between CodeQL versions).

**Embedding / programmatic API**: none documented. CLI-only, plus the VS Code extension and the Action.

**Cost of a scan** — `.../reference/code-scanning/codeql/hardware-resources-for-codeql`:

| Codebase size | RAM | CPU |
|---|---|---|
| Small (<100 K lines of code) | 8 GB or higher | 2 cores |
| Medium (100 K to 1 M lines of code) | 16 GB or higher | 4 or 8 cores |
| Large (>1 M lines of code) | 64 GB or higher | 8 cores |

"For all codebase sizes, we recommend using an SSD with 14 GB or more of disk space." `--threads` and
`--ram` bound the analysis.

**Diff-only: none documented in the CLI.** I searched the fetched `database create` and
`database analyze` manuals for `diff`/`incremental` — nothing. (A hosted "diff-informed queries"
feature may exist; see *Could not verify*.)

---

### 3. Opengrep — an actively maintained Semgrep fork: **yes**

Sources: `opengrep/opengrep` `README.md` and `LICENSE`; `https://www.opengrep.dev/`;
`src/osemgrep/cli_ci/Ci_CLI.ml` @ `main`.

- `LICENSE` is the **GNU Lesser General Public License v2.1** (26,526 bytes, the standard LGPL-2.1 text).
- README: "### Welcome to Opengrep, a fork of Semgrep, under the LGPL 2.1 license"; footer: "Opengrep
  is a fork of Semgrep v1.100.0, created by Semgrep Inc. Opengrep is not affiliated with or endorsed by
  Semgrep Inc."
- opengrep.dev: "We're launching Opengrep, a fork of Semgrep CE (formerly Semgrep OSS), in response to
  recent changes by Semgrep that affect its open-source nature: removing critical features of the
  scanning engine behind a commercial license ... The key features of the scanning engine removed from
  the open source engine include language support, tracking ignores, **fingerprint**, meta-variables,
  amongst others." Backed by "a consortium of AppSec organisations, including Aikido, Amplify, Endor
  Labs, Kodem, and Orca Security" (opengrep.dev also names Aikido Security, Amplify, Endor Labs, Kodem,
  Orca Security); "There is a full-time developer team building Opengrep."
- Repo metadata (stars, last commit): **not retrieved** — GitHub API rate-limited and `github.com`
  HTML fetch failed in this environment. Licence verified from the repository's own `LICENSE` file.

**Output format: SARIF native.** README documents `opengrep scan --sarif-output=sarif.json -f rules code`
and prints a complete SARIF 2.1.0 example.

**Finding identity — the decisive difference from Semgrep CE.** The README's own SARIF example contains
a real value, with `"tool.driver.name": "Opengrep OSS"` and `"semanticVersion": "1.100.0"`:

```json
"fingerprints": {
  "matchBasedId/v1": "a0ff5ed82149206a74ee7146b075c8cb9e79c4baf86ff4f8f1c21abea6ced504e3d33bb15a7e7dfa979230256603a379edee524cf6a5fd000bc0ab29043721d8_0"
}
```

(b) Inference: Opengrep restores, unauthenticated, the fingerprint Semgrep CE gates behind login. I did
not read the Opengrep code that computes it, so I cannot state its inputs beyond the fact that it is
present in the OSS build.

**Diff-only: yes, the Semgrep flag survives.** `src/osemgrep/cli_ci/Ci_CLI.ml` (opengrep/opengrep @
`main`) contains:
```ocaml
(* the raw --baseline-commit rev, handed to the metadata layer as the
   baseline_commit : string option;
     apply_includes_excludes_to_files audit_on baseline_commit common config
       baseline_commit = None;
     baseline_commit;
   $ SC.o_baseline_commit $ CLI_common.o_common $ SC.o_config
```
The exact help string lives in `Scan_CLI.ml`, which I could not fetch.

**Embedding**: engine is LGPL-2.1 end to end. The licence of the fork's **rule set** was not stated in
what I read — see *Could not verify*. Do not assume it is as permissive as the engine.

**Determinism / cost / programmatic API**: not documented in what I read.

---

### 4. Bandit (PyCQA) — Python

Sources: `bandit.readthedocs.io` (Sphinx sources under `_sources/*.rst.txt`),
`https://pypi.org/pypi/bandit/json`.

- **Version 1.9.4, Apache-2.0** (PyPI `info.license`; `project_urls["Source Code"] =
  https://github.com/PyCQA/bandit`).
- **Output format: SARIF native but not installed by default.** The man page option list documents
  `-f {csv,custom,html,json,sarif,screen,txt,xml,yaml}, --format {...}` (note: the shorter SYNOPSIS
  line omits `sarif`). The SARIF formatter needs the `sarif` extra: PyPI `requires_dist` contains
  `sarif-om>=1.0.4; extra == "sarif"` and `jschema-to-python>=1.2.3; extra == "sarif"`. The rendered
  `formatters/sarif.html` page contains **no occurrence of "fingerprint"**.
- **Finding identity**: rule id (`test_id`, e.g. `B101`) + filename + line number, with severity and
  confidence. **No stable fingerprint is documented.** The JSON report is the documented interchange.
- **Diff**: `-b BASELINE, --baseline BASELINE` — "path of a baseline report to compare against (only
  JSON-formatted files are accepted)". (b) This is a **report diff**, not a source diff: the caller must
  have produced a JSON report for the baseline revision.
- **Programmatic API**: I found no API page in the docs nav (Getting Started, Configuration,
  Integrations, Test Plugins, Blacklist Plugins, Report Formatters, CI/CD, FAQ). Bandit is a plugin
  architecture (`bandit.formatters` entry points) and `bandit.core.manager.BanditManager` is the entry
  point third parties use, but I did not find first-party documentation of it as a supported embedding
  API.
- **Determinism / cost**: not documented in what I read.

---

### 5. gosec (securego) — Go

Sources: `securego/gosec` @ `master` `README.md`, `cmd/gosec/main.go`, `report/sarif/builder.go`,
`LICENSE.txt`; `https://pkg.go.dev/github.com/securego/gosec/v2`.

- **Apache-2.0** (`LICENSE.txt`: "Apache License / Version 2.0, January 2004").
- **Output format: SARIF native.** `-fmt` help string in `cmd/gosec/main.go`: "Set output format. Valid
  options are: json, yaml, csv, junit-xml, html, sonarqube, golint, sarif or text"; `-out` sets the
  file. README: `gosec -fmt sarif -out results.sarif ./...`. Only SARIF and JSON support suppression
  tracking (`-track-suppressions`).
- **Finding identity: no fingerprint.** I read `report/sarif/builder.go` (the SARIF report constructor)
  — there is no occurrence of "fingerprint" in it. Identity is rule id (`G1xx`–`G7xx`) + file + line,
  with a CWE mapping.
- **Determinism**: not documented. (The CLI has `-sort` default `true`, "Sort issues by severity".)
- **Diff-only: none.** I read the complete flag list in `cmd/gosec/main.go`; there is no `-diff`, no
  baseline flag. Full set: `-nosec`, `-nosec-tag`, `-nosec-require-rules`,
  `-nosec-require-justification`, `-exclude-rules`, `-exclude`, `-exclude-dir`, `-exclude-generated`,
  `-include`, `-fmt`, `-out`, `-stdout`, `-verbose`, `-conf`, `-include`, `-severity`,
  `-confidence`, `-concurrency` (default `runtime.NumCPU()`), `-no-fail`, `-track-suppressions`,
  `-show-ignored`, `-tags`, `-tests`, `-quiet`, `-terse`, `-sort`, `-r`, `-log`, `-color`,
  `-version`, `-enable-audit`, `-ai-*`.
- **Programmatic API: yes, and it is a real Go package, not a CLI shell-out.** pkg.go.dev documents
  `func NewAnalyzer(conf, tests, excludeGenerated, trackSuppressions, concurrency, logger) *Analyzer`
  with methods `LoadRules`, `LoadAnalyzers`, `Process(buildTags, packagePaths)`, `Report()`,
  `Config()`, `CheckRules`. Import path `github.com/securego/gosec/v2`. (The README itself documents
  only the CLI; the API is documented on pkg.go.dev.)
- **Cost**: not documented. `-concurrency` defaults to `runtime.NumCPU()`.

---

### 6. ESLint + a security config — JavaScript/TypeScript

Sources: `https://eslint.org/docs/latest/use/command-line-interface`,
`https://eslint.org/docs/latest/integrate/nodejs-api`,
`https://eslint.org/docs/latest/use/formatters/`; `registry.npmjs.org`.

- **eslint 10.11.0, MIT.** `eslint-plugin-security` **4.0.1, Apache-2.0**
  (`eslint-community/eslint-plugin-security`). `@microsoft/eslint-formatter-sarif` **3.1.0, MIT**
  — description: "ESLint formatter for the SARIF (Static Analysis Results Interchange Format) v2.1.0
  file format" (`Microsoft/sarif-js-sdk`).
- **Output format: SARIF is NOT native.** "The built-in formatter options are: html,
  json-with-metadata, json, stylish." SARIF requires the third-party (Microsoft-maintained) formatter,
  selected through `--format` / `-f` (e.g. `--format @microsoft/eslint-formatter-sarif`). So a
  converter must be added — but it is a supported `--format` value, not a post-processing step.
- **Finding identity**: rule id + `filePath` + line/column + `messageId`; `message` is prose. No
  fingerprint documented. (b) ESLint messages are not a stable identity.
- **Programmatic API: yes, documented and first-class.** "The ESLint class is the primary class to use
  in Node.js applications." Documented members: `new ESLint(options)`, `eslint.lintFiles(patterns)`,
  `eslint.lintText(code, options)`, `loadESLint()`. This is the cleanest embedding surface of the
  engines surveyed.
- **Incremental (not diff-only)**: CLI documents `--cache`, `--cache-file`, `--cache-location`,
  `--cache-strategy`. The Node API documents `cache`: "the `eslint.lintFiles()` method caches lint
  results and uses it if each target file is not changed. Please mind that ESLint doesn't clear the cache
  when you upgrade ESLint plugins." Per-file incrementality keyed on file state, not a change-set diff.
- **Determinism / cost**: not documented.

---

### 7. Infer (facebook/infer) — the explicit diff-only exemplar

Sources: `https://fbinfer.com/docs/infer-workflow`, `https://fbinfer.com/man/next/infer-run.1.html`,
`https://fbinfer.com/man/next/infer-report.1.html`, `https://fbinfer.com/man/next/infer-reportdiff.1.html`
(docs version 1.3.0); `facebook/infer` `LICENSE`.

- **MIT** (`LICENSE`: "MIT License / Copyright (c) Facebook, Inc. and its affiliates.").
- **Output format: SARIF native via a flag.** `infer run` documents `--sarif` — "Activates: Output
  issues in SARIF (Static Analysis Results Interchange Format) in infer-out/report.sarif". Default report
  is JSON: `infer report` — "When used without parameters, generate report output in Json."
- **Diff-only: the strongest first-party story of the set.** Two mechanisms:
  1. **Reactive/differential workflow** (infer-workflow): "Software projects such as mobile apps use
     incremental build systems, where code evolves as a sequence of code changes. For these projects, it
     can often make sense to analyze only the current changes in the project ... It is possible to
     analyze only what's changed using Infer's reactive mode." Flag: `--reactive`.
  2. **Report diff** — `infer reportdiff --report-current <file> --report-previous <file>` produces, in
     `differential/`: `introduced.json` ("contains the issues found in current but not previous"),
     `fixed.json` ("found in previous but not current"), `preexisting.json` ("found in both").
     `--file-renamings` takes "JSON with a list of file renamings to use while computing differential
     reports".
- (b) `reportdiff`'s introduced/fixed/preexisting is a 1:1 map to SARIF `baselineState`
  `new`/`absent`/`unchanged` — the engine computes it, on report JSON, with explicit file-rename
  handling.
- **Finding identity**: not documented as a fingerprint in what I read.
- **Cost**: not documented in what I read.

---

### 8. GitHub's own fingerprint algorithm — a reusable first-party reference

`github/codeql-action/src/fingerprints.ts` (read in full, 10,805 bytes) computes
`partialFingerprints.primaryLocationLineHash`:
- rolling polynomial hash, `MOD = Long.fromInt(37)`, window `BLOCK_SIZE = 100`;
- input is the first 100 **non-space/tab** characters of each line; `\r`, `\n`, `\r\n` all normalized
  to `\n`; a `-1` sentinel plus `\0` padding at EOF so the last lines hash correctly;
- emitted as `${hashValue}:${hashCounts[hashValue]}` — the occurrence index disambiguates identical
  line hashes within one file;
- code scanning then matches on (`ruleId`, `primaryLocationLineHash`, path): "Code scanning only uses
  the `primaryLocationLineHash`."

(c) Opinion: this is the closest first-party prior art to `fingerprintOf()` in
`src/core/evidence-sarif.ts`, and it independently confirms that the message must not be in the
identity. Two differences worth a conscious decision: (i) it hashes line content only and relies on
`ruleId` + path to disambiguate, whereas dove's key is one sha256 over `path|category|code`; (ii) it
puts the occurrence index **inside** the identity, so N identical matches in one file are N identities,
not one identity with `occurrenceCount = N`.

---

## Comparison table

| Engine | Native SARIF | Documented stable fingerprint | Programmatic API | Licence constraint | Diff-only support | Source URL |
|---|---|---|---|---|---|---|
| **Semgrep CE** | Yes — `--sarif`, `--sarif-output=VAL` | **No for CE**: `matchBasedId/v1` = constant `"requires login"`; docs mark `fingerprints` AppSec-only. Identity *concept* documented as `(rule ID, file path, syntactic context, index)` | Not documented (CLI + `semgrep lsp`) | Engine LGPL-2.1; **rules under Semgrep Rules License v1.0 — internal use only; competing/SaaS code-scanning use requires a purchased licence** | Yes — `--baseline-commit` | https://docs.semgrep.dev/cli-reference · /licensing · /semgrep-ci/findings-ci · /writing-rules/rule-syntax |
| **GitHub CodeQL** | Yes — `--format=sarif-latest` (`sarifv2.1.0`) | Yes — `partialFingerprints.primaryLocationLineHash` + `ruleId` + path; algorithm public in `codeql-action/src/fingerprints.ts` | No (CLI only) | **GitHub CodeQL Terms: analysis without a paid GHAS licence only for Open Source Codebases; may not be "incorporated or integrated with other software or services"; no hosted resale** | Not documented in the CLI manuals | https://docs.github.com/en/code-security/codeql-cli/... · https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md · https://github.com/github/codeql-action/blob/main/src/fingerprints.ts |
| **Opengrep** | Yes — `--sarif-output` | Yes — real `matchBasedId/v1` value in the OSS SARIF example (no login) | Not documented | Engine LGPL-2.1; **rule-set licence not verified** | Yes — `--baseline-commit` retained (`src/osemgrep/cli_ci/Ci_CLI.ml`) | https://www.opengrep.dev/ · https://github.com/opengrep/opengrep (README, LICENSE, Ci_CLI.ml) |
| **Bandit** | Yes, via extra: `-f sarif` (needs `bandit[sarif]`) | No — no "fingerprint" in the documented SARIF output | Not documented | Apache-2.0 | Baseline **report** diff: `-b/--baseline` (JSON report only) | https://bandit.readthedocs.io/en/latest/man/bandit.html · /formatters/sarif.html · https://pypi.org/pypi/bandit/json |
| **gosec** | Yes — `-fmt sarif -out f` | No — `report/sarif/builder.go` contains no fingerprint logic | **Yes** — Go package `github.com/securego/gosec/v2`, `NewAnalyzer`/`Process`/`Report` | Apache-2.0 | **None** — full flag list has no diff/baseline flag | https://github.com/securego/gosec (README, cmd/gosec/main.go, report/sarif/builder.go) · https://pkg.go.dev/github.com/securego/gosec/v2 |
| **ESLint** (+ `eslint-plugin-security`) | **No** — needs `@microsoft/eslint-formatter-sarif` selected via `--format` | No | **Yes** — `new ESLint()`, `lintFiles`, `lintText`, `loadESLint` | MIT (ESLint, formatter); Apache-2.0 (plugin) | Incremental only: `--cache`, `--cache-strategy` | https://eslint.org/docs/latest/use/command-line-interface · /integrate/nodejs-api · /use/formatters · https://registry.npmjs.org |
| **Infer** | Yes — `--sarif` → `infer-out/report.sarif` | Not documented | Not documented | MIT | **Yes** — `--reactive`; `infer reportdiff` → introduced/fixed/preexisting (+ `--file-renamings`) | https://fbinfer.com/docs/infer-workflow · /man/next/infer-run.1.html · /man/next/infer-reportdiff.1.html |

---

## What is reusable for this vertical

1. **The identity rule has independent first-party corroboration in three places.** Semgrep's documented
   4-tuple `(rule ID, file path, syntactic context, index)`; GitHub's
   `partialFingerprints.primaryLocationLineHash` (a hash of source line content, not of the alert text)
   plus "the `ruleId` ... has to be the same across analysis"; Opengrep's example fingerprint. All three
   exclude the human-readable message. `fingerprintOf(path, category, existingCode)` in
   `src/core/evidence-sarif.ts` is the same shape, arrived at independently — this is validation, not a
   redesign candidate.
2. **Decide deliberately between an in-identity occurrence index and a grouping count.** GitHub puts the
   occurrence counter *inside* the fingerprint (`hash:1`, `hash:2`), yielding N distinct identities for
   N identical matches. `evidence-sarif.ts` does the opposite: one identity with `occurrenceCount = N`.
   Both are defensible; GitHub's is the one that lets a re-run say "the second copy of this line changed".
   Worth an explicit decision rather than a default.
3. **Diff classification already has a vocabulary to borrow.** Infer's `introduced` / `fixed` /
   `preexisting` maps 1:1 onto SARIF `baselineState` `new` / `absent` / `unchanged`; Semgrep's
   `--baseline-commit` semantics ("only show results that are not found in this commit hash") is the
   same idea at the engine level. The vertical can adopt the state names and the "compute from the
   previous run's identities" method, and should copy Infer's `--file-renamings` idea for renames.
4. **Engine choice is bounded by licence, not by output format.** Every engine surveyed emits SARIF or
   has a maintained SARIF formatter. What differs is whether you may ship it: CodeQL forbids integration
   into another product without GHAS; Semgrep's engine is LGPL-2.1 (fine as a separate process) but its
   rules forbid competing/SaaS use; Opengrep is LGPL-2.1 end to end (rules licence unverified);
   Bandit / gosec / ESLint / Infer are permissive (Apache-2.0 / MIT).
5. **Only two engines offer a real programmatic API** — gosec (Go: `NewAnalyzer`/`Process`/`Report`)
   and ESLint (Node: `new ESLint()`/`lintFiles`/`lintText`). Semgrep, CodeQL, Opengrep and Bandit are
   CLI-first. If the mode's `shell.exec deny` permission is literal, only gosec and ESLint avoid a
   shell-out — and ESLint's SARIF needs a formatter package anyway. This is the sharpest constraint the
   research surfaces on the "wrap an existing engine" requirement.
6. **There is a prior-art fingerprint implementation to test against.**
   `github/codeql-action/src/fingerprints.ts` is a complete, small reference for content-derived SARIF
   fingerprints. Useful as a cross-check fixture: run both over the same file and confirm two runs agree.
7. **Determinism is nowhere promised.** Not one of the seven engines documents "same input → same
   output". That argues for the vertical computing and persisting its own identities rather than trusting
   an engine's, and it makes the acceptance criterion "two runs over the same tree produce identical
   fingerprints" a test of the vertical's own output, not of the engine's.
8. **Diff-only scanning is rarer than the marketing implies.** Only Semgrep/Opengrep
   (`--baseline-commit`), Infer (`--reactive`, `reportdiff`) and ESLint (`--cache`, incremental, not a
   diff) offer anything. gosec has none at all. Bandit's `--baseline` compares two JSON reports you must
   generate yourself. "Audit a change rather than a whole tree" is therefore mostly the vertical's job.

---

## Could not verify

- **Semgrep's exact match-based-id hash.** I read the emitter (`Sarif_output.ml`, `Gated_data.ml`) and
  the documented 4-tuple, but not the function computing `cli_match.extra.fingerprint`. I cannot state
  whether it is a hash of that 4-tuple. I also could not confirm whether the CE placeholder is
  `"requires login"` in *released* versions or only on `develop` — though docs and code agree in spirit
  that CE has no usable fingerprint.
- **A CodeQL "diff-informed queries" page.** I probed several plausible docs.github.com paths and searched
  every fetched CodeQL manual; all 404 or absent. I am **not** asserting the feature does not exist in
  hosted GitHub code scanning — only that I could not find a first-party page for it, and that the CLI
  manuals document no diff flag.
- **Opengrep repository metadata** (stars, last commit) — GitHub API rate-limited, `github.com` HTML
  fetch failed in this environment. Licence (LGPL-2.1) verified from the repo's own `LICENSE`.
- **The licence of Opengrep's rule set.** Semgrep's rules are explicitly *not* LGPL. Neither the Opengrep
  README nor OPENGREP.md stated a rules licence in what I read. Do not assume Opengrep rules are as
  permissive as the Opengrep engine.
- **Opengrep's `--baseline-commit` help text** — the plumbing is in `Ci_CLI.ml`; the help string lives
  in `Scan_CLI.ml`, which I could not fetch.
- **Bandit's embedding API** — the docs have no API page; I did not read `bandit/core/manager.py` to
  characterise `BanditManager`.
- **Any documented determinism guarantee** for any engine; **any published runtime / memory / index-size
  figures** other than CodeQL's hardware table.
- **Whether Semgrep Rules License v1.0 permits a self-hosted *internal* audit tool.** The docs say
  "Individuals, security consultants, and companies are welcome to use the rules internally", which reads
  permissive for internal use, while "vendors cannot use Semgrep-maintained rules in competing products
  or SaaS offerings" marks the boundary. I am flagging this, not answering it — it needs a legal read.
- **ESLint `--cache-strategy`'s accepted values.** I saw the flag listed in the CLI reference TOC but the
  fetched page was truncated before its description.

---

## Caveats / Not Found

- **Date and drift.** All fetches 2026-09-26. `docs.semgrep.dev` has already migrated off
  `semgrep.dev/docs` (which 301s cross-origin). Semgrep's `develop` branch is a moving target:
  `Sarif_output.ml` read at blob sha `d71973e92151100c997ec33ab4da6130a48d20fa`.
- **Source of the Semgrep comparison claim.** The line "CodeQL is not open source and you must pay to run
  it on any non-open-source code" comes from Semgrep's own
  `https://docs.semgrep.dev/faq/comparisons/codeql.md` — a competitor's characterisation. I used it only
  for orientation and relied on GitHub's own licence text for the licence claim.
- **No benchmark numbers were found anywhere.** The task asks to rank reproducible benchmarks above
  post-mortems; none of these engines' own docs publish a reproducible benchmark in the pages I read. The
  only quantitative figures are CodeQL's recommended-hardware table and gosec's `-concurrency` default.
- **Access path caveats.** `docs.github.com` article bodies were fetched through
  `https://docs.github.com/api/article/body?pathname=...` — an internal endpoint of GitHub's own docs
  site, not a documented public API. The content is GitHub's; the access path is undocumented and may
  change. Repo source was read through jsDelivr and raw.githubusercontent.com because direct
  `github.com` HTML fetch failed in this environment; the content is the repositories' own files, the
  transport is not first-party.
- **Metadata gaps caused by rate limiting.** `api.github.com` (unauthenticated) rate-limited partway
  through, so for `securego/gosec`, `opengrep/opengrep`, `facebook/infer`, `eslint/eslint`,
  `github/codeql-action` and `PyCQA/bandit` the licence and file content are verified but stars and
  last-commit are not. Licences were cross-checked against package registries (PyPI, npm) where possible.
- **Not surveyed** (out of budget, or not embeddable SAST): SonarQube, Snyk Code, Trivy, Checkmarx,
  Fortify, and the contents of the CodeQL query packs themselves. `eslint-config-security` does not
  exist on npm (404).
