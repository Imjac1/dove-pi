# The cause rule met its first real refusal, and the entry below it is wrong about what that needed

**The correction first. The entry under this one says the cause rule "has still never run against a real provider
refusal" and that the verification "needs the same funded account as the two passes". Both halves are false, and the
second is the kind of error that costs a round: a refusal is produced by an *unfunded* account, which this machine has.
The only thing missing was a **build carrying the fix**, and that build is three lines away - `--launcher source` runs
this tree. The two passes need money. This never did.** It is now measured, and the sentence below is struck through by
cross-reference rather than quietly rewritten.

## Same credential, same scenario, two builds, minutes apart

| | released `0.2.6+f019a8d` (attempt 11) | the tree, `--launcher source` |
|---|---|---|
| duration | 17.4 s | 12.0 s |
| the provider's answer | `429` `insufficient_quota` | the same |
| `failureKind` / `failureReason` | `transient` / `http_429` | **`terminal` / `account-unpaid`** |
| the provider's own code in the record | **absent** | **`providerCode":"insufficient_quota"`, `"httpStatus":429`** |
| the attempt's outcome | `transient-failure` | `failed`, `number: 1` - no retry of a terminal state |
| the request's terminal | `completed`, `origin: session` | **`provider-account-unpaid`, `policyAbort: true`, `retryable: false`** |
| what a reader is given | nothing beyond `http_429` | *"The provider refused because the account behind the credential cannot pay (insufficient_quota)."* plus `nextAction`: *"Settle the provider account or restore its quota, then submit the request again."* |

**Attribution is measured rather than assumed**: `account-unpaid` and `providerCode` appear in **5 files under `src/`**
and in **0 files** of either installed version (`0.2.6+f019a8d`, `0.2.4+25039c9`). No installed build can emit the
fields the source build emitted, so what moved is the fix and not the window.

## What that closes, in the currency the seven hours were spent in

The recorded cost was seven attempts over about five hours against a quota that could never become payable, each one
recorded `transient`, under a plan that read "retry repeatedly, catch a good window". The fixed rule answers it inside the
record: `terminal`, the provider's own code, `retryable: false`, and a next action naming the account. The engine also
stopped after one attempt instead of retrying a terminal state.

**One difference to state rather than smooth**: the runner summarised this run `scenarioFailed: true` where the released
run said `false`. That is the policy abort arriving where the scenario expected a turn to complete, and it is the honest
reading of a terminal account refusal. It is written down because the next reader will see the flag move between two
otherwise identical runs and should not read it as a regression.

## What the source run does not establish

