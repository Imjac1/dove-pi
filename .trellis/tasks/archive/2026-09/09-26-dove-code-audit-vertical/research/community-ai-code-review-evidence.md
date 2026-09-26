# Research: Community evidence on AI-driven code auditing in production

- **Query / Scope**: What actually works (and what does not) for AI-driven code auditing in production.
  Scope limited to five questions: (1) measured precision/recall/FP rates for AI code review and LLM
  vulnerability detection, (2) the false-positive problem and mitigations, (3) where a model adds value
  over a scanner and where it does not, (4) dedup/baseline practice for stable re-runs, (5) the failure
  mode of reporting too much. Read-only research; no code or spec edits.
- **Date**: 2026-09-25 (all URLs fetched on this date unless noted).
- **Method**: direct page fetches via the research agent fetch tools. Search-engine snippets are used
  only where a page could not be fetched, and are labelled as such. Repositories were read at the file
  level, not from READMEs, where noted.

Legend used throughout: **[MEASURED]**, **[OFFICIAL-DOC]**, **[VENDOR]**, **[PRACTITIONER]**,
**[FORUM/ANECDOTE]**, **[INFERENCE]**, **[OPINION]**.

---

## Findings

### A. The operational false-positive bar that the industry actually uses

**(a) What the sources state**

1. **[OFFICIAL-DOC] [MEASURED]** Google own engineering book states the criteria for a check that is
   allowed to surface during code review: *"Produce less than 10% effective false positives - Developers
   should feel the check is pointing out an actual issue at least 90% of the time."* The same page reports
   the fleet-level number: *"The overall effective false-positive rate is just below 5%,"* and that
   Tricorder *"analyzes more than 50,000 code review changes per day."*
   Source: *Software Engineering at Google*, Ch. 20 "Static Analysis", abseil.io mirror -
   https://abseil.io/resources/swe-book/html/ch20.html (fetched; chapter text retrieved in full, ~29k chars).
   The term *effective* false positive is defined in the companion CACM paper: an issue is an effective
   false positive *"if developers did not take positive action after seeing the issue"* - i.e. it is
   measured by developer behaviour, not by ground truth. Source: Sadowski, Aftandilian, Eagle,
   Miller-Cushon, Jaspan, "Lessons from Building Static Analysis Tools at Google", *Communications of the
   ACM*, 2018 - https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/
   (fetched; 50k chars retrieved).

2. **[MEASURED]** The same CACM paper documents what happens when the bar is missed. FindBugs first
   integration attempt produced a dashboard nobody used; the second attempt, a company-wide "Fixit" week
   (May 2009), had engineers *"review a total of 3,954 such warnings (42% of 9,473 total), but only 16%
   (640) were actually fixed, despite the fact that 44% of reviewed issues (1,746) resulted in a bug
   report being filed."* The third attempt - posting FindBugs results as code-review comments - *"was
   discontinued when the code-review tool was replaced in 2011 for two main reasons: the presence of
   effective false positives caused developers to lose confidence in the tool, and developer customization
   resulted in an inconsistent view of analysis results."* Same URL as above (fetched).

**(b) Inference** - The <10% ceiling is a *behavioural* bar, not a statistical one: it counts a finding as
a false positive when a developer does nothing about it, even if the finding is technically correct. Any
FP number quoted from a ground-truth benchmark (including CASTLE, below) is therefore not directly
comparable to Google <5%.

**(c) Opinion** - Google <5% fleet figure is the single most defensible "acceptable FP rate" in the
public record, because it is an operational measurement over a very large population rather than a
benchmark score. It should be treated as the target the vertical is measured against.

### B. Measured detection quality: CASTLE (the most directly usable benchmark)

**(a) What the source states** - CASTLE: 250 hand-crafted compilable C programs, 25 CWEs, 10 cases per CWE
(6 vulnerable / 4 non-vulnerable), single file, at most one vulnerability each; 13 static analyzers, 10
LLMs, 2 formal-verification tools. Authors: Dubniczky, Horvat, Bisztray, Ferrag, Cordeiro, Tihanyi;
arXiv:2503.09433v2 [cs.CR], 31 Mar 2025, CC BY 4.0 - https://arxiv.org/html/2503.09433v2 (fetched via
rendered read; full results table retrieved).

Selected rows of Table 3 (P = precision, R = recall; FP out of 250):

