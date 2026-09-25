# Research: GitHub real implementations in the three target verticals

- Query: What do real, shipping agent projects in quant trading, penetration testing,
  and code auditing actually implement for pre-execution control, evidence, and scope?
- Scope: public GitHub repositories with real code and recent commits. Repo metadata read
  from the GitHub search API (stars / license / last push); control code read verbatim from
  raw.githubusercontent.com at the default branch on 2026-09-25.
- Date: 2026-09-25
- Method: GitHub search API for discovery, raw.githubusercontent.com for source,
  data.jsdelivr.com for file trees where the repo is under 50 MB.

## Method note (honest status)

- **GitHub core API rate limit (60/hr, shared IP) was exhausted mid-survey.** Per-repo
  metadata after that point comes from the **search API** result objects, which carry
  stargazers_count, license.spdx_id, pushed_at and language. "Last push" is therefore
  reported, not "last commit"; they are the same field GitHub displays but are not the same
  thing.
- **data.jsdelivr.com file-tree listings can be stale.** It listed
  /src/agents/risk_manager.py for virattt/ai-hedge-fund and omitted
  /cmd/opencodereview/sarif.go for alibaba/open-code-review; the first 404s on raw, the
  second exists. Every path cited below was confirmed by fetching the file.
- **vxcontrol/pentagi (24,951 stars) could not be inspected**: 58 MB repo (jsDelivr refuses
  over 50 MB) and the GitHub API was rate-limited. Its controls are NOT verified here.
- github.com HTML fetch is unreliable in this environment (transient "fetch failed") and
  truncates at 100 KB, which is past the point where GitHub's React tree payload appears.
- The parent's existing official-vertical-requirements-*.md files cover what the *standards*
  require. This file covers what *code* does. Where they disagree, that is the finding.

---

# Vertical 1: quantitative trading / financial agents

## V1.1 nautechsystems/nautilus_trader - real pre-trade gate, real kill switch

- 29,389 stars - LGPL-3.0 - Rust - last push 2026-09-25
- Connects to real venues (Rust core, adapters for many exchanges). This is the only
  surveyed repo whose risk checks are structurally between the strategy and the venue.

crates/risk/src/engine/mod.rs:

```rust
/// The `RiskEngine` provides pre-trade risk checks including order validation,
```

```rust
/// Sets the trading state for risk control enforcement.
///
/// [`TradingState::Halted`] denies all new submit and modify commands.
pub fn set_trading_state(&mut self, state: TradingState) {
```

```rust
let state_reason = match self.trading_state {
    TradingState::Halted => Some(OrderDeniedReason::TradingHalted.to_string()),
    TradingState::Reducing => Some(
        OrderDeniedReason::TradingStateReducing {
            order_side: order.order_side(),
            instrument_id: instrument.id(),
        }
        .to_string(),
    ),
    TradingState::Active => None,
};

if let Some(reason) = state_reason {
    self.reject_modify_order(&order, &reason);
    return false;
}
```

handle_submit_order (line 580) denies, before dispatch, on: reduce-only that would increase
the position, position-not-found, instrument-not-found, then check_order(...) and
check_orders_risk(...). Rate limits are separate Throttlers for submit and modify, emitting
OrderDeniedReason::RateLimitExceeded. Notional caps are per-instrument:
max_notional_per_order: AHashMap of InstrumentId to Decimal.

**Two caveats worth carrying into the base framework:**

1. Line 581: if self.config.bypass { Self::send_to_execution(TradingCommand::SubmitOrder(command)); return; }
   - a single config flag disables every check above.
2. The gate emits OrderDenied events rather than returning an error to the caller. The
   strategy learns it was blocked only by consuming the event stream.

## V1.2 freqtrade/freqtrade - protection policy enforced before entry

- 54,780 stars - GPL-3.0 - Python - last push 2026-09-24
- Real exchange trading. The pre-entry block is a **pair lock** checked in the entry path.

freqtrade/freqtradebot.py:817:

```python
if PairLocks.is_global_lock(side="*"):
    # This only checks for total locks (both sides).
    # per-side locks will be evaluated by `is_pair_locked` within create_trade,
    # once the direction for the trade is clear.
    lock = PairLocks.get_pair_longest_lock("*")
    if lock:
        self.log_once(
            f"Global pairlock active until "
            f"{lock.lock_end_time.strftime(constants.DATETIME_PRINT_FORMAT)}. "
            f"Not creating new trades, reason: {lock.reason}.",
            logger.info,
        )
    ...
    return trades_created
```

and per-pair at :876 (self.strategy.is_pair_locked(pair, candle_date=nowtime, side=signal)).

The locks are produced by freqtrade/plugins/protectionmanager.py from a **declarative config
list** (StoplossGuard, MaxDrawdown, CooldownPeriod, LowProfitPairs). This is the closest thing
quant has to a declarative control policy - but note its shape: it is a **threshold/trigger
configuration**, not an authority contract with an allow-set and a deny-set.

## V1.3 TauricResearch/TradingAgents - 108k stars, and risk is a debate

- 108,565 stars - Apache-2.0 - Python - last push 2026-09-25