It is not a pass: `toolCalls: 0`, `outputTokens: 0`, one provider round, the project copy's suite still `1 failed, 115
passed`, pins 20090 / 5971 / 1305. It establishes one thing - that the cause rule reaches a real refusal and names it -
and that is what it was run for.

**Where the evidence for both runs is.** The temporary scenario roots - 1.09 GB across the three runs, almost all of it
the agent directory's package store copied per run - were removed once the readings were taken; the run logs, the two
ledgers, the suite readings and the summaries are kept outside the repository, in
`C:\Users\Macfy\Desktop\dsh\dove-two-project-reading\evidence\`. One gap is stated rather than papered over: **attempt 11
has no `summary.json` there**, because its summary was piped to a filter instead of a file. Its run log, ledger and suite
reading are present, and the numbers it produced are the table above.

# The plan the money still gates

Written so the passes are a sequence rather than a rediscovery. Both run through the **installed** launcher on
`0.2.6+f019a8d`, the build users have, because that is what this child's criterion is about.

1. **The gate.** Probe the chosen credential with a one-token `POST /chat/completions`; only a `200` starts a pass. A
   refusal costs 12-17 s and a round, which is why the gate exists - and note that a refusal is now *legibly* terminal,
   so the probe is a formality rather than the only way to find out.
2. **Project one.** `p1-copy` is ready: pins 20090 / 5971 / 1305, no caches, the recipe's own-path predictor clean, and
   its baseline read in place (`1 failed, 115 passed`).

   ```bash
   node scripts/real-dove-blackbox.mjs \
     --cwd "C:\Users\Macfy\Desktop\dsh\dove-two-project-reading\p1-copy" \
     --case-id p1-pass1 --output "...\runs\p1-pass1.jsonl" \
     --scenario tests/fixtures/scenarios/immutable-directive-work-as-a-task.json \
     --provider real --launcher dove-pi --timeout-ms 3600000
   ```

   Budget 1 h, and **no `DOVE_PI_MAX_REQUEST_ATTEMPTS`** - the shipped default of three is what says anything about the
   default a customer gets, which is the lesson pass 3 of the 10-05 trio left behind.
3. **Project two**, and this step is the one the old plan did not have. Generate, then **bind the mode**: the runner has
   no work-mode flag, and `extension.ts` resolves the mode only from the project's own declaration
   (`resolveWorkModeSelection({ workspaceRoot: modeRoot, workspaceMode })`, `src/core/work-mode.ts:978` names it
   `.dove/mode.json`). So the generated project needs an eighth file beside the generator's seven:

   ```bash
   node .trellis/tasks/10-16-two-project-reading/research/node-project-fixture.mjs <dest>
   # then <dest>/.dove/mode.json = {"schemaVersion":1,"mode":"code-audit"} - valid JSON, LF, no BOM. It measures 39 B
   # compact; the "55 B" this plan first carried is the graded clone's own file, which declares the longer
   # `code-development` and is pretty-printed. What the loader needs is the two fields, not the length. Without the
   # binding the pass runs with no mode at all and proves nothing about the read-only axis.
   ```

   **And this step is verified rather than planned**: the generator was run into a throwaway directory, the binding was
   written, and the run announced `[Dove mode] code-audit loaded ... 3 denied action(s) are refused, and 2 action(s) run
   only after you confirm them` with `workMode=code-audit, networkAxis=none` - against `code-development`'s
   `networkAxis=shell-uncovered`. So the mode loads under the installed host, the binding is what selects it, and the
   read-only axis is still the one that has only ever been seen under a provider that never answered - `doveState: false`
   and `formalTaskCount: 0` on a run that did no work. The throwaway directory was removed; the
   pass still generates its own, because the byte counts have to be printed in the same run that asserts them.

   Then the same command with `--cwd <dest>` and `--case-id p2-pass1`. The criterion is deliberately **not** green: the
   suite must still read `1 failed`, the instrument's bytes unchanged, and the run's own record must show the mutation
   tools never ran or were decided against.
4. **The readings**, both passes: the run's own project copy's suite, the instrument's bytes, the source clone's three
   pins, and the build identity (`0.2.6+f019a8d`, matching the release child's `releaseId`). Then this file gets both
   builds' identities, both sets of numbers, and every attempt that did not count with the reading that made it not
   count.
5. **Cleanup**: the copies and any temporary install go, the graded clone is left at its three pins with no caches, and
   the archive tax is paid - the four documentation doors, and a scan for curated entries pointing into this directory.

**Rollback**: this child writes nothing but `findings.md`, its install and its copies are disposable, and a defect either
pass finds becomes the parent's map rather than an unplanned repair here.

# The eleventh attempt: the released build answers 429, and it is the build before the cause fix

Run on 2026-10-17, after a probe of both credentials refused (`429 insufficient_quota` on the primary, `402
insufficient_balance` on the backup). The pass was fired anyway, because the product's own ledger is a different reading
from a probe and because the instruction was to run it. It did not count.

```bash
node scripts/real-dove-blackbox.mjs \
  --cwd C:\Users\Macfy\Desktop\dsh\dove-two-project-reading\p1-copy \
  --case-id p1-pass1 --output ...\runs\p1-pass1.jsonl \
  --scenario tests/fixtures/scenarios/immutable-directive-work-as-a-task.json \
  --provider real --launcher dove-pi --timeout-ms 3600000
```

## It does not count, and the three readings say so rather than the summary

| Reading | Value |
|---|---|
| duration / `settled` / `scenarioFailed` | 17.4 s / true / false |
| `toolCalls` / `outputTokens` / `stopReasons` | **0 / 0 / `["error"]`**, one provider round |
| the run's own project copy | suite still `1 failed, 115 passed`; pins 20090 / 5971 / 1305 |
| the copy the pass was handed | pins unchanged, still no caches |
| the source clone | pins unchanged at 20090 / 5971 / 1305 |
| what the run wrote | intake only - `doveState: true`, `formalTaskCount: 1`, 5 formal artifacts |

**The ledger's own sentence for it**, from the run's ledger (`dove-state/execution.jsonl`, kept as
`p1-pass1.execution.jsonl` in the reading's evidence directory):

```json
{"kind":"provider.request.completed","details":{"stopReason":"error",
 "usage":{"input":0,"output":0,"totalTokens":0},
 "failureKind":"transient","failureReason":"http_429","durationMs":619}}
