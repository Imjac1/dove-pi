# Research: auditability and the evidence plane - what a harness must record so a human can audit what it did

- **Query:** what must an agent harness record so that a human can audit what it did? Which of that is
  standardised, which is a vendor's shape, what do regulators require, what makes a record trustworthy
  rather than merely present, and what must deliberately not be recorded?
- **Scope:** (1) OpenTelemetry GenAI semantic conventions, read from the conventions themselves;
  (2) agent trace schemas in the wild - LangSmith, Braintrust, W&B Weave, Arize Phoenix, Helicone;
  (3) the audit standard - EU AI Act, SEC/FINRA recordkeeping, NIST SP 800-53 AU family, and the SOC 2 /
  ISO 27001 gap; (4) non-repudiation - Merkle/transparency logs, signed digests, attestations;
  (5) the SARIF finding-identity case study in this repository, with external precedent for and against;
  (6) the concrete questions an auditor asks and the minimum record each one needs.
- **Date:** 2026-09-26. **Author:** research sub-agent for task `09-26-dove-agent-harness-capabilities`.
- **Out of scope, deliberately:** everything already covered by the five existing files in this directory.
  This file does not re-establish that `src/core` is unwired, does not re-survey the gate semantics, and
  does not re-derive C1-C7. Where it touches those, it cites them.

## Fetch methods used, and which of them worked

Recorded because the earlier waves lost time here.

| Method | Result |
|---|---|
| `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` | **Worked for every path attempted.** The primary source of everything read here. |
| `cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>` | **Worked** (tested once, as a mirror of the OTel README). |
| `ungh.cc/repos/<owner>/<repo>` and `/files/<branch>` | **Worked**, best tool for repo metadata and file listings. **Rate-limits (HTTP 429) after roughly 40 calls per window** - it did so mid-session. |
| `api.github.com/repos/.../git/trees/<ref>?recursive=1` and `/commits?path=` | **Worked** (3 calls). The response text is truncated by the fetch layer, but the "path" pairs survive the truncation and are greppable. |
| `img.shields.io/github/stars/<owner>/<repo>.json` | **Worked.** Values are rounded ("1.6k") and `last-commit` returns a relative label ("yesterday", "september"), not a date - treat as approximate. |
| **any doc-site url with `.md` appended** | **Worked on every Mintlify-based doc site tried**: `docs.langchain.com`, `docs.wandb.ai`, `arize.com/docs/phoenix`, `docs.helicone.ai`, `braintrust.dev/docs`, `docs.semgrep.dev`. This is the highest-value trick in this environment and it yields clean markdown in the vendor's own wording. |
| `rfc-editor.org/rfc/rfcNNNN.txt` | **Worked.** |
| `govinfo.gov/content/pkg/CFR-YYYY-title-N-vol-M/xml/...-secX-Y.xml` | **Worked, and is the cleanest way to read the CFR.** Warning: a wrong volume number returns HTTP 200 with an **HTML landing page**, not a 404. Check that the body starts with an XML declaration. |
| `law.cornell.edu/cfr/text/...`, `finra.org/rules-guidance/rulebooks/...`, `artificialintelligenceact.eu`, `csf.tools`, `docs.aws.amazon.com`, `docs.sigstore.dev` | **Worked**, HTML; content must be strip-tagged and searched by keyword because the navigation is enormous. |
| `www.ecfr.gov` | **Blocked** - redirects to `unblock.federalregister.gov` (bot protection) which the fetcher will not follow. The `api/renderer` endpoint returned content but only at whole-part granularity, truncated before the section wanted. |
| `iso.org` (any path) | **Blocked** - HTTP 403, Cloudflare interstitial. |
| `json.schemastore.org` | **Blocked** - cross-origin redirect to `schemastore.org` not followed automatically. |
| `semgrep.dev/docs/...` | **Redirects to `docs.semgrep.dev`**, which the fetcher will not follow automatically; fetching the target URL directly worked. |
| `aicpa-cima.com` | **Served, but is a JavaScript application.** No criteria text is present in the HTML. |

**Hard limit discovered:** the fetch tool truncates a response at **100,000 characters** and returns no
pagination. This is not cosmetic: OTel's `gen-ai-spans.md` is larger than that, and the section this task
most wanted ("Capturing instructions, inputs, and outputs") sits past the cut. See *Could not verify*.

---

## What the sources state

### 1. OpenTelemetry's GenAI semantic conventions - how real is the closest thing to a standard?

**Status as of this session.** The conventions **no longer live in `open-telemetry/semantic-conventions`**.
They moved to `open-telemetry/semantic-conventions-genai`. The old website pages now serve a stub:
*"GenAI semantic conventions have moved to the OpenTelemetry GenAI semantic conventions repository. This
page has moved and is no longer maintained in this repository."* (`https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/index.md`).
`gen-ai-spans.md` at the old location returns **404**, and `gen-ai-agent-spans.md` returns **404** too.
The new repository was created **2026-05-05**.

**Stability: every GenAI signal is `Development`.** The front matter of every document read states
`**Status**: [Development][DocumentStatus]`, and each generated section repeats a Development badge. The
only `Stable` attributes appearing on a GenAI agent span are borrowed from core semconv: `error.type`,
`server.address`, `server.port`. **There is no Stable GenAI span or attribute.** The repository README
additionally records a "Schema URL" heading whose body is literally `TODO` - the schema-URL mechanism that
would let a consumer pin a version is not yet defined.

**The span taxonomy for an agent** (`docs/gen-ai/gen-ai-agent-spans.md`):

| Span | `gen_ai.operation.name` | Kind | What it means |
|---|---|---|---|
| `create_agent {gen_ai.agent.name}` | `create_agent` | CLIENT | agent creation, "usually applicable when working with remote agent services" |
| `invoke_agent {gen_ai.agent.name}` | `invoke_agent` | CLIENT | invocation over a remote service |
| `invoke_agent {gen_ai.agent.name}` | `invoke_agent` | INTERNAL | invocation in the same process; examples given are **LangChain agents, CrewAI agents** |
| `invoke_workflow` | `invoke_workflow` | - | workflow invocation |
| `plan {gen_ai.agent.name}` | `plan` | INTERNAL | "an agent planning or task decomposition phase" |
| `execute_tool {gen_ai.tool.name}` | `execute_tool` | - | defined in `gen-ai-spans.md`, referenced from the agent doc |

The `plan` span carries an explicit self-limiting clause worth quoting, because it is the standard
admitting where its own visibility ends: *"This span SHOULD be reported by instrumentations when they can
reliably determine that the operation being instrumented is planning or task decomposition, and SHOULD NOT
be reported when the instrumentation cannot distinguish planning from generic reasoning or normal
inference."*

**The attribute surface is 74 attributes** (extracted from `docs/registry/attributes/gen-ai.md`, 53,153
chars). The ones an agent harness would set:

- Identity/lineage: `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.description`,
  `gen_ai.agent.version`, `gen_ai.conversation.id`, `gen_ai.workflow.name`
- Operation: `gen_ai.operation.name` (Required), `gen_ai.provider.name` (Required), `gen_ai.request.model`
- Tools: `gen_ai.tool.name`, `gen_ai.tool.type`, `gen_ai.tool.description`, **`gen_ai.tool.call.id`**,
  `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`, `gen_ai.tool.definitions`
- Outcome: `error.type` (Stable, Conditionally Required "if the operation ended in an error"),
  `gen_ai.response.finish_reasons`, `gen_ai.response.status`