README, verbatim:

> The Portfolio Manager approves/rejects the transaction proposal. If approved, the order will
> be sent to the **simulated exchange** and executed.

"Risk Management" is a set of LLM personas. In tradingagents/graph/trading_graph.py the risk
output is state, not a control:

```python
"risk_debate_state": {
    "aggressive_history": final_state["risk_debate_state"]["aggressive_history"],
    "conservative_history": final_state["risk_debate_state"]["conservative_history"],
    "neutral_history": final_state["risk_debate_state"]["neutral_history"],
    "history": final_state["risk_debate_state"]["history"],
    "judge_decision": final_state["risk_debate_state"]["judge_decision"],
},
```

tradingagents/agents/trader/trader.py produces a structured TraderProposal (entry price,
stop-loss, position sizing) - an LLM-authored number, not a checked limit.

**No position limit, no notional cap, no kill switch, no order idempotency key, no pre-trade
block anywhere in the repo.** The only "exchange" is a simulator.

## V1.4 virattt/ai-hedge-fund - 63k stars, proof of concept, no order path

- 63,745 stars - MIT - Python - last push 2026-09-24

README: "This is a proof of concept for an AI-powered hedge fund." Execution is
/src/backtesting/trader.py - a backtester. There is no order-submission surface to guard, so
there is nothing to gate. /src/agents/portfolio_manager.py and the risk-manager persona
produce decisions, not controls.

## V1.5 HKUDS/Vibe-Trading - 34k stars, risk as a skill document

- 34,022 stars - MIT - Python - last push 2026-09-25

Risk lives in prompt assets: /agent/src/skills/risk-analysis/SKILL.md,
/agent/src/swarm/presets/risk_committee.yaml. The only execution-named file in the tree is
/agent/src/skills/execution-model/SKILL.md - a **document describing** an execution model, not
an executor. There is a ccxt skill (exchange library access) with no corresponding gate.

### V1 verdict

Pre-trade blocking exists **only in the non-LLM execution engines** (nautilus, freqtrade).
Every LLM trading agent surveyed - including the 108k-star and 63k-star projects - **claims**
risk management and implements it as LLM debate, a persona, or a skill document, against a
simulator or backtester. There is no repo in this vertical that both drives an order with an
LLM and blocks it at a runtime boundary.

---

# Vertical 2: penetration testing / offensive security agents

## V2.1 cdxiaodong/cain-agent - the declarative authority contract (best example found)

- 962 stars - Apache-2.0 - Python - last push 2026-09-23

templates/scope.example.yaml is an **authority contract as a first-class artifact**. Translated
structure (the file is Chinese-commented):

```yaml
# Decision order: out_of_scope first (deny wins), then in_scope; neither matches -> deny.
#   - Format is validated at load time; an illegal entry errors out and startup is refused.
in_scope:
  - app.target-corp.com          # bare domain: matches itself and all subdomains
  - "*.api.target-corp.com"      # wildcard: subdomains only, never the apex
  - 203.0.113.10                 # bare IP == /32
  - 198.51.100.0/24
  - 2001:db8:1::/48

out_of_scope:
  - admin.app.target-corp.com    # production admin: never touch
  - 198.51.100.128/25            # excluded even though the parent /24 is authorised
  - mail.target-corp.com
```

Header comments state the semantics directly: **deny-first, default-deny, refuse to start on a
malformed entry**, and "any target not in in_scope is blocked by ScopeGuardHook at the
PreToolUse stage" (Chinese original: any target not in in_scope is directly blocked by
ScopeGuardHook at the PreToolUse stage).

src/cain_agent/scope.py implements it:

```python
class Scope:
    """Authorized-target whitelist with deny-priority default-deny semantics.
    ...
    Matching precedence is deny-first: an out_of_scope hit always denies, even
    when a broader in_scope entry would otherwise allow it. With no matching
    in_scope entry the target is denied (whitelist model).
    """
```

```python
class ScopeGuardHook:
    """PreToolUse hook: blocks tool calls whose target is outside scope.

    Matches the Claude Agent SDK HookCallback contract
    async (input_data, tool_use_id, context) -> dict[str, Any]. An allow is
    an empty dict (pass-through); a deny carries the SDK hookSpecificOutput
    deny decision.
    ...
    Network tools with no literal target (e.g. curl $URL) and
    unrecognized programs stay denied (default-deny).
    """
```

The deny path is explicit and carries a human-readable reason:

```python
@staticmethod
def _deny(reason: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
```

Load-time validation is fail-closed: ScopeConfigError is raised for a non-mapping config, a
non-string entry, an empty entry, leading/trailing whitespace, or embedded whitespace.

src/cain_agent/toolchain/readonly_guard.py adds a second, orthogonal control -
ReadonlyGuard.check(tool_name, args) with an ALLOWED_READONLY_TOOLS prefix allowlist (curl,
httpx, nuclei, nmap, subfinder, naabu, rustscan, ...) and a WRITE_PATTERNS denylist (-delete,
--remove, DROP pattern, put-object, upload, ...), plus a special case rejecting curl
POST/PUT/DELETE.