```

Usage all zeros and no provider `code` in the entry - the same shape as the seven attempts that cost five hours.

## The correction that has to be stated with it, and it is measured

**This is not evidence that the cause fix fails. The fix is not in the build that answered.** The provider-cause repair
landed in the tree as `e3c84a5`, and:

| `src/core/failure-reading.ts` | bytes | carries `insufficient_quota` / `insufficient_balance` |
|---|---|---|
| the tree | **20277** | yes |
| installed `0.2.6+f019a8d` | 18990 | **no** |
| installed `0.2.4+25039c9` | 18990 | **no** |

So `failureKind=transient / failureReason=http_429` is the correct behaviour of a build that predates the repair, and the
sentence this repository already holds - *a cause the provider names outranks the status it arrived with* - has **still
never run against a real provider refusal**. ~~That verification is owed, and it needs the same funded account as the two
passes: a refusal is exactly the event it is written for, so no amount of a funded account's *success* would test it
either.~~ **Both sentences are wrong and the section at the top of this file is the correction**: a refusal is what an
unfunded account produces, the only missing ingredient was a build carrying the fix, and `--launcher source` supplied it
12 minutes later. The verification is done. Recorded here rather than repaired: this child's contract is that a defect it
finds becomes the parent's problem.

**And the install keeps two builds side by side** - `C:\Users\Macfy\AppData\Local\DovePi\app\versions\` holds
`0.2.4+25039c9` (the `--check` rollback point) and `0.2.6+f019a8d` (current), both carrying the same pre-fix
`failure-reading.ts`. `dove-pi` resolves to `...\Local\DovePi\bin\dove-pi.ps1`.

## What the attempt does establish

The managed path itself is intact on the released build: the launcher, the mode line (`code-development`, 1 denied action
refused, `networkAxis=shell-uncovered`), the task intake, and the ledger's fidelity - it recorded a settled run with zero
work as a settled run with zero work rather than as success. What it does not establish is anything about the flow: no
tool ran, so no criterion moved.

# Re-measured 2026-10-17: the fixtures are still ready, and the funds still are not

This child was resumed in a later session, and the whole state was taken again rather than quoted from the entry below.
Three of the four readings came back identical; the fourth is why the two passes are still owed.

## The blocker, probed once more, unchanged

| Credential | Host | Today's answer |
|---|---|---|
| `atr_Yvio…` (the one in effect) | `api.atria-asi.ai` | `429` - `{"error":{"message":"Token quota exhausted.","type":"atria_api_error","code":"insufficient_quota"}}` |
| `sk-KHY0l…` (the backup config) | `maas-api.antdigital.com` | `402` - `{"error":{"message":"Insufficient balance: apikey status is overdue","type":"insufficient_balance","code":"insufficient_balance"},"trace_id":…}` |

Both were probed with a one-token `POST /chat/completions` against the same model ids the passes use, reading the keys
out of `~/.pi/agent/models.json` and `~/.pi/agent/models.json.bak-before-replay` without printing them and without
writing the operator's files. **Neither answer is a state that waiting changes**: an exhausted quota and an overdue
apikey are account states, which is the same conclusion the tenth attempt reached, and the reason the ledger's
`failureKind=transient` was the wrong word for them.

## What came back identical

- **The build identity, re-read rather than remembered.** `dove-pi --version` reads `Dove Pi 0.2.6 (Pi 1.0.0)`, and
  `dove-pi update --check` reads `Latest stable release: v0.2.6` / `Current release: 0.2.6+f019a8d` / `Previous release:
  0.2.4+25039c9`. That is the `releaseId` the release child recorded, so a pass run today would still measure the build
  users have.
- **The graded clone's three pins**, read on the source at `C:\Users\Macfy\Desktop\dsh\dove-graded\cachecontrol`:
  `cachecontrol/controller.py` 20090 B, `tests/conftest.py` 5971 B, `tests/test_immutable.py` 1305 B, and **no caches**
  (searched for `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`). HEAD is still `2627d9b`; the two files the
  recipe calls instruments rather than checkouts still show as `M` and `??`; `.dove/mode.json` is still 55 B.
- **The second project still reproduces**, which is the one reading worth re-running rather than trusting. The generator
  was run into a fresh directory twice, and both runs printed the same seven sizes - `instrument.lock.json 662`,
  `package.json 108`, `src/cli.mjs 152`, `src/ledger.mjs 161`, `test/instrument.test.mjs 765`, `test/ledger.test.mjs 346`,
  `test/report.test.mjs 301`, **2495 bytes in 7 files** - and `node --test` under Node v24.14.1 still reads `tests 4 /
  suites 3 / pass 3 / fail 1`, failing on `actual: 0.30000000000000004, expected: 0.3`. The directory was removed after
  the reading. So "the instrument is byte-identical afterwards" remains a comparison against bytes produced in the same
  run rather than against a number someone typed.

## Why no substitute pass was run

The repository can drive the flow against its own faux provider, and for one of this child's criteria that would look like
an answer - a read-only pass whose record shows the mutation tools never ran. It was not taken, because it would be a
reading of a different artefact: the faux provider does not do the work, so project one's criterion (the copy's suite
going `1 failed, 115 passed` to `116 passed`) could not move, and the pass would be a statement about the harness's own
fake rather than about the build users have. The two passes need an account with funds, and that is the operator's to
settle.

## Where this leaves the child

Prepared, and blocked on exactly what it was blocked on before - now re-measured rather than assumed. Nothing else in the
record is outstanding: the build identity is settled and matches the release child, both fixtures are ready, and each pass
is one command once a credential answers.

# Findings so far: ten attempts, none counts, and the blocker is not the one this record first gave

## The ninth and tenth attempts: both credentials are out of funds, and the ledger calls that transient

The way was cleared for a second provider config, so the route was built and tested **before** anything long was spent.

**The route is proven, at the HTTP level, and it works.** `~/.pi/agent/models.json.bak-before-replay` names a second host,
`https://maas-api.antdigital.com/v1`. Its key is valid: `GET /v1/models` answered **200 with 20 models** (the primary host
answers `["Atria-Dawn"]` alone - the `Atria-Dawn-Preview` id the 2026-10-11 reading saw listed is no longer in the
catalogue), and `POST /chat/completions` answered **200 with tool calls** for `atria-dawn-preview`, `kimi-k3`,
`glm-5.3-flashx` and `mimo-v2.6-pro` - `finish_reason=tool_calls`, the tool name and its arguments correct. The model id
is the one the recorded baseline used, so the instrument's identity is preserved rather than replaced.

