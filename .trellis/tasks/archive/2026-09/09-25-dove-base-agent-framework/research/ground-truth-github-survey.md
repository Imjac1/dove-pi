# Ground truth: GitHub survey - frameworks and real vertical implementations

- Query: (a) What do 22 agent frameworks actually ship, source-read? (b) What do real
  implementations in the three verticals actually enforce, code-read?
- Scope: GitHub, source-level. **Main session verified the two most load-bearing citations by
  fetching the raw files directly.**
- Date: 2026-09-25
- Sources: `community-reusable-work-modes.md`, `community-github-real-implementations.md`, plus the
  framework survey delivered by message (22 repos).

## Part A - the framework survey (22 repos)

### A1. Health: five of the well-known ones are stale, frozen, gutted, or pivoted

| Repo | Stars | State |
|---|---|---|
| letta-ai/letta | 24,876 | **GUTTED.** README-only stub; source moved to `letta-ai/letta-code` in TypeScript; Python server retired to an `archive` branch |
| All-Hands-AI/OpenHands | 89,144 | **PIVOTED.** Now "Agent Canvas", a *host* for ACP-compatible agents. Python package and microagents 404 - **it no longer owns an agent loop** |
| microsoft/autogen | 61,154 | **STALE ~5.5 months** (last main commit 2026-04-06) while `microsoft/agent-framework` ships daily |
| openai/swarm | 22,010 | **FROZEN** (2026-04-15), superseded by `openai-agents-python` |
| Aider-AI/aider | 49,180 | stale ~4 months, 1.4k open issues |
| RooVetGit/Roo-Code | 24,296 | stale ~4.3 months - **despite having the cleanest declarative work-mode schema found** |
| SWE-agent | 20,399 | main stale; development moved off `main` |

**The lesson, in the surveyor's words: "Vendor the loop; depend on the protocol."** Two of the three
big harnesses moved out from under anyone depending on their internals, with >24k stars and daily
commits right up to the change.

### A2. Declarative work-mode artifacts: 7 exist; **none has an evidence contract or stop conditions**

| Repo | Artifact | Notable |
|---|---|---|
| microsoft/agent-framework | `AgentManifest` / `PromptAgent` YAML | The **only** artifact carrying a **declared per-tool approval policy**: `McpServerToolSpecifyApprovalMode{alwaysRequireApprovalTools, neverRequireApprovalTools}` |
| block/goose | `Recipe` (12 fields) **+ a separate `permission.yaml`** | `always_allow` / `ask_before` / `never_allow`. **The two-file split is the design to copy** |
| google/adk-python | `LlmAgentConfig` | **Now `@deprecated`** - ADK is migrating to reflection-loaded YAML |
| RooVetGit/Roo-Code | `modeConfigSchema` (Zod) | "the cleanest work-mode-as-data schema found": role + trigger + instructions + **permission groups with per-group `fileRegex`** |
| CrewAIInc/crewAI | `@CrewBase` YAML | `AgentConfig`/`TaskConfig`, all fields optional |
| SWE-agent | `config/default.yaml` | prompt templates + tool-bundle paths + registry variables |
| **Agent Skills `SKILL.md`** | adopted by **FOUR** surveyed repos independently (crewAI, agno, mastra, strands) | `allowed_tools` = "space-delimited list of pre-approved tools" - but **declarative-only; no loader enforces it** |

### A3. Smallest surface that owns the loop AND can block a tool call

**"The '200-line loop + real gate' combination does not exist in this survey."**