| Tool / model | P | R | FP |
|---|---|---|---|
| CodeQL 2.20.1 (best SAST) | 48% | 29% | 49 |
| Semgrep Code 1.110.0 | 34% | 23% | 70 |
| SonarQube 25.3.0 | 24% | 29% | 135 |
| Clang Analyzer 18.1.3 | 87% | 9% | 2 |
| CBMC 5.95.1 | 100% | 12% | 0 |
| GitLab SAST 15.2.1 | 13% | 23% | 240 |
| Splint 3.1.2 | 2% | 15% | 1,027 |
| GPT-o3 Mini (best overall) | 63% | 78% | 73 |
| ChatGPT-o1 | 59% | 78% | 90 |
| DeepSeek R1 | 47% | 90% | 166 |
| GPT-4o | 54% | 76% | 116 |
| Llama 3.1 8B | 20% | 51% | 337 |

Stated conclusions: *"Static analyzers suffer from high false positives"*; ESBMC (formal verification)
*"minimizes false positives but struggles with vulnerabilities beyond model checking, such as weak
cryptography or SQL injection"*; *"LLMs perform exceptionally well in the CASTLE dataset when identifying
vulnerabilities in small code snippets. However, their accuracy declines, and hallucinations increase as
the code size grows."* Combination result: *"the biggest increase happens when ESBMC and CodeQL is
combined, yielding 814 points"* vs 661 for ESBMC alone.

Limitations the authors state themselves: microbenchmark scope (single-CWE, single-file); *"Preliminary
testing with a synthetic 400+ line C program... revealed that LLMs tend to report false positives when
dealing with larger codebases... when one hidden vulnerability was introduced into this combined file,
most LLMs failed to detect it reliably"*; and *"repeated evaluations of the same code typically yield
consistent results (with observed deviations below 3%)"* for models.

**(b) Inference** - On the best available microbenchmark, the best LLM reviewer runs at ~63% precision,
i.e. ~37% of its findings are false positives - roughly 4x worse than Google code-review ceiling and
~7x worse than its fleet number. The recall is genuinely better than every SAST tool tested. The
"combination" result says the two families are complementary, not substitutable.

**(c) Opinion** - CASTLE is the strongest single citation for "AI review finds real defects," *and* the
strongest citation against "at an acceptable false-positive rate." Both halves should be quoted together.

### C. Real-world acceptance rates: the CodeRabbit field study (largest measured sample)

**(a) What the source states** - Lin, Liang, Thongtanunam, Tantithamthavorn (Univ. of Melbourne / Monash),
"Is Agentic Code Review Helpful? Mining Developers Feedback to CodeRabbit Reviews in the Wild",
arXiv:2607.03316v2, submitted 3 Jul 2026, revised 23 Jul 2026 - https://arxiv.org/abs/2607.03316
(abstract fetched; full HTML fetched, first 50k chars).
Measured over **31,073 pairs of code reviews and developer feedback, from 10,191 pull requests across 239
GitHub repositories**:
- **36.4% accepted**, **7.3% triggered discussion**, **56.3% rejected**.
- *"Rejections were primarily associated with invalid suggestions that were false positives, redundant, or
  out of scope, as well as misalignment with developer intent and coding practices."*
- *"agentic reviews tend to focus more on functional concerns than evolvability-related comments, yet they
  were more likely to be invalid."*
- Predicting rejection from lightweight learning-based methods reaches *"up to 76% F1 score, suggesting
  learnable patterns exist between code reviews and their corresponding feedback."*

**(b) Inference** - In the wild, a majority of agentic review comments are not acted on. This is the
cleanest available proxy for "effective false positive rate" of a shipped LLM reviewer, and it lands near
56-64%, an order of magnitude above Google bar. Note the study measures *CodeRabbit*, not all tools.

**(c) Opinion** - The fact that rejection is predictable to 76% F1 is the most actionable number here: it
means a triage/filter stage over LLM findings is a tractable engineering problem, not a research problem.

### D. Where an LLM reviewer does *not* add value: the Copilot Code Review security study

**(a) What the source states** - Amro & Alalfi (Toronto Metropolitan University), "GitHub Copilot Code
Review: Can AI Spot Security Flaws Before You Commit?", arXiv:2509.13650v1 [cs.SE], 17 Sep 2025, CC BY 4.0
- https://arxiv.org/html/2509.13650v1 (fetched).
Method: labelled vulnerable codebases (All-Safe, VulnCodeDB, Devign, WebGoat API, VulApps, SARD, IARPA
STONESOUP/Wireshark) hosted in repos with Copilot auto-review on each PR, no prompt engineering, compared
against ground-truth labels and against CodeQL as baseline.
Results: *"Across 7 benchmark datasets, which collectively included hundreds of documented vulnerabilities
(e.g., SQL injection, insecure deserialization, cross-site scripting), Copilot generated a total of fewer
than 20 comments, most of which addressed spelling or minor style issues."* Examples: Wireshark/STONESOUP
- *"Copilot reviewed 878 out of 898 files... and generated no comments"*; WebGoat.NET - reviewed 1011 of
1019 files, generated 1 comment about a typo; SARD XSS - reviewed 6 of 9 files, no comments.
Stated conclusion: *"The failure to detect even one instance of a critical vulnerability (e.g., SQL
injection or XSS) strongly indicates that Copilot current review model is not security-aware in any
practical sense."* The paper also cites Pearce et al.: ~40% of Copilot-generated programs were vulnerable
even when tested against GitHub own CodeQL engine.