- Accountancy: the `gen_ai.usage.*` family, including `cache_read.input_tokens`, `cache_write.input_tokens`,
  `reasoning.output_tokens`

`gen_ai.tool.call.id` is the only join key between a model's tool call and its execution. It is the
attribute on which the whole "which tool call produced this result" question rests, and it is
**Conditionally Required / Recommended**, not Required.

**What is deliberately excluded: prompt and completion content.** The content-bearing attributes are
marked `Opt-In` in the requirement-level column, not merely Recommended:

| Attribute | Requirement level | Note in the document |
|---|---|---|
| `gen_ai.system_instructions` | Opt-In | quoted from the memory section: "Instrumentations SHOULD NOT capture this attribute by default. Capture SHOULD be gated by an explicit user opt-in, for example `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`" |
| `gen_ai.input.messages` | Opt-In | a Warning block: "This attribute is likely to contain sensitive information including user/PII data." |
| `gen_ai.output.messages` | Opt-In | same warning |
| `gen_ai.tool.definitions` | Opt-In | a Warning block: "This attribute may contain sensitive information. Since this attribute could be large, it's NOT RECOMMENDED to populate non-required properties by default." |
| `gen_ai.tool.call.arguments` / `gen_ai.tool.call.result` | Opt-In | - |
| `gen_ai.memory.query.text` / `gen_ai.memory.records` | Opt-In | "Instrumentations SHOULD NOT capture this attribute by default. Capture SHOULD be gated by an explicit user opt-in" |

`model/gen-ai/spans.yaml` confirms the mechanism at the source: the content group is
`attributes.gen_ai.content`, and **17 attributes in that file carry `requirement_level: opt_in`**.

**The decisive negative result.** I grepped the 53,153-character GenAI attribute registry and the
99,529-character agent-span document for the strings `approv`, `permission`, `consent`, `authoriz`,
`audit`. **Zero occurrences, in both.** This is the same shape the existing research established for MCP:
the closest thing to a standard for agent telemetry has **no vocabulary at all** for authorisation,
approval or audit; it has vocabulary for tokens, tools, models and errors. There is no attribute for a
scope, a grant, a policy decision, an approval, an effect key, or an idempotency key. If this project
wants those in its evidence, **it is not failing to comply with a standard - it is defining one.**

### 2. Agent trace schemas in the wild

**Is any of it normative?** Short answer: **one is, with an asterisk, and it is not the one you would
guess.**

**OpenInference (Arize)** - `Arize-ai/openinference`, ~1.2k stars, last commit "yesterday", licence not
read. `spec/README.md` (full, 6,400 chars) declares: *"OpenInference is a semantic convention
specification for AI application observability, built on OpenTelemetry."* It defines a span-kind taxonomy
that is **more agent-shaped than OTel's**: `LLM`, `AGENT`, `CHAIN`, `TOOL`, `RETRIEVER`, `RERANKER`,
`EMBEDDING`, `GUARDRAIL`, `EVALUATOR`, `PROMPT`. It carries BCP-14 normative keywords and a compliance
definition: *"An implementation is **compliant** if it satisfies all 'MUST' ... requirements defined in
this specification. An implementation that fails to satisfy any such requirement is **not compliant**."*
It also names the problem a general harness should care about, verbatim: *"**Nondeterminism** - LLM
outputs are stochastic; traces must carry enough context to reproduce - or at least explain - a particular
execution."*

The asterisk: it is **single-vendor governance** (Arize), and it has the same hole as OTel. I scanned the
69,936-character `spec/semantic_conventions.md` for `approval`, `permission`, `consent`, `authoriz`,
`audit`: **zero hits**. Its privacy model is also the inverse of OTel's - `spec/configuration.md`
documents `OPENINFERENCE_HIDE_INPUTS`, `OPENINFERENCE_HIDE_OUTPUTS`, `OPENINFERENCE_HIDE_PROMPTS`,
`OPENINFERENCE_HIDE_LLM_TOOLS` and others, **all defaulting to `False`**. Default behaviour is to record
the prompt and the completion; hiding is an opt-out flag.

**LangSmith** (`docs.langchain.com/langsmith/observability-concepts.md`, read in full). Data model:
*runs* (a unit of work; "if you are familiar with OpenTelemetry, you can think of a run as a span"),
*traces* (a collection of runs sharing a trace ID), *threads* (traces grouped by a `thread_id` metadata
key), *trajectories* (a flat, ordered, deduplicated list of messages). Enrichment is *feedback* (tag +
score, bound by run ID), *tags*, *metadata*. Two operational facts with audit consequences, stated
verbatim: *"Each trace is limited to a maximum of 25,000 runs. Once the trace reaches this limit,
LangSmith will reject any additional runs that you send for that trace."* and *"LangSmith (SaaS) retains
trace data for 180 days from ingestion. After that, traces are permanently deleted, with limited metadata
retained for usage statistics."* A retention period of 180 days with permanent deletion is **incompatible
with every recordkeeping regime in section 3**.

