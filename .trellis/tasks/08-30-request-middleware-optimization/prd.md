# Optimize Dove Request Middleware and Launcher Routing

## Goal

Make Dove's path from a user prompt to the provider predictable, cheap, and safe. A fresh conversational turn must not pay for development tools; read-only requests must not expose mutation tools; project context must remain append-only from the provider's point of view; and documented Dove CLI diagnostics must route to the CLI instead of opening an interactive Pi session.

## User Value

- A greeting or response-only probe starts quickly and uses a small prompt.
- Large-project work receives the tools and context it needs without carrying every installed extension schema from the first turn.
- Read-only requests cannot accidentally choose shell or workspace mutation paths merely because those tools were exposed.
- Cache behavior remains stable across mixed chat and project turns.
- `dove-pi cache audit` and `dove-pi token audit` behave like normal finite CLI commands.

## Confirmed Facts

- The active Pi environment registers 57 tools. The current Auto session baseline selects 24, a real `hi` reached 30 provider-visible tools, and the serialized tool schema measured 26,887 characters.
- A real Auto `hi` used 10,866 input tokens while `--no-tools hi` used 1,273; provider caching itself worked on the next same-session request at about 98%.
- Before this task, `applyAutoTools()` unioned Dove's requested set with `pi.getActiveTools()`, so third-party reactivation became part of a stale session-wide set.
- `CORE_TOOL_NAMES` currently includes shell, write, restore, and patch tools, so Chat and Lookup are not capability-isolated.
- Bare `test` / `测试` in `src/pi-adapter/tool-profile.ts` activates the eight pi-lens tools. `createRequestPlan()` classifies `这是缓存测试第一轮，只回复：第一轮完成` as project work and `分析 ... 不修改文件` as elevated execution.
- The current `context` hook removes an existing v2 project snapshot for Chat and exposes it again for the next project turn. A deterministic probe observed provider-visible history counts of `2 -> 1 -> 2`.
- A Lookup probe appended a 51-character `[PERSONAL AGENT REQUEST CONTEXT]` wrapper with zero selected segments. A later repair prompt at the same project revision neither refreshed relevant context nor delivered its workflow suggestion.
- Provider budgeting estimates tool schemas as `512 + activeToolCount * 128`, while the final provider payload already carries the real serialized schema.
- `dove_pi.py::main()` routes `doctor`, `project`, `skills`, `web`, and `extensions` to the TypeScript CLI, but omits the documented `cache` and `token` commands. `dove-pi cache audit` therefore launched an interactive Pi process and appeared to hang.
- The current machine uses a checkout-bound launcher and has no managed install state. `dove-pi update --check --json` reaches GitHub but returns 404 because the repository has no published stable GitHub Release. That release-state issue is distinct from middleware correctness.
- Existing gates pass (TypeScript typecheck, 139 Node tests, and 35 installer tests), proving that current mocks do not cover the real tool catalog, context sequence, or launcher routing boundary.

## Requirements

### R1. Intent-owned tool exposure

- Tool selection must consume the immutable `RequestPlan.intent` rather than independently inferring the entire policy from broad prompt keywords.
- A fresh Auto Chat turn exposes no model-callable tools.
- Auto Lookup exposes only bounded read-only inspection and web retrieval tools. Browser automation, generic MCP dispatch, and background helpers remain Execution-only because they can mutate state and their hosts do not enforce Dove's request tier.
- Auto Project Work exposes read-only project and code-diagnostic/planning tools; it does not expose shell, write, restore, patch, or task mutation tools.
- Auto Execution may expose the relevant shell/edit/capability/workspace mutation tools, subject to existing approval and read-only-mode boundaries.
- At each user-request boundary, Auto activates exactly the set selected from the immutable `RequestPlan`; it keeps that set stable only for the current request and its tool-call continuations. A later Chat or Lookup must drop earlier Execution tools and schemas.
- Auto must not absorb arbitrary names returned by `pi.getActiveTools()` after another extension changes host state; it reasserts the current request's exact Dove-selected set when host state drifts.
- Explicit `full`, host `--tools` arguments, and `/dove-tools reset` remain supported. Hashline tools remain the edit authority when available.

