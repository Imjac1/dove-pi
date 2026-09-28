# Implementation plan: the check and its network

## Ordered checklist

- [x] **1. The network, measured.**
- [x] **2. The command, if it can run.**
- [x] **3. The tree, before and after.**
- [x] **4. The gate.**

## The network is there, and the command works

```text
Test-NetConnection api.github.com:443  ->  True
Invoke-WebRequest https://api.github.com -> HTTP 200

update --check   exit 0
  Latest stable release: v0.2.0
  Pi: not installed -> 0.84.3 (update available)
the tree, before and after:  unchanged
```

**The command documented as reporting *without changing anything* does exactly that.** Its exit code is zero, it answers, and `git status` is
identical before and after.

## And the reason it was declined was never measured

**Round 91 declined to run it because it needs the network.** The network exists, and one probe would have shown it. **That is the same defect
as the fallback two rounds ago**: a conclusion about a machine, drawn without asking the machine. **This is the second instance in three rounds**,
which makes it a pattern rather than a slip - **the session is better at noticing that a *search* missed something than at noticing that a
*test* was never run.**

## What its answer says about the first real turn

**`Pi: not installed -> 0.84.3 (update available)`.** So the thing the first real turn needs is *reachable from here* - the tool can see it and
would install it. **Installing it is what changes this machine**, and that is where this environment stops: the line is not *can the network be
reached*, it is *may this machine be changed*.

## Validation commands

```powershell
python dove_pi.py update --check
npm test
```

## Recorded, not built

1. **A command that changes the machine.**
2. **The first real turn.**