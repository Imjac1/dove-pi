# Technical Design

## Boundary

The smallest behavior gap is that the immutable request plan currently controls context policy but does not control tool capability exposure. Tool selection reclassifies prompt text independently, the context hook mutates provider-visible history by intent, and the provider firewall estimates schemas without reading the final payload. The launcher separately omits two TypeScript CLI command families.

The change belongs at the existing owners:

- `src/core/request-plan.ts`: intent classification only.
- `src/pi-adapter/tool-profile.ts`: map a `RequestIntent` plus narrow optional feature signals to tool names.
- `src/pi-adapter/extension.ts`: own the Dove-selected request-exact stage, append request guidance, preserve history, and pass exact provider accounting.
- `src/core/model-gateway.ts`: provider-neutral serialized schema estimation.
- `dove_pi.py`: top-level command routing.

No Core-to-Pi dependency, Trellis storage change, extension catalog change, or provider-cache implementation is introduced.

## Request Data Flow

```text
user prompt
  -> createRequestPlan (single intent owner)
  -> tool tier + narrow feature add-ons
  -> Dove-owned request-exact stage
  -> before_agent_start append-only guidance
  -> Pi builds final provider payload
  -> exact message + tool-schema accounting
  -> provider firewall
```

### Tool tiers

Use explicit capability tiers rather than one broad core set:

- `chat`: empty.
- `lookup`: read/search and read-only Dove project/doctor helpers.
- `project-work`: lookup plus planning/code-diagnostic helpers.
- `execution`: project-work plus shell, hashline/write, capabilities, task mutation, and transactional workspace mutation tools.

Read-only web retrieval remains a Lookup-compatible add-on. Browser automation, generic MCP, and background helpers are Execution-only because their tool surfaces can mutate external or local state and do not enforce Dove's request tier themselves. A keyword cannot downgrade the safety tier or add those tools to Lookup.

Auto activates exactly the current `RequestPlan` set at `before_agent_start` and keeps it stable through that request's provider/tool-call continuations. The next user request replaces it, so an Execution turn cannot leak mutation authority or schema cost into a later Chat/Lookup. `pi.getActiveTools()` is observed only to detect host drift; `pi.setActiveTools()` then reasserts the current request's authoritative Dove set. Consecutive requests with the same set avoid a redundant host call. User-selected `core`/`full` and host `--tools` remain explicit escape hatches.

This intentionally trades some prompt-cache reuse when intent tiers change for request-level least authority and lower per-turn schema cost. Same-tier consecutive turns keep a stable tool prefix, while a privilege downgrade is never skipped merely to preserve cache affinity.

## Intent Classification

Keep classification in `request-plan.ts` and make the precedence explicit:

1. Remove negated/explanatory execution clauses, including Chinese `不修改` forms.
2. Detect an independent execution imperative. Fix/repair verbs are execution because fulfilling them requires changes.
3. Detect response-only probes (`只回复` / `only reply`) as Chat when step 2 found no actionable clause.
4. Detect Lookup and Project Work from the remaining text.

Tool-profile regexes do not duplicate the Chat/Lookup/Project/Execution decision. They only detect optional domains such as browser or MCP and code-diagnostic relevance within an already compatible tier.

## Project Guidance and Cache Stability

Provider history is append-only. The `context` hook may remove only legacy unversioned entries during compatibility cleanup; it never removes a current v2 entry for Chat.

Automatic guidance is compact:

- do not append a wrapper for an empty compiled context;
- attach a prompt-specific workflow suggestion to the current turn rather than caching it as the meaning of a mode/revision epoch;
- retain source labels and bounded segment details when meaningful context exists;
- rely on `agent_project_context` for broad project documents instead of repeating large retrieval results.

If Pi's single-message callback requires context and guidance to share one current-turn message, the message is appended once at the turn boundary and never rewritten during tool continuations. Previous current-turn messages remain in their original order.

This intentionally removes the ineffective notion of Chat isolation by deleting only Dove messages: prior user and assistant project discussion already remains in the same conversation, so deleting one snapshot increases cache churn without creating real isolation.

## Provider Tool-Schema Accounting

Add provider-neutral helpers that locate the final `tools` array in common payload envelopes and estimate tokens from its JSON serialization using the same ASCII/CJK estimator used for text segments. The final `before_provider_request` gate uses this exact estimate.

The earlier `before_agent_start` preflight may serialize the active Pi tool descriptors if available or use a conservative fallback. It is advisory; the final payload gate remains authoritative. The transport output-limit mutation contract is unchanged.

## Launcher Routing

Extend the local-CLI command set in `dove_pi.main()` to include `cache` and `token`. Keep maintenance commands, icons, and Pi passthrough behavior unchanged. Python tests mock `run_local_cli` and `launch` to prove routing without opening an interactive child process.

## Compatibility

- Public execution modes remain Fast, Standard, and Ultra.
- Public tool profiles remain Auto, Core, Full, and Reset. `core` becomes the explicit compact read-only tier; `full` remains all tools minus the suppressed built-in edit authority.
- Existing explicit Pi `--tools` selection remains authoritative because automatic selection is skipped in that mode.
- Read-only runtime enforcement and approval checks remain defense-in-depth even when a mutation tool is correctly exposed for Execution.
- Existing v2 session messages remain readable; legacy unversioned cleanup remains supported.

## Risks and Rollback

- Some models may be less proactive with zero tools on Chat. This is intended; a later actionable turn escalates the stage.
- Misclassifying a repair request as read-only would hide needed tools. The bilingual intent matrix and execution-verb tests guard this boundary.
- Pi tool descriptor shapes may differ from provider payload shapes. Exact accounting is applied only to the final payload; the preflight uses a fallback.
- If staged Auto causes a compatibility regression, `/dove-tools full` remains the immediate user workaround and the tool-profile changes can be reverted independently.
- Launcher routing can be reverted independently from the TypeScript middleware changes.
