# Three customer-path passes, and what two of the attempts cost

Measured 2026-10-12/13. The objective was to run the whole flow three times, confirm that installation and use match a
customer's logic, and only then publish. This is the evidence, including the attempts that did not count.

## What a pass is

A pass is the customer's own two steps, in order:

1. **Install**, the way the README tells a person to: `install.ps1` fetched from
   `releases/latest/download/`, run with the proxy this machine needs, then `dove-pi --version` and `dove-pi doctor`.
   Measured once, against the published **v0.2.1**: `Dove Pi 0.2.1 (Pi 1.0.0)`, managed install healthy, 13 extensions
   healthy.
2. **Use**, through the installed launcher (`--launcher dove-pi`, the same managed launcher a person gets), on the graded
   clone: first the `status-line-only` scenario, which calls no tool and shows what a customer sees on starting in a
   project, then `immutable-directive-work-as-a-task`, which is the whole flow.

The passes ran against an install of **the tree being released** (`0.2.1+source.22a34bf6d668`), not against the published
v0.2.1, because the tree had gained the shell-command ceiling by then and the passes are what the release is supposed to
stand on. The published-v0.2.1 install was measured separately, above.

## The three passes that count

| | Pass 1 | Pass 2 (c) | Pass 3 (b) |
|---|---|---|---|
| settings | default attempts, 45 min budget | default attempts, 75 min budget | **`DOVE_PI_MAX_REQUEST_ATTEMPTS=10`**, 75 min budget |
| steps settled | 0 ✓ 1 ✓ 2 ✓ 3 ✓ | 0 ✓ 1 ✓ 2 ✓ 3 ✓ | 0 ✓ 1 ✓ 2 ✓ 3 ✓ |
| terminal | `completed` | `completed` | `completed` |
| `settled` / `harnessTimedOut` / `scenarioFailed` | true / false / false | true / false / false | true / false / false |
| duration | 29.7 min | 29.0 min | 36.9 min |
| the copy's own suite | **116 passed** | **116 passed** | **116 passed** |
| the judging instrument | 1305 / 5971 B | 1305 / 5971 B | 1305 / 5971 B |
| the formal task | **archived** | **archived** | **archived** |
| the source clone | **20090 B, untouched** | **20090 B, untouched** | **20090 B, untouched** |

Every pass: the baseline was `1 failed, 115 passed` and the run left it at `116 passed`; `test_immutable.py` and
`conftest.py` are byte-identical to the recipe, so the library was fixed rather than the test; the closing sequence ran
`task verify` → `task convergence status` → `task finish` → `task archive <native:goal-…>`.

**The settings differ and that is recorded rather than smoothed.** Passes 1 and 2 completed on the shipped default of
three attempts. Pass 3's first attempt did not, and the field-run contract's own precondition - "room for the retries a
long run needs" - is what the third pass used. A raised budget shows the flow completes; it does not show it completes
under the default, and passes 1 and 2 are the ones that say anything about the default.

## The attempts that did not count

| attempt | what happened | whose |
|---|---|---|
| pass 2 (a) | the first provider request never answered; the ledger stopped one millisecond after `provider.request.started` and the run sat until killed | the endpoint's window |
| pass 2 (b) | the work finished (`116 passed`), the run burned its 45-minute budget, the wrap-up never ran, `harnessTimedOut: true` | the endpoint was slow: single provider rounds measured at 337 s, 168 s, 110 s |
| pass 3 (a) | the work finished (`116 passed`), step 1's request ended `failed/attempt-limit` after three attempts, and the process then hung in shutdown for 21 minutes with the ledger frozen | the default retry budget, and then a provider call with no answer |

**None of the three is a product defect.** Two are the endpoint being slow or silent - the same thing the field-run
contract already says is not reproducible - and one is the shipped retry bound doing what it says. They are recorded
because a pass that does not count is evidence about the window, and because pass 3's hang is the behaviour the ledger
already describes: a call that never returns is named only by the host's watchdog, measured twice before at six and a
half minutes and at forty-five.

## The two defects the passes found, and their fixes

**One: the copy of the project is not a fence.** The first pass reported success and the *next* pre-flight found the
source clone modified - `controller.py` at 21,168 B where the recipe pins 20,090. The agent had learned the source's
absolute path from a `__pycache__` file inside its own copy, and ran 23 commands against the original, `git stash`
among them. The carrier exists because **measuring the baseline in place writes those caches**, so the recipe gained a
step: clean them after every measurement. Full account in `the-copy-is-not-a-fence.md`.

**Two: a shell command the aggregate rule does not recognise had no timeout at all.** The attempt after that hung a
whole run on `find / -name "controller.py" -path "*cachecontrol*"`, and the ledger recorded `timeoutApplied: false`
while the run sat there. The record was accurate and the run was still lost. Every shell command now gets a ceiling -
900 seconds, `DOVE_PI_SHELL_CEILING_SECONDS` to raise or disable - while aggregate verification keeps its purposeful
240 seconds; the ledger tells the two apart by `timeoutReason`.

**And the fix was exercised in the field before the passes were done.** Pass 3's attempt ran the same shape again:

```
11:21:31  tool.started   bash   timeoutApplied: true, 900s, reason: command-ceiling   (find / -name "code-quality-warnings.json" …)
11:36:33  provider.request.started                                                   ← 900 seconds later, the run continued
```

That command cost a whole run the first time and cost one tool call the second.

## What this establishes, and what it does not

- **Establishes**: three times, on the installed build, the whole flow ran from a frozen acceptance record to an archived
  task, the project's own suite went from one failure to green with the instrument untouched, and the source clone was
  never written to. Installation and use both work through the paths the README names.
- **Does not establish**: anything about the default retry budget from pass 3 (it used the knob), and nothing about a
  customer's *interactive* use - the passes drive the launcher's RPC path, which is the same machinery the TUI uses, but
  no pass typed into the TUI.
- **One measurement worth keeping**: a `dove-pi` run that a customer starts has no budget of its own; the budgets in the
  table are the harness's. What a customer waits for is the endpoint.