| System | Gate | Blocks pre-execution? |
|---|---|---|
| **strands-agents harness `interventions`** | `.cedar` policy file, natural-language rubric, HITL, or LLM classifier - resolved inside a library-owned loop; deny reason delivered as a typed tool result; **inherited by subagents so a delegate cannot bypass it** | **Yes** - the closest match found anywhere |
| agno | `@approval(type="required")` blocking approval | Yes |
| **openai-agents-python** | **`tool_guardrails.py` `reject_content`** - in-process pre-execution block; plus async `needs_approval` -> `RunState` | **Yes (in-process)** |
| goose | `permission.yaml` never_allow/ask_before | Yes |
| Roo-Code | `checkAutoApproval()` -> `{approve\|deny\|ask\|timeout}` | Yes |
| LangGraph | `interrupt()`, `Command(resume=)` | **node boundary only** |
| CrewAI | none found | No |
| smolagents | `interrupt_switch` cooperative flag | No |
| AutoGen | none found; `max_tool_iterations` **default 1** | No |
| SWE-agent | `review_on_submit_m` (prompt-level) | No |

**Verified by the main session:** `raw.githubusercontent.com/strands-agents/sdk-python/main/harness-py/src/strands_harness/interventions.py`
(4,312 bytes) and `.../openai/openai-agents-python/main/src/agents/tool_guardrails.py` (8,454 bytes)
both fetched and read. The OpenAI file contains verbatim:
`RejectContentBehavior` = *"Rejects the tool call/output but continues execution with a message to
the model."*

**=> Correction to `synthesis-01` section 2.3/2.5:** OpenAI's guardrails are no longer parallel-only.
The parallel caveat still holds for *input/output* guardrails; but `tool_guardrails` is a genuine
in-process pre-execution block.

### A4. Versioned resume: the best designs found

- **microsoft/agent-framework `WorkflowCheckpoint`**: `graph_signature_hash` (detects a changed
  orchestration graph), `previous_checkpoint_id` (explicit lineage), `version`, and
  `pending_request_info_events` (pending human requests survive). **The most explicit versioned-resume
  design in the survey.**
- **langgraph `libs/checkpoint-conformance/`**: the only repo treating the checkpoint store as a
  **specified, conformance-tested interface** across multiple backends.
- **pydantic-ai `durable_exec`**: `DurableOperationId`, `ModelRequestId`, `ToolsetCallToolId`, codecs
  (`IDENTITY_CODEC`/`JSON_CODEC`) - *"the closest thing in the survey to a replayable evidence record
  with correlated identities."*

## Part B - the vertical implementations (code-read)

### B1. HEADLINE: the three verticals need three different gate shapes

| Vertical | What actually exists | Gate shape |
|---|---|---|
| **Quant** | **No LLM trading agent blocks an order at a runtime boundary.** TradingAgents (108,565 stars) says orders go to a **SIMULATED** exchange and its "risk layer" is a `risk_debate_state` dict. ai-hedge-fund (63,745) is a backtester. Vibe-Trading's execution "model" is a `SKILL.md` document. **Real pre-trade blocking exists only in non-LLM engines**: nautilus_trader (29,389) `RiskEngine` with `TradingState::Halted` ("denies all new submit and modify commands"), `max_notional_per_order`, throttlers, `OrderDenied` events; freqtrade (54,780) `PairLocks.is_global_lock` | **Limit / threshold** |
| **Pentest** | Most mature. Five projects block at the tool boundary. Two document that prompt-only **already failed**: Dark-Moon `executor.py:203`, verbatim: *"pentest.md already forbade hydra, capped login attempts at 50... and the model still did it. **A rule that only lives in a prompt is a suggestion; this is the enforcement point.**"* Counter-example: **PentestGPT (15,589 stars, the most-cited open-source pentest agent) has a full tree scan returning ZERO enforcement files** - only a README disclaimer | **Scope conformance** |
| **Audit** | The control is **output identity**, and it is often absent. pr-agent (13,150) implements SHA-256 fingerprints + a persisted ACTIVE/RESOLVED baseline with reconciliation. open-code-review (41,155) emits real SARIF 2.1.0 with `partialFingerprints`. **anthropics/claude-code-security-review (6,270) has NO SARIF, NO fingerprint, NO baseline** - findings are brace-balanced out of prose | **Finding identity** (not a pre-action gate) |

### B2. Declarative authority contracts: exactly two exist, both pentest, zero in quant or audit

