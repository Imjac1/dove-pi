# Implementation plan: the one action

## Ordered checklist

- [x] **1. The help, read.**
- [x] **2. The command, named.**
- [x] **3. What it would change.**
- [x] **4. The gate.**

## The action, named from the help

```text
dove-pi update     "atomically update Dove and its release-locked Pi runtime"

and `update --check` already reported what it would be acting on:
  Latest stable release: v0.2.0
  Pi: not installed -> 0.84.3 (update available)
```

**So the one action is `dove-pi update`**, and its own help says what it changes: the managed application release on this machine, and the
Pi runtime locked to it. **The check and the update are a matched pair** - one reports, the other acts, and the help says so in adjacent lines.

## What it would change, in machine terms

**Not the repository.** The tree is unrelated to it: `update` writes a managed release under the user application directory and installs Pi
0.84.3. **Nothing this session has done or could do on files would be affected**, which is why the boundary is not about the repository at all.

## Who could lift it, and why the loop cannot

```text
the standing instruction   confirm before safety-sensitive operations unless explicitly authorised
the session context        approval prompts are disabled; actions that require approval are rejected automatically
                            and escalation is not to be requested
```

**So the confirmation cannot be obtained inside this loop.** The action is not taken, **not because it would fail but because nothing here can
authorise it** - and the party who can is the user, whose answer is recorded as unknown rather than assumed. **That is the precise form of the
boundary**: not *can this be done*, but *who may say yes*.

## Validation commands

```powershell
python dove_pi.py --help
npm test
```

## Recorded, not built

1. **The install itself.**