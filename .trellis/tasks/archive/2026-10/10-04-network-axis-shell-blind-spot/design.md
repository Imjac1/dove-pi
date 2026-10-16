# Design: where a successfully loaded mode says what it could not enforce

## The behaviour gap, and it is one sentence

`personal-agent-mode-format.md` now says the honest thing - `network: none` is enforced at the **tool** boundary and
**does not cover anything a shell command reaches** - and a mode that declares an unenforceable claim is **refused at
load**, by name, with the reason. What has no place to go is the middle case, which is the common one: a mode whose
claims are *partly* enforceable loads successfully, and nothing on the reading side says which part was left unkept.

Measured today, from the two ends of the code that already exist:

- `extension.ts:2420` computes `refusedSandboxClaims = unenforceableSandboxClaims(activeWorkMode?.sandbox)` and those
  claims **refuse the load** (`activeWorkMode = undefined`, the mode is not active, every tool call is blocked).
- `extension.ts:2490` emits the line a person actually reads when a mode *does* load:
  `[Dove mode] <id> loaded from modes/<name> (<gateSemantics>, <bound>): <n> denied action(s) are refused, and <m>
  action(s) run only after you confirm them.`

So the gap is not "we cannot tell"; it is that **the load line reports what the mode denies and never what the mode
cannot see**. A mode declaring `network: none` prints `0 denied action(s)` and reads as a boundary, while its shell can
still fetch.

## Where the behaviour lives

The load line, `extension.ts:2490` - not the tool boundary and not the policy. The policy is already honest
(`action-policy.ts` blocks the eight names and nothing else, and the spec says so); the missing sentence is in the
report a person gets at the moment the mode becomes active. Putting it anywhere else would mean a reader has to go
looking, which is the failure mode this whole axis is about.

Two supporting places, for the same fact at different distances:

- **the ledger**, once per request plan, so a later reader of the record sees the unkept part without the TUI;
- **`/status`**, because that is where the other readings a person checks already are.

## Files this changes, and why each is necessary

| file | why |
|---|---|
| `src/pi-adapter/extension.ts` | the load line at `:2490` gains the unkept claims; the `/status` text beside the existing `hashlineEditTools=` field gains the same fact |
| `tests/host-work-mode.test.ts` | the case: a mode declaring `network: none` **and** keeping its shell must load, and its load line must say the shell is not covered |
| `.trellis/spec/backend/personal-agent-mode-format.md` | one sentence saying where the unkept part is reported, with an anchor a door can resolve |

## What this is not

- **Not enforcement.** Nothing here stops a shell command from reaching the network. The PRD's out-of-scope list holds:
  that needs host or OS egress control, which this repository does not own.
- **Not the `unenforceable` path.** That path refuses; this one reports a load that succeeded, and the two must not be
  merged - measured in the PRD's decision section: pushing the combination into `unenforceable` sets
  `activeWorkMode = undefined` and would refuse the shipped `code-development` itself.
- **Not a new axis.** The fact being reported is already computed; this gives it a reader.

## How the change is shown not to alter behaviour

The added text is a suffix on an existing notification and an existing status field. The case asserts both halves: the
mode **loads** (so nothing new refuses), and the line **names** the unkept claim (so the reading changed). A mode whose
claims are all enforceable must print the same line it prints today, which is the control the case carries.