Both attempts ran through the managed launcher on the same fresh copy of the graded clone, with the customer's own
request, `PI_CODING_AGENT_DIR` pointed at a **copy** of the agent directory carrying that config. The operator's own files
were not edited.

| Attempt | Config | Duration | `toolCalls` | `outputTokens` | the run's own record |
|---|---|---|---|---|---|
| `p1-pass1-h` | second host, `contextWindow` 200000 | 18 s | 0 | 0 | `stopReason=error`; provider body: `402 Insufficient balance: apikey status is overdue` |
| `p1-pass1-i` | the same, `contextWindow` 256 | 17 s | 0 | 0 | `terminal=invalid-configuration MODEL_CONTEXT_OVER_BUDGET`; no provider call |

**Neither counts**, by the same rule as the eight before it: for both, the three readings are unchanged - the copy's suite
still `1 failed, 115 passed`, the instrument still 1305 / 5971 B, `controller.py` still 20090 B.

**The ninth attempt's cause is the provider's own words, and the ledger does not carry them.** The session log holds the
error verbatim: `402: {"message":"Insufficient balance: apikey status is overdue","type":"insufficient_balance","code":"insufficient_balance"}`.
The ledger's entry for the same call reads:

```json
"failureKind": "transient",
"failureReason": "reviewed-provider-message"
```

`usage` is all zeros, and the provider's own `code` - `insufficient_balance` - is nowhere in that entry. A reader gets
"transient, reviewed the provider's message", which is an instruction to retry. **There is nothing to retry**: an apikey
whose status is overdue does not become payable by waiting, exactly as an exhausted quota does not.

