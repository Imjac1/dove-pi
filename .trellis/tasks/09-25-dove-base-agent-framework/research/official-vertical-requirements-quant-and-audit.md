# Research: official/primary requirements - quantitative trading and code auditing

- Query: What do regulators, standards bodies, and first-party tool docs require of an
  automated system in these two verticals?
- Scope: official / primary sources only
- Date: 2026-09-25

## Method note (honest status)

The research sub-agent assigned to this file fetched extensively but **terminated without
writing its output**. Its downloads were salvaged from `%TEMP%\dove-research\`:

```
fr-15c3-5.txt            299 KB   SEC Rule 15c3-5 full Federal Register text
rule613.html              90 KB   (FINRA/exchange rule 613 area)
rts6-cellar.html         507 KB   MiFID II RTS 6
rts6-art{5,9,12,13,17}.html        RTS 6 articles
cfr17vol3.xml            6.0 MB   CFR Title 17
regsci-100{0,1,4,5}.html          Reg SCI
binance-rest-api.md      181 KB   Binance REST API
binance-ws.md            277 KB   Binance WebSocket
binance-fix.md           168 KB   Binance FIX API
binance-filters.md        14 KB   Binance symbol filters
binance-errors.md         20 KB   Binance error codes
binance-apikey.md        3.2 KB   Binance API-key semantics
bybit-{intro,create-order}.html   Bybit order API
sarif-schema.json        116 KB   OASIS SARIF JSON schema
sarif-spec.html          1.6 MB   OASIS SARIF specification
semgrep-{cli-ref,rule-syntax,json-sarif}.html
semgrep-llms.txt
codeql-{dbcreate,dbanalyze,analyze,packs}.html
gh-sarif-support.html
slsa-provenance.html      61 KB
intoto-statement.md      2.5 KB
```

This file was then written by the main session from those local artifacts, with targeted
extraction. Extraction status is marked per claim.

---

# Part A: quantitative trading

## A1. SEC Rule 15c3-5 - the controls are legally mandated, not best practice [extracted]

Source: `fr-15c3-5.txt` (Federal Register text of Rule 15c3-5, "Risk Management Controls for
Brokers or Dealers With Market Access"). Effective 2011-01-14, compliance 2011-07-14.

Verbatim, the operative requirement:

> The required financial risk management controls and supervisory procedures must be reasonably
> designed to **prevent the entry of orders that exceed appropriate pre-set credit or capital
> thresholds, or that appear to be erroneous**. The regulatory risk management controls and
> supervisory procedures must also be reasonably designed to **prevent the entry of orders
> unless there has been compliance with all regulatory requirements that must be satisfied on a
> pre-order entry basis**, prevent the entry of orders that the broker or dealer or customer is
> restricted from trading, **restrict market access technology and systems to authorized
> persons**, and assure appropriate surveillance personnel receive **immediate post-trade
> execution reports**.

Verbatim, on control ownership:

> The financial and regulatory risk management controls and supervisory procedures required by
> Rule 15c3-5 must be **under the direct and exclusive control of the broker or dealer with
> market access**...

Verbatim, on why pre-trade placement matters:

> The Commission believes that risk management controls and supervisory procedures that **are not
> applied on a pre-trade basis** or that, with certain limited exceptions, are not under the
> exclusive control of the broker-dealer, **are inadequate** to effectively address the risks of
> market access arrangements...

Verbatim, on the failure mode being addressed:

> the submission of **erroneous orders as a result of computer malfunction or human error**

Verbatim, on the audit obligation:

> establish, document, and maintain a system for **regularly reviewing the effectiveness** of the
> risk management controls and supervisory procedures and for promptly addressing any issues...
> review, no less frequently than annually... and **document that review**... the Chief Executive
> Officer (or equivalent officer) will be required, on an annual basis, to **certify** that the
> risk management controls and supervisory procedures comply with Rule 15c3-5...

Also documented in the same release, as the practice the rule was written against:

> the broker-dealer providing sponsored access may not utilize any pre-trade risk management
> controls (i.e. ``unfiltered'' or ``naked'' access)... and thus could be unaware of the trading
> activity occurring under its market identifier and have no mechanism to control it.

### What this establishes for the base framework

1. **Pre-execution, parameter-level blocking controls on order entry are a legal requirement** in
   the US market-access context. "The model advised against it" is not a control.
2. **The controls must be under the operator's exclusive control**, not delegated to a third
   party. This is the strongest possible external argument for the "own your gate" conclusion
   reached from the framework survey.
3. **Restricting access to authorized persons** is itself one of the mandated controls.
4. **Immediate post-trade reporting** to surveillance personnel is mandated, which means the
   evidence trail has a required latency property, not just a required existence property.
5. **Annual documented effectiveness review plus officer certification** means the audit artifact
   must be produced by a human-accountable process, not only by logs.

## A2. Exchange-level mechanics: idempotency and rate limits [extracted]

Source: `binance-errors.md`, `binance-filters.md`.

- **Client order ID is the idempotency key, and the venue rejects duplicates.** The error table
  entry reads: `"Duplicate order sent." | The \`clOrdId\` is already in use.`
  So a resubmission with the same client order ID is detected by the exchange rather than
  silently double-executing - **but only if the framework actually sends a stable client order ID**.
- **Rate limits are enforced per order and per connection**, with distinct errors:
  *"Too many new orders; current limit is %s orders per %s"*, *"Too many requests queued."*,
  *"Too many concurrent connections; current limit is '%s'."*,
  *"Too many connection attempts for account; current limit is %s per '%s'."*