**This is the single most transferable finding in the survey.** It is a persisted,
schema-validated, deny-first authority contract enforced by a pre-execution hook whose deny
carries a reason string - which is exactly the PRD's acceptance criterion that "the block
reason reaches the model transcript".

## V2.2 Armur-Ai/Pentest-Swarm-AI - scope contract + executable allowlist + RoE parser

- 2,611 stars - AGPL-3.0 - Go - last push 2026-09-25

internal/scope/validator.go - the typed contract:

```go
// ScopeDefinition defines what targets are allowed.
type ScopeDefinition struct {
	AllowedCIDRs   []string `json:"allowed_cidrs"   yaml:"allowed_cidrs"`
	AllowedDomains []string `json:"allowed_domains" yaml:"allowed_domains"`
	AllowedPorts   []int    `json:"allowed_ports"   yaml:"allowed_ports,omitempty"` // empty means all ports allowed
	ExcludedCIDRs  []string `json:"excluded_cidrs"  yaml:"excluded_cidrs,omitempty"`
}
```

**This one is fail-closed on an empty scope** - the opposite of redcell (below):

```go
func Validate(target string, scope ScopeDefinition) error {
	if len(scope.AllowedCIDRs) == 0 && len(scope.AllowedDomains) == 0 {
		return &apperrors.ScopeViolationError{
			Target: target,
			Scope:  "<empty>",
			Detail: "scope has no allowed CIDRs or domains defined",
		}
	}
```

Command-level scanning, with the enforcement claim stated in the doc comment:

```go
// ValidateCommand extracts all IPs and domains from a command string and validates
// each against the scope. Returns ErrScopeViolation if any target is out of scope.
// This is called before every command execution - no exceptions.
```

Enforced in internal/agent/exploit/executor.go:195, ahead of any subprocess:

```go
	// 1. Scope validation - HARD STOP if fails.
	if !isBuiltinVerb(firstToken(step.Command)) {
		if err := scope.ValidateCommand(step.Command, *e.scopeDef); err != nil {
			return &pipeline.ExecutionResult{
				...
				Output:  fmt.Sprintf("BLOCKED: %s", err),
				Success: false,
				...
			}, fmt.Errorf("scope violation: %w", err)
		}
	}

	// 1b. Allowlist gate (#43) - when enabled, the LLM is only allowed
	// to invoke binaries that match a registered tool adapter. Blocks
	// shell wrappers (bash, sh -c, python -c) and arbitrary interpreters
	// that a prompt injection could try to reach as a bridge to RCE.
	if err := e.checkExecutableAllowed(step.Command); err != nil {
```

Note the ordering detail: the **cleanup command is validated by the same executable policy as
the primary command** (lines 237-241) and registered before execution. And there is an honest
documented hole: for built-in verbs the broad ValidateCommand scan is *skipped* because it
false-positives on JSON bodies, and the builtin does "its own precise scope check on the exact
host it contacts" - i.e. the safety net is not uniform.

Additional controls in the same executor: WithSafeMode rejects destructive tokens (rm, DROP,
TRUNCATE, kill, chmod, chown, shutdown) before execution; ConfirmFunc is a human y/N gate
"Called BEFORE every executed step (after scope + safe-mode pass)"; dryRun returns the command
without executing.

Two artifacts matter for the framework design:

- internal/scope/audit.go ValidateAndLog - wraps Validate so that **every** tool call emits a
  log line (DEBUG on allow, WARN on violation): "so that a future bug where a caller silently
  eats the error still shows up in the log stream." That is a deliberate answer to the "gate
  exists but nobody calls it" failure mode.
- internal/scope/programterms/programterms.go - parses a bug-bounty program's RoE **prose**
  into a machine-readable Constraints struct: MaxRequestsPerSecond, NoAutomatedScanning,
  NoBruteForce, NoDoS, NoSocialEngineering, NoPhysical, DisallowedPaths, RequiredHeaders,
  Notes. Its own doc comment is candid: "This is a heuristic parser - programs write their
  policies in prose, not in machine-friendly formats... over-extraction is worse than
  under-extraction here, because the wrong limit can either tank findings (too cautious) or get
  the researcher banned (too aggressive)."

cli/scope.go adds "scope diff <prev.yaml> <current.yaml>" with a non-zero exit code when scope
changed - **the scope contract is versioned and diffable**, which no quant or audit repo does.

## V2.3 martian56/redcell - real scope gate, fail-open default

- 317 stars - MIT - Python - last push 2026-09-18

packages/core/redcell_core/engine/scope.py opens with the intent:

```python
"""In-scope validation and a destructive-command denylist, enforced in code at the
tool boundary so a hallucinated or injected target can't be scanned/exploited and
an obviously destructive command can't run. Pure and unit-testable."""
```

It is genuinely careful about bypass encodings - integer/hex/octal IPv4 (2130706433,
0x7f000001, 017700000001), IPv6, host:port, URLs, user@host - and the destructive denylist
covers mkfs, dd with of=/dev/sd, redirect-to-block-device, fork bomb,
shutdown/reboot/halt/poweroff, chmod -R 000 on root, wipefs/shred, and a targeted rm -rf check
against a _WIPE_TARGETS set.