**(a) `cdxiaodong/cain-agent`** (962 stars, Apache-2.0) - `templates/scope.example.yaml`:
in_scope / out_of_scope YAML, **deny-first, default-deny**, **load-time validation that REFUSES TO
START on a malformed entry**, enforced by `ScopeGuardHook` at the PreToolUse stage returning
`permissionDecision: "deny"` with a reason. Its `scope.py` header states the design intent:
*"whether a target is authorized is enforced by engineering here, not left to the agent's own
judgement."*

**(b) `Armur-Ai/Pentest-Swarm-AI`** (2,611 stars, AGPL-3.0):
`ScopeDefinition{AllowedCIDRs, AllowedDomains, AllowedPorts, ExcludedCIDRs}` from `scope.yaml`,
**fail-closed on empty**; plus `programterms.Constraints` (`MaxRequestsPerSecond`,
`NoAutomatedScanning`, `NoBruteForce`, `NoDoS`, `NoSocialEngineering`, `NoPhysical`,
`DisallowedPaths`, `RequiredHeaders`) parsed from bug-bounty policy prose; plus **`scope diff` with
a non-zero exit on change - the scope contract is versioned and diffable.**

**Neither carries a time window or named authorized personnel**, both of which the NIST SP 800-115 ROE
template requires.

### B3. The most common failure: fail-open at the boundary

- `redcell` (317 stars) enforces scope correctly **but** `in_scope` returns `True` for an empty scope
  ("An empty scope is unrestricted by design") and `_command_scope_block` returns `None` when not
  `self.scope` - **a campaign started without scope has no gate at all.** Armur returns
  `ScopeViolationError` in the same state. **The cleanest fail-closed vs fail-open pair in the survey.**
- A single bypass flag defeats the gate: nautilus line 581 `if self.config.bypass { send_to_execution(...) }`.

### B4. Six directly actionable patterns

1. **Contract + PreToolUse-style hook is the cheapest working seam** - one validated YAML file plus one
   callback returning deny + reason. cain-agent is ~1 file for the contract, 1 for the hook.
2. **Fail closed on an unrepresentable boundary** - cain raises `ScopeConfigError` at load; Armur
   errors on empty scope. Make this a stated default.
3. **Log the gate's INVOCATION, not just its decision.** Armur's `ValidateAndLog` emits DEBUG on allow
   and WARN on deny, explicitly *"so that a future bug where a caller silently eats the error still
   shows up in the log stream."* **This is the defence against a gate that exists but is off the path.**
4. **A block should carry remediation, not just refusal** - Dark-Moon returns WHY plus "DO THIS
   INSTEAD" so the model does not retry the identical command.
5. **Finding identity must EXCLUDE model prose.** open-code-review's fingerprint is
   `sha256(Path|Category|ExistingCode)` with the comment *"not message.text, which is LLM prose that
   varies across runs"*, and the key is versioned (`ocrFinding/v1`). pr-agent uses
   `STATE_SCHEMA_VERSION=1` and OR-matches a body fingerprint against a code fingerprint because an
   LLM restates one defect two ways.
6. **Idempotency is a SEPARATE control from scope, and none of the surveyed pentest repos has one.**
   The closest is nautilus (`client_order_id` + `cache.order_exists` + venue duplicate rejection).
   This corroborates the ADK at-least-once warning: **the framework must own the key, not the tool.**

## Caveats / Not Found

- **`vxcontrol/pentagi` (24,951 stars, MIT, Go, active) is UNINSPECTED** - 58 MB repo, jsDelivr refuses
  >50 MB, GitHub API rate-limited. **The biggest open question in the pentest vertical.**
- GitHub code search needs auth and grep.app is behind a bot checkpoint, so discovery was
  repo-search plus tree-filtering: a control in an unhelpfully-named file could have been missed.
  **Absence claims are weaker than presence claims.**
- "Last commit" is `pushed_at` (any branch), not last default-branch commit.
- No repo was executed; every claim is a source read.
- Star counts are as reported by the sub-agents; the main session's own GitHub API calls were
  rate-limited (60/hr unauthenticated), so they were not independently re-verified.
