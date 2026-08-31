# Dove Pi 0.1.5 Real-User Regression

## Environment

- Launcher: managed global `dove-pi`
- Dove Pi: `0.1.5+dea33bf`
- Pi: `0.84.3`
- Provider/model: `12321` / `deepseek-ai/DeepSeek-V4-Flash`
- Fixture root: `%TEMP%\\dove-pi-real-user-0.1.5-0901`
- Session root: `%TEMP%\\dove-pi-real-user-0.1.5-0901\\sessions`
- Repository files were not used as the mutation fixture.

## Results

| Case | Result | Provider calls | Input | Cache read | Output | Tools | Stop |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Response-only (`请只回复：收到`) | Partial | 1 | 1,897 | 0 | 30 | none | stop |
| Read-only diagnosis | Pass | 3 | 5,364 | 5,120 | 749 | find, read, read | stop |
| Repair and test | Pass | 5 | 19,343 | 32,000 | 732 | ls, find, read x3, replace, bash | stop |
| Follow-up read-only | Pass | 2 | 2,988 | 6,144 | 284 | read | stop |

The repair fixture changed only `invoice.js`; the model converted the flat subtraction
to percentage arithmetic and ran `npm test` with `1 pass / 0 fail`. The follow-up
performed one read and did not mutate or run a command. No repeated confirmation or
unbounded tool loop occurred in these four cases.

## Findings

1. The response-only request reached a normal terminal stop with no tools, but the
   provider returned `收到</think>你好。有什么我可以帮你的吗？` instead of exactly
   the requested text. This is a provider-output/content-conformance issue, not a
   release or gate failure.
2. The read-only request exposed only read/search tools in observed execution. Its
   workflow suggestion was still classified as `trellis-check`/`trellis-before-dev`
   guidance even though the user prohibited mutation and commands; the guidance was
   advisory and did not cause a write.
3. The repair request used one mutation and one test command, then settled normally.
4. The fixture created `.pi/`, session files, and JSONL evidence under the temporary
   root only. No repository task directory or source checkout was changed.

## Gate Policy Applied

- Local candidate validation runs `release:check` once for the exact four assets.
- The tag-triggered Windows workflow is the single remote source-quality and clean-
  checkout verification.
- Do not manually rerun the same five source gates after the tag workflow succeeds;
  only run targeted diagnostics for a failure or a new code change.
