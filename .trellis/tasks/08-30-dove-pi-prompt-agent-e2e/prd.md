# Dove Pi prompt-to-agent E2E evaluation

## Goal

Evaluate the pushed Dove Pi runtime at commit `e8883a0` through realistic user
prompts, from Pi startup and Dove request planning through provider payload,
tool execution, final response, usage accounting, and session follow-up. The
result must show whether the recent request-middleware changes improve real
first-turn cost and capability isolation without weakening project execution.

## User Value

- A simple greeting should be fast and inexpensive instead of carrying a full
  development tool catalog.
- Read-only prompts should receive useful inspection tools without mutation
  authority.
- A real project task should still escalate to the tools needed to complete and
  verify work.
- Failures should be attributable to Dove, Pi, model metadata, provider
  behavior, or the test fixture instead of being reported as a vague hang.

## Confirmed Facts

- In the previous live probe, the correct 1M-context route completed `hi`, while
  a provider entry declaring `contextWindow=12,800` and `maxTokens=16,384`
  reached the provider with `max_tokens=1` and truncated.
- Before `e8883a0`, Auto `hi` used 10,866 input tokens versus 1,273 with
  `--no-tools`; about 9,593 tokens (88%) came from the effective tool schema.
- The request-middleware task now has deterministic coverage for a representative
  57-tool catalog: Chat selects zero tools, Lookup excludes mutation/browser
  automation/generic MCP/background tools, and later requests drop prior
  Execution authority.
- Pi 0.84.3 supports JSON event-stream and RPC modes, explicit model selection,
  custom session directories, ephemeral sessions, session statistics, tool
  lifecycle events, stop reasons, usage, cache reads/writes, costs, retry, and
  compaction events.
- `dove-pi cache audit` and `dove-pi token audit` now terminate through the
  finite Dove CLI route.
- The public managed installer is committed and pushed, but no stable GitHub
  Release exists yet. This evaluation therefore targets the pushed source
  checkout/launcher, not the unavailable `releases/latest` bootstrap.
- Project-local Pi settings load Trellis and notification extensions. No test
  may expose credentials or permanently rewrite the real user model/settings,
  session store, Dove state, project files, or managed-install root.

## Requirements

### R1. Normal user journey and evidence

- Start from the globally resolved `dove-pi` command in a new disposable project
  and use the ordinary TUI. Do not preselect tools, inject internal hooks, or
  replace the default Auto policy for the primary journey.
- Use the user's current default provider/model and thinking configuration, as a
  normal session would. Record only non-secret identity and declared limits so
  model-metadata failures can be distinguished from Dove failures.
- Enter natural prompts in sequence and let the Agent choose its own tools,
  context, workflow, commands, and number of provider turns.
- Keep only the project and session trace isolated. Do not replace the real
  provider configuration with a synthetic test configuration. Redact
  authorization, API keys, cookies, and sensitive headers from all evidence.
- Pi JSON/RPC replay or session-file analysis may supplement TUI observations
  when exact tool/usage evidence is unavailable, but it must use the same
  runtime/model/settings and may not substitute for the primary TUI journey.
- Record each prompt's intent, active/provider-visible tool count, serialized
  tool-schema size, Dove context/guidance presence, provider call count, tool
  sequence, duration, stop reason, retries, usage, cache reads/writes, output,
  and filesystem diff.

### R2. User-flow prompt sequence

- Chat: `hi` and a Chinese response-only cache probe; expect zero tools and no
  empty Dove project-context wrapper.
- Lookup: inspect `package.json`; expect only bounded read/search tools and no
  workspace or external mutation.
- Project Work: analyze a code file and propose a plan without modification;
  expect read-only project diagnostics/planning.
- Execution: ask Dove to solve and verify a small deterministic defect in the
  disposable project, without telling it which tools or commands to use; expect
  a natural inspect/edit/test/recheck loop and a correct final answer.
