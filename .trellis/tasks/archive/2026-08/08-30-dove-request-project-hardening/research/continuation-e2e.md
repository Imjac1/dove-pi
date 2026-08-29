# Dove request/project hardening E2E evidence

## Result

The hardened request path passes the original eight-prompt journey. The first
seven prompts were executed in order in one clean Git fixture; the Trellis
continuation prompt was executed in a fresh Dove/Pi session against the real
project so that a public current task existed.

The most important regression is removed: natural-language continuation fell
from 13 provider requests, 19 tool calls, and 317,360 cumulative prompt tokens
to one provider request, zero tools, and 2,475 cumulative prompt tokens
(`input + cacheRead`). The final answer identified the current task directly
and did not mention missing tools, private paths, or `/trellis:continue`.

## Environment

- Before baseline: archived task `08-30-dove-pi-prompt-agent-e2e`, commit
  `e8883a0`, session `01a04f77-50c6-7515-94a9-839efbf21c1a`.
- After source base: `f235a16` plus the uncommitted hardening changes in this
  task.
- Provider/model: `12321` / `deepseek-ai/DeepSeek-V4-Flash`.
- Pi thinking: `high`; Dove mode: `standard`.
- Seven-prompt fixture commit: `3e90d37f309e7601798f254ecefbddfc3993f0e0`.
- Seven-prompt fixture session:
  `01a04fc6-ac21-782c-9b2f-ee1b90ddd5ad`.
- Continuation session: `01a04fdd-1db2-75b1-b4f6-7e814817da67`.
- Raw temporary evidence:
  - `C:\Users\rebot\AppData\Local\Temp\dove-prompt-e2e-final-7c54593da7704f39ab9499b72455a010`
  - `C:\Users\rebot\AppData\Local\Temp\dove-continue-e2e-116ef71433d34823a7a7a7439da3acf9`

## After results

`Input`, `cache`, and `output` are sums of provider usage across all calls in
that turn. `Tools/schema` is the exact provider-visible tool count and UTF-8
serialized schema bytes recorded at the final provider payload gate.

| # | Case | Plan | Provider calls | Tools/schema | Actual calls | Input | Cache | Output | Result |
| ---: | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `hi` | Chat | 1 | `0 / 0 B` | 0 | 1,856 | 0 | 47 | pass |
| 2 | response-only | Chat | 1 | `0 / 0 B` | 0 | 1,879 | 0 | 53 | pass |
| 3 | inspect package | Lookup | 5 | `9 / 4,900 B` | 7 read/list | 2,846 | 16,640 | 1,055 | pass; no bootstrap or mutation |
| 4 | analyze without edits/commands | Lookup | 1 | `9 / 4,900 B` | 0 | 704 | 4,352 | 1,331 | pass; reused already-read files |
| 5 | fix and verify | Execution | 4 | `30 / 31,393 B` | 3 (`read`, `replace`, `bash`) | 12,170 | 41,728 | 642 | pass; tests 2/2 |
| 6 | post-fix read-only explanation | Lookup | 1 | `9 / 4,900 B` | 0 | 2,531 | 4,864 | 336 | pass; authority dropped after Execution |
| 7 | one-sentence summary | Chat | 1 | `0 / 0 B` | 0 | 2,896 | 1,792 | 78 | pass |
| 8 | natural-language Trellis continue | Project Work / continue | 1 | `0 / 0 B` | 0 | 171 | 2,304 | 584 | pass; current task returned |

The first seven turns used 14 provider requests and 10 actual tool calls. With
the independent continuation turn included, the eight cases used 15 provider
requests, 10 tool calls, and 96,733 cumulative prompt tokens. The before run
used 27 provider requests, 29 tools, and 451,174 cumulative prompt tokens.

## Continuation before/after

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Provider requests | 13 | 1 | -92.3% |
| Tool calls | 19 | 0 | -100% |
| Cumulative prompt | 317,360 | 2,475 | -99.2% |
| Provider tool schema | not observable | 0 tools / 0 B | exact ledger evidence |
| Tool/path errors | 4 | 0 | removed |
| Final answer | none; manually aborted | current task identified | pass |

The latest continuation answer was:

> 当前有活动任务：`trellis:dove-request-project-hardening`，状态
> in_progress，优先级 P2。你可以直接给出明确的实现请求，即可推进
> 下一项工作。

The Pi session contains zero `toolCall` blocks and zero mentions of
`.trellis/.runtime`, `.pi/tasks`, or `.pi/session.json`. The provider ledger
contains exactly one `provider.request.started` record with
`providerToolCount=0`, `providerToolSchemaBytes=0`, and
`cachePolicyVersion=2`. Its `request.planned` record also contains the audited
`projectAction="continue"` field.

## Containment and behavioral checks

- The fixture started with two failing tests. The execution turn changed only
  `src/invoice.js`, replacing an absolute discount with percentage math.
- `npm test` after the journey: 2 passed, 0 failed.
- The test file was unchanged.
- No `.agent-data` directory was created. Session and ledger evidence were
  routed to explicit temporary `sessions/` and `state/` directories.
- Read-only turns made no filesystem mutation and exposed no mutation tools.
- The final summary returned to the zero-tool Chat profile.
- No Trellis source, template, skill, workflow, or private runtime structure
  was modified or required by this test.

Machine-readable per-turn evidence is stored in `prompt-flow-e2e.jsonl` beside
this report. Raw temporary evidence is retained only as a reproducibility aid;
the checked-in report and JSONL contain the acceptance evidence needed by this
task.
