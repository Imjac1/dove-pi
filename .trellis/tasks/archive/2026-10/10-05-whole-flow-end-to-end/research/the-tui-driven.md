# The TUI, driven, and 0.2.3 published

Measured 2026-10-14, answering the two things the last report left with the operator: ship the compatibility fix to
users, and find a way to test the TUI that no pass had touched.

## 0.2.3

`v0.2.1` and `v0.2.2` were published without the fix for the compatibility red - they work on the pinned host, which is
what their release jobs proved, and neither carried the structural prompt read. 0.2.3 does.

The tag has to equal the package version, so the bump is `package.json` and the two version fields in `package-lock.json`
and nothing else: `modes/*/governance.yaml` carries the range `>=0.2.0 <0.3.0`, and `src/capabilities/code-audit.ts`
carries the *capability* protocol version, which moves when that capability's arguments move.

Verified before pushing, in the order the release job does it: typecheck clean, `npm test` **984 of 984**, installer
**143 OK**, `pi:smoke` reporting `Dove Pi 0.2.3`, the manifest building as `0.2.3+479c1fc`, and the assembled archive
passing `release:check` as `Release ready: v0.2.3 (0.2.3+479c1fc); assets=4`. Then the push:

```
✓ v0.2.3 Release · 38523251158 — success in 4m16s
gh release list → v0.2.3  Latest  2026-10-14T06:41:14Z
assets: dove-pi-windows.zip · .zip.sha256 · install.ps1 · release.json
```

## The TUI, driven

**The obstacle, and what it took.** The TUI is a console application and a pipe is not a console. `winpty` is on this
machine (`/usr/bin/winpty`, from the git-for-windows bundle) but **refuses here**: its assert is
`ASSERT_CONDITION("wp != nullptr && cols > 0 && rows > 0")`, because it needs a console to *attach to* and this session's
processes have none. `node-pty` creates a ConPTY directly and does not need one, so that is the driver: installed into a
scratch directory (`node-pty` 1.1.0, prebuilt, 2 packages in 4 s) rather than into the repository.

**What the driver does**, and it is deliberately what a person does: spawn `dove-pi.cmd --offline` in a copy of the
graded clone through a 140×44 pseudo-console, wait 30 seconds for the TUI to come up, type the request (958 characters,
the same one the `-p` pass used), press Enter, then poll the project's own suite every 30 seconds until it is green or
45 minutes have passed.

**The result** - the log, which is the whole arc a person would have watched:

```
[06:35:29] started the TUI in …\tui-project; baseline suite: 1 failed, 115 passed in 2.29s
[06:35:59] typing the request (958 characters) into the TUI
[06:36:01] pressed Enter
[06:42:02] the project: 1 failed, 115 passed | controller.py 20171 B      ← the first edit
[06:42:33] the project: 13 errors in 0.71s | controller.py 20171 B        ← it broke the module
[06:45:42] the project: 1 failed, 115 passed | controller.py 20829 B      ← recovered
[06:51:42] the project: 4 failed, 112 passed | controller.py 20434 B      ← broke it again
[06:52:15] the project: 116 passed in 2.28s | controller.py 20993 B       ← and finished
[06:52:15] the project's own suite is green
[06:52:30] captured 6084565 bytes of TUI output
```

**And what was on the screen**, from the 6 MB transcript with the escape sequences stripped - 2,898 distinct printable
lines, of which these are the ones that say it was a real session:

- the TUI's own frame, `╭─── Pi v1.0.0 ─────`, and the meter `0.0%/200k (auto)` with the model beside it;
- `[Extensions]` and `[Extension issues]`, and the extension warnings a person sees at startup;
- the typed request, echoed back: `This project is bound to Dove, and work like this is tracked under a formal task…`;
- the spinner, `⠋ Working` / `⠸ Working` / `⠼ Working`, for the whole run;
- Dove's own notice, `Keeping computer awake (display-awake).`

**So the answer is yes: the TUI can be driven here, and it was.** The work got done through it - the project's suite went
from one failure to `116 passed`, with `cachecontrol/controller.py` 20,090 → 20,993 B and the judging instrument
untouched at 1,305 / 5,971 B.

**Three things worth stating with it.**

- **The driver is not a person.** It types the request and presses Enter; it does not answer a question, approve a
  dialog, or read the screen. A pass through it shows that the interactive path works, not that every interactive
  affordance does.
- **The task was left `active/intake`** - the work finished but the wrap-up did not run inside the 45-minute window,
  which is the same shape the `-p` pass and the three RPC passes showed: the work is one request and the wrap-up is the
  next one.
- **`node-pty`'s cleanup agent throws at the end** (`AttachConsole failed`), after the work is done and after Ctrl-C. It
  is node-pty's own console-list agent, not Dove, and it does not affect the reading.