**(b) Inference** - A general-purpose LLM PR reviewer is not a vulnerability detector. This is the
counter-evidence to CASTLE favourable LLM numbers, and the difference is context: CASTLE feeds one small
file with a known CWE; Copilot reviews real diffs where the security-relevant line is one of hundreds.

**(c) Opinion** - The Copilot study is small and specific (one vendor product, purposefully vulnerable
targets), so it should not be over-generalized. Its useful contribution is directional: *general* review
prompts do not produce security findings; the finding must be elicited by a specific, scoped question.

### E. Where the LLM *does* add value: as a triage/validation layer over a scanner

**(a) What the sources state**

1. **[MEASURED, industrial]** Du, Feng, Zou, Xu, Ma, Zhang, Liu, Peng, Lou, "Reducing False Positives in
   Static Bug Detection with LLMs: An Empirical Study in Industry" (Tencent), arXiv:2601.18844v1 [cs.SE],
   26 Jan 2026 - https://arxiv.org/abs/2601.18844 (fetched).
   Dataset: *"433 alarms (328 false positives, 105 true positives) covering three common bug types"* from
   Tencent enterprise-customized static analysis tool on its Advertising and Marketing Services software.
   Findings: manual inspection costs *"10-20 minutes of manual inspection per alarm"*; *"hybrid techniques
   of LLM and static analysis eliminate 94-98% of false positives with high recall"*; cost *"as low as
   2.1-109.5 seconds and $0.0011-0.12"* per alarm; the paper also reports *"key limitations of LLM-based
   false alarm reduction in industrial settings."*

2. **[MEASURED, pre-print, author-reported]** Agrawal & Ahi, "LLM-Driven SAST-Genius: A Hybrid Static
   Analysis Framework...", arXiv:2509.15433v3, first submitted 18 Sep 2025, revised 4 Nov 2025 -
   https://arxiv.org/abs/2509.15433 (abstract fetched). Abstract: *"SAST-Genius reduced false positives
   by about 91% (225 to 20) compared to Semgrep alone."* The companion opinion article by the first author
   (a Google security engineer) reports the underlying numbers: test set of 25 open-source projects,
   170 ground-truth vulnerabilities, *"Semgrep reported a precision of just 35.7%"*, hybrid precision
   *"jumped to 89.5%"*, GPT-4 alone 65.5%. Source: Vaibhav Agrawal, "How pairing SAST with AI dramatically
   reduces false positives in code security", InfoWorld, 20 Nov 2025 -
   https://www.infoworld.com/article/4093079/how-pairing-sast-with-ai-dramatically-reduces-false-positives-in-code-security.html
   (fetched). **This is the authors own measurement of their own system; the arXiv listing also carries
   Journal reference: IEEE S&P 2025, which I could not verify (see Could not verify).**

3. **[MEASURED]** Sajadi, Dutta, Chatterjee, "An Empirical Analysis of CodeQL False Positives and Query
   Refinements for Java Vulnerabilities", arXiv:2609.04535v2, 3 Sep 2026 -
   https://arxiv.org/abs/2609.04535 (abstract fetched). 167 CVE instances from 110 projects; 500 sampled
   FP paths manually reviewed. Taxonomy of FPs: Missed Path Constraint or Sanitization 36.6%, Benign
   Execution Context 29.4%, Missing Trust Boundary Modeling 27.6%, Imprecise Concurrency Modeling 5%,
   Imprecise Sink Modeling 1.4%. Query refinements *"remove 81.8% of reviewed false positives"* and across
   the full dataset *"remove 15.8% of reported paths and locations while retaining 7 of 8 true positives."*
   With agentic tools guided by the patterns, refinement adaptation succeeded on 56% and 62% of tasks;
   *"Without this guidance, both succeed on only 28%."*

**(b) Inference** - The consistent, reproducible win for an LLM is *post-scanner triage*: take deterministic
candidate findings, give the model the code plus the data-flow path, and ask a narrow yes/no exploitability
question. Reported FP reductions (81.8% via query refinement; 91% via LLM triage; 94-98% via hybrid) all
sit in the same order of magnitude and are far larger than any reported gain from "let the LLM do the
review."