Enforced in the agent loop at engine/runner.py:667, before _exec, with the block reason written
back into the tool message the model sees:

```python
if cname == "run_command":
    cmd = cargs.get("command", "")
    if scope.is_destructive(cmd):
        await self._event(agent_name, "tool", f"blocked destructive command: {cmd[:80]}")
        messages.append({"role": "tool", "tool_call_id": call["id"], "name": cname,
                         "content": "blocked: the scope guardrail refused a destructive command"})
        continue
    if (blk := await self._command_scope_block(cmd)):
        messages.append({"role": "tool", "tool_call_id": call["id"], "name": cname,
                         "content": blk["error"]})
        continue
```

**The gap is the default.** in_scope is fail-open:

```python
def in_scope(target: str, scope: list[str] | None) -> bool:
    """True if target falls within scope. An empty scope is unrestricted by design
    (the UI documents this); a non-empty scope is enforced."""
    entries = [s.strip() for s in (scope or []) if s and s.strip()]
    if not entries:
        return True
```

and the command gate short-circuits on the same condition:
"if not self._kindspec.exploits or not self.scope: return None".

So an operator who starts a campaign without setting scope gets an agent with **no scope gate
at all**, and the only signal is UI copy. Compare Armur, where the same state is a hard
ScopeViolationError. This is the clearest fail-open/fail-closed contrast in the survey and a
direct input to the PRD's "the gate fails closed when a boundary cannot be represented."

Side finding: redcell ships engine/reporting/sarif.py - a pentest agent emitting SARIF, the
audit vertical's format, for its findings.

## V2.4 ASCIT31/Dark-Moon - prompt rules failed; the guard is the post-mortem

- 970 stars - GPL-3.0 - Python - last push 2026-09-25

mcp/src/execution_guard.py is the most valuable document in this vertical because it is a
written post-mortem of the exact failure this project is trying to avoid:

> A command that never returns therefore does not just fail, it freezes everything downstream
> - no more findings, no finalize, no report. That is how the 2026-08-03 IoTGoat campaign was
> lost: the model escalated to hydra -P rockyou.txt (14M candidates) and the executor, which
> accepted a timeout argument but never enforced it, waited forever.
>
> **Prompt rules alone do not prevent this. pentest.md already forbade hydra, capped login
> attempts at 50 and restricted wordlists to a 200-line allowlist, and the model still did it.
> So the rule is enforced here, where it cannot be argued with.**

And in mcp/src/tools/core/executor.py:203, at the call site:

```python
# Refuse commands that provably cannot finish, BEFORE burning the deadline
# on them. The agent prompts already forbid unbounded credential attacks and
# giant wordlists, and a model still ran hydra -P rockyou.txt (14M
# candidates) and froze a whole campaign for 72 minutes. A rule that only
# lives in a prompt is a suggestion; this is the enforcement point.
verdict = classify(command)
if verdict.blocked:
    return False, (
        f"[REFUSED: {verdict.label}] This command cannot complete and would "
        f"freeze the campaign.\n\nWHY: {verdict.why}\n\n"
        f"DO THIS INSTEAD: {verdict.instead}\n\n"
        "If two bounded attempts fail, record the vector as not-exploitable "
        "and move on. Abandoning a dead end is a correct outcome."
    )
```

validate_command also carries blocked_patterns (rm -rf, dd if=, mkfs, fork bomb, redirect to
/dev/sda, wget http) and an allowed_tools allowlist checked on shlex.split(command)[0].
Sandboxing is Docker (mcp/src/docker_client.py, timeout plumbing) - but note the guard exists
precisely because the *timeout* was not enforced, i.e. the sandbox boundary was not the control.

The refusal design is worth copying: the block returns **why it cannot run** and **what to do
instead**, explicitly so the model does not retry the identical command. That is the "block
reason reaches the transcript" requirement solved with a remediation payload.

## V2.5 GH05TCREW/pentestagent - scope tests + Docker sandbox

- 3,114 stars - MIT - Python - last push 2026-09-21

Scope logic is is_target_in_scope in pentestagent/workspaces/validation.py, and the repo ships
tests/security/test_scope_bypass.py - a dedicated **bypass test suite**:

```python
"""Security tests: scope validation bypass attempts.

These tests verify that an attacker cannot manipulate target validation
to reach out-of-scope hosts through edge cases in IP/CIDR comparison logic.
"""
...
    def test_zero_cidr_does_not_match_all(self):
        # /0 covers everything; candidate should only match if allowed list contains /0
        assert is_target_in_scope("8.8.8.8", ["192.168.1.0/24"]) is False

    def test_adjacent_cidr_does_not_bleed(self):
        # 192.168.2.1 is NOT in 192.168.1.0/24
        assert is_target_in_scope("192.168.2.1", ["192.168.1.0/24"]) is False
```

Sandboxing is a real container runtime, pentestagent/runtime/docker_runtime.py:

