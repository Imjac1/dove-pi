# Interaction Mode Validation

## Run

- Date: 2026-09-01
- Host: Windows, project-locked Pi entry through `python dove_pi.py`
- Provider: configured local Pi provider; credentials are not recorded here
- Thinking policy: `off` in Dove, `minimal` at the Pi CLI boundary
- Tools: disabled for this smoke check so the result measures request routing

## Real Provider Smoke

| Mode | Prompt | Result | Questions | Tools | Exit |
|---|---|---|---:|---:|---:|
| `chat` | `只回复 CHAT_MODE_OK，不要调用工具。` | `CHAT_MODE_OK` | 0 | 0 | 0 |
| `auto` | `只回复 AUTO_MODE_OK，不要调用工具。` | `AUTO_MODE_OK` | 0 | 0 | 0 |

Both calls used the project-locked launcher and reached the configured
provider. Neither call created a formal task or emitted workflow guidance.

A two-prompt Auto session also exited successfully with `FIRST_OK` and
`SECOND_OK` responses, zero tool calls, and zero questions. Its two assistant
records contained 1,984 input tokens in total and reported zero cache reads and
writes. This is a below-threshold short-prefix result, so it is not comparable
to the long-context cache matrix and is not treated as a cache regression.

A Work-mode formal smoke request, `请规划并设计一个缓存命中率优化方案，只回复
FORMAL_FIXED_OK，不要调用工具。`, returned `FORMAL_FIXED_OK` and created all six
native task outputs: `task.json`, `prd.md`, `design.md`, `implement.md`,
`acceptance.md`, and `evidence.jsonl`. The earlier run that created no artifacts
was caused by response-only classification bypassing the formal lane; the
regression is now covered by the request-plan and Pi adapter tests.

## Latest Isolated Real-Provider Run

- Date: 2026-09-01
- Project: fresh temporary workspace; no repository files were used
- Provider/model: `12321` / `deepseek-ai/DeepSeek-V4-Flash`
- Tools: disabled explicitly

| Mode | Input tokens | Cache read | Cache write | Result | Questions | Tools | Exit |
|---|---:|---:|---:|---|---:|---:|---:|
| `chat` | 892 | 0 | 0 | `CHAT_REAL_OK` | 0 | 0 | 0 |
| `auto` turn 1 | 892 | 0 | 0 | `AUTO_REAL_1` | 0 | 0 | 0 |
| `auto` turn 2 | 914 | 0 | 0 | `AUTO_REAL_2` | 0 | 0 | 0 |
| `work` formal | 1,802 | 0 | 0 | `WORK_FORMAL_OK` | 0 | 0 | 0 |

The two Auto calls reused the same session ID and completed successfully. The
configured upstream returned no cache read/write signal in either turn, so this
run cannot prove a cache hit-rate improvement or regression. It does prove that
the current routing path adds no questions or tools to these prompts. The Work
run created `task.json`, `prd.md`, `design.md`, `implement.md`, `acceptance.md`,
and `evidence.jsonl`; the native goal advanced to phase `verifying`.

## User-Like Coding A/B Run

- Date: 2026-09-01
- Fixture: two identical temporary JavaScript projects with one async cache bug
- Prompt 1: inspect and fix `getOrCompute`, preserve async behavior, run tests
- Prompt 2: continue with concurrent-call and failed-compute retry edge cases
- Provider/model: `12321` / `deepseek-ai/DeepSeek-V4-Flash`
- Tools: enabled; each follow-up reused the same session ID, with a new process

| Runner | Provider rounds | Tool calls | Questions | Uncached input | Cache read | Warm ratio |
|---|---:|---:|---:|---:|---:|---:|
| Native Pi | 12 | 10 | 0 | 47,366 | 224,768 | 82.59% |
| Dove Auto | 12 | 10 | 0 | 51,505 | 241,408 | 82.42% |

Both runners finished the two requests and their local fixture suites passed
3/3. Dove used 4,139 more uncached input tokens (+8.74%) and was 0.17
percentage points lower on the aggregate warm ratio. More importantly, Dove's
second process had a full cache miss on provider round 5 (`input=23,787`,
`cacheRead=0`) after the first request had already warmed the prefix. Native Pi
kept the corresponding continuation warm (`input=457`, `cacheRead=22,272`).

This is the next P0 investigation: reproduce same-process versus process-restart
continuations while logging provider prefix components, tool schema digest,
session affinity, and Dove context epoch/revision. Do not change routing or
formal-task behavior until the extra cold start is reproduced and attributed.

## Automated Matrix

- `npm test`: 235 passed, 0 failed.
- Focused request-plan, ledger, and Pi adapter tests: 65 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run test:installer`: 92 passed, 0 failed.
- `npm run doctor`: passed; native provider and managed extension are healthy.
- `npm run pi:smoke`: passed.

The matrix also covers work-mode context selection, formal-lane artifact
creation, missing-artifact recovery, unrelated request isolation, and formal
lane inheritance across a short affirmative continuation.