**(c) Opinion** - Tencent is the only source here with a named industrial deployment and a stated
false-positive/true-positive composition; it is the strongest support for a scanner-first, LLM-second
architecture. Its 94-98% figure is on 433 alarms of three bug types, so it should not be read as universal.

### F. A benchmark built on real AI-discovered CVEs: HoF-Bench

**(a) What the source states** - Simecek et al. (25 authors, AISLE-affiliated), "HoF-Bench: Rediscovering
Real AI-Discovered CVEs Without Frontier Models", arXiv:2607.27030v1 [cs.CR], 29 Jul 2026 -
https://arxiv.org/abs/2607.27030 (abstract fetched). Built from *"95 of these public AI-discovered CVEs
across eight repositories pinned at vulnerable commits"*; analyzers get source and target-file scope but
not CVE IDs, descriptions, fixes, or mechanisms; a blinded frontier-model judge credits only findings that
match *"the same code path, root cause, attack condition, and impact."* Result: *"A deliberately minimal
LLM-based analyzer rediscovers up to 65 of the 95 CVEs (68%) under this strict protocol."* Also: *"AISLE
analyzer is credited with more than 280 CVEs across 78 projects, including OpenSSL, curl, and GnuTLS"*;
*"the CVEs missed by every model concentrate in C infrastructure code"*; and the benchmark measures *"the
candidate volume they create."*

**(b) Inference** - 68% rediscovery of *real* CVEs with a deliberately non-frontier model is the strongest
"LLM review finds real defects" datapoint found. But the scope is target-file-scoped, four repeated passes
per CVE, and it measures candidate volume as a first-class concern - i.e. the paper itself treats noise as
part of the result, not an afterthought.

**(c) Opinion** - Vendor-adjacent (AISLE authors, AISLE dataset, AISLE hall of fame) but the dataset is
public (HuggingFace aisleinc/HoF-Bench) and the protocol is strict. Treat the 68% as credible but
single-vendor.

### G. Deduplication and baseline practice: concrete implementations

**(a) What the sources state**

1. **[OFFICIAL-DOC]** SARIF 2.1.0 schema defines exactly the fields the vertical already uses.
   partialFingerprints: *"A set of strings that contribute to the stable, unique identity of the result."*
   fingerprints: *"A set of strings each of which individually defines a stable, unique identity for the
   result."* occurrenceCount: *"A positive integer specifying the number of times this logically unique
   result was observed in this run"* (minimum 1). baselineState: *"The state of a result relative to a
   baseline of a previous run"* with enum new | unchanged | updated | absent. rank: number, default
   -1.0, min -1.0, max 100.0.
   Source: OASIS SARIF 2.1.0 JSON schema -
   https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/schemas/sarif-schema-2.1.0.json (fetched; the
   relevant schema fragments were retrieved verbatim).

2. **[OFFICIAL-DOC]** GitHub code scanning contract: *"To prevent duplicate alerts for the same problem,
   code scanning uses fingerprints to match results across various runs so they only appear once in the
   latest run for the selected branch."* Constraints stated: *"The ruleId for a result has to be the same
   across analysis"*; *"The filepath has to be consistent across the runs to enable a computation of a
   stable fingerprint. If the filepaths differ for the same result, each time there is a new analysis a new
   alert will be created, and the old one will be closed."* And a hard limit: *"Code scanning only uses the
   primaryLocationLineHash."*
   Source: GitHub Docs, "SARIF support for code scanning" -
   https://docs.github.com/en/enterprise-cloud@latest/code-security/reference/code-scanning/sarif-files/sarif-support
   (fetched).

3. **[MEASURED / real code]** The reference implementation of that hash is
   github/codeql-action/src/fingerprints.ts (repo github/codeql-action, 1,648 stars, MIT, default branch
   main, last push 2026-09-25T16:25:50Z; metadata via GitHub API). The file computes a **rolling hash over
   the first 100 non-space/tab characters of each line**, normalises CR/CRLF to LF, appends a sentinel
   value at EOF, and disambiguates identical hashes with an occurrence counter: it calls back with
   hashValue + ":" + hashCounts[hashValue]. It writes the value to
   result.partialFingerprints.primaryLocationLineHash, and when a pre-existing fingerprint disagrees with
   the recomputed one it *logs a warning and does not overwrite it* (the warning text is
   "Calculated fingerprint of <hash> ... but found existing inconsistent fingerprint value <existing>").
   Source: https://raw.githubusercontent.com/github/codeql-action/main/src/fingerprints.ts (fetched).