**Both credentials are exhausted, and two different account states carry the same classification:**

| Credential | Host | The provider's answer | What the ledger recorded |
|---|---|---|---|
| `atr_…` (the one in effect) | `api.atria-asi.ai` | `429 insufficient_quota` - "Token quota exhausted" | `failureKind=transient failureReason=http_429`, for 7 attempts over ~5 h |
| `sk-…` (the backup config) | `maas-api.antdigital.com` | `402 insufficient_balance` - "apikey status is overdue" | `failureKind=transient failureReason=reviewed-provider-message` |

**The cost is the whole of this child's elapsed time, and one field would have ended it.** For the first credential the
state is `http_429` and nothing more; the status does not separate a rate limit from an exhausted quota, and a hand probe
of the same key on a 25-token request returns `insufficient_quota` with the message "Token quota exhausted". Whether each
of the seven was a quota refusal or another 429 is not something the seven records can be asked - but the operator's plan
of 2026-10-11, "retry repeatedly, catch a good window", was built on an assumed 5-10% transient failure rate, and the
actual rate was 100% with the reason present in every response and absent from every record. The decision that came from
it was re-examined in the section below and survived only in part.

## The tenth attempt settles the eighth, and the eighth's cause was one field of its own making

The eighth attempt is recorded above as `provider.request.rejected` "with no `failureKind` and no `failureReason` at all",
attributed first to a revoked credential and then, when that was tested, to a model id that does not exist at the second
host. **Both attributions are false by measurement** (the credential answers 200; the model id answers 200), and the
record's own suspicion - that the one field left differing from a workable config was `contextWindow: 256` - is **the
answer**. The tenth attempt was run to decide it, and by then the account state was constant, so the field was the only
variable.

With `contextWindow: 256` the run produces exactly the eighth attempt's event, and the ledger entry for it is not silent
at all:

```json
"kind": "provider.request.rejected",
"contextWindow": 256, "inputTokens": 2318, "overflowTokens": 21014, "availableInput": -18696,
"code": "MODEL_CONTEXT_OVER_BUDGET",
"message": "Model payload exceeds context window by 21014 token(s); provider dispatch was refused."
```

**`provider.request.rejected` is the record of a request the budget check refused before dispatch** - it is emitted
alongside `model.budget.rejected`, with `providerRound.used = 0` and no `provider.request.started` anywhere in the run.
It is not a credential event, and the cause is one field of the config the eighth attempt built for itself: it copied the
backup `models.json`, whose `contextWindow` is 256, while presenting that number in its own comparison table. The record
then spent a session diagnosing a credential that was never broken.

**So the second half of the eighth attempt's conclusion is also wrong**, and in the direction that matters: that entry does
carry `code` and `message`, plus a `request.terminal` naming `origin: model-budget`, `retryable: true` and the way out -
*"Use a smaller context or model, then retry."* What the previous session read was the event kind. The field it reported as
absent was there, in the ledger, under the event it quoted.

## What this corrects, section by section

- **"Neither credential works"** - false. Both authenticate; both are *unfunded*, which is a third thing.
- **"A rejected credential is revoked or not entitled"** - false, and it was the leading explanation for the eighth
  attempt's failure. The rejection was the context window, and the credential has answered 200 all along.
- **"This is outside this session's reach - it needs either the window to pass or a credential this machine does not
  have"** - false on both counts. Waiting was never the remedy for either credential, and the second credential was on
  this machine, working, and is the same model id the baseline used.
- **"A sustained rate limit rather than a window"** - the reading is right and the conclusion is not: it is a quota state,
  and no window opens in a quota state.
- **"`provider.request.rejected` carries no reason field"** - contradicted by measurement; the field is `code`, with a
  `message` beside it.
- **What the eighth attempt got right, and it is worth keeping**: a reader of the run's *summary* cannot tell one cause
  from another, and the two config files had to be diffed by hand. That is still true, for a different reason than the one
  given - the summary does not carry the ledger's `code`/`message`, so the cause is one file away rather than absent, and
  a reader who stops at the summary pays the whole cost again.

**One product observation that survives all of this, measured twice in one evening:** `insufficient_quota`,
`insufficient_balance` and a genuine rate limit all arrive as `failureKind=transient`, and the field that distinguishes
them is the provider's `code`, which the ledger records in neither case. Seven attempts over five hours is the price of
that, and this repository already holds the rule it breaks - *"a message names the cause its own code can check, not the
one that reads well."*