- Continuation: send a follow-up in the same RPC session to verify request-exact
  tool narrowing, append-only context ordering, cache reuse, and no stale
  Execution authority.
- Trellis: initialize or enter project management through the documented Dove
  command/normal prompt flow, then request continuation or planning and verify
  correct workflow guidance/context without automatically creating or
  completing unrelated tasks.

### R3. Controls and comparisons

- Compare fresh Auto `hi` against the prior 10,866-token Auto baseline. The old
  1,273-token `--no-tools` measurement is diagnostic context only; the primary
  result comes from unmodified Auto behavior.
- Run a same-tier repeat and a privilege transition sequence such as
  Lookup -> Chat and Execution -> Lookup.
- Distinguish provider cache behavior from Dove payload size; a good cache hit
  must not hide a bloated first request.
- Validate declared model metadata before interpreting truncation or budget
  failures.

### R4. Test containment without synthetic behavior limits

- Read-only cases must not execute mutation tools.
- Any mutation case runs in a generated disposable Git fixture with a clean
  pre/post snapshot and recoverable teardown. Dove is not given an artificial
  command allowlist, provider-call count, token ceiling, or cost ceiling.
- Observe the session as a normal user would. Stop only for a genuine safety or
  liveness failure such as attempted writes outside the fixture, credential
  disclosure, destructive system operations, a persistent hang, or repeated
  provider failure with no progress.
- Do not run installation, update, winget, GitHub publication, real project task
  mutation, or credential inspection as part of this evaluation.

### R5. Actionable report

- Produce a machine-readable trace/summary and a concise human report showing
  pass/fail per case, evidence, regressions from the previous baseline, and the
  owning layer for every failure.
- Separate test-harness defects from Dove/Pi/provider defects.
- If a product defect is found, stop after diagnosis and propose a narrowly
  scoped follow-up; do not silently mix product fixes into the evaluation task.

## Acceptance Criteria

- [ ] The selected provider/model metadata is recorded and internally
  consistent; no request is judged against the old 12.8K/16K mismatch.
- [ ] Fresh Auto `hi` reaches the provider with zero tools, no empty Dove context
  wrapper, `stopReason=stop`, and materially approaches the same-model
  `--no-tools` input baseline rather than the previous 10,866-token result.
- [ ] The response-only cache probe remains Chat and makes no tool call.
- [ ] Lookup and Project Work expose no shell/write/edit/task/browser automation,
  generic MCP, background, or workspace-mutation authority.
- [ ] The disposable Execution case modifies only the intended fixture, runs its
  verification command, resolves the seeded defect, and returns a non-truncated
  final answer.
- [ ] A request after Execution drops all stale mutation tools; same-tier repeats
  avoid needless tool-prefix churn.
- [ ] The Trellis case receives relevant current-turn guidance/context without an
  empty wrapper, duplicate snapshot, or unintended task lifecycle mutation.
- [ ] Every provider request has recorded duration, stop reason, usage, cache,
  tool count/schema size, and output-budget evidence; secrets are absent.
- [ ] The primary journey uses ordinary `dove-pi` TUI and default Auto behavior;
  no synthetic tool allowlist, call-count ceiling, or model override changes the
  observed Agent decisions.
- [ ] Project containment is verified after the execution case and the session
  can be stopped cleanly if a genuine safety/liveness failure appears.
- [ ] The final report identifies regressions and recommends whether Dove Pi is
  ready for a larger real project trial.

## Out of Scope

- Publishing `v0.1.0` or validating the public one-line installer.
- Benchmarking multiple providers/models or claiming universal cache behavior.
- Stress-testing a multi-hour production repository.
- Fixing product defects discovered by the evaluation.
- Reading or exporting provider credentials.

## Key Decision

- The evaluation uses real provider calls and one real write/test loop as part
  of an ordinary Dove Pi session. It does not impose arbitrary call, token,
  time, or cost caps. Isolation protects the user's actual projects without
  changing the Agent's normal behavior.