### R2. Intent classification quality

- Response-only probes such as cache test messages remain Chat unless they contain an independent actionable command.
- Read-only analysis with Chinese or English negation remains Lookup.
- Explicit fix/repair and run/test imperatives that require workspace changes become Execution.
- Planning without mutation may remain Project Work, but its exposed tools remain read-only.
- The request planner remains the single owner of Chat / Lookup / Project Work / Execution classification.

### R3. Cache-stable project guidance

- The Pi `context` projection must never remove, move, or recreate a current v2 Dove message based only on the current intent.
- Dove must not append a project-context wrapper when there is no meaningful segment or guidance.
- Prompt-specific workflow guidance must reach the current request when suggested; it must not be stranded inside a snapshot that is reused for a different prompt.
- Broad project documents are loaded through the existing bounded project-context tool/adapter path rather than repeated automatically on every turn.
- Mixed `project request -> chat -> project request` history remains append-only and preserves provider message ordering.

### R4. Real tool-schema accounting

- The final provider budget gate estimates the serialized tool definitions from the actual provider payload when available.
- Count-based estimation may exist only as a conservative fallback before the payload exists.
- A large schema that makes a small-window request unsafe must be rejected or clamped through the existing provider firewall; a large-window request must not receive a false small fixed cap.

### R5. Launcher routing

- `dove-pi cache ...` and `dove-pi token ...` route to the TypeScript CLI and terminate normally.
- Unknown ordinary arguments continue to pass through to Pi, preserving the open Pi host behavior.
- Tests exercise `dove_pi.main()` routing without launching a real interactive Pi process.

### R6. Realistic regression coverage

- Tests use a representative 57-tool catalog and simulate a third-party extension changing Pi's active tools.
- Tests cover the intent matrix described in R2, including Chinese negation and response-only cache probes.
- Tests cover provider-visible ordering across project/chat/project turns and reject empty context wrappers.
- Tests cover real serialized tool-schema accounting and launcher routing.
- Existing typecheck, Node tests, installer tests, doctor, and Pi smoke remain green.

## Acceptance Criteria

- [ ] A fresh Auto `hi` reaches the provider with zero tools and no Dove project-context wrapper. (Pi hook integration passes; paid live-provider E2E remains intentionally unrun.)
- [x] A read-only `package.json` lookup exposes read/search tools but no shell, write, restore, patch, or task-mutation tool.
- [x] `这是缓存测试第一轮，只回复：第一轮完成` is Chat and does not load pi-lens.
- [x] `分析 src/pi-adapter/tool-profile.ts，不修改文件` is Lookup, while `修复登录超时问题` and `运行测试并修复失败` are Execution.
- [x] Third-party active tools such as `mcp`, Fusion, or background tools are not absorbed unless Dove selected them for the request or the user selected `full`.
- [x] Lookup -> Chat and Execution -> Chat return to zero tools; Execution -> Lookup removes all mutation, browser automation, generic MCP, and background tools.
- [x] Consecutive Auto requests with the same selected set do not call `setActiveTools()` redundantly.
- [x] A project/chat/project sequence returns the original v2 messages in the same order at every provider call and delivers any current workflow guidance.
- [x] No `personal-agent-context` message is emitted with zero meaningful segments/guidance.
- [x] Provider accounting uses the actual serialized schema and detects an unsafe small-window payload.
- [x] `dove-pi cache audit --min-requests=2` and `dove-pi token audit --since=1h` call the finite CLI route in launcher tests.
- [x] `npm run typecheck`, `npm test`, `npm run test:installer`, `npm run doctor`, and `npm run pi:smoke` pass.

## Out of Scope

- Replacing Pi's provider cache or changing OpenRouter cache-retention policy.
- Building a universal meta-tool/dispatcher that proxies every third-party extension.
- Changing the extension package catalog or uninstalling optional extensions.
- Publishing a GitHub Release, migrating this machine to the managed installer, or changing release-channel policy. Those are follow-up operational steps after code verification.
- Redesigning Trellis project storage, task lifecycle, or memory synchronization.