## What is still owed

**The build identity is settled and matches the release child.** The install self-reports `Dove Pi 0.2.6 (Pi 1.0.0)`;
`dove-pi update --check` reads `Latest stable release: v0.2.6` / `Current release: 0.2.6+f019a8d` / `Previous release:
0.2.4+25039c9`, which is the `releaseId 0.2.6+f019a8d` the release child recorded as tracking the tagged commit. So
whatever a pass measures here measures the build users have.

**No counting reading could be taken, and the reason is now payable rather than mysterious.** The child's remaining
criteria are the two passes. Nothing about the product prevents them: the route answers 200 with tool calls, both projects
are built and baselined, and the runner carries the config through `PI_CODING_AGENT_DIR` without touching the operator's
files. What they need is an account with funds - `insufficient_quota` on one and `insufficient_balance` on the other - and
that is the operator's to settle, not this session's to work around. The honest state of this child is therefore
**prepared, blocked on funds, and no longer blocked on a diagnosis**.

**Both fixtures are ready and the three readings are recorded for both**, so the two passes are one command each once the
account is funded: project one's copy at `1 failed, 115 passed` with its pins at 20090 / 5971 / 1305 and its caches
removed, project two generated from its own script with all seven declared sizes reproduced and `tests 4 / suites 3 /
pass 3 / fail 1`.