4. **[OFFICIAL-DOC]** Semgrep uses two ids. match_based_id is built from *"The file path / The name of the
   rule that generated the finding / The rule pattern with the metavariables values substituted in"*,
   combined and hashed, with an index *"generated by determining the number of times the rule involved
   matched code in the file"* appended after the hash. The documented property: it *"can determine if a
   given finding in a file is the same as a finding identified during a different scan, even if the code
   snippet that the rule matched had been moved to a different location in the file."* syntactic_id is
   built from path + rule name + *"the code syntax, or the literal piece of code that matched the rule"*
   + index, and is documented as *"primarily used by Semgrep for internal debugging purposes."* Semgrep
   also warns: *"The calculations used to determine whether findings are new are subject to change at any
   time as Semgrep improves its deduplication logic."*
   Source: https://docs.semgrep.dev/semgrep-code/remove-duplicates (fetched).

5. **[MEASURED / independent benchmark]** Martian Code Review Bench explicitly de-duplicates tool findings
   before scoring: pipeline step step2_5_dedup_candidates - *"Deduplicate candidates (prevents false
   positives from inline+summary overlap)"* and *"grouping those that express the same underlying concern
   so duplicate mentions are not penalized."* Precision is defined as *"Tool comments that match a golden
   comment / total tool comments"* (offline) and *"% of comments acted on"* (online).
   Repo withmartian/code-review-benchmark: 277 stars, MIT, default branch main, last push
   2026-09-15T23:40:13Z (GitHub API). Files read: README.md and methodology/full.md.
   Sources: https://raw.githubusercontent.com/withmartian/code-review-benchmark/main/README.md and
   .../methodology/full.md (both fetched).

**(b) Inference** - Three independent production systems agree on the shape: identity is derived from
*path + rule/category + matched code*, never from the human-readable message, and repeated matches on the
same code are disambiguated by an occurrence index. Semgrep match_based_id is line-movement-tolerant;
CodeQL primaryLocationLineHash is line-anchored (it survives edits above the line because it hashes line
*content*, but a finding that moves to a different line gets a different hash unless the content is
identical). GitHub "consistent filepath" and "same ruleId" rules are the documented failure modes that
produce duplicate alerts.

**(c) Opinion** - The vertical exclusion of the message from the fingerprint is not just a local decision;
it is what Semgrep and CodeQL both do. The gap the vertical must close that neither source documents well
is the *occurrence index*: without it, two findings of the same category on identical matched code in the
same file collapse into one.

### H. Triage as the actual bottleneck

**(a) What the sources state**
- Google FindBugs Fixit: 3,954 warnings reviewed, **16% fixed** (CACM, fetched).
- CodeRabbit in the wild: **56.3% of review comments rejected** (arXiv:2607.03316, fetched).
- Tencent: *"10-20 minutes of manual inspection per alarm"* (arXiv:2601.18844, fetched).
- CASTLE: static analyzers FP output *"increas[es] manual validation efforts for developers"*; Splint and
  CodeThreat generated 1,027 and 1,101 FPs respectively and received negative CASTLE scores, which the
  authors interpret as *"the volume of false positives generated by a tool imposes a significant triage
  burden on developers, outweighing its potential benefits"* (fetched).
- Martian defines its headline online metric as *"% of comments acted on"* and treats comment volume
  ("# of comments per PR", "total comments made") as first-class activity metrics (fetched).
- **[PRACTITIONER]** Bryan Finster, "AI Broke Your Code Review. Here is How to Fix It", 5-Minute DevOps
  (Substack), 4 Mar 2026 - https://bryanfinster.substack.com/p/ai-broke-your-code-review-heres-how
  (fetched). Argues the constraint is review *capacity/sampling rate*, not detection: AI raised code
  production frequency without raising feedback frequency; cites the SmartBear/Cisco analysis putting the
  useful diff size at ~400 lines, beyond which detection degrades. This is analysis/opinion, not a
  measurement he performed.

**(b) Inference** - Across measured sources the constraint is consistently triage and review capacity:
findings exist in surplus, and the scarce resource is the human minute spent deciding whether to act. The
16% and 36.4% acceptance figures are two independent measurements of the same effect.

**(c) Opinion** - This reframes the vertical: the value of the identity/baseline contract is not that it
finds more, it is that it *stops re-presenting the same finding*, which is the only lever that reduces
triage cost without reducing recall.

### I. Grounding: keeping a model from inventing findings