- Symbol filters (`binance-filters.md`) constrain order size/price granularity - i.e. the venue
  rejects malformed orders, but only *after* they are submitted.

### What this establishes

The venue gives you **at-least-once protection against duplicate orders via the client order ID**,
and **nothing else**. Price/size validity, credit limits, restricted instruments, and "appears to
be erroneous" are all pre-trade obligations on the client side. That is exactly the control set
Rule 15c3-5 requires and that no surveyed agent framework provides.

## A3. MiFID II RTS 6 [downloaded, NOT extracted]

`rts6-cellar.html` (507 KB) and the per-article HTML files were downloaded but the HTML did not
yield extractable text with a simple tag strip. **Unverified in this file.** The expected content
(kill functionality, pre-trade limits, testing, record-keeping for algorithmic trading) must not
be cited until extracted properly.

## A4. Exchange API material also downloaded but not extracted

`bybit-intro.html`, `bybit-create-order.html`, `binance-rest-api.md`, `binance-ws.md`,
`binance-fix.md`, `binance-apikey.md`, `rule613.html`, `regsci-100*.html`, `cfr17vol3.xml`.

---

# Part B: code auditing

## B1. SARIF: the fields that make a finding reproducible [extracted]

Source: `sarif-schema.json` (OASIS SARIF JSON schema). Verbatim field descriptions:

| Field | Verbatim description | Why it matters |
|---|---|---|
| `fingerprints` | "A set of strings **each of which individually defines a stable, unique identity** for the result." | A hard identity - the same finding keeps the same key across runs. |
| `partialFingerprints` | "A set of strings that **contribute to** the stable, unique identity of the result." | A soft/partial identity when the hard one is unavailable. |
| `correlationGuid` | "A **stable, unique identifier for the equivalence class of logically identical results** to which this result belongs, in the form of a GUID." | Groups logically identical findings - the deduplication primitive. |
| `baselineState` | "The state of a result relative to a baseline of a previous run." enum: `new \| unchanged \| updated \| absent` | Turns two runs into a diff. This is how "what did this audit change?" is answered. |
| `occurrenceCount` | "A positive integer specifying the number of times this **logically unique** result was observed in this run." | Collapses repeated hits into one finding with a count. |
| `rank` | "A number representing the priority or importance of the result." (-1.0 to 100.0, default -1.0) | Severity is a first-class field, not a string convention. |

**What this establishes**: a code-audit agent's output contract is already standardized. The
reproducibility requirement is concrete and testable: the same finding must produce the same
`fingerprints`/\`partialFingerprints\`, and a re-run must be expressible as
`baselineState` transitions (`new`/`unchanged`/`updated`/`absent`). An agent framework that
produces prose findings instead of SARIF-shaped results cannot be diffed, deduplicated, or
audited.

## B2. Semgrep emits SARIF natively [extracted]

Source: `semgrep-cli-ref.html`: the CLI has `--sarif` ("Output results in SARIF format") and
`--sarif-output = VAL` ("Write a copy of the SARIF output to a file or post to URL").

## B3. CodeQL, SLSA, in-toto [downloaded, NOT extracted]

`codeql-dbcreate.html`, `codeql-dbanalyze.html`, `codeql-analyze.html`, `codeql-packs.html`,
`gh-sarif-support.html`, `slsa-provenance.html`, `intoto-statement.md` were downloaded but not
extracted. **Unverified in this file.**

---

# Cross-vertical table

| Vertical | Irreversible action | Required pre-action control (sourced) | Required evidence artifact (sourced) |
|---|---|---|---|
| Quant trading | order entry | pre-set credit/capital threshold check, erroneous-order rejection, restricted-instrument block, authorized-person restriction - **all pre-trade, under exclusive operator control** (SEC 15c3-5) | immediate post-trade execution reports; documented annual effectiveness review with officer certification (SEC 15c3-5) |
| Quant trading | order resubmission after retry/resume | stable client order ID so the venue can reject duplicates (Binance error table) | exchange ack/reject per submission |
| Code auditing | publishing a finding | not applicable (findings are reversible) | SARIF result with stable `fingerprints`/`partialFingerprints`, `correlationGuid`, `baselineState`, `occurrenceCount`, `rank` (OASIS SARIF schema) |
| Penetration testing | see `official-vertical-requirements-pentest.md` | pending | pending |

## The asymmetry worth noticing

Quant trading is the only vertical where the required controls are **legally mandated and
externally audited**. Code auditing's requirement is a **data format** that makes results
diffable. Penetration testing's requirement (pending) is expected to be about authorization and
scope. All three point the same way - the framework needs a pre-action control plane and a
machine-readable evidence plane - but only trading makes it non-negotiable by law.

## Caveats / Not Found

- **RTS 6 and the Bybit/CodeQL/SLSA/in-toto material are downloaded but not extracted.** They
  must not be cited until read.
- The sub-agent that fetched this material **failed to write its file**; this file is a recovery
  written by the main session. Coverage is therefore uneven: the quant side is well extracted,
  the audit side is partly extracted, and the pentest side is a separate file.
- No primary source was found (in the extracted material) that states a required **audit-log
  schema** for agent decisions. SEC 15c3-5 requires the review and certification, not a format.
- SEC 15c3-5 governs broker-dealers with market access. The user is not necessarily a
  broker-dealer, so the rule is **evidence of what the domain requires**, not a direct legal
  obligation on this project. That distinction matters and should not be blurred.