**Where the ten attempts' evidence is.** Nothing was added to this repository but this file. The two counting-attempt
records - the redacted run logs, their full summaries, and the `execution.jsonl` ledgers that carry the `code`/`message`
entries quoted above - are in `C:\Users\Macfy\Desktop\dsh\dove-two-project-reading\evidence\`, outside the repository. The
project copies, the generated fixture and the temporary agent directory were removed; the clone is back at its three pins
with no caches.

# Findings so far: two attempts, neither counts, and the reason is the same

## What was measured before the passes

- **The managed install was refreshed to the release**, which is the load-bearing precondition of this whole child: it
  reported `0.2.1+source.22a34bf6d668` and now reports **`Dove Pi 0.2.4 (Pi 1.0.0)`**, with `dove-pi update --check`
  having listed `Latest stable release: v0.2.4`. The refresh needed three attempts - the first two died on
  `UNEXPECTED_EOF_WHILE_READING` while downloading the zip, the same proxy flakiness this session has hit since its
  first request.
- **A fresh copy of the graded clone** for each pass, with the three pins read before and after
  (`cachecontrol/controller.py` 20090 B, `tests/conftest.py` 5971 B, `tests/test_immutable.py` 1305 B), the source clone
  never used as a cwd, and caches removed after any baseline measurement - the recipe's own rule, because a copy carrying
  `__pycache__` tells an agent where the original lived.
- **The baseline suite reads `1 failed, 115 passed`**, which is the recorded baseline for this clone.

## The two attempts, and why neither counts

Both were launched through the installed launcher (`--launcher dove-pi`) with the customer's own 958-character request,
`--mode code-development`, and a one-hour harness timeout.

| Attempt | Duration | `settled` | `toolCalls` | `outputTokens` | `stopReasons` |
|---|---|---|---|---|---|
| `p1-pass1` | 21 s | true | 0 | 0 | `["error"]` |
| `p1-pass1-retry` | 31 s | true | 0 | 0 | `["error","error"]` |
| `p1-pass1-b` (round 5) | 26 s | true | 0 | 0 | `["error"]` |

The ledger names the cause for the first and the third: `kind=provider.request.completed stopReason=error failureKind=transient
failureReason=http_429 durationMs=1432`. The second shows the host's own `auto_retry_start` … `auto_retry_end,
success=false` - so the retry ran and hit the same window.

**Three attempts across roughly an hour and a half, the same `http_429` each time**, so the rate-limited window is not a
momentary thing and a fourth attempt now would be spending the round to learn the same sentence again. **No remedy was
available to try from here**: the model and credential configuration was not found at any of the paths I looked in
(`~/.pi/models.json`, `%APPDATA%\pi`, `%LOCALAPPDATA%\pi`), so there is no second provider to switch to without asking
the operator. Each attempt ran against the released build - the install self-reports `Dove Pi 0.2.4 (Pi 1.0.0)` - so
when the window opens, the run that counts is one command away, not a re-installation.

**Neither counts**, by this child's own rule: the criterion is three readings changing (suite, held-out instrument,
controller), and nothing changed for either - the copy's suite read `1 failed, 115 passed` again, `controller.py` 20090 B
again, the instrument 1305 / 5971 B again. The reading that makes them not count is the ledger's own: **zero tool calls
and zero output tokens**, so no work happened.

**What the runtime did correctly throughout, which is itself a reading:** it classified the failure as transient, it
retried, it kept the ledger faithful instead of reporting a settled run as success, and it wrote nothing into the project
beyond intake - `doveState: true, formalTaskCount: 1`, five formal artifacts. The mode line also arrived intact and
self-consistent: *"1 denied action(s) are refused, and 0 action(s) run only after you confirm them… Its 'sandbox.network:
none' is enforced at the tool boundary, and the axis does not cover a command run through the shell, which this mode
still permits."*

## The second project is built, and the source clone's state needs a precise reading

**The Node project exists and its baseline is recorded**, so the second reading is one command away when the provider
window opens. It is generated, not committed (R4): `.trellis/tasks/10-16-two-project-reading/research/node-project-fixture.mjs`
writes seven files and prints their byte sizes, so the "instrument unchanged" assertion is recomputable rather than
dependent on a file that can rot. Its baseline: **`tests 4 / suites 3 / pass 3 / fail 1`** under Node v24.14.1, with the
failing case being the customer's own complaint - `actual: 0.30000000000000004, expected: 0.3` - which is the work a
**read-only** mode cannot do, so "the suite stays failing" is the honest outcome rather than a disappointment. The
instrument is `test/instrument.test.mjs` plus the `instrument.lock.json` it checks every other file against, so any write
to the project turns it red: for a read-only pass that makes "it did not write" checkable, and it should be read as a
tripwire rather than as a held-out behavioural test.

**The graded clone is at its three pins** - `controller.py` 20090 B, `tests/conftest.py` 5971 B,
`tests/test_immutable.py` 1305 B, no caches, its suite still `1 failed, 115 passed`. It is **not** a clean checkout, and
the recipe says so: `tests/conftest.py` shows as modified and `tests/test_immutable.py` as untracked because those are the
**instrument bytes a previous session wrote into it** - "the original was never committed and is not on this machine". One
item is not explained by the recipe: **`.dove/` is present in the source clone**, which means some earlier pass used the
clone itself as its cwd, against the recipe's rule that passes run on a copy. Nothing was deleted here; the accurate
statement of the third criterion is therefore "the three pinned files are unchanged", which is how the criterion is
worded, rather than "the tree was never touched".

## The eighth attempt: the other credential on this machine, and why this is a blocker

The operator chose "give me another model or credential", so I went looking for one instead of asking where it is, and
found that the question had already been answered on disk: `~/.pi/agent/` holds **`models.json.bak-before-replay`**, the
configuration from before an earlier replay experiment, alongside the current one. Comparing them field by field (values
redacted) is the whole story:

| | current, in effect | the backup |
|---|---|---|
| `apiKey` | `atr_…` | `sk-…` |
| `baseUrl` | `https://api.atria-asi.ai/v1/` | `https://maas-api.antdigital.com/v1` |
| model id | `Atria-Dawn-Preview` | `atria-dawn-preview` |
| `contextWindow` | 200000 | 256 |

The operator's files were **not** edited. A full copy of the agent directory (367 MB, 15,322 files - the run needs its
package store) was made with the backup `models.json` in place, and the pass ran with `PI_CODING_AGENT_DIR` pointed at it.

| Attempt | Duration | `toolCalls` | the run's own record |
|---|---|---|---|
| `p1-pass1-g` (project one, eighth) | 16 s | 0 | **`provider.request.rejected`** |

**Neither credential works, and the two failures say different things.** The current one is **rate-limited**:
`provider.request.completed … failureKind=transient failureReason=http_429`, seven times over five hours. The backup one is
**rejected**: `provider.request.rejected`, with no `failureKind` and no `failureReason` at all. A rejected credential is
revoked or not entitled; a 429 is a limit that will lift. So the state is: this machine has **one working credential that
is currently limited**, and no second one that works. **That is outside this session's reach** - it needs either the window
to pass or a credential this machine does not have.

