# Token Guard and Provider-Safety Hardening

## Goal

Finish the existing token-guard work without reducing Dove's large-project quality. Provider requests must fit the real model window, rejected requests must not leak through Pi's swallowed extension errors, stable prompt prefixes must remain cacheable, and recovery must not close work owned by another live Dove process.

## Requirements

- Keep the provider-facing Dove policy prefix stable across request-intent changes.
- Isolate ordinary chat from Trellis/project context and avoid rebuilding the stable prefix for each intent.
- Validate the final provider payload against the declared context window before transport.
- If `model.maxTokens` exceeds the context window, lower the transmitted provider output field to a safe value.
- Treat request-plan output budgets as required response headroom, not a fixed Ultra output ceiling. When the final payload leaves more room and the provider requested more, permit the larger safe output.
- Preserve an explicit smaller provider output limit.
- Abort the active Pi operation when the final payload remains over budget; throwing from the hook alone is insufficient because Pi records and swallows extension exceptions.
- Record provider completion stop reasons using one normalized vocabulary.
- Do not reconcile incomplete capability/provider records while their owning process is still alive.
- Negated or explanatory action mentions must not request execution, but a later comma/semicolon-delimited imperative must still be classified as execution.
- Tests must use an isolated `DOVE_PI_STATE_DIR` and must not write the real project `.agent-data` ledger.

## Acceptance Criteria

- A 12.8K-context model configured with `maxTokens=16,384` sends a bounded provider limit and does not fail solely because the configured output exceeds the context window.
- A provider-requested limit below Dove's target is preserved.
- A large-window Ultra/project request is not capped at the static 4,096-token planning target when the final input leaves more safe room.
- A truly over-budget request calls Pi `abort()` and writes rejection evidence.
- `hi` remains chat-isolated and the Dove system prompt is byte-stable across intent changes.
- English and Chinese negation/explanation cases remain read-only, while `do not wait, run tests` and `不要等待，执行测试` remain execution.
- Live-process ownership prevents false recovery; dead/legacy ownership remains recoverable.
- Typecheck and the full test suite pass.

## Non-goals

- No automatic deletion, truncation, or compaction of user conversation history.
- No fixed application context cap for Ultra.
- No keepalive/background model traffic.
- No changes to Pi thinking levels, model selection, or provider credentials.

