# Implementation plan: the capabilities, run

## Ordered checklist

- [x] **1. The temporary project.**
- [x] **2. Two runs**, one with arguments and one without.
- [x] **3. The before-and-after comparison.**
- [x] **4. A refusal, then the gate.**

## The runs

```text
capability run dev.node_version          exit 0   protocolVersion 1.0.0, capability name and version
capability run dev.git_status            exit 1   status "failure", and the underlying error verbatim:
                                                  dev.git_status failed (dev.git_status:exit-status):
                                                  fatal: not a git repository   - which is true, git rev-parse exits 128 there
capability run workspace.inspect         exit 1   Capability arguments do not match the advertised parameter schema
capability run no.such_capability        exit 1   Unknown capability: no.such_capability

files changed by the three read-only runs:  none
```

## What each result means

**A valid run exits zero and returns the protocol envelope**: the version, the capability identity, a correlation block with request, host
session and execution ids, a duration and an evidence list. **A failing condition exits one and says so in a typed field**, with the
underlying error preserved rather than replaced - the git failure above is the tool own message, not a paraphrase of it.

**And the declaration became a measurement**: three capabilities declare `read_only`, three were run, and the temporary project was compared
before and after with nothing changed.

## What this does not prove

**That a capability which writes behaves as declared.** The round that read the declarations found four `workspace_write` and one
`system_change`, and none of those was run here - they are not for this environment, which is the same boundary every functional check in this
session has met.

The fixture was removed and this repository is untouched.

## Validation commands

```powershell
python dove_pi.py capability run dev.node_version
python dove_pi.py capability run workspace.inspect --args={"path":"package.json"}
npm run typecheck
npm test
```

## Recorded, not built

1. **Capabilities that change the machine.**
2. **The first real turn.**