**(a) What the sources state**
- **[MEASURED]** Arafat (Auburn University), "Citation-Grounded Code Comprehension: Preventing LLM
  Hallucination Through Hybrid Retrieval and Graph-Augmented Context", arXiv:2512.12117v1 [cs.SE],
  13 Dec 2025 - https://arxiv.org/abs/2512.12117 (abstract fetched). Evaluation across 30 Python
  repositories and 180 developer queries. Abstract: hybrid retrieval (BM25 + dense embeddings + import-graph
  expansion) achieves *"92 percent citation accuracy with zero hallucinations"* and outperforms single-mode
  baselines by *"14 to 18 percentage points,"* discovering cross-file evidence missed by pure text
  similarity in *"62 percent of architectural queries."* The paper framing: *"LLM hallucination, generating
  plausible but factually incorrect citations to source code, remains a critical barrier."*
  A section-4.3 claim surfaced in the search index for this URL but I could not load that section (the
  fetched page truncated before it): *"Among 8% responses flagged as hallucinations, manual review
  validated 97% (31/32 examined) were genuine: models cited code not in context or fabricated plausible
  locations."* Treat that sentence as **unverified**.
- **[MEASURED]** CASTLE: *"their accuracy declines, and hallucinations increase as the code size grows"*
  (fetched).
- **[OFFICIAL-DOC]** Both fingerprint systems key identity off code, never off the model prose (Semgrep,
  CodeQL; fetched).
- **[FORUM/ANECDOTE]** A DEV Community post, "Why 80% of AI Code Reviews Are Just Noise" (author
  "synthaicode", posted 21 Jan, year not shown) -
  https://dev.to/synthaicode_commander/why-80-of-ai-code-reviews-are-just-noise-4i0o (fetched). It asserts
  *"Studies show 60-80% of AI code review comments are noise"* with **no citation**, and recommends the
  same baseline discipline the vertical uses: *"Run a baseline review to identify existing issues... Then
  review additions/changes against that baseline. Otherwise, AI will rediscover the same legacy issues in
  every review - drowning new findings in old noise."*

**(b) Inference** - The community position that is actually supported by evidence is narrower than
"prompt the model to be careful": it is that a finding must be *mechanically anchored* to code that was
fetched and can be re-checked (path + line + snippet), and that identity must be derived from that code.
The citation-grounding result (92% citation accuracy, zero hallucinations) is achieved by changing the
retrieval/verification architecture, not by instruction.

**(c) Opinion** - I found no community consensus statement as such - no shared standard, no agreed prompt
pattern. The strongest evidence-backed practice is the one already encoded in the frozen contracts:
require matched code, and refuse to let generated prose participate in identity.

### J. Additional measured comparisons (for completeness)

- **[MEASURED, small-n]** Tehrani, Sultanow, Buchanan, Houmani, Fodja, "LLM vs. SAST: A Technical Analysis
  on Detecting Coding Bugs of GPT4-Advanced Data Analysis", arXiv:2506.15212v2 [cs.CR], v1 18 Jun 2025,
  v2 14 Jul 2026 - https://arxiv.org/abs/2506.15212 (fetched). 32 curated security scenarios, binary
  detection rule, SAST baseline = logical OR of SonarQube and Cloud Defence, McNemar test. Result:
  *"GPT-4 correctly detected 30 of 32 scenarios (93.75%), while the aggregated SAST baseline detected 11 of
  32,"* statistically significant in favour of GPT-4. n=32 is very small and the scenarios are curated.
- **[MEASURED]** Cihan, Icoz, Haratian, Tuzun, "Evaluating Large Language Models for Code Review",
  arXiv:2505.20206v1 [cs.SE], 26 May 2025 - https://arxiv.org/abs/2505.20206 (abstract fetched). GPT-4o and
  Gemini 2.0 Flash on 492 AI-generated code blocks plus 164 HumanEval blocks: correctness classified
  correctly 68.50% and 63.89% of the time, code corrected 67.83% and 54.26% of the time, **with** problem
  descriptions; performance declined without them. Authors recommend a human-in-the-loop process.

---

## What is reusable for this vertical

1. **The fingerprint rule is corroborated, not idiosyncratic.** Semgrep match_based_id (path + rule +
   matched pattern with metavariables substituted) and CodeQL primaryLocationLineHash (content hash of the
   matched line + occurrence count) both derive identity from code, never from the message. The vertical
   doveFinding/v1 rule is consistent with two production systems. [OFFICIAL-DOC + real code]

2. **Add the occurrence index explicitly.** Semgrep appends a match index; CodeQL appends ":" + count;
   SARIF has occurrenceCount. Without an index, two same-category findings on identical matched code in one
   file collapse into one identity. [OFFICIAL-DOC]

