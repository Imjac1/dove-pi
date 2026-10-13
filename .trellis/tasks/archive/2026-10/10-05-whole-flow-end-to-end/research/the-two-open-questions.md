# The two questions the last report left open

Measured 2026-10-13. Both were raised as open questions rather than defects, and both now have an answer, a fix or a
measurement, and a record.

## One: the latest Pi channel broke the adapter, and the fix is structural

The compatibility matrix went red on the v0.2.2 push with `Property 'prompt' does not exist on type
'BeforeAgentStartCustomEvent'` at four places in `src/pi-adapter/extension.ts`. The v0.2.1 run of the same workflow had
been green, so the drift happened upstream between them.

**What changed**, read from the two versions side by side. The pinned 1.0.0 had one interface for `before_agent_start`
with `prompt` on it. 1.2.0 split it:

```ts
interface BeforeAgentStartEventBase { type: "before_agent_start"; systemPrompt: string; systemPromptOptions: … }
interface BeforeAgentStartUserEvent   extends Base { messageType: "user";   prompt: string; images?: … }
interface BeforeAgentStartCustomEvent extends Base { messageType: "custom"; message: CustomMessage }
type BeforeAgentStartEvent = BeforeAgentStartUserEvent | BeforeAgentStartCustomEvent;
```

So `prompt` exists on one variant and not on the other, and Dove read it unconditionally.

**It was worse than a typecheck failure.** Driving the handler with a custom-shaped event threw before any of Dove's own
work started, which the case caught:

```
TypeError: Cannot read properties of undefined (reading 'normalize')
  at digestPrompt (src/core/request-lifecycle.ts:403)
  at RequestLifecycleController.beginRequest (request-lifecycle.ts:210)
  at extension.ts:3362   <- beginRequest({ prompt: event.prompt })
```

**The fix** is one accessor that takes the event as `unknown`, prefers `prompt` when it is a string, falls back to the
custom message's content, and returns `""` otherwise. The handler reads it once. That keeps the module compiling against
both versions, which is the point: the pinned host is what Dove ships against, the latest channel is what the matrix
tests, and one of them has no `prompt` on this event at all.

**Verified the way the matrix does it, not by argument.** `npm install --no-save @earendil-works/pi-coding-agent@latest
@earendil-works/pi-tui@latest` (1.2.0), then `npm run typecheck` **clean** and `npm test` **983 of 983**, then `npm ci`
back to 1.0.0 with a clean typecheck again. The case is the claim rather than the spelling - the same text through either
shape must reach the planner and produce the same plan - and it carries its own state directory, because a case that
leaves `request.planned` records in the shared file-level ledger changes what the cases after it read. That was measured
too: the first version of the case broke `registers modes, shortcuts, capabilities, and doctor`.

Committed as `61450d9`, with a rule row in the front door.

## Two: a person's own request, through the CLI's own entry

**The TUI itself cannot be driven here** - it needs a TTY, and this session has no PTY - so what follows is the next
closest thing, and it is a different entry from the three passes: Pi 1.0.0 has `--print`/`-p` (`dist/cli/args.js:134`,
`runPrintMode`), so `dove-pi -p "<a request>"` is the CLI's own one-shot, driven by a person's own sentence rather than
by the field runner's scenario.

**Two of the three attempts were lost to quoting, and that is worth the sentence.** The first passed the request inside a
PowerShell-escaped bash command and the shell cut it at its first space, so the model received the single word `This` and
answered *"It looks like your message got cut off - 'This' doesn't give me enough to act on."* The second left an
unmatched `)`. The fix was a script file with one level of quoting, which is the same lesson this repository has written
down twice before: text going through a command line is a step that needs a mechanism, not care.

**What the valid run did** - a real request, in a copy of the graded clone, through the installed launcher:

| | reading |
|---|---|
| the request | the whole-flow scenario's own first message, one line, 958 characters |
| the entry | `dove-pi --offline -p "$(cat …)"`, 40-minute ceiling |
| the plan | a **formal task opened** from the message, as intake is supposed to |
| the gate | the mode loaded and the effects were recorded (`tool: bash, decision: allowed`) |
| the work | the project's own suite went **1 failed, 115 passed → 116 passed** |
| the library | `cachecontrol/controller.py` 20,090 → **21,037 B** |
| the instrument | `test_immutable.py` **1,305 B** and `conftest.py` **5,971 B** - byte-identical, so the library was fixed |
| the end | `Request timed out.` at 38.9 minutes, task left `active/blocked` |

**So the answer to the question is: the person-facing entry works, and it does the work.** What one request does not do is
the wrap-up - the task was not archived - which is the same shape the three passes showed, where the wrap-up happens in
the request after the work. A person would type again; the field runner's scenario has a step for it; a single `-p` call
does not.

**One reading worth keeping about where the state went**: a plain `dove-pi` run in a project writes its ledger to
`~/.pi/agent/dove/workspaces/<hash>/execution.jsonl`, not into the project. The project gets `.dove/mode.json` and
`.dove/effects/`, and nothing else. The three passes' ledgers were in the runner's scenario root because the runner sets
`DOVE_PI_STATE_DIR`; this one is what a customer gets.