```python
@dataclass
class DockerConfig:
    """Docker runtime configuration."""

    image: str = (
        "pentestagent:latest"  # Built from Dockerfile (use pentestagent-kali:latest for Kali image)
    )
    container_name: str = "pentestagent-sandbox"
    network_mode: str = "bridge"
    cap_add: list = None
    volumes: dict = None
    environment: dict = None

    def __post_init__(self):
        if self.cap_add is None:
            self.cap_add = ["NET_ADMIN"]  # For VPN
```

Honest note: network_mode="bridge" plus NET_ADMIN is a container for tool convenience, **not
network isolation** - the container has outbound network access to whatever it likes, so the
container is not a scope boundary. The scope boundary is the Python validation above.

## V2.6 GreyDGL/PentestGPT - 15.6k stars, disclaimer only, zero enforcement

- 15,589 stars - MIT - Python - last push 2026-07-14

A full tree scan (154 files) filtered for scope/allow/target/sandbox/guard/policy/approv/
authoriz/consent/roe/rules-of-engagement/limit/safety/deny/blocklist/whitelist/kill returns
**only** .agents/skills/** authoring-skill files - no scope module, no target validation, no
sandbox, no approval gate.

The only authorization artifact in the repo is a README line:

> **Disclaimer**: This tool is for educational purposes and authorized security testing only.
> The authors do not condone any illegal use. Use at your own risk.

**This is a pure claim/code discrepancy at 15.6k stars**, and the single most-cited open-source
pentest agent. It is the strongest evidence that popularity is not a proxy for enforcement.

## V2.7 pikpikcu/airecon - scope as conversation heuristic, not contract

- 1,064 stars - MIT - Python - last push 2026-09-11

airecon/proxy/agent/loop_policy.py decides *conversational* questions:
should_preserve_active_target_for_subdomain, extract_wildcard_scope_target,
is_explicit_target_switch_request (matching "switch target", "move to", "ganti target"),
should_switch_active_target. There is a rate_limiter.py and a target_prioritizer.py.

The "scope" here is which target the agent is currently talking about - it is derived from the
user's message text, not from a persisted authority contract. There is nothing to validate a
tool call against. This is a distinct failure mode from PentestGPT's: the concept exists, but as
conversation state rather than as an enforceable boundary.

### V2 verdict

This is by far the most mature vertical for pre-execution control. Five of eight repos implement
a real block at the tool/executor boundary, two of them document in their own source comments
that the prompt-only version had already failed in production, and two treat scope as a
persisted declarative artifact (cain-agent, Armur). The dominant residual gaps are **default
posture** (redcell fails open) and **uniformity** (Armur's builtin verbs skip the broad scan;
the Docker "sandbox" is not a network boundary).

---

# Vertical 3: code auditing / security review agents

## V3.1 The-PR-Agent/pr-agent - fingerprints + persisted finding state

- 13,150 stars - MIT - Python - last push 2026-09-25 (repo was codium-ai/pr-agent)

pr_agent/algo/inline_comment_dedup.py header, verbatim:

> Implements the feature requested in issue #2037: when the agent runs more than once on the
> same PR/MR, it re-posts identical inline suggestions on every run, cluttering the discussion
> (observed in particular on GitLab). This module fingerprints each inline comment and embeds
> the fingerprint as an HTML-comment marker in the posted body. On later runs the existing
> comment bodies are scanned for those markers to rebuild the set of already-posted
> fingerprints, and any suggestion whose fingerprint is already present is skipped.
>
> Two fingerprints are computed per comment and matched with OR semantics:
>
> - Body fingerprint: SHA-256 over (relevant_file, anchor line, normalised body)...
> - Code fingerprint: SHA-256 over (relevant_file, anchor line, normalised contents of the
>   first suggestion fenced block)...
>
> The OR-match catches both "same prose, different code" and "same code, different prose"
> re-emissions of the same defect, which are the two ways an LLM tends to restate a finding
> across runs.
>
> **The feature is opt-in via config.persistent_inline_comments (default false)**...

The fingerprint primitives:

```python
def key_issue_fingerprint(relevant_file: str, body: str) -> str:
    key = f"{relevant_file}|{body}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]

def key_issue_location_fingerprint(fingerprint: str, start_line: int, end_line: int) -> str:
    key = f"{fingerprint}|{start_line}|{end_line}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
```

pr_agent/algo/review_finding_state.py is the **baseline-diff mechanism**, and it is the closest
analogue in this survey to SARIF's baselineState:

```python
"""Persist review finding state across runs."""

STATE_SCHEMA_VERSION = 1
DEFAULT_MAX_RESOLVED_FINDINGS = 20
_STATE_MARKER_RE = re.compile(
    r"<!-- pr-agent-review-state:v(?P<version>\d+)\n(?P<payload>.*?)\n-->",
    re.DOTALL,
)
_VALID_STATES = {"ACTIVE", "RESOLVED"}

@dataclass(frozen=True)
class ReconciliationResult:
    state: dict[str, Any]
    changed: bool
    resolved_ids: tuple[str, ...]
    reopened_ids: tuple[str, ...]
```

normalize_finding derives the stable identity, deliberately normalising prose so re-wrapping
does not create a new finding:

```python
# The fingerprint ignores whitespace so re-wrapped prose stays the same finding, but the
# body is what the resolved section renders, so it keeps the line breaks the reviewer used.
finding_id = key_issue_fingerprint(path, _WHITESPACE_RE.sub(" ", body).lower())
```

State is carried between runs **inside the PR body as an HTML-comment marker**, so it needs no
external store. Trade-off worth noting for the base framework: the evidence lives in the
artifact under review, which means a force-push or a body edit can destroy the baseline.

## V3.2 alibaba/open-code-review - real SARIF v2.1.0, prose-independent fingerprints

- 41,155 stars - Apache-2.0 - Go - last push 2026-09-24

cmd/opencodereview/sarif.go is a genuine SARIF 2.1.0 emitter (12.8 KB). The fingerprint design
is the notable part:

```go
const (
	sarifSchema         = "https://json.schemastore.org/sarif-2.1.0.json"
	sarifVersion        = "2.1.0"
	sarifToolName       = "OpenCodeReview"
	sarifInformationURI = "https://github.com/alibaba/open-code-review"
	sarifFingerprintKey = "ocrFinding/v1"
)
```

```go
// The fingerprint is based on Path + Category + ExistingCode (not message.text,
// which is LLM prose that varies across runs). This allows GitHub Code Scanning
// to track the same alert across runs instead of closing and reopening it.
//
// When ExistingCode is empty (common for findings without a fix suggestion),
// falling back to StartLine prevents fingerprint collisions between same-file,
// same-category findings that would otherwise produce identical hashes.
func sarifFingerprints(c model.LlmComment, category string) map[string]string {
	var fingerprintSource string
	if code := strings.TrimSpace(c.ExistingCode); code != "" {
		fingerprintSource = c.Path + "|" + category + "|" + code
	} else {
		fingerprintSource = c.Path + "|" + category + "|" + strconv.Itoa(c.StartLine)
	}
	h := sha256.Sum256([]byte(fingerprintSource))
	return map[string]string{sarifFingerprintKey: hex.EncodeToString(h[:])}
}
```

Note the keyed partialFingerprints map ("ocrFinding/v1"), which is the versioned identity the
SARIF spec expects, and the explicit reasoning about *why* prose must be excluded from identity.

**The gap is dedup.** Dedup in the scan loop is an **LLM task**, not a hash:

```go
// SkipDedup disables the per-batch DEDUP_TASK even when the template
// defines one. Set via the --no-dedup CLI flag.
SkipDedup bool

func (a *Agent) dedupEnabled() bool {
	return !a.args.SkipDedup && a.args.Template.DedupTask != nil && len(a.args.Template.DedupTask.Messages) > 0
}
```

So the *output identity* is deterministic but the *de-duplication decision* is model-driven and
therefore not reproducible run-to-run. scanItemFingerprint is used for resume, not for dedup.

## V3.3 anthropics/claude-code-security-review - findings as prose JSON, no baseline

- 6,270 stars - MIT - Python - last push 2026-02-11

The official Anthropic security-review GitHub Action. Findings are recovered from model output
by brace-balancing over arbitrary text:

```python
def extract_json_from_text(text):
    """
    Extract JSON object from text, looking in various formats and locations.
    ...
    """
    # First, try to extract JSON from markdown code blocks (with or without language tag)
    json_matches = [
        re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL),
        re.search(r'```\s*(\{.*?\})\s*```', text, re.DOTALL)
    ]
    ...
    # Find all potential JSON objects (looking for balanced braces)
```

False positives are reduced by claudecode/findings_filter.py: a HardExclusionRules class of
compiled regexes (DoS claims, rate-limiting claims, resource-leak claims, ...) followed by an LLM
pass, reported through a FilterStats dataclass (total_findings, hard_excluded, claude_excluded,
kept_findings, exclusion_breakdown, confidence_scores).

**There is no SARIF emitter, no fingerprint, no cross-run state, and no baseline.** A finding
from this action cannot be given a stable identity, so it cannot be diffed across runs, and "is
this the same issue we saw last week?" is unanswerable. It also has no findings.json schema in
the tree - the shape is defined by the prompt.

## V3.4 semgrep/semgrep - the reference deterministic producer

- 16,760 stars - LGPL-2.1 - push 2026-09-25

Not an agent, included as the contrast case and the de-facto format authority: Semgrep's CLI
emits SARIF natively (--sarif, --sarif-output), with rule-id-based deterministic results, so its
output is stable and diffable by construction. The parent's
official-vertical-requirements-quant-and-audit.md already establishes the SARIF fingerprints /
partialFingerprints / correlationGuid / baselineState / occurrenceCount fields from the OASIS
schema; this repo is what "the contract is already standardised" looks like in practice.

### V3 verdict

The vertical has a standardised output contract (SARIF) and the repos split three ways: one
implements the *spirit* of it independently with fingerprints plus a persisted ACTIVE/RESOLVED
baseline (pr-agent), one implements the *letter* of it with correct partialFingerprints but
leaves dedup to an LLM (open-code-review), and the highest-profile official action implements
neither and extracts JSON from prose (claude-code-security-review).

---

# Cross-vertical synthesis

## The three gates are genuinely different shapes

| Vertical | Control shape | Best implementation found | Default posture |
|---|---|---|---|
| Quant | **Threshold / state gate** - deny when a limit is exceeded or trading is halted | nautilus_trader RiskEngine: TradingState::Halted, max_notional_per_order, submit/modify throttlers, OrderDenied events | Fails closed **unless** config.bypass |
| Pentest | **Scope-conformance gate** - allow anything inside the contract, deny anything outside | cain-agent Scope + ScopeGuardHook (deny-first, default-deny, PreToolUse); Armur ScopeDefinition + ValidateCommand | Fails closed (cain, Armur); **fails open** (redcell) |
| Audit | **Identity + baseline gate** - no pre-execution block; the control is a stable finding identity and a diff against a previous run | pr-agent fingerprints + ReconciliationResult; open-code-review SARIF partialFingerprints | Off by default (pr-agent dedup opt-in) |

A base framework that offers only one of these will force the other two verticals to bypass it.
This confirms, from code rather than from standards, the split the parent already inferred from
NIST SP 800-115 vs SEC 15c3-5.

## Must-answer 1: what is implemented vs only claimed

- **Quant - claimed, not implemented, in every LLM agent.** TradingAgents (108,565 stars),
  ai-hedge-fund (63,745 stars) and Vibe-Trading (34,022 stars) all advertise risk management and
  all implement it as LLM debate / persona / skill document against a simulator or backtester.
  No position limit, no notional cap, no kill switch, no idempotency key. The only real
  pre-trade blocking in this vertical is in engines that are **not** LLM agents (nautilus_trader,
  freqtrade) - meaning the LLM agent and the pre-trade control live in different processes, and
  nothing forces the agent to go through the gate.
- **Pentest - implemented, and the prompt-only version is documented as having failed.**
  cain-agent, Armur, redcell, Dark-Moon and pentestagent all block at the tool boundary.
  Dark-Moon's source comment is the evidence: prompt rules forbade hydra and "the model still did
  it... A rule that only lives in a prompt is a suggestion; this is the enforcement point."
  Against that, PentestGPT (15,589 stars) has **only** a README disclaimer and no enforcement
  code at all - a pure claim/code discrepancy, and the most-starred open-source pentest agent.
- **Audit - the "control" is output identity, and it is often missing.** pr-agent and
  open-code-review implement stable finding identity; claude-code-security-review does not, so
  its findings cannot be diffed across runs.

## Must-answer 2: declarative authority/scope contract as a first-class artifact

**Yes - two, both in the pentest vertical, and none in the other two.**

1. **cdxiaodong/cain-agent** - templates/scope.example.yaml, a YAML authority contract with
   in_scope / out_of_scope, deny-priority, default-deny, load-time validation that refuses to
   start on a malformed entry, enforced by ScopeGuardHook at the PreToolUse stage. Schema and
   semantics quoted in V2.1 above.
2. **Armur-Ai/Pentest-Swarm-AI** - internal/scope/validator.go ScopeDefinition (AllowedCIDRs,
   AllowedDomains, AllowedPorts, ExcludedCIDRs, loaded from scope.yaml, fail-closed on empty)
   plus internal/scope/programterms/programterms.go Constraints - an attempt to turn a bug-bounty
   program's prose RoE into typed fields (MaxRequestsPerSecond, NoAutomatedScanning, NoBruteForce,
   NoDoS, NoSocialEngineering, NoPhysical, DisallowedPaths, RequiredHeaders). Its parser is
   explicitly heuristic and admits it.

Neither contract carries a **time window** or **named authorized personnel**, which NIST
SP 800-115's ROE template requires. The closest thing to a first-class *authority* artifact that
includes an expiry is nautilus's TradingState (runtime state) and freqtrade's
PairLock.lock_end_time (a time-bounded lock with a reason) - both quant, both threshold-shaped
rather than scope-shaped, and neither derived from a signed engagement.

## Must-answer 3: the most common failure / gap

**The control is expressed in the model's context instead of at the execution boundary - and
where it *is* at the boundary, the default posture is fail-open.**

The three shapes:

1. **Quant** - "risk management" is a prompt role (three debating personas, a judge decision in
   risk_debate_state). The real gate lives in a separate non-agent engine. Nothing routes the
   LLM's decision through the gate.
2. **Pentest** - documented twice in source: Dark-Moon's prompt rules were violated by the model
   until the rule was moved into execution_guard.classify; and redcell enforces scope correctly
   *but* in_scope returns True for an empty scope ("unrestricted by design"), so the gate is
   absent exactly when configuration is incomplete.
3. **Audit** - the identity/diff machinery exists but is off by default (pr-agent
   persistent_inline_comments default false) or non-deterministic (open-code-review's LLM
   DEDUP_TASK), so the default configuration cannot answer "what changed since the last run?"

Two secondary gaps that recur:

- **Claim/code discrepancy.** PentestGPT's authorization disclaimer with no enforcement code;
  TradingAgents' "Risk Management and Portfolio Manager" section implementing an LLM debate;
  claude-code-security-review's prose-extracted JSON findings that cannot be baselined. In each
  case the README is stronger than the code.
- **A single bypass flag or skip condition defeats the gate.** nautilus:
  if self.config.bypass { send_to_execution(...) }. Armur: builtin verbs skip the broad
  ValidateCommand scan. redcell: if not self.scope: return None. A gate that can be turned off by
  configuration is not the same control as one that fails closed.

## Transferable design points for the base framework

Concrete, code-backed, and each maps onto a PRD acceptance criterion:

1. **Contract + hook is the cheapest working seam.** cain-agent's whole mechanism is a validated
   YAML file plus one PreToolUse callback returning
   {"hookSpecificOutput": {"permissionDecision": "deny", "permissionDecisionReason": ...}}. That is
   a declarative contract, a fail-closed default, and a reason string reaching the transcript, in
   one file.
2. **Deny-first ordering, and refuse to start on an unrepresentable boundary.** cain-agent raises
   ScopeConfigError at load; Armur returns ScopeViolationError when the scope is empty. redcell
   does neither and is therefore the counter-example.
3. **Make the gate's invocation auditable, not just its decision.** Armur's ValidateAndLog emits
   a DEBUG line on *allow* as well as a WARN on deny, specifically "so that a future bug where a
   caller silently eats the error still shows up in the log stream." That is the defence against
   a gate that exists but is not on the path.
4. **A block must carry a remediation, not just a refusal.** Dark-Moon returns WHY + DO THIS
   INSTEAD explicitly so the model does not retry the identical command. Armur and redcell return
   the violating target and the allowed scope.
5. **Finding identity must exclude model prose.** open-code-review's fingerprint is
   Path|Category|ExistingCode and says so: "not message.text, which is LLM prose that varies
   across runs." pr-agent normalises whitespace and case for the same reason and OR-matches a body
   fingerprint against a code fingerprint because an LLM restates a defect two ways.
6. **Version the fingerprint key and the state schema.** open-code-review uses
   sarifFingerprintKey = "ocrFinding/v1"; pr-agent uses STATE_SCHEMA_VERSION = 1 and embeds the
   version in the marker. Identity schemes change; the stored artifact must be able to say which
   scheme produced it.
7. **Idempotency is a separate control from scope.** None of the surveyed pentest repos has a
   per-action idempotency key; the closest is nautilus's use of client_order_id +
   cache.order_exists and the venue's duplicate rejection. For a framework that must "resume
   without re-executing completed side effects," the idempotency key has to be owned by the
   framework, not the tool.

---

# Caveats / Not Found

- **vxcontrol/pentagi (24,951 stars, MIT, Go, push 2026-09-23) was not inspected.** 58 MB repo
  (jsDelivr refuses over 50 MB) plus an exhausted GitHub API. Its scope/sandbox controls are
  **unverified**, and given its star count it is the most important gap in this file.
- **No repo in the quant vertical was found that both lets an LLM drive an order and blocks it at
  a runtime boundary.** The search may have missed one; the terms used were "trading agent llm",
  "quantitative trading agent framework", "llm trading bot", "algorithmic trading bot risk
  management". A repo that is an *agent* wrapping ccxt / ib_insync with its own gate would not
  necessarily surface.
- **GitHub code search (which would find "kill switch" / "pre-trade" implementations directly)
  requires authentication and was unavailable.** Discovery therefore relied on repository search
  plus file-tree filtering, which can miss a control implemented in a file whose name does not
  contain a control keyword.
- **grep.app is behind a Vercel bot checkpoint** (HTTP 429 to the API from this environment).
  Cross-repo code search was not available as a fallback.
- **data.jsdelivr.com tree listings are not reliable for recency** - one stale listing and one
  missing file were observed. Every cited path was confirmed by fetching it, but a control in a
  file not listed by jsDelivr and not guessed would have been missed.
- **"Last commit" is reported as pushed_at (last push to any branch)** for most repos, because the
  core API that exposes the commit endpoint was rate-limited. A repo with a recent pushed_at may
  still have a stale default branch.
- **nautilus_trader is Rust at develop.** The cited paths are current as of 2026-09-25; the repo
  previously had a Cython nautilus_trader/risk/engine.pyx which no longer exists (404). Line
  numbers are from the fetched revision and will drift.
- **pr-agent's canonical name changed** from codium-ai/pr-agent to The-PR-Agent/pr-agent.
  codium-ai/pr-agent still serves the files cited, so both paths resolve, but the stars/license
  above are from The-PR-Agent/pr-agent.
- **virattt/ai-hedge-fund has no risk_manager.py** on the default branch despite a jsDelivr
  listing for it; the repo's README self-describes as a proof of concept and its execution surface
  is a backtester. Its risk handling is therefore asserted here from the README plus the absence of
  an order path, not from a risk-control source file.
- **Stars and licenses are from the GitHub search API on 2026-09-25** and will drift.
- No repository in any of the three verticals was found that treats the **time window** or **named
  authorized personnel** parts of a NIST-style ROE as first-class contract fields. The nearest is
  freqtrade's PairLock.lock_end_time and nautilus's runtime TradingState - neither is derived from
  an engagement document.