3. **Stability preconditions to document and test.** GitHub two documented duplicate-alert causes are
   (i) a changed ruleId across runs and (ii) inconsistent artifact paths. The vertical category and path
   handling must be byte-stable across runs, or a re-run is not a diff. [OFFICIAL-DOC]

4. **baselineState has exactly four legal values**: new | unchanged | updated | absent; rank is bounded
   -1.0..100.0. Use the schema values, not invented ones. [OFFICIAL-DOC]

5. **The measured win is scanner-first, LLM-as-triage.** Tencent (94-98% FP elimination on 433 alarms,
   high recall), CodeQL refinement (81.8% of reviewed FPs removed, 7/8 TPs retained), and SAST-Genius
   (225 to 20 FPs, self-reported) all point the same way. A standalone LLM reviewer runs at ~37% FP on a
   friendly microbenchmark (CASTLE) and ~56-64% non-acceptance in the wild (CodeRabbit). [MEASURED]

6. **Set the acceptance bar to a real number.** Google code-review ceiling is <10% *effective* false
   positives per check, with <5% measured fleet-wide, where "effective" means the developer took no action.
   This is the only large-scale operational threshold found. [OFFICIAL-DOC/MEASURED]

7. **Dedup before emitting, and treat volume as a metric.** Martian pipeline de-duplicates candidate
   findings that express the same underlying concern *before* scoring, precisely so duplicates are not
   penalised as false positives. HoF-Bench measures "the candidate volume they create" as a first-class
   output. The vertical should count emitted findings per run and treat growth as a defect signal.
   [MEASURED]

8. **Prefer narrow, grounded questions over "review this diff."** The Copilot study near-zero security
   detection came from generic auto-review; the results that work (Tencent, CASTLE LLM rows) all feed a
   small, scoped unit with a specific question. The mode existing rule - *"A finding without the matched
   source text is not a finding"* - is the same principle. [MEASURED + repo contract]

9. **Do not expect the LLM to be the security engine.** Every source that measured a general-purpose
   reviewer on security found it weak (Copilot study), and every source that measured an LLM over scanner
   output found it strong (Tencent, SAST-Genius). [MEASURED]

---

## Could not verify

1. **Coverity ">30% false positive rate easily causes problems."** The CACM article "A Few Billion Lines
   of Code Later" (https://cacm.acm.org/research/a-few-billion-lines-of-code-later/) was **blocked by
   Cloudflare** on fetch (returned an "unable to access acm.org" page). The 30% figure appeared only in a
   search-engine snippet and in a secondary ResearchGate snippet. **Not verified.**
2. **Graphite "5-15% false positive rate" (and Graphite own "5-8%").** Source:
   https://graphite.com/guides/ai-code-review-false-positives (fetched). The page names no benchmark, no
   methodology, and no measurement; it is vendor content marketing. **Unverified vendor claim.**
3. **The DEV Community claim that "60-80% of AI code review comments are noise."** Fetched; the post cites
   no study. **Unverified forum claim.** (The CodeRabbit field study 56.3% rejection rate is in the same
   direction but is a different, measured quantity.)
4. **Augment claim that "10.3% of false positive cases" trace to "missing visibility into other files,"
   attributed to the CodeRabbit study (arXiv:2607.03316).** I fetched the CodeRabbit paper and searched its
   first 50k characters; the string "10.3" does not appear. Source of the claim:
   https://www.augmentcode.com/guides/ai-code-review-accuracy (fetched, vendor blog, author Molisha Shah,
   published 2026-09-08). **Attribution not verified.**
5. **SAST-Genius Journal reference: IEEE S&P 2025** on arXiv:2509.15433v3. A paper first submitted
   18 Sep 2025 cannot have been published at IEEE S&P 2025; the arXiv listing itself may be inaccurate. I
   could not find a proceedings entry. **Unverified.**
6. **Section 4.3 of arXiv:2512.12117** (the "8% hallucination / 97% (31/32) genuine" sentence). The page
   truncated before that section in my fetch; the sentence came from the search index only. The abstract
   "92 percent citation accuracy with zero hallucinations" **was** retrieved from the fetched abstract page.
7. **Repository metadata for CASTLE-Benchmark/CASTLE-Benchmark and weareaisle/HoF-Bench** (stars, last
   commit, license). GitHub API rate-limited me after two successful calls. I did not read files in either
   repo. **Not verified.**
8. **CodeRabbit own claim of topping "Martian code review benchmark"** -
   https://www.coderabbit.ai/blog/coderabbit-tops-martian-code-review-benchmark. I did not fetch the
   leaderboard to confirm the ranking. **Vendor claim, unverified.**
