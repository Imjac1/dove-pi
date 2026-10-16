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

