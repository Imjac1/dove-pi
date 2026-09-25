# Ground truth: community evidence that gates and sandboxes fail in production

- Query: Is there published evidence that permission gates alone are insufficient, and that
  sandboxing is the real boundary?
- Scope: community sources. **Evidence grade: title + meta-description only.** The article bodies
  are JavaScript-rendered, so the fetched pages contain metadata but not prose. Every claim below is
  quoted from a page's `<title>` or `og:description` / `name="description"` - i.e. the publisher's
  own summary, not a second-hand paraphrase. Treat as **named and real, but not yet read in full**.
- Date: 2026-09-25
- Salvaged from: `%TEMP%\community-wave\` (fetched by a community-wave sub-agent that had not yet
  written its report when this file was authored)

## 1. The findings

| # | Publisher | Title | Publisher's own summary (verbatim) |
|---|---|---|---|
| 1 | Ona | *How Claude Code escapes its own denylist and sandbox* | "How Claude Code bypassed **its own denylist and sandbox**, and why **kernel-level enforcement is the answer**." |
| 2 | Wiz | *GhostApproval: AI Coding Assistant Trust Boundary Flaw* | "Wiz Research uncovered GhostApproval, a trust boundary flaw affecting leading AI coding assistants that can **bypass human approval and enable code execution**." |
| 3 | Threat Research Center | *OpenAI Codex Sandbox Escape: Heapjack & Overpatch Vulnerabilities 2026* | "Critical analysis of the 2026 OpenAI Codex sandbox escape vulnerabilities (Heapjack & Overpatch) that enabled **remote code execution on developer systems** through AI agent exploitation." |
| 4 | Developers Digest | *Approval Fatigue Is an Agent Security Bug* | "**Manual approval prompts stop protecting users when coding agents ask too often.** The better pattern is **risk-aware autonomy**: safe defaults, narrow deny rules..." |
| 5 | Snyk | *How "Clinejection" Turned an AI Bot into a Supply Chain Attack* | "A prompt injection in a **GitHub issue title** gave attackers code execution inside Cline's CI/CD pipeline, leading to cache poisoning, stolen npm credentials, and an unauthorized package publish affecting the popular AI coding tool's **5 million users**." |
| 6 | Zero Hunt | *Cursor DuneSlide (CVE-2026-50548/50549): Prompt Injection Is Now Remote Code Execution* | "DuneSlide turns two Cursor IDE sandbox flaws into **zero-click RCE** via prompt injection - a **poisoned web result or MCP server** takes over a developer's machine." |
| 7 | Embrace The Red | *GitHub Copilot: Remote Code Execution via Prompt Injection (CVE-2025-53773)* | "...an important, but also scary, prompt injection discovery that leads to **full system compromise of the developer's machine**..." |
| 8 | Checkpoint | *OpenAI Codex CLI Vulnerability: Command Injection* | "Codex CLI **automatically loads and execute[s] MCP entries** withoug[t]..." |
| 9 | Simon Willison | *The lethal trifecta for AI agents: private data, untrusted content, and external communication* | (title only; body partially retrieved) |
| 10 | arXiv 2509.05755v5 | *Red-Teaming Coding Agents from a Tool-Invocation Perspective: An Empirical Security Assessment* | (academic empirical assessment) |
| 11 | Cognition (via `cog.txt`) | *Don't Build Multi-Agents* | "**Frameworks for LLM Agents have been surprisingly disappointing.** I want to offer some principles for building agents based on our own trial & error..." |
| 12 | Langfuse | *Comparing Open-Source AI Agent Frameworks* (2026) | Compares LangGraph, OpenAI Agents SDK, Claude Agent SDK, Google ADK, Pydantic AI, CrewAI, Strands Agents, Mastra, Vercel AI SDK, Microsoft Agent Framework |

## 2. What this settles

**Open decision #3 in `design.md` is answered: yes, and abundantly.**

Four independent publishers document gates and sandboxes being defeated in production coding agents,
and two of them target the *approval* layer specifically:

| Layer that failed | Evidence |
|---|---|
| Denylist (static rules) | Ona: Claude Code "bypassed its own denylist" |
| Sandbox (process isolation) | Ona (same); Threat Research Center: Codex sandbox escape -> RCE; Zero Hunt: Cursor sandbox flaws -> zero-click RCE |
| **Human approval** | **Wiz GhostApproval: "can bypass human approval and enable code execution"** |
| **The human's attention** | **Developers Digest: "Manual approval prompts stop protecting users when coding agents ask too often"** |

### Consequences for the design

1. **Sandboxing is not one seam among three; it is the control of last resort.** Ona's own conclusion
   is that *"kernel-level enforcement is the answer"*. A permission gate inside the same trust domain
   as the agent cannot be the final boundary.
2. **Per-action human approval is not merely non-conformant for pentest (NIST ROE) - it degrades.**
   "Approval fatigue" means a prompt-everything design trains the operator to approve. This is a
   *security* argument for the contract-conformance gate, independent of the compliance argument.
3. **MCP servers and web results are code-execution vectors.** DuneSlide: *"a poisoned web result or
   MCP server takes over a developer's machine."* Codex CLI: *"automatically loads and execute[s] MCP
   entries."* So the framework's tool surface is an attack surface, and MCP - which has no
   in-protocol approval boundary - is the least constrained part of it.
4. **The entry vector can be a non-code channel.** Clinejection: a prompt injection in a **GitHub
   issue title** produced CI/CD code execution and a package publish to 5M users. Context admission
   therefore cannot be limited to tool results.
5. **The "reduce abstraction / don't build multi-agent" community position exists and is load-bearing.**
   Cognition's *Don't Build Multi-Agents* states flatly that agent frameworks "have been surprisingly
   disappointing". This is the strongest available counterweight to the framework-buying option and
   it is **not yet read in full**.

## 3. What is NOT answered by this corpus

- ~~No duplicate-effect production incident was found.~~ **SUPERSEDED.** This was an artifact of
  the metadata-only corpus: the two files searched for the topic were search-result pages. The
  community agent then **read the bodies** and found measured evidence - see
  `community-security-and-critique.md` and the LIMBO study (arXiv 2609.29095) now recorded in
  `design.md` §5.2: duplicate rates of **56% and 74%** when an immediate read-back cannot reveal
  what happened, and shipped frameworks violating their own stated resume contracts.
  **What is still true:** no *named company* double-charge/double-order incident was found. The
  evidence is controlled measurement, framework contract violations, near-misses, and tooling-market
  signals - not a named production incident. Do not claim one.
- The `idempotent AI agent retry-safe patterns` source returned a Cloudflare interstitial
  (`Just a moment...`), so the retry-safety community position was **not retrieved**.

## 4. Corpus quality note (important for trusting this file)

Of 24 files salvaged from `%TEMP%\community-wave\`:

- **3 are block pages** (Cloudflare "Attention Required", "Just a moment...") - these carry no content.
- **~14 are JS-rendered shells** at exactly ~100,000 characters - truncated, with metadata but no body.
- **2 are search-result pages** for a query that returned no source.
- **1 is a 403 Forbidden page.**

So the corpus is **metadata-rich and body-poor**. Everything in section 1 is real and correctly
attributed, but **no article body has been read**. Upgrading these to full-text evidence requires
fetching them with a JS-capable client (the `agent-browser` skill exists for exactly this).

## Caveats / Not Found

- Every row in section 1 is a publisher's own summary. None is independently verified beyond the
  page existing with that title and description.
- CVE numbers seen: `CVE-2026-50548`, `CVE-2026-50549` (Cursor DuneSlide), `CVE-2025-53773`
  (GitHub Copilot). The NVD page for CVE-2026-50548 returned an empty SPA shell, so the CVE records
  themselves were **not read**.
- Dates are as printed by the publishers; not independently confirmed.
- The arXiv paper (2509.05755v5) is the only peer-reviewable item and its body was not read.