9. **The specific false-positive rate of any *AI code review* product as an FP rate.** No source found
   reports an FP rate for AI code review in the same units as Google "effective false positive rate." The
   closest measured proxies are acceptance/rejection rates (CodeRabbit 36.4%/56.3%) and benchmark precision
   (CASTLE 63% for the best LLM). **These are not the same metric.**

---

## Caveats / Not Found

**Classification of every source cited above**

| Source | Class | Note |
|---|---|---|
| Software Engineering at Google Ch.20 (abseil.io) | OFFICIAL-DOC / MEASURED | Google own book; operational stats |
| CACM "Lessons from Building Static Analysis Tools at Google" (2018) | MEASURED | Peer-reviewed experience report |
| OASIS SARIF 2.1.0 JSON schema | OFFICIAL-DOC | Normative |
| GitHub Docs, SARIF support for code scanning | OFFICIAL-DOC | Vendor platform contract |
| github/codeql-action src/fingerprints.ts | MEASURED / real code | Read the file, not the README |
| Semgrep docs, remove duplicate findings | OFFICIAL-DOC | Vendor platform contract |
| CASTLE, arXiv:2503.09433v2 | MEASURED | Pre-print; models from Feb 2025 |
| CodeRabbit field study, arXiv:2607.03316v2 | MEASURED | Pre-print; one vendor tool |
| Copilot Code Review study, arXiv:2509.13650v1 | MEASURED | Pre-print; one vendor tool |
| Tencent LLM-FP study, arXiv:2601.18844v1 | MEASURED | Pre-print; single company |
| HoF-Bench, arXiv:2607.27030v1 | MEASURED | Pre-print; AISLE-authored |
| CodeQL FP taxonomy, arXiv:2609.04535v2 | MEASURED | Pre-print |
| Martian Code Review Bench repo + methodology | MEASURED | Independent, MIT, open pipeline |
| LLM vs SAST, arXiv:2506.15212v2 | MEASURED | n=32, very small |
| Evaluating LLMs for Code Review, arXiv:2505.20206v1 | MEASURED | 492 + 164 blocks |
| Citation-Grounded Code Comprehension, arXiv:2512.12117v1 | MEASURED | Pre-print, single author |
| SAST-Genius arXiv:2509.15433v3 + InfoWorld opinion | VENDOR (self-measured) | Authors measure their own system |
| Augment Code guide | VENDOR | Secondary; one attribution unverified |
| Graphite guide | VENDOR | No methodology |
| CodeRabbit blog | VENDOR | Leaderboard claim unverified |
| AISLE blog | VENDOR | Points at HoF-Bench, which I verified separately |
| Bryan Finster, 5-Minute DevOps (Substack) | PRACTITIONER | Analysis, not measurement |
| DEV Community "80% noise" | FORUM / ANECDOTE | No citation |
| Reddit r/ClaudeCode thread | FORUM / ANECDOTE | Not relied on for any claim here |

**Other caveats**

- **Pre-print weight.** 11 of the measured sources are arXiv pre-prints without peer review. Only the
  Google sources (book + CACM) and the vendor platform docs are in any sense authoritative. Treat the
  arXiv numbers as reproducible-but-unrefereed; several are recent enough (Jul-Sep 2026) that no
  replication exists.
- **Staleness.** CASTLE evaluated models in Feb 2025 and SAST tools at versions from early 2025. Its model
  rankings should not be projected onto 2026 models.
- **Metric incomparability.** "Precision" in CASTLE (ground-truth microbenchmark), "precision" in Martian
  (matched to curated golden comments or to developer actions), "% comments acted on" (online), and
  Google "effective false positive rate" (developer took no action, on a check already gated at <10%) are
  four different quantities. Do not put them on one axis.
- **Vendor circularity.** The strongest "LLM finds real CVEs" evidence (HoF-Bench) is authored by the
  vendor whose analyzer is the subject. The strongest "LLM triage works" evidence (SAST-Genius/InfoWorld)
  is the authors own measurement of their own system. Both are reproducible in principle (public dataset,
  public protocol) but neither is independently replicated.
- **What I did not find at all.** (i) Any controlled study that measures an AI code-audit pipeline
  *fingerprint stability* across runs, or the diff quality of a re-run - the vertical core acceptance
  criterion has no external evidence base I could locate. (ii) Any measured comparison of an LLM reviewer
  against a scanner on *logic/authz* defects specifically; the closest is CASTLE per-CWE breakdown and the
  Copilot study observation that Copilot misses injection flaws. (iii) Any community consensus document on
  grounding findings. (iv) Any public data on findings that are reported, acknowledged, and then never
  fixed at a specific organization - the Google Fixit 16% is the only such number found.
