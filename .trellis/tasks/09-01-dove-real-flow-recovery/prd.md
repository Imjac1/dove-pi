# Dove Real Request Flow Recovery

## Goal

Restore Dove's real multi-turn experience so it completes user goals with no
redundant confirmation loops, preserves provider-cache prefixes across ordinary
turns, and reports efficiency in terms that correlate with successful work.

## Background

The September 1 Desktop `code` session is the regression fixture. Four user
turns produced 59 provider calls, 91 tool calls, 24 structured questions,
443,834 uncached input tokens, and one cancellation. Every user turn's first
provider request had `cacheRead=0`; those four calls contributed 332,212 tokens,
74.9% of all uncached input. The final affirmative `可以` turn exposed only the
third-party question tool, asked 15 confirmations, and never executed.

The managed runtime was `0.1.5+dea33bf`, while the repository contains four
newer local commits. Replaying the 15 confirmation calls against current HEAD
still allows all 15, so release skew is an amplifier rather than the sole root
cause.

## Requirements

### R1. Goal continuity

- Resolve short affirmative/cancel/correction replies against a bounded pending
  user-goal state instead of classifying them as independent Chat requests.
- `继续当前任务` resumes execution of the projected next step immediately;
  `查看当前任务` remains a read-only status query.
- `继续任务 <selector>` must target the uniquely resolved task instead of
  silently falling back to the project-global current task.
- Recognize save/export/record/generate-file imperatives as Execution.
- Clear pending state on completion, cancellation, unrelated explicit requests,
  session replacement, and policy failure.
- Never treat an affirmative reply as continuation unless the preceding Dove
  state records the exact pending request and a positive structured answer.

### R2. Stable provider prefix without a second permission system

- Provider-visible system policy and base tool schema must remain stable across
  ordinary Chat/Lookup/Project Work/Execution transitions in one session.
- Pi remains the only tool authority. In Auto mode Dove must observe Pi's active
  tools without calling `setActiveTools`, classifying tools into permission
  tiers, or blocking an otherwise valid tool because of request intent.
- Web, MCP, browser, background, and third-party tool loading remains owned by
  Pi and its extensions. Dove may diagnose schema changes but must not undo
  them.
- Explicit user tool-profile changes may change the prefix and must be reported
  as such. Legacy `core`/`full` profiles remain opt-in compatibility controls,
  never Auto behavior.

### R3. Question and loop budgets

- A logical user goal may issue at most one structured clarification before
  real progress; a second back-to-back question is terminated regardless of
  wording, option shape, or target-token similarity.
- A positive answer to a pending action permits execution, not another
  confirmation. A Pi-hosted Dove tool call is already an execution decision and
  must not add another Dove approval prompt.
- Provider-round and tool-call budgets stop widening exploration and require a
  result or explicit evidence gap.

### R4. Honest diagnostics

- Cache reporting must include first-call warm hit rate, cold user-turn count,
  uncached tokens per logical goal, provider rounds, question count, completion,
  and cancellation.
- Repeated cached loops must not improve the primary efficiency score.
- Doctor must probe final active-tool behavior and detect extension hook/tool
  ownership conflicts, not merely installed package presence.
- Session JSONL is authoritative when optimizer shards are active or unflushed.

### R5. Release-real validation

- Tests must replay the original September 1 prompts and all 15 confirmation
  variants.
- A clean-process A/B compares direct Pi+Trellis, the managed baseline, source
  HEAD, and the newly installed managed release with the same model/settings.
- Validation records task success, first-call cache use, uncached input, provider
  rounds, tools, questions, provider time, wall time, and stop reason.

## Acceptance Criteria

- [x] `先保存一下现在的上下文我记录一下用来审计优化agent流程` resolves to Execution and exposes a working file-write path without a clarification loop.
- [x] After a recorded pending action, `可以` inherits that action, asks zero additional structured questions, and executes or returns one exact blocker.
- [x] The 15-question September 1 replay terminates before question 2; no wording variant bypasses the per-goal limit.
- [x] Unfinished-task inventory normally completes in one provider call from the injected projection, without archive/source archaeology.
- [x] A continuation request exposes the current task's next step and leaves Pi's active tools available for execution.
- [x] A negated/explanatory lifecycle request creates or upgrades no formal task metadata.
- [x] Ordinary multi-turn tool/system digests remain stable; after the initial cold request, warm first-call cache hit rate is at least 70% in the real-provider matrix.
- [x] Auto mode makes zero `setActiveTools` calls across Chat/Lookup/Execution turns and preserves Pi-selected third-party tools.
- [x] Simple Chat uses one provider round; bounded Lookup uses at most three; a small edit-and-test flow uses at most five.
- [x] Every logical goal asks at most one clarification, has zero repeated confirmations, and finishes without cancellation in the acceptance matrix.
- [x] Warm simple goals use at most 10,000 uncached input tokens and Dove does not regress uncached tokens or completion rate versus direct Pi+Trellis.
- [x] Doctor fails or degrades when another extension changes Dove's final tool set after policy selection.
- [x] Unit tests, typecheck, installer tests, doctor, Pi smoke, task validation, source replay, and installed-release A/B pass.

## Out Of Scope

- Replacing Pi, Trellis, the provider, or the third-party package ecosystem.
- Treating lower reasoning settings as the primary fix.
- Modifying forensic files under `C:\Users\rebot\Desktop\code`.
- Optimizing every optional Web/MCP/background extension before the core flow is stable.
- Removing validation or authorization boundaries from standalone CLI, RPC, or MCP transports; they are not Pi session tool authority.