**A product observation, worth keeping.** `provider.request.rejected` carries **no reason field**, while a failed
completion carries `failureKind` and `failureReason`. A reader trying to tell "revoked credential" from "wrong model" from
"endpoint moved" gets nothing from the record of the rejection - and the runner's own stderr in that run was only the two
extension warnings. Diagnosing it required diffing two config files by hand.

## The seventh attempt, the first one for project two, and the one positive datum in seven tries


| Attempt | Duration | `toolCalls` | `outputTokens` | the ledger said |
|---|---|---|---|---|
| `p1-pass1-f` (project one, round 8) | 32 s | 0 | 0 | `failureKind=transient failureReason=http_429` |
| `p2-pass1` (project two, round 8) | 31 s | 0 | 0 | `failureKind=transient failureReason=http_429` |

**Neither counts**, and both projects' criteria are unchanged: project one still reads `1 failed, 115 passed` with its pins
intact, and project two still reads `tests 4 / pass 3 / fail 1` with all seven file digests identical to its baseline. That
is seven `http_429` attempts for project one and the first for project two, spanning about five hours - so this is a
sustained rate limit rather than a window, and a further attempt would buy the same sentence.

**What the two runs do establish, and it is the first positive datum about the read-only mode in this session.** The two
passes differ in exactly one thing besides their project - the mode - and their own records differ with it:

| | `code-development` (writable) | `code-audit` (`filesystem: read-only-source`) |
|---|---|---|
| `artifactEvidence.doveState` | `true` | **`false`** |
| `formalTaskCount` / `formalArtifactCount` | 1 / 5 | **0 / 0** |

Under the **same** provider failure and the same driver, the writable mode's run created its intake task in the project and
the read-only mode's run created **nothing** - not even the artifacts intake writes for itself. That is a partial
confirmation of the mode axis, and it is worth exactly what it measures: **intake was refused by the read-only claim**,
not that a completed audit kept its hands off the source. This child's criterion asks for the record to say the run did
not write; the record says **nothing was written at all**, which is the stronger statement - but it is a statement about a
run that did no work, so it must not be read as an audit's result.

## The sixth attempt, and the drifting build it caught


| Attempt | Duration | `settled` | `toolCalls` | `outputTokens` | `stopReasons` | the install said |
|---|---|---|---|---|---|---|
| `p1-pass1` | 21 s | true | 0 | 0 | `["error"]` | 0.2.4 |
| `p1-pass1-retry` | 31 s | true | 0 | 0 | `["error","error"]` | 0.2.4 |
| `p1-pass1-b` | 26 s | true | 0 | 0 | `["error"]` | 0.2.4 |
| `p1-pass1-d` | 41 s | true | 0 | 0 | `["error","error"]` | 0.2.4 |
| `p1-pass1-e` (round 8) | 24 s | true | 0 | 0 | `["error"]` | **0.2.4 while 0.2.6 is Latest** |

**The sixth attempt did not count either**, for the same reason as the five before it - zero tool calls, zero output
tokens, the three readings unchanged - but it caught something the five could not: the managed install was reporting
**0.2.4** while **0.2.6** is the current release. That is exactly what this child's first requirement and its criterion
about reading the version back exist for: **the version is the first reading**, and a pass against a superseded build
would have been a reading of the wrong artefact - published, honest-looking, and about a release users no longer get.

So the install was refreshed before anything else: `dove-pi update` pulled `0.2.6+f019a8d` from the release, reporting
`Previous release: 0.2.4+25039c9` as the rollback point, and `--version` now reads `Dove Pi 0.2.6 (Pi 1.0.0)`. That
update is also the strongest evidence this child has about the **user's** path: it fetched the real archive from GitHub
with no local artefact involved.

**One thing I looked for and did not find**, stated because it looks like a defect and is not: requesting
`releases/latest/download/release.json` returned nothing. That was **my guess at the URL**, not a check of the release -
`release.json` in v0.2.6 was downloaded and read directly (`releaseId 0.2.6+f019a8d`), and the launcher's own update path
works. Whether that particular `/latest/download/` URL is meant to serve the manifest is not something this child
established one way or the other.

