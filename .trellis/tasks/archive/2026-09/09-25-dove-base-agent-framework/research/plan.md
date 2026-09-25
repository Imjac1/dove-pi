# Research Plan

- Task: `09-25-dove-base-agent-framework`
- Date: 2026-09-25
- Owner: main session; executed by research sub-agents

## Waves

1. **Official sources** (in flight) - first-party docs of the major agent
   frameworks, SDKs, and protocols. No blog posts, no opinion pieces.
2. **Community sources** - production experience, critiques, anti-patterns,
   benchmark papers. Dispatched only after wave 1 lands, so wave 2 can argue
   against a concrete taxonomy instead of inventing one.

## Must-answer questions

- **Q1 Agent workflow patterns**: the recognized pattern set, which patterns are
  load-bearing for long-running / safety-gated / evidence-producing work, and which
  are decorative.
- **Q2 Agent framework form**: what shape a framework takes (who owns the loop,
  graph vs message loop, single vs multi-agent, code-first vs config-first,
  protocol interop), and where the extension seam sits.
- **Q3 Vertical requirements**: what quantitative trading, penetration testing, and
  code auditing each need that a generic framework lacks, and what is genuinely
  shared across all three.

## Wave 1 assignments

| File | Scope |
|---|---|
| `official-workflow-patterns.md` | Anthropic official corpus: Building effective agents, Effective context engineering, Claude Agent SDK, Agent Skills spec, MCP spec |
| `official-framework-forms-openai-google-microsoft.md` | OpenAI Agents SDK, Google ADK, A2A protocol, Microsoft AutoGen / Semantic Kernel / Agent Framework |
| `official-framework-forms-graph-runtime.md` | LangGraph (state machine, checkpointers, interrupts), MCP enforcement boundary, local runtime-layer options `@earendil-works/pi-agent-core` and dsh/Cordis |
| `official-vertical-requirements-quant-and-audit.md` | Quant trading: SEC 15c3-5, FINRA/MiFID II RTS 6, exchange API mechanical guarantees. Code audit: Semgrep, CodeQL, SARIF spec |
| `official-vertical-requirements-pentest.md` | PTES, NIST SP 800-115, OWASP WSTG, NIST SP 800-53 controls; Metasploit RPC / Burp / Nmap official APIs |

## Verification of wave 1

The main session independently fetches the primary source of each agent's most
decision-critical claim, so the agent output can be checked against ground truth rather
than trusted. Baseline so far:

| File | Source | Purpose |
|---|---|---|
| `ground-truth-anthropic-building-effective-agents.md` | anthropic.com (fetched HTTP 200) | Verbatim pattern taxonomy, caveats, and the "reduce abstraction layers" production guidance |


## Wave 2 assignments (planned)

| File | Scope |
|---|---|
| `community-workflow-patterns.md` | Production experience, anti-patterns, abandoned-workflow evidence, evaluation practice |
| `community-framework-critique.md` | Independent critiques and comparisons of the frameworks surveyed in wave 1 |
| `vertical-requirements.md` | What quant trading, pentest, and code audit agent systems actually require |

## Output contract

Every file records: Query, Scope, Date, Findings with source URLs and versions,
Caveats / Not Found. Claimed behavior must cite a URL; unverifiable claims are
labelled as such.