**W&B Weave** (`docs.wandb.ai/weave/guides/tracking/tracing.md` and `.../call-schema-reference.md`, read
in full). Concepts: *Op* (a versioned tracked function), *Call* (a logged execution of an Op), *Trace*,
*Thread*. The Call schema is published as a field table: `id`, `project_id`, `op_name`, `display_name`,
`trace_id`, `parent_id`, `started_at`, `attributes`, `inputs`, `ended_at`, `exception`, `output`,
`summary`, `wb_user_id`, `wb_run_id`, `deleted_at`. Two details matter. First, `attributes` are
**"read-only during execution"** - *"Attributes are frozen once the Call starts"* - which is a
record-at-start invariant. Second, Weave computes a status enum that names the case a naive harness
misses: `SUCCESS`, `ERROR`, `RUNNING`, **`DESCENDANT_ERROR` ("the Call succeeded but a child Call
errored")**. `deleted_at` is a first-class field, i.e. deletion is recorded rather than silent.

**Braintrust** (`braintrust.dev/docs/llms.txt` index, `instrument/index.md`, `instrument/advanced-tracing.md`).
The index describes spans, logs, traces, experiments, and a "Loop" agent that "creates and edits objects
with your approval". `advanced-tracing.md` documents masking sensitive data before it is logged, alongside
distributed-trace propagation and span rendering. I found **no published span schema page**: their span
object is defined by the SDK, not by a spec. Documentation-only, and no normative claim exists to evaluate.

**Helicone** (`docs.helicone.ai/features/advanced-usage/custom-properties.md`, read in full). Its audit
surface is metadata on the HTTP request: `Helicone-Property-<Name>` headers, used for filtering, cost
attribution and alerting. There is no step or trace concept in the page read - it is request-level, and
property values are free strings.

**Arize Phoenix** (`arize.com/docs/phoenix/tracing/llm-traces.md`). Phoenix is explicitly a consumer of
OTLP: *"Phoenix accepts traces over the OpenTelemetry protocol (OTLP)"*. It is best understood as an
OpenInference renderer, so its schema question reduces to OpenInference's.

**Verdict on question 2.** Everything at the agent level is either (a) a vendor's SDK shape with no
normative claim (LangSmith, Weave, Braintrust, Helicone), or (b) a single-vendor specification written in
normative language (OpenInference), or (c) a standards-body convention that is entirely `Development` and
currently in physical transit between repositories (OTel GenAI). **No vendor shape surveyed contains any
concept of approval, authorisation, consent or audit.** They are observability schemas; audit is a
different question and nobody has answered it in a schema.

### 3. The audit standard - what is actually required of an automated system's logs

#### 3.1 EU AI Act (Regulation (EU) 2024/1689) - Articles 12 and 19

Read via the `artificialintelligenceact.eu` mirror (a widely used third-party explorer, **not** an
official publication; the official text is OJ L, 12.7.2024). The mirror injects definitions inline, which
is why the quotations below read awkwardly.

**Article 12 - Record-Keeping.** The mirror states the provision comes into force **2 December 2027**
(Annex III high-risk) / **2 August 2028** (Annex I high-risk), per Article 113(c). Article 12(1):
*"High-risk AI systems shall technically allow for the automatic recording of events (logs) over the
lifetime of the system."* Article 12(2): *"In order to ensure a level of traceability of the functioning
of a high-risk AI system ... logging capabilities shall enable the recording of events relevant for: (a)
identifying situations that may result in the high-risk AI system presenting a risk within the meaning of
Article 79(1) or in a substantial modification ... after its placing on the market ..."*, with the
enumeration continuing into post-market monitoring and monitoring of the operation of the system.

Note the shape of the obligation: it is a **design-time** requirement on the system ("shall technically
allow for the automatic recording of events ... over the lifetime of the system"), and the events are
specified **by the purpose they serve** (identifying risk, facilitating post-market monitoring, monitoring
operation) rather than by a field list. Nothing in it says what a field is called.

**Article 19 - Automatically Generated Logs.** *"Providers of high-risk AI systems shall keep the logs
referred to in Article 12(1), automatically generated by their high-risk AI systems, to the extent such
logs are under their control. Without prejudice to applicable Union or national law, the logs shall be
kept for a period appropriate to the intended purpose ... of at least six months, unless provided
otherwise in the applicable Union or national law, in particular in Union law on the protection of
personal data ..."*

Three things a general harness would miss: the logs are **the provider's obligation, not the user's**;
the retention period is **the provider's own determination** ("appropriate to the intended purpose") with
a six-month floor; and the personal-data carve-out is written into the retention sentence itself.

#### 3.2 SEC and FINRA - the US broker-dealer recordkeeping regime

Read from the **GPO's CFR XML** (`govinfo.gov/.../CFR-2024-title17-vol4-sec240-17a-4.xml`), not from a
vendor blog.

**17 CFR 240.17a-4(a)-(b), preservation periods.** Records made under 17a-3(a)(1)-(3),(5),(21),(22):
*"not less than 6 years, the first two years in an easily accessible place"*. Other enumerated records:
*"not less than three years, the first two years in an easily accessible place"*. "Easily accessible" is
a separate obligation from "preserved", and it is a **time-bounded retrieval** obligation.

**17 CFR 240.17a-4(f) - electronic recordkeeping.** This is the load-bearing text for the evidence plane.
Paragraph (f) permits electronic keeping *"Subject to the conditions set forth in this paragraph (f)"*, and
(f)(2) states the conditions. Verbatim, (f)(2)(i):

> **(A)** Preserve a record for the duration of its applicable retention period in a manner that maintains
> **a complete time-stamped audit trail** that includes: **(1)** All modifications to and deletions of the
> record or any part thereof; **(2)** The date and time of actions that create, modify, or delete the
> record; **(3)** If applicable, the identity of the individual creating, modifying, or deleting the
> record; and **(4)** Any other information needed to maintain an audit trail of the record in a way that
> maintains security, signatures, and data to ensure the authenticity and reliability of the record and
> will permit **re-creation of the original record if it is modified or deleted**; **or**
>
> **(B)** Preserve the records exclusively in a **non-rewriteable, non-erasable format**.

And (f)(2)(ii)-(v):

> **(ii)** Verify automatically the **completeness and accuracy** of the processes for storing and
> retaining records electronically;
> **(iii)** ... serialize the original and duplicate units of the storage media, and time-date the
> required period of retention ...
> **(iv)** Have the capacity to readily download and transfer copies of a record **and its audit trail**
> (if applicable) in both a **human readable format** and in a **reasonably usable electronic format** and
> to readily download and transfer the information needed to locate the electronic record, as required by
> the staffs of the Commission, the self-regulatory organizations ..., or any State securities regulator
> ...; and
> **(v)(A)** Include a **backup** electronic recordkeeping system ... that retains the records ... in a
> manner that will serve as a **redundant set of records** if the original ... is temporarily or
> permanently inaccessible; or **(B)** Have other redundancy capabilities ...

Paragraph (f)(3) adds that the firm must *"At all times have available ... facilities for immediately
producing the records preserved ... and for producing copies of those records"* and be *"ready at all
times to provide, and immediately provide, any record stored ... that the staffs of the Commission, the
self-regulatory organizations ... may request"*.

**FINRA Rule 4511 - General Requirements** (read from finra.org):

> (a) Members shall make and preserve books and records as required under the FINRA rules, the Exchange
> Act and the applicable Exchange Act rules. (b) Members shall preserve for a period of at least six years
> those FINRA books and records for which there is no specified period under the FINRA rules or applicable
> Exchange Act rules. (c) All books and records required to be made pursuant to the FINRA rules shall be
> preserved **in a format and media that complies with SEA Rule 17a-4**.

FINRA 4511(c) is the important one for a harness: **the format and medium are themselves a rule.**

#### 3.3 NIST SP 800-53 Rev 5.2, AU family - the free, normative control text

Read via `csf.tools/reference/nist-sp-800-53/r5/au/` (a public reference rendering of the NIST control
text; the authoritative source is NIST SP 800-53 Rev 5.2). These controls are the clearest available
statement of what an audit record must contain, and they are freely readable.

- **AU-2 Event Logging** - identify the event types the system can log; coordinate; *specify* the subset
  to be logged with frequency or triggering situation; *"Provide a rationale for why the event types
  selected for logging are deemed to be adequate to support after-the-fact investigations of incidents"*;
  review and update.
- **AU-3 Content of Audit Records** - *"Ensure that audit records contain information that establishes the
  following: What type of event occurred; When the event occurred; Where the event occurred; Source of the
  event; Outcome of the event; and Identity of any individuals, subjects, or objects/entities associated
  with the event."* Supplemental: *"Event outcomes include indicators of event success or failure and
  event-specific results, such as the system security and privacy posture after the event occurred."*
- **AU-3(3) Limit Personally Identifiable Information Elements** (Privacy baseline) - *"Limit personally
  identifiable information contained in audit records to the following elements identified in the privacy
  risk assessment: [assignment]."* The same supplemental guidance names the risk precisely: *"there is the
  potential to reveal personally identifiable information in the audit trail, especially if the trail
  records inputs or is based on patterns or time of usage."*
- **AU-8 Time Stamps** - use internal system clocks; record with a defined granularity and *"use
  Coordinated Universal Time, have a fixed local time offset from Coordinated Universal Time, or that
  include the local time offset as part of the time stamp."*
- **AU-9 Protection of Audit Information** - *"Protect audit information and audit logging tools from
  unauthorized access, modification, and deletion; and Alert [personnel] upon detection of unauthorized
  access, modification, or deletion of audit information."*
- **AU-10 Non-repudiation** - *"Provide irrefutable evidence that an individual (or process acting on
  behalf of an individual) has performed [organization-defined actions]."* Supplemental: *"Types of
  individual actions covered by non-repudiation include creating information, sending and receiving
  messages, and **approving information**."* and *"Organizations obtain non-repudiation services by
  employing various techniques or mechanisms, **including digital signatures and digital message
  receipts**."* AU-10(1): *"Bind the identity of the information producer with the information to
  [organization-defined strength of binding]"*.

AU-3's six fields, plus AU-10's "process acting on behalf of an individual", are the closest thing in the
regulatory corpus to a specification of the evidence plane. AU-10 is literally about approval.

#### 3.4 The gap: SOC 2 and ISO 27001 could not be read

- **AICPA / SOC 2.** I fetched `aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2`.
  The page is a JavaScript application. The extracted text is SOC suite marketing plus a notice about an
  unnamed compliance vendor; **zero characters of the Trust Services Criteria**. The 2017 TSC document is
  not served publicly at the URL tried.
- **ISO/IEC 27001:2022.** `iso.org` returns **HTTP 403** (Cloudflare) to this environment for every path
  tried. The standard is paywalled regardless. Two third-party mirror pages returned no control text
  within the fetch window.

**This is itself a finding to record.** The two frameworks most often invoked in vendor marketing about
"audit logs" are the two whose text is least available to read. Every claim about "SOC 2 requires X" or
"ISO 27001 requires Y" in a vendor blog is, in this environment at least, unfalsifiable. The free,
readable, citable obligations are the SEC's, FINRA's, NIST's and the EU's.

### 4. What makes a log trustworthy rather than merely present

**Merkle-tree transparency logs - RFC 9162 (Certificate Transparency v2).** Read from
`rfc-editor.org/rfc/rfc9162.txt` (obsoletes RFC 6962; category *Experimental*). The abstract states the
purpose: log certificates *"in a manner that allows anyone to audit certification authority (CA) activity
and notice the issuance of suspect certificates as well as to audit the certificate logs themselves."*
Section 2.1.1 defines the Merkle Tree Hash over an ordered list, with domain separation between leaf and
node hashes (a leaf is HASH(0x00 || d[0]); internal nodes use the 0x01 prefix) - the domain separation is
*"required to give second preimage"* resistance. Section 4.8 defines the Signed Certificate Timestamp,
whose structure is a LogID, a uint64 timestamp, an extension vector, and a signature computed over a
TransItem structure *"using the signature algorithm declared in the log's parameters"*. Sections 2.1.3 and
2.1.4 define **inclusion proofs** and **consistency proofs**; Section 8.2 defines the **Monitor** role and
8.3 **Auditing**.

The transferable structure is not "hash things". It is: an entry gets a **signed receipt at append time**
(the SCT), and any third party can later prove **this entry is in the log** (inclusion) and **the log only
grew** (consistency). Both proofs are cheap and neither requires trusting the log operator.

**Sigstore Rekor** (`docs.sigstore.dev/logging/overview/`). Verbatim: *"Rekor aims to provide an
immutable, tamper-resistant ledger of metadata generated within a software project's supply chain. It
enables software maintainers and build systems to record signed metadata to an immutable record. Other
parties can then query this metadata, enabling them to make informed decisions on trust and
**non-repudiation** of an object's lifecycle."* And on how trust is maintained: *"Rekor is built on top of
a verifiable data structure. Auditors can monitor the log for consistency, meaning that the log remains
**append-only** and entries are never mutated or removed. Verifiers can also monitor the log for their
identities."* The CLI can *"query the log for inclusion proof, integrity verification of the log or
retrieval of entries"*. Trillian provides the verifiable log; omniwitness, by Trillian's authors, provides
independent witnessing.

**AWS CloudTrail log file integrity validation** (AWS docs, read directly). This is the most directly
copyable pattern for a harness: *"When you enable log file integrity validation, CloudTrail creates a hash
for every log file that it delivers. Every hour, CloudTrail also creates and delivers a file that
references the log files for the last hour and contains a hash of each. This file is called a digest file.
CloudTrail signs each digest file using the private key of a public and private key pair."* Algorithms:
*"SHA-256 for hashing and SHA-256 with RSA for digital signing. This makes it computationally infeasible
to modify, delete or forge CloudTrail log files without detection."* The stated value: *"a validated log
file enables you to assert positively that the log file itself has not changed, or that particular user
credentials performed specific API activity"* - and, critically, the digest chain is what makes a
**deletion or an absence** detectable: the process *"lets you know if a log file has been deleted or
changed, or assert positively that no log files were delivered to your account during a given period of
time."* Digest files are stored in a **separate folder** from the log files so that policy can differ.

Three properties, in increasing order of difficulty and decreasing order of frequency:

1. **Append-only by convention** - the writer never rewrites. Cheap; detectable only by comparison.
2. **Tamper-evident** - per-record digest plus a chained or signed digest, so modification, deletion and
   *absence* are all detectable. CloudTrail, Rekor, RFC 9162.
3. **Third-party verifiable** - inclusion and consistency proofs against a log the operator does not
   control, or an independent witness. RFC 9162, omniwitness.

**in-toto Attestation Framework v1.2** (`in-toto/attestation`, 376 stars, `spec/README.md` read in full).
Four layers: *Predicate* (arbitrary metadata about the subject), *Statement* (binds the attestation to a
particular subject and identifies the predicate type), *Envelope* (**"Handles authentication and
serialization"**), *Bundle*. RFC 2119 keywords throughout; tagged releases map to SemVer MAJOR.MINOR and
the type URL of a Statement carries the version. This is the pattern for an *evidence record for
consumption by a policy engine*: the schema is versioned in the record itself, and authentication is a
separate layer rather than a field.

**What none of this establishes.** I found no vendor trace platform in section 2 that signs or chains its
span records, and no page read claims one does. That is an absence of evidence; their storage internals
were not read. LangSmith and Weave both document fields that make tampering trivial to perform and
invisible when performed: Weave has a first-class `deleted_at`, LangSmith permanently deletes traces at
180 days. Those are not criticisms in context - they are debugging tools, not records systems - but a
harness that adopts their schema inherits none of their (absent) integrity story.

### 5. The SARIF case study, and external precedent for and against it

**The local design being tested.** In this repository, `src/core/evidence-sarif.ts` chooses a *versioned
fingerprint over a content hash* so that a finding's identity survives a reworded message, and its central
rule is stated as: *"The fingerprint must exclude model prose."* - *"A fingerprint derived from the message
varies between runs - a model restates the same defect two ways - which makes baselineState meaningless and
turns every re-run into a wall of spurious new findings."* Concretely it emits two keys, both versioned
(`doveFinding/v2`, `doveContent/v2`): `contentHashOf` = sha256(category | normalized matched code),
**path-free**; and `fingerprintOf` = the same plus an **occurrence index**. It accepts and documents one
limit: a finding that **moves and is edited in the same run** reads as one new plus one absent, because
"a content-only identity cannot tell 'changed and went elsewhere' from 'deleted, and something else
appeared'".

**Does external precedent support it? Yes, in a normative appendix - with one divergence and one
important nuance.**

**SARIF itself is a standard and is in flux.** `oasis-tcs/sarif-spec`, 212 stars, file index pushed
2026-09-19, default branch `main`, licence not read. The repository contains both `sarif-2.1/` and an
active `sarif-2.2/` draft. The relevant text is **Appendix B, "(Normative) Use of Fingerprints by Result
Management Systems"** (`sarif-2.2/prose/edit/src/fingerprints.md`, 3,987 chars, read in full):

- *"To determine whether a result from a subsequent run is logically the same as a result from the
  baseline, there must be a way to use information contained in the result to construct a stable
  identifier for the result. We refer to this identifier as a fingerprint."*
- The result management system **SHOULD** build it from information in the SARIF file - *"the name of the
  tool that produced the result", "the rule id", "the file system path to the analysis target"* - and
  **SHOULD** incorporate whatever the tool supplies in `partialFingerprints`.
- *"An analysis tool **SHOULD NOT** include in `partialFingerprints` information that a result management
  system could deduce from other information in the SARIF file, for example, file hashes."*
- **The clause that is the repository's v1 to v2 fix, written down first:** *"suppose the fingerprint were
  to include the line number where the result was located, and suppose that after the baseline was
  constructed, a developer inserted additional lines of code above that location. Then in the next run,
  the result would occur on a different line, the computed fingerprint would change, and the result
  management system would erroneously report it as a new result. **A result management system SHOULD NOT
  include an absolute line number (or an absolute byte location in a binary artifact) in its fingerprint
  computation.**"*
- *"It is difficult to devise an algorithm that constructs a truly stable fingerprint for a result.
  Fortunately, for practical purposes, the fingerprint does not need to be absolutely stable; it only needs
  to be stable enough to reduce the number of results that are erroneously reported as 'new' to a low
  enough level ..."*

**The nuance against the repo's rule, stated fairly.** SARIF's own motivating example for
`partialFingerprints` is a tool that checks documentation for sensitive words: *"The word would most
likely occur only in result.message."* So SARIF explicitly contemplates message-derived identity. But what
it carries is a **literal token from an artifact**, not generated prose. The repository's rule and SARIF's
example are compatible: identity may come from a message when the message *is* the datum; it must not come
from text a model can restate.

**Two more SARIF properties worth stealing.** `detecting-incompleteness.md` (Appendix I, *Informative*,
1,311 chars, read in full) gathers three conditions under which a consumer should conclude the result set
is incomplete: (1) any `invocation.executionSuccessful == false`; (2) any notification in
`toolExecutionNotifications` or `toolConfigurationNotifications` with level "error"; (3)
`theRun.results == null`. *"These conditions apply separately to each run in the log file."* And SARIF 2.2
carries `result.occurrenceCount` ("the number of times this logically unique result was observed in this
run") as the disambiguator for genuinely repeated identical findings.

**GitHub's implementation confirms the exact shape.** `github/codeql-action` (~1.6k stars, last commit
"yesterday", licence not read), `src/fingerprints.ts`, 10,805 chars, **read in full**. It computes a
rolling hash over the first `BLOCK_SIZE = 100` non-space, non-tab characters of each line, normalizes
line endings, and emits the hash with an occurrence counter appended after a colon - that is, **content
hash plus occurrence index**, stored as `partialFingerprints.primaryLocationLineHash`. The path, the rule
id and the message are **not** inputs. The file is also honest about its own incompleteness, which is the
habit the repository's receipt module shares: locations without a `startLine` are skipped, URIs outside
the source root are dropped, non-existent or unreadable files are logged and skipped.

**Semgrep's schema goes further, and partly disagrees.** Read from `semgrep/semgrep-interfaces` (20 stars,
licence not read), `semgrep_output_v1.atd` and `semgrep_output_v1.ts`. The `finding_hashes` type is
defined with this docstring:

> *"The goal is to hash findings independently of their precise location so if a file is moved around or
> the line numbers change in a file, we do not report new findings but instead detect that the finding
> actually hashes to a previous old finding."*

and carries `start_line_hash`, `end_line_hash`, `code_hash` ("hash of the syntactic_context/code contents
from start_line through end_line") and `pattern_hash` ("hash of the rule pattern with metavariables
substituted in"). Crucially, a Semgrep finding carries **two identities at once - `syntactic_id` and
`match_based_id`** - and suppression is tracked against both: `triage_ignored_syntactic_ids` **and**
`triage_ignored_match_based_ids`. Its CI scan results also carry `searched_paths`, `skipped_paths`
("Files detected but not scanned due to error") and `renamed_paths` - a coverage record with the same
purpose as this repository's `CoverageReceipt`.

**So: is the practice generalisable? Yes, with a stated precondition.**

- *Generalises:* "identity is a versioned, deterministic function of machine-derived, run-stable inputs;
  prose is carried but never hashed into identity; a content-only key plus an occurrence index; version
  the key so a derivation change is visible rather than silent". Three independent implementations - an
  OASIS normative appendix, GitHub's scanner action, and Semgrep's published output schema - agree on the
  core.
- *Divergence to be aware of:* SARIF's guidance and Semgrep both **keep a positional identity alongside**
  the content identity; this repository drops position entirely and accepts the moved-and-edited
  ambiguity. Semgrep keeps both because a *move* and an *edit* can be disambiguated if you know both. The
  repository's choice is defensible for an audit (it prefers a false "new" over a false match, and argues
  that a false match is the worse error) but it is the stricter of the two and it is *not* what the field
  does.
- *Precondition:* the generalisation only holds where the stable part of the record is **machine-derived**.
  A fingerprint over an agent's own summary of what it did is exactly the thing all three sources avoid.

---

## What I read in code

### This repository (all reads this session, all files named)

| File | Read | What it establishes for the evidence plane |
|---|---|---|
| `src/core/evidence-sarif.ts` | **full** (489 lines) | The finding-identity contract quoted in section 5. Also: `runProperties` is documented as the place to record *"the seed universe - how many candidates the scan produced and their digest - so that 'no seed disappeared' is auditable from the artifact a reader keeps, not only true of the process that produced it"*; absent results are *"emitted from identity alone"* because an earlier version put caller-supplied prose into the deliverable; `baselineOf` **throws by name** on a baseline whose fingerprint keys it does not recognise, rather than silently reading it as empty. |
| `src/core/evidence.ts` | **full** (19 lines) | `isSensitiveEvidenceReference` / `sanitizeEvidenceReferences`. A denylist over **references, not content**: basenames (.env*, .npmrc, .pypirc, id_rsa, id_ed25519), name parts (credentials, secrets, tokens, api keys, password, private keys), extensions (.pem, .key, .p12, .pfx, .jks, .keystore, .crt, .cer, .der, .p7b, .p7c). Docstring: *"callers must opt in through a future policy boundary rather than leaking them by default."* **Note the scope limit: it filters paths, not payloads.** |
| `src/code-audit/receipt.ts` | **full** (108 lines) | The coverage receipt. Fields include `scannedFileSha256` (per-file digest), `mandatoryFamilies`, `executedPatterns`, `familyHits`, `unreadableFiles`, `gaps`, `seedSha256`. Docstring: *"A finding list cannot prove a negative. The receipt can, because it records what was actually searched ... and because its validator fails the run when any mandatory family did not execute. seedSha256 binds the receipt to the exact seed set, so the two cannot be edited independently."* and *"a file nobody could read is not a file with no findings."* `validateReceipt` compares family sets in both directions; `supportsCleanClaim` is deliberately separate from validity. |
| `src/core/authority.ts` | **head (lines 1-136)** | `EvidenceRef` carries `sha256` and optional `signed_by`; `AuthorityRequest.evidenceDigests` supplies actual digests; a reference with **no supplied digest is a block, not a pass**. Grants carry `from`/`to`, `authorizes.actions`, `targets`, `window`, `constraints`, `external_state` with a `checked_at` staleness bound (default 24h), and `risk_acceptance` with `accepted_by`. Quote: *"an agent may not grant itself authority."* |
| `src/core/contracts.ts` | read | `ExecutionRecord.kind` already enumerates the approval vocabulary: `capability.approval.pending`, `capability.approved`, `capability.blocked`, `capability.cancelled`, `capability.timed_out`, plus `project.mutation.started/completed/failed/reconciled`, `request.redelivery.coalesced`, `task.convergence.decision`. Correlation block: `requestId / sessionId / taskId / attemptId / providerCallId / executionId / toolCallId`. `CapabilityResult.evidenceRefs` and `outcome` carry the per-action evidence link. |
| `src/core/execution-ledger.ts` | read (lines 1-260 and the append site) | The ledger is **plain JSONL appended with `appendFile`** at line 198. Records carry `taskId`, `stepId`, `kind`, ISO-8601 `timestamp`, `mode`, `details`, optional `correlation`. `projectExecutionDiagnostics` is documented as dropping arbitrary detail: *"deliberately drops arbitrary details so a diagnostic query cannot echo secrets or large logs."* |

**Two negative results from grep, both load-bearing:**

1. **There is no signing, chaining or tamper-evidence anywhere in `src`.** A regex search over `src` for
   signing-related identifiers (`createHmac`, `createSign`, `sign(`, `privateKey`, `timingSafeEqual`) and
   for chaining-related ones (`prevHash`, `previousHash`, chained-hash, `merkle`) returns exactly one
   unrelated hit (`src/web-access/config.ts:191`, an `Object.assign`). `createHash` is used - for
   fingerprints and content hashes, not for integrity. So the ledger is **append-only by convention**:
   nothing detects a rewritten line, nothing detects a deleted file, and nothing prevents the process
   that writes the log from editing it. By the section-4 ladder this is rung 1 of 3.
2. **The evidence plane is the part of this repository that *is* wired.** `toSarifLog` and `baselineOf`
   are called from `src/capabilities/code-audit.ts:305-306`; `validateReceipt` from
   `src/code-audit/seed-scanner.ts:202`; `sanitizeEvidenceReferences` from `src/core/fast-path.ts:5,133`.
   This is a **correction to the framing** in the existing research files: their finding - five unwired
   modules, none reachable - is about `effect-ledger.ts`, `checkpoint.ts`, `gate-limit.ts`,
   `gate-conformance.ts`, `context-admission.ts`, `dispatch-policy.ts` and `task-convergence.ts`. The
   *evidence* modules are reachable. So a harness author has a working example of the pattern in the same
   repository that has an unwired example of the effect ledger - and the working one is the pattern to
   generalise.

### External source code read

| File | Read | Finding |
|---|---|---|
| `github/codeql-action/src/fingerprints.ts` | **full**, 10,805 chars | Content-only line hash plus occurrence index in `partialFingerprints.primaryLocationLineHash`; no path, no rule id, no message. Best-effort, with logged skips. |
| `semgrep/semgrep-interfaces/semgrep_output_v1.atd` | first 100,000 chars (truncated) | `finding_hashes` with `code_hash`, `pattern_hash`, `start_line_hash`, `end_line_hash` and the location-independence docstring; CI scan results with `searched_paths`, `skipped_paths`, `renamed_paths`. |
| `semgrep/semgrep-interfaces/semgrep_output_v1.ts` | first 100,000 chars (truncated) | A finding carries `syntactic_id` **and** `match_based_id` **and** `hashes`; triage carries `triage_ignored_syntactic_ids` and `triage_ignored_match_based_ids`. Two identities, both maintained. |
| `Arize-ai/openinference/spec/README.md` | **full**, 6,400 chars | Normative language (BCP 14), a compliance definition, a span-kind taxonomy; no approval vocabulary. |
| `open-telemetry/semantic-conventions-genai/model/gen-ai/spans.yaml` | **full**, 38,634 chars | 17 `requirement_level: opt_in` attributes; the execute-tool attribute group is `gen_ai.tool.name` (required), `gen_ai.tool.type`, `gen_ai.agent.name`. |

### Repository metadata

| owner/name | stars | last commit | licence | files read |
|---|---|---|---|---|
| open-telemetry/semantic-conventions-genai | 392 | pushed 2026-09-26 (ungh); created 2026-05-05 | Apache-2.0 (LICENSE read) | README.md; docs/gen-ai/README.md; docs/gen-ai/gen-ai-agent-spans.md (99,529 - full); docs/gen-ai/gen-ai-spans.md (first 100,000 of more - **truncated**); docs/gen-ai/gen-ai-events.md (43,312 - full); docs/gen-ai/gen-ai-exceptions.md (3,982 - full); docs/gen-ai/mcp.md (truncated); docs/registry/attributes/gen-ai.md (53,153 - full); model/gen-ai/spans.yaml (38,634 - full); LICENSE |
| oasis-tcs/sarif-spec | 212 | "september" (badge); file index pushed 2026-09-19 (ungh) | **not read** | sarif-2.2/prose/edit/src/fingerprints.md (full); sarif-2.2/prose/edit/src/detecting-incompleteness.md (full); the file index |
| github/codeql-action | ~1.6k | "yesterday" (badge) | **not read** | src/fingerprints.ts (full) |
| semgrep/semgrep-interfaces | 20 | "september" (badge) | **not read** | semgrep_output_v1.atd (truncated at 100,000); semgrep_output_v1.ts (truncated at 100,000) |
| Arize-ai/openinference | ~1.2k | "yesterday" (badge) | **not read** | spec/README.md (full); spec/semantic_conventions.md (69,936 - keyword-scanned, not read in full); spec/configuration.md (9,971 - first 3,500) |
| in-toto/attestation | 376 | "september" (badge) | **not read** | spec/README.md (full) |
| langchain-ai/docs (LangSmith docs) | not captured | not captured | not read | src/langsmith/observability-concepts.mdx (full, via the .md endpoint) |
| W&B Weave docs | not captured | not captured | not read | weave/guides/tracking/tracing.md; weave/guides/tracking/call-schema-reference.md |
| Braintrust docs | not captured | not captured | not read | docs/llms.txt; docs/_llms/guides.md; docs/instrument/advanced-tracing.md (first 3,000) |
| Helicone docs | not captured | not captured | not read | features/advanced-usage/custom-properties.md (first 5,000) |
| Arize Phoenix docs | not captured | not captured | not read | docs/phoenix/tracing/llm-traces.md (first 4,000) |

Closed-source products in scope: **LangSmith, W&B Weave, Braintrust and Helicone are commercial services**.
Everything said about them here is documentation-only and marked as such. **Arize Phoenix** is open source
(repo not read); **OpenInference** is open source (spec read). No vendor's *storage* or *log integrity*
implementation was read, for any product.

---

## What is transferable to a harness

### The six audit questions, and the minimum record each needs

Derived from AU-3's field list, the SEC's (f)(2) conditions, SARIF's identity and incompleteness
appendices, and the five bypasses already established in `design-constraints-from-evidence.md` C1. M =
must be recorded **at the moment of the action**; R = can be **reconstructed later**.

| Question an auditor asks | Minimum record | M / R |
|---|---|---|
| **"What did this run do?"** | An ordered, typed event stream: event type, timestamp (UTC or explicit offset, per AU-8), actor identity, and a correlation chain tying request to attempt to tool call to provider call. This is what `ExecutionRecord` plus `correlation` already is, and what OTel span ids plus `gen_ai.tool.call.id` is. | **M** for the event and its ids. **R** for any human-readable rendering of it. |
| **"Did this run do anything outside its scope?"** | (a) the **grant in force at the time**, not the grant in force now - window, targets, authorised actions, constraints, and the digest of the evidence document the grant rests on; (b) the **decision** for each attempted action, with the parameters the decision was made on; (c) the **blocked** attempts, not only the allowed ones. A log recording only successes cannot answer "did it try". | **M** for all three. Nothing here is reconstructible: "the grant was once valid" is not the claim being audited. |
| **"Was this result produced by the code that exists?"** | The **input digest**: repo revision, and a content digest of every source the analysis read. `CoverageReceipt.seedSha256` plus `scannedFileSha256` is exactly this; SARIF's run properties seed-universe digest is the same idea in a standard's vocabulary. | **M** for the digests - they are of a tree that will change. **R** for re-running against a recorded revision. |
| **"Who approved this, and on what evidence?"** | The approver's identity, the **time** of approval, the **scope** approved, and a digest binding the approval to the artifact it was about. NIST AU-10 names this ("approving information", "digital signatures and digital message receipts"). `EvidenceRef.sha256` plus `signed_by` is the right shape, and the digest **must be checked at the moment of the action**. | **M**. An approval recorded after the fact is a claim, not evidence. |
| **"Did this effect happen twice?"** | An **effect key** derived deterministically from the logical action, the **claim** transition (not only the completion), and the key handed to the backend as an idempotency key. This is the one place where the *absence* of a record is the dangerous case: a claimed-but-uncommitted effect must be recorded as such and must default to not-retried. | **M.** Not reconstructible at all: the existing research's own measurement is that a read-back cannot reveal an in-flight write, and that agents self-report success in 90% of the episodes in which they duplicated an effect. |
| **"Did this run do everything it says it did?"** (the negative claim) | A **coverage receipt**: scope, every artifact read with its digest, which checks ran, which did not, and which artifacts could not be read. SARIF's Appendix I is the standard's version of the same thing and names three signals. The rule both sources state is identical: **an unreadable input is a gap, never a clean result.** | **M** for the enumeration of what ran. **R** for the digest-versus-current comparison. |

**The synthesis.** AU-3 gives six fields (what, when, where, source, outcome, identity); AU-10 adds the
approval binding; the SEC adds tamper-evidence, completeness verification and retrievability; SARIF and
Semgrep add stable identity and the coverage record. Collapsed to a harness-sized claim:

> **Record, at the moment of each action: a versioned schema id, a UTC timestamp with offset, an actor
> identity, the action and its parameters in digest form, the decision that authorised it together with
> the digest of the authority it rested on, an effect key, an outcome, and a correlation chain. Then
> record, per run, what was in scope and what could not be read. Everything else - the report, the diff,
> the summary, the human rendering - is a projection that can be rebuilt from those two things, and should
> be, because projections go stale and the record must not.**

**What can be reconstructed versus what cannot.** Nothing about *intent, authorisation or occurrence* can
be reconstructed. *Artefacts and their relationship to a run* can be, as long as the input digests were
taken. *Presentation* can always be rebuilt. This is the line: **the moment of action is the only moment
at which the authoritative facts exist, because it is the only moment at which the world agrees with the
record.**

### What a regulated vertical needs that a general harness would not otherwise record

1. **A log of the log** - modifications to and deletions of the record itself, with their date/time and
   the identity of whoever did it. SEC 17a-4(f)(2)(i)(A)(1)-(3). A general harness records *the action*;
   the rule records *the record of the action*, one level up.
2. **Re-creation of the original record after modification or deletion.** 17a-4(f)(2)(i)(A)(4). This is a
   reconstruction obligation, and it means the record cannot be a lossy projection.
3. **Automatic verification of the completeness and accuracy of the retention process.** 17a-4(f)(2)(ii).
   Not "we keep logs" but "we verify that we kept all of them".
4. **Retrievability on demand, in both human-readable and machine-usable form, together with the audit
   trail of the record.** 17a-4(f)(2)(iv) and (f)(3). A general harness's log is for a human debugging;
   this is an obligation to produce it *immediately* for a regulator, with its own audit trail attached.
5. **Redundancy.** 17a-4(f)(2)(v) - a backup recordkeeping system or equivalent redundancy capability, so
   that inaccessibility of the primary is not loss of the record.
6. **A retention clock with a tiered accessibility requirement** - "not less than 6 years, the first two
   years in an easily accessible place" (17a-4(a)); "at least six years" (FINRA 4511(b)); "at least six
   months" (AI Act Article 19). A design that deletes traces after 180 days, which is LangSmith's
   documented SaaS default, fails all three.
7. **A format-and-medium obligation as such.** FINRA 4511(c) makes the format itself a rule, which is why
   17a-4(f)(2)(i)(A) *or* (B) is a binary choice the harness must be able to state.
8. **A design-time obligation to be capable of logging for the system's lifetime**, before any incident
   and independent of it. EU AI Act Article 12(1). This is the one requirement that cannot be retrofitted.
9. **A written rationale for the event-type selection** - that the events chosen are adequate for
   after-the-fact investigation of an incident. AU-2(d). Harnesses choose what to log by what is cheap to
   emit; the control asks for a stated justification.
10. **A privacy limit, as a requirement rather than an aspiration** - AU-3(3): PII in audit records is
    limited to the elements identified in the privacy risk assessment. Note the direction: the control
    *caps* what is recorded, and the guidance names "the trail records inputs" as the risk.

### What should NOT be recorded, and why

1. **Prompt and completion content, by default.** OTel makes all of it `Opt-In` with a per-attribute
   warning that it is "likely to contain sensitive information including user/PII data", and states the
   gate: an explicit user opt-in such as `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`. The
   arguments are three, not one: (a) it is the largest payload in the system by orders of magnitude -
   OTel notes of `gen_ai.tool.definitions` that "since this attribute could be large, it's NOT
   RECOMMENDED to populate non-required properties by default"; (b) it is where the personal data is, per
   AU-3(3)'s guidance and the AI Act's own carve-out; (c) it is the most *useless* part of the record for
   audit, because it is the part a model can restate. **If it is recorded, it belongs behind an explicit
   opt-in and outside the identity function.** OpenInference's opposite default - record everything unless
   a hide flag is set - is the shape to reject.
2. **Secrets and credential material.** This repository already has the pattern
   (`sanitizeEvidenceReferences`, drop-by-default, with the docstring pointing at a future policy
   boundary), and it has the limitation: it filters **path-shaped references**, not payloads. A harness
   that records tool arguments verbatim will record tokens. The transferable technique is not the denylist
   - it is the effect ledger's choice to record an `argumentsDigest` rather than raw arguments, "so the
   key never carries payload".
3. **Model-generated prose inside any identity field.** Not "do not record it" - record it as the message,
   never hash it into identity. `evidence-sarif.ts`, SARIF Appendix B and Semgrep's `finding_hashes` all
   agree, and the failure mode is specific and expensive: every re-run becomes a wall of spurious new
   findings.
4. **Anything the diagnostic projection cannot reduce.** `projectExecutionDiagnostics` states the rule a
   harness should generalise: the query surface "deliberately drops arbitrary details so a diagnostic
   query cannot echo secrets or large logs." The *ledger* may hold more than the *projection*; the
   projection must be structurally incapable of emitting the sensitive part, not merely configured not to.
5. **Anything whose absence the record treats as silence.** LangSmith rejects runs past a per-trace cap -
   a bound is fine, provided the truncation is itself recorded. CloudTrail's digest files exist because
   "was a log file deleted" must be answerable. A silent bound is worse than no bound. The same rule
   applies to the tool-call gate itself: the existing research's finding that the gate must log its
   *invocation*, not only its decision, is this principle at the action layer rather than the record
   layer.

### What must be recorded but *not* reachable by the agent

The signing key, and the log. Anthropic's managed-agents write-up, recorded in the existing research,
makes the same point about credentials: the harness is never made aware of them. AU-9 requires audit
information and audit *tools* to be protected from modification by the system being audited, and a hash
chain whose key sits in the process the model controls is a decoration. This is also why CloudTrail puts
digest files in a **separate folder** from the log files: so that a different policy can govern them.

### Direct answer: is there a normative schema?

**No, not for agent activity - and the two candidates are both incomplete in the same direction.**

| Layer | Normative status | Reality |
|---|---|---|
| OTel GenAI semconv | A standards-body project in active development | Every GenAI span and attribute is `Development`; the conventions physically moved repositories in 2026-05 and the old pages now 404; the schema-URL mechanism is `TODO`; **zero** approval/permission/consent/audit vocabulary in 53k chars of registry. |
| OpenInference | A specification with BCP-14 normative keywords and a compliance definition | Single-vendor governance (Arize); **zero** approval/permission/consent/audit vocabulary in 70k chars; records content by default. |
| SARIF 2.1.0 / 2.2 draft | An OASIS standard with a **normative** appendix on fingerprints and result identity | Real and directly applicable - but it is about **findings in artifacts**, not actions taken by a system. |
| SARIF Appendix I / Semgrep CI results | Informative (SARIF) / published schema (Semgrep) | The right shape for "did this run cover what it claimed". |
| EU AI Act Arts 12, 19; SEC 17a-4(f); FINRA 4511 | Binding law | Specify **obligations and properties**, never a schema. Article 12 specifies events *by the purpose they serve*. |
| NIST SP 800-53 AU-2/3/8/9/10 | Normative control text, binding where adopted | The closest thing to a field list: what, when, where, source, outcome, identity, plus an approval binding, plus protection, plus non-repudiation. |
| LangSmith / Weave / Braintrust / Helicone | None | Vendor SDK shapes. |

The practical conclusion: **a harness that wants an auditable evidence plane is not choosing between
schemas; it is choosing which of the regulator's *properties* to implement, and it should emit OTel GenAI
attributes as the transport so that the existing tooling ecosystem can read it.** The layer that is
genuinely missing everywhere is the one this repository keeps writing: authority, approval, effect
identity, and coverage. That is not a gap in the standards that someone will fill for us soon - it is a
gap that the files in this directory have now independently bracketed from four directions.

---

## Could not verify

- **The body of OTel's content-capture policy.** `docs/gen-ai/gen-ai-spans.md` is larger than the fetch
  layer's 100,000-character cap, and the section sits past the cut. I confirmed it **exists** and know its
  exact headings from the document's own table of contents: *"Capturing instructions, inputs, and outputs"*
  with subsections *"Full (buffered) content"* then *"Recording content on attributes"* and *"Uploading
  content to external storage"*, plus *"Streaming chunks"*. I could not read its text. What I have instead
  is exact: the per-attribute `Opt-In` requirement levels, the per-attribute PII warnings, and one
  verbatim sentence about the gate mechanism. Methods tried: raw at `main` and at five historical commit
  SHAs; the opentelemetry.io `.md` and `index.md` endpoints (404 and a moved-stub); `read_page`; the
  sibling `gen-ai-events.md`. **This is the single largest hole in this file.**
- **SOC 2 Trust Services Criteria, in any form.** The AICPA serves a JavaScript application at the page
  tried; the PDF URL redirects to a domain the fetcher will not follow. **No criteria text was read.**
- **ISO/IEC 27001:2022 Annex A control text** (for example A.8.15 Logging, A.8.16 Monitoring activities).
  `iso.org` returns HTTP 403 behind Cloudflare for every path tried, and the standard is paywalled
  regardless. **I did not verify a single clause of ISO 27001.** Any claim in this project that "ISO 27001
  requires X of a log" is currently unsupported.
- **MiFID II RTS 6 (Commission Delegated Regulation (EU) 2017/589), DORA, and SEC Rule 15c3-5's logging
  provisions.** Not attempted in this pass, once the AI Act, 17a-4 and FINRA were in hand and the effort
  budget was finite. 15c3-5 is already cited in `gates-what-they-get-right.md`; I did not re-verify it.
  This is a **recorded gap, not a negative finding.**
- **Whether any trace vendor signs or chains its records.** No page read states that one does; none states
  that one does not. Their storage internals were not read.
- **Licences for `oasis-tcs/sarif-spec`, `github/codeql-action`, `semgrep/semgrep-interfaces`,
  `Arize-ai/openinference` and `in-toto/attestation`.** Not read. Do not assume permissive.
- **Braintrust's span schema.** No published schema page was found. The claim that their span object is
  SDK-defined is an inference from its absence in a 71,499-character documentation index.
- **The exact Semgrep source comment quoted in `src/core/evidence-sarif.ts`.** I verified the type
  definitions and the location-independence docstring in `semgrep_output_v1.atd`, which says the same
  thing in the same terms. I did **not** locate the specific comment the repository quotes.

---

## Caveats / Not Found

- **The EU AI Act text above is from a third-party mirror** (`artificialintelligenceact.eu`), not from
  EUR-Lex. The mirror is widely used but it injects definitions inline and it is not the official
  publication. The official text is Regulation (EU) 2024/1689, OJ L, 12.7.2024. EUR-Lex serves the
  consolidated act as a document far larger than the fetch cap, so article-level reading from the official
  source was not possible in this environment. Article numbering and the quoted sentences match the
  published regulation as far as this session could confirm.
- **NIST control text is from `csf.tools`,** a public rendering of NIST SP 800-53 Rev 5.2.0. The
  quotations match NIST's published control statements, but the authoritative source is NIST.
- **The 17 CFR text is from GPO's CFR XML**, authoritative for the 2024 annual edition, so amendments after
  it are not reflected. The 2022 electronic-recordkeeping amendments are in force and are reflected - the
  audit-trail option (f)(2)(i)(A) *or* WORM (f)(2)(i)(B) is the post-amendment shape.
- **Every claim about a trace vendor is documentation-only.** None of these products' storage, signing or
  deletion implementations was read. Statements such as "LangSmith deletes after 180 days" are the
  vendor's own documented behaviour, not an observation.
- **The zero-hit keyword results are keyword searches**, and are evidence about vocabulary, not about
  design. A convention can express a permission decision without using the word; what these results
  establish is that no attribute name carries one, which is the claim being made.
- **The finding that the evidence modules are wired is a grep result plus a call-site read**, not a
  runtime observation. `toSarifLog` is called from `src/capabilities/code-audit.ts:305`; whether that
  capability is reachable from a live entry point was **not** tested this session. The existing
  reachability analysis covered the `src/core` safety modules, not these.
- **Opinion, clearly marked.** My own view, from the sources rather than from the repository: the property
  worth adopting from section 4 is **rung 2, tamper-evidence, and specifically the CloudTrail shape** - a
  per-record digest plus a separately-stored, periodically-signed manifest of digests. It is the cheapest
  of the three rungs that buys anything, it is what makes *absence* detectable, and it is a hundred lines
  of code rather than infrastructure. Rung 3, external anchoring with RFC 9162-style inclusion proofs, is
  unnecessary for a harness whose auditor is the operator or a regulator with subpoena power, and adopting
  it now would be architecture ahead of need. What is *not* optional is the rung-0 discipline that
  `evidence-sarif.ts` and `receipt.ts` already practise: **derive identity from machine-stable inputs,
  version the derivation, and treat every unreadable input as a gap.**
